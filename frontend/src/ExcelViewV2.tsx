import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import "./excel-search.css";
import { FichasClientes } from "./FichasClientes";
import { InformacoesCliente } from "./InformacoesCliente";
import {
  LIMITE_INFORMACOES_CLIENTE,
} from "./informacoes-cliente-storage";
import { definir, type AvisoExtra, type AlteracaoExcel, type RegistroMensal, type StatusExcel } from "./excel-compartilhado";
import { useExcelCompartilhado } from "./useExcelCompartilhado";
import { chaveObservacao, useObservacoesExcel } from "./useObservacoesExcel";
import { baixarCopiaLocal } from "./excel-legado";
import "./excel-compartilhado.css";
import "./cadastro-unico.css";

type ExcelViewProps = { competencia: string; aoPendenciasAlteradas?: (estado: { gravando: boolean; rascunhos: boolean }) => void };

const mercadosPrioritarios = ["Bom dia filial", "Bom dia Matriz", "Compre bem"];
const rotulosStatus: Record<StatusExcel, string> = {
  PENDENTE: "Pendente",
  AGUARDANDO: "Aguardando",
  EM_ATENDIMENTO: "Em atendimento",
  OK: "OK",
};
const statusDisponiveis = Object.keys(rotulosStatus) as StatusExcel[];

function normalizar(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function parseNomes(valor: string): string[] {
  return valor
    .split(/\r?\n|;/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function ExcelViewV2({ competencia, aoPendenciasAlteradas }: ExcelViewProps) {
  const compartilhado = useExcelCompartilhado();
  const { clientesExtras, nomesAlterados, nomesBusca, informacoesClientes, avisosExtras, vinculosClientes = {}, clientesInativos = [] } = compartilhado.estado;
  const registros = compartilhado.estado.registros[competencia] ?? {};
  const observacoes = useObservacoesExcel(compartilhado.estado, compartilhado.executar, compartilhado.conectado);
  const ocupado = compartilhado.gravando > 0;
  const disponivel = compartilhado.carregado && compartilhado.conectado;
  const [erroGeral, setErroGeral] = useState("");
  const [erroAviso, setErroAviso] = useState("");
  const [baseFormulario, setBaseFormulario] = useState({ nome: "", apelidos: [] as string[], informacoes: "" });
  const idCriacao = useRef("");
  const [baseAviso, setBaseAviso] = useState<AvisoExtra | null>(null);
  const [informacaoAberta, setInformacaoAberta] = useState<string | null>(null);
  const botaoInformacao = useRef<HTMLButtonElement | null>(null);

  const [pesquisa, setPesquisa] = useState("");
  const [fichasAbertas, setFichasAbertas] = useState(false);
  const [fichaInicialId, setFichaInicialId] = useState<number | null>(null);
  const [statusAberto, setStatusAberto] = useState<string | null>(null);
  const [prioridadeAberta, setPrioridadeAberta] = useState(false);
  const [modalCliente, setModalCliente] = useState<"incluir" | "alterar" | null>(null);
  const [modalAviso, setModalAviso] = useState<"incluir" | "alterar" | null>(null);
  const formularioRef = useRef<HTMLElement>(null);

  const [novoCliente, setNovoCliente] = useState("");
  const [novasInformacoes, setNovasInformacoes] = useState("");
  const [erroCliente, setErroCliente] = useState("");
  const [novosNomesBusca, setNovosNomesBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [clienteAlteradoNome, setClienteAlteradoNome] = useState("");
  const [clienteAlteradoNomesBusca, setClienteAlteradoNomesBusca] = useState("");
  const [clienteAlteradoInformacoes, setClienteAlteradoInformacoes] = useState("");

  const [novoAvisoTitulo, setNovoAvisoTitulo] = useState("");
  const [novoAvisoTexto, setNovoAvisoTexto] = useState("");
  const [avisoSelecionado, setAvisoSelecionado] = useState("");
  const [avisoAlteradoTitulo, setAvisoAlteradoTitulo] = useState("");
  const [avisoAlteradoTexto, setAvisoAlteradoTexto] = useState("");

  const clienteComRascunho = modalCliente === "incluir"
    ? Boolean(novoCliente || novosNomesBusca || novasInformacoes)
    : modalCliente === "alterar" && (
      clienteAlteradoNome !== baseFormulario.nome
      || clienteAlteradoNomesBusca !== baseFormulario.apelidos.join("\n")
      || clienteAlteradoInformacoes !== baseFormulario.informacoes
    );
  const avisoComRascunho = modalAviso === "incluir"
    ? Boolean(novoAvisoTitulo || novoAvisoTexto)
    : modalAviso === "alterar" && (
      avisoAlteradoTitulo !== (baseAviso?.titulo ?? "")
      || avisoAlteradoTexto !== (baseAviso?.texto ?? "")
    );
  const temRascunhos = observacoes.pendente || clienteComRascunho || avisoComRascunho;
  const formularioAberto = modalCliente !== null || modalAviso !== null;

  const clientes = clientesExtras;

  const clientesFiltrados = useMemo(() => {
    const termos = normalizar(pesquisa).split(" ").filter(Boolean);
    if (termos.length === 0) return clientes;

    return clientes.filter((cliente) => {
      const indice = normalizar([
        cliente,
        nomesAlterados[cliente] || "",
        ...(nomesBusca[cliente] || []),
      ].join(" "));
      return termos.every((termo) => indice.includes(termo));
    });
  }, [clientes, nomesAlterados, nomesBusca, pesquisa]);

  useEffect(() => {
    setStatusAberto(null);
  }, [competencia]);
  useEffect(() => { aoPendenciasAlteradas?.({ gravando: ocupado, rascunhos: temRascunhos }); }, [ocupado, temRascunhos, aoPendenciasAlteradas]);
  useEffect(() => () => { aoPendenciasAlteradas?.({ gravando: false, rascunhos: false }); }, [aoPendenciasAlteradas]);
  useEffect(() => {
    if (!ocupado && !temRascunhos) return;
    const proteger = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [ocupado, temRascunhos]);
  useEffect(() => {
    if (!formularioAberto) return;
    const anterior = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    formularioRef.current?.querySelector<HTMLElement>("input:not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, [formularioAberto]);
  useEffect(() => {
    if (formularioAberto && (ocupado || !disponivel)) formularioRef.current?.focus();
  }, [formularioAberto, ocupado, disponivel]);

  function fecharFormularioCliente() {
    if (ocupado || (clienteComRascunho && !window.confirm("Descartar as alterações não salvas deste cliente?"))) return;
    setModalCliente(null);
    setNovoCliente(""); setNovosNomesBusca(""); setNovasInformacoes(""); setErroCliente("");
  }

  function fecharFormularioAviso() {
    if (ocupado || (avisoComRascunho && !window.confirm("Descartar as alterações não salvas deste aviso?"))) return;
    setModalAviso(null);
    setNovoAvisoTitulo(""); setNovoAvisoTexto(""); setErroAviso("");
  }

  function tecladoFormulario(evento: KeyboardEvent<HTMLElement>, fechar: () => void) {
    if (evento.key === "Escape") {
      evento.preventDefault(); evento.stopPropagation(); fechar();
    }
    if (evento.key !== "Tab") return;
    const elementos = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
    ));
    const primeiro = elementos[0];
    const ultimo = elementos[elementos.length - 1];
    if (!primeiro) { evento.preventDefault(); evento.currentTarget.focus(); }
    else if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === evento.currentTarget)) {
      evento.preventDefault(); ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault(); primeiro.focus();
    }
  }

  function nomeExibido(chave: string) {
    return nomesAlterados[chave] || chave;
  }

  function obterRegistro(chave: string): RegistroMensal {
    return registros[chave] ?? { status: "PENDENTE", observacao: "" };
  }

  function obterInformacoes(chave: string): string {
    const texto = informacoesClientes[chave];
    return typeof texto === "string" ? texto : "";
  }

  function fecharInformacoes() {
    setInformacaoAberta(null);
    requestAnimationFrame(() => {
      if (botaoInformacao.current?.isConnected) botaoInformacao.current.focus();
    });
  }

  async function alterarStatus(chave: string, status: StatusExcel) {
    setStatusAberto(null);
    setErroGeral("");
    try { await compartilhado.executar([definir(["registro", competencia, chave, "status"], status, obterRegistro(chave).status)]); }
    catch (erro) { setErroGeral(erro instanceof Error ? erro.message : "Não foi possível salvar o status."); }
  }

  function alterarObservacao(chave: string, observacao: string) {
    observacoes.alterar(competencia, chave, observacao);
  }

  async function incluirCliente() {
    const nome = novoCliente.trim();
    if (!nome) return;
    const alternativos = parseNomes(novosNomesBusca);
    try {
      await compartilhado.executar([{ tipo: "incluirCliente", nome, apelidos: alternativos, informacoes: novasInformacoes.trim(), idCriacao: idCriacao.current }]);
    } catch (erro) { setErroCliente(erro instanceof Error ? erro.message : "Não foi possível salvar o cliente."); return; }

    setNovoCliente("");
    setNovosNomesBusca("");
    setNovasInformacoes(""); setErroCliente("");
    setModalCliente(null);
  }

  function abrirAlteracaoCliente() {
    const primeiro = clientes[0] ?? "";
    setClienteSelecionado(primeiro);
    setClienteAlteradoNome(primeiro ? nomeExibido(primeiro) : "");
    setClienteAlteradoNomesBusca((nomesBusca[primeiro] || []).join("\n"));
    setClienteAlteradoInformacoes(primeiro ? obterInformacoes(primeiro) : "");
    setBaseFormulario({ nome: primeiro ? nomeExibido(primeiro) : "", apelidos: nomesBusca[primeiro] || [], informacoes: primeiro ? obterInformacoes(primeiro) : "" });
    setErroCliente("");
    setModalCliente("alterar");
  }

  function trocarClienteSelecionado(chave: string) {
    if (chave === clienteSelecionado || ocupado) return;
    if (clienteComRascunho && !window.confirm("Descartar as alterações não salvas antes de selecionar outro cliente?")) return;
    setClienteSelecionado(chave);
    setClienteAlteradoNome(nomeExibido(chave));
    setClienteAlteradoNomesBusca((nomesBusca[chave] || []).join("\n"));
    setClienteAlteradoInformacoes(obterInformacoes(chave)); setErroCliente("");
    setBaseFormulario({ nome: nomeExibido(chave), apelidos: nomesBusca[chave] || [], informacoes: obterInformacoes(chave) });
  }

  async function salvarAlteracaoCliente() {
    const nome = clienteAlteradoNome.trim();
    if (!clienteSelecionado || !nome) return;

    const ops: AlteracaoExcel[] = [];
    if (nome !== baseFormulario.nome) ops.push(definir(["nome", clienteSelecionado], nome, baseFormulario.nome));
    const apelidos = parseNomes(clienteAlteradoNomesBusca);
    if (JSON.stringify(apelidos) !== JSON.stringify(baseFormulario.apelidos)) ops.push(definir(["apelidos", clienteSelecionado], apelidos, baseFormulario.apelidos));
    if (clienteAlteradoInformacoes.trim() !== baseFormulario.informacoes) ops.push(definir(["informacoes", clienteSelecionado], clienteAlteradoInformacoes.trim(), baseFormulario.informacoes));
    try {
      if (ops.length) await compartilhado.executar(ops);
    } catch (erro) { setErroCliente(erro instanceof Error ? erro.message : "Não foi possível salvar o cliente."); return; }
    setErroCliente("");
    setModalCliente(null);
  }

  async function incluirAviso() {
    const titulo = novoAvisoTitulo.trim();
    const texto = novoAvisoTexto.trim();
    if (!titulo || !texto) return;

    try { await compartilhado.executar([{ tipo: "incluirAviso", aviso: { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, titulo, texto } }]); }
    catch (erro) { setErroAviso(erro instanceof Error ? erro.message : "Não foi possível salvar o aviso."); return; }
    setNovoAvisoTitulo("");
    setNovoAvisoTexto("");
    setModalAviso(null);
  }

  function abrirAlteracaoAviso() {
    const primeiro = avisosExtras[0];
    if (!primeiro) return;
    setAvisoSelecionado(primeiro.id);
    setAvisoAlteradoTitulo(primeiro.titulo);
    setAvisoAlteradoTexto(primeiro.texto);
    setBaseAviso(primeiro); setErroAviso("");
    setModalAviso("alterar");
  }

  function trocarAvisoSelecionado(id: string) {
    if (id === avisoSelecionado || ocupado) return;
    if (avisoComRascunho && !window.confirm("Descartar as alterações não salvas antes de selecionar outro aviso?")) return;
    const aviso = avisosExtras.find((item) => item.id === id);
    setAvisoSelecionado(id);
    setAvisoAlteradoTitulo(aviso?.titulo ?? "");
    setAvisoAlteradoTexto(aviso?.texto ?? "");
    setBaseAviso(aviso ?? null); setErroAviso("");
  }

  async function salvarAlteracaoAviso() {
    if (!avisoSelecionado || !avisoAlteradoTitulo.trim() || !avisoAlteradoTexto.trim()) return;
    if (!baseAviso) return;
    const ops: AlteracaoExcel[] = [];
    if (avisoAlteradoTitulo.trim() !== baseAviso.titulo) ops.push(definir(["aviso", avisoSelecionado, "titulo"], avisoAlteradoTitulo.trim(), baseAviso.titulo));
    if (avisoAlteradoTexto.trim() !== baseAviso.texto) ops.push(definir(["aviso", avisoSelecionado, "texto"], avisoAlteradoTexto.trim(), baseAviso.texto));
    try { if (ops.length) await compartilhado.executar(ops); }
    catch (erro) { setErroAviso(erro instanceof Error ? erro.message : "Não foi possível salvar o aviso."); return; }
    setModalAviso(null);
  }

  return (
    <div className="excel-page excel-page-clean">
      {fichasAbertas && <FichasClientes clienteInicialId={fichaInicialId} aoFechar={() => { setFichasAbertas(false); void compartilhado.atualizar(); }} />}
      {informacaoAberta !== null && <InformacoesCliente nome={nomeExibido(informacaoAberta)}
        texto={obterInformacoes(informacaoAberta)} aoFechar={fecharInformacoes} disponivel={disponivel}
        aoSalvar={(texto, anterior) => compartilhado.executar([definir(["informacoes", informacaoAberta], texto, anterior)])} />}
      <section className="excel-compartilhado" aria-label="Compartilhamento de dados">
        <p aria-live="polite">{!compartilhado.carregado ? "Carregando dados compartilhados..." : ocupado || observacoes.pendente ? "Há alterações sendo salvas ou pendentes." : compartilhado.conectado ? "Dados compartilhados entre os computadores." : "Aguardando conexão com o banco compartilhado."}</p>
        {compartilhado.erro && <div><p role="alert">{compartilhado.erro}</p><button type="button" className="excel-action-button" onClick={() => void compartilhado.atualizar()}>Tentar conexão novamente</button></div>}
        {compartilhado.erroImportacao && <p role="alert">{compartilhado.erroImportacao}</p>}
        {erroGeral && <p role="alert">{erroGeral}</p>}
        {compartilhado.carregado && compartilhado.temLegadoPendente && <div className="excel-importacao">
          <strong>Existem dados antigos salvos neste navegador.</strong>
          <p>Importe para compartilhar com o outro computador. Os originais serão mantidos neste navegador; valores diferentes já existentes no banco não serão sobrescritos.</p>
          {compartilhado.legado.avisos.length > 0 && <p>Alguns valores locais estão inválidos. Guarde uma cópia antes de importar os dados válidos.</p>}
          <div><button type="button" className="excel-action-button primary" disabled={!disponivel || ocupado || observacoes.pendente} onClick={() => void compartilhado.importar()}>Importar dados deste navegador</button>
            <button type="button" className="excel-action-button" onClick={() => baixarCopiaLocal(compartilhado.legado.originais)}>Baixar cópia dos dados locais</button></div>
        </div>}
        {compartilhado.resultadoImportacao && <div className="excel-importacao-resultado">
          <p>{compartilhado.resultadoImportacao.importados} campos importados; {compartilhado.resultadoImportacao.totalConflitos} divergências preservadas para revisão.</p>
          {compartilhado.resultadoImportacao.totalConflitos > 0 && <details><summary>Ver divergências da importação</summary>
            <p>O conteúdo do banco foi mantido. Os dados locais originais continuam disponíveis na cópia deste navegador.</p>
            <ul>{compartilhado.resultadoImportacao.conflitos.map((item, indice) => <li key={indice}><strong>{item.caminho.join(" · ")}</strong><br />Banco: {JSON.stringify(item.atual)}<br />Local: {JSON.stringify(item.local)}</li>)}</ul>
            <button type="button" className="excel-action-button" onClick={() => baixarCopiaLocal(compartilhado.legado.originais)}>Baixar cópia dos dados locais</button>
          </details>}
        </div>}
      </section>
      <main className="excel-layout">
        <section className="excel-main-column">
          <div className="excel-section-actions">
            <button className="excel-toolbar-button" disabled={!disponivel || ocupado} onClick={() => { idCriacao.current = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${crypto.getRandomValues(new Uint32Array(4)).join("-")}`; setErroCliente(""); setModalCliente("incluir"); }}>
              <span>Incluir<br />Cliente</span><strong aria-hidden="true">＋</strong>
            </button>
            <button className="excel-toolbar-button" disabled={!disponivel || ocupado || !clientes.length} onClick={abrirAlteracaoCliente}>
              <span>Alterar<br />Cliente</span><strong aria-hidden="true">✎</strong>
            </button>
            <button className="excel-toolbar-button" onClick={() => { setFichaInicialId(null); setFichasAbertas(true); }}>
              <span>Fichas dos<br />Clientes</span><strong aria-hidden="true">▣</strong>
            </button>
          </div>

          <label className="excel-search-box">
            <span>Pesquisar:</span>
            <div className="excel-search-control">
              <span className="excel-search-icon" aria-hidden="true">⌕</span>
              <input
                value={pesquisa}
                onChange={(event) => setPesquisa(event.target.value)}
                placeholder="Nome fantasia, razão social, apelido ou outro nome do cliente..."
              />
              {pesquisa && <button type="button" onClick={() => setPesquisa("")} aria-label="Limpar pesquisa">×</button>}
            </div>
            {pesquisa && <small>{clientesFiltrados.length} cliente(s) encontrado(s). A busca considera todos os nomes cadastrados.</small>}
          </label>

          <section className="excel-table-card">
            <div className="excel-table-head"><div>Clientes</div><div>Status</div><div>Obs</div></div>
            <div className="excel-table-body">
              {!compartilhado.carregado ? <div className="excel-search-empty">Aguardando os dados compartilhados...</div> : clientesFiltrados.length === 0 ? (
                <div className="excel-search-empty">Nenhum cliente encontrado com esse nome.</div>
              ) : clientesFiltrados.map((cliente) => {
                const registro = obterRegistro(cliente);
                const chaveRascunho = chaveObservacao(competencia, cliente);
                const rascunho = observacoes.rascunhos[chaveRascunho];
                return (
                  <div className="excel-table-row" key={cliente} data-cliente-id={vinculosClientes[cliente]} data-chave-cliente={cliente}>
                    <div className="excel-client-name">
                      <span className="excel-client-label">{nomeExibido(cliente)}</span>
                      {vinculosClientes[cliente] && <button type="button" className="excel-ficha-atalho"
                        aria-label={`Abrir ficha de ${nomeExibido(cliente)} (#${vinculosClientes[cliente]})`}
                        onClick={() => { setFichaInicialId(vinculosClientes[cliente]); setFichasAbertas(true); }}>Abrir ficha #{vinculosClientes[cliente]}</button>}
                      {clientesInativos.includes(cliente) && <small className="excel-cliente-inativo">Inativo</small>}
                      {pesquisa && nomesBusca[cliente]?.length > 0 && (
                        <small className="excel-client-aliases">Também cadastrado como: {nomesBusca[cliente].join(" • ")}</small>
                      )}
                    </div>
                    <div className="excel-status-cell">
                      <div
                        className="excel-status-dropdown"
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setStatusAberto(null);
                        }}
                      >
                        <button
                          type="button"
                          className={`excel-status-trigger excel-status-${registro.status.toLowerCase()}`}
                          disabled={!disponivel || ocupado}
                          onClick={() => setStatusAberto(statusAberto === cliente ? null : cliente)}
                          aria-expanded={statusAberto === cliente}
                        >
                          <span>{rotulosStatus[registro.status]}</span><span aria-hidden="true">⌄</span>
                        </button>
                        {statusAberto === cliente && (
                          <div className="excel-status-menu">
                            {statusDisponiveis.map((status) => (
                              <button
                                type="button"
                                key={status}
                                className={`excel-status-option excel-status-${status.toLowerCase()}`}
                                onClick={() => void alterarStatus(cliente, status)}
                              >
                                {rotulosStatus[status]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="excel-note">
                      <div className="excel-note-editor">
                      <input
                        className="excel-note-input"
                        aria-label={`Observação mensal de ${nomeExibido(cliente)}`}
                        value={rascunho?.texto ?? registro.observacao}
                        readOnly={!disponivel}
                        onChange={(event) => alterarObservacao(cliente, event.target.value)}
                        placeholder="Adicionar observação..."
                      />
                      {rascunho && !rascunho.erro && <small className="excel-observacao-pendente">{rascunho.salvando ? "Salvando..." : "Alteração pendente de gravação"}</small>}
                      {rascunho?.erro && <div className="excel-observacao-erro"><p role="alert">{rascunho.erro}</p>
                        <p>Texto salvo no banco: {registro.observacao || "(vazio)"}</p>
                        <button type="button" disabled={!disponivel || rascunho.salvando} onClick={() => observacoes.repetir(chaveRascunho)}>Salvar meu texto</button>
                        <button type="button" disabled={rascunho.salvando} onClick={() => observacoes.descartar(chaveRascunho)}>Usar texto do banco</button>
                      </div>}
                      </div>
                      <button type="button" className={obterInformacoes(cliente).trim() ? "cliente-info-botao com-informacao" : "cliente-info-botao"}
                        aria-label={`Informações adicionais de ${nomeExibido(cliente)}`}
                        title={obterInformacoes(cliente).trim() ? "Ver informações adicionais" : "Nenhuma informação adicional cadastrada"}
                        aria-haspopup="dialog" onClick={evento => {
                          botaoInformacao.current = evento.currentTarget;
                          setStatusAberto(null); setInformacaoAberta(cliente);
                        }}><span aria-hidden="true">?</span></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </section>

        <aside className="excel-side-column">
          <section className={`excel-side-card priority-card ${prioridadeAberta ? "is-open" : "is-collapsed"}`}>
            <button type="button" className="priority-toggle" onClick={() => setPrioridadeAberta((atual) => !atual)} aria-expanded={prioridadeAberta}>
              <span><small>Prioridade fixa</small><strong>Controle mercados</strong></span>
              <span className={`priority-chevron ${prioridadeAberta ? "open" : ""}`} aria-hidden="true">⌄</span>
            </button>
            {prioridadeAberta && (
              <div className="priority-content">
                <p>Esses três clientes são prioridade no início do mês. A meta é verificar os acessos entre os dias 1 e 3, conciliando com os atendimentos de suporte.</p>
                <div className="priority-list">
                  {mercadosPrioritarios.map((mercado) => {
                    const chave = compartilhado.snapshot.prioridades?.[mercado] ?? mercado;
                    const registro = obterRegistro(chave);
                    return (
                      <div className="priority-row" key={mercado}>
                        <span>{nomeExibido(chave)}</span>
                        <strong className={`priority-status priority-status-${registro.status.toLowerCase()}`}>{compartilhado.carregado ? rotulosStatus[registro.status] : "Aguardando dados"}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <div className="excel-section-actions excel-section-actions-notices">
            <button className="excel-toolbar-button" disabled={!disponivel || ocupado} onClick={() => { setErroAviso(""); setModalAviso("incluir"); }}>
              <span>Incluir<br />Aviso</span><strong aria-hidden="true">＋</strong>
            </button>
            <button className="excel-toolbar-button" onClick={abrirAlteracaoAviso} disabled={!disponivel || ocupado || avisosExtras.length === 0}>
              <span>Alterar<br />Aviso</span><strong aria-hidden="true">✎</strong>
            </button>
          </div>

          <section className="excel-side-card xaxim-card">
            <span className="xaxim-alert">Extremamente importante</span>
            <h2>Xaxim Gás</h2>
            <p>Empresa do web. Todo dia 01, enviar os arquivos manualmente para o e-mail abaixo. Este aviso fica sempre visível para não ser esquecido.</p>
            <strong className="xaxim-email">rubinhogmasters@gmail.com</strong>
          </section>

          {avisosExtras.map((aviso) => (
            <section className="excel-side-card custom-notice-card" key={aviso.id}>
              <span className="excel-eyebrow">Aviso fixo</span><h2>{aviso.titulo}</h2><p>{aviso.texto}</p>
            </section>
          ))}

          <section className="excel-side-card info-card">
            <span className="excel-eyebrow">Como funciona</span><h2>Controle por mês</h2>
            <p>Cada mês mantém seu próprio status e suas próprias observações. Os cadastros, avisos e informações adicionais ficam no banco compartilhado e aparecem nos computadores conectados ao mesmo sistema.</p>
          </section>
        </aside>
      </main>

      {modalCliente === "incluir" && (
        <div className="excel-modal-backdrop" onMouseDown={fecharFormularioCliente}>
          <section ref={formularioRef} className="excel-modal excel-modal-clientes" role="dialog" aria-modal="true"
            aria-labelledby="excel-incluir-cliente" aria-busy={ocupado} tabIndex={-1}
            onKeyDown={(evento) => tecladoFormulario(evento, fecharFormularioCliente)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div><span className="excel-eyebrow">Novo cliente</span><h2 id="excel-incluir-cliente">Incluir cliente</h2></div>
              <button className="excel-modal-close" aria-label="Fechar formulário de cliente" disabled={ocupado} onClick={fecharFormularioCliente}>×</button>
            </div>
            <fieldset className="excel-form-group" disabled={ocupado || !disponivel}>
            <label className="excel-form-field"><span>Nome principal</span><input value={novoCliente} onChange={(event) => setNovoCliente(event.target.value)} placeholder="Ex.: Mercado Central" /></label>
            <label className="excel-form-field">
              <span>Outros nomes para pesquisa</span>
              <textarea rows={4} value={novosNomesBusca} onChange={(event) => setNovosNomesBusca(event.target.value)} placeholder={"Um nome por linha. Ex.:\nRazão Social Ltda\nMercado do João\nCentral Alimentos"} />
              <small>Use para nome fantasia, razão social, abreviações e apelidos. Pode cadastrar quantos forem necessários.</small>
            </label>
            <label className="excel-form-field"><span>Informações adicionais</span>
              <textarea aria-label="Informações adicionais" rows={4} maxLength={LIMITE_INFORMACOES_CLIENTE} value={novasInformacoes} onChange={event => setNovasInformacoes(event.target.value)} placeholder="Particularidades e orientações específicas deste cliente..." />
              <small>Informações permanentes, exibidas no botão ?. Salvas no banco compartilhado e separadas das observações de cada mês.</small>
            </label>
            </fieldset>
            {erroCliente && <p role="alert" className="excel-cliente-erro">{erroCliente}</p>}
            <div className="excel-modal-actions">
              <button className="excel-action-button" disabled={ocupado} onClick={fecharFormularioCliente}>Cancelar</button>
              <button className="excel-action-button primary" onClick={() => void incluirCliente()} disabled={!novoCliente.trim() || ocupado || !disponivel}>{ocupado ? "Salvando..." : "Incluir"}</button>
            </div>
          </section>
        </div>
      )}

      {modalCliente === "alterar" && (
        <div className="excel-modal-backdrop" onMouseDown={fecharFormularioCliente}>
          <section ref={formularioRef} className="excel-modal excel-modal-clientes" role="dialog" aria-modal="true"
            aria-labelledby="excel-alterar-cliente" aria-busy={ocupado} tabIndex={-1}
            onKeyDown={(evento) => tecladoFormulario(evento, fecharFormularioCliente)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div><span className="excel-eyebrow">Cadastro de cliente</span><h2 id="excel-alterar-cliente">Alterar cliente</h2></div>
              <button className="excel-modal-close" aria-label="Fechar formulário de cliente" disabled={ocupado} onClick={fecharFormularioCliente}>×</button>
            </div>
            <fieldset className="excel-form-group" disabled={ocupado || !disponivel}>
            <label className="excel-form-field">
              <span>Cliente</span>
              <select value={clienteSelecionado} onChange={(event) => trocarClienteSelecionado(event.target.value)}>
                {clientes.map((cliente) => <option key={cliente} value={cliente}>#{vinculosClientes[cliente]} — {nomeExibido(cliente)}</option>)}
              </select>
            </label>
            <label className="excel-form-field"><span>Nome principal</span><input value={clienteAlteradoNome} onChange={(event) => setClienteAlteradoNome(event.target.value)} /></label>
            <label className="excel-form-field">
              <span>Outros nomes para pesquisa</span>
              <textarea rows={5} value={clienteAlteradoNomesBusca} onChange={(event) => setClienteAlteradoNomesBusca(event.target.value)} placeholder="Um nome por linha" />
              <small>Ex.: nome fantasia, razão social, abreviação ou qualquer nome pelo qual o cliente é conhecido.</small>
            </label>
            <label className="excel-form-field"><span>Informações adicionais</span>
              <textarea aria-label="Informações adicionais" rows={4} maxLength={LIMITE_INFORMACOES_CLIENTE} value={clienteAlteradoInformacoes} onChange={event => setClienteAlteradoInformacoes(event.target.value)} placeholder="Particularidades e orientações específicas deste cliente..." />
              <small>Informações permanentes, exibidas no botão ?. Salvas no banco compartilhado e separadas das observações de cada mês.</small>
            </label>
            </fieldset>
            {erroCliente && <p role="alert" className="excel-cliente-erro">{erroCliente}</p>}
            <div className="excel-modal-actions">
              <button className="excel-action-button" disabled={ocupado} onClick={fecharFormularioCliente}>Cancelar</button>
              <button className="excel-action-button primary" onClick={() => void salvarAlteracaoCliente()} disabled={!clienteAlteradoNome.trim() || ocupado || !disponivel}>{ocupado ? "Salvando..." : "Salvar alteração"}</button>
            </div>
          </section>
        </div>
      )}

      {modalAviso === "incluir" && (
        <div className="excel-modal-backdrop" onMouseDown={fecharFormularioAviso}>
          <section ref={formularioRef} className="excel-modal" role="dialog" aria-modal="true"
            aria-labelledby="excel-incluir-aviso" aria-busy={ocupado} tabIndex={-1}
            onKeyDown={(evento) => tecladoFormulario(evento, fecharFormularioAviso)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading"><div><span className="excel-eyebrow">Novo aviso</span><h2 id="excel-incluir-aviso">Incluir aviso fixo</h2></div><button className="excel-modal-close" aria-label="Fechar formulário de aviso" disabled={ocupado} onClick={fecharFormularioAviso}>×</button></div>
            <fieldset className="excel-form-group" disabled={ocupado || !disponivel}>
            <label className="excel-form-field"><span>Título</span><input value={novoAvisoTitulo} onChange={(event) => setNovoAvisoTitulo(event.target.value)} placeholder="Ex.: Envio manual" /></label>
            <label className="excel-form-field"><span>Aviso</span><textarea rows={5} value={novoAvisoTexto} onChange={(event) => setNovoAvisoTexto(event.target.value)} placeholder="Digite a informação que deve ficar sempre visível..." /></label>
            </fieldset>
            {erroAviso && <p role="alert" className="excel-cliente-erro">{erroAviso}</p>}
            <div className="excel-modal-actions"><button className="excel-action-button" disabled={ocupado} onClick={fecharFormularioAviso}>Cancelar</button><button className="excel-action-button primary" onClick={() => void incluirAviso()} disabled={!novoAvisoTitulo.trim() || !novoAvisoTexto.trim() || ocupado || !disponivel}>Incluir aviso</button></div>
          </section>
        </div>
      )}

      {modalAviso === "alterar" && (
        <div className="excel-modal-backdrop" onMouseDown={fecharFormularioAviso}>
          <section ref={formularioRef} className="excel-modal" role="dialog" aria-modal="true"
            aria-labelledby="excel-alterar-aviso" aria-busy={ocupado} tabIndex={-1}
            onKeyDown={(evento) => tecladoFormulario(evento, fecharFormularioAviso)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading"><div><span className="excel-eyebrow">Avisos extras</span><h2 id="excel-alterar-aviso">Alterar aviso</h2></div><button className="excel-modal-close" aria-label="Fechar formulário de aviso" disabled={ocupado} onClick={fecharFormularioAviso}>×</button></div>
            <fieldset className="excel-form-group" disabled={ocupado || !disponivel}>
            <label className="excel-form-field"><span>Aviso</span><select value={avisoSelecionado} onChange={(event) => trocarAvisoSelecionado(event.target.value)}>{avisosExtras.map((aviso) => <option key={aviso.id} value={aviso.id}>{aviso.titulo}</option>)}</select></label>
            <label className="excel-form-field"><span>Título</span><input value={avisoAlteradoTitulo} onChange={(event) => setAvisoAlteradoTitulo(event.target.value)} /></label>
            <label className="excel-form-field"><span>Aviso</span><textarea rows={5} value={avisoAlteradoTexto} onChange={(event) => setAvisoAlteradoTexto(event.target.value)} /></label>
            </fieldset>
            {erroAviso && <p role="alert" className="excel-cliente-erro">{erroAviso}</p>}
            <div className="excel-modal-actions"><button className="excel-action-button" disabled={ocupado} onClick={fecharFormularioAviso}>Cancelar</button><button className="excel-action-button primary" onClick={() => void salvarAlteracaoAviso()} disabled={!avisoAlteradoTitulo.trim() || !avisoAlteradoTexto.trim() || ocupado || !disponivel}>Salvar alteração</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
