import { useEffect, useMemo, useState } from "react";

import {
  atualizarStatusPendencia,
  listarCompetencias,
  obterMensagemContador,
  obterPainel,
  salvarMensagemContador,
} from "./api";
import type {
  MensagemContadorResponse,
  PainelMensal,
  PendenciaPainel,
  StatusPendencia,
} from "./types";

const rotulosStatus: Record<StatusPendencia, string> = {
  PENDENTE: "Pendente",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  EM_ATENDIMENTO: "Em atendimento",
  CONCLUIDO: "Concluído",
};

const statusDisponiveis = Object.keys(rotulosStatus) as StatusPendencia[];

type FiltroStatus = "TODOS" | StatusPendencia;

interface EditorMensagem {
  pendenciaId: number;
  clienteNome: string;
  mensagem: string;
  linkWhatsApp: string | null;
  salvando: boolean;
}

function formatarCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

function formatarData(data: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(data));
}

function criarModeloMensagem(clienteNome: string): string {
  return `${clienteNome}\nNF-e, NFC-e, Entradas\nNotas inutilizadas\nNFC-e:\n`;
}

export function App() {
  const [competencias, setCompetencias] = useState<string[]>([]);
  const [competencia, setCompetencia] = useState("");
  const [painel, setPainel] = useState<PainelMensal | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [editor, setEditor] = useState<EditorMensagem | null>(null);
  const [carregandoMensagem, setCarregandoMensagem] = useState(false);
  const [alterandoStatusId, setAlterandoStatusId] = useState<number | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [autor, setAutor] = useState(() => localStorage.getItem("controle-notas-autor") || "");

  async function carregarCompetencias() {
    try {
      setCarregando(true);
      setErro(null);
      const lista = await listarCompetencias();
      setCompetencias(lista);

      if (lista.length > 0) {
        setCompetencia((atual) => (atual && lista.includes(atual) ? atual : lista[0]));
      } else {
        setCompetencia("");
        setPainel(null);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar competências.");
    } finally {
      setCarregando(false);
    }
  }

  async function carregarPainel(competenciaSelecionada: string) {
    if (!competenciaSelecionada) {
      setPainel(null);
      return;
    }

    try {
      setCarregando(true);
      setErro(null);
      const dados = await obterPainel(competenciaSelecionada);
      setPainel(dados);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar painel.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarCompetencias();
  }, []);

  useEffect(() => {
    if (competencia) {
      void carregarPainel(competencia);
    }
  }, [competencia]);

  useEffect(() => {
    localStorage.setItem("controle-notas-autor", autor);
  }, [autor]);

  useEffect(() => {
    if (!aviso) return;
    const timer = window.setTimeout(() => setAviso(null), 2500);
    return () => window.clearTimeout(timer);
  }, [aviso]);

  const pendenciasFiltradas = useMemo(() => {
    if (!painel) return [];
    if (filtroStatus === "TODOS") return painel.pendencias;
    return painel.pendencias.filter((item) => item.status === filtroStatus);
  }, [painel, filtroStatus]);

  async function abrirEditorMensagem(item: PendenciaPainel) {
    try {
      setCarregandoMensagem(true);
      setErro(null);
      const dados = await obterMensagemContador(item.id);
      setEditor({
        pendenciaId: dados.pendenciaId,
        clienteNome: dados.cliente.nome,
        mensagem: dados.mensagem ?? criarModeloMensagem(dados.cliente.nome),
        linkWhatsApp: dados.linkWhatsApp,
        salvando: false,
      });
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao abrir mensagem.");
    } finally {
      setCarregandoMensagem(false);
    }
  }

  async function salvarMensagem() {
    if (!editor) return;

    try {
      setEditor({ ...editor, salvando: true });
      setErro(null);
      const dados = await salvarMensagemContador(
        editor.pendenciaId,
        editor.mensagem,
        autor.trim() || undefined,
      );

      setEditor({
        ...editor,
        mensagem: dados.mensagem ?? "",
        linkWhatsApp: dados.linkWhatsApp,
        salvando: false,
      });
      setAviso("Mensagem salva.");
      await carregarPainel(competencia);
    } catch (error) {
      setEditor({ ...editor, salvando: false });
      setErro(error instanceof Error ? error.message : "Erro ao salvar mensagem.");
    }
  }

  async function copiarMensagem(mensagem: string) {
    try {
      await navigator.clipboard.writeText(mensagem);
      setAviso("Mensagem copiada.");
    } catch {
      setErro("Não foi possível copiar a mensagem automaticamente.");
    }
  }

  async function alterarStatus(item: PendenciaPainel, novoStatus: StatusPendencia) {
    if (novoStatus === item.status) return;

    try {
      setAlterandoStatusId(item.id);
      setErro(null);
      await atualizarStatusPendencia(item.id, novoStatus, autor.trim() || undefined);
      await carregarPainel(competencia);
      setAviso("Status atualizado.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao atualizar status.");
    } finally {
      setAlterandoStatusId(null);
    }
  }

  function abrirWhatsApp(dados: MensagemContadorResponse | EditorMensagem) {
    if (!dados.linkWhatsApp) return;
    window.open(dados.linkWhatsApp, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">Pedroso Automação</span>
          <h1>Controle de Notas</h1>
          <p>Acompanhamento mensal das pendências enviadas pelas contabilidades.</p>
        </div>

        <label className="autor-field">
          <span>Quem está usando</span>
          <input
            value={autor}
            onChange={(event) => setAutor(event.target.value)}
            placeholder="Seu nome"
          />
        </label>
      </header>

      <main>
        <section className="toolbar panel">
          <label>
            <span>Competência</span>
            <select
              value={competencia}
              onChange={(event) => setCompetencia(event.target.value)}
              disabled={competencias.length === 0}
            >
              {competencias.length === 0 ? (
                <option value="">Nenhuma competência</option>
              ) : (
                competencias.map((item) => (
                  <option key={item} value={item}>
                    {formatarCompetencia(item)}
                  </option>
                ))
              )}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select
              value={filtroStatus}
              onChange={(event) => setFiltroStatus(event.target.value as FiltroStatus)}
            >
              <option value="TODOS">Todos</option>
              {statusDisponiveis.map((status) => (
                <option key={status} value={status}>
                  {rotulosStatus[status]}
                </option>
              ))}
            </select>
          </label>

          <button className="button secondary" onClick={() => void carregarPainel(competencia)}>
            Atualizar
          </button>
        </section>

        {erro && <div className="alert error">{erro}</div>}
        {aviso && <div className="toast">{aviso}</div>}

        {painel && (
          <section className="summary-grid">
            <article className="summary-card">
              <span>Total</span>
              <strong>{painel.totais.total}</strong>
            </article>
            <article className="summary-card">
              <span>Em aberto</span>
              <strong>{painel.totais.emAberto}</strong>
            </article>
            <article className="summary-card">
              <span>Aguardando cliente</span>
              <strong>{painel.totais.aguardandoCliente}</strong>
            </article>
            <article className="summary-card">
              <span>Em atendimento</span>
              <strong>{painel.totais.emAtendimento}</strong>
            </article>
            <article className="summary-card success-card">
              <span>Concluídas</span>
              <strong>{painel.totais.concluido}</strong>
            </article>
          </section>
        )}

        <section className="content-section">
          <div className="section-heading">
            <div>
              <h2>Pendências do mês</h2>
              <p>{pendenciasFiltradas.length} registro(s) exibido(s)</p>
            </div>
          </div>

          {carregando ? (
            <div className="empty-state panel">Carregando informações...</div>
          ) : pendenciasFiltradas.length === 0 ? (
            <div className="empty-state panel">
              Nenhuma pendência encontrada para os filtros atuais.
            </div>
          ) : (
            <div className="pendencias-grid">
              {pendenciasFiltradas.map((item) => (
                <article className="pendencia-card" key={item.id}>
                  <div className="card-heading">
                    <div>
                      <h3>{item.cliente.nome}</h3>
                      <p>{item.contabilidade?.nome ?? "Sem contabilidade vinculada"}</p>
                    </div>
                    <span className={`status-badge status-${item.status.toLowerCase()}`}>
                      {rotulosStatus[item.status]}
                    </span>
                  </div>

                  <div className="card-info-grid">
                    <div>
                      <span>Responsável</span>
                      <strong>{item.responsavel || "Não definido"}</strong>
                    </div>
                    <div>
                      <span>Última alteração</span>
                      <strong>{formatarData(item.atualizadoEm)}</strong>
                    </div>
                  </div>

                  {item.observacao && <p className="observacao">{item.observacao}</p>}

                  <div className="message-state">
                    <span>Mensagem para o contador</span>
                    <strong className={item.temMensagemContador ? "ready" : "missing"}>
                      {item.temMensagemContador ? "Pronta" : "Ainda não preenchida"}
                    </strong>
                  </div>

                  <div className="card-actions">
                    <select
                      aria-label={`Status de ${item.cliente.nome}`}
                      value={item.status}
                      disabled={alterandoStatusId === item.id}
                      onChange={(event) =>
                        void alterarStatus(item, event.target.value as StatusPendencia)
                      }
                    >
                      {statusDisponiveis.map((status) => (
                        <option key={status} value={status}>
                          {rotulosStatus[status]}
                        </option>
                      ))}
                    </select>

                    <button
                      className="button primary"
                      onClick={() => void abrirEditorMensagem(item)}
                      disabled={carregandoMensagem}
                    >
                      {item.temMensagemContador ? "Editar mensagem" : "Criar mensagem"}
                    </button>

                    {item.mensagemContador && (
                      <button
                        className="button secondary"
                        onClick={() => void copiarMensagem(item.mensagemContador!)}
                      >
                        Copiar
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {editor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditor(null)}>
          <section
            className="message-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Mensagem para o contador</span>
                <h2 id="message-title">{editor.clienteNome}</h2>
              </div>
              <button className="close-button" onClick={() => setEditor(null)} aria-label="Fechar">
                ×
              </button>
            </div>

            <p className="modal-help">
              Escreva somente o resumo que será copiado ou enviado ao contador. Informações internas do
              atendimento ficam fora desta mensagem.
            </p>

            <textarea
              value={editor.mensagem}
              onChange={(event) => setEditor({ ...editor, mensagem: event.target.value })}
              rows={14}
              autoFocus
            />

            <div className="modal-actions">
              <button className="button secondary" onClick={() => setEditor(null)}>
                Cancelar
              </button>
              <button
                className="button secondary"
                onClick={() => void copiarMensagem(editor.mensagem)}
                disabled={!editor.mensagem.trim()}
              >
                Copiar
              </button>
              <button
                className="button secondary"
                onClick={() => abrirWhatsApp(editor)}
                disabled={!editor.linkWhatsApp}
              >
                Abrir WhatsApp
              </button>
              <button
                className="button primary"
                onClick={() => void salvarMensagem()}
                disabled={editor.salvando}
              >
                {editor.salvando ? "Salvando..." : "Salvar mensagem"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
