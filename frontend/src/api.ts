import type {
  MensagemContadorResponse,
  PainelMensal,
  StatusPendencia,
} from "./types";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

async function requisicao<T>(caminho: string, opcoes?: RequestInit): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    headers: {
      "Content-Type": "application/json",
      ...opcoes?.headers,
    },
  });

  if (!resposta.ok) {
    let mensagem = "Não foi possível concluir a solicitação.";

    try {
      const corpo = (await resposta.json()) as { erro?: string };
      mensagem = corpo.erro || mensagem;
    } catch {
      // Mantém a mensagem padrão quando a resposta não é JSON.
    }

    throw new Error(mensagem);
  }

  return resposta.json() as Promise<T>;
}

export function listarCompetencias(): Promise<string[]> {
  return requisicao<string[]>("/painel/competencias");
}

export function obterPainel(competencia: string): Promise<PainelMensal> {
  return requisicao<PainelMensal>(`/painel?competencia=${encodeURIComponent(competencia)}`);
}

export function obterMensagemContador(id: number): Promise<MensagemContadorResponse> {
  return requisicao<MensagemContadorResponse>(`/pendencias/${id}/mensagem`);
}

export function salvarMensagemContador(
  id: number,
  mensagem: string,
  autor?: string,
): Promise<MensagemContadorResponse> {
  return requisicao<MensagemContadorResponse>(`/pendencias/${id}/mensagem`, {
    method: "PUT",
    body: JSON.stringify({ mensagem, autor }),
  });
}

export function atualizarStatusPendencia(
  id: number,
  status: StatusPendencia,
  autor?: string,
): Promise<unknown> {
  return requisicao(`/pendencias/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, autor }),
  });
}
