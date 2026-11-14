import { isDeepStrictEqual } from "node:util";
export type StatusExcel = "PENDENTE" | "AGUARDANDO" | "EM_ATENDIMENTO" | "OK";
export type RegistroMensal = { status: StatusExcel; observacao: string };
export type AvisoExtra = { id: string; titulo: string; texto: string };
export type EstadoExcel = {
  clientesExtras: string[];
  nomesAlterados: Record<string, string>;
  nomesBusca: Record<string, string[]>;
  informacoesClientes: Record<string, string>;
  avisosExtras: AvisoExtra[];
  registros: Record<string, Record<string, RegistroMensal>>;
};
export type AlteracaoExcel =
  | { tipo: "definir"; caminho: string[]; valor: unknown; anterior: unknown }
  | { tipo: "incluirCliente"; nome: string; apelidos: string[]; informacoes: string }
  | { tipo: "incluirAviso"; aviso: AvisoExtra };
export type DivergenciaExcel = { caminho: string[]; atual: unknown; local: unknown };
export class DadosExcelInvalidos extends Error {}
export class ConflitoExcel extends Error {
  constructor(public caminhos: string[][]) { super("Outro computador alterou estes dados. Confira o conteúdo salvo antes de tentar novamente."); }
}
export const estadoVazio = (): EstadoExcel => ({ clientesExtras: [], nomesAlterados: {}, nomesBusca: {}, informacoesClientes: {}, avisosExtras: [], registros: {} });
const proprio = (obj: object, chave: string) => Object.hasOwn(obj, chave);
function objeto(valor: unknown): valor is Record<string, unknown> { return !!valor && typeof valor === "object" && !Array.isArray(valor); }
function exigir(condicao: unknown, mensagem = "Dados do controle Excel inválidos."): asserts condicao {
  if (!condicao) throw new DadosExcelInvalidos(mensagem);
}
function campos(valor: Record<string, unknown>, permitidos: string[]) { exigir(Object.keys(valor).every(chave => permitidos.includes(chave))); }
function texto(valor: unknown, limite = 20000): valor is string { return typeof valor === "string" && valor.length <= limite; }
function chaveValida(valor: unknown): valor is string { return texto(valor, 1000) && !!valor.trim() && !["__proto__", "prototype", "constructor"].includes(valor); }
function nomes(valor: unknown): valor is string[] { return Array.isArray(valor) && valor.length <= 1000 && valor.every(item => texto(item, 1000) && !!item.trim()); }
const mesValido = (mes: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
const statusValido = (valor: unknown): valor is StatusExcel => ["PENDENTE", "AGUARDANDO", "EM_ATENDIMENTO", "OK"].includes(valor as string);
function validarAviso(valor: unknown): asserts valor is AvisoExtra {
  exigir(objeto(valor)); campos(valor, ["id", "titulo", "texto"]);
  exigir(chaveValida(valor.id) && texto(valor.titulo, 1000) && !!valor.titulo.trim() && texto(valor.texto) && !!valor.texto.trim());
}
export function validarEstado(valor: unknown): EstadoExcel {
  exigir(objeto(valor));
  const raiz = ["clientesExtras", "nomesAlterados", "nomesBusca", "informacoesClientes", "avisosExtras", "registros"];
  campos(valor, raiz); exigir(raiz.every(chave => proprio(valor, chave)));
  exigir(Array.isArray(valor.clientesExtras) && valor.clientesExtras.every(chaveValida));
  exigir(new Set(valor.clientesExtras).size === valor.clientesExtras.length);
  for (const grupo of ["nomesAlterados", "nomesBusca", "informacoesClientes"] as const) {
    const mapa = valor[grupo]; exigir(objeto(mapa));
    for (const [chave, item] of Object.entries(mapa)) {
      exigir(chaveValida(chave));
      exigir(grupo === "nomesBusca" ? nomes(item) : texto(item, grupo === "nomesAlterados" ? 1000 : 20000));
      if (grupo === "nomesAlterados") exigir((item as string).trim());
    }
  }
  exigir(Array.isArray(valor.avisosExtras)); valor.avisosExtras.forEach(validarAviso);
  exigir(new Set(valor.avisosExtras.map(item => item.id)).size === valor.avisosExtras.length);
  exigir(objeto(valor.registros));
  for (const [mes, lista] of Object.entries(valor.registros)) {
    exigir(mesValido(mes) && objeto(lista));
    for (const [chave, registro] of Object.entries(lista)) {
      exigir(chaveValida(chave) && objeto(registro)); campos(registro, ["status", "observacao"]);
      exigir(statusValido(registro.status) && texto(registro.observacao));
    }
  }
  return structuredClone(valor) as EstadoExcel;
}
export function validarAlteracoes(valor: unknown): AlteracaoExcel[] {
  exigir(Array.isArray(valor) && valor.length > 0 && valor.length <= 100);
  for (const op of valor) {
    exigir(objeto(op));
    if (op.tipo === "incluirCliente") {
      campos(op, ["tipo", "nome", "apelidos", "informacoes"]);
      exigir(chaveValida(op.nome) && nomes(op.apelidos) && texto(op.informacoes));
    } else if (op.tipo === "incluirAviso") {
      campos(op, ["tipo", "aviso"]); validarAviso(op.aviso);
    } else {
      exigir(op.tipo === "definir"); campos(op, ["tipo", "caminho", "valor", "anterior"]);
      exigir(Array.isArray(op.caminho) && op.caminho.every(chaveValida) && proprio(op, "valor") && proprio(op, "anterior"));
      const caminho = op.caminho;
      const [grupo, chave, cliente, campo] = caminho;
      const validarValor = (item: unknown) => {
        if (grupo === "nome" && caminho.length === 2) return texto(item, 1000) && !!item.trim();
        if (grupo === "apelidos" && caminho.length === 2) return nomes(item);
        if (grupo === "informacoes" && caminho.length === 2) return texto(item);
        if (grupo === "registro" && caminho.length === 4 && mesValido(chave) && chaveValida(cliente)) return campo === "status" ? statusValido(item) : campo === "observacao" && texto(item);
        if (grupo === "aviso" && caminho.length === 3) return ["titulo", "texto"].includes(cliente) && texto(item, cliente === "titulo" ? 1000 : 20000) && !!item.trim();
        return false;
      };
      exigir(validarValor(op.valor) && validarValor(op.anterior));
    }
  }
  return structuredClone(valor) as AlteracaoExcel[];
}
export function lerCampo(estado: EstadoExcel, caminho: string[]): unknown {
  const [grupo, chave, cliente, campo] = caminho;
  if (grupo === "nome") return estado.nomesAlterados[chave] ?? chave;
  if (grupo === "apelidos") return estado.nomesBusca[chave] ?? [];
  if (grupo === "informacoes") return estado.informacoesClientes[chave] ?? "";
  if (grupo === "registro") return campo === "status" ? estado.registros[chave]?.[cliente]?.status ?? "PENDENTE" : estado.registros[chave]?.[cliente]?.observacao ?? "";
  return estado.avisosExtras.find(item => item.id === chave)?.[cliente as "titulo" | "texto"];
}
function definir(estado: EstadoExcel, caminho: string[], valor: unknown) {
  const [grupo, chave, cliente, campo] = caminho;
  if (grupo === "nome") estado.nomesAlterados[chave] = valor as string;
  else if (grupo === "apelidos") estado.nomesBusca[chave] = valor as string[];
  else if (grupo === "informacoes") estado.informacoesClientes[chave] = valor as string;
  else if (grupo === "registro") {
    estado.registros[chave] ??= {};
    estado.registros[chave][cliente] ??= { status: "PENDENTE", observacao: "" };
    if (campo === "status") estado.registros[chave][cliente].status = valor as StatusExcel;
    else estado.registros[chave][cliente].observacao = valor as string;
  } else {
    const aviso = estado.avisosExtras.find(item => item.id === chave);
    exigir(aviso, "O aviso não existe mais. Atualize a tela.");
    aviso[cliente as "titulo" | "texto"] = valor as string;
  }
}
const igual = isDeepStrictEqual;
export function aplicarAlteracoes(atual: EstadoExcel, alteracoes: AlteracaoExcel[]): EstadoExcel {
  const proximo = structuredClone(atual);
  for (const op of alteracoes) {
    if (op.tipo === "definir") {
      const valorAtual = lerCampo(proximo, op.caminho);
      if (igual(valorAtual, op.valor)) continue; // Safe retry after a lost response.
      if (!igual(valorAtual, op.anterior)) throw new ConflitoExcel([op.caminho]);
      definir(proximo, op.caminho, op.valor);
    } else if (op.tipo === "incluirCliente") {
      if (proximo.clientesExtras.includes(op.nome)) {
        if (igual(proximo.nomesBusca[op.nome] ?? [], op.apelidos) && (proximo.informacoesClientes[op.nome] ?? "") === op.informacoes) continue;
        throw new ConflitoExcel([["cliente", op.nome]]);
      }
      proximo.clientesExtras.push(op.nome);
      proximo.nomesBusca[op.nome] = op.apelidos;
      proximo.informacoesClientes[op.nome] = op.informacoes;
    } else {
      const existente = proximo.avisosExtras.find(item => item.id === op.aviso.id);
      if (existente && !igual(existente, op.aviso)) throw new ConflitoExcel([["aviso", op.aviso.id]]);
      if (!existente) proximo.avisosExtras.push(op.aviso);
    }
  }
  return proximo;
}
export function importarAusentes(atual: EstadoExcel, local: EstadoExcel) {
  const proximo = structuredClone(atual);
  const conflitos: DivergenciaExcel[] = [];
  let importados = 0;
  for (const nome of local.clientesExtras) if (!proximo.clientesExtras.includes(nome)) { proximo.clientesExtras.push(nome); importados++; }
  function mesclar(destino: Record<string, unknown>, origem: Record<string, unknown>, prefixo: string[]) {
    for (const [chave, valor] of Object.entries(origem)) {
      if (!proprio(destino, chave)) { destino[chave] = structuredClone(valor); importados++; }
      else if (!igual(destino[chave], valor)) conflitos.push({ caminho: [...prefixo, chave], atual: destino[chave], local: valor });
    }
  }
  mesclar(proximo.nomesAlterados, local.nomesAlterados, ["nome"]);
  mesclar(proximo.nomesBusca, local.nomesBusca, ["apelidos"]);
  mesclar(proximo.informacoesClientes, local.informacoesClientes, ["informacoes"]);
  for (const [mes, clientes] of Object.entries(local.registros)) {
    proximo.registros[mes] ??= {};
    for (const [cliente, registro] of Object.entries(clientes)) {
      if (!proprio(proximo.registros[mes], cliente)) { proximo.registros[mes][cliente] = structuredClone(registro); importados++; }
      else mesclar(proximo.registros[mes][cliente] as unknown as Record<string, unknown>, registro, ["registro", mes, cliente]);
    }
  }
  for (const aviso of local.avisosExtras) {
    const existente = proximo.avisosExtras.find(item => item.id === aviso.id);
    if (!existente) { proximo.avisosExtras.push(structuredClone(aviso)); importados++; }
    else if (!igual(existente, aviso)) conflitos.push({ caminho: ["aviso", aviso.id], atual: existente, local: aviso });
  }
  return { estado: proximo, importados, conflitos };
}
