import { StatusPendencia } from "../../generated/prisma/enums.ts";

interface DadosMensagemPendencia {
  clienteNome: string;
  competencia: string;
  status: StatusPendencia;
  observacao: string | null;
}

const rotulosStatus: Record<StatusPendencia, string> = {
  [StatusPendencia.PENDENTE]: "Pendente",
  [StatusPendencia.AGUARDANDO_CLIENTE]: "Aguardando cliente",
  [StatusPendencia.EM_ATENDIMENTO]: "Em atendimento",
  [StatusPendencia.CONCLUIDO]: "Concluído",
};

export function formatarCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

function resumirObservacao(observacao: string | null): string {
  if (!observacao) {
    return "Sem observações adicionais.";
  }

  const texto = observacao.replace(/\s+/g, " ").trim();

  if (texto.length <= 240) {
    return texto;
  }

  return `${texto.slice(0, 237).trimEnd()}...`;
}

export function gerarMensagemPendencia(dados: DadosMensagemPendencia): string {
  return [
    `Cliente: ${dados.clienteNome}`,
    `Competência: ${formatarCompetencia(dados.competencia)}`,
    `Status: ${rotulosStatus[dados.status]}`,
    `Observação: ${resumirObservacao(dados.observacao)}`,
  ].join("\n");
}
