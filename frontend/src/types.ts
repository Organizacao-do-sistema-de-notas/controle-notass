export type StatusPendencia =
  | "PENDENTE"
  | "AGUARDANDO_CLIENTE"
  | "EM_ATENDIMENTO"
  | "CONCLUIDO";

export interface Contabilidade {
  id: number;
  nome: string;
  criadoEm: string;
}

export interface UltimaMovimentacao {
  tipo: string | null;
  autor: string | null;
  criadoEm: string;
}

export interface PendenciaPainel {
  id: number;
  competencia: string;
  status: StatusPendencia;
  responsavel: string | null;
  observacao: string | null;
  mensagemContador: string | null;
  temMensagemContador: boolean;
  criadoEm: string;
  atualizadoEm: string;
  concluidoEm: string | null;
  cliente: {
    id: number;
    nome: string;
    ativo: boolean;
  };
  contabilidade: Contabilidade | null;
  ultimaMovimentacao: UltimaMovimentacao;
}

export interface TotaisPainel {
  total: number;
  emAberto: number;
  pendente: number;
  aguardandoCliente: number;
  emAtendimento: number;
  concluido: number;
}

export interface PainelMensal {
  competencia: string;
  totais: TotaisPainel;
  pendencias: PendenciaPainel[];
}

export interface MensagemContadorResponse {
  pendenciaId: number;
  cliente: {
    id: number;
    nome: string;
  };
  contabilidade: Contabilidade | null;
  competencia: string;
  mensagem: string | null;
  temMensagem: boolean;
  linkWhatsApp: string | null;
}
