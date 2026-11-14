import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { randomInt } from 'node:crypto';
import { Pool } from 'pg';
import { urlDeTeste, prepararBancoDeTeste } from './helpers/banco.ts';
import { CAMPOS, lerArquivoConfere, lerRegras, type LinhaConfere } from '../src/importacao/arquivo-confere.ts';
import { aplicarImportacao, planejarImportacao, validarDestinoLocal, ImportacaoBloqueada } from '../src/importacao/importar-confere.ts';

const url = urlDeTeste();
const { prisma } = await import('../src/lib/prisma.ts');
const pool = new Pool({ connectionString: url.toString() });
const base = randomInt(100000, 1900000000);
const tag = `Codex importação fictícia ${base}`;
const codigo = (n: number) => String(base + n);
const linha = (n: number, extra: Partial<LinhaConfere> = {}): LinhaConfere => ({
  codigo_confere: codigo(n), nome: `${tag} ${n}`, razao_social: `${tag} razão ${n}`,
  contabilidade: '', situacao_contabilidade: 'SEM_CONTABILIDADE', id_contabilidade_cadastro: '0', id_contabilidade_individual: '', ...extra,
});
function arquivo(linhas: LinhaConfere[], delimiter = ';') {
  const quote = (s: string) => '"' + s.replace(/"/g, '""') + '"';
  return Buffer.from('\ufeff' + [CAMPOS.map(quote).join(delimiter), ...linhas.map(l => CAMPOS.map(k => quote(l[k])).join(delimiter))].join('\r\n'));
}
const regras = lerRegras({ equivalencias: {
  [codigo(100)]: { grupo: `ficticio-${base}`, nome: `${tag} Conta confirmada` },
  [codigo(101)]: { grupo: `ficticio-${base}`, nome: `${tag} Conta confirmada` },
}, confirmacoes: { [codigo(1)]: codigo(100), [codigo(2)]: codigo(101) } });
const linhas = [
  linha(1, { nome: `${tag} homônimo`, contabilidade: `${tag} Conta confirmada`, situacao_contabilidade: 'CONFIRMADA_MANUALMENTE', id_contabilidade_cadastro: codigo(100), id_contabilidade_individual: codigo(102) }),
  linha(2, { nome: `${tag} homônimo`, contabilidade: `${tag} Conta confirmada`, situacao_contabilidade: 'CONFIRMADA_MANUALMENTE', id_contabilidade_cadastro: codigo(101) }),
  linha(3, { contabilidade: `${tag} Outra conta`, situacao_contabilidade: 'CADASTRO_DIRETO', id_contabilidade_cadastro: codigo(102) }),
  linha(4, { situacao_contabilidade: 'REVISAR_VINCULO', id_contabilidade_cadastro: codigo(103), id_contabilidade_individual: codigo(104) }),
];
const lote = lerArquivoConfere(arquivo(linhas), regras);
async function contagens() { return Promise.all([prisma.cliente.count(), prisma.contabilidade.count(), prisma.clienteConfere.count(), prisma.contabilidadeConfere.count(), prisma.clienteNomeAlternativo.count()]); }

before(async () => { await prepararBancoDeTeste(pool); });
after(async () => { await prisma.$disconnect(); await pool.end(); });

test('leitura aceita BOM, separadores, aspas e preserva códigos distintos com o mesmo nome', () => {
  for (const sep of [';', '\t', ',']) {
    const data = lerArquivoConfere(arquivo([linha(30, { nome: 'Fictício; "com aspas"' })], sep));
    assert.equal(data.clientes[0].nome, 'Fictício; "com aspas"');
  }
  assert.equal(lote.clientes.length, 4);
  assert.equal(lote.clientes[0].nome, lote.clientes[1].nome);
});

test('dados inválidos, códigos duplicados, campos extras e confirmação não aprovada são rejeitados', () => {
  for (const dados of [[linha(31), linha(31)], [linha(32, { nome: '' })], [linha(33, { nome: 'x'.repeat(201) })],
    [linha(34, { codigo_confere: '0' })], [linha(35, { situacao_contabilidade: 'INVALIDA' })],
    [linha(36, { contabilidade: 'Conta sem vínculo' })], [linhas[0]]]) {
    assert.throws(() => lerArquivoConfere(arquivo(dados)));
  }
  assert.throws(() => lerArquivoConfere(Buffer.from('codigo_confere;senha\n1;nao-usar')));
  assert.throws(() => lerRegras({ equivalencias: { '1': { grupo: 'x', nome: '' } } }));
  assert.throws(() => lerRegras({ clientesExistentes: { '1': -1 } }));
  assert.throws(() => lerArquivoConfere(Uint8Array.from([0xff, 0xfe])));
});

test('guardas recusam Confere, produção e URLs locais fora do escopo', () => {
  for (const destino of ['postgresql://u:p@empresa:5432/conferecopias', 'postgresql://u:p@127.0.0.1:5433/conferecopias',
    'postgresql://u:p@127.0.0.1:5433/controle_notas', 'postgresql://u:p@db:5432/conferecopias', url.toString()+'?options=x']) {
    assert.throws(() => validarDestinoLocal(destino, 'docker-local'));
  }
  assert.throws(() => validarDestinoLocal('postgresql://u:p@db:5432/controle_notas', 'production'));
  assert.equal(validarDestinoLocal(url.toString()).hostname, '127.0.0.1');
});

test('simulação é somente leitura, sem criar clientes ou contabilidades', async () => {
  const antes = await contagens();
  const plano = await planejarImportacao(prisma, lote);
  assert.equal(plano.resumo.conflitos, 0);
  assert.equal(plano.resumo.criarClientes, 4);
  assert.equal(plano.resumo.criarContabilidades, 2);
  assert.equal(plano.resumo.clientesSemContabilidade, 1);
  assert.deepEqual(await contagens(), antes);
});

test('aplicação preserva homônimos e agrupa somente equivalências aprovadas', async () => {
  await aplicarImportacao(prisma, lote);
  const importados = await prisma.clienteConfere.findMany({ where: { codigo: { in: linhas.map(l => l.codigo_confere) } }, include: { cliente: { include: { nomesAlternativos: true } } } });
  assert.equal(importados.length, 4);
  assert.equal(new Set(importados.map(r => r.clienteId)).size, 4);
  for (const r of importados) {
    assert.equal(r.cliente.frequenciaAcesso, 'NAO_DEFINIDA');
    assert.equal(r.cliente.nomesAlternativos.length, 1);
    assert.equal(r.cliente.observacoesPermanentes, null);
  }
  const a = importados.find(r => r.codigo === codigo(1))!;
  const b = importados.find(r => r.codigo === codigo(2))!;
  assert.equal(a.cliente.contabilidadeId, b.cliente.contabilidadeId);
  assert.equal(importados.find(r => r.codigo === codigo(4))!.cliente.contabilidadeId, null);
  assert.notEqual(a.clienteId, Number(a.codigo));
});

test('repetição não duplica; alterações manuais e histórico são preservados', async () => {
  const vinculo = await prisma.clienteConfere.findUniqueOrThrow({ where: { codigo: codigo(1) } });
  const conta = await prisma.contabilidade.create({ data: { nome: `${tag} Conta manual` } });
  await prisma.cliente.update({ where: { id: vinculo.clienteId }, data: { nome: `${tag} Nome manual`, frequenciaAcesso: 'EVENTUAL', observacoesPermanentes: 'Orientação manual', modeloMensagem: 'Modelo manual', contabilidadeId: conta.id, procedimentos: { create: { titulo: 'Manual', descricao: 'Não sobrescrever' } }, historicoContabilidades: { create: { nomeAnterior: 'Anterior fictícia', nomeNova: conta.nome, autor: 'Codex' } }, nomesAlternativos: { create: { nome: 'Apelido manual' } } } });
  const include = { nomesAlternativos: true, procedimentos: true, historicoContabilidades: true, confere: true };
  const antes = await prisma.cliente.findUnique({ where: { id: vinculo.clienteId }, include });
  const counts = await contagens();
  const plano = await aplicarImportacao(prisma, lote);
  assert.equal(plano.resumo.criarClientes, 0);
  assert.equal(plano.resumo.preservarClientes, 4);
  assert.deepEqual(await contagens(), counts);
  const alterado = lerArquivoConfere(arquivo(linhas.map(l => l.codigo_confere === codigo(1) ? { ...l, nome: 'Nome alterado no arquivo' } : l)), regras);
  assert.equal((await aplicarImportacao(prisma, alterado)).resumo.origemAlterada, 1);
  assert.deepEqual(await prisma.cliente.findUnique({ where: { id: vinculo.clienteId }, include }), antes);
});

test('cliente manual com nome igual bloqueia o lote; vínculo explícito preserva a ficha', async () => {
  const novo = linha(40);
  const manual = await prisma.cliente.create({ data: { nome: novo.nome, observacoesPermanentes: 'Preservar cliente manual', nomesAlternativos: { create: { nome: 'Alias existente' } } } });
  const data = lerArquivoConfere(arquivo([novo, linha(41)]));
  const counts = await contagens();
  await assert.rejects(aplicarImportacao(prisma, data), ImportacaoBloqueada);
  assert.deepEqual(await contagens(), counts);
  const linked = lerArquivoConfere(arquivo([novo]), lerRegras({ clientesExistentes: { [novo.codigo_confere]: manual.id } }));
  await aplicarImportacao(prisma, linked);
  assert.equal((await prisma.clienteConfere.findUniqueOrThrow({ where: { codigo: novo.codigo_confere } })).clienteId, manual.id);
  assert.equal((await prisma.cliente.findUniqueOrThrow({ where: { id: manual.id } })).observacoesPermanentes, 'Preservar cliente manual');
});

test('contabilidade manual exige vínculo explícito; não é mesclada pelo nome', async () => {
  const row = linha(45, { contabilidade: `${tag} Conta já existente`, situacao_contabilidade: 'CADASTRO_DIRETO', id_contabilidade_cadastro: codigo(150) });
  const conta = await prisma.contabilidade.create({ data: { nome: row.contabilidade } });
  const counts = await contagens();
  await assert.rejects(aplicarImportacao(prisma, lerArquivoConfere(arquivo([row]))), ImportacaoBloqueada);
  assert.deepEqual(await contagens(), counts);
  const data = lerArquivoConfere(arquivo([row]), lerRegras({ contabilidadesExistentes: { [codigo(150)]: conta.id } }));
  await aplicarImportacao(prisma, data);
  assert.equal((await prisma.contabilidadeConfere.findUniqueOrThrow({ where: { codigo: codigo(150) } })).contabilidadeId, conta.id);
});

test('falha durante a gravação reverte integralmente clientes, aliases e vínculos', async () => {
  const row = linha(52, { contabilidade: `${tag} Conta rollback`, situacao_contabilidade: 'CADASTRO_DIRETO', id_contabilidade_cadastro: codigo(160) });
  const data = lerArquivoConfere(arquivo([row, linha(53)]));
  const func = `codex_falha_import_${base}`;
  // Test-only trigger on this isolated disposable DB, scoped to a synthetic ID.
  await pool.query(`CREATE FUNCTION ${func}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.codigo='${codigo(53)}' THEN RAISE EXCEPTION 'Falha fictícia para rollback'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${func} BEFORE INSERT ON "ClienteConfere" FOR EACH ROW EXECUTE FUNCTION ${func}()`);
  const counts = await contagens();
  try { await assert.rejects(aplicarImportacao(prisma, data)); assert.deepEqual(await contagens(), counts); }
  finally { await pool.query(`DROP TRIGGER ${func} ON "ClienteConfere"`); await pool.query(`DROP FUNCTION ${func}()`); }
});

test('duas importações simultâneas geram um único cadastro por código', async () => {
  const data = lerArquivoConfere(arquivo([linha(60), linha(61)]));
  const result = await Promise.all([aplicarImportacao(prisma, data), aplicarImportacao(prisma, data)]);
  assert.equal(result.reduce((sum, r) => sum + r.resumo.criarClientes, 0), 2);
  assert.equal(await prisma.clienteConfere.count({ where: { codigo: { in: [codigo(60), codigo(61)] } } }), 2);
});


test('API expõe somente o código de origem na lista, leitura e salvamento de ficha', async () => {
  const data = lerArquivoConfere(arquivo([
    linha(80, { nome: `Codex UI homônimos ${base}`, razao_social: `Apelido fictício primeiro ${base}` }),
    linha(81, { nome: `Codex UI homônimos ${base}`, razao_social: `Apelido fictício segundo ${base}` }),
  ]));
  await aplicarImportacao(prisma, data);
  const { app } = await import('../src/app.ts');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const endpoint = `http://127.0.0.1:${address.port}`;
  try {
    const response = await fetch(`${endpoint}/clientes`);
    assert.equal(response.status, 200);
    const clientes = await response.json();
    for (const source of [codigo(80), codigo(81)]) {
      const c = clientes.find((c: {confere?: {codigo: string}}) => c.confere?.codigo === source);
      assert.ok(c);
      assert.deepEqual(c.confere, { codigo: source });
      const ficha = await (await fetch(`${endpoint}/clientes/${c.id}/ficha`)).json();
      assert.deepEqual(ficha.confere, { codigo: source });
      const salva = await fetch(`${endpoint}/clientes/${c.id}/ficha`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ frequenciaAcesso: 'EVENTUAL' }) });
      assert.equal(salva.status, 200);
      assert.deepEqual((await salva.json()).confere, { codigo: source });
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve())); }
});
