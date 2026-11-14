import { expect, test, type Page } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
let cliente: { id: number; nome: string };
let outro: { id: number; nome: string };
let contabilidade: { id: number; nome: string };

test.beforeEach(async ({ request }) => {
  const tag = `Codex UI fictício ${Date.now()}`;
  const response = await request.post(`${api}/contabilidades`, { data: { nome: `${tag} contabilidade` } });
  expect(response.status()).toBe(201);
  contabilidade = await response.json();
  const create = async (nome: string) => {
    const r = await request.post(`${api}/clientes`, { data: { nome } });
    expect(r.status()).toBe(201);
    return r.json();
  };
  cliente = await create(tag);
  outro = await create(`${tag} outro`);
});

async function abrir(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await page.getByRole('button', { name: /Fichas dos\s*Clientes/ }).click();
  await page.getByLabel('Buscar no banco').fill(cliente.nome);
  await page.getByRole('button', { name: cliente.nome, exact: true }).click();
  await expect(page.getByRole('heading', { name: cliente.nome, exact: true })).toBeVisible();
}

test('ficha: salvar, reler apelidos, trocar contabilidade e manter procedimentos', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await abrir(page);
  await page.getByLabel('Frequência de acesso').selectOption('MENSAL');
  await page.getByLabel('Outros nomes para pesquisa').fill('Apelido Códex\nApelido Códex\nOutro Codex');
  await page.getByLabel('Anotações permanentes').fill(' Orientação fictícia permanente ');
  await page.getByLabel('Modelo manual de mensagem').fill('Modelo fictício');
  await page.getByLabel('Contabilidade responsável').selectOption(String(contabilidade.id));
  await page.getByLabel('Responsável pela alteração').fill('Codex UI');
  await page.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Ficha salva no banco de dados.');
  await expect(page.getByLabel('Outros nomes para pesquisa')).toHaveValue('Apelido Códex\nOutro Codex');
  await expect(page.locator('.ficha-historico')).toContainText(contabilidade.nome);
  await page.getByLabel('Título', { exact: true }).fill('Procedimento fictício');
  await page.getByLabel('Passo a passo').fill('Primeiro passo');
  await page.getByRole('button', { name: 'Salvar procedimento', exact: true }).click();
  await expect(page.locator('.ficha-procedimento')).toContainText('Primeiro passo');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Passo a passo').fill('Passo revisado');
  await page.getByRole('button', { name: 'Salvar procedimento', exact: true }).click();
  await expect(page.locator('.ficha-procedimento')).toContainText('Passo revisado');
  await page.getByRole('button', { name: 'Desativar', exact: true }).click();
  await expect(page.locator('.ficha-procedimento')).toHaveClass(/inativo/);
  await page.getByRole('button', { name: 'Reativar', exact: true }).click();
  await expect(page.locator('.ficha-procedimento')).not.toHaveClass(/inativo/);
  await page.getByRole('button', { name: 'Fechar fichas' }).click();
  await page.getByRole('button', { name: /Fichas dos\s*Clientes/ }).click();
  await page.getByLabel('Buscar no banco').fill('APELIDO   CODEX');
  await page.getByLabel('Pesquisar por', { exact: true }).selectOption('NOME');
  await expect(page.locator('.ficha-item')).toHaveCount(0);
  await page.getByLabel('Pesquisar por', { exact: true }).selectOption('APELIDOS');
  await expect(page.locator('.ficha-item')).toHaveCount(1);
  await page.getByRole('button', { name: cliente.nome, exact: true }).click();
  await expect(page.getByLabel('Anotações permanentes')).toHaveValue('Orientação fictícia permanente');
  await expect(page.getByLabel('Frequência de acesso')).toHaveValue('MENSAL');
  const data = await (await request.get(`${api}/clientes/${cliente.id}/ficha`)).json();
  expect(data.nomesAlternativos).toHaveLength(2);
  expect(data.procedimentos).toHaveLength(1);
  expect(data.historicoContabilidades).toHaveLength(1);
  expect(data.historicoContabilidades[0].autor).toBe('Codex UI');
  expect(errors).toEqual([]);
});

test('navegação bloqueada durante gravação e erro de rede permite corrigir e tentar novamente', async ({ page }) => {
  await abrir(page);
  let liberar!: () => void;
  const gate = new Promise<void>(resolve => { liberar = resolve; });
  await page.route(`**/clientes/${cliente.id}/ficha`, async route => {
    if (route.request().method() === 'PATCH') { await gate; }
    await route.continue();
  });
  await page.getByLabel('Anotações permanentes').fill('Salvar sem misturar clientes');
  await page.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
  await expect(page.getByRole('button', { name: outro.nome, exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Fechar fichas' })).toBeDisabled();
  await expect(page.getByLabel('Anotações permanentes')).toBeDisabled();
  liberar();
  await expect(page.getByRole('status')).toContainText('Ficha salva');
  await page.unrouteAll({ behavior: 'wait' });
  await page.route(`**/clientes/${cliente.id}/ficha`, async route => {
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha simulada Codex' }) });
    else await route.continue();
  });
  await page.getByLabel('Anotações permanentes').fill('Texto mantido após falha');
  await page.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Falha simulada Codex');
  await expect(page.getByLabel('Anotações permanentes')).toHaveValue('Texto mantido após falha');
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Ficha salva');
});

test('Excel preserva aviso, prioridades, pesquisa e cadastro local; Painel continua acessível', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Xaxim Gás', exact: true })).toBeVisible();
  await page.locator('.priority-toggle').click();
  for (const nome of ['Bom dia filial', 'Bom dia Matriz', 'Compre bem']) {
    await expect(page.locator('.priority-list')).toContainText(nome);
  }
  const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('controle-notas-excel'))));
  await page.getByRole('button', { name: /Fichas dos\s*Clientes/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Fichas dos\s*Clientes/ })).toBeFocused();
  const after = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith('controle-notas-excel'))));
  expect(after).toEqual(before);
  await page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...').fill('Compre bem');
  await expect(page.locator('.excel-table-row')).toHaveCount(1);
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Controle de Notas', exact: true })).toBeVisible();
});

test('layout móvel e foco permanecem dentro da ficha', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await abrir(page);
  await page.getByRole('button', { name: 'Fechar fichas' }).focus();
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});


test('cadastro pelo Painel fica disponível na ficha sem importar a tabela Excel', async ({ page, request }) => {
  const nome = `Codex cadastro fictício ${Date.now()}`;
  await page.goto('/');
  await page.getByRole('button', { name: 'Novo cliente', exact: true }).click();
  await page.getByLabel('Nome do cliente', { exact: true }).fill(nome);
  await page.locator('.form-modal').getByLabel('Contabilidade').selectOption(String(contabilidade.id));
  await page.getByRole('button', { name: 'Cadastrar cliente', exact: true }).click();
  await expect(page.locator('.form-modal')).toHaveCount(0);
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await expect(page.locator('.excel-client-name').filter({ hasText: nome })).toHaveCount(0);
  await page.getByRole('button', { name: /Fichas dos\s*Clientes/ }).click();
  await page.getByLabel('Buscar no banco').fill(nome);
  await page.getByRole('button', { name: nome, exact: true }).click();
  await expect(page.getByLabel('Frequência de acesso')).toHaveValue('NAO_DEFINIDA');
  await expect(page.getByLabel('Contabilidade responsável')).toHaveValue(String(contabilidade.id));
  const clientes = await (await request.get(`${api}/clientes`)).json();
  expect(clientes.some((c: {nome: string}) => c.nome === nome)).toBe(true);
});

test('leitura pode ser repetida após erro e respostas antigas não trocam o cliente selecionado', async ({ page }) => {
  let falhar = true;
  await page.route(`**/clientes/${cliente.id}/ficha`, async route => {
    if (falhar) {
      falhar = false;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ erro: 'Leitura simulada falhou' }) });
    } else await route.continue();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await page.getByRole('button', { name: /Fichas dos\s*Clientes/ }).click();
  await page.getByLabel('Buscar no banco').fill(cliente.nome);
  await page.getByRole('button', { name: cliente.nome, exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Leitura simulada falhou');
  await page.getByRole('button', { name: cliente.nome, exact: true }).click();
  await expect(page.getByRole('heading', { name: cliente.nome, exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: 'wait' });
  await page.getByRole('button', { name: outro.nome, exact: true }).click();
  await expect(page.getByRole('heading', { name: outro.nome, exact: true })).toBeVisible();
  let liberar!: () => void;
  const gate = new Promise<void>(resolve => { liberar = resolve; });
  await page.route(`**/clientes/${cliente.id}/ficha`, async route => { await gate; await route.continue(); });
  await page.getByRole('button', { name: cliente.nome, exact: true }).click();
  await expect(page.getByText('Carregando ficha do cliente...')).toBeVisible();
  await page.getByRole('button', { name: outro.nome, exact: true }).click();
  await expect(page.getByRole('heading', { name: outro.nome, exact: true })).toBeVisible();
  const antiga = page.waitForResponse(r => r.url() === `${api}/clientes/${cliente.id}/ficha`);
  liberar();
  await antiga;
  await expect(page.getByRole('heading', { name: outro.nome, exact: true })).toBeVisible();
});


test('clientes importados com mesmo nome são identificados pelo código e pesquisados por apelido', async ({ page, request }) => {
  const response = await request.get(`${api}/clientes`);
  expect(response.ok()).toBe(true);
  const clientes = await response.json();
  const homonimos = clientes.filter((c: {nome: string; confere?: {codigo: string}}) => c.confere && c.nome.startsWith('Codex UI homônimos '));
  expect(homonimos).toHaveLength(2);
  expect(homonimos[0].nome).toBe(homonimos[1].nome);
  const escolhido = homonimos[0];
  const dados = await (await request.get(`${api}/clientes/${escolhido.id}/ficha`)).json();
  await page.goto('/');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await page.getByRole('button', { name: /Fichas dos\s*Clientes/ }).click();
  await page.getByLabel('Buscar no banco').fill(escolhido.nome);
  await expect(page.locator('.ficha-item')).toHaveCount(2);
  for (const c of homonimos) await expect(page.getByText(`Confere #${c.confere.codigo}`, { exact: true })).toBeVisible();
  await page.getByLabel('Pesquisar por', { exact: true }).selectOption('APELIDOS');
  await page.getByLabel('Buscar no banco').fill(dados.nomesAlternativos[0].nome);
  await expect(page.locator('.ficha-item')).toHaveCount(1);
  await page.getByText(`Confere #${escolhido.confere.codigo}`, { exact: true }).click();
  await expect(page.getByText(`Código no Confere: ${escolhido.confere.codigo}`, { exact: true })).toBeVisible();
});
