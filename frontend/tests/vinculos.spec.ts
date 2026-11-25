import { test, expect } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
let linha: string;
let a: { id: number; nome: string };
let b: { id: number; nome: string };

test.beforeEach(async ({ request }) => {
  linha = `Codex vínculo fictício ${Date.now()}`;
  const criar = async () => {
    const response = await request.post(api + '/clientes', { data: { nome: linha } });
    expect(response.status()).toBe(201);
    return response.json();
  };
  a = await criar(); b = await criar();
  expect((await request.patch(`${api}/clientes/${a.id}/ficha`, { data: { nomesAlternativos: [`Apelido único ${linha}`], observacoesPermanentes: 'Ficha A preservada' } })).ok()).toBe(true);
  expect((await request.post(`${api}/clientes/${a.id}/procedimentos`, { data: { titulo: 'Procedimento preservado', descricao: 'Instrução fictícia' } })).status()).toBe(201);
  expect((await request.post(api + '/excel/importar', { data: { estado: {
    clientesExtras: [linha], nomesAlterados: {}, nomesBusca: { [linha]: ['Apelido da linha'] }, informacoesClientes: { [linha]: 'Informação exclusiva do Excel' }, avisosExtras: [],
    registros: { '2026-11': { [linha]: { status: 'OK', observacao: 'Novembro preservado' } }, '2026-12': { [linha]: { status: 'AGUARDANDO', observacao: 'Dezembro preservado' } } },
  } } })).ok()).toBe(true);
});

async function abrir(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...').fill(linha);
}
async function editar(page: Page) {
  await page.getByRole('button', { name: /Alterar\s*Cliente/, exact: true }).click();
  const modal = page.locator('.excel-modal').filter({ has: page.getByRole('heading', { name: 'Alterar cliente', exact: true }) });
  await modal.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption(linha);
  await expect(modal.getByRole('combobox', { name: 'Ficha vinculada', exact: true })).toBeEnabled();
  return modal;
}
const estado = async (request: APIRequestContext) => (await (await request.get(api + '/excel/estado')).json()).estado;

test('vínculo manual distingue homônimos, abre a ficha por ID e preserva a linha ao renomear e desvincular', async ({ page, request }) => {
  await abrir(page);
  await expect(page.getByRole('button', { name: /Abrir ficha vinculada/ })).toHaveCount(0);
  const antes = await estado(request);
  let modal = await editar(page);
  await expect(modal.getByRole('combobox', { name: 'Ficha vinculada', exact: true })).toHaveValue('');
  await modal.getByLabel('Buscar ficha para vincular').fill(`APELIDO ÚNICO ${linha}`);
  await modal.getByRole('combobox', { name: 'Ficha vinculada', exact: true }).selectOption(String(a.id));
  expect((await estado(request)).vinculosClientes[linha]).toBeUndefined();
  await modal.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  const atalho = () => page.getByRole('button', { name: new RegExp(`Abrir ficha vinculada.*\\(#${a.id}\\)$`) });
  await expect(atalho()).toBeVisible();
  await page.reload(); await expect(atalho()).toBeVisible();
  expect((await estado(request)).vinculosClientes[linha]).toBe(a.id);
  await atalho().click();
  await expect(page.getByRole('textbox', { name: 'Anotações permanentes', exact: true })).toHaveValue('Ficha A preservada');
  await expect(page.locator('.ficha-procedimento')).toContainText('Instrução fictícia');
  await page.getByRole('button', { name: 'Fechar fichas', exact: true }).click();
  expect((await request.patch(`${api}/clientes/${a.id}`, { data: { nome: `${linha} cadastro renomeado` } })).ok()).toBe(true);
  modal = await editar(page);
  await modal.getByLabel('Nome principal', { exact: true }).fill(`${linha} nome da linha alterado`);
  await expect(modal.getByRole('combobox', { name: 'Ficha vinculada', exact: true })).toHaveValue(String(a.id));
  await modal.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await expect(atalho()).toBeVisible();
  await atalho().click();
  await expect(page.getByRole('heading', { name: `${linha} cadastro renomeado`, exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar fichas', exact: true }).click();
  const fichaAntes = await (await request.get(`${api}/clientes/${a.id}/ficha`)).json();
  modal = await editar(page);
  await modal.getByRole('combobox', { name: 'Ficha vinculada', exact: true }).selectOption('');
  await modal.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await expect(page.getByRole('button', { name: /Abrir ficha vinculada/ })).toHaveCount(0);
  const depois = await estado(request);
  expect(depois.registros).toEqual(antes.registros);
  expect(depois.informacoesClientes).toEqual(antes.informacoesClientes);
  expect(depois.nomesBusca).toEqual(antes.nomesBusca);
  expect(await (await request.get(`${api}/clientes/${a.id}/ficha`)).json()).toEqual(fichaAntes);
  await expect(page.getByRole('heading', { name: 'Xaxim Gás', exact: true })).toBeVisible();
});

test('dois navegadores compartilham o vínculo e resolvem escolhas concorrentes sem sobrescrever silenciosamente', async ({ page, browser, request }) => {
  const ctx = await browser.newContext();
  try {
    const outra = await ctx.newPage(); await abrir(page); await abrir(outra);
    const ma = await editar(page), mb = await editar(outra);
    await ma.getByLabel('Buscar ficha para vincular').fill(linha);
    await mb.getByLabel('Buscar ficha para vincular').fill(linha);
    await ma.getByRole('combobox', { name: 'Ficha vinculada', exact: true }).selectOption(String(a.id));
    await mb.getByRole('combobox', { name: 'Ficha vinculada', exact: true }).selectOption(String(b.id));
    await ma.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
    await expect(ma).toHaveCount(0);
    await mb.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
    await expect(mb.getByRole('alert')).toContainText('Outro computador alterou');
    await expect(mb.getByRole('combobox', { name: 'Ficha vinculada', exact: true })).toHaveValue(String(b.id));
    expect((await estado(request)).vinculosClientes[linha]).toBe(a.id);
    await mb.getByRole('button', { name: 'Manter minha escolha após revisar', exact: true }).click();
    await mb.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
    await expect(mb).toHaveCount(0);
    await expect(page.getByRole('button', { name: new RegExp(`Abrir ficha vinculada.*\\(#${b.id}\\)$`) })).toBeVisible();
    expect((await estado(request)).vinculosClientes[linha]).toBe(b.id);
  } finally { await ctx.close(); }
});

test('falhas de leitura e gravação permitem repetir sem perder a escolha nem aplicar o vínculo antes de salvar', async ({ page, request }) => {
  await abrir(page);
  let falharLista = true;
  await page.route(api + '/clientes', async route => {
    if (falharLista) { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia ao carregar fichas' }) }); }
    else await route.continue();
  });
  await page.getByRole('button', { name: /Alterar\s*Cliente/, exact: true }).click();
  const modal = page.locator('.excel-modal').filter({ has: page.getByRole('heading', { name: 'Alterar cliente', exact: true }) });
  await modal.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption(linha);
  await expect(modal.getByRole('alert')).toHaveText('Falha fictícia ao carregar fichas');
  falharLista = false;
  await modal.getByRole('button', { name: 'Tentar carregar fichas novamente', exact: true }).click();
  await expect(modal.getByRole('combobox', { name: 'Ficha vinculada', exact: true })).toBeEnabled();
  await modal.getByRole('combobox', { name: 'Ficha vinculada', exact: true }).selectOption(String(a.id));
  let falharGravacao = true;
  await page.route(api + '/excel/estado', async route => {
    if (route.request().method() === 'PATCH' && falharGravacao) { falharGravacao = false; await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia ao gravar vínculo' }) }); }
    else await route.continue();
  });
  await modal.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await expect(modal.getByRole('alert')).toHaveText('Falha fictícia ao gravar vínculo');
  await expect(modal.getByRole('combobox', { name: 'Ficha vinculada', exact: true })).toHaveValue(String(a.id));
  expect((await estado(request)).vinculosClientes[linha]).toBeUndefined();
  await modal.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect((await estado(request)).vinculosClientes[linha]).toBe(a.id);
});
