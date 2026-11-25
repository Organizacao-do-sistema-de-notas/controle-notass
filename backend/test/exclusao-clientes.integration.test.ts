import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { prepararBancoDeTeste, urlDeTeste } from './helpers/banco.ts';
import { estadoVazio } from '../src/excel/estado.ts';

const pool = new Pool({ connectionString: urlDeTeste().toString() });
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
const tag = `Codex exclusão fictícia ${Date.now()}`;
let server: Server, base: string;
async function req(path: string, method = 'GET', data?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const texto = await r.text(); assert.equal(r.status, status, texto);
  if (r.headers.get('content-type')?.includes('application/json')) return JSON.parse(texto);
  assert.ok(r.status >= 400, 'Respostas de sucesso devem ser JSON.');
  return {};
}
const cliente = (sufixo: string) => req('/clientes', 'POST', { nome: `${tag} ${sufixo}` }, 201);
const excluir = (c: { id: number; nome: string }) => req(`/clientes/${c.id}`, 'DELETE', { nomeConfirmado: c.nome });
const alterar = (alteracoes: unknown[], status = 200) => req('/excel/estado', 'PATCH', { alteracoes }, status);
const definir = (caminho: string[], valor: unknown, anterior: unknown) => ({ tipo: 'definir', caminho, valor, anterior });
const chave = (estado: { vinculosClientes: Record<string, number> }, id: number) => Object.keys(estado.vinculosClientes).find(k => estado.vinculosClientes[k] === id)!;
before(async () => {
  await prepararBancoDeTeste(pool);
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  if (server) await new Promise<void>(r => server.close(() => r()));
  await prisma.$disconnect(); await pool.end();
});

test('exclusão retira o mesmo ID das listas, do Excel, das fichas e de todos os meses do Painel, preservando os dados completos', async () => {
  const c = await cliente('com histórico');
  const firma = await req('/contabilidades', 'POST', { nome: `${tag} contabilidade` }, 201);
  await req(`/clientes/${c.id}/ficha`, 'PATCH', { contabilidadeId: firma.id, nomesAlternativos: ['Apelido fictício'], informacoesAdicionais: 'Instrução preservada', observacoesPermanentes: 'Nota permanente', modeloMensagem: 'Modelo preservado' });
  await req(`/clientes/${c.id}/procedimentos`, 'POST', { titulo: 'Passo fictício', descricao: 'Não apagar o procedimento' }, 201);
  const p = await req('/pendencias', 'POST', { clienteId: c.id, competencia: '2091-01', observacao: 'Histórico inicial' }, 201);
  await req('/pendencias', 'POST', { clienteId: c.id, competencia: '2091-02' }, 201);
  await req(`/pendencias/${p.id}`, 'PATCH', { status: 'EM_ATENDIMENTO' });
  await req(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: 'Mensagem preservada' });
  // A synthetic source identifier is also retained; no company database is used.
  await prisma.clienteConfere.create({ data: { codigo: `ficticio-excluir-${c.id}`, clienteId: c.id, dadosOrigem: { ficticio: true }, hashOrigem: 'ficticio' } });
  const inicial = (await req('/excel/estado')).estado, k = chave(inicial, c.id);
  await alterar([definir(['registro', '2091-01', k, 'observacao'], 'Observação mensal preservada', ''), { tipo: 'incluirAviso', aviso: { id: `${tag}-aviso`, titulo: 'Aviso preservado', texto: 'Não excluir o aviso' } }]);
  const excelAntes = await req('/excel/estado');
  const relacoes = { nomesAlternativos: true, procedimentos: true, historicoContabilidades: true, confere: true, pendencias: { include: { historico: true } } } as const;
  const antes = await prisma.cliente.findUniqueOrThrow({ where: { id: c.id }, include: relacoes });
  const resposta = await excluir(c);
  assert.equal(resposta.id, c.id); assert.equal(resposta.excluido, true);
  assert.ok(resposta.revisao > excelAntes.revisao);
  assert.ok(!Object.values(resposta.estado.vinculosClientes).includes(c.id));
  assert.deepEqual(resposta.estado.registros, excelAntes.estado.registros);
  assert.deepEqual(resposta.estado.avisosExtras, excelAntes.estado.avisosExtras);
  assert.ok(!(await req('/clientes')).some((item: { id: number }) => item.id === c.id));
  await req(`/clientes/${c.id}`, 'GET', undefined, 404);
  await req(`/clientes/${c.id}/ficha`, 'GET', undefined, 404);
  await req(`/pendencias/${p.id}`, 'GET', undefined, 404);
  assert.equal((await req(`/pendencias?clienteId=${c.id}`)).length, 0);
  for (const mes of ['2091-01', '2091-02']) assert.equal((await req(`/painel?competencia=${mes}`)).totais.total, 0);
  assert.ok(!(await req('/painel/competencias')).includes('2091-01'));
  const depois = await prisma.cliente.findUniqueOrThrow({ where: { id: c.id }, include: relacoes });
  assert.ok(depois.excluidoEm instanceof Date);
  assert.deepEqual({ ...depois, excluidoEm: null }, antes);
  assert.equal((await req('/contabilidades')).find((item: { id: number }) => item.id === firma.id)._count.clientes, 0);
});

test('exclusão valida ID e confirmação, rejeita nome antigo e não altera outro cliente homônimo', async () => {
  const c = await cliente('homônimo'), outro = await req('/clientes', 'POST', { nome: c.nome }, 201);
  for (const id of ['0', '-1', 'abc', '1.5', '2147483648']) await req(`/clientes/${id}`, 'DELETE', { nomeConfirmado: c.nome }, 400);
  for (const corpo of [undefined, null, [], {}, { nomeConfirmado: 1 }, { nomeConfirmado: '' }, { nomeConfirmado: c.nome, extra: true }]) {
    await req(`/clientes/${c.id}`, 'DELETE', corpo, 400);
  }
  await req('/clientes/2147483647', 'DELETE', { nomeConfirmado: c.nome }, 404);
  await req(`/clientes/${c.id}`, 'PATCH', { nome: `${c.nome} atualizado` });
  await req(`/clientes/${c.id}`, 'DELETE', { nomeConfirmado: c.nome }, 409);
  assert.equal((await prisma.cliente.findUniqueOrThrow({ where: { id: c.id } })).excluidoEm, null);
  await excluir({ ...c, nome: `${c.nome} atualizado` });
  assert.equal((await req(`/clientes/${outro.id}`)).nome, outro.nome);
});

test('repetir exclusão é idempotente e inativação permanece distinta de exclusão', async () => {
  const c = await cliente('inativo');
  await req(`/clientes/${c.id}`, 'PATCH', { ativo: false });
  assert.ok((await req('/clientes')).some((item: { id: number }) => item.id === c.id));
  await Promise.all([excluir(c), excluir(c)]);
  const primeira = await prisma.cliente.findUniqueOrThrow({ where: { id: c.id } });
  await excluir(c);
  const segunda = await prisma.cliente.findUniqueOrThrow({ where: { id: c.id } });
  assert.deepEqual(segunda.excluidoEm, primeira.excluidoEm);
  assert.equal(segunda.ativo, false);
});

test('cliente excluído rejeita edição, procedimentos, novas pendências e gravações atrasadas de status ou mensagem', async () => {
  const c = await cliente('edição atrasada');
  const proc = await req(`/clientes/${c.id}/procedimentos`, 'POST', { titulo: 'Título preservado', descricao: 'Descrição preservada' }, 201);
  const p = await req('/pendencias', 'POST', { clienteId: c.id, competencia: '2092-01' }, 201);
  await excluir(c);
  await req(`/clientes/${c.id}`, 'PATCH', { nome: 'Não reativar', ativo: true }, 404);
  await req(`/clientes/${c.id}/ficha`, 'PATCH', { informacoesAdicionais: 'Não gravar' }, 404);
  await req(`/clientes/${c.id}/procedimentos`, 'POST', { titulo: 'Não criar', descricao: 'Não criar' }, 404);
  await req(`/clientes/${c.id}/procedimentos/${proc.id}`, 'PATCH', { titulo: 'Não alterar' }, 404);
  await req('/pendencias', 'POST', { clienteId: c.id, competencia: '2092-02' }, 404);
  await req(`/pendencias/${p.id}`, 'PATCH', { status: 'CONCLUIDO' }, 404);
  await req(`/pendencias/${p.id}/mensagem`, 'PUT', { mensagem: 'Não gravar' }, 404);
  assert.equal((await prisma.procedimentoCliente.findUniqueOrThrow({ where: { id: proc.id } })).titulo, proc.titulo);
  const guardada = await prisma.pendencia.findUniqueOrThrow({ where: { id: p.id }, include: { historico: true } });
  assert.equal(guardada.status, 'PENDENTE'); assert.equal(guardada.mensagemContador, null); assert.equal(guardada.historico.length, 1);
});

test('linhas antigas excluídas não reaparecem por importação, requisição atrasada ou repetição de criação', async () => {
  const origem = `${tag} linha antiga`, local = estadoVazio();
  local.clientesExtras.push(origem); local.registros['2093-01'] = { [origem]: { status: 'OK', observacao: 'Texto antigo' } };
  await req('/excel/importar', 'POST', { estado: local });
  const c = (await req('/clientes')).find((item: { nome: string }) => item.nome === origem); assert.ok(c);
  await excluir(c);
  await alterar([definir(['registro', '2093-01', origem, 'observacao'], 'Não sobrescrever', 'Texto antigo')], 400);
  await alterar([{ tipo: 'incluirCliente', nome: origem, apelidos: [], informacoes: '' }], 400);
  await req('/excel/importar', 'POST', { estado: local }, 400);
  const op = { tipo: 'incluirCliente', idCriacao: `${tag}-uuid`, nome: `${tag} resposta perdida`, apelidos: [], informacoes: '' };
  await alterar([op]);
  const novo = (await req('/clientes')).find((item: { nome: string }) => item.nome === op.nome); assert.ok(novo);
  await excluir(novo); await alterar([op]);
  assert.equal(await prisma.cliente.count({ where: { nome: op.nome } }), 1);
  assert.ok(!(await req('/clientes')).some((item: { id: number }) => [c.id, novo.id].includes(item.id)));
  assert.equal((await req('/excel/estado')).estado.registros['2093-01'][origem].observacao, 'Texto antigo');
});

test('lote atrasado não aplica parcialmente e exclusão concorrente com edição não retira outro ID', async () => {
  const c = await cliente('concorrente'), outro = await cliente('preservado');
  const k = chave((await req('/excel/estado')).estado, c.id);
  const respostas = await Promise.all([
    excluir(c),
    fetch(`${base}/clientes/${c.id}/ficha`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observacoesPermanentes: 'Edição concorrente fictícia' }) }),
  ]);
  assert.ok([200, 404].includes(respostas[1].status)); await respostas[1].text();
  await alterar([{ tipo: 'incluirAviso', aviso: { id: `${tag}-nao-aplicar`, titulo: 'Não aplicar', texto: 'Lote interrompido' } }, definir(['nome', k], 'Não reativar', c.nome)], 400);
  const atual = (await req('/excel/estado')).estado;
  assert.ok(!atual.avisosExtras.some((a: { id: string }) => a.id === `${tag}-nao-aplicar`));
  assert.ok(!Object.values(atual.vinculosClientes).includes(c.id));
  assert.ok(Object.values(atual.vinculosClientes).includes(outro.id));
});

test('excluir um cadastro prioritário mantém as três posições fixas e sinaliza a exclusão', async () => {
  const mercados = ['Bom dia filial', 'Bom dia Matriz', 'Compre bem'];
  const criados = [];
  for (const nome of mercados) criados.push(await req('/clientes', 'POST', { nome }, 201));
  const antes = await req('/excel/estado');
  assert.deepEqual(Object.keys(antes.prioridades).sort(), [...mercados].sort());
  const depois = await excluir(criados[0]);
  assert.deepEqual(depois.prioridadesExcluidas, [mercados[0]]);
  assert.deepEqual(Object.keys(depois.prioridades).sort(), mercados.slice(1).sort());
  assert.ok((await req('/clientes')).some((c: { id: number }) => c.id === criados[1].id));
});
