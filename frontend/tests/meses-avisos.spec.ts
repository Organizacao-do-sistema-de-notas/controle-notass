import { test, expect } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
const meses = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05'];
async function abrirExcel(page: Page) {
  await page.addInitScript(() => localStorage.setItem('controle-notas-modo', 'excel'));
  await page.goto('/');
  await expect(page.getByText('Dados compartilhados entre os computadores.', { exact: true })).toBeVisible();
}
async function criarAvisos(request: APIRequestContext) {
  const tag = Date.now();
  const a = { id: `codex-a-${tag}`, titulo: `Aviso A ${tag}`, texto: 'Texto do primeiro aviso fictício' };
  const b = { id: `codex-b-${tag}`, titulo: `Aviso B ${tag}`, texto: 'Texto do segundo aviso fictício' };
  const r = await request.patch(api + '/excel/estado', { data: { alteracoes: [a, b].map(aviso => ({ tipo: 'incluirAviso', aviso })) } });
  expect(r.ok()).toBe(true);
  return { a, b };
}
async function ordem(request: APIRequestContext): Promise<string[]> {
  return (await (await request.get(api + '/excel/estado')).json()).estado.ordemAvisos;
}
const card = (page: Page, id: string) => page.locator(`[data-aviso-id="${id}"]`);
async function arrastar(page: Page, titulo: string, destino: string, depois = true) {
  const origem = await page.getByRole('button', { name: `Ordenar aviso ${titulo}`, exact: true }).boundingBox();
  const alvo = await card(page, destino).boundingBox();
  expect(origem).not.toBeNull(); expect(alvo).not.toBeNull();
  await page.mouse.move(origem!.x + origem!.width / 2, origem!.y + origem!.height / 2);
  await page.mouse.down();
  await page.mouse.move(alvo!.x + alvo!.width / 2, depois ? alvo!.y + alvo!.height - 5 : alvo!.y + 5, { steps: 16 });
  await page.mouse.up();
}

test('seleção rápida tem apenas 13 meses e ignora preferência antiga sem apagar registros históricos', async ({ page, request }) => {
  const c = await (await request.post(api + '/clientes', { data: { nome: `Codex histórico ${Date.now()}` } })).json();
  const r = await request.patch(api + '/excel/estado', { data: { alteracoes: [{ tipo: 'definir', caminho: ['registro', '2020-01', `cliente:${c.id}`, 'observacao'], anterior: '', valor: 'Histórico anterior à seleção rápida' }] } });
  expect(r.ok()).toBe(true);
  await request.post(api + '/pendencias', { data: { clienteId: c.id, competencia: '2020-01' } });
  await page.addInitScript(() => {
    localStorage.setItem('controle-notas-excel-mes', '2020-01');
    localStorage.setItem('controle-notas-painel-mes', '2020-01');
  });
  await abrirExcel(page);
  const excel = page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' });
  await expect(excel).toHaveValue('2026-11');
  expect(await excel.locator('option').evaluateAll(items => items.map(item => (item as HTMLOptionElement).value))).toEqual(meses);
  expect((await excel.boundingBox())!.width).toBeLessThanOrEqual(120);
  expect((await excel.boundingBox())!.height).toBeLessThanOrEqual(34);
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  const painel = page.getByRole('combobox', { name: 'Competência', exact: true });
  await expect(painel).toHaveValue('2026-11');
  expect(await painel.locator('option').evaluateAll(items => items.map(item => (item as HTMLOptionElement).value))).toEqual(meses);
  const estado = (await (await request.get(api + '/excel/estado')).json()).estado;
  expect(estado.registros['2020-01'][`cliente:${c.id}`].observacao).toBe('Histórico anterior à seleção rápida');
  expect((await (await request.get(api + '/painel/competencias')).json())).toContain('2020-01');
});

test('−1 e +1 mudam um mês no Excel e no Painel, cruzam o ano e respeitam os extremos', async ({ page, request }) => {
  await abrirExcel(page);
  for (const modo of ['Excel', 'Painel'] as const) {
    await page.getByRole('button', { name: modo, exact: true }).click();
    const select = page.getByRole('combobox', { name: modo === 'Excel' ? 'Selecionar mês da visão Excel' : 'Competência', exact: true });
    const anterior = page.getByRole('button', { name: `Mês anterior no ${modo}`, exact: true });
    const seguinte = page.getByRole('button', { name: `Mês seguinte no ${modo}`, exact: true });
    await select.selectOption('2026-12'); await seguinte.click(); await expect(select).toHaveValue('2027-01');
    await anterior.click(); await expect(select).toHaveValue('2026-12');
    await select.selectOption('2026-05'); await expect(anterior).toBeDisabled(); await expect(seguinte).toBeEnabled();
    await select.selectOption('2027-05'); await expect(seguinte).toBeDisabled(); await expect(anterior).toBeEnabled();
    const a = await anterior.boundingBox(), b = await select.boundingBox(), c = await seguinte.boundingBox();
    expect(a!.x + a!.width).toBeLessThan(b!.x); expect(c!.x).toBeGreaterThan(b!.x + b!.width);
    expect(await select.locator('option').count()).toBe(13);
  }
  const ocupados: string[] = await (await request.get(api + '/painel/competencias')).json();
  const vazio = meses.find(mes => !ocupados.includes(mes));
  expect(vazio).toBeDefined();
  await page.getByRole('combobox', { name: 'Competência', exact: true }).selectOption(vazio!);
  await expect(page.getByText('Nenhuma pendência encontrada para os filtros atuais.', { exact: true })).toBeVisible();
});

test('arrastar avisos persiste a ordem, permite mover Xaxim Gás e compartilha após recarregar', async ({ page, request, browser }) => {
  const { a, b } = await criarAvisos(request);
  await page.setViewportSize({ width: 1440, height: 1050 });
  await abrirExcel(page);
  await arrastar(page, a.titulo, `aviso:${b.id}`);
  await expect.poll(() => ordem(request)).toEqual(['fixo:xaxim-gas', `aviso:${b.id}`, `aviso:${a.id}`]);
  await arrastar(page, 'Xaxim Gás', `aviso:${a.id}`);
  const esperado = [`aviso:${b.id}`, `aviso:${a.id}`, 'fixo:xaxim-gas'];
  await expect.poll(() => ordem(request)).toEqual(esperado);
  await expect(page.getByRole('heading', { name: 'Xaxim Gás', exact: true })).toBeVisible();
  await expect(card(page, `aviso:${a.id}`)).toContainText(a.texto);
  await page.reload();
  await expect.poll(() => page.locator('[data-aviso-id]').evaluateAll(items => items.map(item => (item as HTMLElement).dataset.avisoId))).toEqual(esperado);
  const contexto = await browser.newContext({ baseURL: 'http://127.0.0.1:5175' });
  try {
    const outra = await contexto.newPage(); await abrirExcel(outra);
    await expect.poll(() => outra.locator('[data-aviso-id]').evaluateAll(items => items.map(item => (item as HTMLElement).dataset.avisoId))).toEqual(esperado);
    await outra.locator('.priority-toggle').click();
    for (const mercado of ['Bom dia filial', 'Bom dia Matriz', 'Compre bem']) await expect(outra.locator('.priority-list')).toContainText(mercado);
  } finally { await contexto.close(); }
});

test('teclado ordena avisos, mantém foco e uma falha de rede não substitui a ordem salva', async ({ page, request }) => {
  const { a, b } = await criarAvisos(request);
  await abrirExcel(page);
  const puxador = page.getByRole('button', { name: 'Ordenar aviso Xaxim Gás', exact: true });
  await page.route(api + '/excel/estado', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia ao ordenar' }) }) : route.continue());
  await puxador.focus(); await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('alert')).toHaveText('Falha fictícia ao ordenar');
  expect(await ordem(request)).toEqual(['fixo:xaxim-gas', `aviso:${a.id}`, `aviso:${b.id}`]);
  await page.unroute(api + '/excel/estado');
  await puxador.focus(); await page.keyboard.press('ArrowDown');
  await expect.poll(() => ordem(request)).toEqual([`aviso:${a.id}`, 'fixo:xaxim-gas', `aviso:${b.id}`]);
  await expect(puxador).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect.poll(() => ordem(request)).toEqual(['fixo:xaxim-gas', `aviso:${a.id}`, `aviso:${b.id}`]);
});

test('arrasto por toque funciona em tela pequena sem rolagem horizontal', async ({ browser, request }) => {
  const { a, b } = await criarAvisos(request);
  const contexto = await browser.newContext({ baseURL: 'http://127.0.0.1:5175', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  try {
    const page = await contexto.newPage(); await abrirExcel(page);
    await page.getByRole('group', { name: 'Avisos em ordem personalizada' }).scrollIntoViewIfNeeded();
    const origem = await page.getByRole('button', { name: `Ordenar aviso ${a.titulo}`, exact: true }).boundingBox();
    const alvo = await card(page, `aviso:${b.id}`).boundingBox();
    const cdp = await contexto.newCDPSession(page);
    const x = origem!.x + origem!.width / 2, y = origem!.y + origem!.height / 2;
    const fimX = alvo!.x + alvo!.width / 2, fimY = alvo!.y + alvo!.height - 5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    for (let i = 1; i <= 12; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (fimX - x) * i / 12, y: y + (fimY - y) * i / 12 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(() => ordem(request)).toEqual(['fixo:xaxim-gas', `aviso:${b.id}`, `aviso:${a.id}`]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  } finally { await contexto.close(); }
});
