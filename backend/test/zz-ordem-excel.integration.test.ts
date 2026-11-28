import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { prepararBancoDeTeste, urlDeTeste } from './helpers/banco.ts';
const pool = new Pool({ connectionString: urlDeTeste().toString() });
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
let server: Server, base: string;
const tag = `Codex ordem Excel ${Date.now()}`;
async function req(path: string, method = 'GET', data?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const texto = await r.text(); assert.equal(r.status, status, texto); return JSON.parse(texto);
}
const ler = () => req('/excel/estado');
const alterar = (alteracoes: unknown[], status = 200) => req('/excel/estado', 'PATCH', { alteracoes }, status);
const cliente = (nome: string) => req('/clientes', 'POST', { nome: `${tag} ${nome}` }, 201);
before(async () => {
  await prepararBancoDeTeste(pool); server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => { await pool.query('DELETE FROM "ExcelCompartilhado" WHERE id=$1', ['principal']); });
after(async () => { await new Promise<void>(r => server.close(() => r())); await prisma.$disconnect(); await pool.end(); });

test('Excel: ordem manual global persiste, é idempotente e não altera registros, históricos, avisos ou ordem do Painel', async () => {
  const a = await cliente('Alfa'), b = await cliente('Beta'), c = await cliente('Gama');
  for (const competencia of ['2026-11', '2026-12']) for (const item of [a, b, c]) await alterar([{ tipo: 'incluirClienteMes', clienteId: item.id, competencia }]);
  const antes = await ler(), anterior: number[] = antes.estado.ordemClientesExcel;
  const pendencias = await prisma.pendencia.findMany({ where: { clienteId: { in: [a.id, b.id, c.id] } }, include: { historico: true }, orderBy: { id: 'asc' } });
  const ordem = anterior.filter(id => id !== c.id); ordem.splice(ordem.indexOf(a.id), 0, c.id);
  const op = { tipo: 'ordenarExcel', ordem, anterior };
  const salvo = await alterar([op]);
  assert.deepEqual(salvo.estado.ordemClientesExcel, ordem);
  assert.deepEqual((await ler()).estado.ordemClientesExcel, ordem);
  assert.equal((await alterar([op])).revisao, salvo.revisao);
  assert.deepEqual(salvo.estado.registros, antes.estado.registros);
  assert.deepEqual(salvo.estado.avisosExtras, antes.estado.avisosExtras);
  assert.deepEqual(salvo.estado.ordemClientesPainel, antes.estado.ordemClientesPainel);
  assert.deepEqual(await prisma.pendencia.findMany({ where: { clienteId: { in: [a.id, b.id, c.id] } }, include: { historico: true }, orderBy: { id: 'asc' } }), pendencias);
});

test('Excel: ordem concorrente, IDs ausentes, repetidos ou inválidos não sobrescrevem a ordem nem aplicam lote parcial', async () => {
  const a = await cliente('concorrente A'); await cliente('concorrente B');
  const anterior: number[] = (await ler()).estado.ordemClientesExcel, ordem = [...anterior].reverse();
  await alterar([{ tipo: 'ordenarExcel', ordem, anterior }]);
  const novo = await cliente('incluído depois');
  const atual = await ler(); assert.equal(atual.estado.ordemClientesExcel.at(-1), novo.id);
  await alterar([{ tipo: 'definir', caminho: ['nome', `cliente:${a.id}`], anterior: a.nome, valor: 'Não aplicar' }, { tipo: 'ordenarExcel', ordem: anterior, anterior: ordem }], 409);
  assert.equal((await req(`/clientes/${a.id}`)).nome, a.nome);
  for (const invalida of [ordem.slice(1), [...atual.estado.ordemClientesExcel, novo.id], [2147483647], ['1']]) await alterar([{ tipo: 'ordenarExcel', ordem: invalida, anterior: atual.estado.ordemClientesExcel }], 400);
  assert.deepEqual(await ler(), atual);
});

test('Excel: dados antigos recebem ordem completa; renomear mantém a posição e excluir retira apenas o ID correspondente', async () => {
  const a = await cliente('ordem antiga A'), b = await cliente('ordem antiga B');
  await ler();
  const dados = (await pool.query('SELECT dados FROM "ExcelCompartilhado" WHERE id=$1', ['principal'])).rows[0].dados;
  delete dados.estado.ordemClientesExcel;
  await pool.query('UPDATE "ExcelCompartilhado" SET dados=$1::jsonb WHERE id=$2', [JSON.stringify(dados), 'principal']);
  const antes = await ler();
  assert.deepEqual([...antes.estado.ordemClientesExcel].sort((a, b) => a - b), Object.values(antes.estado.vinculosClientes).sort((a: number, b: number) => a - b));
  const ordem = [...antes.estado.ordemClientesExcel].reverse();
  await alterar([{ tipo: 'ordenarExcel', ordem, anterior: antes.estado.ordemClientesExcel }]);
  await req(`/clientes/${a.id}`, 'PATCH', { nome: `${a.nome} renomeado` });
  assert.deepEqual((await ler()).estado.ordemClientesExcel, ordem);
  await req(`/clientes/${b.id}`, 'DELETE', { nomeConfirmado: b.nome });
  assert.deepEqual((await ler()).estado.ordemClientesExcel, ordem.filter(id => id !== b.id));
});
