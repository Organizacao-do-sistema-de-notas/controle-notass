import { createHash, randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { bloquearCliente } from "../services/historico-contabilidade.service.ts";
import { bloquearPendencia } from "../services/historico-pendencia.service.ts";
import { estadoDoExcel, estadoDoPainel, gravarEstadoPendencia } from "../services/estado-pendencia.service.ts";
import { aplicarAlteracoes, ConflitoExcel, DadosExcelInvalidos, estadoVazio, importarAusentes, mercadosFixos, ordemDosAvisos, validarEstado, type AlteracaoExcel, type EstadoExcel, type MercadoFixo, type RegistroMensal } from "./estado.ts";

const principal = "principal";
export class ExclusaoClienteRecusada extends Error {
  constructor(public status: 404 | 409, mensagem: string) { super(mensagem); }
}
type Base = {
  versao: 2;
  estado: EstadoExcel;
  legado: unknown;
  origens: Record<string, number>;
  criacoes: Record<string, { id: number; assinatura: string }>;
  prioridades: Record<string, number>;
  controleMercadosSeparado?: boolean;
  registrosAntesUnificarEstado?: EstadoExcel['registros'];
};
const json = (valor: unknown) => valor as Prisma.InputJsonValue;
const assinatura = (valor: unknown) => createHash("sha256").update(JSON.stringify(valor)).digest("hex");
const listar = (tx: Prisma.TransactionClient) => tx.cliente.findMany({ include: { nomesAlternativos: { orderBy: { nome: "asc" } } }, orderBy: [{ nome: "asc" }, { id: "asc" }] });
function exigir(condicao: unknown, mensagem: string): asserts condicao { if (!condicao) throw new DadosExcelInvalidos(mensagem); }
function validarCadastro(nome: string, apelidos: string[], informacoes: string) {
  exigir(!!nome.trim() && nome.length <= 200, "O nome do cliente deve ter de 1 a 200 caracteres.");
  exigir(apelidos.length <= 30 && apelidos.every(item => !!item.trim() && item.length <= 200), "Informe até 30 apelidos de até 200 caracteres.");
  exigir(informacoes.length <= 20000, "As informações adicionais devem ter até 20000 caracteres.");
}
function chaves(estado: EstadoExcel) {
  return [...new Set([...estado.clientesExtras, ...Object.keys(estado.nomesAlterados), ...Object.keys(estado.nomesBusca), ...Object.keys(estado.informacoesClientes), ...Object.keys(estado.vinculosClientes), ...Object.values(estado.registros).flatMap(itens => Object.keys(itens))])];
}
async function criar(tx: Prisma.TransactionClient, base: Base, nome: string, apelidos: string[], informacoes: string, origem?: string) {
  validarCadastro(nome, apelidos, informacoes);
  const cliente = await tx.cliente.create({ data: { nome: nome.trim(), informacoesAdicionais: informacoes, nomesAlternativos: { create: [...new Set(apelidos.map(item => item.trim()))].map(nome => ({ nome })) } } });
  const chave = origem ?? `cliente:${cliente.id}`;
  base.estado.vinculosClientes[chave] = cliente.id;
  if (origem) base.origens[origem] = cliente.id;
  return { id: cliente.id, chave };
}
function separarMercados(base: Base) {
  if (base.controleMercadosSeparado) return;
  base.estado.controleMercados ??= {};
  base.estado.clientesSomenteMercados ??= [];
  for (const mercado of mercadosFixos) {
    // Only the reserved legacy origin identifies a control-created record.
    // A normal customer with the same name and its own ID is not reclassified.
    const legadoId = base.origens[mercado] ?? base.estado.vinculosClientes[mercado];
    if (legadoId && !base.estado.clientesSomenteMercados.includes(legadoId)) base.estado.clientesSomenteMercados.push(legadoId);
    const id = legadoId ?? base.prioridades[mercado];
    const chaves = [mercado, ...Object.keys(base.estado.vinculosClientes).filter(chave => base.estado.vinculosClientes[chave] === id)];
    for (const [mes, registros] of Object.entries(base.estado.registros)) {
      const registro = chaves.map(chave => registros[chave]).find(Boolean);
      if (!registro) continue;
      base.estado.controleMercados[mes] ??= {};
      base.estado.controleMercados[mes][mercado] ??= registro.status === "OK" ? "CONCLUIDO" : "PENDENTE";
    }
  }
  base.controleMercadosSeparado = true;
}
async function garantirPendencia(tx: Prisma.TransactionClient, id: number, competencia: string, registro: RegistroMensal) {
  exigir(await bloquearCliente(tx, id), "Cliente não encontrado. Atualize a lista.");
  const existente = await tx.pendencia.findUnique({ where: { clienteId_competencia: { clienteId: id, competencia } } });
  if (existente) return existente;
  const status = estadoDoPainel[registro.status];
  return tx.pendencia.create({ data: {
    clienteId: id, competencia, status, observacao: registro.observacao || null,
    concluidoEm: status === "CONCLUIDO" ? new Date() : null,
    historico: { create: [{ tipo: "CRIACAO", valorNovo: status }, ...(registro.observacao ? [{ tipo: "OBSERVACAO" as const, valorNovo: registro.observacao }] : [])] },
  } });
}
async function projetar(tx: Prisma.TransactionClient, base: Base) {
  base.registrosAntesUnificarEstado ??= structuredClone(base.estado.registros);
  separarMercados(base);
  const clientes = await listar(tx);
  const porId = new Map<number, string>();
  for (const [chave, id] of Object.entries(base.estado.vinculosClientes)) {
    base.origens[chave] ??= id;
    if (!porId.has(id)) porId.set(id, chave);
  }
  const exclusivos = base.estado.clientesSomenteMercados ?? [];
  const idsAtuais = clientes.filter(cliente => cliente.excluidoEm === null && !exclusivos.includes(cliente.id)).map(cliente => cliente.id).sort((a, b) => a - b);
  const ordemAnterior = base.estado.ordemClientesPainel ?? [];
  const estado = { ...estadoVazio(), registros: base.estado.registros, avisosExtras: base.estado.avisosExtras,
    avisosExcluidos: base.estado.avisosExcluidos ?? [], ordemAvisos: ordemDosAvisos(base.estado),
    controleMercados: base.estado.controleMercados ?? {}, clientesSomenteMercados: exclusivos,
    ordemClientesPainel: [...ordemAnterior.filter(id => idsAtuais.includes(id)), ...idsAtuais.filter(id => !ordemAnterior.includes(id))] };
  estado.frequenciasClientes = {};
  estado.clientesPorCompetencia = {};
  for (const cliente of clientes) {
    if (cliente.excluidoEm !== null || exclusivos.includes(cliente.id)) continue;
    const chave = porId.get(cliente.id) ?? `cliente:${cliente.id}`;
    base.origens[chave] ??= cliente.id;
    estado.clientesExtras.push(chave);
    estado.vinculosClientes[chave] = cliente.id;
    estado.frequenciasClientes[chave] = cliente.frequenciaAcesso;
    estado.nomesAlterados[chave] = cliente.nome;
    estado.nomesBusca[chave] = cliente.nomesAlternativos.map(item => item.nome);
    estado.informacoesClientes[chave] = cliente.informacoesAdicionais ?? "";
    if (!cliente.ativo) estado.clientesInativos.push(chave);
  }
  const pendencias = await tx.pendencia.findMany({ where: { cliente: { excluidoEm: null }, clienteId: { notIn: exclusivos } }, select: { clienteId: true, competencia: true, status: true, observacao: true }, orderBy: [{ competencia: "asc" }, { clienteId: "asc" }] });
  const existentes = new Set(pendencias.map(item => `${item.clienteId}:${item.competencia}`));
  const faltantes = Object.entries(estado.registros).flatMap(([mes, registros]) => Object.entries(registros).flatMap(([chave, registro]) => {
    const id = estado.vinculosClientes[chave];
    return id && !existentes.has(`${id}:${mes}`) ? [{ id, mes, registro }] : [];
  })).sort((a, b) => a.id - b.id || a.mes.localeCompare(b.mes));
  for (const item of faltantes) {
    const criada = await garantirPendencia(tx, item.id, item.mes, item.registro);
    pendencias.push({ clienteId: item.id, competencia: item.mes, status: criada.status, observacao: criada.observacao });
  }
  pendencias.sort((a, b) => a.competencia.localeCompare(b.competencia) || a.clienteId - b.clienteId);
  const chavesAtuais = new Map(Object.entries(estado.vinculosClientes).map(([chave, id]) => [id, chave]));
  for (const pendencia of pendencias) {
    const chave = chavesAtuais.get(pendencia.clienteId);
    if (chave) {
      (estado.clientesPorCompetencia[pendencia.competencia] ??= []).push(chave);
      estado.registros[pendencia.competencia] ??= {};
      estado.registros[pendencia.competencia][chave] ??= { status: estadoDoExcel[pendencia.status], observacao: pendencia.observacao ?? '' };
      estado.registros[pendencia.competencia][chave].status = estadoDoExcel[pendencia.status];
    }
  }
  base.estado = estado;
  for (const mercado of mercadosFixos) {
    if (base.prioridades[mercado]) continue;
    const candidatos = clientes.filter(cliente => cliente.excluidoEm === null && cliente.nome === mercado);
    const origem = base.origens[mercado];
    if (origem) base.prioridades[mercado] = origem;
    else if (candidatos.length === 1) base.prioridades[mercado] = candidatos[0].id;
  }
  return clientes;
}
async function carregar(tx: Prisma.TransactionClient, dados: unknown): Promise<Base> {
  if (dados && typeof dados === "object" && "versao" in dados && dados.versao === 2) {
    const base = structuredClone(dados) as Base;
    base.estado = validarEstado(base.estado);
    exigir(!!base.origens && !!base.criacoes && !!base.prioridades, "A transição do cadastro está incompleta. Os dados foram preservados.");
    return base;
  }
  const estado = validarEstado(dados);
  const base: Base = { versao: 2, estado: structuredClone(estado), legado: structuredClone(dados), origens: {}, criacoes: {}, prioridades: {} };
  const primeira = new Map<number, string>();
  for (const chave of chaves(estado)) {
    if (mercadosFixos.includes(chave as MercadoFixo) && !estado.vinculosClientes[chave]) continue;
    let id = estado.vinculosClientes[chave];
    const nome = estado.nomesAlterados[chave] ?? chave;
    const apelidos = estado.nomesBusca[chave] ?? [];
    const informacoes = estado.informacoesClientes[chave] ?? "";
    validarCadastro(nome, apelidos, informacoes);
    if (!id) id = (await criar(tx, base, nome, apelidos, informacoes, chave)).id;
    else {
      const cliente = await bloquearCliente(tx, id);
      exigir(cliente, `O cadastro #${id} da linha ${nome} não existe. A transição foi interrompida e os dados foram preservados.`);
      const atuais = await tx.clienteNomeAlternativo.findMany({ where: { clienteId: id } });
      const nomes = [...new Set([...atuais.map(item => item.nome), ...apelidos, ...(nome !== cliente.nome ? [nome] : [])])];
      const info = !informacoes || informacoes === cliente.informacoesAdicionais ? cliente.informacoesAdicionais ?? "" : [cliente.informacoesAdicionais, informacoes].filter(Boolean).join("\n\n");
      validarCadastro(cliente.nome, nomes, info);
      await tx.cliente.update({ where: { id }, data: { informacoesAdicionais: info } });
      const novos = nomes.filter(nome => !atuais.some(item => item.nome === nome));
      if (novos.length) await tx.clienteNomeAlternativo.createMany({ data: novos.map(nome => ({ clienteId: id, nome })) });
    }
    base.origens[chave] = id;
    const anterior = primeira.get(id);
    if (anterior) {
      for (const [mes, registros] of Object.entries(base.estado.registros)) {
        const adicional = registros[chave];
        if (!adicional) continue;
        exigir(!registros[anterior] || isDeepStrictEqual(registros[anterior], adicional), `Há registros mensais diferentes para o cadastro #${id} em ${mes}. A transição exige revisão; nenhum dado foi apagado.`);
        registros[anterior] ??= adicional;
        delete registros[chave];
      }
      delete base.estado.vinculosClientes[chave];
    } else { primeira.set(id, chave); base.estado.vinculosClientes[chave] = id; }
  }
  return base;
}
async function chaveDoCliente(tx: Prisma.TransactionClient, base: Base, chave: string) {
  if (base.estado.vinculosClientes[chave]) return chave;
  const origem = base.origens[chave];
  if (origem) {
    const existente = Object.keys(base.estado.vinculosClientes).find(item => base.estado.vinculosClientes[item] === origem);
    exigir(existente, "O cadastro desta linha não está mais disponível.");
    return existente;
  }
  exigir(!/^cliente:/.test(chave), "Cliente não encontrado. Atualize a lista.");
  exigir(!mercadosFixos.includes(chave as MercadoFixo), "O controle fixo dos mercados não cria clientes.");
  // Compatibility for saved rows/old browser requests, never a match by name.
  return (await criar(tx, base, chave, [], "", chave)).chave;
}
async function editar(tx: Prisma.TransactionClient, base: Base, alteracoes: AlteracaoExcel[]) {
  const ops: AlteracaoExcel[] = [];
  for (const op of alteracoes) {
    if (op.tipo === "incluirClienteMes") {
      const chave = Object.keys(base.estado.vinculosClientes).find(chave => base.estado.vinculosClientes[chave] === op.clienteId);
      exigir(chave && await bloquearCliente(tx, op.clienteId), "Cliente não encontrado. Atualize a lista.");
      const atual = base.estado.registros[op.competencia]?.[chave] ?? { status: "PENDENTE" as const, observacao: "" };
      const pendencia = await garantirPendencia(tx, op.clienteId, op.competencia, atual);
      base.estado.registros[op.competencia] ??= {};
      const status = estadoDoExcel[pendencia.status];
      base.estado.registros[op.competencia][chave] ??= { status, observacao: pendencia.observacao ?? "" };
    } else if (op.tipo === "incluirCliente") {
      validarCadastro(op.nome, op.apelidos, op.informacoes);
      const hash = assinatura({ nome: op.nome, apelidos: op.apelidos, informacoes: op.informacoes });
      const anterior = op.idCriacao ? base.criacoes[op.idCriacao] : undefined;
      if (anterior) { exigir(anterior.assinatura === hash, "Esta solicitação já criou um cliente. Confira o cadastro antes de tentar novamente."); continue; }
      exigir(op.idCriacao || !base.origens[op.nome] || base.estado.vinculosClientes[op.nome], "Esta linha foi retirada do cadastro. Atualize a página antes de criar outro cliente.");
      if (!op.idCriacao && base.estado.vinculosClientes[op.nome]) {
        const atual = base.estado;
        if (atual.nomesAlterados[op.nome] === op.nome && isDeepStrictEqual(atual.nomesBusca[op.nome], op.apelidos) && atual.informacoesClientes[op.nome] === op.informacoes) continue;
        throw new ConflitoExcel([["cliente", op.nome]]);
      }
      const criado = await criar(tx, base, op.nome, op.apelidos, op.informacoes, op.idCriacao ? undefined : op.nome);
      if (op.idCriacao) base.criacoes[op.idCriacao] = { id: criado.id, assinatura: hash };
    } else if (op.tipo === "definir") {
      exigir(op.caminho[0] !== "vinculo", "O cadastro agora é único. Atualize a página: não é necessário vincular ou desvincular fichas.");
      const caminho = [...op.caminho];
      if (caminho[0] === "registro" && caminho[3] === "status") {
        const mercado = mercadosFixos.find(nome => nome === caminho[2] || (base.estado.clientesSomenteMercados?.includes(base.prioridades[nome])
          && (caminho[2] === `cliente:${base.prioridades[nome]}` || base.origens[caminho[2]] === base.prioridades[nome])));
        if (mercado) {
          ops.push({ tipo: "definirMercado", competencia: caminho[1], mercado,
            status: op.valor === "OK" ? "CONCLUIDO" : "PENDENTE", anterior: op.anterior === "OK" ? "CONCLUIDO" : "PENDENTE" });
          continue;
        }
      }
      if (["nome", "apelidos", "informacoes", "registro"].includes(caminho[0])) {
        const posicao = caminho[0] === "registro" ? 2 : 1;
        caminho[posicao] = await chaveDoCliente(tx, base, caminho[posicao]);
      }
      ops.push({ ...op, caminho });
    } else ops.push(op);
  }
  const ids = [...new Set(ops.flatMap(op => op.tipo === "definir" && ["nome", "apelidos", "informacoes"].includes(op.caminho[0]) ? [base.estado.vinculosClientes[op.caminho[1]]] : []))].sort((a, b) => a - b);
  const estados = ops.filter((op): op is Extract<AlteracaoExcel, { tipo: 'definir' }> => op.tipo === 'definir' && op.caminho[0] === 'registro' && op.caminho[3] === 'status');
  const bloqueios = [...new Set([...ids, ...estados.map(op => base.estado.vinculosClientes[op.caminho[2]])])].sort((a, b) => a - b);
  for (const id of bloqueios) exigir(await bloquearCliente(tx, id), "Cliente não encontrado. Atualize a lista.");
  await projetar(tx, base);
  const antes = base.estado;
  const depois = aplicarAlteracoes(antes, ops);
  const gravados = new Set<string>();
  for (const op of estados) {
    const [, mes, chave] = op.caminho, par = JSON.stringify([mes, chave]);
    if (gravados.has(par)) continue;
    gravados.add(par);
    const registro = depois.registros[mes]?.[chave];
    if (!registro) continue;
    const pendencia = await garantirPendencia(tx, depois.vinculosClientes[chave], mes, antes.registros[mes]?.[chave] ?? { status: 'PENDENTE', observacao: '' });
    const atual = await bloquearPendencia(tx, pendencia.id);
    exigir(atual, 'Pendência não encontrada. Atualize a tela.');
    await gravarEstadoPendencia(tx, atual, estadoDoPainel[registro.status]);
  }
  for (const id of ids) {
    const chave = Object.keys(depois.vinculosClientes).find(item => depois.vinculosClientes[item] === id)!;
    const nome = depois.nomesAlterados[chave], apelidos = depois.nomesBusca[chave], info = depois.informacoesClientes[chave];
    validarCadastro(nome, apelidos, info);
    await tx.cliente.update({ where: { id }, data: {
      nome: nome !== antes.nomesAlterados[chave] ? nome.trim() : undefined,
      informacoesAdicionais: info !== antes.informacoesClientes[chave] ? info : undefined,
    } });
    if (!isDeepStrictEqual(apelidos, antes.nomesBusca[chave])) {
      const nomes = [...new Set(apelidos.map(item => item.trim()))];
      await tx.clienteNomeAlternativo.deleteMany({ where: { clienteId: id, nome: { notIn: nomes } } });
      const atuais = await tx.clienteNomeAlternativo.findMany({ where: { clienteId: id } });
      const novos = nomes.filter(nome => !atuais.some(item => item.nome === nome));
      if (novos.length) await tx.clienteNomeAlternativo.createMany({ data: novos.map(nome => ({ clienteId: id, nome })) });
    }
  }
  base.estado = depois;
}
async function importar(tx: Prisma.TransactionClient, base: Base, local: EstadoExcel) {
  exigir(!Object.keys(local.vinculosClientes).length, "Não importe identificadores de fichas de outro banco.");
  const convertido = estadoVazio();
  convertido.avisosExtras = local.avisosExtras;
  convertido.controleMercados = structuredClone(local.controleMercados ?? {});
  let criados = 0;
  for (const origem of chaves(local)) {
    if (mercadosFixos.includes(origem as MercadoFixo)) {
      for (const [mes, registros] of Object.entries(local.registros)) if (registros[origem]) {
        convertido.controleMercados[mes] ??= {};
        convertido.controleMercados[mes][origem as MercadoFixo] ??= registros[origem].status === "OK" ? "CONCLUIDO" : "PENDENTE";
      }
      continue;
    }
    let chave: string;
    const conhecido = base.estado.vinculosClientes[origem] ?? base.origens[origem];
    if (conhecido) chave = await chaveDoCliente(tx, base, origem);
    else {
      chave = (await criar(tx, base, local.nomesAlterados[origem] ?? origem, local.nomesBusca[origem] ?? [], local.informacoesClientes[origem] ?? "", origem)).chave;
      criados += 1 + Number(Object.hasOwn(local.nomesAlterados, origem)) + Number(Object.hasOwn(local.nomesBusca, origem)) + Number(Object.hasOwn(local.informacoesClientes, origem));
    }
    convertido.clientesExtras.push(chave);
    if (Object.hasOwn(local.nomesAlterados, origem)) convertido.nomesAlterados[chave] = local.nomesAlterados[origem];
    if (Object.hasOwn(local.nomesBusca, origem)) convertido.nomesBusca[chave] = local.nomesBusca[origem];
    if (Object.hasOwn(local.informacoesClientes, origem)) convertido.informacoesClientes[chave] = local.informacoesClientes[origem];
    for (const [mes, registros] of Object.entries(local.registros)) if (registros[origem]) {
      convertido.registros[mes] ??= {}; convertido.registros[mes][chave] = registros[origem];
    }
  }
  await projetar(tx, base);
  const resultado = importarAusentes(base.estado, convertido);
  base.estado = resultado.estado;
  return { importados: resultado.importados + criados, totalConflitos: resultado.conflitos.length, conflitos: resultado.conflitos.slice(0, 500) };
}
export async function acessarCadastro(opcoes?: { alteracoes?: AlteracaoExcel[]; importar?: EstadoExcel; excluir?: { id: number; nomeConfirmado: string } }) {
  return prisma.$transaction(async tx => {
    const instancia = randomUUID();
    const inicial = JSON.stringify(estadoVazio());
    await tx.$executeRaw`INSERT INTO "ExcelCompartilhado" ("id", "instancia", "dados", "revisao") VALUES (${principal}, ${instancia}, ${inicial}::jsonb, 0) ON CONFLICT ("id") DO NOTHING`;
    await tx.$queryRaw`SELECT "id" FROM "ExcelCompartilhado" WHERE "id" = ${principal} FOR UPDATE`;
    const registro = await tx.excelCompartilhado.findUniqueOrThrow({ where: { id: principal } });
    const base = await carregar(tx, registro.dados);
    let cadastros = await projetar(tx, base);
    let importacao;
    if (opcoes?.excluir) {
      const cliente = await bloquearCliente(tx, opcoes.excluir.id, true);
      if (!cliente) throw new ExclusaoClienteRecusada(404, "Cliente não encontrado.");
      if (cliente.nome !== opcoes.excluir.nomeConfirmado) throw new ExclusaoClienteRecusada(409, "O nome deste cliente foi alterado. Atualize a lista e confirme novamente antes de excluir.");
      if (!cliente.excluidoEm) await tx.cliente.update({ where: { id: cliente.id }, data: { excluidoEm: new Date() } });
    }
    if (opcoes?.alteracoes) await editar(tx, base, opcoes.alteracoes);
    if (opcoes?.importar) importacao = await importar(tx, base, opcoes.importar);
    if (opcoes) cadastros = await projetar(tx, base);
    const salvo = !isDeepStrictEqual(registro.dados, base) ? await tx.excelCompartilhado.update({ where: { id: principal }, data: { dados: json(base), revisao: { increment: 1 } } }) : registro;
    const prioridades = Object.fromEntries(Object.entries(base.prioridades).flatMap(([nome, id]) => {
      const chave = Object.keys(base.estado.vinculosClientes).find(chave => base.estado.vinculosClientes[chave] === id);
      return chave ? [[nome, chave]] : [];
    }));
    const excluidos = new Set(cadastros.filter(cliente => cliente.excluidoEm !== null).map(cliente => cliente.id));
    const prioridadesExcluidas = Object.entries(base.prioridades).filter(([, id]) => excluidos.has(id)).map(([nome]) => nome);
    return { instancia: salvo.instancia, revisao: salvo.revisao, estado: base.estado, prioridades, prioridadesExcluidas, ...importacao };
  }, { maxWait: 10000, timeout: 30000 });
}

// Opening the registry must also see saved Excel-only clients before the user
// has visited Excel in this session. The row lock makes concurrent first reads safe.
export async function garantirCadastroUnico() {
  const linhas = await prisma.$queryRaw<{ pronto: boolean | null }[]>`SELECT ("dados"->>'versao') = '2' AS pronto FROM "ExcelCompartilhado" WHERE "id" = ${principal}`;
  if (!linhas[0]?.pronto) await acessarCadastro();
}
