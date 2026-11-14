import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { urlDeTeste, prepararBancoDeTeste, totalMigracoes } from './helpers/banco.ts';

// Refuse other databases before loading the application or dotenv.
const url = urlDeTeste();
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
const pool = new Pool({ connectionString: url.toString() });
let server: Server;
let base: string;
let cliente: number;
let outroCliente: number;
let contA: number;
let contB: number;
let procedimento: number;
const tag = `Codex fictício ${Date.now()}`;

async function request(path: string, method = 'GET', body?: unknown, expected = 200) {
  const response = await fetch(base + path, {
    method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}
const ficha = () => request(`/clientes/${cliente}/ficha`);

before(async () => {
  await prepararBancoDeTeste(pool);
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
  contA = (await request('/contabilidades', 'POST', { nome: `${tag} A` }, 201)).id;
  contB = (await request('/contabilidades', 'POST', { nome: `${tag} B` }, 201)).id;
  cliente = (await request('/clientes', 'POST', { nome: tag, contabilidadeId: contA }, 201)).id;
  outroCliente = (await request('/clientes', 'POST', { nome: `${tag} outro` }, 201)).id;
});
after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  await prisma.$disconnect();
  await pool.end();
  // Keep synthetic data: never reset or delete an existing database.
});

test('migration preserva cliente e pendência legados', async () => {
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
  assert.equal(rows[0].n, totalMigracoes());
  const legacy = await pool.query(`SELECT c.nome, c."frequenciaAcesso", p.observacao FROM "Cliente" c JOIN "Pendencia" p ON p."clienteId"=c.id WHERE c.nome='Codex legado fictício'`);
  assert.equal(legacy.rows.length, 1);
  assert.equal(legacy.rows[0].frequenciaAcesso, 'NAO_DEFINIDA');
  assert.equal(legacy.rows[0].observacao, 'Preservar pendência fictícia anterior à migration');
});

test('ficha: leitura, aliases, atualização parcial, limpeza explícita e limites', async () => {
  assert.equal((await ficha()).frequenciaAcesso, 'NAO_DEFINIDA');
  let data = await request(`/clientes/${cliente}/ficha`, 'PATCH', {
    frequenciaAcesso: 'MENSAL', observacoesPermanentes: ' orientação ', modeloMensagem: ' mensagem ',
    nomesAlternativos: [' Apelido ', 'Apelido', 'Outro nome'],
  });
  assert.equal(data.observacoesPermanentes, 'orientação');
  assert.deepEqual(data.nomesAlternativos.map((n: {nome: string}) => n.nome), ['Apelido', 'Outro nome']);
  data = await request(`/clientes/${cliente}/ficha`, 'PATCH', { modeloMensagem: null });
  assert.equal(data.modeloMensagem, null);
  assert.equal(data.nomesAlternativos.length, 2);
  const listed = await request('/clientes');
  assert.equal(listed.find((c: {id: number}) => c.id === cliente).nomesAlternativos.length, 2);
  for (const body of [[], {}, { frequenciaAcesso: 'SEMANAL' }, { frequenciaAcesso: null },
    { nomesAlternativos: 'apelido' }, { nomesAlternativos: [42] }, { nomesAlternativos: [' '] },
    { nomesAlternativos: Array(31).fill('apelido') }, { nomesAlternativos: ['x'.repeat(201)] },
    { observacoesPermanentes: 2 }, { observacoesPermanentes: 'x'.repeat(20001) }]) {
    await request(`/clientes/${cliente}/ficha`, 'PATCH', body, 400);
  }
  assert.equal((await ficha()).observacoesPermanentes, 'orientação');
  data = await request(`/clientes/${cliente}/ficha`, 'PATCH', { nomesAlternativos: [], observacoesPermanentes: '' });
  assert.deepEqual(data.nomesAlternativos, []);
  assert.equal(data.observacoesPermanentes, null);
});

test('corpos ausentes ou arrays são rejeitados e não alteram o cliente', async () => {
  const before = await ficha();
  for (const [path, method] of [[`/clientes/${cliente}/ficha`, 'PATCH'], [`/clientes/${cliente}`, 'PATCH'], [`/clientes/${cliente}/procedimentos`, 'POST'], ['/clientes', 'POST']]) {
    await request(path, method, undefined, 400);
    await request(path, method, [], 400);
  }
  assert.deepEqual(await ficha(), before);
});

test('identificadores inválidos, fora de Int32 e clientes ausentes', async () => {
  for (const id of ['0', '-1', 'abc', '1.5', '2147483648', '9007199254740991']) {
    await request(`/clientes/${id}/ficha`, 'GET', undefined, 400);
    await request(`/clientes/${id}`, 'PATCH', { ativo: false }, 400);
  }
  await request('/clientes/2147483647/ficha', 'GET', undefined, 404);
  await request('/clientes/2147483647/ficha', 'PATCH', { frequenciaAcesso: 'EVENTUAL' }, 404);
});

test('procedimentos: criar, editar, desativar e reativar sem apagar', async () => {
  const path = `/clientes/${cliente}/procedimentos`;
  let data = await request(path, 'POST', { titulo: ' Conferência ', descricao: ' Passo 1 ' }, 201);
  procedimento = data.id;
  assert.equal(data.titulo, 'Conferência');
  const createdAt = data.criadoEm;
  data = await request(`${path}/${procedimento}`, 'PATCH', { descricao: 'Passo 2', ativo: false });
  assert.equal(data.ativo, false);
  assert.equal(data.criadoEm, createdAt);
  data = await request(`${path}/${procedimento}`, 'PATCH', { ativo: true });
  assert.equal(data.descricao, 'Passo 2');
  assert.equal(data.ativo, true);
  assert.ok((await ficha()).procedimentos.some((p: {id: number}) => p.id === procedimento));
  await request(`/clientes/${outroCliente}/procedimentos/${procedimento}`, 'PATCH', { ativo: false }, 404);
  for (const body of [{}, { titulo: '' }, { titulo: 't', descricao: 2 }, { titulo: 'x'.repeat(201), descricao: 'd' }]) {
    await request(path, 'POST', body, 400);
  }
  for (const body of [{}, { ativo: 'false' }, { titulo: ' ' }, { descricao: 'x'.repeat(20001) }]) {
    await request(`${path}/${procedimento}`, 'PATCH', body, 400);
  }
  await request('/clientes/2147483647/procedimentos', 'POST', { titulo: 't', descricao: 'd' }, 404);
});

test('contabilidade: snapshots, mesmo vínculo, desvinculação e entradas inválidas', async () => {
  const path = `/clientes/${cliente}`;
  await request(path, 'PATCH', { contabilidadeId: contB, autor: ' Codex ' });
  let data = await ficha();
  assert.equal(data.historicoContabilidades.length, 1);
  assert.equal(data.historicoContabilidades[0].nomeAnterior, `${tag} A`);
  assert.equal(data.historicoContabilidades[0].nomeNova, `${tag} B`);
  assert.equal(data.historicoContabilidades[0].autor, 'Codex');
  await request(path, 'PATCH', { contabilidadeId: contB });
  assert.equal((await ficha()).historicoContabilidades.length, 1);
  await request(`/contabilidades/${contA}`, 'PATCH', { nome: `${tag} A renomeada` });
  assert.equal((await ficha()).historicoContabilidades[0].nomeAnterior, `${tag} A`);
  await request(path, 'PATCH', { contabilidadeId: null });
  data = await ficha();
  assert.equal(data.historicoContabilidades.length, 2);
  assert.equal(data.historicoContabilidades[0].nomeNova, null);
  for (const body of [{ contabilidadeId: '1' }, { contabilidadeId: -1 }, { contabilidadeId: 2147483648 }, { autor: 5, contabilidadeId: contA }]) {
    await request(path, 'PATCH', body, 400);
  }
  await request(path, 'PATCH', { contabilidadeId: 2147483647 }, 404);
  assert.equal((await ficha()).contabilidadeId, null);
});

test('salvamento da ficha e contabilidade é atômico, inclusive se o vínculo for inválido', async () => {
  const before = await ficha();
  await request(`/clientes/${cliente}/ficha`, 'PATCH', {
    observacoesPermanentes: 'Não deve ser gravada', nomesAlternativos: ['Não gravar'], contabilidadeId: 2147483647,
  }, 404);
  assert.deepEqual(await ficha(), before);
  const data = await request(`/clientes/${cliente}/ficha`, 'PATCH', {
    observacoesPermanentes: 'Atualização atômica', contabilidadeId: contA, autor: 'Teste atômico',
  });
  assert.equal(data.contabilidadeId, contA);
  assert.equal(data.historicoContabilidades[0].autor, 'Teste atômico');
});

test('trocas concorrentes preservam a sequência real do histórico', async () => {
  await request(`/clientes/${cliente}`, 'PATCH', { contabilidadeId: contA });
  const before = (await ficha()).historicoContabilidades.length;
  await Promise.all(Array.from({ length: 6 }, (_, i) => request(`/clientes/${cliente}${i % 2 ? '/ficha' : ''}`, 'PATCH', { contabilidadeId: contB })));
  const data = await ficha();
  assert.equal(data.historicoContabilidades.length, before + 1);
  await Promise.all([contA, null, contB].map(contabilidadeId => request(`/clientes/${cliente}/ficha`, 'PATCH', { contabilidadeId })));
  const after = await ficha();
  const novos = after.historicoContabilidades.slice(0, after.historicoContabilidades.length - data.historicoContabilidades.length).reverse();
  let anterior = data.contabilidade?.nome ?? null;
  for (const evento of novos) {
    assert.equal(evento.nomeAnterior, anterior);
    anterior = evento.nomeNova;
  }
  assert.equal(anterior, after.contabilidade?.nome ?? null);
});

test('alterações de ficha e contabilidade preservam pendências e seu histórico', async () => {
  const pendencia = await request('/pendencias', 'POST', { clienteId: cliente, competencia: '2026-11', status: 'PENDENTE', autor: 'Codex' }, 201);
  await request(`/pendencias/${pendencia.id}`, 'PATCH', { status: 'CONCLUIDO', autor: 'Codex' });
  const before = await request(`/pendencias/${pendencia.id}/historico`);
  assert.ok(before.length >= 2);
  await request(`/clientes/${cliente}/ficha`, 'PATCH', { frequenciaAcesso: 'EVENTUAL', contabilidadeId: null, nomesAlternativos: ['Histórico preservado'] });
  assert.deepEqual(await request(`/pendencias/${pendencia.id}/historico`), before);
  assert.equal((await request(`/pendencias/${pendencia.id}`)).status, 'CONCLUIDO');
});

test('rotas básicas de Painel e pendências seguem funcionando', async () => {
  await request('/');
  await request('/painel/competencias');
  const painel = await request('/painel?competencia=2026-11');
  assert.ok(painel.pendencias.some((p: {cliente: {nome: string}}) => p.cliente.nome === 'Codex legado fictício'));
  await request('/painel?competencia=invalida', 'GET', undefined, 400);
  await request('/pendencias');
});
