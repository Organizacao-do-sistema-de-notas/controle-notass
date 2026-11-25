import { API_URL } from "./api";
export type StatusExcel = "PENDENTE" | "AGUARDANDO" | "EM_ATENDIMENTO" | "OK";
export type RegistroMensal = { status: StatusExcel; observacao: string };
export type AvisoExtra = { id: string; titulo: string; texto: string };
export type EstadoExcel = {
  clientesExtras: string[]; nomesAlterados: Record<string, string>; nomesBusca: Record<string, string[]>;
  informacoesClientes: Record<string, string>; vinculosClientes: Record<string, number>; clientesInativos: string[]; avisosExtras: AvisoExtra[];
  registros: Record<string, Record<string, RegistroMensal>>;
};
export type AlteracaoExcel =
  | { tipo: "definir"; caminho: string[]; valor: unknown; anterior: unknown }
  | { tipo: "incluirCliente"; nome: string; apelidos: string[]; informacoes: string; idCriacao?: string }
  | { tipo: "incluirAviso"; aviso: AvisoExtra };
export type RespostaExcel = { instancia: string | null; revisao: number; estado: EstadoExcel | null; prioridades?: Record<string, string>; prioridadesExcluidas?: string[] };
export type ImportacaoExcel = RespostaExcel & { importados: number; totalConflitos: number; conflitos: { caminho: string[]; atual: unknown; local: unknown }[] };
export const estadoVazio = (): EstadoExcel => ({ clientesExtras: [], nomesAlterados: {}, nomesBusca: {}, informacoesClientes: {}, vinculosClientes: {}, clientesInativos: [], avisosExtras: [], registros: {} });
export class ErroExcel extends Error {
  constructor(mensagem: string, public status: number, public resposta?: RespostaExcel) { super(mensagem); }
}
async function solicitar<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`${API_URL}/excel/${caminho}`, {
    ...opcoes, cache: "no-store", headers: { "Content-Type": "application/json", ...opcoes?.headers },
  });
  const corpo = await resposta.json();
  if (!resposta.ok) throw new ErroExcel(corpo.erro || "Não foi possível acessar o controle compartilhado.", resposta.status, corpo.estado ? corpo : undefined);
  return corpo as T;
}
export const consultarExcel = (anterior?: RespostaExcel) => solicitar<RespostaExcel>(`estado${anterior?.instancia ? `?revisao=${anterior.revisao}&instancia=${encodeURIComponent(anterior.instancia)}` : ""}`);
export const alterarExcel = (alteracoes: AlteracaoExcel[]) => solicitar<RespostaExcel>("estado", { method: "PATCH", body: JSON.stringify({ alteracoes }) });
export const importarExcel = (estado: EstadoExcel) => solicitar<ImportacaoExcel>("importar", { method: "POST", body: JSON.stringify({ estado }) });
export const definir = (caminho: string[], valor: unknown, anterior: unknown): AlteracaoExcel => ({ tipo: "definir", caminho, valor, anterior });
