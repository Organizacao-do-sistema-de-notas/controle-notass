import { test, expect } from './fixtures';
import type { Page, APIRequestContext } from '@playwright/test';
const api = 'http://127.0.0.1:3010';
const avisoCard = (page: Page, id: string) => page.locator(`[data-aviso-id="aviso:${id}"]`);
const painelCard = (page: Page, id: number) => page.locator(`.pendencia-card[data-cliente-id="${id}"]`);
async function avisos(request: APIRequestContext) {
  const tag = Date.now();
  const a = { id: `cartao-a-${tag}`, titulo: `Aviso A ${tag}`, texto: 'Primeiro conteúdo fictício' };
  const b = { id: `cartao-b-${tag}`, titulo: `Aviso B ${tag}`, texto: 'Segundo conteúdo fictício' };
  expect((await request.patch(api + '/excel/estado', { data: { alteracoes: [a, b].map(aviso => ({ tipo: 'incluirAviso', aviso })) } })).ok()).toBe(true);
  return { a, b };
}
async function excel(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => { localStorage.setItem('controle-notas-modo', 'excel'); localStorage.setItem('controle-notas-excel-mes', '2026-11'); });
  await page.goto('/');
  await expect(page.getByText('Dados compartilhados entre os computadores.', { exact: true })).toBeVisible();
}

test('selecionar aviso mostra azul; excluir exige confirmação central vermelha, cancelar preserva e Xaxim permanece', async ({ page, request }) => {
  const { a, b } = await avisos(request); await excel(page);
  await expect(page.locator('.info-card')).toHaveCount(0);
  const excluir = page.getByRole('button', { name: /Excluir\s*Aviso/, exact: true });
  await expect(excluir).toBeDisabled();
  await avisoCard(page, a.id).getByText(a.texto, { exact: true }).click();
  await expect(avisoCard(page, a.id)).toHaveClass(/aviso-selecionado/);
  expect(await avisoCard(page, a.id).evaluate(el => getComputedStyle(el).outlineColor)).toBe('rgb(54, 108, 255)');
  await excluir.click();
  const confirmar = page.getByRole('alertdialog', { name: 'Confirmar exclusão', exact: true });
  await expect(confirmar).toContainText(a.titulo);
  await expect(confirmar.getByRole('button', { name: 'Cancelar', exact: true })).toBeFocused();
  expect(await confirmar.getByRole('button', { name: 'Excluir', exact: true }).evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(220, 21, 31)');
  const area = (await confirmar.boundingBox())!;
  expect(Math.abs(area.x + area.width / 2 - 720)).toBeLessThan(4);
  expect(Math.abs(area.y + area.height / 2 - 550)).toBeLessThan(4);
  await confirmar.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(avisoCard(page, a.id)).toBeVisible();
  await excluir.click(); await confirmar.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(confirmar).toHaveCount(0); await expect(avisoCard(page, a.id)).toHaveCount(0);
  await expect(avisoCard(page, b.id)).toBeVisible();
  const estado = (await (await request.get(api + '/excel/estado')).json()).estado;
  expect(estado.avisosExcluidos).toContainEqual(a);
  await page.getByRole('heading', { name: 'Xaxim Gás', exact: true }).click(); await expect(excluir).toBeDisabled();
});

test('arrastar pelo texto move o cartão inteiro com o mouse e Escape cancela sem alterar a ordem', async ({ page, request }) => {
  const { a, b } = await avisos(request); await excel(page);
  const card = avisoCard(page, a.id);
  const inicial = (await card.boundingBox())!;
  await page.mouse.move(inicial.x + 70, inicial.y + 55); await page.mouse.down();
  await page.mouse.move(inicial.x + 130, inicial.y + 105, { steps: 8 });
  await expect(card).toHaveAttribute('data-em-arrasto', 'true');
  const movido = (await card.boundingBox())!;
  expect(Math.abs(movido.x - inicial.x - 60)).toBeLessThan(3);
  expect(Math.abs(movido.y - inicial.y - 50)).toBeLessThan(3);
  await page.keyboard.press('Escape'); await page.mouse.up();
  await expect(card).not.toHaveAttribute('data-em-arrasto', 'true');
  expect((await (await request.get(api + '/excel/estado')).json()).estado.ordemAvisos).toEqual(['fixo:xaxim-gas', `aviso:${a.id}`, `aviso:${b.id}`]);
  const origem = (await card.boundingBox())!, alvo = (await avisoCard(page, b.id).boundingBox())!;
  await page.mouse.move(origem.x + 70, origem.y + 55); await page.mouse.down();
  await page.mouse.move(alvo.x + 70, alvo.y + alvo.height - 6, { steps: 12 }); await page.mouse.up();
  const esperado = ['fixo:xaxim-gas', `aviso:${b.id}`, `aviso:${a.id}`];
  await expect.poll(async () => (await (await request.get(api + '/excel/estado')).json()).estado.ordemAvisos).toEqual(esperado);
  await page.reload(); await expect.poll(() => page.locator('[data-aviso-id]').evaluateAll(items => items.map(el => (el as HTMLElement).dataset.avisoId))).toEqual(esperado);
});

test('aviso com falha na exclusão mantém confirmação e conteúdo até repetir com sucesso', async ({ page, request }) => {
  const { a } = await avisos(request); await excel(page);
  await avisoCard(page, a.id).click();
  await page.getByRole('button', { name: /Excluir\s*Aviso/, exact: true }).click();
  await page.route(api + '/excel/estado', route => route.request().method() === 'PATCH'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia ao excluir aviso' }) }) : route.continue());
  const confirmar = page.getByRole('alertdialog', { name: 'Confirmar exclusão', exact: true });
  await confirmar.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(confirmar.getByRole('alert')).toHaveText('Falha fictícia ao excluir aviso');
  expect((await (await request.get(api + '/excel/estado')).json()).estado.avisosExtras).toContainEqual(a);
  await page.unroute(api + '/excel/estado');
  await confirmar.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(confirmar).toHaveCount(0); await expect(avisoCard(page, a.id)).toHaveCount(0);
});

test('Alterar Aviso abre o cartão selecionado e grava apenas ele, inclusive ao trocar a seleção depois', async ({ page, request }) => {
  const { a, b } = await avisos(request); await excel(page);
  const alterar = page.getByRole('button', { name: /Alterar\s*Aviso/, exact: true });
  await avisoCard(page, b.id).getByText(b.texto, { exact: true }).click();
  await alterar.click();
  const dialog = page.getByRole('dialog', { name: 'Alterar aviso', exact: true });
  await expect(dialog.getByRole('combobox')).toHaveValue(b.id);
  await expect(dialog.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(b.titulo);
  await expect(dialog.getByRole('textbox', { name: 'Aviso', exact: true })).toHaveValue(b.texto);
  const tituloB = b.titulo + ' editado', textoB = 'Texto atualizado somente no segundo cartão';
  await dialog.getByRole('textbox', { name: 'Título', exact: true }).fill(tituloB);
  await dialog.getByRole('textbox', { name: 'Aviso', exact: true }).fill(textoB);
  await dialog.getByRole('button', { name: 'Salvar alteração', exact: true }).click();
  await expect(dialog).toHaveCount(0); await expect(avisoCard(page, b.id)).toContainText(textoB);
  let estado = (await (await request.get(api + '/excel/estado')).json()).estado;
  expect(estado.avisosExtras.find((item: { id: string }) => item.id === a.id)).toEqual(a);
  expect(estado.avisosExtras.find((item: { id: string }) => item.id === b.id)).toEqual({ ...b, titulo: tituloB, texto: textoB });
  await avisoCard(page, a.id).getByText(a.texto, { exact: true }).click(); await alterar.click();
  await expect(dialog.getByRole('combobox')).toHaveValue(a.id);
  await expect(dialog.getByRole('textbox', { name: 'Aviso', exact: true })).toHaveValue(a.texto);
  await dialog.getByRole('textbox', { name: 'Aviso', exact: true }).fill('Texto atualizado somente no primeiro cartão');
  await dialog.getByRole('button', { name: 'Salvar alteração', exact: true }).click(); await expect(dialog).toHaveCount(0);
  estado = (await (await request.get(api + '/excel/estado')).json()).estado;
  expect(estado.avisosExtras.find((item: { id: string }) => item.id === b.id)).toEqual({ ...b, titulo: tituloB, texto: textoB });
  await page.reload();
  await expect(avisoCard(page, a.id)).toContainText('Texto atualizado somente no primeiro cartão');
  await expect(avisoCard(page, b.id)).toContainText(textoB);
});

test('edição exige aviso selecionado; teclado e seleção dentro do formulário mantêm o mesmo alvo sem salvar ao cancelar', async ({ page, request }) => {
  const { a, b } = await avisos(request); await excel(page);
  const alterar = page.getByRole('button', { name: /Alterar\s*Aviso/, exact: true });
  await expect(alterar).toBeDisabled();
  await page.getByRole('heading', { name: 'Xaxim Gás', exact: true }).click(); await expect(alterar).toBeDisabled();
  await avisoCard(page, b.id).focus(); await page.keyboard.press('Space'); await alterar.click();
  const dialog = page.getByRole('dialog', { name: 'Alterar aviso', exact: true });
  await expect(dialog.getByRole('combobox')).toHaveValue(b.id);
  await dialog.getByRole('combobox').selectOption(a.id);
  await expect(dialog.getByRole('textbox', { name: 'Título', exact: true })).toHaveValue(a.titulo);
  await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click(); await expect(dialog).toHaveCount(0);
  await expect(avisoCard(page, a.id)).toHaveClass(/aviso-selecionado/);
  await alterar.click(); await expect(dialog.getByRole('combobox')).toHaveValue(a.id);
  await page.getByRole('button', { name: 'Fechar formulário de aviso', exact: true }).click();
  const estado = (await (await request.get(api + '/excel/estado')).json()).estado;
  expect(estado.avisosExtras).toEqual([a, b]);
});

test('mercados alternam por mês sem criar clientes, linhas comuns ou pendências', async ({ page, request, browser }) => {
  const clientesAntes = await (await request.get(api + '/clientes')).json();
  const pendenciasAntes = await (await request.get(api + '/pendencias')).json();
  await excel(page); await page.locator('.priority-toggle').click();
  const registrosAntes = (await (await request.get(api + '/excel/estado')).json()).estado.registros;
  const botao = page.getByRole('button', { name: 'Alterar estado de Bom dia filial', exact: true });
  await expect(botao).toHaveText('Pendente'); await botao.click(); await expect(botao).toHaveText('Concluído');
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-12');
  await expect(botao).toHaveText('Pendente');
  await page.getByRole('combobox', { name: 'Selecionar mês da visão Excel' }).selectOption('2026-11');
  await expect(botao).toHaveText('Concluído');
  const contexto = await browser.newContext();
  try {
    const outra = await contexto.newPage(); await excel(outra); await outra.locator('.priority-toggle').click();
    await expect(outra.getByRole('button', { name: 'Alterar estado de Bom dia filial', exact: true })).toHaveText('Concluído');
  } finally { await contexto.close(); }
  await botao.click(); await expect(botao).toHaveText('Pendente');
  await expect(page.locator('.priority-list select')).toHaveCount(0);
  for (const nome of ['Bom dia filial', 'Bom dia Matriz', 'Compre bem']) await expect(page.locator('.priority-list')).toContainText(nome);
  expect(await (await request.get(api + '/clientes')).json()).toEqual(clientesAntes);
  expect(await (await request.get(api + '/pendencias')).json()).toEqual(pendenciasAntes);
  expect((await (await request.get(api + '/excel/estado')).json()).estado.registros).toEqual(registrosAntes);
});

test('exclusão em andamento bloqueia repetição, Cancelar e Escape até a resposta', async ({ page, request }) => {
  const { a } = await avisos(request); await excel(page);
  await avisoCard(page, a.id).click(); await page.getByRole('button', { name: /Excluir\s*Aviso/, exact: true }).click();
  let liberar!: () => void; const gate = new Promise<void>(resolve => { liberar = resolve; });
  let gravacoes = 0;
  await page.route(api + '/excel/estado', async route => {
    if (route.request().method() === 'PATCH') { gravacoes++; await gate; }
    await route.continue();
  });
  const confirmar = page.getByRole('alertdialog', { name: 'Confirmar exclusão', exact: true });
  try {
    await confirmar.getByRole('button', { name: 'Excluir', exact: true }).click();
    await expect(confirmar.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
    await expect(confirmar.getByRole('button', { name: 'Excluindo...', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(confirmar).toBeVisible();
    expect(gravacoes).toBe(1);
  } finally { liberar(); }
  await expect(confirmar).toHaveCount(0); await expect(avisoCard(page, a.id)).toHaveCount(0);
});

test('Painel mantém cadastro e ordem manual global ao mudar status; seletor fica em cima e ações nas extremidades', async ({ page, request }) => {
  const tag = `Codex painel livre ${Date.now()}`;
  const ids: number[] = [];
  for (let i = 0; i < 3; i++) {
    const c = await (await request.post(api + '/clientes', { data: { nome: `${tag} ${i}` } })).json(); ids.push(c.id);
    for (const competencia of ['2026-11', '2026-12']) await request.post(api + '/pendencias', { data: { clienteId: c.id, competencia, status: ['CONCLUIDO', 'PENDENTE', 'EM_ATENDIMENTO'][i] } });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.addInitScript(() => localStorage.setItem('controle-notas-painel-mes', '2026-11'));
  await page.goto('/'); await page.getByRole('button', { name: 'Painel', exact: true }).click();
  const ordemVisivel = async () => page.locator('.pendencia-card').evaluateAll((items, ids) => items.map(item => Number((item as HTMLElement).dataset.clienteId)).filter(id => ids.includes(id)), ids);
  await expect.poll(ordemVisivel).toEqual(ids);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const a = (await painelCard(page, ids[0]).boundingBox())!, c = (await painelCard(page, ids[2]).boundingBox())!;
  await page.mouse.move(c.x + 70, c.y + 60); await page.mouse.down();
  await page.mouse.move(a.x + 70, a.y + 8, { steps: 16 }); await page.mouse.up();
  await expect.poll(ordemVisivel).toEqual([ids[2], ids[0], ids[1]]);
  const card = painelCard(page, ids[0]);
  const status = card.getByRole('combobox', { name: `Status de ${tag} 0`, exact: true });
  await status.selectOption('PENDENTE');
  await expect.poll(ordemVisivel).toEqual([ids[2], ids[0], ids[1]]);
  await expect(card.locator('.card-actions select')).toHaveCount(0);
  expect((await status.boundingBox())!.y).toBeLessThan((await card.locator('.card-info-grid').boundingBox())!.y);
  expect(await status.evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(241, 63, 54)');
  expect((await card.getByRole('button', { name: 'Histórico', exact: true }).boundingBox())!.x)
    .toBeLessThan((await card.getByRole('button', { name: 'Criar mensagem', exact: true }).boundingBox())!.x);
  await page.getByRole('combobox', { name: 'Competência', exact: true }).selectOption('2026-12');
  await expect.poll(ordemVisivel).toEqual([ids[2], ids[0], ids[1]]);
  await page.reload(); await expect.poll(ordemVisivel).toEqual([ids[2], ids[0], ids[1]]);
  await page.getByRole('combobox', { name: 'Competência', exact: true }).selectOption('2026-11');
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('PENDENTE');
  await expect.poll(ordemVisivel).toEqual([ids[0], ids[1]]);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const origemFiltrada = (await painelCard(page, ids[1]).boundingBox())!, alvoFiltrado = (await painelCard(page, ids[0]).boundingBox())!;
  await page.mouse.move(origemFiltrada.x + 70, origemFiltrada.y + 60); await page.mouse.down();
  await page.mouse.move(alvoFiltrado.x + 70, alvoFiltrado.y + 8, { steps: 12 }); await page.mouse.up();
  await expect.poll(ordemVisivel).toEqual([ids[1], ids[0]]);
  await page.getByRole('combobox', { name: 'Status', exact: true }).selectOption('TODOS');
  await expect.poll(ordemVisivel).toEqual([ids[2], ids[1], ids[0]]);
  await painelCard(page, ids[1]).focus();
  await page.keyboard.press('ArrowUp');
  await expect.poll(ordemVisivel).toEqual([ids[1], ids[2], ids[0]]);
  await expect(painelCard(page, ids[1])).toBeFocused();
});
