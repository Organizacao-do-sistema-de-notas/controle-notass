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

for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
  test(`Salvar ficha permanece no canto inferior direito ao rolar e salva sem voltar ao formulário (${viewport.width}px)`, async ({ page, request }) => {
    await page.setViewportSize(viewport);
    const c = await criar(request, `Codex ficha fixa ${viewport.width} ${Date.now()}`);
    for (let i = 0; i < 3; i++) expect((await request.post(`${api}/clientes/${c.id}/procedimentos`, { data: { titulo: `Procedimento longo ${i}`, descricao: 'Linha longa fictícia\n'.repeat(12) } })).ok()).toBe(true);
    await excel(page, c.nome);
    await linha(page, c.id).getByRole('button', { name: `Abrir ficha de ${c.nome} (#${c.id})`, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Fichas dos clientes', exact: true });
    await expect(dialog.getByLabel('Anotações permanentes')).toBeVisible();
    await dialog.getByLabel('Anotações permanentes').fill('Salvar a ficha sem procurar o botão');
    const salvar = dialog.getByRole('button', { name: 'Salvar ficha', exact: true });
    const antes = (await salvar.boundingBox())!;
    await dialog.locator(viewport.width < 740 ? '.ficha-content' : '.ficha-detalhes').evaluate(el => { el.scrollTop = el.scrollHeight; });
    const depois = (await salvar.boundingBox())!;
    expect(Math.abs(depois.y - antes.y)).toBeLessThan(2);
    expect(depois.x + depois.width).toBeLessThanOrEqual(viewport.width);
    expect(depois.y + depois.height).toBeLessThan(viewport.height);
    await expect(salvar).toBeInViewport();
    let falhar = true;
    await page.route(`${api}/clientes/${c.id}/ficha`, route => route.request().method() === 'PATCH' && falhar
      ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia no rodapé' }) }) : route.continue());
    await salvar.click();
    await expect(dialog.getByRole('alert')).toHaveText('Falha fictícia no rodapé');
    await expect(dialog.getByRole('alert')).toBeInViewport();
    falhar = false; await salvar.click();
    await expect(dialog.getByRole('status')).toHaveText('Ficha salva no banco de dados.');
    await expect(dialog.getByRole('status')).toBeInViewport();
    expect((await (await request.get(`${api}/clientes/${c.id}/ficha`)).json()).observacoesPermanentes).toBe('Salvar a ficha sem procurar o botão');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}
