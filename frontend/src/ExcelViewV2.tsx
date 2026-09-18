import { useEffect, useMemo, useState } from "react";
import "./excel-search.css";

type StatusExcel = "PENDENTE" | "AGUARDANDO" | "EM_ATENDIMENTO" | "OK";
type RegistroMensal = { status: StatusExcel; observacao: string };
type AvisoExtra = { id: string; titulo: string; texto: string };
type ExcelViewProps = { competencia: string };

const clientesPadrao = [
  "Atintex PU e Tintas Leal - enviar XML e gerar relatório",
  "Fabrica do pão",
  "cristina",
  "Galo gás - contabilidade Eduardo Bocão",
  "Web",
  "Grande Rio, ct-es de entrada, envio manual",
  "Adrisal",
  "ADR",
  "Nutriunião UVA - rações do vale",
  "Nutriunião PU - rações do vale",
  "Bom dia filial",
  "Bom dia Matriz",
  "Compre bem",
  "Speedy copy",
  "Agro Vale",
  "Toca do Javali",
  "Javali Armas",
  "FL caminhões (NF-e envio manual)",
  "Ferro Velho",
  "MR Máximo (WEB), muita contingência no web (de novo)",
  "Sérgio Andrukiu UVA",
  "Sérgio Andrukiu PU",
  "Ciocco Sorvetes",
  "MM cell UVA (IBC)",
  "MM cell PU (smart)",
  "MM cell CM (matias)",
];

const mercadosPrioritarios = ["Bom dia filial", "Bom dia Matriz", "Compre bem"];
const rotulosStatus: Record<StatusExcel, string> = {
  PENDENTE: "Pendente",
  AGUARDANDO: "Aguardando",
  EM_ATENDIMENTO: "Em atendimento",
  OK: "OK",
};
const statusDisponiveis = Object.keys(rotulosStatus) as StatusExcel[];

function lerJson<T>(chave: string, padrao: T): T {
  try {
    const valor = localStorage.getItem(chave);
    return valor ? (JSON.parse(valor) as T) : padrao;
  } catch {
    return padrao;
  }
}

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

export function ExcelViewV2({ competencia }: ExcelViewProps) {
  const [clientesExtras, setClientesExtras] = useState<string[]>(() =>
    lerJson<string[]>("controle-notas-excel-clientes", []),
  );
  const [nomesAlterados, setNomesAlterados] = useState<Record<string, string>>(() =>
    lerJson<Record<string, string>>("controle-notas-excel-clientes-nomes", {}),
  );
  const [nomesBusca, setNomesBusca] = useState<Record<string, string[]>>(() =>
    lerJson<Record<string, string[]>>("controle-notas-excel-clientes-apelidos", {}),
  );
  const [registros, setRegistros] = useState<Record<string, RegistroMensal>>({});
  const [avisosExtras, setAvisosExtras] = useState<AvisoExtra[]>(() =>
    lerJson<AvisoExtra[]>("controle-notas-excel-avisos", []),
  );

  const [pesquisa, setPesquisa] = useState("");
  const [statusAberto, setStatusAberto] = useState<string | null>(null);
  const [prioridadeAberta, setPrioridadeAberta] = useState(false);
  const [modalCliente, setModalCliente] = useState<"incluir" | "alterar" | null>(null);
  const [modalAviso, setModalAviso] = useState<"incluir" | "alterar" | null>(null);

  const [novoCliente, setNovoCliente] = useState("");
  const [novosNomesBusca, setNovosNomesBusca] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [clienteAlteradoNome, setClienteAlteradoNome] = useState("");
  const [clienteAlteradoNomesBusca, setClienteAlteradoNomesBusca] = useState("");

  const [novoAvisoTitulo, setNovoAvisoTitulo] = useState("");
  const [novoAvisoTexto, setNovoAvisoTexto] = useState("");
  const [avisoSelecionado, setAvisoSelecionado] = useState("");
  const [avisoAlteradoTitulo, setAvisoAlteradoTitulo] = useState("");
  const [avisoAlteradoTexto, setAvisoAlteradoTexto] = useState("");

  const clientes = useMemo(() => [...new Set([...clientesPadrao, ...clientesExtras])], [clientesExtras]);

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
    if (!competencia) return;
    setRegistros(
      lerJson<Record<string, RegistroMensal>>(`controle-notas-excel-registros-${competencia}`, {}),
    );
    setStatusAberto(null);
  }, [competencia]);

  function nomeExibido(chave: string) {
    return nomesAlterados[chave] || chave;
  }

  function obterRegistro(chave: string): RegistroMensal {
    return registros[chave] ?? { status: "PENDENTE", observacao: "" };
  }

  function salvarRegistros(proximos: Record<string, RegistroMensal>) {
    setRegistros(proximos);
    localStorage.setItem(`controle-notas-excel-registros-${competencia}`, JSON.stringify(proximos));
  }

  function salvarNomesBusca(proximos: Record<string, string[]>) {
    setNomesBusca(proximos);
    localStorage.setItem("controle-notas-excel-clientes-apelidos", JSON.stringify(proximos));
  }

  function alterarStatus(chave: string, status: StatusExcel) {
    salvarRegistros({ ...registros, [chave]: { ...obterRegistro(chave), status } });
    setStatusAberto(null);
  }

  function alterarObservacao(chave: string, observacao: string) {
    salvarRegistros({ ...registros, [chave]: { ...obterRegistro(chave), observacao } });
  }

  function incluirCliente() {
    const nome = novoCliente.trim();
    if (!nome) return;
    const duplicado = clientes.some((cliente) => normalizar(nomeExibido(cliente)) === normalizar(nome));
    if (duplicado) return;

    const proximos = [...clientesExtras, nome];
    setClientesExtras(proximos);
    localStorage.setItem("controle-notas-excel-clientes", JSON.stringify(proximos));

    const alternativos = parseNomes(novosNomesBusca);
    if (alternativos.length > 0) salvarNomesBusca({ ...nomesBusca, [nome]: alternativos });

    setNovoCliente("");
    setNovosNomesBusca("");
    setModalCliente(null);
  }

  function abrirAlteracaoCliente() {
    const primeiro = clientes[0] ?? "";
    setClienteSelecionado(primeiro);
    setClienteAlteradoNome(primeiro ? nomeExibido(primeiro) : "");
    setClienteAlteradoNomesBusca((nomesBusca[primeiro] || []).join("\n"));
    setModalCliente("alterar");
  }

  function trocarClienteSelecionado(chave: string) {
    setClienteSelecionado(chave);
    setClienteAlteradoNome(nomeExibido(chave));
    setClienteAlteradoNomesBusca((nomesBusca[chave] || []).join("\n"));
  }

  function salvarAlteracaoCliente() {
    const nome = clienteAlteradoNome.trim();
    if (!clienteSelecionado || !nome) return;

    const proximosNomes = { ...nomesAlterados, [clienteSelecionado]: nome };
    setNomesAlterados(proximosNomes);
    localStorage.setItem("controle-notas-excel-clientes-nomes", JSON.stringify(proximosNomes));
    salvarNomesBusca({ ...nomesBusca, [clienteSelecionado]: parseNomes(clienteAlteradoNomesBusca) });
    setModalCliente(null);
  }

  function incluirAviso() {
    const titulo = novoAvisoTitulo.trim();
    const texto = novoAvisoTexto.trim();
    if (!titulo || !texto) return;

    const proximos = [
      ...avisosExtras,
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, titulo, texto },
    ];
    setAvisosExtras(proximos);
    localStorage.setItem("controle-notas-excel-avisos", JSON.stringify(proximos));
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
    setModalAviso("alterar");
  }

  function trocarAvisoSelecionado(id: string) {
    const aviso = avisosExtras.find((item) => item.id === id);
    setAvisoSelecionado(id);
    setAvisoAlteradoTitulo(aviso?.titulo ?? "");
    setAvisoAlteradoTexto(aviso?.texto ?? "");
  }

  function salvarAlteracaoAviso() {
    if (!avisoSelecionado || !avisoAlteradoTitulo.trim() || !avisoAlteradoTexto.trim()) return;
    const proximos = avisosExtras.map((aviso) =>
      aviso.id === avisoSelecionado
        ? { ...aviso, titulo: avisoAlteradoTitulo.trim(), texto: avisoAlteradoTexto.trim() }
        : aviso,
    );
    setAvisosExtras(proximos);
    localStorage.setItem("controle-notas-excel-avisos", JSON.stringify(proximos));
    setModalAviso(null);
  }

  return (
    <div className="excel-page excel-page-clean">
      <main className="excel-layout">
        <section className="excel-main-column">
          <div className="excel-section-actions">
            <button className="excel-toolbar-button" onClick={() => setModalCliente("incluir")}>
              <span>Incluir<br />Cliente</span><strong aria-hidden="true">＋</strong>
            </button>
            <button className="excel-toolbar-button" onClick={abrirAlteracaoCliente}>
              <span>Alterar<br />Cliente</span><strong aria-hidden="true">✎</strong>
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
              {clientesFiltrados.length === 0 ? (
                <div className="excel-search-empty">Nenhum cliente encontrado com esse nome.</div>
              ) : clientesFiltrados.map((cliente) => {
                const registro = obterRegistro(cliente);
                return (
                  <div className="excel-table-row" key={cliente}>
                    <div className="excel-client-name">
                      {nomeExibido(cliente)}
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
                                onClick={() => alterarStatus(cliente, status)}
                              >
                                {rotulosStatus[status]}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="excel-note">
                      <input
                        className="excel-note-input"
                        value={registro.observacao}
                        onChange={(event) => alterarObservacao(cliente, event.target.value)}
                        placeholder="Adicionar observação..."
                      />
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
                    const registro = obterRegistro(mercado);
                    return (
                      <div className="priority-row" key={mercado}>
                        <span>{nomeExibido(mercado)}</span>
                        <strong className={`priority-status priority-status-${registro.status.toLowerCase()}`}>{rotulosStatus[registro.status]}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <div className="excel-section-actions excel-section-actions-notices">
            <button className="excel-toolbar-button" onClick={() => setModalAviso("incluir")}>
              <span>Incluir<br />Aviso</span><strong aria-hidden="true">＋</strong>
            </button>
            <button className="excel-toolbar-button" onClick={abrirAlteracaoAviso} disabled={avisosExtras.length === 0}>
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
            <p>Cada mês mantém seu próprio status e suas próprias observações. Os clientes incluídos e os avisos permanecem disponíveis nos meses seguintes.</p>
          </section>
        </aside>
      </main>

      {modalCliente === "incluir" && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalCliente(null)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div><span className="excel-eyebrow">Novo cliente</span><h2>Incluir cliente</h2></div>
              <button className="excel-modal-close" onClick={() => setModalCliente(null)}>×</button>
            </div>
            <label className="excel-form-field"><span>Nome principal</span><input value={novoCliente} onChange={(event) => setNovoCliente(event.target.value)} placeholder="Ex.: Mercado Central" autoFocus /></label>
            <label className="excel-form-field">
              <span>Outros nomes para pesquisa</span>
              <textarea rows={4} value={novosNomesBusca} onChange={(event) => setNovosNomesBusca(event.target.value)} placeholder={"Um nome por linha. Ex.:\nRazão Social Ltda\nMercado do João\nCentral Alimentos"} />
              <small>Use para nome fantasia, razão social, abreviações e apelidos. Pode cadastrar quantos forem necessários.</small>
            </label>
            <div className="excel-modal-actions">
              <button className="excel-action-button" onClick={() => setModalCliente(null)}>Cancelar</button>
              <button className="excel-action-button primary" onClick={incluirCliente} disabled={!novoCliente.trim()}>Incluir</button>
            </div>
          </section>
        </div>
      )}

      {modalCliente === "alterar" && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalCliente(null)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div><span className="excel-eyebrow">Cadastro de cliente</span><h2>Alterar cliente</h2></div>
              <button className="excel-modal-close" onClick={() => setModalCliente(null)}>×</button>
            </div>
            <label className="excel-form-field">
              <span>Cliente</span>
              <select value={clienteSelecionado} onChange={(event) => trocarClienteSelecionado(event.target.value)}>
                {clientes.map((cliente) => <option key={cliente} value={cliente}>{nomeExibido(cliente)}</option>)}
              </select>
            </label>
            <label className="excel-form-field"><span>Nome principal</span><input value={clienteAlteradoNome} onChange={(event) => setClienteAlteradoNome(event.target.value)} /></label>
            <label className="excel-form-field">
              <span>Outros nomes para pesquisa</span>
              <textarea rows={5} value={clienteAlteradoNomesBusca} onChange={(event) => setClienteAlteradoNomesBusca(event.target.value)} placeholder="Um nome por linha" />
              <small>Ex.: nome fantasia, razão social, abreviação ou qualquer nome pelo qual o cliente é conhecido.</small>
            </label>
            <div className="excel-modal-actions">
              <button className="excel-action-button" onClick={() => setModalCliente(null)}>Cancelar</button>
              <button className="excel-action-button primary" onClick={salvarAlteracaoCliente} disabled={!clienteAlteradoNome.trim()}>Salvar alteração</button>
            </div>
          </section>
        </div>
      )}

      {modalAviso === "incluir" && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalAviso(null)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading"><div><span className="excel-eyebrow">Novo aviso</span><h2>Incluir aviso fixo</h2></div><button className="excel-modal-close" onClick={() => setModalAviso(null)}>×</button></div>
            <label className="excel-form-field"><span>Título</span><input value={novoAvisoTitulo} onChange={(event) => setNovoAvisoTitulo(event.target.value)} placeholder="Ex.: Envio manual" autoFocus /></label>
            <label className="excel-form-field"><span>Aviso</span><textarea rows={5} value={novoAvisoTexto} onChange={(event) => setNovoAvisoTexto(event.target.value)} placeholder="Digite a informação que deve ficar sempre visível..." /></label>
            <div className="excel-modal-actions"><button className="excel-action-button" onClick={() => setModalAviso(null)}>Cancelar</button><button className="excel-action-button primary" onClick={incluirAviso} disabled={!novoAvisoTitulo.trim() || !novoAvisoTexto.trim()}>Incluir aviso</button></div>
          </section>
        </div>
      )}

      {modalAviso === "alterar" && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalAviso(null)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading"><div><span className="excel-eyebrow">Avisos extras</span><h2>Alterar aviso</h2></div><button className="excel-modal-close" onClick={() => setModalAviso(null)}>×</button></div>
            <label className="excel-form-field"><span>Aviso</span><select value={avisoSelecionado} onChange={(event) => trocarAvisoSelecionado(event.target.value)}>{avisosExtras.map((aviso) => <option key={aviso.id} value={aviso.id}>{aviso.titulo}</option>)}</select></label>
            <label className="excel-form-field"><span>Título</span><input value={avisoAlteradoTitulo} onChange={(event) => setAvisoAlteradoTitulo(event.target.value)} /></label>
            <label className="excel-form-field"><span>Aviso</span><textarea rows={5} value={avisoAlteradoTexto} onChange={(event) => setAvisoAlteradoTexto(event.target.value)} /></label>
            <div className="excel-modal-actions"><button className="excel-action-button" onClick={() => setModalAviso(null)}>Cancelar</button><button className="excel-action-button primary" onClick={salvarAlteracaoAviso} disabled={!avisoAlteradoTitulo.trim() || !avisoAlteradoTexto.trim()}>Salvar alteração</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
