import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { prepararBancoDeTeste, urlDeTeste } from './helpers/banco.ts';
import { estadoVazio } from '../src/excel/estado.ts';

const url = urlDeTeste();
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
const pool = new Pool({ connectionString: url.toString() });
let server: Server;
let base: string;
let contagens: unknown;
const tag = `Codex Excel ficticio ${Date.now()}`;
const definir = (caminho: string[], valor: unknown, anterior: unknown) => ({ tipo: 'definir', caminho, valor, anterior });
async function requisitar(path: string, method = 'GET', data?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const body = await r.text(); assert.equal(r.status, status, body);
  return JSON.parse(body);
}
const ler = () => requisitar('/excel/estado');
const alterar = (alteracoes: unknown[], status = 200) => requisitar('/excel/estado', 'PATCH', { alteracoes }, status);
before(async () => {
  await prepararBancoDeTeste(pool);
  contagens = (await pool.query('SELECT (SELECT count(*) FROM "Cliente")::int clientes, (SELECT count(*) FROM "Pendencia")::int pendencias')).rows;
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  await prisma.$disconnect(); await pool.end();
});
test('Excel: estado compartilhado e revisão são lidos por sessões independentes', async () => {
  const inicial = await ler(); assert.equal(inicial.revisao, 0); assert.deepEqual(inicial.estado, estadoVazio());
  await Promise.all([
    alterar([definir(['informacoes', tag], 'Texto compartilhado', '')]),
    alterar([definir(['informacoes', `${tag} criação simultânea`], 'Segundo texto', '')]),
  ]);
  const salvo = await ler();
  assert.ok(salvo.instancia); assert.equal(salvo.revisao, 2);
  assert.equal((await ler()).estado.informacoesClientes[tag], 'Texto compartilhado');
  const inalterado = await requisitar(`/excel/estado?revisao=${salvo.revisao}&instancia=${salvo.instancia}`);
  assert.equal(inalterado.estado, null);
});
test('Excel: conflito não sobrescreve informação nem aplica parcialmente o restante do lote', async () => {
  await alterar([definir(['informacoes', tag], 'Versão atualizada', 'Texto compartilhado')]);
  const antes = await ler();
  const conflito = await alterar([definir(['nome', tag], 'Nome que não deve ser aplicado', tag), definir(['informacoes', tag], 'Versão atrasada', 'Texto compartilhado')], 409);
  assert.equal(conflito.estado.informacoesClientes[tag], 'Versão atualizada');
  const depois = await ler(); assert.deepEqual(depois, antes);
  assert.equal(depois.estado.nomesAlterados[tag], undefined);
  const repetido = await alterar([definir(['informacoes', tag], 'Versão atualizada', 'Texto compartilhado')]);
  assert.equal(repetido.revisao, antes.revisao);
});
test('Excel: gravações simultâneas em campos diferentes preservam ambas; no mesmo campo há conflito', async () => {
  const a = `${tag} concorrente A`, b = `${tag} concorrente B`;
  await Promise.all([alterar([definir(['informacoes', a], 'Texto A', '')]), alterar([definir(['informacoes', b], 'Texto B', '')])]);
  await Promise.all([alterar([definir(['registro', '2026-11', a, 'status'], 'OK', 'PENDENTE')]), alterar([definir(['registro', '2026-11', a, 'observacao'], 'Obs A', '')])]);
  const salvo = await ler(); assert.equal(salvo.estado.informacoesClientes[a], 'Texto A'); assert.equal(salvo.estado.informacoesClientes[b], 'Texto B');
  assert.deepEqual(salvo.estado.registros['2026-11'][a], { status: 'OK', observacao: 'Obs A' });
  const respostas = await Promise.all(['Texto C', 'Texto D'].map(valor => fetch(base + '/excel/estado', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alteracoes: [definir(['informacoes', a], valor, 'Texto A')] }) })));
  assert.deepEqual(respostas.map(r => r.status).sort(), [200, 409]);
});
test('Excel: importação traz todos os grupos sem sobrescrever conflitos e pode ser repetida', async () => {
  const nome = `${tag} importado`;
  const local = estadoVazio(); local.clientesExtras.push(nome); local.nomesAlterados[nome] = 'Nome importado';
  local.nomesBusca[nome] = ['Apelido importado']; local.informacoesClientes[nome] = 'Informação importada';
  local.informacoesClientes[tag] = 'Divergência local que deve ser mantida apenas na origem';
  local.registros['2026-10'] = { [nome]: { status: 'AGUARDANDO', observacao: 'Observação de outubro' } };
  local.avisosExtras.push({ id: `${tag}-aviso`, titulo: 'Aviso fictício', texto: 'Preservar aviso' });
  const resultado = await requisitar('/excel/importar', 'POST', { estado: local });
  assert.ok(resultado.importados >= 6); assert.equal(resultado.totalConflitos, 1);
  assert.equal(resultado.estado.informacoesClientes[tag], 'Versão atualizada');
  assert.equal(resultado.estado.registros['2026-10'][nome].observacao, 'Observação de outubro');
  assert.deepEqual(resultado.estado.nomesBusca[nome], ['Apelido importado']);
  const repetido = await requisitar('/excel/importar', 'POST', { estado: local });
  assert.equal(repetido.importados, 0); assert.equal(repetido.totalConflitos, 1); assert.equal(repetido.revisao, resultado.revisao);
});
test('Excel: validação recusa tipos, datas, campos extras e caminhos inseguros sem gravar', async () => {
  const antes = await ler();
  for (const op of [definir(['registro', '2026-99', tag, 'status'], 'OK', 'PENDENTE'), definir(['informacoes', '__proto__'], 'x', ''), definir(['informacoes', tag], 42, ''), definir(['registro', '2026-11', tag, 'status'], 'DESCONHECIDO', 'PENDENTE')]) await alterar([op], 400);
  await requisitar('/excel/estado', 'PATCH', { alteracoes: [], outro: true }, 400);
  await requisitar('/excel/importar', 'POST', { estado: { ...estadoVazio(), desconhecido: true } }, 400);
  assert.deepEqual(await ler(), antes);
});
test('Excel: cadastros centrais e dados legados anteriores à migração permanecem intactos', async () => {
  const depois = (await pool.query('SELECT (SELECT count(*) FROM "Cliente")::int clientes, (SELECT count(*) FROM "Pendencia")::int pendencias')).rows;
  assert.deepEqual(depois, contagens);
  const legado = await pool.query('SELECT observacao FROM "Pendencia" WHERE observacao=$1', ['Preservar pendência fictícia anterior à migration']);
  assert.equal(legado.rows.length, 1);
});

test('Excel: vínculo manual por ID preserva homônimos, meses, ficha e histórico ao trocar e desvincular', async () => {
  const nome = `${tag} linha vinculada`;
  const contaA = await requisitar('/contabilidades', 'POST', { nome: `${tag} firma A` }, 201);
  const contaB = await requisitar('/contabilidades', 'POST', { nome: `${tag} firma B` }, 201);
  const a = await requisitar('/clientes', 'POST', { nome: `${tag} homônimo`, contabilidadeId: contaA.id }, 201);
  const b = await requisitar('/clientes', 'POST', { nome: a.nome }, 201);
  await requisitar(`/clientes/${a.id}/ficha`, 'PATCH', { observacoesPermanentes: 'Preservar ficha', contabilidadeId: contaB.id, autor: 'Teste fictício' });
  await requisitar(`/clientes/${a.id}/procedimentos`, 'POST', { titulo: 'Preservar procedimento', descricao: 'Instrução fictícia' }, 201);
  const ficha = await requisitar(`/clientes/${a.id}/ficha`);
  assert.equal(ficha.historicoContabilidades.length, 1);
  await alterar([
    { tipo: 'incluirCliente', nome, apelidos: ['Apelido da linha'], informacoes: 'Preservar informações do Excel' },
    definir(['registro', '2026-10', nome, 'status'], 'OK', 'PENDENTE'),
    definir(['registro', '2026-11', nome, 'observacao'], 'Preservar mês seguinte', ''),
  ]);
  // Old stored JSON without the new field must remain readable, without a migration.
  const anterior = await ler();
  const { vinculosClientes: _vinculos, ...legado } = anterior.estado;
  await pool.query('UPDATE "ExcelCompartilhado" SET dados=$1::jsonb WHERE id=$2', [JSON.stringify(legado), 'principal']);
  assert.deepEqual(await ler(), anterior);
  const vinculado = await alterar([definir(['vinculo', nome], a.id, null)]);
  assert.equal(vinculado.estado.vinculosClientes[nome], a.id);
  const repetido = await alterar([definir(['vinculo', nome], a.id, null)]);
  assert.equal(repetido.revisao, vinculado.revisao);
  await alterar([definir(['nome', nome], 'Outro nome no Excel', nome)]);
  assert.equal((await ler()).estado.vinculosClientes[nome], a.id);
  await alterar([definir(['vinculo', nome], b.id, a.id)]);
  await alterar([definir(['vinculo', nome], null, b.id)]);
  const depois = (await ler()).estado;
  assert.equal(depois.vinculosClientes[nome], undefined);
  assert.deepEqual(depois.registros, anterior.estado.registros);
  assert.deepEqual(depois.informacoesClientes, anterior.estado.informacoesClientes);
  assert.deepEqual(depois.nomesBusca, anterior.estado.nomesBusca);
  assert.deepEqual(await requisitar(`/clientes/${a.id}/ficha`), ficha);
  assert.equal((await requisitar(`/clientes/${b.id}`)).id, b.id);
});

test('Excel: vínculos inválidos e importados são recusados sem aplicar parcialmente o lote', async () => {
  const nome = `${tag} vínculo inválido`;
  const cliente = await requisitar('/clientes', 'POST', { nome }, 201);
  const antes = await ler();
  for (const id of [0, -1, 1.2, '1', true, 2147483648, {}]) {
    await alterar([definir(['vinculo', nome], id, null)], 400);
  }
  await alterar([definir(['vinculo', '__proto__'], cliente.id, null)], 400);
  await alterar([definir(['nome', nome], 'Não aplicar este nome', nome), definir(['vinculo', nome], 2147483647, null)], 400);
  await requisitar('/excel/importar', 'POST', { estado: { ...estadoVazio(), vinculosClientes: { [nome]: cliente.id } } }, 400);
  assert.deepEqual(await ler(), antes);
  await alterar([definir(['vinculo', nome], cliente.id, null)]);
  const local = estadoVazio(); local.informacoesClientes[nome] = 'Importação legada sem vínculos';
  const importado = await requisitar('/excel/importar', 'POST', { estado: local });
  assert.equal(importado.estado.vinculosClientes[nome], cliente.id);
});

test('Excel: vínculo concorrente exige revisão e não associa a mesma linha a dois clientes', async () => {
  const nome = `${tag} vínculo concorrente`;
  const a = await requisitar('/clientes', 'POST', { nome: `${nome} A` }, 201);
  const b = await requisitar('/clientes', 'POST', { nome: `${nome} B` }, 201);
  const respostas = await Promise.all([a.id, b.id].map(id => fetch(base + '/excel/estado', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alteracoes: [definir(['vinculo', nome], id, null)] }) })));
  assert.deepEqual(respostas.map(r => r.status).sort(), [200, 409]);
  const salvo = (await ler()).estado.vinculosClientes[nome];
  assert.ok([a.id, b.id].includes(salvo));
  await alterar([definir(['vinculo', `${nome} outra linha`], a.id, null)]);
  assert.equal((await ler()).estado.vinculosClientes[nome], salvo);
});
