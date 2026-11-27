import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import { prepararBancoDeTeste, urlDeTeste } from './helpers/banco.ts';
import { estadoVazio } from '../src/excel/estado.ts';

const pool = new Pool({ connectionString: urlDeTeste().toString() });
const { app } = await import('../src/app.ts');
const { prisma } = await import('../src/lib/prisma.ts');
let server: Server, base: string;
const tag = `Codex cadastro único fictício ${Date.now()}`;
async function req(path: string, method = 'GET', data?: unknown, status = 200) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: data === undefined ? undefined : JSON.stringify(data) });
  const body = await r.text(); assert.equal(r.status, status, body); return JSON.parse(body);
}
const definir = (caminho: string[], valor: unknown, anterior: unknown) => ({ tipo: 'definir', caminho, valor, anterior });
const alterar = (alteracoes: unknown[], status = 200) => req('/excel/estado', 'PATCH', { alteracoes }, status);
const ler = () => req('/excel/estado');
const cliente = (sufixo: string) => req('/clientes', 'POST', { nome: `${tag} ${sufixo}` }, 201);
const chave = (estado: { vinculosClientes: Record<string, number> }, id: number) => Object.keys(estado.vinculosClientes).find(k => estado.vinculosClientes[k] === id)!;
before(async () => {
  await prepararBancoDeTeste(pool);
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string'); base = `http://127.0.0.1:${address.port}`;
});
beforeEach(async () => { await pool.query('DELETE FROM "ExcelCompartilhado" WHERE id=$1', ['principal']); });
after(async () => { if (server) await new Promise<void>(r => server.close(() => r())); await prisma.$disconnect(); await pool.end(); });

test('lista mensal: frequência da ficha é compartilhada e incluir um ID não cria outro cadastro nem replica meses', async () => {
  const a = await cliente('acesso eventual'), mensal = await cliente('acesso mensal'), indefinido = await cliente('frequência não definida');
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { frequenciaAcesso: 'EVENTUAL', nomesAlternativos: ['Apelido eventual'], informacoesAdicionais: 'Preservar informação' });
  await req(`/clientes/${mensal.id}/ficha`, 'PATCH', { frequenciaAcesso: 'MENSAL' });
  const antes = await ler(), k = chave(antes.estado, a.id);
  assert.equal(antes.estado.frequenciasClientes[k], 'EVENTUAL');
  assert.equal(antes.estado.frequenciasClientes[chave(antes.estado, mensal.id)], 'MENSAL');
  assert.equal(antes.estado.frequenciasClientes[chave(antes.estado, indefinido.id)], 'NAO_DEFINIDA');
  const quantidade = (await req('/clientes')).length;
  const incluir = { tipo: 'incluirClienteMes', clienteId: a.id, competencia: '2026-11' };
  await alterar([incluir]);
  await alterar([definir(['registro', '2026-11', k, 'observacao'], 'Texto de novembro', ''), definir(['registro', '2026-11', k, 'status'], 'OK', 'PENDENTE')]);
  await alterar([incluir]); // Retry must keep saved work.
  const depois = (await ler()).estado;
  assert.equal((await req('/clientes')).length, quantidade);
  assert.deepEqual(depois.registros['2026-11'][k], { status: 'OK', observacao: 'Texto de novembro' });
  assert.equal(depois.registros['2026-12']?.[k], undefined);
  assert.equal(depois.informacoesClientes[k], 'Preservar informação');
  assert.deepEqual(depois.nomesBusca[k], ['Apelido eventual']);
  const revisao = (await ler()).revisao;
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { frequenciaAcesso: 'MENSAL' });
  const atualizado = await req(`/excel/estado?revisao=${revisao}&instancia=${antes.instancia}`);
  assert.equal(atualizado.estado.frequenciasClientes[k], 'MENSAL');
  assert.deepEqual(atualizado.estado.registros, depois.registros);
});

test('lista mensal: inclusão valida mês e ID, recusa excluídos e preserva o lote em erro', async () => {
  const a = await cliente('inclusão inválida'), k = chave((await ler()).estado, a.id);
  for (const op of [
    { tipo: 'incluirClienteMes', clienteId: a.id, competencia: '2026-13' },
    { tipo: 'incluirClienteMes', clienteId: '1', competencia: '2026-11' },
    { tipo: 'incluirClienteMes', clienteId: 2147483647, competencia: '2026-11' },
    { tipo: 'incluirClienteMes', clienteId: a.id, competencia: '2026-11', nome: 'Não cadastrar' },
  ]) await alterar([definir(['nome', k], 'Não aplicar parcialmente', a.nome), op], 400);
  assert.equal((await req(`/clientes/${a.id}`)).nome, a.nome);
  await req(`/clientes/${a.id}`, 'DELETE', { nomeConfirmado: a.nome });
  await alterar([{ tipo: 'incluirClienteMes', clienteId: a.id, competencia: '2026-11' }], 400);
  assert.equal((await ler()).estado.registros['2026-11']?.[k], undefined);
});

test('lista mensal: pendência já existente inclui o cliente só na sua competência sem alterar seu histórico', async () => {
  const a = await cliente('pendência existente');
  const p = await req('/pendencias', 'POST', { clienteId: a.id, competencia: '2027-02', status: 'CONCLUIDO', observacao: 'Preservar observação' }, 201);
  const historico = await req(`/pendencias/${p.id}/historico`);
  const estado = (await ler()).estado, k = chave(estado, a.id);
  assert.ok(estado.clientesPorCompetencia['2027-02'].includes(k));
  assert.ok(!estado.clientesPorCompetencia['2027-03']?.includes(k));
  assert.deepEqual(await req(`/pendencias/${p.id}/historico`), historico);
});

test('cadastro único: clientes do menu e do Excel aparecem nas duas vistas, uma vez por ID e na mesma ordem', async () => {
  const a = await cliente('criado no menu');
  const inicial = (await ler()).estado;
  assert.ok(chave(inicial, a.id));
  await alterar([{ tipo: 'incluirCliente', idCriacao: `${tag}-criacao`, nome: `${tag} criado no Excel`, apelidos: ['Apelido fictício'], informacoes: 'Informação compartilhada' }]);
  const lista = await req('/clientes');
  const b = lista.find((c: { nome: string }) => c.nome === `${tag} criado no Excel`); assert.ok(b);
  const snapshot = (await ler()).estado;
  assert.deepEqual(snapshot.clientesExtras.map((k: string) => snapshot.vinculosClientes[k]), lista.map((c: { id: number }) => c.id));
  assert.equal(new Set(Object.values(snapshot.vinculosClientes)).size, lista.length);
  const ficha = await req(`/clientes/${b.id}/ficha`);
  assert.equal(ficha.informacoesAdicionais, 'Informação compartilhada');
  assert.deepEqual(ficha.nomesAlternativos.map((n: { nome: string }) => n.nome), ['Apelido fictício']);
});

test('cadastro único: alterações de nome, apelido, informações e situação se refletem sem vínculo manual', async () => {
  const a = await cliente('edição');
  const k = chave((await ler()).estado, a.id);
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { observacoesPermanentes: 'Anotação independente preservada' });
  await req(`/clientes/${a.id}/procedimentos`, 'POST', { titulo: 'Procedimento', descricao: 'Preservar instrução' }, 201);
  await alterar([definir(['nome', k], `${tag} nome editado`, a.nome), definir(['apelidos', k], ['Apelido novo'], []), definir(['informacoes', k], 'Texto do Excel', ''), definir(['registro', '2026-11', k, 'observacao'], 'Observação mensal', '')]);
  let ficha = await req(`/clientes/${a.id}/ficha`);
  assert.equal(ficha.nome, `${tag} nome editado`); assert.equal(ficha.informacoesAdicionais, 'Texto do Excel');
  assert.equal(ficha.observacoesPermanentes, 'Anotação independente preservada'); assert.equal(ficha.procedimentos.length, 1);
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { nomesAlternativos: ['Apelido da ficha'], informacoesAdicionais: 'Texto da ficha' });
  await req(`/clientes/${a.id}`, 'PATCH', { nome: `${tag} nome do menu`, ativo: false });
  const estado = (await ler()).estado;
  assert.equal(estado.nomesAlterados[k], `${tag} nome do menu`);
  assert.deepEqual(estado.nomesBusca[k], ['Apelido da ficha']); assert.equal(estado.informacoesClientes[k], 'Texto da ficha');
  assert.ok(estado.clientesInativos.includes(k)); assert.equal(chave(estado, a.id), k);
  assert.equal(estado.registros['2026-11'][k].observacao, 'Observação mensal');
  ficha = await req(`/clientes/${a.id}/ficha`); assert.equal(ficha.procedimentos.length, 1); assert.equal(ficha.historicoContabilidades.length, 0);
});

test('cadastro único: repetir criação não duplica; homônimos criados separadamente mantêm IDs próprios', async () => {
  const nome = `${tag} homônimo`, op = { tipo: 'incluirCliente', idCriacao: `${tag}-idempotente`, nome, apelidos: [], informacoes: '' };
  const antes = (await req('/clientes')).length;
  await alterar([op]); await alterar([op]);
  assert.equal((await req('/clientes')).length, antes + 1);
  await alterar([{ ...op, idCriacao: `${tag}-outro` }]);
  const lista = (await req('/clientes')).filter((c: { nome: string }) => c.nome === nome);
  assert.equal(lista.length, 2); assert.notEqual(lista[0].id, lista[1].id);
  const estado = (await ler()).estado;
  assert.notEqual(chave(estado, lista[0].id), chave(estado, lista[1].id));
  await alterar([{ ...op, nome: 'Não reutilizar a solicitação para outra empresa' }], 400);
  assert.equal((await req('/clientes')).length, antes + 2);
});

test('cadastro único: edição concorrente pela ficha não é sobrescrita pelo Excel nem aplica lote parcial', async () => {
  const a = await cliente('concorrente'), k = chave((await ler()).estado, a.id);
  await alterar([definir(['informacoes', k], 'Versão inicial', '')]);
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { informacoesAdicionais: 'Versão salva na ficha' });
  const conflito = await alterar([definir(['nome', k], 'Nome que não pode ser gravado', a.nome), definir(['informacoes', k], 'Versão atrasada', 'Versão inicial')], 409);
  assert.equal(conflito.estado.informacoesClientes[k], 'Versão salva na ficha');
  assert.equal((await req(`/clientes/${a.id}`)).nome, a.nome);
  await alterar([definir(['informacoes', 'cliente:2147483647'], 'Inválido', '')], 400);
  await alterar([definir(['vinculo', k], null, a.id)], 400);
});

test('cadastro único: a ficha também protege informações e apelidos alterados no Excel', async () => {
  const a = await cliente('concorrência na ficha'), k = chave((await ler()).estado, a.id);
  await alterar([definir(['informacoes', k], 'Atualizado no Excel', ''), definir(['apelidos', k], ['Nome atualizado no Excel'], [])]);
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { informacoesAdicionais: 'Rascunho antigo', valoresAnteriores: { informacoesAdicionais: '' } }, 409);
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { nomesAlternativos: ['Apelido antigo'], valoresAnteriores: { nomesAlternativos: [] } }, 409);
  const atual = await req(`/clientes/${a.id}/ficha`);
  assert.equal(atual.informacoesAdicionais, 'Atualizado no Excel');
  assert.deepEqual(atual.nomesAlternativos.map((n: { nome: string }) => n.nome), ['Nome atualizado no Excel']);
  for (const valoresAnteriores of [null, [], { informacoesAdicionais: 1 }, { nomesAlternativos: [null] }, { desconhecido: 'x' }]) {
    await req(`/clientes/${a.id}/ficha`, 'PATCH', { informacoesAdicionais: 'Inválido', valoresAnteriores }, 400);
  }
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { informacoesAdicionais: 'Atualizado no Excel', valoresAnteriores: { informacoesAdicionais: '' } });
  assert.equal((await req(`/clientes/${a.id}/ficha`)).informacoesAdicionais, 'Atualizado no Excel');
});

test('cadastro único: transição preserva vínculo já salvo, histórico, meses e cópia integral do estado antigo', async () => {
  const a = await cliente('legado vinculado');
  const firma = await req('/contabilidades', 'POST', { nome: `${tag} firma fictícia` }, 201);
  await req(`/clientes/${a.id}/ficha`, 'PATCH', { contabilidadeId: firma.id, observacoesPermanentes: 'Preservar anotação' });
  const fichaAntes = await req(`/clientes/${a.id}/ficha`);
  const origem = `${tag} apelido antigo`;
  const legado = estadoVazio(); legado.clientesExtras.push(origem); legado.vinculosClientes[origem] = a.id;
  legado.informacoesClientes[origem] = 'Preservar informação adicional'; legado.nomesBusca[origem] = ['Apelido legado'];
  legado.registros['2026-11'] = { [origem]: { status: 'OK', observacao: 'Novembro antigo' } };
  legado.registros['2026-12'] = { [origem]: { status: 'AGUARDANDO', observacao: 'Dezembro antigo' } };
  await pool.query('INSERT INTO "ExcelCompartilhado" (id, instancia, dados, revisao) VALUES ($1,$2,$3::jsonb,0)', ['principal', `${tag}-legado`, JSON.stringify(legado)]);
  const estado = (await ler()).estado;
  assert.equal(estado.vinculosClientes[origem], a.id); assert.equal(Object.values(estado.vinculosClientes).filter(id => id === a.id).length, 1);
  assert.deepEqual(estado.registros, legado.registros);
  let salvo = (await pool.query('SELECT dados FROM "ExcelCompartilhado" WHERE id=$1', ['principal'])).rows[0].dados;
  assert.equal(salvo.versao, 2); assert.deepEqual(salvo.legado, legado);
  const ficha = await req(`/clientes/${a.id}/ficha`);
  assert.equal(ficha.informacoesAdicionais, 'Preservar informação adicional');
  assert.deepEqual(ficha.historicoContabilidades, fichaAntes.historicoContabilidades);
  assert.equal(ficha.observacoesPermanentes, fichaAntes.observacoesPermanentes);
  await alterar([definir(['nome', origem], `${tag} renomeado`, a.nome)]);
  salvo = (await pool.query('SELECT dados FROM "ExcelCompartilhado" WHERE id=$1', ['principal'])).rows[0].dados;
  assert.deepEqual(salvo.legado, legado);
});

test('cadastro único: nomes iguais em cadastros antigos não são mesclados pela posição ou pelo texto', async () => {
  const a = await cliente('mesmo nome antigo');
  const legado = estadoVazio(); legado.clientesExtras.push(a.nome); legado.informacoesClientes[a.nome] = 'Somente no Excel antigo';
  await pool.query('INSERT INTO "ExcelCompartilhado" (id, instancia, dados, revisao) VALUES ($1,$2,$3::jsonb,0)', ['principal', `${tag}-separado`, JSON.stringify(legado)]);
  const estado = (await ler()).estado;
  assert.notEqual(estado.vinculosClientes[a.nome], a.id);
  assert.ok(chave(estado, a.id));
  assert.equal((await req(`/clientes/${a.id}/ficha`)).informacoesAdicionais, null);
});

test('cadastro único: abrir o menu de clientes já disponibiliza linhas antigas sem visitar Excel antes', async () => {
  const nome = `${tag} salvo somente no Excel antigo`;
  const legado = estadoVazio(); legado.clientesExtras.push(nome); legado.informacoesClientes[nome] = 'Informação antiga integral.  ';
  await pool.query('INSERT INTO "ExcelCompartilhado" (id, instancia, dados, revisao) VALUES ($1,$2,$3::jsonb,0)', ['principal', `${tag}-menu-primeiro`, JSON.stringify(legado)]);
  const lista = await req('/clientes');
  const novo = lista.find((c: { nome: string }) => c.nome === nome); assert.ok(novo);
  assert.equal(novo.informacoesAdicionais, 'Informação antiga integral.  ');
  const estado = (await ler()).estado; assert.equal(estado.vinculosClientes[nome], novo.id);
  assert.equal((await req(`/clientes/${novo.id}/ficha`)).informacoesAdicionais, novo.informacoesAdicionais);
});

test('cadastro único: transição ambígua não escolhe um status nem apaga registros existentes', async () => {
  const a = await cliente('legado ambíguo');
  const legado = estadoVazio(); legado.clientesExtras = ['Linha fictícia A', 'Linha fictícia B'];
  legado.vinculosClientes = { 'Linha fictícia A': a.id, 'Linha fictícia B': a.id };
  legado.registros['2026-11'] = { 'Linha fictícia A': { status: 'OK', observacao: 'A' }, 'Linha fictícia B': { status: 'PENDENTE', observacao: 'B' } };
  await pool.query('INSERT INTO "ExcelCompartilhado" (id, instancia, dados, revisao) VALUES ($1,$2,$3::jsonb,0)', ['principal', `${tag}-ambiguo`, JSON.stringify(legado)]);
  await req('/excel/estado', 'GET', undefined, 400);
  const dados = (await pool.query('SELECT dados FROM "ExcelCompartilhado" WHERE id=$1', ['principal'])).rows[0].dados;
  assert.deepEqual(dados, legado);
  assert.deepEqual((await req(`/clientes/${a.id}/ficha`)).nomesAlternativos, []);
});
