import { expect, test } from './fixtures';
import type { Page } from '@playwright/test';

const chaveInfo = 'controle-notas-excel-clientes-informacoes';
const cliente = 'Codex empresa ficticia informacoes';

async function preparar(page: Page, dados?: { nomes?: Record<string, string>; informacoes?: unknown }) {
  await page.addInitScript(({ cliente, chaveInfo, dados }) => {
    localStorage.setItem('controle-notas-modo', 'excel');
    localStorage.setItem('controle-notas-excel-mes', '2026-11');
    localStorage.setItem('controle-notas-excel-clientes', JSON.stringify([cliente]));
    if (dados?.nomes) localStorage.setItem('controle-notas-excel-clientes-nomes', JSON.stringify(dados.nomes));
    if (dados && 'informacoes' in dados) localStorage.setItem(chaveInfo, JSON.stringify(dados.informacoes));
  }, { cliente, chaveInfo, dados });
  await page.goto('/');
  await importarLocal(page);
}

async function importarLocal(page: Page) {
  await page.getByRole('button', { name: 'Importar dados deste navegador', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Importar dados deste navegador', exact: true })).toHaveCount(0);
}

function botaoInfo(page: Page, nome = cliente) {
  return page.getByRole('button', { name: `Informações adicionais de ${nome}`, exact: true });
}

async function editarCliente(page: Page, chave = cliente) {
  await page.getByRole('button', { name: /Alterar\s*Cliente/, exact: true }).click();
  const editor = page.locator('.excel-modal-clientes');
  await editor.getByRole('combobox', { name: 'Cliente', exact: true }).selectOption(chave);
  return editor;
}

test('botão quadrado à direita da observação abre consulta vazia sem alterar os dados do mês', async ({ page }) => {
  await preparar(page);
  await page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...').fill(cliente);
  const observacao = page.getByRole('textbox', { name: `Observação mensal de ${cliente}`, exact: true });
  await observacao.fill('Observação somente deste mês');
  await expect.poll(async () => (await (await page.request.get('http://127.0.0.1:3010/excel/estado')).json()).estado.registros['2026-11']?.[cliente]?.observacao).toBe('Observação somente deste mês');
  const antes = await (await page.request.get('http://127.0.0.1:3010/excel/estado')).json();
  const posicaoInput = await observacao.boundingBox();
  const posicaoBotao = await botaoInfo(page).boundingBox();
  expect(posicaoBotao!.x).toBeGreaterThan(posicaoInput!.x + posicaoInput!.width);
  expect(posicaoBotao!.width).toBeLessThanOrEqual(30);
  expect(posicaoBotao!.height).toBe(posicaoBotao!.width);
  await botaoInfo(page).click();
  const dialog = page.getByRole('dialog', { name: cliente, exact: true });
  await expect(dialog.getByRole('textbox', { name: 'Informações adicionais', exact: true })).toHaveValue('');
  await expect(dialog.getByRole('textbox')).toHaveAttribute('readonly', '');
  await expect(dialog).toContainText('Salvas no banco compartilhado');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(botaoInfo(page)).toBeFocused();
  expect(await (await page.request.get('http://127.0.0.1:3010/excel/estado')).json()).toEqual(antes);
  expect(await page.evaluate(chave => localStorage.getItem(chave), chaveInfo)).toBeNull();
});

test('cadastro guarda informações permanentes e mantém observações e status independentes por mês', async ({ page, request }) => {
  const apiAntes = await (await request.get('http://127.0.0.1:3010/clientes')).json();
  await page.goto('/');
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-11');
  await page.getByRole('button', { name: /Incluir\s*Cliente/, exact: true }).click();
  const editor = page.locator('.excel-modal-clientes');
  const nome = `${cliente} novo`;
  const texto = 'Orientação fictícia da empresa.\nSegunda particularidade de teste.';
  await editor.getByRole('textbox', { name: 'Nome principal', exact: true }).fill(nome);
  await editor.getByRole('textbox', { name: 'Informações adicionais', exact: true }).fill(texto);
  await editor.getByRole('button', { name: 'Incluir', exact: true }).click();
  const filtro = page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...');
  await filtro.fill(nome);
  const row = page.locator('.excel-table-row');
  await row.getByRole('textbox', { name: `Observação mensal de ${nome}`, exact: true }).fill('Pendência fictícia de novembro');
  await row.getByRole('button', { name: /Pendente/ }).click();
  await row.getByRole('button', { name: 'OK', exact: true }).click();
  await botaoInfo(page, nome).click();
  await expect(page.getByRole('dialog', { name: nome, exact: true }).locator('.cliente-info-texto')).toHaveValue(texto);
  await page.getByRole('button', { name: 'Fechar informações adicionais', exact: true }).click();
  await expect.poll(async () => (await (await request.get('http://127.0.0.1:3010/excel/estado')).json()).estado.registros['2026-11']?.[nome]?.observacao).toBe('Pendência fictícia de novembro');
  await page.reload();
  await filtro.fill(nome);
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-12');
  await expect(row.getByRole('textbox', { name: `Observação mensal de ${nome}`, exact: true })).toHaveValue('');
  await expect(row.locator('.excel-status-trigger')).toContainText('Pendente');
  await botaoInfo(page, nome).click();
  await expect(page.getByRole('dialog', { name: nome, exact: true }).locator('.cliente-info-texto')).toHaveValue(texto);
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-11');
  await expect(row.getByRole('textbox', { name: `Observação mensal de ${nome}`, exact: true })).toHaveValue('Pendência fictícia de novembro');
  await expect(row.locator('.excel-status-trigger')).toContainText('OK');
  expect(await (await request.get('http://127.0.0.1:3010/clientes')).json()).toEqual(apiAntes);
});

test('cada cliente conserva suas informações ao renomear, inclusive nomes exibidos iguais, e pode limpar o texto', async ({ page }) => {
  const outro = `${cliente} outro`;
  await page.addInitScript(({ cliente, outro, chaveInfo }) => {
    localStorage.setItem('controle-notas-modo', 'excel');
    localStorage.setItem('controle-notas-excel-clientes', JSON.stringify([cliente, outro]));
    localStorage.setItem('controle-notas-excel-clientes-nomes', JSON.stringify({ [cliente]: 'Mesmo nome de teste', [outro]: 'Mesmo nome de teste' }));
    localStorage.setItem(chaveInfo, JSON.stringify({ [cliente]: 'Informação exclusiva A', [outro]: 'Informação exclusiva B' }));
  }, { cliente, outro, chaveInfo });
  await page.goto('/');
  await importarLocal(page);
  await page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...').fill('Mesmo nome de teste');
  const botoes = botaoInfo(page, 'Mesmo nome de teste');
  await expect(botoes).toHaveCount(2);
  await botoes.nth(0).click();
  await expect(page.getByRole('dialog').locator('.cliente-info-texto')).toHaveValue('Informação exclusiva A');
  await page.keyboard.press('Escape');
  await botoes.nth(1).click();
  await expect(page.getByRole('dialog').locator('.cliente-info-texto')).toHaveValue('Informação exclusiva B');
  await page.keyboard.press('Escape');
  const editor = await editarCliente(page);
  await editor.getByRole('textbox', { name: 'Nome principal', exact: true }).fill('Nome de teste revisado');
  await expect(editor.getByRole('textbox', { name: 'Informações adicionais', exact: true })).toHaveValue('Informação exclusiva A');
  await editor.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...').fill('Nome de teste revisado');
  await botaoInfo(page, 'Nome de teste revisado').click();
  await expect(page.getByRole('dialog').locator('.cliente-info-texto')).toHaveValue('Informação exclusiva A');
  await page.keyboard.press('Escape');
  const novamente = await editarCliente(page);
  await novamente.getByRole('textbox', { name: 'Informações adicionais', exact: true }).fill('');
  await novamente.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await botaoInfo(page, 'Nome de teste revisado').click();
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('');
  const gravado = (await (await page.request.get('http://127.0.0.1:3010/excel/estado')).json()).estado.informacoesClientes;
  expect(gravado[outro]).toBe('Informação exclusiva B');
});

test('falha na gravação mantém o texto e não aplica parcialmente nome e apelidos antes de repetir', async ({ page }) => {
  await preparar(page, { informacoes: { [cliente]: 'Texto anterior' } });
  const antes = await (await page.request.get('http://127.0.0.1:3010/excel/estado')).json();
  const editor = await editarCliente(page);
  await editor.getByRole('textbox', { name: 'Nome principal', exact: true }).fill('Nome novo ainda não salvo');
  await editor.getByRole('textbox', { name: 'Outros nomes para pesquisa' }).fill('Apelido novo não salvo');
  await editor.getByRole('textbox', { name: 'Informações adicionais', exact: true }).fill('Texto que deve continuar no formulário');
  await page.route('**/excel/estado', route => route.request().method() === 'PATCH'
    ? route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({erro:'Falha simulada ao salvar no banco'})}) : route.continue());
  await editor.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await expect(editor.getByRole('alert')).toContainText('Falha simulada ao salvar no banco');
  await expect(editor.getByRole('textbox', { name: 'Informações adicionais', exact: true })).toHaveValue('Texto que deve continuar no formulário');
  expect(await (await page.request.get('http://127.0.0.1:3010/excel/estado')).json()).toEqual(antes);
  await page.unrouteAll({behavior:'wait'});
  await editor.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect((await (await page.request.get('http://127.0.0.1:3010/excel/estado')).json()).estado.informacoesClientes[cliente]).toBe('Texto que deve continuar no formulário');
});

test('consulta em tela pequena mantém foco, escapa HTML e preserva os avisos fixos', async ({ page }) => {
  const texto = '<img src=x onerror="alert(1)">\nOrientação fictícia.\n' + 'Detalhe '.repeat(80);
  await page.setViewportSize({ width: 390, height: 844 });
  await preparar(page, { informacoes: { [cliente]: texto } });
  await page.getByPlaceholder('Nome fantasia, razão social, apelido ou outro nome do cliente...').fill(cliente);
  await botaoInfo(page).click();
  const dialog = page.getByRole('dialog', { name: cliente, exact: true });
  await expect(dialog.locator('img')).toHaveCount(0);
  await expect(dialog.locator('.cliente-info-texto')).toHaveValue(texto);
  await dialog.getByRole('button', { name: 'Fechar informações adicionais', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Alterar', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Fechar informações adicionais', exact: true })).toBeFocused();
  const medidas = await dialog.evaluate(element => ({ largura: element.getBoundingClientRect().width, interna: element.scrollWidth, disponivel: element.clientWidth }));
  expect(medidas.largura).toBeLessThanOrEqual(390);
  expect(medidas.interna).toBeLessThanOrEqual(medidas.disponivel);
  await page.keyboard.press('Escape');
  await expect(botaoInfo(page)).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Xaxim Gás', exact: true })).toBeVisible();
  await page.locator('.priority-toggle').click();
  for (const nome of ['Bom dia filial', 'Bom dia Matriz', 'Compre bem']) await expect(page.locator('.priority-list')).toContainText(nome);
});

test('informações antigas ausentes ou com formato inválido não quebram a lista', async ({ page }) => {
  await preparar(page, { informacoes: { [cliente]: { invalido: true } } });
  await botaoInfo(page).click();
  await expect(page.getByRole('dialog', { name: cliente, exact: true }).getByRole('textbox')).toHaveValue('');
  await page.keyboard.press('Escape');
  await page.evaluate(chave => localStorage.setItem(chave, '{json inválido'), chaveInfo);
  // Remove the initialization script by checking the malformed value in a new
  // page of this same context, which retains local data without rewriting it.
  const outraPagina = await page.context().newPage();
  await outraPagina.goto('/');
  await botaoInfo(outraPagina).click();
  await expect(outraPagina.getByRole('dialog', { name: cliente, exact: true }).getByRole('textbox')).toHaveValue('');
  await outraPagina.close();
});
