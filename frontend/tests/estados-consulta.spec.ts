import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
const api = 'http://127.0.0.1:3010';
const linha = (page: Page, id: number) => page.locator(`.excel-table-row[data-cliente-id="${id}"]`);
const card = (page: Page, id: number) => page.locator(`.pendencia-card[data-cliente-id="${id}"]`);
async function criar(request: Page['request'], nome: string, competencia = '2026-11') {
  const c = await (await request.post(api + '/clientes', { data: { nome: `${nome} ${Date.now()}` } })).json();
  const r = await request.patch(api + '/excel/estado', { data: { alteracoes: [{ tipo: 'incluirClienteMes', clienteId: c.id, competencia }] } });
  expect(r.ok()).toBe(true); return c;
}
async function abrirExcel(page: Page) {
  await page.goto('/'); await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-11');
  await expect(page.getByText('Dados compartilhados entre os computadores.', { exact: true })).toBeVisible();
}
async function estadoExcel(page: Page, id: number, texto: string) {
  await linha(page, id).locator('.excel-status-trigger').click();
  await linha(page, id).locator('.excel-status-menu').getByRole('button', { name: texto, exact: true }).click();
}

test('estado do cliente é atualizado nos dois sentidos ao alternar Excel e Painel, mantendo o mês', async ({ page, request }) => {
  const c = await criar(request, 'Codex estado duas telas');
  await abrirExcel(page);
  await estadoExcel(page, c.id, 'OK');
  await page.getByRole('button', { name: 'Painel', exact: true }).click();
  await page.getByRole('combobox', { name: 'Competência', exact: true }).selectOption('2026-11');
  await expect(card(page, c.id).getByRole('combobox')).toHaveValue('CONCLUIDO');
  await card(page, c.id).getByRole('combobox').selectOption('EM_ATENDIMENTO');
  await expect(card(page, c.id).getByRole('combobox')).toHaveValue('EM_ATENDIMENTO');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await expect(linha(page, c.id)).toContainText('Em atendimento');
  await page.reload(); await expect(linha(page, c.id)).toContainText('Em atendimento');
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-12');
  await expect(linha(page, c.id)).toHaveCount(0);
});

test('duas sessões recebem estados remotos sem recarregar e preservam uma observação em rascunho', async ({ page, request, browser }) => {
  const c = await criar(request, 'Codex estado remoto');
  await abrirExcel(page);
  const contexto = await browser.newContext();
  try {
    const outra = await contexto.newPage(); await outra.goto('/');
    await outra.getByRole('combobox', { name: 'Competência', exact: true }).selectOption('2026-11');
    await expect(card(outra, c.id)).toBeVisible();
    await estadoExcel(page, c.id, 'Aguardando');
    await expect(card(outra, c.id).getByRole('combobox')).toHaveValue('AGUARDANDO_CLIENTE', { timeout: 10000 });
    await page.route(api + '/excel/estado', route => route.request().method() === 'PATCH' ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia' }) }) : route.continue());
    await linha(page, c.id).getByRole('textbox').fill('Rascunho independente preservado');
    await expect(linha(page, c.id).getByRole('alert')).toContainText('Falha fictícia');
    await card(outra, c.id).getByRole('combobox').selectOption('CONCLUIDO');
    await expect(linha(page, c.id)).toContainText('OK', { timeout: 10000 });
    await expect(linha(page, c.id).getByRole('textbox')).toHaveValue('Rascunho independente preservado');
    await page.unroute(api + '/excel/estado');
    await linha(page, c.id).getByRole('button', { name: 'Usar texto do banco', exact: true }).click();
  } finally { await contexto.close(); }
});

test('consulta separada abre um mês antigo, pesquisa e lê histórico sem aumentar as 13 opções rápidas ou gravar', async ({ page, request }) => {
  const c = await criar(request, 'Codex consulta antiga', '2020-01');
  await request.patch(api + '/excel/estado', { data: { alteracoes: [
    { tipo: 'definir', caminho: ['registro', '2020-01', `cliente:${c.id}`, 'status'], anterior: 'PENDENTE', valor: 'OK' },
    { tipo: 'definir', caminho: ['registro', '2020-01', `cliente:${c.id}`, 'observacao'], anterior: '', valor: 'Nota do mês antigo' },
  ] } });
  const antes = await (await request.get(api + '/excel/estado')).json();
  await abrirExcel(page);
  const rapido = page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' });
  await expect(rapido.locator('option')).toHaveCount(13);
  const escritas: string[] = [];
  page.on('request', r => { if (r.url().startsWith(api) && !['GET', 'OPTIONS'].includes(r.method())) escritas.push(r.method() + ' ' + r.url()); });
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Consultar meses antigos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Consultar meses antigos', exact: true });
  await dialog.getByLabel('Mês da consulta', { exact: true }).fill('2020-01');
  await dialog.getByLabel('Pesquisar cliente na consulta').fill(c.nome);
  const tabela = dialog.getByRole('table', { name: 'Registros do mês consultado' });
  await expect(tabela).toContainText(c.nome); await expect(tabela).toContainText('Concluído'); await expect(tabela).toContainText('Nota do mês antigo');
  await dialog.getByRole('button', { name: `Consultar histórico de ${c.nome}`, exact: true }).click();
  await expect(dialog.getByRole('region', { name: `Histórico de ${c.nome}`, exact: true })).toBeVisible();
  await dialog.getByLabel('Pesquisar cliente na consulta').fill('Não existe esse nome');
  await expect(dialog.getByText('Nenhum registro encontrado para esta consulta.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Fechar consulta', exact: true }).click();
  await expect(rapido.locator('option')).toHaveCount(13); await expect(rapido).toHaveValue('2026-11');
  expect(escritas).toEqual([]);
  expect((await (await request.get(api + '/excel/estado')).json()).estado).toEqual(antes.estado);
});

test('consulta em tela pequena permite tentar novamente após falha e fechar por Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await abrirExcel(page);
  await page.route(api + '/painel?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia na consulta' }) }));
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Consultar meses antigos', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Consultar meses antigos', exact: true });
  await expect(dialog.getByRole('alert')).toContainText('Falha fictícia na consulta');
  await page.unroute(api + '/painel?**'); await dialog.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(dialog.getByRole('table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Mais opções', exact: true })).toBeFocused();
});
