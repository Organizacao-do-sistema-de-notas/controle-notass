import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { prepararBancoDeTeste, urlDeTeste } from './helpers/banco.ts';
const pool = new Pool({ connectionString: urlDeTeste().toString() });
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
let server: Server, base: string;
const tag = `Codex estado único ${Date.now()}`;
async function req(path: string, method = 'GET', data?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const texto = await r.text(); assert.equal(r.status, status, texto); return JSON.parse(texto);
}
const ler = () => req('/excel/estado');
const alterar = (alteracoes: unknown[], status = 200) => req('/excel/estado', 'PATCH', { alteracoes }, status);
const op = (id: number, valor: string, anterior: string, mes = '2026-11') => ({ tipo: 'definir', caminho: ['registro', mes, `cliente:${id}`, 'status'], valor, anterior });
const cliente = (sufixo: string) => req('/clientes', 'POST', { nome: `${tag} ${sufixo}` }, 201);
before(async () => {
  await prepararBancoDeTeste(pool); server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => { await pool.query('DELETE FROM "ExcelCompartilhado" WHERE id=$1', ['principal']); });
after(async () => { await new Promise<void>(r => server.close(() => r())); await prisma.$disconnect(); await pool.end(); });

test('estado único: os quatro estados trafegam nos dois sentidos por ID e competência; repetição não duplica histórico', async () => {
  const c = await cliente('quatro estados');
  await alterar([{ tipo: 'incluirClienteMes', clienteId: c.id, competencia: '2026-11' }]);
  const p = (await req('/painel?competencia=2026-11')).pendencias.find((p: { cliente: { id: number } }) => p.cliente.id === c.id);
  const pares = [['AGUARDANDO', 'AGUARDANDO_CLIENTE'], ['EM_ATENDIMENTO', 'EM_ATENDIMENTO'], ['OK', 'CONCLUIDO'], ['PENDENTE', 'PENDENTE']];
  let anterior = 'PENDENTE';
  for (const [excel, painel] of pares) {
    await alterar([op(c.id, excel, anterior)]);
    assert.equal((await req(`/pendencias/${p.id}`)).status, painel);
    const antes = await req(`/pendencias/${p.id}/historico`);
    await alterar([op(c.id, excel, anterior)]);
    assert.deepEqual(await req(`/pendencias/${p.id}/historico`), antes);
    anterior = excel;
  }
  for (const [excel, painel] of pares) {
    await req(`/pendencias/${p.id}`, 'PATCH', { status: painel, autor: 'Equipe Painel' });
    const salvo = await ler(); assert.equal(salvo.estado.registros['2026-11'][`cliente:${c.id}`].status, excel);
    assert.equal(salvo.estado.registros['2026-12']?.[`cliente:${c.id}`], undefined);
    const antes = await req(`/pendencias/${p.id}/historico`);
    await ler(); await ler(); assert.deepEqual(await req(`/pendencias/${p.id}/historico`), antes);
  }
});

test('estado único: a transição usa o estado do Painel e guarda uma cópia do JSON anterior sem alterar históricos ou mensagens', async () => {
  const c = await cliente('divergência antiga');
  const p = await req('/pendencias', 'POST', { clienteId: c.id, competencia: '2026-11', status: 'CONCLUIDO', observacao: 'Conservar nota do Painel', responsavel: 'Equipe antiga' }, 201);
  await req(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: 'Conservar mensagem' });
  await ler();
  const dados = (await pool.query('SELECT dados FROM "ExcelCompartilhado" WHERE id=$1', ['principal'])).rows[0].dados;
  dados.estado.registros['2026-11'][`cliente:${c.id}`] = { status: 'PENDENTE', observacao: 'Nota independente do Excel' };
  delete dados.registrosAntesUnificarEstado;
  await pool.query('UPDATE "ExcelCompartilhado" SET dados=$1::jsonb WHERE id=$2', [JSON.stringify(dados), 'principal']);
  const antes = await req(`/pendencias/${p.id}`), historico = await req(`/pendencias/${p.id}/historico`);
  const estado = (await ler()).estado;
  assert.deepEqual(estado.registros['2026-11'][`cliente:${c.id}`], { status: 'OK', observacao: 'Nota independente do Excel' });
  const salvo = (await pool.query('SELECT dados FROM "ExcelCompartilhado" WHERE id=$1', ['principal'])).rows[0].dados;
  assert.deepEqual(salvo.registrosAntesUnificarEstado, dados.estado.registros);
  assert.deepEqual(await req(`/pendencias/${p.id}`), antes);
  assert.deepEqual(await req(`/pendencias/${p.id}/historico`), historico);
});

test('estado único: uma tela Excel atrasada recebe conflito e o lote inteiro é revertido', async () => {
  const c = await cliente('conflito');
  await alterar([{ tipo: 'incluirClienteMes', clienteId: c.id, competencia: '2026-11' }]);
  const p = (await req('/painel?competencia=2026-11')).pendencias.find((p: { cliente: { id: number } }) => p.cliente.id === c.id);
  const revisao = (await ler()).revisao;
  await req(`/pendencias/${p.id}`, 'PATCH', { status: 'EM_ATENDIMENTO' });
  const resposta = await req(`/excel/estado?revisao=${revisao}&instancia=${(await ler()).instancia}`);
  assert.equal(resposta.estado.registros['2026-11'][`cliente:${c.id}`].status, 'EM_ATENDIMENTO');
  const historico = await req(`/pendencias/${p.id}/historico`);
  await alterar([{ tipo: 'definir', caminho: ['nome', `cliente:${c.id}`], anterior: c.nome, valor: 'Não aplicar' }, op(c.id, 'OK', 'PENDENTE')], 409);
  assert.equal((await req(`/clientes/${c.id}`)).nome, c.nome);
  assert.equal((await req(`/pendencias/${p.id}`)).status, 'EM_ATENDIMENTO');
  assert.deepEqual(await req(`/pendencias/${p.id}/historico`), historico);
});

test('estado único: mudanças concorrentes no Excel e Painel preservam uma sequência válida no histórico', async () => {
  const c = await cliente('concorrência');
  await alterar([{ tipo: 'incluirClienteMes', clienteId: c.id, competencia: '2026-11' }]);
  const p = (await req('/painel?competencia=2026-11')).pendencias.find((p: { cliente: { id: number } }) => p.cliente.id === c.id);
  const respostas = await Promise.all([
    fetch(base + '/excel/estado', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alteracoes: [op(c.id, 'OK', 'PENDENTE')] }) }),
    fetch(base + `/pendencias/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'EM_ATENDIMENTO' }) }),
  ]);
  assert.ok([200, 409].includes(respostas[0].status)); assert.equal(respostas[1].status, 200);
  const eventos = (await pool.query('SELECT "valorAnterior", "valorNovo" FROM "HistoricoPendencia" WHERE "pendenciaId"=$1 AND tipo=$2 ORDER BY "criadoEm", id', [p.id, 'STATUS'])).rows;
  assert.ok(eventos.length >= 1); assert.equal(eventos[0].valorAnterior, 'PENDENTE');
  for (let i = 1; i < eventos.length; i++) assert.equal(eventos[i].valorAnterior, eventos[i - 1].valorNovo);
  const atual = await req(`/pendencias/${p.id}`);
  const estados: Record<string, string> = { PENDENTE: 'PENDENTE', CONCLUIDO: 'OK', EM_ATENDIMENTO: 'EM_ATENDIMENTO', AGUARDANDO_CLIENTE: 'AGUARDANDO' };
  const esperado = estados[atual.status];
  assert.equal((await ler()).estado.registros['2026-11'][`cliente:${c.id}`].status, esperado);
});

test('estado único: alterar mês antigo preserva outros meses, nome, mensagem e mercados fixos', async () => {
  const c = await cliente('mês antigo');
  await alterar([op(c.id, 'OK', 'PENDENTE', '2020-01')]);
  const p = (await req('/painel?competencia=2020-01')).pendencias.find((p: { cliente: { id: number } }) => p.cliente.id === c.id);
  assert.equal(p.status, 'CONCLUIDO');
  assert.equal((await ler()).estado.registros['2026-11']?.[`cliente:${c.id}`], undefined);
  assert.deepEqual((await ler()).estado.controleMercados, {});
  assert.equal((await req(`/clientes/${c.id}`)).nome, c.nome);
});
