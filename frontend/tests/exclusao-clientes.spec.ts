import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';

const api = 'http://127.0.0.1:3010';
async function abrir(page: Page, modo: 'excel' | 'painel', nome: string, id: number) {
  await page.addInitScript(modo => localStorage.setItem('controle-notas-modo', modo), modo);
  await page.goto('/');
  await page.getByRole('button', { name: /Excluir\s+cliente/i, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Excluir cliente', exact: true });
  await dialog.getByLabel('Pesquisar cliente', { exact: true }).fill(nome);
  await dialog.getByRole('button', { name: `Selecionar cliente #${id} — ${nome}`, exact: true }).click();
  return dialog;
}

test('Excel confirma o ID, permite cancelar e exclui o mesmo cliente das outras vistas', async ({ page, request }) => {
  const nome = `Codex exclusão UI Excel ${Date.now()}`;
  const c = await (await request.post(`${api}/clientes`, { data: { nome } })).json();
  await request.post(`${api}/pendencias`, { data: { clienteId: c.id, competencia: '2095-01' } });
  const dialog = await abrir(page, 'excel', nome, c.id);
  await dialog.getByRole('button', { name: 'Excluir cliente', exact: true }).click();
  const confirmar = page.getByRole('alertdialog', { name: 'Confirmar exclusão', exact: true });
  await expect(confirmar).toContainText(`#${c.id}`);
  await confirmar.getByRole('button', { name: 'Cancelar', exact: true }).click();
  await expect(dialog).toBeVisible();
  expect((await request.get(`${api}/clientes/${c.id}`)).status()).toBe(200);
  await dialog.getByRole('button', { name: 'Excluir cliente', exact: true }).click();
  await confirmar.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await expect(page.locator(`.excel-table-row[data-cliente-id="${c.id}"]`)).toHaveCount(0);
  expect((await request.get(`${api}/clientes/${c.id}/ficha`)).status()).toBe(404);
  const painel = await (await request.get(`${api}/painel?competencia=2095-01`)).json();
  expect(painel.pendencias.some((p: { cliente: { id: number } }) => p.cliente.id === c.id)).toBe(false);
  await expect(page.getByText('Xaxim Gás', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Controle mercados', exact: false }).click();
  for (const mercado of ['Bom dia filial', 'Bom dia Matriz', 'Compre bem']) await expect(page.locator('.priority-list')).toContainText(mercado);
});

test('Painel exclui cliente sem pendências e preserva seleção após falha para tentar novamente', async ({ page, request }) => {
  const nome = `Codex exclusão UI Painel ${Date.now()}`;
  const c = await (await request.post(`${api}/clientes`, { data: { nome } })).json();
  const dialog = await abrir(page, 'painel', nome, c.id);
  await page.route(`**/clientes/${c.id}`, async rota => {
    if (rota.request().method() === 'DELETE') await rota.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia de conexão' }) });
    else await rota.continue();
  });
  await dialog.getByRole('button', { name: 'Excluir cliente', exact: true }).click();
  const confirmar = page.getByRole('alertdialog', { name: 'Confirmar exclusão', exact: true });
  await confirmar.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(confirmar.getByRole('alert')).toHaveText('Falha fictícia de conexão');
  await expect(dialog.getByRole('button', { name: `Selecionar cliente #${c.id} — ${nome}`, exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect((await request.get(`${api}/clientes/${c.id}`)).status()).toBe(200);
  await page.unroute(`**/clientes/${c.id}`);
  await confirmar.getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Excel', exact: true }).click();
  await expect(page.locator(`.excel-table-row[data-cliente-id="${c.id}"]`)).toHaveCount(0);
});

test('exclusão em outro computador conserva a observação ainda não salva e permite descartar depois de copiar', async ({ page, request }) => {
  const nome = `Codex exclusão UI rascunho ${Date.now()}`;
  const c = await (await request.post(`${api}/clientes`, { data: { nome } })).json();
  await request.patch(`${api}/clientes/${c.id}/ficha`, { data: { frequenciaAcesso: 'MENSAL' } });
  await page.addInitScript(() => localStorage.setItem('controle-notas-modo', 'excel'));
  await page.goto('/');
  const linha = page.locator(`.excel-table-row[data-cliente-id="${c.id}"]`);
  await expect(linha).toBeVisible();
  // Simulate the other computer while this one's observation cannot be saved.
  await page.route('**/excel/estado', async rota => {
    if (rota.request().method() === 'PATCH') await rota.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Rede fictícia indisponível' }) });
    else await rota.continue();
  });
  await linha.getByRole('textbox').fill('Rascunho fictício a conservar');
  await expect(linha.getByRole('alert')).toBeVisible();
  expect((await request.delete(`${api}/clientes/${c.id}`, { data: { nomeConfirmado: nome } })).status()).toBe(200);
  const recuperacao = page.getByRole('region', { name: 'Rascunhos de clientes fora do cadastro' });
  await expect(recuperacao.getByRole('textbox')).toHaveValue('Rascunho fictício a conservar');
  page.once('dialog', confirmacao => confirmacao.dismiss());
  await recuperacao.getByRole('button', { name: 'Descartar rascunho' }).click();
  await expect(recuperacao).toBeVisible();
  page.once('dialog', confirmacao => confirmacao.accept());
  await recuperacao.getByRole('button', { name: 'Descartar rascunho' }).click();
  await expect(recuperacao).toHaveCount(0);
});

test('Painel retira o cartão e recalcula totais mesmo se a atualização da lista falhar após a exclusão', async ({ page, request }) => {
  const nome = `Codex exclusão UI cartão ${Date.now()}`;
  const c = await (await request.post(`${api}/clientes`, { data: { nome } })).json();
  await request.post(`${api}/pendencias`, { data: { clienteId: c.id, competencia: '2027-05' } });
  const totalAntes = (await (await request.get(`${api}/painel?competencia=2027-05`)).json()).totais.total;
  await page.addInitScript(() => localStorage.setItem('controle-notas-painel-mes', '2027-05'));
  const dialog = await abrir(page, 'painel', nome, c.id);
  await page.route('**/painel/competencias', rota => rota.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ erro: 'Falha fictícia ao atualizar competências' }) }));
  await dialog.getByRole('button', { name: 'Excluir cliente', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Confirmar exclusão', exact: true }).getByRole('button', { name: 'Excluir', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.pendencia-card').filter({ hasText: nome })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mostrar indicadores', exact: true }).click();
  await expect(page.locator('.summary-card').first().locator('strong')).toHaveText(String(totalAntes - 1));
  await expect(page.getByText('Falha fictícia ao atualizar competências', { exact: true })).toBeVisible();
});
