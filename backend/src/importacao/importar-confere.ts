import type { Prisma, PrismaClient } from '../../generated/prisma/client.ts';
import { normalizar, type LoteConfere } from './arquivo-confere.ts';

export function validarDestinoLocal(value: string | undefined, ambiente = process.env.CONTROLE_NOTAS_AMBIENTE): URL {
  let url: URL;
  try { url = new URL(value ?? 'about:blank'); } catch { throw Error('DATABASE_URL local inválida.'); }
  const teste = url.hostname === '127.0.0.1' && url.port === '5433' && /^\/controle_notas_pr1_test_[a-z0-9_]+$/.test(url.pathname);
  const docker = ambiente === 'docker-local' && url.hostname === 'db' && url.port === '5432' && url.pathname === '/controle_notas';
  if (url.protocol !== 'postgresql:' || url.search || url.hash || !(teste || docker)) {
    throw Error('Destino recusado: use somente db:5432/controle_notas no Compose local ou um banco controle_notas_pr1_test_* em 127.0.0.1:5433.');
  }
  return url;
}

type AcaoCliente = { codigo: string; nome: string; acao: 'CRIAR' | 'VINCULAR' | 'PRESERVAR' | 'BLOQUEADO'; clienteId?: number; candidatos?: number[]; origemAlterada?: boolean };
type AcaoContabilidade = { grupo: string; nome: string; contabilidadeId?: number; codigos: Array<{ codigo: string; nomeOrigem: string }> };
export type PlanoConfere = {
  hashArquivo: string;
  resumo: { total: number; criarClientes: number; vincularClientes: number; preservarClientes: number; criarContabilidades: number; adicionarNomesAlternativos: number; clientesSemContabilidade: number; origemAlterada: number; conflitos: number };
  conflitos: Array<{ codigo?: string; grupo?: string; motivo: string; candidatos?: number[] }>;
  clientes: AcaoCliente[];
  contabilidades: AcaoContabilidade[];
};
export class ImportacaoBloqueada extends Error {
  constructor(public plano: PlanoConfere) { super('Importação bloqueada: resolva as correspondências indicadas na prévia.'); }
}

async function montarPlano(tx: Prisma.TransactionClient, lote: LoteConfere): Promise<PlanoConfere> {
  // Read a consistent snapshot; never inspect notes, passwords or procedures.
  const clientes = await tx.cliente.findMany({ select: { id: true, nome: true, confere: { select: { codigo: true, hashOrigem: true } }, nomesAlternativos: { select: { nome: true } } } });
  const contas = await tx.contabilidade.findMany({ select: { id: true, nome: true, confere: { select: { codigo: true, grupo: true } } } });
  const clientesId = new Map(clientes.map(c => [c.id, c]));
  const clientesCodigo = new Map(clientes.filter(c => c.confere).map(c => [c.confere!.codigo, c]));
  const contasId = new Map(contas.map(c => [c.id, c]));
  const contasCodigo = new Map(contas.flatMap(c => c.confere.map(f => [f.codigo, { id: c.id, grupo: f.grupo }] as const)));
  const conflitos: PlanoConfere['conflitos'] = [];
  const acoes: AcaoCliente[] = [];
  const usados = new Map<number, string>();
  for (const linha of lote.clientes) {
    const anterior = clientesCodigo.get(linha.codigo);
    const vinculo = lote.regras.clientesExistentes[linha.codigo];
    if (anterior) {
      if (vinculo && vinculo !== anterior.id) conflitos.push({ codigo: linha.codigo, motivo: 'Código de origem já vinculado a outro cliente.' });
      acoes.push({ codigo: linha.codigo, nome: linha.nome, acao: 'PRESERVAR', clienteId: anterior.id, origemAlterada: anterior.confere!.hashOrigem !== linha.hash });
    } else if (vinculo) {
      const destino = clientesId.get(vinculo);
      if (!destino || destino.confere || usados.has(vinculo)) {
        conflitos.push({ codigo: linha.codigo, motivo: 'Vínculo manual inexistente ou já reservado para outro código.' });
        acoes.push({ codigo: linha.codigo, nome: linha.nome, acao: 'BLOQUEADO' });
      } else {
        usados.set(vinculo, linha.codigo);
        acoes.push({ codigo: linha.codigo, nome: linha.nome, acao: 'VINCULAR', clienteId: vinculo });
      }
    } else {
      const nomes = [linha.nome, linha.apelido].filter((n): n is string => !!n).map(normalizar);
      const candidatos = clientes.filter(c => !c.confere && [c.nome, ...c.nomesAlternativos.map(n => n.nome)].some(n => nomes.includes(normalizar(n)))).map(c => c.id);
      if (candidatos.length) {
        conflitos.push({ codigo: linha.codigo, motivo: 'Possível cliente já cadastrado manualmente; exige vínculo explícito.', candidatos });
        acoes.push({ codigo: linha.codigo, nome: linha.nome, acao: 'BLOQUEADO', candidatos });
      } else acoes.push({ codigo: linha.codigo, nome: linha.nome, acao: 'CRIAR' });
    }
  }
  const porCodigo = new Map(lote.clientes.map(c => [c.codigo, c]));
  const grupos = new Map<string, AcaoContabilidade>();
  for (const acao of acoes.filter(a => a.acao === 'CRIAR')) {
    const office = porCodigo.get(acao.codigo)!.contabilidade;
    if (!office) continue;
    let grupo = grupos.get(office.grupo);
    if (!grupo) {
      grupo = { grupo: office.grupo, nome: office.nome, codigos: [] };
      grupos.set(office.grupo, grupo);
    }
    if (!grupo.codigos.some(c => c.codigo === office.codigo)) grupo.codigos.push({ codigo: office.codigo, nomeOrigem: office.nomeOrigem });
  }
  for (const grupo of grupos.values()) {
    // An explicitly approved equivalence reserves all source IDs in the group.
    for (const [codigo, equivalencia] of Object.entries(lote.regras.equivalencias)) {
      if (`grupo:${equivalencia.grupo}` === grupo.grupo) {
        if (normalizar(equivalencia.nome) !== normalizar(grupo.nome)) conflitos.push({ grupo: grupo.grupo, motivo: 'Equivalências têm nomes canônicos diferentes.' });
        if (!grupo.codigos.some(c => c.codigo === codigo)) grupo.codigos.push({ codigo, nomeOrigem: equivalencia.nome });
      }
    }
    const ids = new Set<number>();
    for (const conta of contas) if (conta.confere.some(c => c.grupo === grupo.grupo)) ids.add(conta.id);
    for (const source of grupo.codigos) {
      const anterior = contasCodigo.get(source.codigo);
      if (anterior) {
        ids.add(anterior.id);
        if (anterior.grupo !== grupo.grupo) conflitos.push({ grupo: grupo.grupo, motivo: 'Equivalência mudou para uma contabilidade já importada.' });
      }
      const explicit = lote.regras.contabilidadesExistentes[source.codigo];
      if (explicit) {
        if (!contasId.has(explicit)) conflitos.push({ grupo: grupo.grupo, motivo: 'Contabilidade indicada no vínculo manual não existe.' });
        else ids.add(explicit);
      }
    }
    if (ids.size > 1) conflitos.push({ grupo: grupo.grupo, motivo: 'Grupo de contabilidade aponta para cadastros internos diferentes.', candidatos: [...ids] });
    else if (ids.size === 1) grupo.contabilidadeId = [...ids][0];
    else {
      const candidatos = contas.filter(c => c.confere.length === 0 && normalizar(c.nome) === normalizar(grupo.nome)).map(c => c.id);
      if (candidatos.length) conflitos.push({ grupo: grupo.grupo, motivo: 'Possível contabilidade já cadastrada manualmente; exige vínculo explícito.', candidatos });
    }
  }
  const contabilidades = [...grupos.values()];
  const novas = acoes.filter(a => a.acao === 'CRIAR');
  return { hashArquivo: lote.hashArquivo, conflitos, clientes: acoes, contabilidades,
    resumo: { total: acoes.length, criarClientes: novas.length, vincularClientes: acoes.filter(a => a.acao === 'VINCULAR').length,
      preservarClientes: acoes.filter(a => a.acao === 'PRESERVAR').length, criarContabilidades: contabilidades.filter(c => !c.contabilidadeId).length,
      adicionarNomesAlternativos: novas.filter(c => porCodigo.get(c.codigo)!.apelido).length,
      clientesSemContabilidade: lote.clientes.filter(c => !c.contabilidade).length,
      origemAlterada: acoes.filter(a => a.origemAlterada).length, conflitos: conflitos.length } };
}

export async function planejarImportacao(prisma: PrismaClient, lote: LoteConfere): Promise<PlanoConfere> {
  validarDestinoLocal(process.env.DATABASE_URL);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return montarPlano(tx, lote);
  }, { isolationLevel: 'RepeatableRead', timeout: 120000 });
}

export async function aplicarImportacao(prisma: PrismaClient, lote: LoteConfere): Promise<PlanoConfere> {
  validarDestinoLocal(process.env.DATABASE_URL);
  return prisma.$transaction(async tx => {
    // Serialize importers; source uniqueness is also enforced by the database.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('controle_notas:importacao_confere'))`;
    const plano = await montarPlano(tx, lote);
    if (plano.conflitos.length) throw new ImportacaoBloqueada(plano);
    const idsGrupo = new Map<string, number>();
    for (const grupo of plano.contabilidades) {
      const id = grupo.contabilidadeId ?? (await tx.contabilidade.create({ data: { nome: grupo.nome }, select: { id: true } })).id;
      idsGrupo.set(grupo.grupo, id);
      for (const fonte of grupo.codigos) {
        if (!await tx.contabilidadeConfere.findUnique({ where: { codigo: fonte.codigo } })) {
          await tx.contabilidadeConfere.create({ data: { codigo: fonte.codigo, grupo: grupo.grupo, nomeOrigem: fonte.nomeOrigem, contabilidadeId: id } });
        }
      }
    }
    const linhas = new Map(lote.clientes.map(l => [l.codigo, l]));
    for (const acao of plano.clientes) {
      if (acao.acao === 'PRESERVAR') continue;
      const linha = linhas.get(acao.codigo)!;
      const id = acao.clienteId ?? (await tx.cliente.create({
        data: { nome: linha.nome, ativo: true,
          contabilidadeId: linha.contabilidade ? idsGrupo.get(linha.contabilidade.grupo)! : null,
          nomesAlternativos: linha.apelido ? { create: { nome: linha.apelido } } : undefined }, select: { id: true },
      })).id;
      // Linking a manually selected existing record never overwrites its ficha.
      await tx.clienteConfere.create({ data: { codigo: linha.codigo, clienteId: id, dadosOrigem: linha.dados, hashOrigem: linha.hash } });
    }
    return plano;
  }, { maxWait: 10000, timeout: 120000 });
}
