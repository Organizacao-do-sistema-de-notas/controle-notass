import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { ExcluirCliente } from "./ExcluirCliente";
import { SeletorMes } from "./SeletorMes";
import { competenciaRapida, mesesRapidos } from "./meses";
import { alterarExcel, ErroExcel } from "./excel-compartilhado";
import { moverNaOrdem, useArrastoCartoes } from "./useArrastoCartoes";

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
  mensagemOriginal: string;
  linkWhatsApp: string | null;
  salvando: boolean;
}

type PendenciasEdicao = { gravando: boolean; rascunhos: boolean };
type BasePendencia = { clienteId: string; competencia: string; status: StatusPendencia; responsavel: string; observacao: string };

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

export function App({ revisaoCadastros = 0, aoPendenciasAlteradas }: {
  revisaoCadastros?: number; aoPendenciasAlteradas?: (estado: PendenciasEdicao) => void;
}) {
  const [competencia, setCompetencia] = useState(() => competenciaRapida(localStorage.getItem("controle-notas-painel-mes")));
  const [painel, setPainel] = useState<PainelMensal | null>(null);
  const [mostrarIndicadores, setMostrarIndicadores] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("TODOS");
  const [editor, setEditor] = useState<EditorMensagem | null>(null);
  const [carregandoMensagem, setCarregandoMensagem] = useState(false);
  const [alterandoStatusId, setAlterandoStatusId] = useState<number | null>(null);
  const [salvandoOrdem, setSalvandoOrdem] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [autor, setAutor] = useState(() => localStorage.getItem("controle-notas-autor") || "");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contabilidades, setContabilidades] = useState<Contabilidade[]>([]);
  const [carregandoCadastros, setCarregandoCadastros] = useState(false);

  const [modalCliente, setModalCliente] = useState(false);
  const [exclusaoAberta, setExclusaoAberta] = useState(false);
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
  const [basePendencia, setBasePendencia] = useState<BasePendencia | null>(null);

  const [historicoModal, setHistoricoModal] = useState<ModalHistorico | null>(null);
  const geracaoCompetencias = useRef(0);
  const geracaoPainel = useRef(0);
  const formulario = useRef<HTMLElement>(null);
  const botaoFormulario = useRef<HTMLElement | null>(null);
  const gravacaoEmAndamento = useRef(false);
  const clienteComRascunho = modalCliente && Boolean(clienteNome || clienteContabilidadeId);
  const contabilidadeComRascunho = modalContabilidade && Boolean(contabilidadeNome);
  const pendenciaComRascunho = modalPendencia && basePendencia !== null && (
    pendenciaClienteId !== basePendencia.clienteId || pendenciaCompetencia !== basePendencia.competencia
    || pendenciaStatus !== basePendencia.status || pendenciaResponsavel !== basePendencia.responsavel
    || pendenciaObservacao !== basePendencia.observacao
  );
  const mensagemComRascunho = editor !== null && editor.mensagem !== editor.mensagemOriginal;
  const temRascunhos = clienteComRascunho || contabilidadeComRascunho || pendenciaComRascunho || mensagemComRascunho;
  const gravando = salvandoCliente || salvandoContabilidade || salvandoPendencia || salvandoOrdem || Boolean(editor?.salvando) || alterandoStatusId !== null;
  const formularioAberto = modalCliente || modalContabilidade || modalPendencia || editor !== null;
  const aberturaBloqueada = gravando || carregandoCadastros || carregandoMensagem || formularioAberto;

  useEffect(() => { aoPendenciasAlteradas?.({ gravando, rascunhos: temRascunhos }); }, [gravando, temRascunhos, aoPendenciasAlteradas]);
  useEffect(() => () => { aoPendenciasAlteradas?.({ gravando: false, rascunhos: false }); }, [aoPendenciasAlteradas]);
  useEffect(() => {
    if (!gravando && !temRascunhos) return;
    const proteger = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [gravando, temRascunhos]);
  useEffect(() => {
    if (!formularioAberto) return;
    const anterior = botaoFormulario.current ?? document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    formulario.current?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [formularioAberto]);
  useEffect(() => { if (formularioAberto && gravando) formulario.current?.focus(); }, [formularioAberto, gravando]);

  function podeDescartar(alterado: boolean, contexto: string) {
    return !gravacaoEmAndamento.current && !gravando
      && (!alterado || window.confirm(`Descartar as alterações não salvas ${contexto}?`));
  }
  function guardarBotaoFormulario() {
    botaoFormulario.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  function fecharCliente() { if (podeDescartar(clienteComRascunho, "deste cliente")) { setModalCliente(false); setErro(null); } }
  function fecharContabilidade() { if (podeDescartar(contabilidadeComRascunho, "desta contabilidade")) { setModalContabilidade(false); setErro(null); } }
  function fecharPendencia() { if (podeDescartar(pendenciaComRascunho, "desta pendência")) { setModalPendencia(false); setErro(null); } }
  function fecharMensagem() { if (podeDescartar(mensagemComRascunho, "desta mensagem")) { setEditor(null); setErro(null); } }
  function tecladoFormulario(evento: KeyboardEvent<HTMLElement>, fechar: () => void) {
    if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); fechar(); }
    if (evento.key !== "Tab") return;
    const elementos = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
    ));
    const primeiro = elementos[0], ultimo = elementos[elementos.length - 1];
    if (!primeiro) { evento.preventDefault(); evento.currentTarget.focus(); }
    else if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === evento.currentTarget)) { evento.preventDefault(); ultimo.focus(); }
    else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
  }

  async function carregarCompetencias() {
    const geracao = ++geracaoCompetencias.current;
    try {
      setCarregando(true);
      setErro(null);
      const lista = await listarCompetencias();
      if (geracao !== geracaoCompetencias.current) return;
      return lista;
    } catch (error) {
      if (geracao === geracaoCompetencias.current) setErro(error instanceof Error ? error.message : "Erro ao carregar competências.");
    } finally {
      if (geracao === geracaoCompetencias.current) setCarregando(false);
    }
  }

  async function carregarPainel(competenciaSelecionada: string) {
    const geracao = ++geracaoPainel.current;
    if (!competenciaSelecionada) {
      setPainel(null);
      return;
    }

    try {
      setCarregando(true);
      setErro(null);
      const dados = await obterPainel(competenciaSelecionada);
      if (geracao === geracaoPainel.current) setPainel(dados);
    } catch (error) {
      if (geracao === geracaoPainel.current) setErro(error instanceof Error ? error.message : "Erro ao carregar painel.");
    } finally {
      if (geracao === geracaoPainel.current) setCarregando(false);
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
    if (revisaoCadastros === 0) return;
    void carregarCadastros();
    if (competencia) void carregarPainel(competencia);
  }, [revisaoCadastros]);

  useEffect(() => {
    localStorage.setItem("controle-notas-painel-mes", competencia);
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

  function aplicarOrdemPainel(ordem: number[]) {
    const posicoes = new Map(ordem.map((id, indice) => [id, indice]));
    setPainel(atual => atual ? { ...atual, ordemClientes: ordem,
      pendencias: [...atual.pendencias].sort((a, b) => (posicoes.get(a.cliente.id) ?? a.cliente.id) - (posicoes.get(b.cliente.id) ?? b.cliente.id)) } : atual);
  }
  const arrastoPainel = useArrastoCartoes({ ids: pendenciasFiltradas.map(item => String(item.cliente.id)), bloqueado: aberturaBloqueada || carregando,
    aoMover: async (origem, destino, depois) => {
      const anterior = painel?.ordemClientes ?? painel?.pendencias.map(item => item.cliente.id) ?? [];
      const ordem = moverNaOrdem(anterior, Number(origem), Number(destino), depois);
      setSalvandoOrdem(true);
      try {
        const resposta = await alterarExcel([{ tipo: 'ordenarPainel', ordem, anterior }]);
        aplicarOrdemPainel(resposta.estado?.ordemClientesPainel ?? ordem);
      } catch (e) {
        if (e instanceof ErroExcel && e.resposta?.estado?.ordemClientesPainel) aplicarOrdemPainel(e.resposta.estado.ordemClientesPainel);
        throw e;
      } finally { setSalvandoOrdem(false); }
    } });

  async function abrirEditorMensagem(item: PendenciaPainel) {
    if (aberturaBloqueada) return;
    guardarBotaoFormulario();
    try {
      setCarregandoMensagem(true);
      setErro(null);
      const dados = await obterMensagemContador(item.id);
      setEditor({
        pendenciaId: dados.pendenciaId,
        clienteNome: dados.cliente.nome,
        mensagem: dados.mensagem ?? criarModeloMensagem(dados.cliente.nome),
        mensagemOriginal: dados.mensagem ?? criarModeloMensagem(dados.cliente.nome),
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
    if (!editor || gravacaoEmAndamento.current || gravando) return;
    gravacaoEmAndamento.current = true;

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
        mensagemOriginal: dados.mensagem ?? "",
        linkWhatsApp: dados.linkWhatsApp,
        salvando: true,
      });
      setAviso("Mensagem salva.");
      await carregarPainel(competencia);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao salvar mensagem.");
    } finally {
      gravacaoEmAndamento.current = false;
      setEditor(atual => atual ? { ...atual, salvando: false } : atual);
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
    if (novoStatus === item.status || gravacaoEmAndamento.current || gravando) return;
    gravacaoEmAndamento.current = true;

    try {
      setAlterandoStatusId(item.id);
      setErro(null);
      await atualizarStatusPendencia(item.id, novoStatus, autor.trim() || undefined);
      await carregarPainel(competencia);
      setAviso("Status atualizado.");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao atualizar status.");
    } finally {
      gravacaoEmAndamento.current = false;
      setAlterandoStatusId(null);
    }
  }

  function abrirWhatsApp(dados: MensagemContadorResponse | EditorMensagem) {
    if (!dados.linkWhatsApp) return;
    window.open(dados.linkWhatsApp, "_blank", "noopener,noreferrer");
  }

  async function abrirNovoCliente() {
    if (aberturaBloqueada) return;
    guardarBotaoFormulario();
    setClienteNome("");
    setClienteContabilidadeId("");
    await carregarCadastros();
    setModalCliente(true);
  }

  async function aposExcluirCliente(_resposta: unknown, id: number) {
    geracaoPainel.current++;
    setClientes(atuais => atuais.filter(cliente => cliente.id !== id));
    setPainel(atual => {
      if (!atual) return atual;
      const pendencias = atual.pendencias.filter(item => item.cliente.id !== id);
      const contar = (status: StatusPendencia) => pendencias.filter(item => item.status === status).length;
      const concluido = contar("CONCLUIDO");
      return { ...atual, pendencias, totais: {
        total: pendencias.length, emAberto: pendencias.length - concluido,
        pendente: contar("PENDENTE"), aguardandoCliente: contar("AGUARDANDO_CLIENTE"),
        emAtendimento: contar("EM_ATENDIMENTO"), concluido,
      } };
    });
    const lista = await carregarCompetencias();
    if (lista?.includes(competencia)) await carregarPainel(competencia);
    setAviso("Cliente excluído das visualizações. Histórico preservado.");
  }

  async function salvarNovoCliente(event: FormEvent) {
    event.preventDefault();
    if (!clienteNome.trim() || gravacaoEmAndamento.current || gravando) return;
    gravacaoEmAndamento.current = true;

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
      gravacaoEmAndamento.current = false;
      setSalvandoCliente(false);
    }
  }

  function abrirNovaContabilidade() {
    if (aberturaBloqueada) return;
    guardarBotaoFormulario();
    setErro(null);
    setContabilidadeNome("");
    setModalContabilidade(true);
  }

  async function salvarNovaContabilidade(event: FormEvent) {
    event.preventDefault();
    if (!contabilidadeNome.trim() || gravacaoEmAndamento.current || gravando) return;
    gravacaoEmAndamento.current = true;

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
      gravacaoEmAndamento.current = false;
      setSalvandoContabilidade(false);
    }
  }

  async function abrirNovaPendencia() {
    if (aberturaBloqueada) return;
    guardarBotaoFormulario();
    const dados = await carregarCadastros();
    const ativos = (dados?.listaClientes ?? clientes).filter((cliente) => cliente.ativo);

    setPendenciaClienteId(ativos[0] ? String(ativos[0].id) : "");
    setPendenciaCompetencia(competencia || competenciaAtual());
    setPendenciaStatus("PENDENTE");
    setPendenciaResponsavel(autor.trim());
    setPendenciaObservacao("");
    setBasePendencia({ clienteId: ativos[0] ? String(ativos[0].id) : "", competencia: competencia || competenciaAtual(), status: "PENDENTE", responsavel: autor.trim(), observacao: "" });
    setModalPendencia(true);
  }

  async function salvarNovaPendencia(event: FormEvent) {
    event.preventDefault();
    if (!pendenciaClienteId || !pendenciaCompetencia || gravacaoEmAndamento.current || gravando) return;
    gravacaoEmAndamento.current = true;

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

      setModalPendencia(false);
      setAviso("Pendência criada.");

      await listarCompetencias();
      if (pendenciaCompetencia === competencia) {
        await carregarPainel(pendenciaCompetencia);
      } else if (mesesRapidos().includes(pendenciaCompetencia)) {
        setCompetencia(pendenciaCompetencia);
      } else {
        setAviso(`Pendência criada em ${formatarCompetencia(pendenciaCompetencia)}. Esse mês está fora da seleção rápida.`);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao criar pendência.");
    } finally {
      gravacaoEmAndamento.current = false;
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
          <SeletorMes valor={competencia} aoAlterar={setCompetencia} rotulo="Competência"
            contexto="Painel" nomeAcessivel="Competência" />

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

          <div className="painel-atualizar-acoes">
            <button className="button secondary" onClick={() => void carregarPainel(competencia)}>
              Atualizar
            </button>
            <button type="button" className="painel-indicadores-toggle"
              aria-label={mostrarIndicadores ? "Ocultar indicadores" : "Mostrar indicadores"}
              title={mostrarIndicadores ? "Ocultar indicadores" : "Mostrar indicadores"}
              aria-expanded={mostrarIndicadores} aria-controls="resumo-painel"
              onClick={() => setMostrarIndicadores(valor => !valor)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
                <circle cx="12" cy="12" r="3" />
                {!mostrarIndicadores && <path d="m3 3 18 18" />}
              </svg>
            </button>
          </div>

          <div className="toolbar-spacer" />

          <button className="button secondary" disabled={aberturaBloqueada} onClick={abrirNovaContabilidade}>
            Nova contabilidade
          </button>
          <button className="button secondary" disabled={aberturaBloqueada} onClick={() => void abrirNovoCliente()}>
            Novo cliente
          </button>
          <button className="button secondary" disabled={aberturaBloqueada} onClick={() => setExclusaoAberta(true)}>
            Excluir cliente
          </button>
          <button className="button primary" disabled={aberturaBloqueada} onClick={() => void abrirNovaPendencia()}>
            Nova pendência
          </button>
        </section>

        {erro && <div className="alert error">{erro}</div>}
        {aviso && <div className="toast">{aviso}</div>}

        {painel && mostrarIndicadores && (
          <section className="summary-grid" id="resumo-painel" aria-label="Resumo do mês">
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
          {arrastoPainel.erro && <p role="alert" className="alert error">{arrastoPainel.erro}</p>}
          {arrastoPainel.mensagem && <p role="status" className="painel-ordem-estado">{arrastoPainel.mensagem}</p>}

          {carregando ? (
            <div className="empty-state panel">Carregando informações...</div>
          ) : pendenciasFiltradas.length === 0 ? (
            <div className="empty-state panel">
              Nenhuma pendência encontrada para os filtros atuais.
            </div>
          ) : (
            <div className="pendencias-grid" ref={arrastoPainel.grupo}>
              {pendenciasFiltradas.map((item) => (
                <article className="pendencia-card cartao-arrastavel" key={item.id} tabIndex={0} data-cliente-id={item.cliente.id} {...arrastoPainel.vincular(String(item.cliente.id))}>
                  <div className="card-heading">
                    <div>
                      <h3>{item.cliente.nome}</h3>
                      <p>{item.contabilidade?.nome ?? "Sem contabilidade vinculada"}</p>
                    </div>
                    <div className="card-status-controle">
                      <select aria-label={`Status de ${item.cliente.nome}`} value={item.status} disabled={gravando}
                        className={`card-status-select status-${item.status.toLowerCase()}`}
                        onChange={event => void alterarStatus(item, event.target.value as StatusPendencia)}>
                        {statusDisponiveis.map(status => <option key={status} value={status}>{rotulosStatus[status]}</option>)}
                      </select>
                      <button type="button" className="painel-arrastar" data-drag-handle disabled={aberturaBloqueada || carregando}
                        aria-label={`Ordenar cliente ${item.cliente.nome}`} title="Arraste o cartão para mover; ou use as setas do teclado"
                        onKeyDown={evento => arrastoPainel.teclado(evento, String(item.cliente.id))}>⋮⋮</button>
                    </div>
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
                    <button className="button secondary" onClick={() => void abrirHistorico(item)}>
                      Histórico
                    </button>

                    {item.mensagemContador && (
                      <button
                        className="button secondary"
                        onClick={() => void copiarMensagem(item.mensagemContador!)}
                      >
                        Copiar
                      </button>
                    )}

                    <button className="button primary card-criar-mensagem" onClick={() => void abrirEditorMensagem(item)} disabled={aberturaBloqueada}>
                      {item.temMensagemContador ? "Editar mensagem" : "Criar mensagem"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>

      {exclusaoAberta && <ExcluirCliente aoFechar={() => setExclusaoAberta(false)} aoExcluir={aposExcluirCliente} />}
      {editor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={fecharMensagem}>
          <section
            ref={formulario}
            className="message-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-title"
            aria-busy={gravando} tabIndex={-1}
            onKeyDown={evento => tecladoFormulario(evento, fecharMensagem)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Mensagem para o contador</span>
                <h2 id="message-title">{editor.clienteNome}</h2>
              </div>
              <button className="close-button" disabled={gravando} onClick={fecharMensagem} aria-label="Fechar mensagem">
                ×
              </button>
            </div>

            <p className="modal-help">
              Escreva somente o resumo que será copiado ou enviado ao contador. Informações internas do
              atendimento ficam fora desta mensagem.
            </p>

            <textarea
              aria-label="Mensagem para o contador"
              disabled={gravando}
              value={editor.mensagem}
              onChange={(event) => setEditor({ ...editor, mensagem: event.target.value })}
              rows={14}
            />

            {erro && <p className="alert error" role="alert">{erro}</p>}
            <div className="modal-actions">
              <button className="button secondary" disabled={gravando} onClick={fecharMensagem}>
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
                disabled={gravando}
              >
                {editor.salvando ? "Salvando..." : "Salvar mensagem"}
              </button>
            </div>
          </section>
        </div>
      )}

      {modalCliente && (
        <div className="modal-backdrop" role="presentation" onMouseDown={fecharCliente}>
          <form
            ref={elemento => { formulario.current = elemento; }}
            className="message-modal form-modal"
            role="dialog" aria-modal="true" aria-labelledby="painel-novo-cliente" aria-busy={gravando} tabIndex={-1}
            onKeyDown={evento => tecladoFormulario(evento, fecharCliente)}
            onSubmit={(event) => void salvarNovoCliente(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Cadastro</span>
                <h2 id="painel-novo-cliente">Novo cliente</h2>
              </div>
              <button type="button" className="close-button" aria-label="Fechar novo cliente" disabled={gravando} onClick={fecharCliente}>
                ×
              </button>
            </div>

            <div className="form-grid">
              <label className="form-field full-width">
                <span>Nome do cliente</span>
                <input
                  value={clienteNome}
                  disabled={gravando}
                  onChange={(event) => setClienteNome(event.target.value)}
                  placeholder="Ex.: Mercado Rondinense"
                  required
                />
              </label>

              <label className="form-field full-width">
                <span>Contabilidade</span>
                <select
                  value={clienteContabilidadeId}
                  onChange={(event) => setClienteContabilidadeId(event.target.value)}
                  disabled={carregandoCadastros || gravando}
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

            {erro && <p className="alert error" role="alert">{erro}</p>}
            <div className="modal-actions">
              <button type="button" className="button secondary" disabled={gravando} onClick={fecharCliente}>
                Cancelar
              </button>
              <button className="button primary" disabled={gravando || !clienteNome.trim()}>
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
          onMouseDown={fecharContabilidade}
        >
          <form
            ref={elemento => { formulario.current = elemento; }}
            className="message-modal form-modal compact-modal"
            role="dialog" aria-modal="true" aria-labelledby="painel-nova-contabilidade" aria-busy={gravando} tabIndex={-1}
            onKeyDown={evento => tecladoFormulario(evento, fecharContabilidade)}
            onSubmit={(event) => void salvarNovaContabilidade(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Cadastro</span>
                <h2 id="painel-nova-contabilidade">Nova contabilidade</h2>
              </div>
              <button
                type="button"
                className="close-button"
                aria-label="Fechar nova contabilidade" disabled={gravando}
                onClick={fecharContabilidade}
              >
                ×
              </button>
            </div>

            <label className="form-field">
              <span>Nome da contabilidade</span>
              <input
                value={contabilidadeNome}
                disabled={gravando}
                onChange={(event) => setContabilidadeNome(event.target.value)}
                placeholder="Ex.: Contabilidade Silva"
                required
              />
            </label>

            {erro && <p className="alert error" role="alert">{erro}</p>}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={gravando}
                onClick={fecharContabilidade}
              >
                Cancelar
              </button>
              <button className="button primary" disabled={gravando || !contabilidadeNome.trim()}>
                {salvandoContabilidade ? "Salvando..." : "Cadastrar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {modalPendencia && (
        <div className="modal-backdrop" role="presentation" onMouseDown={fecharPendencia}>
          <form
            ref={elemento => { formulario.current = elemento; }}
            className="message-modal form-modal"
            role="dialog" aria-modal="true" aria-labelledby="painel-nova-pendencia" aria-busy={gravando} tabIndex={-1}
            onKeyDown={evento => tecladoFormulario(evento, fecharPendencia)}
            onSubmit={(event) => void salvarNovaPendencia(event)}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">Acompanhamento mensal</span>
                <h2 id="painel-nova-pendencia">Nova pendência</h2>
              </div>
              <button type="button" className="close-button" aria-label="Fechar nova pendência" disabled={gravando} onClick={fecharPendencia}>
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
                  disabled={carregandoCadastros || gravando}
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
                  disabled={gravando}
                  value={pendenciaCompetencia}
                  onChange={(event) => setPendenciaCompetencia(event.target.value)}
                  required
                />
              </label>

              <label className="form-field">
                <span>Status inicial</span>
                <select
                  value={pendenciaStatus}
                  disabled={gravando}
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
                  disabled={gravando}
                  onChange={(event) => setPendenciaResponsavel(event.target.value)}
                  placeholder="Quem ficará responsável"
                />
              </label>

              <label className="form-field full-width">
                <span>Observação interna</span>
                <textarea
                  rows={4}
                  disabled={gravando}
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

            {erro && <p className="alert error" role="alert">{erro}</p>}
            <div className="modal-actions">
              <button type="button" className="button secondary" disabled={gravando} onClick={fecharPendencia}>
                Cancelar
              </button>
              <button
                className="button primary"
                disabled={gravando || !pendenciaClienteId || !pendenciaCompetencia}
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
