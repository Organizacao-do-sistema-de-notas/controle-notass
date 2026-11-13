export type StatusPendencia =
  | "PENDENTE"
  | "AGUARDANDO_CLIENTE"
  | "EM_ATENDIMENTO"
  | "CONCLUIDO";

export type TipoHistoricoPendencia =
  | "CRIACAO"
  | "STATUS"
  | "RESPONSAVEL"
  | "OBSERVACAO"
  | "MENSAGEM_CONTADOR";

export interface Contabilidade {
  id: number;
  nome: string;
  criadoEm: string;
  _count?: {
    clientes: number;
  };
}

export interface Cliente {
  id: number;
  nome: string;
  ativo: boolean;
  contabilidadeId: number | null;
  contabilidade: Contabilidade | null;
  nomesAlternativos?: Array<{ nome: string }>;
  criadoEm: string;
}

export interface HistoricoPendencia {
  id: number;
  pendenciaId: number;
  tipo: TipoHistoricoPendencia;
  valorAnterior: string | null;
  valorNovo: string | null;
  autor: string | null;
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


export type FrequenciaAcesso = "NAO_DEFINIDA" | "MENSAL" | "EVENTUAL";

export interface NomeAlternativoCliente {
  id: number;
  clienteId: number;
  nome: string;
  criadoEm: string;
}

export interface ProcedimentoCliente {
  id: number;
  clienteId: number;
  titulo: string;
  descricao: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface HistoricoContabilidadeCliente {
  id: number;
  clienteId: number;
  nomeAnterior: string | null;
  nomeNova: string | null;
  autor: string | null;
  criadoEm: string;
}

export interface FichaCliente extends Cliente {
  frequenciaAcesso: FrequenciaAcesso;
  observacoesPermanentes: string | null;
  modeloMensagem: string | null;
  nomesAlternativos: NomeAlternativoCliente[];
  procedimentos: ProcedimentoCliente[];
  historicoContabilidades: HistoricoContabilidadeCliente[];
}
