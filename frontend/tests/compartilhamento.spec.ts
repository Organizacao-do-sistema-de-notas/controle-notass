import { test, expect } from './fixtures';
import type { Browser, BrowserContext, Page } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
const nome = 'Codex empresa compartilhada ficticia';
const chaveInfo = 'controle-notas-excel-clientes-informacoes';
const vazio = () => ({ clientesExtras: [] as string[], nomesAlterados: {} as Record<string,string>, nomesBusca: {} as Record<string,string[]>, informacoesClientes: {} as Record<string,string>, avisosExtras: [] as {id:string;titulo:string;texto:string}[], registros: {} as Record<string,Record<string,{status:string;observacao:string}>> });
async function contexto(browser: Browser) {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:5175' });
  await ctx.addInitScript(() => { localStorage.setItem('controle-notas-modo', 'excel'); localStorage.setItem('controle-notas-excel-mes', '2026-11'); });
  return ctx;
}
async function abrir(ctx: BrowserContext) {
  const page = await ctx.newPage(); await page.goto('/');
  await expect(page.getByText('Dados compartilhados entre os computadores.', { exact: true })).toBeVisible();
  return page;
}
async function info(page: Page) {
  await page.getByRole('button', { name: `Informações adicionais de ${nome}`, exact: true }).click();
  return page.getByRole('dialog', { name: nome, exact: true });
}
async function prepararServidor(request: import('@playwright/test').APIRequestContext) {
  const estado = vazio(); estado.clientesExtras = [nome]; estado.informacoesClientes[nome] = 'Texto inicial';
  estado.registros['2026-11'] = { [nome]: { status: 'PENDENTE', observacao: '' } };
  const r = await request.post(api + '/excel/importar', { data: { estado } }); expect(r.ok()).toBe(true);
  const id = (await r.json()).estado.vinculosClientes[nome];
  expect((await request.patch(`${api}/clientes/${id}/ficha`, { data: { frequenciaAcesso: 'MENSAL' } })).ok()).toBe(true);
}

test('janela tem caixa de texto, Alterar, X e Salvar; só grava ao salvar e protege fechamento', async ({ page, request }) => {
  await prepararServidor(request);
  await page.goto('/'); await page.getByRole('button', { name: 'Excel', exact: true }).click();
  const dialog = await info(page);
  const caixa = dialog.getByRole('textbox', { name: 'Informações adicionais', exact: true });
  await expect(caixa).toHaveValue('Texto inicial'); await expect(caixa).toHaveAttribute('readonly', '');
  await expect(dialog.getByRole('button', { name: 'Salvar', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Alterar', exact: true }).click();
  await caixa.fill('Texto revisado');
  expect((await (await request.get(api + '/excel/estado')).json()).estado.informacoesClientes[nome]).toBe('Texto inicial');
  page.once('dialog', d => d.dismiss());
  await dialog.getByRole('button', { name: 'Fechar informações adicionais' }).click();
  await expect(dialog).toBeVisible(); await expect(caixa).toHaveValue('Texto revisado');
  await dialog.getByRole('button', { name: 'Salvar', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Informações salvas.');
  await expect(caixa).toHaveAttribute('readonly', '');
  await dialog.getByRole('button', { name: 'Fechar informações adicionais' }).click();
  await page.reload(); const relido = await info(page); await expect(relido.getByRole('textbox')).toHaveValue('Texto revisado');
});

test('dois navegadores compartilham informações, clientes, apelidos, avisos e dados mensais', async ({ browser }) => {
  const a = await contexto(browser), b = await contexto(browser);
  try {
    await a.addInitScript(({nome,chaveInfo}) => {
      localStorage.setItem('controle-notas-excel-clientes', JSON.stringify([nome]));
      localStorage.setItem('controle-notas-excel-clientes-apelidos', JSON.stringify({[nome]:['Apelido compartilhado']}));
      localStorage.setItem(chaveInfo, JSON.stringify({[nome]:'Informação importada do notebook'}));
      localStorage.setItem('controle-notas-excel-registros-2026-11', JSON.stringify({[nome]:{status:'OK',observacao:'Conferência de novembro'}}));
      localStorage.setItem('controle-notas-excel-registros-2026-12', JSON.stringify({[nome]:{status:'AGUARDANDO',observacao:'Conferência de dezembro'}}));
      localStorage.setItem('controle-notas-excel-avisos', JSON.stringify([{id:'codex-aviso-compartilhado',titulo:'Aviso compartilhado',texto:'Aviso fictício da equipe'}]));
    }, {nome,chaveInfo});
    const pa = await a.newPage(); await pa.goto('/');
    await pa.getByRole('button', {name:'Importar dados deste navegador',exact:true}).click();
    await expect(pa.getByRole('button', {name:'Importar dados deste navegador',exact:true})).toHaveCount(0);
    const pb = await abrir(b);
    await pb.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...').fill('Apelido compartilhado');
    await expect(pb.locator('.excel-table-row')).toHaveCount(1);
    await expect(pb.getByRole('textbox',{name:`Observação mensal de ${nome}`,exact:true})).toHaveValue('Conferência de novembro');
    await expect(pb.getByRole('heading',{name:'Aviso compartilhado',exact:true})).toBeVisible();
    const da = await info(pa), db = await info(pb);
    await expect(db.getByRole('textbox')).toHaveValue('Informação importada do notebook');
    await db.getByRole('button',{name:'Alterar',exact:true}).click(); await db.getByRole('textbox').fill('Informação editada no computador principal');
    await db.getByRole('button',{name:'Salvar',exact:true}).click();
    await expect(da.getByRole('textbox')).toHaveValue('Informação editada no computador principal');
    await db.getByRole('button',{name:'Fechar informações adicionais'}).click();
    await pb.getByRole('combobox',{name:'Selecionar mês da visão Excel'}).selectOption('2026-12');
    await expect(pb.getByRole('textbox',{name:`Observação mensal de ${nome}`,exact:true})).toHaveValue('Conferência de dezembro');
    expect(await pb.evaluate(chave=>localStorage.getItem(chave),chaveInfo)).toBeNull();
  } finally {await a.close();await b.close();}
});

test('edição simultânea preserva o texto remoto e exige revisão para substituir', async ({ browser, request }) => {
  await prepararServidor(request); const a=await contexto(browser),b=await contexto(browser);
  try {
    const pa=await abrir(a),pb=await abrir(b),da=await info(pa),db=await info(pb);
    await da.getByRole('button',{name:'Alterar',exact:true}).click(); await db.getByRole('button',{name:'Alterar',exact:true}).click();
    await da.getByRole('textbox').fill('Edição do primeiro computador'); await db.getByRole('textbox').fill('Edição do segundo computador');
    await da.getByRole('button',{name:'Salvar',exact:true}).click(); await expect(da.getByRole('status')).toHaveText('Informações salvas.');
    await db.getByRole('button',{name:'Salvar',exact:true}).click(); await expect(db.getByRole('alert')).toContainText('Outro computador alterou');
    await expect(db.getByRole('textbox')).toHaveValue('Edição do segundo computador');
    expect((await (await request.get(api+'/excel/estado')).json()).estado.informacoesClientes[nome]).toBe('Edição do primeiro computador');
    await db.getByRole('button',{name:'Manter meu texto após revisar',exact:true}).click();
    await db.getByRole('button',{name:'Salvar',exact:true}).click(); await expect(db.getByRole('status')).toHaveText('Informações salvas.');
    await expect(da.getByRole('textbox')).toHaveValue('Edição do segundo computador');
  } finally {await a.close();await b.close();}
});

test('observação pendente não perde o texto quando outro computador salva primeiro', async ({ browser, request }) => {
  await prepararServidor(request); const a=await contexto(browser),b=await contexto(browser);
  try {
    const pa=await abrir(a),pb=await abrir(b);
    let liberar!:()=>void;const gate=new Promise<void>(resolve=>{liberar=resolve;});
    await pa.route('**/excel/estado',async route=>{if(route.request().method()==='PATCH')await gate;await route.continue();});
    const campoA=pa.getByRole('textbox',{name:`Observação mensal de ${nome}`,exact:true});
    const campoB=pb.getByRole('textbox',{name:`Observação mensal de ${nome}`,exact:true});
    await campoA.fill('Observação A pendente');
    await expect(pa.locator('.excel-observacao-pendente').filter({hasText:'Salvando...'})).toBeVisible();
    await campoB.fill('Observação B salva');
    await expect.poll(async()=>(await(await request.get(api+'/excel/estado')).json()).estado.registros['2026-11']?.[nome]?.observacao).toBe('Observação B salva');
    liberar();
    await expect(pa.locator('.excel-observacao-erro')).toContainText('Outro computador alterou');
    await expect(campoA).toHaveValue('Observação A pendente');
    await pa.getByRole('button',{name:'Usar texto do banco',exact:true}).click(); await expect(campoA).toHaveValue('Observação B salva');
    await pa.unrouteAll({behavior:'wait'});
    await campoA.fill('Observação A após revisão');
    const row=pb.locator('.excel-table-row').filter({hasText:nome});
    await row.locator('.excel-status-trigger').click(); await row.getByRole('button',{name:'OK',exact:true}).click();
    await expect(campoB).toHaveValue('Observação A após revisão');
    await expect(pa.locator('.excel-table-row').filter({hasText:nome}).locator('.excel-status-trigger')).toContainText('OK');
  } finally {await a.close();await b.close();}
});

test('importação local mantém originais e não substitui dados que já estão no banco', async ({ page, request }) => {
  await prepararServidor(request);
  await page.addInitScript(({nome,chaveInfo})=>{
    localStorage.setItem('controle-notas-modo','excel');
    localStorage.setItem('controle-notas-excel-clientes',JSON.stringify([nome,'Codex cliente somente local']));
    localStorage.setItem(chaveInfo,JSON.stringify({[nome]:'Texto local diferente','Codex cliente somente local':'Dado local exclusivo'}));
  },{nome,chaveInfo});
  await page.goto('/');
  const originais=await page.evaluate(()=>({clientes:localStorage.getItem('controle-notas-excel-clientes'),infos:localStorage.getItem('controle-notas-excel-clientes-informacoes')}));
  await page.getByRole('button',{name:'Importar dados deste navegador',exact:true}).click();
  await expect(page.getByText(/1 divergências preservadas/)).toBeVisible();
  await page.getByText('Ver divergências da importação',{exact:true}).click();
  await expect(page.locator('.excel-importacao-resultado')).toContainText('Texto local diferente');
  const salvo=(await(await request.get(api+'/excel/estado')).json()).estado;
  expect(salvo.informacoesClientes[nome]).toBe('Texto inicial');expect(salvo.informacoesClientes['Codex cliente somente local']).toBe('Dado local exclusivo');
  expect(await page.evaluate(()=>({clientes:localStorage.getItem('controle-notas-excel-clientes'),infos:localStorage.getItem('controle-notas-excel-clientes-informacoes')}))).toEqual(originais);
});

test('observação pendente continua no mês correto quando a competência muda antes da gravação', async ({ browser, request }) => {
  await prepararServidor(request); const ctx=await contexto(browser);
  try {
    const page=await abrir(ctx);
    await page.getByRole('textbox',{name:`Observação mensal de ${nome}`,exact:true}).fill('Texto pendente de novembro');
    await page.getByRole('combobox',{name:'Selecionar mês da visão Excel'}).selectOption('2026-12');
    await expect(page.getByRole('textbox',{name:`Observação mensal de ${nome}`,exact:true})).toHaveValue('');
    await expect.poll(async()=>(await(await request.get(api+'/excel/estado')).json()).estado.registros['2026-11']?.[nome]?.observacao).toBe('Texto pendente de novembro');
    const salvo=(await(await request.get(api+'/excel/estado')).json()).estado;
    expect(salvo.registros['2026-12']?.[nome]).toBeUndefined();
    await page.getByRole('combobox',{name:'Selecionar mês da visão Excel'}).selectOption('2026-11');
    await expect(page.getByRole('textbox',{name:`Observação mensal de ${nome}`,exact:true})).toHaveValue('Texto pendente de novembro');
  } finally {await ctx.close();}
});

test('falha de rede na janela conserva o rascunho e uma gravação em andamento bloqueia o X', async ({ page, request }) => {
  await prepararServidor(request); await page.goto('/');await page.getByRole('button',{name:'Excel',exact:true}).click();
  const dialog=await info(page);await dialog.getByRole('button',{name:'Alterar',exact:true}).click();
  await dialog.getByRole('textbox').fill('Texto mantido durante a falha');
  await page.route('**/excel/estado',route=>route.request().method()==='PATCH'?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({erro:'Falha fictícia de conexão'})}):route.continue());
  await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Falha fictícia de conexão');await expect(dialog.getByRole('textbox')).toHaveValue('Texto mantido durante a falha');
  expect((await(await request.get(api+'/excel/estado')).json()).estado.informacoesClientes[nome]).toBe('Texto inicial');
  await page.unrouteAll({behavior:'wait'});
  let liberar!:()=>void;const gate=new Promise<void>(resolve=>{liberar=resolve;});
  await page.route('**/excel/estado',async route=>{if(route.request().method()==='PATCH')await gate;await route.continue();});
  await dialog.getByRole('button',{name:'Salvar',exact:true}).click();
  await expect(dialog.getByRole('button',{name:'Fechar informações adicionais'})).toBeDisabled();
  await page.keyboard.press('Escape');await expect(dialog).toBeVisible();
  liberar();await expect(dialog.getByRole('status')).toHaveText('Informações salvas.');
  await dialog.getByRole('button',{name:'Fechar informações adicionais'}).click();
});
