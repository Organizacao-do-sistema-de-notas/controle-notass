import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { prepararBancoDeTeste, urlDeTeste } from './helpers/banco.ts';
import { estadoVazio, mercadosFixos } from '../src/excel/estado.ts';

const pool = new Pool({ connectionString: urlDeTeste().toString() });
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
let servidor: Server, base: string;
const tag = `Codex mercados e inclusão ${Date.now()}`;
async function req(path: string, method = 'GET', data?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const texto = await r.text(); assert.equal(r.status, status, texto); return JSON.parse(texto);
}
const ler = () => req('/excel/estado');
const alterar = (alteracoes: unknown[], status = 200) => req('/excel/estado', 'PATCH', { alteracoes }, status);
const cliente = (nome: string) => req('/clientes', 'POST', { nome }, 201);
const incluir = (id: number, competencia = '2026-11') => ({ tipo: 'incluirClienteMes', clienteId: id, competencia });
const mercado = (nome = 'Bom dia filial', status = 'CONCLUIDO', anterior = 'PENDENTE', competencia = '2026-11') => ({ tipo: 'definirMercado', mercado: nome, status, anterior, competencia });
const painel = (competencia = '2026-11') => req('/painel?competencia=' + competencia);
async function gravarBase(dados: unknown) { await pool.query('UPDATE "ExcelCompartilhado" SET dados=$1::jsonb WHERE id=$2', [JSON.stringify(dados), 'principal']); }
async function baseSalva() { return (await pool.query('SELECT dados FROM "ExcelCompartilhado" WHERE id=$1', ['principal'])).rows[0].dados; }
before(async () => {
  await prepararBancoDeTeste(pool);
  servidor = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => servidor.once('listening', resolve));
  const endereco = servidor.address(); assert.ok(endereco && typeof endereco !== 'string'); base = `http://127.0.0.1:${endereco.port}`;
});
beforeEach(async () => { await pool.query('DELETE FROM "ExcelCompartilhado" WHERE id=$1', ['principal']); });
after(async () => { if (servidor) await new Promise<void>(resolve => servidor.close(() => resolve())); await prisma.$disconnect(); await pool.end(); });

test('mercados independentes: alternar nos três controles não cria clientes, registros comuns nem pendências', async () => {
  const antes = await ler();
  const contagens = (await pool.query('SELECT (SELECT count(*) FROM "Cliente") AS clientes, (SELECT count(*) FROM "Pendencia") AS pendencias')).rows;
  for (const nome of mercadosFixos) await alterar([mercado(nome)]);
  const salvo = await ler();
  for (const nome of mercadosFixos) assert.equal(salvo.estado.controleMercados['2026-11'][nome], 'CONCLUIDO');
  assert.equal(salvo.estado.controleMercados['2026-12'], undefined);
  assert.deepEqual(salvo.estado.registros, antes.estado.registros);
  assert.deepEqual(salvo.estado.vinculosClientes, antes.estado.vinculosClientes);
  assert.deepEqual((await pool.query('SELECT (SELECT count(*) FROM "Cliente") AS clientes, (SELECT count(*) FROM "Pendencia") AS pendencias')).rows, contagens);
  const repetido = await alterar([mercado()]); assert.equal(repetido.revisao, salvo.revisao);
  await alterar([mercado('Bom dia filial', 'PENDENTE', 'CONCLUIDO')]);
  assert.equal((await ler()).estado.controleMercados['2026-11']['Bom dia filial'], 'PENDENTE');
});

test('mercados: requisições antigas e importação local não recriam cadastros ou linhas comuns', async () => {
  const antes = await ler(), quantidade = (await req('/clientes')).length;
  await alterar([{ tipo: 'definir', caminho: ['registro', '2026-11', 'Bom dia filial', 'status'], anterior: 'PENDENTE', valor: 'OK' }]);
  const local = estadoVazio();
  local.registros['2026-10'] = { 'Compre bem': { status: 'OK', observacao: '' } };
  const importado = await req('/excel/importar', 'POST', { estado: local });
  assert.equal(importado.estado.controleMercados['2026-10']['Compre bem'], 'CONCLUIDO');
  assert.equal(importado.estado.controleMercados['2026-11']['Bom dia filial'], 'CONCLUIDO');
  assert.equal((await req('/clientes')).length, quantidade);
  assert.deepEqual(importado.estado.registros, antes.estado.registros);
  assert.equal((await req('/excel/importar', 'POST', { estado: local })).importados, 0);
});

test('estado legado sem cadastros de mercados migra diretamente para o controle fixo, mantendo uma cópia dos dados originais', async () => {
  const local = estadoVazio();
  local.registros['2026-09'] = { 'Bom dia filial': { status: 'OK', observacao: 'Anotação antiga preservada' } };
  await ler();
  const quantidade = (await pool.query('SELECT count(*) AS n FROM "Cliente"')).rows[0].n;
  await gravarBase(local);
  const convertido = await ler();
  assert.equal(convertido.estado.controleMercados['2026-09']['Bom dia filial'], 'CONCLUIDO');
  assert.deepEqual(convertido.estado.registros['2026-09']['Bom dia filial'], local.registros['2026-09']['Bom dia filial']);
  assert.deepEqual((await baseSalva()).legado, local);
  assert.equal((await pool.query('SELECT count(*) AS n FROM "Cliente"')).rows[0].n, quantidade);
});

test('mercados já criados pelo erro saem das listas, preservando cadastro, registros, estado mensal e histórico; homônimos normais permanecem', async () => {
  const artefatos = [];
  for (const nome of mercadosFixos) artefatos.push(await cliente(nome));
  const normal = await cliente('Bom dia filial');
  const p = await req('/pendencias', 'POST', { clienteId: artefatos[0].id, competencia: '2026-11', status: 'CONCLUIDO', observacao: 'Histórico anterior preservado' }, 201);
  const historico = await req(`/pendencias/${p.id}/historico`);
  await ler(); const dados = await baseSalva(); delete dados.controleMercadosSeparado;
  for (let i = 0; i < mercadosFixos.length; i++) {
    const nome = mercadosFixos[i], id = artefatos[i].id;
    delete dados.estado.vinculosClientes[`cliente:${id}`];
    dados.estado.vinculosClientes[nome] = id; dados.origens[nome] = id; dados.prioridades[nome] = id;
    (dados.estado.registros['2026-11'] ??= {})[nome] = { status: 'OK', observacao: `Registro original ${nome}` };
    (dados.estado.registros['2026-12'] ??= {})[nome] = { status: 'PENDENTE', observacao: '' };
  }
  const registros = structuredClone(dados.estado.registros);
  await gravarBase(dados);
  const estado = (await ler()).estado, ids = artefatos.map(c => c.id);
  for (const nome of mercadosFixos) {
    assert.equal(estado.controleMercados['2026-11'][nome], 'CONCLUIDO');
    assert.equal(estado.controleMercados['2026-12'][nome], 'PENDENTE');
  }
  assert.deepEqual(estado.registros, registros);
  assert.deepEqual(estado.clientesSomenteMercados, ids);
  assert.ok(!Object.values(estado.vinculosClientes).some(id => ids.includes(id)));
  assert.ok(Object.values(estado.vinculosClientes).includes(normal.id));
  assert.ok(!(await req('/clientes')).some((c: { id: number }) => ids.includes(c.id)));
  assert.ok(!(await painel()).pendencias.some((p: { cliente: { id: number } }) => ids.includes(p.cliente.id)));
  for (const c of artefatos) assert.equal((await req(`/clientes/${c.id}`)).excluidoEm, null);
  assert.deepEqual(await req(`/pendencias/${p.id}/historico`), historico);
  await alterar([{ tipo: 'definir', caminho: ['registro', '2026-11', `cliente:${artefatos[0].id}`, 'status'], anterior: 'OK', valor: 'PENDENTE' }]);
  assert.deepEqual((await ler()).estado.registros, registros);
  await alterar([incluir(artefatos[0].id)], 400);
});

test('incluir no Excel cria exatamente uma pendência no Painel do mesmo mês, inclusive com repetições simultâneas', async () => {
  const c = await cliente(`${tag} inclusão simultânea`);
  await Promise.all(Array.from({ length: 5 }, () => alterar([incluir(c.id)])));
  const itens = (await painel()).pendencias.filter((p: { cliente: { id: number } }) => p.cliente.id === c.id);
  assert.equal(itens.length, 1); assert.equal(itens[0].status, 'PENDENTE');
  const historico = await req(`/pendencias/${itens[0].id}/historico`);
  assert.equal(historico.length, 1); assert.equal(historico[0].tipo, 'CRIACAO');
  assert.equal((await painel('2026-12')).pendencias.some((p: { cliente: { id: number } }) => p.cliente.id === c.id), false);
  const salvo = await ler(); await alterar([incluir(c.id)]);
  assert.equal((await ler()).revisao, salvo.revisao);
  assert.deepEqual(await req(`/pendencias/${itens[0].id}/historico`), historico);
});

test('inclusões antigas incompletas são reparadas ao abrir o Painel, respeitando os quatro estados e as observações', async () => {
  const clientes = [];
  for (const sufixo of ['pendente', 'aguardando', 'atendimento', 'ok']) clientes.push(await cliente(`${tag} reparação ${sufixo}`));
  await ler(); const dados = await baseSalva();
  const estados = ['PENDENTE', 'AGUARDANDO', 'EM_ATENDIMENTO', 'OK'];
  Object.assign(dados.estado.registros['2026-10'] ??= {}, Object.fromEntries(clientes.map((c, i) => [`cliente:${c.id}`, { status: estados[i], observacao: `Nota original ${i}` }])));
  await gravarBase(dados);
  const itens = (await painel('2026-10')).pendencias;
  const esperados = ['PENDENTE', 'AGUARDANDO_CLIENTE', 'EM_ATENDIMENTO', 'CONCLUIDO'];
  for (let i = 0; i < clientes.length; i++) {
    const p = itens.find((p: { cliente: { id: number } }) => p.cliente.id === clientes[i].id);
    assert.equal(p.status, esperados[i]); assert.equal(p.observacao, `Nota original ${i}`);
    assert.equal(!!p.concluidoEm, i === 3);
    assert.equal((await req(`/pendencias/${p.id}/historico`)).length, 2);
  }
  assert.deepEqual((await ler()).estado.registros, dados.estado.registros);
});

test('inclusão com pendência existente preserva estado, mensagem, responsável e histórico; lote inválido não cria pendência parcial', async () => {
  const c = await cliente(`${tag} pendência anterior`);
  const p = await req('/pendencias', 'POST', { clienteId: c.id, competencia: '2026-11', status: 'CONCLUIDO', responsavel: 'Equipe fictícia', observacao: 'Conservar' }, 201);
  await req(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: 'Mensagem anterior preservada', autor: 'Equipe fictícia' });
  const antes = await req(`/pendencias/${p.id}`), historico = await req(`/pendencias/${p.id}/historico`);
  await alterar([incluir(c.id)]);
  assert.deepEqual(await req(`/pendencias/${p.id}`), antes);
  assert.deepEqual(await req(`/pendencias/${p.id}/historico`), historico);
  assert.deepEqual((await ler()).estado.registros['2026-11'][`cliente:${c.id}`], { status: 'OK', observacao: 'Conservar' });
  await alterar([incluir(c.id, '2026-12'), incluir(2147483647, '2026-12')], 400);
  assert.equal((await painel('2026-12')).pendencias.some((p: { cliente: { id: number } }) => p.cliente.id === c.id), false);
  assert.equal((await ler()).estado.registros['2026-12']?.[`cliente:${c.id}`], undefined);
});

test('mercados: validação e conflito não aplicam parcialmente outras alterações', async () => {
  await ler();
  const c = await cliente(`${tag} validação mercado`);
  const antes = await ler();
  for (const op of [mercado('Outro mercado'), mercado('Bom dia filial', 'OK'), mercado('Bom dia filial', 'CONCLUIDO', 'PENDENTE', '2026-13')]) await alterar([op], 400);
  await alterar([{ tipo: 'definir', caminho: ['nome', `cliente:${c.id}`], anterior: c.nome, valor: 'Não aplicar' }, mercado('Bom dia filial', 'CONCLUIDO', 'CONCLUIDO')], 409);
  assert.deepEqual(await ler(), antes);
});
