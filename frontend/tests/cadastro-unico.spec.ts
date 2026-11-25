import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
const api = 'http://127.0.0.1:3010';
const novoNome = () => `Codex único fictício ${Date.now()}`;
const busca = (page: Page) => page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...');
async function excel(page: Page) { await page.goto('/'); await page.getByRole('button', { name: 'Excel', exact: true }).click(); }
async function incluir(page: Page, nome: string, info = '') {
  await page.getByRole('button', { name: /Incluir\s*Cliente/, exact: true }).click();
  const modal = page.locator('.excel-modal-clientes');
  await modal.getByRole('textbox', { name: 'Nome principal', exact: true }).fill(nome);
  await modal.getByRole('textbox', { name: 'Informações adicionais', exact: true }).fill(info);
  await modal.getByRole('button', { name: 'Incluir', exact: true }).click();
  await expect(modal).toHaveCount(0);
}
const ficha = (page: Page, id: number) => page.getByRole('button', { name: new RegExp(`Abrir ficha de .*\\(#${id}\\)$`) });

test('criar no Excel disponibiliza a mesma ficha e cadastro; editar e renomear preserva o ID', async ({ page, request }) => {
  const nome = novoNome(); await excel(page); await incluir(page, nome, 'Informação criada no Excel'); await busca(page).fill(nome);
  const row = page.locator('.excel-table-row'); await expect(row).toHaveCount(1);
  const id = Number(await row.getAttribute('data-cliente-id'));
  const clientes = await (await request.get(api + '/clientes')).json();
  expect(clientes.filter((c: { nome: string }) => c.nome === nome).map((c: { id: number }) => c.id)).toEqual([id]);
  await ficha(page, id).click();
  const dialog = page.getByRole('dialog', { name: 'Fichas dos clientes', exact: true });
  await expect(dialog.locator('.ficha-detalhes')).toContainText(`Cadastro #${id}`);
  await expect(dialog.getByRole('textbox', { name: 'Informações adicionais', exact: true })).toHaveValue('Informação criada no Excel');
  await dialog.getByRole('textbox', { name: 'Informações adicionais', exact: true }).fill('Informação alterada na ficha');
  await dialog.getByLabel('Outros nomes para pesquisa').fill(`Apelido ${nome}`);
  await dialog.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
  await expect(dialog.getByRole('status')).toHaveText('Ficha salva no banco de dados.');
  await dialog.getByRole('button', { name: 'Fechar fichas', exact: true }).click();
  await busca(page).fill(`Apelido ${nome}`); await expect(row).toHaveCount(1);
  await page.getByRole('button', { name: `Informações adicionais de ${nome}`, exact: true }).click();
  await expect(page.getByRole('dialog', { name: nome, exact: true }).getByRole('textbox')).toHaveValue('Informação alterada na ficha');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /Alterar\s*Cliente/, exact: true }).click();
  const editor = page.locator('.excel-modal-clientes');
  await editor.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption(`cliente:${id}`);
  await expect(editor.getByRole('combobox', { name: 'Ficha vinculada', exact: true })).toHaveCount(0);
  await editor.getByRole('textbox', { name: 'Nome principal', exact: true }).fill(`${nome} renomeado`);
  await editor.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect((await (await request.get(`${api}/clientes/${id}`)).json()).nome).toBe(`${nome} renomeado`);
  await expect(row).toHaveAttribute('data-cliente-id', String(id));
});

test('criar no menu aparece automaticamente no Excel e na ficha, incluindo situação inativa', async ({ page }) => {
  const nome = novoNome(); await excel(page);
  await page.getByRole('button', { name: 'Mais opções', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Clientes', exact: true }).click();
  const cadastro = page.getByRole('dialog', { name: 'Cadastros', exact: true });
  await cadastro.getByRole('button', { name: 'Novo cliente', exact: true }).click();
  await cadastro.getByLabel('Nome do cliente', { exact: true }).fill(nome);
  await cadastro.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(cadastro.getByRole('status')).toHaveText('Cliente salvo.');
  await cadastro.getByRole('combobox', { name: 'Situação do cliente', exact: true }).selectOption('INATIVO');
  await cadastro.getByRole('button', { name: 'Salvar cliente', exact: true }).click();
  await expect(cadastro.getByRole('status')).toHaveText('Cliente salvo.');
  await cadastro.getByRole('button', { name: 'Fechar cadastros', exact: true }).click();
  await busca(page).fill(nome); const row = page.locator('.excel-table-row'); await expect(row).toHaveCount(1);
  await expect(row.locator('.excel-cliente-inativo')).toHaveText('Inativo');
  const id = Number(await row.getAttribute('data-cliente-id')); await ficha(page, id).click();
  await expect(page.getByRole('heading', { name: nome, exact: true })).toBeVisible();
});

test('homônimos têm uma linha e ficha por ID, com dados mensais e informações independentes', async ({ page, request }) => {
  const nome = novoNome(); await excel(page); await incluir(page, nome, 'Cliente A'); await incluir(page, nome, 'Cliente B'); await busca(page).fill(nome);
  const rows = page.locator('.excel-table-row'); await expect(rows).toHaveCount(2);
  const ids = await rows.evaluateAll(elementos => elementos.map(el => Number(el.getAttribute('data-cliente-id')))); expect(new Set(ids).size).toBe(2);
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-11');
  await rows.nth(0).getByRole('textbox', { name: `Observação mensal de ${nome}`, exact: true }).fill('Somente cliente A');
  await expect.poll(async () => (await (await request.get(api + '/excel/estado')).json()).estado.registros['2026-11']?.[`cliente:${ids[0]}`]?.observacao).toBe('Somente cliente A');
  for (let i = 0; i < 2; i++) {
    await ficha(page, ids[i]).click();
    const dialog = page.getByRole('dialog', { name: 'Fichas dos clientes', exact: true });
    await expect(dialog.locator('.ficha-detalhes')).toContainText(`Cadastro #${ids[i]}`);
    await expect(dialog.getByRole('textbox', { name: 'Informações adicionais', exact: true })).toHaveValue(i === 0 ? 'Cliente A' : 'Cliente B');
    await dialog.getByRole('button', { name: 'Fechar fichas', exact: true }).click();
  }
  await expect(rows.nth(1).getByRole('textbox', { name: `Observação mensal de ${nome}`, exact: true })).toHaveValue('');
  await busca(page).fill('');
  const lista = await (await request.get(api + '/clientes')).json();
  expect(await page.locator('.excel-table-row').evaluateAll(els => els.map(el => Number(el.getAttribute('data-cliente-id'))))).toEqual(lista.map((c: { id: number }) => c.id));
});

test('alteração da ficha em outro navegador aparece no Excel e protege edição concorrente', async ({ page, browser }) => {
  const nome = novoNome(); await excel(page); await incluir(page, nome, 'Versão inicial'); await busca(page).fill(nome);
  const id = Number(await page.locator('.excel-table-row').getAttribute('data-cliente-id'));
  const ctx = await browser.newContext();
  try {
    const outra = await ctx.newPage(); await excel(outra); await busca(outra).fill(nome); await ficha(outra, id).click();
    await page.getByRole('button', { name: `Informações adicionais de ${nome}`, exact: true }).click();
    const info = page.getByRole('dialog', { name: nome, exact: true }); await info.getByRole('button', { name: 'Alterar', exact: true }).click();
    await info.getByRole('textbox').fill('Rascunho do Excel');
    const dialog = outra.getByRole('dialog', { name: 'Fichas dos clientes', exact: true });
    await dialog.getByRole('textbox', { name: 'Informações adicionais', exact: true }).fill('Versão da ficha');
    await dialog.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
    await expect(dialog.getByRole('status')).toHaveText('Ficha salva no banco de dados.');
    await expect(info.getByText('O texto salvo foi alterado em outro computador. Confira antes de continuar.')).toBeVisible();
    await info.getByRole('button', { name: 'Salvar', exact: true }).click();
    await expect(info.getByRole('alert')).toContainText('Outro computador alterou');
    await expect(info.getByRole('textbox')).toHaveValue('Rascunho do Excel');
    await info.getByRole('button', { name: 'Usar texto do banco', exact: true }).click();
    await expect(info.getByRole('textbox')).toHaveValue('Versão da ficha');
  } finally { await ctx.close(); }
});

test('resposta perdida na criação permite repetir sem cadastrar a empresa duas vezes', async ({ page, request }) => {
  const nome = novoNome(); await excel(page);
  let perder = true;
  await page.route(api + '/excel/estado', async route => {
    if (route.request().method() === 'PATCH' && perder) { perder = false; await route.fetch(); await route.abort('failed'); }
    else await route.continue();
  });
  await page.getByRole('button', { name: /Incluir\s*Cliente/, exact: true }).click();
  const modal = page.locator('.excel-modal-clientes'); await modal.getByRole('textbox', { name: 'Nome principal', exact: true }).fill(nome);
  await modal.getByRole('button', { name: 'Incluir', exact: true }).click();
  await expect(modal.getByRole('alert')).toBeVisible();
  expect((await (await request.get(api + '/clientes')).json()).filter((c: { nome: string }) => c.nome === nome)).toHaveLength(1);
  await modal.getByRole('button', { name: 'Incluir', exact: true }).click();
  await expect(modal).toHaveCount(0);
  expect((await (await request.get(api + '/clientes')).json()).filter((c: { nome: string }) => c.nome === nome)).toHaveLength(1);
  await busca(page).fill(nome); await expect(page.locator('.excel-table-row')).toHaveCount(1);
});

test('ficha aberta recebe atualizações remotas e protege seu rascunho ao concorrer com o Excel', async ({ page, browser }) => {
  const nome = novoNome(); await excel(page); await incluir(page, nome, 'Versão inicial'); await busca(page).fill(nome);
  const id = Number(await page.locator('.excel-table-row').getAttribute('data-cliente-id'));
  const ctx = await browser.newContext();
  try {
    const outra = await ctx.newPage(); await excel(outra); await busca(outra).fill(nome); await ficha(outra, id).click();
    const dialog = outra.getByRole('dialog', { name: 'Fichas dos clientes', exact: true });
    const campo = dialog.getByRole('textbox', { name: 'Informações adicionais', exact: true });
    await expect(campo).toHaveValue('Versão inicial');
    await campo.fill('Rascunho na ficha');
    const salvarExcel = async (texto: string) => {
      await page.getByRole('button', { name: `Informações adicionais de ${nome}`, exact: true }).click();
      const info = page.getByRole('dialog', { name: nome, exact: true });
      await info.getByRole('button', { name: 'Alterar', exact: true }).click(); await info.getByRole('textbox').fill(texto);
      await info.getByRole('button', { name: 'Salvar', exact: true }).click();
      await expect(info.getByRole('status')).toHaveText('Informações salvas.');
      await info.getByRole('button', { name: 'Fechar informações adicionais', exact: true }).click();
    };
    await salvarExcel('Salvo no Excel');
    await dialog.getByRole('button', { name: 'Salvar ficha', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('Outro computador alterou');
    await expect(campo).toHaveValue('Rascunho na ficha');
    outra.once('dialog', confirmacao => confirmacao.dismiss());
    await dialog.getByRole('button', { name: 'Recarregar ficha após revisar', exact: true }).click();
    await expect(campo).toHaveValue('Rascunho na ficha');
    outra.once('dialog', confirmacao => confirmacao.accept());
    await dialog.getByRole('button', { name: 'Recarregar ficha após revisar', exact: true }).click();
    await expect(campo).toHaveValue('Salvo no Excel');
    await salvarExcel('Atualização automática');
    await outra.bringToFront();
    await expect(campo).toHaveValue('Atualização automática');
  } finally { await ctx.close(); }
});
