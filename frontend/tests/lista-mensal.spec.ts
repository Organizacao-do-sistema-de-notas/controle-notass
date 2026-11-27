import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
const linha = (page: Page, id: number) => page.locator(`.excel-table-row[data-cliente-id="${id}"]`);
async function abrirExcel(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('controle-notas-modo', 'excel');
    localStorage.setItem('controle-notas-excel-mes', '2026-11');
  });
  await page.goto('/');
  await expect(page.getByText('Dados compartilhados entre os computadores.', { exact: true })).toBeVisible();
}
async function incluir(page: Page, cliente: { id: number; nome: string }, pesquisa = cliente.nome) {
  await page.getByRole('button', { name: /Incluir\s*Cliente/, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Incluir cliente', exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Nome principal', exact: true })).toHaveCount(0);
  await dialog.getByLabel('Pesquisar cliente cadastrado').fill(pesquisa);
  await dialog.getByRole('button', { name: `Selecionar cliente #${cliente.id} — ${cliente.nome}`, exact: true }).click();
  await dialog.getByRole('button', { name: 'Incluir', exact: true }).click();
  await expect(dialog).toHaveCount(0);
}

test('mensais aparecem todo mês; eventuais e não definidos só nos meses incluídos, compartilhados entre navegadores', async ({ page, request, browser }) => {
  const tag = `Codex lista mensal ${Date.now()}`;
  async function criar(sufixo: string, frequenciaAcesso: string) {
    const c = await (await request.post(api + '/clientes', { data: { nome: `${tag} ${sufixo}` } })).json();
    expect((await request.patch(`${api}/clientes/${c.id}/ficha`, { data: { frequenciaAcesso, nomesAlternativos: [`Apelido ${sufixo} ${tag}`] } })).ok()).toBe(true);
    return c;
  }
  const mensal = await criar('mensal', 'MENSAL');
  const eventual = await criar('eventual', 'EVENTUAL');
  const indefinido = await criar('indefinido', 'NAO_DEFINIDA');
  const quantidade = (await (await request.get(api + '/clientes')).json()).length;
  await abrirExcel(page);
  await expect(linha(page, mensal.id)).toBeVisible();
  await expect(linha(page, eventual.id)).toHaveCount(0);
  await expect(linha(page, indefinido.id)).toHaveCount(0);
  await incluir(page, eventual, `APELIDO EVENTUAL ${tag}`);
  const observacao = linha(page, eventual.id).getByRole('textbox');
  await observacao.fill('Observação exclusiva de novembro');
  await expect.poll(async () => (await (await request.get(api + '/excel/estado')).json()).estado.registros['2026-11']?.[`cliente:${eventual.id}`]?.observacao).toBe('Observação exclusiva de novembro');
  const mes = page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' });
  await mes.selectOption('2026-12');
  await expect(linha(page, mensal.id)).toBeVisible();
  await expect(linha(page, eventual.id)).toHaveCount(0);
  await expect(linha(page, indefinido.id)).toHaveCount(0);
  await incluir(page, indefinido);
  await expect(linha(page, indefinido.id)).toBeVisible();
  await mes.selectOption('2026-11');
  await expect(linha(page, eventual.id).getByRole('textbox')).toHaveValue('Observação exclusiva de novembro');
  await expect(linha(page, indefinido.id)).toHaveCount(0);
  expect((await (await request.get(api + '/clientes')).json()).length).toBe(quantidade);
  const contexto = await browser.newContext();
  try {
    const outra = await contexto.newPage(); await abrirExcel(outra);
    await expect(linha(outra, eventual.id)).toBeVisible();
    await expect(linha(outra, eventual.id).getByRole('textbox')).toHaveValue('Observação exclusiva de novembro');
  } finally { await contexto.close(); }
  await expect(page.getByRole('heading', { name: 'Xaxim Gás', exact: true })).toBeVisible();
  await page.locator('.priority-toggle').click();
  for (const mercado of ['Bom dia filial', 'Bom dia Matriz', 'Compre bem']) await expect(page.locator('.priority-list')).toContainText(mercado);
});

test('a alteração remota de mensal para eventual preserva meses com registros e deixa de repetir nos demais', async ({ page, request }) => {
  const c = await (await request.post(api + '/clientes', { data: { nome: `Codex frequência remota ${Date.now()}` } })).json();
  await request.patch(`${api}/clientes/${c.id}/ficha`, { data: { frequenciaAcesso: 'MENSAL' } });
  await request.patch(api + '/excel/estado', { data: { alteracoes: [{ tipo: 'definir', caminho: ['registro', '2026-11', `cliente:${c.id}`, 'observacao'], valor: 'Histórico preservado', anterior: '' }] } });
  await abrirExcel(page);
  const mes = page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' });
  await mes.selectOption('2026-12'); await expect(linha(page, c.id)).toBeVisible();
  await request.patch(`${api}/clientes/${c.id}/ficha`, { data: { frequenciaAcesso: 'EVENTUAL' } });
  await expect(linha(page, c.id)).toHaveCount(0);
  await mes.selectOption('2026-11'); await expect(linha(page, c.id).getByRole('textbox')).toHaveValue('Histórico preservado');
});

test('alterar a frequência em outro computador mantém visível uma observação ainda não salva', async ({ page, request }) => {
  const c = await (await request.post(api + '/clientes', { data: { nome: `Codex rascunho frequência ${Date.now()}` } })).json();
  await request.patch(`${api}/clientes/${c.id}/ficha`, { data: { frequenciaAcesso: 'MENSAL' } });
  await abrirExcel(page);
  await page.route(api + '/excel/estado', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia ao salvar' }) }) : route.continue());
  await linha(page, c.id).getByRole('textbox').fill('Rascunho que deve continuar visível');
  await expect(linha(page, c.id).getByRole('alert')).toHaveText('Falha fictícia ao salvar');
  const atualizacao = page.waitForResponse(async r => r.url().includes('/excel/estado') && r.request().method() === 'GET'
    && (await r.json()).estado?.frequenciasClientes?.[`cliente:${c.id}`] === 'EVENTUAL');
  await request.patch(`${api}/clientes/${c.id}/ficha`, { data: { frequenciaAcesso: 'EVENTUAL' } });
  await atualizacao;
  await expect(linha(page, c.id).getByRole('textbox')).toHaveValue('Rascunho que deve continuar visível');
  await linha(page, c.id).getByRole('button', { name: 'Usar texto do banco', exact: true }).click();
  await expect(linha(page, c.id)).toHaveCount(0);
});

test('olho pequeno ao lado de Atualizar mostra e oculta os indicadores; cards mantêm as ações', async ({ page, request }) => {
  const c = await (await request.post(api + '/clientes', { data: { nome: `Codex Painel compacto ${Date.now()}` } })).json();
  await request.post(api + '/pendencias', { data: { clienteId: c.id, competencia: '2026-11' } });
  await page.goto('/');
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await page.getByRole('combobox').first().selectOption('2026-11');
  await expect(page.locator('.pendencia-card').filter({ hasText: c.nome })).toBeVisible();
  await expect(page.locator('.summary-grid')).toHaveCount(0);
  const olho = page.getByRole('button', { name: 'Mostrar indicadores', exact: true });
  await expect(olho).toHaveAttribute('aria-expanded', 'false');
  const a = await page.getByRole('button', { name: 'Atualizar', exact: true }).boundingBox();
  const b = await olho.boundingBox();
  expect(b!.width).toBeLessThanOrEqual(32); expect(b!.x).toBeGreaterThan(a!.x + a!.width);
  await olho.click();
  await expect(page.getByRole('region', { name: 'Resumo do mês' })).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar indicadores', exact: true }).click();
  await expect(page.locator('.summary-grid')).toHaveCount(0);
  const card = page.locator('.pendencia-card').filter({ hasText: c.nome });
  await expect(card.getByRole('button', { name: 'Histórico', exact: true })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Criar mensagem', exact: true })).toBeVisible();
  expect((await card.boundingBox())!.height).toBeLessThan(280);
});

test('exclusão lista todos por número e filtra nome e apelido enquanto digita, sem excluir nada', async ({ page, request }) => {
  const tag = `Codex tabela exclusão ${Date.now()}`;
  const a = await (await request.post(api + '/clientes', { data: { nome: `${tag} Zeta` } })).json();
  const b = await (await request.post(api + '/clientes', { data: { nome: `${tag} Alfa` } })).json();
  await request.patch(`${api}/clientes/${b.id}/ficha`, { data: { nomesAlternativos: [`Apelído especial ${tag}`] } });
  await abrirExcel(page);
  await page.getByRole('button', { name: /Excluir\s*Cliente/, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Excluir cliente', exact: true });
  await expect(dialog.getByRole('combobox')).toHaveCount(0);
  const tabela = dialog.getByRole('table', { name: 'Clientes disponíveis para exclusão' });
  const ids = await tabela.locator('tbody tr td:first-child').allTextContents();
  const numeros = ids.map(id => Number(id.replace('#', '')));
  expect(numeros).toEqual([...numeros].sort((a, b) => a - b));
  expect(numeros).toContain(a.id); expect(numeros).toContain(b.id);
  await dialog.getByLabel('Pesquisar cliente', { exact: true }).fill(tag);
  await expect(tabela.locator('tbody tr')).toHaveCount(2);
  await dialog.getByRole('button', { name: `Selecionar cliente #${a.id} — ${a.nome}`, exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Excluir cliente', exact: true })).toBeEnabled();
  await dialog.getByLabel('Pesquisar cliente', { exact: true }).fill(`APELIDO ESPECIAL ${tag}`);
  await expect(tabela.locator('tbody tr')).toHaveCount(1);
  await expect(tabela).toContainText(b.nome);
  await expect(dialog.getByRole('button', { name: 'Excluir cliente', exact: true })).toBeDisabled();
  await dialog.getByLabel('Pesquisar cliente', { exact: true }).fill('sem resultado ficticio 9988776655');
  await expect(dialog.getByText('Nenhum cliente encontrado para essa pesquisa.', { exact: true })).toBeVisible();
  expect((await request.get(`${api}/clientes/${a.id}`)).status()).toBe(200);
  expect((await request.get(`${api}/clientes/${b.id}`)).status()).toBe(200);
});
