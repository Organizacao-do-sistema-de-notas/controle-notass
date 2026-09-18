import { useEffect, useMemo, useState } from "react";

type StatusExcel = "PENDENTE" | "AGUARDANDO" | "EM_ATENDIMENTO" | "OK";

type RegistroMensal = {
  status: StatusExcel;
  observacao: string;
};

type AvisoExtra = {
  id: string;
  titulo: string;
  texto: string;
};

type ExcelViewProps = {
  competencia: string;
};

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

export function ExcelView({ competencia }: ExcelViewProps) {
  const [clientesExtras, setClientesExtras] = useState<string[]>(() =>
    lerJson<string[]>("controle-notas-excel-clientes", []),
  );
  const [nomesAlterados, setNomesAlterados] = useState<Record<string, string>>(() =>
    lerJson<Record<string, string>>("controle-notas-excel-clientes-nomes", {}),
  );
  const [registros, setRegistros] = useState<Record<string, RegistroMensal>>({});
  const [avisosExtras, setAvisosExtras] = useState<AvisoExtra[]>(() =>
    lerJson<AvisoExtra[]>("controle-notas-excel-avisos", []),
  );

  const [statusAberto, setStatusAberto] = useState<string | null>(null);
  const [prioridadeAberta, setPrioridadeAberta] = useState(false);
  const [modalCliente, setModalCliente] = useState<"incluir" | "alterar" | null>(null);
  const [modalAviso, setModalAviso] = useState<"incluir" | "alterar" | null>(null);

  const [novoCliente, setNovoCliente] = useState("");
  const [clienteSelecionado, setClienteSelecionado] = useState("");
  const [clienteAlteradoNome, setClienteAlteradoNome] = useState("");

  const [novoAvisoTitulo, setNovoAvisoTitulo] = useState("");
  const [novoAvisoTexto, setNovoAvisoTexto] = useState("");
  const [avisoSelecionado, setAvisoSelecionado] = useState("");
  const [avisoAlteradoTitulo, setAvisoAlteradoTitulo] = useState("");
  const [avisoAlteradoTexto, setAvisoAlteradoTexto] = useState("");

  const clientes = useMemo(() => {
    const nomes = [...clientesPadrao, ...clientesExtras];
    return [...new Set(nomes)];
  }, [clientesExtras]);

  useEffect(() => {
    if (!competencia) return;
    const chave = `controle-notas-excel-registros-${competencia}`;
    setRegistros(lerJson<Record<string, RegistroMensal>>(chave, {}));
    setStatusAberto(null);
  }, [competencia]);

  function nomeExibido(chave: string): string {
    return nomesAlterados[chave] || chave;
  }

  function salvarRegistros(proximos: Record<string, RegistroMensal>) {
    setRegistros(proximos);
    localStorage.setItem(`controle-notas-excel-registros-${competencia}`, JSON.stringify(proximos));
  }

  function obterRegistro(nome: string): RegistroMensal {
    return registros[nome] ?? { status: "PENDENTE", observacao: "" };
  }

  function alterarStatus(nome: string, status: StatusExcel) {
    salvarRegistros({
      ...registros,
      [nome]: {
        ...obterRegistro(nome),
        status,
      },
    });
    setStatusAberto(null);
  }

  function alterarObservacao(nome: string, observacao: string) {
    salvarRegistros({
      ...registros,
      [nome]: {
        ...obterRegistro(nome),
        observacao,
      },
    });
  }

  function incluirCliente() {
    const nome = novoCliente.trim();
    if (!nome) return;

    const jaExiste = clientes.some(
      (cliente) => nomeExibido(cliente).toLocaleLowerCase() === nome.toLocaleLowerCase(),
    );
    if (jaExiste) return;

    const proximos = [...clientesExtras, nome];
    setClientesExtras(proximos);
    localStorage.setItem("controle-notas-excel-clientes", JSON.stringify(proximos));
    setNovoCliente("");
    setModalCliente(null);
  }

  function abrirAlteracaoCliente() {
    const primeiro = clientes[0] ?? "";
    setClienteSelecionado(primeiro);
    setClienteAlteradoNome(primeiro ? nomeExibido(primeiro) : "");
    setModalCliente("alterar");
  }

  function trocarClienteSelecionado(chave: string) {
    setClienteSelecionado(chave);
    setClienteAlteradoNome(nomeExibido(chave));
  }

  function salvarAlteracaoCliente() {
    const nome = clienteAlteradoNome.trim();
    if (!clienteSelecionado || !nome) return;

    const proximos = {
      ...nomesAlterados,
      [clienteSelecionado]: nome,
    };

    setNomesAlterados(proximos);
    localStorage.setItem("controle-notas-excel-clientes-nomes", JSON.stringify(proximos));
    setModalCliente(null);
  }

  function incluirAviso() {
    const titulo = novoAvisoTitulo.trim();
    const texto = novoAvisoTexto.trim();
    if (!titulo || !texto) return;

    const proximo: AvisoExtra = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      titulo,
      texto,
    };

    const proximos = [...avisosExtras, proximo];
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
    const titulo = avisoAlteradoTitulo.trim();
    const texto = avisoAlteradoTexto.trim();
    if (!avisoSelecionado || !titulo || !texto) return;

    const proximos = avisosExtras.map((aviso) =>
      aviso.id === avisoSelecionado ? { ...aviso, titulo, texto } : aviso,
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
              <span>Incluir<br />Cliente</span>
              <strong aria-hidden="true">＋</strong>
            </button>
            <button className="excel-toolbar-button" onClick={abrirAlteracaoCliente}>
              <span>Alterar<br />Cliente</span>
              <strong aria-hidden="true">✎</strong>
            </button>
          </div>

          <section className="excel-table-card">
            <div className="excel-table-head">
              <div>Clientes</div>
              <div>Status</div>
              <div>Obs</div>
            </div>

            <div className="excel-table-body">
              {clientes.map((cliente) => {
                const registro = obterRegistro(cliente);

                return (
                  <div className="excel-table-row" key={cliente}>
                    <div className="excel-client-name">{nomeExibido(cliente)}</div>
                    <div className="excel-status-cell">
                      <div
                        className="excel-status-dropdown"
                        onBlur={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setStatusAberto(null);
                          }
                        }}
                      >
                        <button
                          type="button"
                          className={`excel-status-trigger excel-status-${registro.status.toLowerCase()}`}
                          onClick={() => setStatusAberto(statusAberto === cliente ? null : cliente)}
                          aria-expanded={statusAberto === cliente}
                        >
                          <span>{rotulosStatus[registro.status]}</span>
                          <span aria-hidden="true">⌄</span>
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
            <button
              type="button"
              className="priority-toggle"
              onClick={() => setPrioridadeAberta((atual) => !atual)}
              aria-expanded={prioridadeAberta}
            >
              <span>
                <small>Prioridade fixa</small>
                <strong>Controle mercados</strong>
              </span>
              <span className={`priority-chevron ${prioridadeAberta ? "open" : ""}`} aria-hidden="true">
                ⌄
              </span>
            </button>

            {prioridadeAberta && (
              <div className="priority-content">
                <p>
                  Esses três clientes são prioridade no início do mês. A meta é verificar os acessos entre os
                  dias 1 e 3, conciliando com os atendimentos de suporte.
                </p>

                <div className="priority-list">
                  {mercadosPrioritarios.map((mercado) => {
                    const registro = obterRegistro(mercado);

                    return (
                      <div className="priority-row" key={mercado}>
                        <span>{nomeExibido(mercado)}</span>
                        <strong className={`priority-status priority-status-${registro.status.toLowerCase()}`}>
                          {rotulosStatus[registro.status]}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          <div className="excel-section-actions excel-section-actions-notices">
            <button className="excel-toolbar-button" onClick={() => setModalAviso("incluir")}>
              <span>Incluir<br />Aviso</span>
              <strong aria-hidden="true">＋</strong>
            </button>
            <button
              className="excel-toolbar-button"
              onClick={abrirAlteracaoAviso}
              disabled={avisosExtras.length === 0}
            >
              <span>Alterar<br />Aviso</span>
              <strong aria-hidden="true">✎</strong>
            </button>
          </div>

          <section className="excel-side-card xaxim-card">
            <span className="xaxim-alert">Extremamente importante</span>
            <h2>Xaxim Gás</h2>
            <p>
              Empresa do web. Todo dia 01, enviar os arquivos manualmente para o e-mail abaixo. Este aviso fica
              sempre visível para não ser esquecido.
            </p>
            <strong className="xaxim-email">rubinhogmasters@gmail.com</strong>
          </section>

          {avisosExtras.map((aviso) => (
            <section className="excel-side-card custom-notice-card" key={aviso.id}>
              <span className="excel-eyebrow">Aviso fixo</span>
              <h2>{aviso.titulo}</h2>
              <p>{aviso.texto}</p>
            </section>
          ))}

          <section className="excel-side-card info-card">
            <span className="excel-eyebrow">Como funciona</span>
            <h2>Controle por mês</h2>
            <p>
              Cada mês mantém seu próprio status e suas próprias observações. Os clientes incluídos e os avisos
              permanecem disponíveis nos meses seguintes.
            </p>
          </section>
        </aside>
      </main>

      {modalCliente === "incluir" && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalCliente(null)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div>
                <span className="excel-eyebrow">Novo cliente</span>
                <h2>Incluir cliente</h2>
              </div>
              <button className="excel-modal-close" onClick={() => setModalCliente(null)}>×</button>
            </div>

            <label className="excel-form-field">
              <span>Nome do cliente</span>
              <input
                value={novoCliente}
                onChange={(event) => setNovoCliente(event.target.value)}
                placeholder="Ex.: Mercado Central"
                autoFocus
              />
            </label>

            <div className="excel-modal-actions">
              <button className="excel-action-button" onClick={() => setModalCliente(null)}>Cancelar</button>
              <button className="excel-action-button primary" onClick={incluirCliente} disabled={!novoCliente.trim()}>
                Incluir
              </button>
            </div>
          </section>
        </div>
      )}

      {modalCliente === "alterar" && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalCliente(null)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div>
                <span className="excel-eyebrow">Cadastro de cliente</span>
                <h2>Alterar cliente</h2>
              </div>
              <button className="excel-modal-close" onClick={() => setModalCliente(null)}>×</button>
            </div>

            <label className="excel-form-field">
              <span>Cliente</span>
              <select value={clienteSelecionado} onChange={(event) => trocarClienteSelecionado(event.target.value)}>
                {clientes.map((cliente) => (
                  <option key={cliente} value={cliente}>{nomeExibido(cliente)}</option>
                ))}
              </select>
            </label>

            <label className="excel-form-field">
              <span>Nome</span>
              <input value={clienteAlteradoNome} onChange={(event) => setClienteAlteradoNome(event.target.value)} />
            </label>

            <div className="excel-modal-actions">
              <button className="excel-action-button" onClick={() => setModalCliente(null)}>Cancelar</button>
              <button
                className="excel-action-button primary"
                onClick={salvarAlteracaoCliente}
                disabled={!clienteAlteradoNome.trim()}
              >
                Salvar alteração
              </button>
            </div>
          </section>
        </div>
      )}

      {modalAviso === "incluir" && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalAviso(null)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div>
                <span className="excel-eyebrow">Novo aviso</span>
                <h2>Incluir aviso fixo</h2>
              </div>
              <button className="excel-modal-close" onClick={() => setModalAviso(null)}>×</button>
            </div>

            <label className="excel-form-field">
              <span>Título</span>
              <input
                value={novoAvisoTitulo}
                onChange={(event) => setNovoAvisoTitulo(event.target.value)}
                placeholder="Ex.: Envio manual"
                autoFocus
              />
            </label>

            <label className="excel-form-field">
              <span>Aviso</span>
              <textarea
                rows={5}
                value={novoAvisoTexto}
                onChange={(event) => setNovoAvisoTexto(event.target.value)}
                placeholder="Digite a informação que deve ficar sempre visível..."
              />
            </label>

            <div className="excel-modal-actions">
              <button className="excel-action-button" onClick={() => setModalAviso(null)}>Cancelar</button>
              <button
                className="excel-action-button primary"
                onClick={incluirAviso}
                disabled={!novoAvisoTitulo.trim() || !novoAvisoTexto.trim()}
              >
                Incluir aviso
              </button>
            </div>
          </section>
        </div>
      )}

      {modalAviso === "alterar" && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalAviso(null)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div>
                <span className="excel-eyebrow">Avisos extras</span>
                <h2>Alterar aviso</h2>
              </div>
              <button className="excel-modal-close" onClick={() => setModalAviso(null)}>×</button>
            </div>

            <label className="excel-form-field">
              <span>Aviso</span>
              <select value={avisoSelecionado} onChange={(event) => trocarAvisoSelecionado(event.target.value)}>
                {avisosExtras.map((aviso) => (
                  <option key={aviso.id} value={aviso.id}>{aviso.titulo}</option>
                ))}
              </select>
            </label>

            <label className="excel-form-field">
              <span>Título</span>
              <input
                value={avisoAlteradoTitulo}
                onChange={(event) => setAvisoAlteradoTitulo(event.target.value)}
              />
            </label>

            <label className="excel-form-field">
              <span>Aviso</span>
              <textarea
                rows={5}
                value={avisoAlteradoTexto}
                onChange={(event) => setAvisoAlteradoTexto(event.target.value)}
              />
            </label>

            <div className="excel-modal-actions">
              <button className="excel-action-button" onClick={() => setModalAviso(null)}>Cancelar</button>
              <button
                className="excel-action-button primary"
                onClick={salvarAlteracaoAviso}
                disabled={!avisoAlteradoTitulo.trim() || !avisoAlteradoTexto.trim()}
              >
                Salvar alteração
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
