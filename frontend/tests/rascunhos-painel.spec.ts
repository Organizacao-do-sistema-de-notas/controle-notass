// These cases exercise the browser only: every API request is intercepted.
// No database fixtures, migrations or customer records are needed.
import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
const data = '2026-11-25T12:00:00.000Z';
const cliente = { id: 811, nome: 'Cliente fictício do Painel', ativo: true, contabilidadeId: null, contabilidade: null, criadoEm: data };
const pendencia = { id: 911, competencia: '2026-11', status: 'PENDENTE', responsavel: 'Operador fictício', observacao: null,
  mensagemContador: null, temMensagemContador: false, criadoEm: data, atualizadoEm: data, concluidoEm: null,
  cliente, contabilidade: null, ultimaMovimentacao: { tipo: 'CRIACAO', autor: null, criadoEm: data } };
const responder = (rota: Route, status: number, corpo: unknown) => rota.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-15T12:00:00Z'));
  await page.addInitScript(() => {
    localStorage.setItem('controle-notas-modo', 'painel');
    localStorage.setItem('controle-notas-autor', 'Operador fictício');
  });
  await page.route(`${api}/**`, async rota => {
    const caminho = new URL(rota.request().url()).pathname;
    if (caminho === '/painel/competencias') return responder(rota, 200, ['2026-11']);
    if (caminho === '/painel') return responder(rota, 200, { competencia: '2026-11', totais: { total: 1, emAberto: 1, pendente: 1, aguardandoCliente: 0, emAtendimento: 0, concluido: 0 }, pendencias: [pendencia] });
    if (caminho === '/clientes') return responder(rota, 200, [cliente]);
    if (caminho === '/contabilidades') return responder(rota, 200, [{ id: 711, nome: 'Contabilidade fictícia', criadoEm: data }]);
    if (caminho === '/pendencias/911/mensagem') {
      const mensagem = rota.request().method() === 'PUT' ? rota.request().postDataJSON().mensagem.trim() : null;
      return responder(rota, 200, { pendenciaId: 911, cliente, contabilidade: null, competencia: '2026-11', mensagem, temMensagem: mensagem !== null, linkWhatsApp: null });
    }
    return rota.abort('failed');
  });
});

for (const caso of [
  { titulo: 'Incluir cliente', campo: 'Observação interna', fechar: 'Fechar inclusão de cliente' },
]) {
  test(`${caso.titulo}: não alerta sem edição; protege X, Escape e fundo; restaura foco ao descartar`, async ({ page }) => {
    await page.goto('/');
    const abrir = page.getByRole('button', { name: caso.titulo + ' +', exact: true });
    await abrir.click();
    const dialog = page.getByRole('dialog', { name: caso.titulo, exact: true });
    // Unchanged prefilled fields are not unsaved edits.
    await dialog.getByRole('button', { name: caso.fechar }).click();
    await expect(dialog).toHaveCount(0);
    await expect(abrir).toBeFocused();
    await abrir.click();
    const campo = dialog.getByRole('textbox', { name: caso.campo, exact: true });
    await campo.fill('Rascunho fictício preservado');
    page.once('dialog', confirmacao => confirmacao.dismiss());
    await dialog.getByRole('button', { name: caso.fechar }).click();
    await expect(campo).toHaveValue('Rascunho fictício preservado');
    page.once('dialog', confirmacao => confirmacao.dismiss());
    await page.keyboard.press('Escape');
    await expect(campo).toHaveValue('Rascunho fictício preservado');
    page.once('dialog', confirmacao => confirmacao.dismiss());
    await page.locator('.modal-backdrop').click({ position: { x: 2, y: 2 } });
    await expect(campo).toHaveValue('Rascunho fictício preservado');
    page.once('dialog', confirmacao => confirmacao.accept());
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(abrir).toBeFocused();
    await abrir.click();
    await expect(dialog.getByRole('textbox', { name: caso.campo, exact: true })).toHaveValue('');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}

test('mensagem protege recarga e troca de visualização, mantém erro/rascunho e reconhece o texto salvo', async ({ page }) => {
  await page.goto('/');
  const abrir = page.getByRole('button', { name: 'Criar mensagem', exact: true });
  await abrir.click();
  const dialog = page.getByRole('dialog', { name: cliente.nome, exact: true });
  // Merely opening the generated template must not require a discard.
  await dialog.getByRole('button', { name: 'Fechar mensagem' }).click();
  await abrir.click();
  const campo = dialog.getByRole('textbox', { name: 'Mensagem para o contador', exact: true });
  await campo.fill('Mensagem fictícia revisada');
  page.once('dialog', confirmacao => confirmacao.dismiss());
  await page.getByRole('button', { name: 'Excel', exact: true }).evaluate(botao => (botao as HTMLButtonElement).click());
  await expect(campo).toHaveValue('Mensagem fictícia revisada');
  let avisosRecarga = 0;
  page.once('dialog', async confirmacao => { expect(confirmacao.type()).toBe('beforeunload'); avisosRecarga++; await confirmacao.dismiss(); });
  // A canceled navigation cannot be awaited through page.reload().
  await page.evaluate(() => { window.setTimeout(() => window.location.reload(), 0); });
  await expect.poll(() => avisosRecarga).toBe(1);
  await expect(campo).toHaveValue('Mensagem fictícia revisada');
  await page.route(`${api}/pendencias/911/mensagem`, async rota => {
    if (rota.request().method() === 'PUT') return responder(rota, 503, { erro: 'Falha fictícia ao salvar mensagem' });
    return rota.fallback();
  });
  await dialog.getByRole('button', { name: 'Salvar mensagem', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText('Falha fictícia ao salvar mensagem');
  await expect(campo).toHaveValue('Mensagem fictícia revisada');
  await page.unroute(`${api}/pendencias/911/mensagem`);
  await dialog.getByRole('button', { name: 'Salvar mensagem', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'Salvar mensagem', exact: true })).toBeEnabled();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Fechar mensagem' }).click();
  await expect(dialog).toHaveCount(0);
});

test('gravação lenta bloqueia campos, fechamento e troca de tela e impede envio simultâneo', async ({ page }) => {
  let envios = 0;
  let liberar!: () => void;
  const portao = new Promise<void>(resolver => { liberar = resolver; });
  await page.route(`${api}/pendencias`, async rota => {
    if (rota.request().method() !== 'POST') return rota.fallback();
    envios++; await portao;
    return responder(rota, 201, { id: 912 });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Incluir cliente +', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Incluir cliente', exact: true });
  await dialog.getByRole('button', { name: `Selecionar cliente #${cliente.id} — ${cliente.nome}`, exact: true }).click();
  const campo = dialog.getByRole('textbox', { name: 'Observação interna', exact: true });
  await campo.fill('Cliente fictício incluído no mês');
  try {
    await dialog.getByRole('button', { name: 'Incluir cliente', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Fechar inclusão de cliente' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Cancelar', exact: true })).toBeDisabled();
    await expect(campo).toBeDisabled();
    await expect(dialog.getByRole('textbox', { name: 'Pesquisar cliente', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: `Selecionar cliente #${cliente.id} — ${cliente.nome}`, exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Excel', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await dialog.evaluate(elemento => (elemento as HTMLFormElement).requestSubmit());
  } finally { liberar(); }
  await expect(dialog).toHaveCount(0);
  expect(envios).toBe(1);
});

for (const width of [1440, 390]) {
  test(`incluir cliente filtra enquanto digita por nome, apelido e número e salva apenas o ID escolhido (${width}px)`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    const cadastros = [
      { ...cliente, nome: 'Padaria São José', nomesAlternativos: [{ nome: 'Mercadão Central' }], contabilidade: { id: 711, nome: 'Contabilidade Alfa' } },
      { ...cliente, id: 812, nome: 'Padaria São José', nomesAlternativos: [{ nome: 'Filial Oeste' }], contabilidade: { id: 712, nome: 'Contabilidade Beta' } },
      { ...cliente, id: 813, nome: 'Mercado Alfa', nomesAlternativos: [] },
      { ...cliente, id: 814, nome: 'Mercadão inativo', ativo: false, nomesAlternativos: [] },
    ];
    let leituras = 0;
    const envios: Array<Record<string, unknown>> = [];
    await page.route(`${api}/clientes`, rota => { leituras++; return responder(rota, 200, cadastros); });
    await page.route(`${api}/pendencias`, rota => { envios.push(rota.request().postDataJSON()); return responder(rota, 201, { id: 912 }); });
    await page.goto('/');
    await page.getByRole('button', { name: 'Incluir cliente +', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Incluir cliente', exact: true });
    const busca = dialog.getByRole('textbox', { name: 'Pesquisar cliente', exact: true });
    const tabela = dialog.getByRole('table', { name: 'Clientes cadastrados para incluir no mês', exact: true });
    const incluir = dialog.getByRole('button', { name: 'Incluir cliente', exact: true });
    const observacao = dialog.getByRole('textbox', { name: 'Observação interna', exact: true });
    await expect(busca).toBeFocused();
    await expect(tabela.locator('tbody tr')).toHaveCount(3);
    await expect(tabela).not.toContainText('Mercadão inativo');
    await expect(incluir).toBeDisabled();
    await busca.pressSequentially('s');
    await expect(tabela.locator('tbody tr')).toHaveCount(2);
    await busca.pressSequentially('ao jose');
    await expect(tabela.locator('tbody tr')).toHaveCount(2);
    await expect(tabela).toContainText('Contabilidade Alfa');
    await expect(tabela).toContainText('Contabilidade Beta');
    await page.screenshot({ path: testInfo.outputPath(`busca-${width}px.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await busca.fill('MERCADAO');
    await expect(tabela.locator('tbody tr')).toHaveCount(1);
    await expect(tabela).toContainText('#811');
    await busca.fill('central   811');
    await expect(tabela.locator('tbody tr')).toHaveCount(1);
    await busca.fill('#812');
    await expect(tabela.locator('tbody tr')).toHaveCount(1);
    await busca.press('Enter');
    expect(envios).toHaveLength(0);
    const selecionar = dialog.getByRole('button', { name: 'Selecionar cliente #812 — Padaria São José', exact: true });
    await selecionar.focus(); await page.keyboard.press('Enter');
    await expect(selecionar).toHaveAttribute('aria-pressed', 'true');
    await expect(incluir).toBeEnabled();
    await dialog.getByRole('textbox', { name: 'Responsável', exact: true }).fill('Responsável fictício');
    await expect(observacao).toHaveAttribute('placeholder', 'EX: esse cliente precisa se fazer tal coisa especifica');
    await observacao.fill('Instrução específica deste cliente');
    await busca.fill('cliente inexistente');
    await expect(tabela.locator('tbody tr')).toHaveCount(0);
    await expect(dialog.getByRole('status')).toHaveText('Nenhum cliente encontrado para essa pesquisa.');
    await expect(incluir).toBeDisabled();
    await expect(observacao).toHaveValue('Instrução específica deste cliente');
    await busca.fill('');
    await expect(tabela.locator('tbody tr')).toHaveCount(3);
    await expect(incluir).toBeDisabled();
    await selecionar.click();
    expect(leituras).toBe(1);
    expect(envios).toHaveLength(0);
    await incluir.click();
    await expect(dialog).toHaveCount(0);
    expect(envios).toEqual([{ clienteId: 812, competencia: '2026-11', status: 'PENDENTE', responsavel: 'Responsável fictício', observacao: 'Instrução específica deste cliente', autor: 'Operador fictício' }]);
  });
}

test('criação confirmada de pendência fecha o formulário mesmo se a leitura seguinte falhar', async ({ page }) => {
  let criada = false, envios = 0;
  await page.route(`${api}/painel/competencias`, rota => criada
    ? responder(rota, 503, { erro: 'Falha fictícia ao atualizar competências' }) : rota.fallback());
  await page.route(`${api}/pendencias`, rota => {
    expect(rota.request().method()).toBe('POST');
    criada = true; envios++;
    return responder(rota, 201, { id: 912 });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Incluir cliente +', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Incluir cliente', exact: true });
  await dialog.getByRole('button', { name: `Selecionar cliente #${cliente.id} — ${cliente.nome}`, exact: true }).click();
  await dialog.getByLabel('Competência', { exact: true }).fill('2026-12');
  await dialog.getByRole('textbox', { name: 'Observação interna', exact: true }).fill('Observação fictícia');
  await dialog.getByRole('button', { name: 'Incluir cliente', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.alert.error')).toHaveText('Falha fictícia ao atualizar competências');
  expect(envios).toBe(1);
});
