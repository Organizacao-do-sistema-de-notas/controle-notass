import { useEffect, useMemo, useState } from "react";

import {
  atualizarStatusPendencia,
  criarCliente,
  criarContabilidade,
  criarPendencia,
  listarClientes,
  listarCompetencias,
  listarContabilidades,
  listarHistoricoPendencia,
  obterMensagemContador,
  obterPainel,
  salvarMensagemContador,
} from "./api";
import type {
  Cliente,
  Contabilidade,
  HistoricoPendencia,
  MensagemContadorResponse,
  PainelMensal,
  PendenciaPainel,
  StatusPendencia,
  TipoHistoricoPendencia,
} from "./types";

const rotulosStatus: Record<StatusPendencia, string> = {
  PENDENTE: "Pendente",
  AGUARDANDO_CLIENTE: "Aguardando cliente",
  EM_ATENDIMENTO: "Em atendimento",
  CONCLUIDO: "Concluído",
};

const rotulosHistorico: Record<TipoHistoricoPendencia, string> = {
  CRIACAO: "Pendência criada",
  STATUS: "Status alterado",
  RESPONSAVEL: "Responsável alterado",
  OBSERVACAO: "Observação alterada",
  MENSAGEM_CONTADOR: "Mensagem do contador alterada",
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

interface ModalHistorico {
  clienteNome: string;
  registros: HistoricoPendencia[];
  carregando: boolean;
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

function competenciaAtual(): string {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}`;
}

function criarModeloMensagem(clienteNome: string): string {
  return `${clienteNome}\nNF-e, NFC-e, Entradas\nNotas inutilizadas\nNFC-e:\n`;
}

function formatarValorHistorico(valor: string | null): string {
  if (!valor) return "—";
  if (valor in rotulosStatus) return rotulosStatus[valor as StatusPendencia];
  return valor;
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

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contabilidades, setContabilidades] = useState<Contabilidade[]>([]);
  const [carregandoCadastros, setCarregandoCadastros] = useState(false);

  const [modalCliente, setModalCliente] = useState(false);
  const [clienteNome, setClienteNome] = useState("");
  const [clienteContabilidadeId, setClienteContabilidadeId] = useState("");
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  const [modalContabilidade, setModalContabilidade] = useState(false);
  const [contabilidadeNome, setContabilidadeNome] = useState("");
  const [salvandoContabilidade, setSalvandoContabilidade] = useState(false);

  const [modalPendencia, setModalPendencia] = useState(false);
  const [pendenciaClienteId, setPendenciaClienteId] = useState("");
  const [pendenciaCompetencia, setPendenciaCompetencia] = useState(competenciaAtual());
  const [pendenciaStatus, setPendenciaStatus] = useState<StatusPendencia>("PENDENTE");
  const [pendenciaResponsavel, setPendenciaResponsavel] = useState("");
  const [pendenciaObservacao, setPendenciaObservacao] = useState("");
  const [salvandoPendencia, setSalvandoPendencia] = useState(false);

  const [historicoModal, setHistoricoModal] = useState<ModalHistorico | null>(null);

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

  async function carregarCadastros() {
    try {
      setCarregandoCadastros(true);
      setErro(null);
      const [listaClientes, listaContabilidades] = await Promise.all([
        listarClientes(),
        listarContabilidades(),
      ]);
      setClientes(listaClientes);
      setContabilidades(listaContabilidades);
      return { listaClientes, listaContabilidades };
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao carregar cadastros.");
      return null;
    } finally {
      setCarregandoCadastros(false);
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

  async function abrirNovoCliente() {
    setClienteNome("");
    setClienteContabilidadeId("");
    await carregarCadastros();
    setModalCliente(true);
  }

  async function salvarNovoCliente(event: React.FormEvent) {
    event.preventDefault();
    if (!clienteNome.trim()) return;

    try {
      setSalvandoCliente(true);
      setErro(null);
      await criarCliente(
        clienteNome.trim(),
        clienteContabilidadeId ? Number(clienteContabilidadeId) : null,
      );
      await carregarCadastros();
      setModalCliente(false);
      setAviso("Cliente cadastrado.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao cadastrar cliente.");
    } finally {
      setSalvandoCliente(false);
    }
  }

  function abrirNovaContabilidade() {
    setContabilidadeNome("");
    setModalContabilidade(true);
  }

  async function salvarNovaContabilidade(event: React.FormEvent) {
    event.preventDefault();
    if (!contabilidadeNome.trim()) return;

    try {
      setSalvandoContabilidade(true);
      setErro(null);
      await criarContabilidade(contabilidadeNome.trim());
      await carregarCadastros();
      setModalContabilidade(false);
      setAviso("Contabilidade cadastrada.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao cadastrar contabilidade.");
    } finally {
      setSalvandoContabilidade(false);
    }
  }

  async function abrirNovaPendencia() {
    const dados = await carregarCadastros();
    const ativos = (dados?.listaClientes ?? clientes).filter((cliente) => cliente.ativo);

    setPendenciaClienteId(ativos[0] ? String(ativos[0].id) : "");
    setPendenciaCompetencia(competencia || competenciaAtual());
    setPendenciaStatus("PENDENTE");
    setPendenciaResponsavel(autor.trim());
    setPendenciaObservacao("");
    setModalPendencia(true);
  }

  async function salvarNovaPendencia(event: React.FormEvent) {
    event.preventDefault();
    if (!pendenciaClienteId || !pendenciaCompetencia) return;

    try {
      setSalvandoPendencia(true);
      setErro(null);
      await criarPendencia({
        clienteId: Number(pendenciaClienteId),
        competencia: pendenciaCompetencia,
        status: pendenciaStatus,
        responsavel: pendenciaResponsavel.trim() || undefined,
        observacao: pendenciaObservacao.trim() || undefined,
        autor: autor.trim() || undefined,
      });

      const lista = await listarCompetencias();
      setCompetencias(lista);
      setModalPendencia(false);
      setAviso("Pendência criada.");

      if (pendenciaCompetencia === competencia) {
        await carregarPainel(pendenciaCompetencia);
      } else {
        setCompetencia(pendenciaCompetencia);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao criar pendência.");
    } finally {
      setSalvandoPendencia(false);
    }
  }

  async function abrirHistorico(item: PendenciaPainel) {
    setHistoricoModal({
      clienteNome: item.cliente.nome,
      registros: [],
      carregando: true,
    });

    try {
      setErro(null);
      const registros = await listarHistoricoPendencia(item.id);
      setHistoricoModal({
        clienteNome: item.cliente.nome,
        registros,
        carregando: false,
      });
    } catch (error) {
      setHistoricoModal(null);
      setErro(error instanceof Error ? error.message : "Erro ao carregar histórico.");
    }
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

          <div className="toolbar-spacer" />

          <button className="button secondary" onClick={abrirNovaContabilidade}>
            Nova contabilidade
          </button>
          <button className="button secondary" onClick={() => void abrirNovoCliente()}>
            Novo cliente
          </button>
          <button className="button primary" onClick={() => void abrirNovaPendencia()}>
            Nova pendência
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

                    <button className="button secondary" onClick={() => void abrirHistorico(item)}>
                      Histórico
                    </button>
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

      {modalCliente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalCliente(false)}>
          <form
            className="message-modal form-modal"
            onSubmit={(event) => void salvarNovoCliente(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Cadastro</span>
                <h2>Novo cliente</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setModalCliente(false)}>
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field full-width">
                <span>Nome do cliente</span>
                <input
                  value={clienteNome}
                  onChange={(event) => setClienteNome(event.target.value)}
                  placeholder="Ex.: Mercado Rondinense"
                  autoFocus
                  required
                />
              </label>

              <label className="form-field full-width">
                <span>Contabilidade</span>
                <select
                  value={clienteContabilidadeId}
                  onChange={(event) => setClienteContabilidadeId(event.target.value)}
                  disabled={carregandoCadastros}
                >
                  <option value="">Sem contabilidade vinculada</option>
                  {contabilidades.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nome}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModalCliente(false)}>
                Cancelar
              </button>
              <button className="button primary" disabled={salvandoCliente || !clienteNome.trim()}>
                {salvandoCliente ? "Salvando..." : "Cadastrar cliente"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalContabilidade && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setModalContabilidade(false)}
        >
          <form
            className="message-modal form-modal compact-modal"
            onSubmit={(event) => void salvarNovaContabilidade(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Cadastro</span>
                <h2>Nova contabilidade</h2>
              </div>
              <button
                type="button"
                className="close-button"
                onClick={() => setModalContabilidade(false)}
              >
                ×
              </button>
            </div>

            <label className="form-field">
              <span>Nome da contabilidade</span>
              <input
                value={contabilidadeNome}
                onChange={(event) => setContabilidadeNome(event.target.value)}
                placeholder="Ex.: Contabilidade Silva"
                autoFocus
                required
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalContabilidade(false)}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={salvandoContabilidade || !contabilidadeNome.trim()}>
                {salvandoContabilidade ? "Salvando..." : "Cadastrar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalPendencia && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalPendencia(false)}>
          <form
            className="message-modal form-modal"
            onSubmit={(event) => void salvarNovaPendencia(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Acompanhamento mensal</span>
                <h2>Nova pendência</h2>
              </div>
              <button type="button" className="close-button" onClick={() => setModalPendencia(false)}>
                ×
              </button>
            </div>

            <p className="modal-help">
              Cadastre somente clientes que tiveram alguma nota ou conferência pendente nesta competência.
            </p>

            <div className="form-grid">
              <label className="form-field full-width">
                <span>Cliente</span>
                <select
                  value={pendenciaClienteId}
                  onChange={(event) => setPendenciaClienteId(event.target.value)}
                  disabled={carregandoCadastros}
                  required
                >
                  <option value="">Selecione um cliente</option>
                  {clientes
                    .filter((cliente) => cliente.ativo)
                    .map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                        {cliente.contabilidade ? ` — ${cliente.contabilidade.nome}` : ""}
                      </option>
                    ))}
                </select>
              </label>

              <label className="form-field">
                <span>Competência</span>
                <input
                  type="month"
                  value={pendenciaCompetencia}
                  onChange={(event) => setPendenciaCompetencia(event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Status inicial</span>
                <select
                  value={pendenciaStatus}
                  onChange={(event) => setPendenciaStatus(event.target.value as StatusPendencia)}
                >
                  {statusDisponiveis.map((status) => (
                    <option key={status} value={status}>
                      {rotulosStatus[status]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field full-width">
                <span>Responsável</span>
                <input
                  value={pendenciaResponsavel}
                  onChange={(event) => setPendenciaResponsavel(event.target.value)}
                  placeholder="Quem ficará responsável"
                />
              </label>

              <label className="form-field full-width">
                <span>Observação interna</span>
                <textarea
                  rows={4}
                  value={pendenciaObservacao}
                  onChange={(event) => setPendenciaObservacao(event.target.value)}
                  placeholder="Ex.: Aguardando cliente liberar acesso ao computador."
                />
              </label>
            </div>

            {clientes.filter((cliente) => cliente.ativo).length === 0 && (
              <div className="inline-warning">
                Nenhum cliente ativo cadastrado. Cadastre um cliente antes de criar a pendência.
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="button secondary" onClick={() => setModalPendencia(false)}>
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={salvandoPendencia || !pendenciaClienteId || !pendenciaCompetencia}
              >
                {salvandoPendencia ? "Criando..." : "Criar pendência"}
              </button>
            </div>
          </form>
        </div>
      )}

      {historicoModal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setHistoricoModal(null)}>
          <section
            className="message-modal history-modal"
            role="dialog"
            aria-modal="true"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Linha do tempo</span>
                <h2>{historicoModal.clienteNome}</h2>
              </div>
              <button className="close-button" onClick={() => setHistoricoModal(null)}>
                ×
              </button>
            </div>

            {historicoModal.carregando ? (
              <div className="history-empty">Carregando histórico...</div>
            ) : historicoModal.registros.length === 0 ? (
              <div className="history-empty">Ainda não existem movimentações registradas.</div>
            ) : (
              <div className="history-list">
                {historicoModal.registros.map((registro) => (
                  <article className="history-item" key={registro.id}>
                    <div className="history-dot" />
                    <div className="history-content">
                      <div className="history-heading">
                        <strong>{rotulosHistorico[registro.tipo]}</strong>
                        <span>{formatarData(registro.criadoEm)}</span>
                      </div>
                      <p className="history-author">
                        {registro.autor ? `Por ${registro.autor}` : "Autor não informado"}
                      </p>

                      {registro.tipo === "CRIACAO" ? (
                        <p className="history-value">
                          Status inicial: <strong>{formatarValorHistorico(registro.valorNovo)}</strong>
                        </p>
                      ) : registro.tipo === "MENSAGEM_CONTADOR" ? (
                        <div className="history-message-preview">
                          {registro.valorNovo || "Mensagem removida"}
                        </div>
                      ) : (
                        <div className="history-change">
                          <div>
                            <span>Antes</span>
                            <strong>{formatarValorHistorico(registro.valorAnterior)}</strong>
                          </div>
                          <span className="history-arrow">→</span>
                          <div>
                            <span>Depois</span>
                            <strong>{formatarValorHistorico(registro.valorNovo)}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
