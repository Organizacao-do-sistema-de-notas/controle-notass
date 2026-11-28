import { test, expect } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';
const api = 'http://127.0.0.1:3010';
const linha = (page: Page, id: number) => page.locator(`.excel-table-row[data-cliente-id="${id}"]`);
const buscar = (page: Page) => page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...');
async function criar(request: APIRequestContext, nome: string) {
  const c = await (await request.post(api + '/clientes', { data: { nome } })).json();
  expect((await request.patch(`${api}/clientes/${c.id}/ficha`, { data: { frequenciaAcesso: 'MENSAL' } })).ok()).toBe(true);
  return c as { id: number; nome: string };
}
async function excel(page: Page, busca = '') {
  await page.goto('/'); await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-11');
  await expect(page.getByText('Dados compartilhados entre os computadores.', { exact: true })).toBeVisible();
  if (busca) await buscar(page).fill(busca);
}
const ordemVisivel = (page: Page, ids: number[]) => page.locator('.excel-table-row').evaluateAll((rows, ids) => rows.map(row => Number((row as HTMLElement).dataset.clienteId)).filter(id => ids.includes(id)), ids);
const ler = async (request: APIRequestContext) => (await (await request.get(api + '/excel/estado')).json()).estado;


test('arrastar pelo nome move a linha inteira; Escape cancela e a ordem persiste em outros meses e navegadores', async ({ page, request, browser }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const tag = `Codex linhas livres ${Date.now()}`;
  const a = await criar(request, `${tag} A`), b = await criar(request, `${tag} B`), c = await criar(request, `${tag} C`), ids = [a.id, b.id, c.id];
  await excel(page, tag); await expect.poll(() => ordemVisivel(page, ids)).toEqual(ids);
  const antes = await ler(request), terceiro = linha(page, c.id);
  const nome = (await terceiro.locator('.excel-client-label').boundingBox())!;
  const inicial = (await terceiro.boundingBox())!;
  await page.mouse.move(nome.x + 15, nome.y + 6); await page.mouse.down();
  await page.mouse.move(nome.x + 50, nome.y + 26, { steps: 8 });
  await expect(terceiro).toHaveAttribute('data-em-arrasto', 'true');
  const movido = (await terceiro.boundingBox())!;
  expect(Math.abs(movido.x - inicial.x - 35)).toBeLessThan(3); expect(Math.abs(movido.y - inicial.y - 20)).toBeLessThan(3);
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(terceiro).not.toHaveAttribute('data-em-arrasto', 'true');
  expect((await ler(request)).ordemClientesExcel).toEqual(antes.ordemClientesExcel);
  const origem = (await terceiro.locator('.excel-client-label').boundingBox())!, destino = (await linha(page, a.id).boundingBox())!;
  await page.mouse.move(origem.x + 15, origem.y + 6); await page.mouse.down();
  await page.mouse.move(destino.x + 90, destino.y + 4, { steps: 12 }); await page.mouse.up();
  const esperado = [c.id, a.id, b.id]; await expect.poll(() => ordemVisivel(page, ids)).toEqual(esperado);
  const salvo = await ler(request); expect(salvo.ordemClientesPainel).toEqual(antes.ordemClientesPainel);
  expect(salvo.registros).toEqual(antes.registros); expect(salvo.avisosExtras).toEqual(antes.avisosExtras);
  await linha(page, a.id).locator('.excel-status-trigger').click();
  await linha(page, a.id).locator('.excel-status-menu').getByRole('button', { name: 'OK', exact: true }).click();
  await expect(linha(page, a.id).locator('.excel-status-trigger')).toContainText('OK');
  await expect.poll(() => ordemVisivel(page, ids)).toEqual(esperado);
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-12');
  await expect.poll(() => ordemVisivel(page, ids)).toEqual(esperado);
  await page.reload(); await buscar(page).fill(tag); await expect.poll(() => ordemVisivel(page, ids)).toEqual(esperado);
  const contexto = await browser.newContext();
  try { const outra = await contexto.newPage(); await excel(outra, tag); await expect.poll(() => ordemVisivel(outra, ids)).toEqual(esperado); }
  finally { await contexto.close(); }
});

test('ordenar com filtro preserva clientes ocultos e rascunhos; falha de rede mantém a ordem e permite repetir', async ({ page, request }) => {
  const tag = `Codex filtro de linhas ${Date.now()}`;
  const a = await criar(request, `${tag} visível A`), b = await criar(request, `${tag} oculto B`), c = await criar(request, `${tag} visível C`), ids = [a.id, b.id, c.id];
  await excel(page, tag);
  const antes = await ler(request);
  const esperada = antes.ordemClientesExcel.filter((id: number) => id !== c.id);
  esperada.splice(esperada.indexOf(a.id), 0, c.id);
  let falharOrdem = true;
  await page.route(api + '/excel/estado', route => {
    if (route.request().method() !== 'PATCH') return route.continue();
    const ops = route.request().postDataJSON().alteracoes;
    if (ops.some((op: { tipo: string; caminho?: string[] }) => op.caminho?.[3] === 'observacao')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Rascunho fictício preservado' }) });
    if (falharOrdem && ops.some((op: { tipo: string }) => op.tipo === 'ordenarExcel')) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia ao mover linha' }) });
    return route.continue();
  });
  await linha(page, a.id).getByRole('textbox').fill('Observação não deve mudar de cliente');
  await expect(linha(page, a.id).getByRole('alert')).toHaveText('Rascunho fictício preservado');
  await buscar(page).fill(`${tag} visível`); await expect(linha(page, b.id)).toHaveCount(0);
  const cartao = linha(page, c.id);
  await cartao.focus(); await page.keyboard.press('ArrowUp');
  await expect(page.locator('.excel-ordem-erro')).toHaveText('Falha fictícia ao mover linha');
  expect((await ler(request)).ordemClientesExcel).toEqual(antes.ordemClientesExcel);
  falharOrdem = false; await cartao.focus(); await page.keyboard.press('ArrowUp');
  await expect.poll(() => ordemVisivel(page, ids)).toEqual([c.id, a.id]);
  await expect(linha(page, a.id).getByRole('textbox')).toHaveValue('Observação não deve mudar de cliente');
  await buscar(page).fill(tag); await expect.poll(() => ordemVisivel(page, ids)).toEqual(esperada.filter((id: number) => ids.includes(id)));
  const atual = await ler(request);
  expect(atual.ordemClientesExcel).toEqual(esperada);
  expect(atual.ordemClientesExcel.filter((id: number) => !ids.includes(id))).toEqual(antes.ordemClientesExcel.filter((id: number) => !ids.includes(id)));
  await page.unroute(api + '/excel/estado');
  await linha(page, a.id).getByRole('button', { name: 'Salvar meu texto', exact: true }).click();
  await expect.poll(async () => (await ler(request)).registros['2026-11']?.[`cliente:${a.id}`]?.observacao).toBe('Observação não deve mudar de cliente');
});
