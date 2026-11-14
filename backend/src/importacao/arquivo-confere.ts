import { parse } from 'csv-parse/sync';
import { createHash } from 'node:crypto';

export const CAMPOS = ['codigo_confere', 'nome', 'razao_social', 'contabilidade', 'situacao_contabilidade', 'id_contabilidade_cadastro', 'id_contabilidade_individual'] as const;
export type LinhaConfere = Record<(typeof CAMPOS)[number], string>;
export type RegrasConfere = {
  equivalencias: Record<string, { grupo: string; nome: string }>;
  confirmacoes: Record<string, string>;
  clientesExistentes: Record<string, number>;
  contabilidadesExistentes: Record<string, number>;
};
export type ClienteEntrada = {
  codigo: string; nome: string; apelido: string | null; dados: LinhaConfere; hash: string;
  contabilidade: { codigo: string; grupo: string; nome: string; nomeOrigem: string } | null;
};
export type LoteConfere = { hashArquivo: string; clientes: ClienteEntrada[]; regras: RegrasConfere };
export function normalizar(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}
function objeto(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function codigo(v: unknown, max: bigint, zero = false): string {
  if (typeof v !== 'string' || !/^\d+$/.test(v) || v.length > 19) throw Error('Código de origem inválido.');
  const n = BigInt(v);
  if (n > max || n < (zero ? 0n : 1n)) throw Error('Código de origem fora do limite.');
  return n.toString();
}
function texto(v: string, obrigatorio: boolean) {
  const s = v.trim();
  if ((obrigatorio && !s) || s.length > 200 || /[\u0000-\u001f\u007f]/.test(s)) throw Error('Texto ausente, inválido ou acima de 200 caracteres.');
  return s;
}
export function lerRegras(valor: unknown = {}): RegrasConfere {
  if (!objeto(valor)) throw Error('Arquivo de regras inválido.');
  const permitidos = ['equivalencias', 'confirmacoes', 'clientesExistentes', 'contabilidadesExistentes'];
  if (Object.keys(valor).some(k => !permitidos.includes(k))) throw Error('Campo desconhecido nas regras.');
  const result: RegrasConfere = { equivalencias: {}, confirmacoes: {}, clientesExistentes: {}, contabilidadesExistentes: {} };
  for (const key of permitidos) if (valor[key] !== undefined && !objeto(valor[key])) throw Error('Mapa de regras inválido.');
  for (const [key, value] of Object.entries((valor.equivalencias ?? {}) as Record<string, unknown>)) {
    const id = codigo(key, 9223372036854775807n);
    if (!objeto(value) || Object.keys(value).some(k => !['grupo', 'nome'].includes(k)) ||
        typeof value.grupo !== 'string' || !/^[a-z0-9][a-z0-9_-]{0,60}$/.test(value.grupo) || typeof value.nome !== 'string') throw Error('Equivalência inválida.');
    result.equivalencias[id] = { grupo: value.grupo, nome: texto(value.nome, true) };
  }
  for (const [key, value] of Object.entries((valor.confirmacoes ?? {}) as Record<string, unknown>)) {
    const id = codigo(key, 2147483647n);
    const office = codigo(value, 9223372036854775807n);
    if (!result.equivalencias[office]) throw Error('Confirmação manual exige equivalência explícita da contabilidade.');
    result.confirmacoes[id] = office;
  }
  for (const key of ['clientesExistentes', 'contabilidadesExistentes'] as const) {
    for (const [external, internal] of Object.entries((valor[key] ?? {}) as Record<string, unknown>)) {
      const id = codigo(external, key === 'clientesExistentes' ? 2147483647n : 9223372036854775807n);
      if (typeof internal !== 'number' || !Number.isInteger(internal) || internal <= 0 || internal > 2147483647) throw Error('ID interno inválido nas regras.');
      result[key][id] = internal;
    }
  }
  return result;
}
export function lerArquivoConfere(bytes: Uint8Array, regras = lerRegras()): LoteConfere {
  if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw Error('Arquivo vazio ou acima de 10 MiB.');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  let registros: string[][] | undefined;
  for (const delimiter of [';', '\t', ',']) {
    try {
      const candidate = parse(raw, { delimiter, bom: true, skip_empty_lines: true, max_record_size: 50000 }) as string[][];
      const header = candidate[0];
      if (header?.length === CAMPOS.length && new Set(header).size === CAMPOS.length && CAMPOS.every(k => header.includes(k))) { registros = candidate; break; }
    } catch { /* Try the other supported separators without exposing field values. */ }
  }
  if (!registros || registros.length < 2 || registros.length > 10001) throw Error('CSV/TSV inválido: use UTF-8 e exatamente os sete campos da prévia aprovada, com até 10000 registros.');
  const [header, ...body] = registros;
  const usados = new Set<string>();
  const grupos = new Map<string, string>();
  const clientes = body.map((values, index): ClienteEntrada => {
    try {
      const dados = Object.fromEntries(header.map((k, i) => [k, values[i].trim()])) as LinhaConfere;
      dados.codigo_confere = codigo(dados.codigo_confere, 2147483647n);
      if (usados.has(dados.codigo_confere)) throw Error('Código de cliente repetido.');
      usados.add(dados.codigo_confere);
      dados.nome = texto(dados.nome, true); dados.razao_social = texto(dados.razao_social, false); dados.contabilidade = texto(dados.contabilidade, false);
      for (const k of ['id_contabilidade_cadastro', 'id_contabilidade_individual'] as const) {
        if (dados[k]) dados[k] = codigo(dados[k], 9223372036854775807n, true);
      }
      const status = dados.situacao_contabilidade;
      if (!['CADASTRO_DIRETO', 'CONFIRMADA_MANUALMENTE', 'SEM_CONTABILIDADE', 'REVISAR_VINCULO'].includes(status)) throw Error('Situação de contabilidade inválida.');
      const resolvida = status === 'CADASTRO_DIRETO' || status === 'CONFIRMADA_MANUALMENTE';
      if (resolvida !== !!dados.contabilidade) throw Error('Nome da contabilidade incompatível com a situação.');
      let contabilidade: ClienteEntrada['contabilidade'] = null;
      if (resolvida) {
        const id = codigo(dados.id_contabilidade_cadastro, 9223372036854775807n);
        const equivalencia = regras.equivalencias[id];
        if (status === 'CONFIRMADA_MANUALMENTE' && (regras.confirmacoes[dados.codigo_confere] !== id || !equivalencia || normalizar(dados.contabilidade) !== normalizar(equivalencia.nome))) throw Error('Confirmação manual não aprovada no arquivo de regras.');
        if (status === 'CADASTRO_DIRETO' && dados.id_contabilidade_individual && dados.id_contabilidade_individual !== '0' && dados.id_contabilidade_individual !== id) throw Error('Vínculo direto divergente deve permanecer pendente.');
        contabilidade = { codigo: id, grupo: equivalencia ? `grupo:${equivalencia.grupo}` : `codigo:${id}`, nome: equivalencia?.nome ?? dados.contabilidade, nomeOrigem: dados.contabilidade };
        const previous = grupos.get(contabilidade.grupo);
        if (previous && normalizar(previous) !== normalizar(contabilidade.nome)) throw Error('Nomes conflitantes para a mesma contabilidade de origem.');
        grupos.set(contabilidade.grupo, contabilidade.nome);
      }
      return { codigo: dados.codigo_confere, nome: dados.nome,
        apelido: dados.razao_social && normalizar(dados.razao_social) !== normalizar(dados.nome) ? dados.razao_social : null,
        dados, hash: createHash('sha256').update(JSON.stringify(CAMPOS.map(k => dados[k]))).digest('hex'), contabilidade };
    } catch (e) { throw Error(`Registro ${index + 1}: ${e instanceof Error ? e.message : 'dados inválidos'}`); }
  });
  return { hashArquivo: createHash('sha256').update(bytes).digest('hex'), clientes, regras };
}
