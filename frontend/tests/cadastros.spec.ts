import { expect, test, type Page } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
let tag: string;
let cliente: { id: number; nome: string };
let outro: { id: number; nome: string };
let firma: { id: number; nome: string };

test.beforeEach(async ({ request }) => {
  tag = `Codex cadastros ficticios ${Date.now()}`;
  const f = await request.post(`${api}/contabilidades`, { data: { nome: `${tag} contabilidade A` } });
  expect(f.status()).toBe(201);
  firma = await f.json();
  const c = await request.post(`${api}/clientes`, { data: { nome: `${tag} cliente` } });
  expect(c.status()).toBe(201);
  cliente = await c.json();
  const o = await request.post(`${api}/clientes`, { data: { nome: `${tag} outro`, contabilidadeId: firma.id } });
  expect(o.status()).toBe(201);
  outro = await o.json();
  expect((await request.patch(`${api}/clientes/${outro.id}`, { data: { ativo: false } })).ok()).toBe(true);
  expect((await request.patch(`${api}/clientes/${cliente.id}/ficha`, {
    data: { nomesAlternativos: [`Apelido Cádastro ${tag}`], observacoesPermanentes: 'Preservar anotação da ficha' },
  })).ok()).toBe(true);
});

async function abrir(page: Page, aba = 'Clientes') {
  await page.goto('/');
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  await page.getByRole('menuitem', { name: aba, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cadastros', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Carregando cadastros...', { exact: true })).toHaveCount(0);
  return dialog;
}

test('menu discreto, teclado, filtros de todos os clientes e pesquisa por apelido', async ({ page }) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Mais opções', exact: true });
  await expect(page.getByRole('menu')).toHaveCount(0);
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Clientes', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Contabilidades', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await menu.click();
  await page.getByRole('menuitem', { name: 'Clientes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cadastros', exact: true });
  await dialog.getByLabel('Buscar clientes').fill(tag);
  await expect(dialog.locator('.cadastros-linha')).toHaveCount(2);
  await dialog.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('ATIVOS');
  await expect(dialog.locator('.cadastros-linha')).toHaveCount(1);
  await expect(dialog.locator('.cadastros-linha')).toContainText(cliente.nome);
  await dialog.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('INATIVOS');
  await expect(dialog.locator('.cadastros-linha')).toContainText(outro.nome);
  await dialog.getByRole('combobox', { name: 'Situação', exact: true }).selectOption('TODOS');
  await dialog.getByLabel('Filtrar por contabilidade').selectOption('SEM');
  await expect(dialog.locator('.cadastros-linha')).toHaveCount(1);
  await dialog.getByLabel('Filtrar por contabilidade').selectOption('TODAS');
  await dialog.getByLabel('Buscar clientes').fill(`APELIDO   CADASTRO ${tag.toUpperCase()}`);
  await expect(dialog.locator('.cadastros-linha')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test('editar nome, situação e contabilidade preserva ficha e histórico e atualiza o Painel', async ({ page, request }) => {
  const p = await request.post(`${api}/clientes/${cliente.id}/procedimentos`, { data: { titulo: 'Teste fictício', descricao: 'Preservar procedimento' } });
  expect(p.status()).toBe(201);
  expect((await request.post(`${api}/pendencias`, { data: { clienteId: cliente.id, competencia: '2026-11', status: 'PENDENTE' } })).status()).toBe(201);
  const dialog = await abrir(page);
  await dialog.getByLabel('Buscar clientes').fill(cliente.nome);
  await dialog.getByRole('button', { name: `Editar cliente ${cliente.nome} (#${cliente.id})`, exact: true }).click();
  const novoNome = `${tag} editado`;
  await dialog.getByLabel('Nome do cliente', { exact: true }).fill(novoNome);
  await dialog.getByLabel('Situação do cliente').selectOption('INATIVO');
  await dialog.getByLabel('Contabilidade do cliente').selectOption(String(firma.id));
  await dialog.getByLabel('Responsável pela alteração').fill('Operador fictício');
  await dialog.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Cliente salvo.');
  await expect(dialog.getByRole('region', { name: 'Histórico de contabilidades' })).toContainText(`Sem contabilidade → ${firma.nome}`);
  let ficha = await (await request.get(`${api}/clientes/${cliente.id}/ficha`)).json();
  expect(ficha.nome).toBe(novoNome);
  expect(ficha.ativo).toBe(false);
  expect(ficha.observacoesPermanentes).toBe('Preservar anotação da ficha');
  expect(ficha.nomesAlternativos).toHaveLength(1);
  expect(ficha.procedimentos).toHaveLength(1);
  expect(ficha.historicoContabilidades).toHaveLength(1);
  expect(ficha.historicoContabilidades[0].autor).toBe('Operador fictício');
  await dialog.getByLabel('Contabilidade do cliente').selectOption('');
  await dialog.getByLabel('Situação do cliente').selectOption('ATIVO');
  await dialog.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Cliente salvo.');
  await expect(dialog.locator('.cadastros-historico li')).toHaveCount(2);
  ficha = await (await request.get(`${api}/clientes/${cliente.id}/ficha`)).json();
  expect(ficha.contabilidadeId).toBeNull();
  expect(ficha.historicoContabilidades[0].nomeAnterior).toBe(firma.nome);
  await dialog.getByRole('button', { name: 'Fechar cadastros' }).click();
  await page.locator('.toolbar').getByRole('combobox', { name: 'Competência', exact: true }).selectOption('2026-11');
  await expect(page.locator('.pendencia-card').filter({ hasText: novoNome })).toBeVisible();
});

test('gravação bloqueia navegação, falha preserva campos e alterações não salvas pedem confirmação', async ({ page, request }) => {
  const dialog = await abrir(page);
  await dialog.getByLabel('Buscar clientes').fill(tag);
  await dialog.getByRole('button', { name: `Editar cliente ${cliente.nome} (#${cliente.id})`, exact: true }).click();
  let liberar!: () => void;
  const gate = new Promise<void>(resolve => { liberar = resolve; });
  const url = `**/clientes/${cliente.id}`;
  await page.route(url, async route => { if (route.request().method() === 'PATCH') await gate; await route.continue(); });
  await dialog.getByLabel('Nome do cliente', { exact: true }).fill(`${tag} primeiro salvamento`);
  await dialog.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Fechar cadastros' })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: 'Contabilidades', exact: true })).toBeDisabled();
  await expect(dialog.getByRole('button', { name: `Editar cliente ${outro.nome} (#${outro.id})`, exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  liberar();
  await expect(dialog.getByRole('status')).toHaveText('Cliente salvo.');
  await page.unrouteAll({ behavior: 'wait' });
  await page.route(url, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha simulada ao salvar cadastro' }) }));
  const corrigido = `${tag} texto preservado`;
  await dialog.getByLabel('Nome do cliente', { exact: true }).fill(corrigido);
  await dialog.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Falha simulada ao salvar cadastro');
  await expect(dialog.getByLabel('Nome do cliente', { exact: true })).toHaveValue(corrigido);
  page.once('dialog', confirmation => confirmation.dismiss());
  await dialog.getByRole('button', { name: 'Fechar cadastros' }).click();
  await expect(dialog).toBeVisible();
  await page.unrouteAll({ behavior: 'wait' });
  await dialog.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Cliente salvo.');
  expect((await (await request.get(`${api}/clientes/${cliente.id}`)).json()).nome).toBe(corrigido);
});

test('criar cliente e contabilidade no mesmo formulário, renomear contabilidade e preservar vínculo', async ({ page, request }) => {
  const dialog = await abrir(page);
  await dialog.getByRole('button', { name: 'Novo cliente', exact: true }).click();
  const nomeCliente = `${tag} novo`;
  const nomeFirma = `${tag} nova contabilidade`;
  await dialog.getByLabel('Nome do cliente', { exact: true }).fill(nomeCliente);
  await dialog.getByRole('button', { name: 'Cadastrar uma contabilidade', exact: true }).click();
  await dialog.getByLabel('Nome da nova contabilidade').fill(nomeFirma);
  await dialog.getByRole('button', { name: 'Cadastrar e selecionar' }).click();
  await expect(dialog.getByRole('status')).toContainText('Salve o cliente');
  const firmas = await (await request.get(`${api}/contabilidades`)).json();
  const cadastrada = firmas.find((item: {nome: string}) => item.nome === nomeFirma);
  await expect(dialog.getByLabel('Contabilidade do cliente')).toHaveValue(String(cadastrada.id));
  await dialog.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Cliente salvo.');
  const clientes = await (await request.get(`${api}/clientes`)).json();
  const novo = clientes.find((item: {nome: string}) => item.nome === nomeCliente);
  expect(novo.contabilidadeId).toBe(cadastrada.id);
  await dialog.getByRole('button', { name: 'Contabilidades', exact: true }).click();
  await dialog.getByLabel('Buscar contabilidades').fill(nomeFirma);
  await dialog.getByRole('button', { name: `Editar contabilidade ${nomeFirma} (#${cadastrada.id})`, exact: true }).click();
  await expect(dialog.locator('.cadastros-linha')).toContainText('1 cliente vinculado');
  await dialog.getByLabel('Nome da contabilidade', { exact: true }).fill(`${nomeFirma} revisada`);
  await dialog.getByRole('button', { name: 'Salvar contabilidade', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Contabilidade salva.');
  const atualizado = await (await request.get(`${api}/clientes/${novo.id}/ficha`)).json();
  expect(atualizado.contabilidade.nome).toBe(`${nomeFirma} revisada`);
  expect(atualizado.historicoContabilidades).toHaveLength(0);
});

test('falha de leitura mostra erro e permite repetir lista e histórico', async ({ page }) => {
  let falhar = true;
  await page.route('**/clientes', async route => {
    if (falhar && route.request().method() === 'GET') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: 'Lista temporariamente indisponível' }) });
    } else await route.continue();
  });
  const dialog = await abrir(page);
  await expect(dialog.getByRole('alert')).toContainText('Lista temporariamente indisponível');
  falhar = false;
  await dialog.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await dialog.getByLabel('Buscar clientes').fill(cliente.nome);
  let falharHistorico = true;
  await page.route(`**/clientes/${cliente.id}/ficha`, async route => {
    if (falharHistorico) {
      falharHistorico = false;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: 'Histórico indisponível' }) });
    } else await route.continue();
  });
  await dialog.getByRole('button', { name: `Editar cliente ${cliente.nome} (#${cliente.id})`, exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Histórico indisponível');
  await dialog.getByRole('button', { name: 'Recarregar histórico', exact: true }).click();
  await expect(dialog.getByText('Nenhuma troca de contabilidade registrada.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
});

test('resposta antiga de histórico não substitui o cliente selecionado', async ({ page, request }) => {
  expect((await request.patch(`${api}/clientes/${cliente.id}`, { data: { contabilidadeId: firma.id } })).ok()).toBe(true);
  expect((await request.patch(`${api}/clientes/${outro.id}`, { data: { contabilidadeId: null } })).ok()).toBe(true);
  const dialog = await abrir(page);
  await dialog.getByLabel('Buscar clientes').fill(tag);
  let liberar!: () => void;
  const gate = new Promise<void>(resolve => { liberar = resolve; });
  await page.route(`**/clientes/${cliente.id}/ficha`, async route => { await gate; await route.continue(); });
  await dialog.getByRole('button', { name: `Editar cliente ${cliente.nome} (#${cliente.id})`, exact: true }).click();
  await dialog.getByRole('button', { name: `Editar cliente ${outro.nome} (#${outro.id})`, exact: true }).click();
  await expect(dialog.getByLabel('Nome do cliente', { exact: true })).toHaveValue(outro.nome);
  await expect(dialog.locator('.cadastros-historico')).toContainText(`${firma.nome} → Sem contabilidade`);
  const antiga = page.waitForResponse(response => response.url() === `${api}/clientes/${cliente.id}/ficha`);
  liberar();
  await antiga;
  await expect(dialog.locator('.cadastros-historico li')).toHaveCount(1);
  await expect(dialog.locator('.cadastros-historico')).toContainText(`${firma.nome} → Sem contabilidade`);
});

test('menu e cadastros em tela pequena preservam Excel, foco e aviso permanente', async ({ page, request }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  const antes = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('controle-notas-excel'))));
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Clientes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cadastros', exact: true });
  await dialog.getByLabel('Buscar clientes').fill(cliente.nome);
  await dialog.getByRole('button', { name: `Editar cliente ${cliente.nome} (#${cliente.id})`, exact: true }).click();
  await dialog.getByLabel('Nome do cliente', { exact: true }).fill('Alteração a descartar');
  page.once('dialog', confirmation => confirmation.accept());
  await dialog.getByRole('button', { name: 'Contabilidades', exact: true }).click();
  await dialog.getByRole('button', { name: 'Nova contabilidade', exact: true }).click();
  await dialog.getByLabel('Nome da contabilidade', { exact: true }).fill('');
  await expect(dialog.getByRole('button', { name: 'Salvar contabilidade', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Fechar cadastros' }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
  const medidas = await dialog.evaluate(element => ({ largura: element.getBoundingClientRect().width, interna: element.scrollWidth, disponivel: element.clientWidth }));
  expect(medidas.largura).toBeLessThanOrEqual(390);
  expect(medidas.interna).toBeLessThanOrEqual(medidas.disponivel);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Xaxim Gás', exact: true })).toBeVisible();
  const depois = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([key]) => key.startsWith('controle-notas-excel'))));
  expect(depois).toEqual(antes);
  expect((await (await request.get(`${api}/clientes/${cliente.id}`)).json()).nome).toBe(cliente.nome);
});
