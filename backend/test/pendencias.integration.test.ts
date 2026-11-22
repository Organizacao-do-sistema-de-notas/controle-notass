import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { setTimeout } from 'node:timers/promises';
import { Pool } from 'pg';
import { prepararBancoDeTeste, urlDeTeste } from './helpers/banco.ts';

// Check the disposable local target before importing the app or loading dotenv.
const url = urlDeTeste();
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
const pool = new Pool({ connectionString: url.toString() });
let server: Server;
let base: string;
let cliente: number;

async function raw(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(base + path, {
    method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: response.headers.get('content-type')?.includes('application/json') ? JSON.parse(text) : text };
}
async function request(path: string, method = 'GET', body?: unknown, status = 200) {
  const response = await raw(path, method, body);
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(response.body)}`);
  return response.body;
}
const criar = (competencia: string) => request('/pendencias', 'POST', { clienteId: cliente, competencia }, 201);

// Hold only a synthetic row so both HTTP requests are genuinely waiting on the
// database before releasing them. This reproduces stale reads deterministically.
async function simultaneas(id: number, tarefas: Array<() => Promise<unknown>>) {
  const bloqueio = await pool.connect();
  await bloqueio.query('BEGIN');
  await bloqueio.query('SELECT id FROM "Pendencia" WHERE id=$1 FOR UPDATE', [id]);
  const chamadas = tarefas.map(tarefa => tarefa());
  const resultados = Promise.allSettled(chamadas);
  let erro: unknown;
  try {
    let prontas = false;
    for (let i = 0; i < 100; i++) {
      const { rows } = await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND state='active' AND wait_event_type='Lock' AND query LIKE '%Pendencia%'");
      if (rows[0].n >= tarefas.length) { prontas = true; break; }
      await setTimeout(20);
    }
    assert.ok(prontas, 'As gravacoes precisam estar esperando o bloqueio no banco de teste.');
  } catch (e) { erro = e; }
  finally { await bloqueio.query('ROLLBACK'); bloqueio.release(); }
  const respostas = await resultados;
  if (erro) throw erro;
  for (const resposta of respostas) if (resposta.status === 'rejected') throw resposta.reason;
}

before(async () => {
  await prepararBancoDeTeste(pool);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
  cliente = (await request('/clientes', 'POST', { nome: `Codex Painel ficticio ${Date.now()}` }, 201)).id;
});
after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  await prisma.$disconnect(); await pool.end();
});

test('Painel: IDs fora de Int32 e corpos invalidos sao recusados sem modificar dados', async () => {
  const p = await criar('2027-01');
  const anterior = await request(`/pendencias/${p.id}`);
  for (const id of ['0', '-1', 'abc', '1.5', '1e3', '2147483648', '9007199254740991']) {
    for (const [path, method, body] of [
      [`/pendencias/${id}`, 'GET', undefined],
      [`/pendencias/${id}/historico`, 'GET', undefined],
      [`/pendencias/${id}/mensagem`, 'GET', undefined],
      [`/pendencias/${id}`, 'PATCH', { status: 'CONCLUIDO' }],
      [`/pendencias/${id}/mensagem`, 'PUT', { mensagem: 'Texto ficticio' }],
      [`/pendencias?clienteId=${id}`, 'GET', undefined],
    ] as const) await request(path, method, body, 400);
  }
  for (const body of [undefined, null, [], {}]) {
    await request('/pendencias', 'POST', body, 400);
    await request(`/pendencias/${p.id}`, 'PATCH', body, 400);
    await request(`/pendencias/${p.id}/mensagem`, 'PUT', body, 400);
  }
  await request('/pendencias', 'POST', { clienteId: 2147483648, competencia: '2027-01' }, 400);
  await request('/pendencias/2147483647', 'GET', undefined, 404);
  await request('/pendencias/2147483647', 'PATCH', { status: 'CONCLUIDO' }, 404);
  await request('/pendencias/2147483647/mensagem', 'PUT', { mensagem: 'Texto ficticio' }, 404);
  assert.deepEqual(await request(`/pendencias/${p.id}`), anterior);
});

test('Painel: criacao simultanea retorna uma pendencia e conflitos 409 com o mesmo ID', async () => {
  const respostas = await Promise.all(Array.from({ length: 4 }, () => raw('/pendencias', 'POST', {
    clienteId: cliente, competencia: '2027-02', observacao: 'Criacao ficticia unica',
  })));
  assert.equal(respostas.filter(r => r.status === 201).length, 1);
  assert.equal(respostas.filter(r => r.status === 409).length, 3);
  const id = respostas.find(r => r.status === 201)!.body.id;
  for (const r of respostas.filter(r => r.status === 409)) assert.equal(r.body.pendenciaId, id);
  const historico = await request(`/pendencias/${id}/historico`);
  assert.equal(historico.filter((h: { tipo: string }) => h.tipo === 'CRIACAO').length, 1);
});

test('Painel: mesmo status simultaneo gera somente um evento e preserva a conclusao', async () => {
  const p = await criar('2027-03');
  await simultaneas(p.id, Array.from({ length: 2 }, () => () => request(`/pendencias/${p.id}`, 'PATCH', { status: 'CONCLUIDO', autor: 'Codex ficticio' })));
  let atual = await request(`/pendencias/${p.id}`);
  assert.equal(atual.historico.filter((h: { tipo: string }) => h.tipo === 'STATUS').length, 1);
  assert.equal(atual.status, 'CONCLUIDO'); assert.ok(atual.concluidoEm);
  const dataConclusao = atual.concluidoEm;
  atual = await request(`/pendencias/${p.id}`, 'PATCH', { status: 'CONCLUIDO' });
  assert.equal(atual.concluidoEm, dataConclusao);
  assert.equal(atual.historico.filter((h: { tipo: string }) => h.tipo === 'STATUS').length, 1);
  atual = await request(`/pendencias/${p.id}`, 'PATCH', { status: 'PENDENTE' });
  assert.equal(atual.concluidoEm, null);
});

test('Painel: mudancas simultaneas mantem a sequencia real do historico e os outros campos', async () => {
  const p = await criar('2027-04');
  await simultaneas(p.id, [
    () => request(`/pendencias/${p.id}`, 'PATCH', { status: 'EM_ATENDIMENTO', observacao: 'Observacao ficticia' }),
    () => request(`/pendencias/${p.id}`, 'PATCH', { status: 'AGUARDANDO_CLIENTE', responsavel: 'Tecnico ficticio' }),
  ]);
  const atual = await request(`/pendencias/${p.id}`);
  const { rows } = await pool.query('SELECT "valorAnterior", "valorNovo" FROM "HistoricoPendencia" WHERE "pendenciaId"=$1 AND tipo=$2 ORDER BY "criadoEm", id', [p.id, 'STATUS']);
  assert.equal(rows.length, 2); assert.equal(rows[0].valorAnterior, 'PENDENTE');
  assert.equal(rows[1].valorAnterior, rows[0].valorNovo); assert.equal(atual.status, rows[1].valorNovo);
  assert.equal(atual.observacao, 'Observacao ficticia'); assert.equal(atual.responsavel, 'Tecnico ficticio');
  const lista = await request(`/pendencias/${p.id}/historico`);
  assert.deepEqual(lista.map((h: { id: number }) => h.id), atual.historico.map((h: { id: number }) => h.id));
});

test('Painel: mensagens simultaneas registram a versao anterior correta e repeticoes nao duplicam', async () => {
  const p = await criar('2027-05');
  await simultaneas(p.id, [
    () => request(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: 'Mensagem A', autor: 'Tecnico A' }),
    () => request(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: 'Mensagem B', autor: 'Tecnico B' }),
  ]);
  const { rows } = await pool.query('SELECT "valorAnterior", "valorNovo" FROM "HistoricoPendencia" WHERE "pendenciaId"=$1 AND tipo=$2 ORDER BY "criadoEm", id', [p.id, 'MENSAGEM_CONTADOR']);
  assert.equal(rows.length, 2); assert.equal(rows[0].valorAnterior, null);
  assert.equal(rows[1].valorAnterior, rows[0].valorNovo);
  await simultaneas(p.id, Array.from({ length: 2 }, () => () => request(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: 'Mensagem comum' })));
  const historico = await request(`/pendencias/${p.id}/historico`);
  assert.equal(historico.filter((h: { tipo: string }) => h.tipo === 'MENSAGEM_CONTADOR').length, 3);
  const msg = await request(`/pendencias/${p.id}/mensagem`);
  assert.equal(msg.mensagem, 'Mensagem comum'); assert.equal(msg.temMensagem, true);
  assert.equal(msg.linkWhatsApp, 'https://wa.me/?text=' + encodeURIComponent('Mensagem comum'));
});

test('Painel: mensagem normalizada, limpeza e erros preservam status e historico existente', async () => {
  const p = await criar('2027-06');
  await request(`/pendencias/${p.id}`, 'PATCH', { status: 'CONCLUIDO', responsavel: 'Pessoa ficticia', observacao: 'Manter anotacao' });
  let msg = await request(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: ' Linha 1  \r\nLinha 2  ', autor: ' Teste ' });
  assert.equal(msg.mensagem, 'Linha 1\nLinha 2');
  const anterior = await request(`/pendencias/${p.id}`);
  for (const body of [{ status: 'OK' }, { responsavel: 42 }, { observacao: [] }, { autor: {} }]) {
    await request(`/pendencias/${p.id}`, 'PATCH', body, 400);
  }
  for (const body of [{ mensagem: 42 }, { mensagem: {} }, { mensagem: 'outra', autor: [] }]) {
    await request(`/pendencias/${p.id}/mensagem`, 'PUT', body, 400);
  }
  assert.deepEqual(await request(`/pendencias/${p.id}`), anterior);
  msg = await request(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: '  ' });
  assert.equal(msg.mensagem, null); assert.equal(msg.temMensagem, false); assert.equal(msg.linkWhatsApp, null);
  await request(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: null });
  const atual = await request(`/pendencias/${p.id}`);
  assert.equal(atual.status, 'CONCLUIDO'); assert.equal(atual.concluidoEm, anterior.concluidoEm);
  assert.equal(atual.observacao, 'Manter anotacao'); assert.equal(atual.responsavel, 'Pessoa ficticia');
  assert.equal(atual.historico.length, anterior.historico.length + 1);
});
