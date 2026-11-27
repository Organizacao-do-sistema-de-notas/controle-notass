import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { prepararBancoDeTeste, urlDeTeste } from './helpers/banco.ts';
import { estadoVazio } from '../src/excel/estado.ts';
const pool = new Pool({ connectionString: urlDeTeste().toString() });
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
let servidor: Server, base: string;
const tag = `Codex cartões fictícios ${Date.now()}`;
async function req(path: string, method = 'GET', data?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const text = await r.text(); assert.equal(r.status, status, text); return JSON.parse(text);
}
const ler = () => req('/excel/estado');
const alterar = (alteracoes: unknown[], status = 200) => req('/excel/estado', 'PATCH', { alteracoes }, status);
const cliente = (nome: string) => req('/clientes', 'POST', { nome: `${tag} ${nome}` }, 201);
before(async () => {
  await prepararBancoDeTeste(pool);
  servidor = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => servidor.once('listening', resolve));
  const address = servidor.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => { await pool.query('DELETE FROM "ExcelCompartilhado" WHERE id=$1', ['principal']); });
after(async () => { if (servidor) await new Promise<void>(resolve => servidor.close(() => resolve())); await prisma.$disconnect(); await pool.end(); });

test('aviso: exclusão preserva cópia, não muda registros, pode repetir e importação antiga não o recria', async () => {
  const aviso = { id: `${tag}-excluir`, titulo: 'Aviso a excluir', texto: 'Preservar conteúdo excluído' };
  await alterar([{ tipo: 'incluirAviso', aviso }]);
  const antes = await ler();
  const salvo = await alterar([{ tipo: 'excluirAviso', aviso }]);
  assert.equal(salvo.estado.avisosExtras.length, 0);
  assert.deepEqual(salvo.estado.avisosExcluidos, [aviso]);
  assert.deepEqual(salvo.estado.ordemAvisos, ['fixo:xaxim-gas']);
  assert.deepEqual(salvo.estado.registros, antes.estado.registros);
  assert.equal((await alterar([{ tipo: 'excluirAviso', aviso }])).revisao, salvo.revisao);
  const local = estadoVazio(); local.avisosExtras.push(aviso);
  const importacao = await req('/excel/importar', 'POST', { estado: local });
  assert.equal(importacao.totalConflitos, 1); assert.equal(importacao.estado.avisosExtras.length, 0);
  await alterar([{ tipo: 'incluirAviso', aviso }], 409);
});

test('aviso: confirmação antiga não exclui conteúdo editado; Xaxim Gás não pode ser excluído', async () => {
  const aviso = { id: `${tag}-concorrente`, titulo: 'Texto original', texto: 'Original' };
  await alterar([{ tipo: 'incluirAviso', aviso }]);
  await alterar([{ tipo: 'definir', caminho: ['aviso', aviso.id, 'texto'], anterior: 'Original', valor: 'Editado por outro computador' }]);
  await alterar([{ tipo: 'excluirAviso', aviso }], 409);
  const antes = await ler();
  await alterar([{ tipo: 'excluirAviso', aviso: { id: 'fixo:xaxim-gas', titulo: 'Xaxim Gás', texto: 'Não excluir' } }], 400);
  assert.deepEqual(await ler(), antes);
  assert.equal(antes.estado.avisosExtras[0].texto, 'Editado por outro computador');
});

test('Painel: ordem inicial segue cadastro dos clientes e não muda com status ou atualização', async () => {
  const clientes = await Promise.all(['primeiro', 'segundo', 'terceiro'].map(cliente));
  const ids = clientes.map(c => c.id).sort((a, b) => a - b);
  const status = ['CONCLUIDO', 'PENDENTE', 'AGUARDANDO_CLIENTE'];
  const p = [];
  for (let i = 0; i < ids.length; i++) p.push(await req('/pendencias', 'POST', { clienteId: ids[i], competencia: '2026-11', status: status[i] }, 201));
  const filtrar = (painel: { pendencias: { cliente: { id: number } }[] }) => painel.pendencias.map(item => item.cliente.id).filter(id => ids.includes(id));
  assert.deepEqual(filtrar(await req('/painel?competencia=2026-11')), ids);
  await req(`/pendencias/${p[0].id}`, 'PATCH', { status: 'PENDENTE' });
  await req(`/pendencias/${p[1].id}`, 'PATCH', { status: 'CONCLUIDO' });
  assert.deepEqual(filtrar(await req('/painel?competencia=2026-11')), ids);
});

test('Painel: ordem manual vale em todos os meses e não altera históricos ou totais', async () => {
  const a = await cliente('manual A'), b = await cliente('manual B'), c = await cliente('manual C');
  const ids = [a.id, b.id, c.id];
  for (const mes of ['2026-11', '2026-12']) for (const id of ids) await req('/pendencias', 'POST', { clienteId: id, competencia: mes }, 201);
  const antes = await req('/painel?competencia=2026-11');
  const pendencia = antes.pendencias.find((p: { cliente: { id: number } }) => p.cliente.id === a.id);
  const historico = await req(`/pendencias/${pendencia.id}/historico`);
  const anterior: number[] = (await ler()).estado.ordemClientesPainel;
  const ordem = anterior.filter(id => id !== c.id); ordem.splice(ordem.indexOf(a.id), 0, c.id);
  const op = { tipo: 'ordenarPainel', ordem, anterior };
  const salvo = await alterar([op]);
  for (const mes of ['2026-11', '2026-12']) {
    const painel = await req('/painel?competencia=' + mes);
    assert.deepEqual(painel.pendencias.map((p: { cliente: { id: number } }) => p.cliente.id).filter((id: number) => ids.includes(id)), [c.id, a.id, b.id]);
  }
  assert.deepEqual((await req('/painel?competencia=2026-11')).totais, antes.totais);
  assert.deepEqual(await req(`/pendencias/${pendencia.id}/historico`), historico);
  assert.equal((await alterar([op])).revisao, salvo.revisao);
  await req(`/pendencias/${pendencia.id}`, 'PATCH', { status: 'CONCLUIDO' });
  assert.deepEqual((await ler()).estado.ordemClientesPainel, ordem);
});

test('Painel: ordem concorrente é recusada e ordens inválidas não retiram clientes', async () => {
  await cliente('ordem inválida A'); await cliente('ordem inválida B');
  const anterior: number[] = (await ler()).estado.ordemClientesPainel;
  const ordem = [...anterior].reverse();
  await alterar([{ tipo: 'ordenarPainel', ordem, anterior }]);
  const novo = await cliente('incluído por outro computador');
  const atual = await ler(); assert.ok(atual.estado.ordemClientesPainel.includes(novo.id));
  await alterar([{ tipo: 'ordenarPainel', ordem: anterior, anterior: ordem }], 409);
  const estavel = await ler();
  assert.deepEqual(estavel.estado.ordemClientesPainel, atual.estado.ordemClientesPainel);
  for (const invalida of [ordem.slice(1), [...estavel.estado.ordemClientesPainel, novo.id], ['1'], [2147483647]]) {
    await alterar([{ tipo: 'ordenarPainel', ordem: invalida, anterior: estavel.estado.ordemClientesPainel }], 400);
  }
  assert.deepEqual(await ler(), estavel);
});
