// Browser regressions with fictitious data: all API requests are intercepted.
import { test, expect } from '@playwright/test';
import type { Route } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
const data = '2026-11-27T18:00:00Z';
const responder = (rota: Route, status: number, corpo: unknown) => rota.fulfill({ status, contentType: 'application/json', body: JSON.stringify(corpo) });
const criarPainel = (competencia = '2026-11') => ({
  competencia,
  ordemClientes: Array.from({ length: 12 }, (_, i) => 801 + i),
  totais: { total: 12, emAberto: 12, pendente: 12, aguardandoCliente: 0, emAtendimento: 0, concluido: 0 },
  pendencias: Array.from({ length: 12 }, (_, i) => ({ id: 901 + i, competencia, status: 'PENDENTE', responsavel: null, observacao: null,
    mensagemContador: null, temMensagemContador: false, criadoEm: data, atualizadoEm: data, concluidoEm: null as string | null,
    cliente: { id: 801 + i, nome: `Cliente fictício ${i + 1}`, ativo: true }, contabilidade: null,
    ultimaMovimentacao: { tipo: 'CRIACAO', autor: null, criadoEm: data } })),
});

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(data));
  await page.addInitScript(() => {
    localStorage.setItem('controle-notas-modo', 'painel');
    localStorage.setItem('controle-notas-painel-mes', '2026-11');
  });
});

for (const width of [1440, 390]) {
  test(`trocar estado mantém cartões, ordem e rolagem durante a atualização e após falha (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const painel = criarPainel();
    let esperar = false, lendo = false, falhar = false, rejeitarEstado = false, envios = 0;
    let liberar!: () => void;
    let portao = Promise.resolve();
    await page.route(`${api}/**`, async rota => {
      const caminho = new URL(rota.request().url()).pathname;
      if (caminho === '/painel/competencias') return responder(rota, 200, ['2026-11']);
      if (caminho === '/painel') {
        if (esperar) { lendo = true; await portao; }
        return falhar ? responder(rota, 503, { erro: 'Falha fictícia ao atualizar o Painel' }) : responder(rota, 200, painel);
      }
      if (caminho === '/pendencias/907' && rota.request().method() === 'PATCH') {
        envios++;
        if (rejeitarEstado) return responder(rota, 503, { erro: 'Falha fictícia ao salvar estado' });
        painel.pendencias[6].status = rota.request().postDataJSON().status;
        painel.pendencias[6].concluidoEm = data;
        painel.totais = { ...painel.totais, emAberto: 11, pendente: 11, concluido: 1 };
        esperar = true;
        return responder(rota, 200, painel.pendencias[6]);
      }
      return rota.abort('failed');
    });
    await page.goto('/');
    const cartoes = page.locator('.pendencia-card');
    const cartao = page.locator('.pendencia-card[data-cliente-id="807"]');
    const status = cartao.getByRole('combobox', { name: 'Status de Cliente fictício 7', exact: true });
    await expect(cartoes).toHaveCount(12);
    await cartao.scrollIntoViewIfNeeded();
    const ordem = await cartoes.evaluateAll(items => items.map(el => (el as HTMLElement).dataset.clienteId));
    const referencias = await page.evaluateHandle(() => Array.from(document.querySelectorAll('.pendencia-card')));
    const rolagem = await page.evaluate(() => scrollY);
    const posicao = (await cartao.boundingBox())!;
    portao = new Promise<void>(resolve => { liberar = resolve; });
    try {
      await status.selectOption('CONCLUIDO');
      await expect.poll(() => lendo).toBe(true);
      await expect(status).toBeDisabled();
      await expect(cartoes).toHaveCount(12);
      expect(await referencias.evaluate(items => items.every(el => el.isConnected))).toBe(true);
      expect(Math.abs(await page.evaluate(() => scrollY) - rolagem)).toBeLessThan(2);
      expect(Math.abs((await cartao.boundingBox())!.y - posicao.y)).toBeLessThan(2);
      await expect(page.getByText('Carregando informações...', { exact: true })).toHaveCount(0);
    } finally { esperar = false; liberar(); }
    await expect(status).toBeEnabled();
    await expect(status).toHaveValue('CONCLUIDO');
    await expect(cartao).toHaveClass(/pendencia-concluida/);
    expect(await cartoes.evaluateAll(items => items.map(el => (el as HTMLElement).dataset.clienteId))).toEqual(ordem);
    expect(await referencias.evaluate(items => items.every(el => el.isConnected))).toBe(true);
    expect(Math.abs(await page.evaluate(() => scrollY) - rolagem)).toBeLessThan(2);
    expect(envios).toBe(1);

    // A rejected save keeps the confirmed state and the existing cards.
    rejeitarEstado = true;
    await status.selectOption('PENDENTE');
    await expect(page.locator('.alert.error')).toHaveText('Falha fictícia ao salvar estado');
    await expect(status).toHaveValue('CONCLUIDO');
    expect(await referencias.evaluate(items => items.every(el => el.isConnected))).toBe(true);

    // A failed refresh also preserves the list and allows an explicit retry.
    falhar = true;
    await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await expect(page.locator('.alert.error')).toHaveText('Falha fictícia ao atualizar o Painel');
    expect(await referencias.evaluate(items => items.every(el => el.isConnected))).toBe(true);
    falhar = false;
    await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
    await expect(page.locator('.alert.error')).toHaveCount(0);
    await expect(status).toBeEnabled();
    await expect(cartoes).toHaveCount(12);
    expect(await referencias.evaluate(items => items.every(el => el.isConnected))).toBe(true);
    await referencias.dispose();
  });
}

test('ao mudar o mês não mostra cartões nem totais do mês anterior, inclusive se a leitura falhar', async ({ page }) => {
  let esperar = true, iniciou = false, falhar = true;
  let liberar!: () => void;
  const portao = new Promise<void>(resolve => { liberar = resolve; });
  await page.route(`${api}/**`, async rota => {
    const url = new URL(rota.request().url());
    if (url.pathname === '/painel/competencias') return responder(rota, 200, ['2026-11', '2026-12']);
    if (url.pathname === '/painel') {
      if (url.searchParams.get('competencia') === '2026-11') return responder(rota, 200, criarPainel());
      if (esperar) { iniciou = true; await portao; }
      if (falhar) return responder(rota, 503, { erro: 'Falha fictícia no mês seguinte' });
      return responder(rota, 200, { competencia: '2026-12', totais: { total: 0, emAberto: 0, pendente: 0, aguardandoCliente: 0, emAtendimento: 0, concluido: 0 }, pendencias: [] });
    }
    return rota.abort('failed');
  });
  await page.goto('/');
  await expect(page.locator('.pendencia-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Mostrar indicadores', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Resumo do mês' })).toBeVisible();
  try {
    await page.getByRole('combobox', { name: 'Competência', exact: true }).selectOption('2026-12');
    await expect.poll(() => iniciou).toBe(true);
    await expect(page.getByText('Carregando informações...', { exact: true })).toBeVisible();
    await expect(page.locator('.pendencia-card')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Resumo do mês' })).toHaveCount(0);
  } finally { esperar = false; liberar(); }
  await expect(page.locator('.alert.error')).toHaveText('Falha fictícia no mês seguinte');
  await expect(page.locator('.pendencia-card')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Resumo do mês' })).toHaveCount(0);
  falhar = false;
  await page.getByRole('button', { name: 'Atualizar', exact: true }).click();
  await expect(page.getByText('Nenhuma pendência encontrada para os filtros atuais.', { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resumo do mês' }).locator('strong').first()).toHaveText('0');
});
