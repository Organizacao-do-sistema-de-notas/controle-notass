import { parseArgs } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.ts';
import { lerArquivoConfere, lerRegras } from './arquivo-confere.ts';
import { aplicarImportacao, planejarImportacao, ImportacaoBloqueada, validarDestinoLocal, type PlanoConfere } from './importar-confere.ts';

async function main() {
  const { values } = parseArgs({ options: { arquivo: { type: 'string' }, regras: { type: 'string' }, relatorio: { type: 'string' }, aplicar: { type: 'boolean', default: false }, ajuda: { type: 'boolean' } }, allowPositionals: false });
  if (values.ajuda) { console.log('npm run importar:confere -- --arquivo arquivo.csv [--regras regras.json] [--relatorio novo-relatorio.json] [--aplicar]\nSem --aplicar: somente simulação, em transação somente leitura.'); return; }
  if (!values.arquivo) throw Error('Informe --arquivo com a prévia CSV/TSV aprovada.');
  if (values.relatorio && [values.arquivo, values.regras].some(p => p && resolve(p) === resolve(values.relatorio!))) throw Error('O relatório não pode sobrescrever o arquivo de entrada ou as regras.');
  // Fail before connecting when the file, rules or destination is not valid.
  const regras = lerRegras(values.regras ? JSON.parse(readFileSync(values.regras, 'utf8')) : undefined);
  const lote = lerArquivoConfere(readFileSync(values.arquivo), regras);
  const url = validarDestinoLocal(process.env.DATABASE_URL);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString() }) });
  let plano: PlanoConfere;
  let aplicado = false;
  try {
    plano = values.aplicar ? await aplicarImportacao(prisma, lote) : await planejarImportacao(prisma, lote);
    aplicado = !!values.aplicar;
  } catch (e) {
    if (e instanceof ImportacaoBloqueada) plano = e.plano;
    else throw Error('Operação no banco local não confirmada. Confira as migrações e execute novamente a simulação antes de tentar gravar.');
  } finally { await prisma.$disconnect(); }
  const report = { modo: aplicado ? 'APLICADO' : 'SIMULACAO', destino: { host: url.hostname, porta: url.port, banco: url.pathname.slice(1) }, ...plano };
  console.log(JSON.stringify({ modo: report.modo, destino: report.destino, hashArquivo: report.hashArquivo, resumo: report.resumo }, null, 2));
  if (values.relatorio) {
    try { writeFileSync(values.relatorio, JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch { throw Error(aplicado ? 'Gravação concluída, mas não foi possível criar o relatório. Não sobrescreva arquivos; confira a simulação antes de repetir.' : 'Não foi possível criar o relatório. Escolha um caminho novo e gravável.'); }
  }
  if (plano.conflitos.length) process.exitCode = 2;
}
main().catch(e => { console.error(e instanceof Error ? e.message : 'Falha na importação.'); process.exitCode = 1; });
