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

function formatarCompetencia(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  return `${mes}/${ano}`;
}

export function ExcelView({ competencia }: ExcelViewProps) {
  const [clientesExtras, setClientesExtras] = useState<string[]>(() =>
    lerJson<string[]>("controle-notas-excel-clientes", []),
  );
  const [registros, setRegistros] = useState<Record<string, RegistroMensal>>({});
  const [avisosExtras, setAvisosExtras] = useState<AvisoExtra[]>(() =>
    lerJson<AvisoExtra[]>("controle-notas-excel-avisos", []),
  );
  const [modalCliente, setModalCliente] = useState(false);
  const [modalAviso, setModalAviso] = useState(false);
  const [novoCliente, setNovoCliente] = useState("");
  const [novoAvisoTitulo, setNovoAvisoTitulo] = useState("");
  const [novoAvisoTexto, setNovoAvisoTexto] = useState("");

  const clientes = useMemo(() => {
    const nomes = [...clientesPadrao, ...clientesExtras];
    return [...new Set(nomes)];
  }, [clientesExtras]);

  useEffect(() => {
    if (!competencia) return;
    const chave = `controle-notas-excel-registros-${competencia}`;
    setRegistros(lerJson<Record<string, RegistroMensal>>(chave, {}));
  }, [competencia]);

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

    const jaExiste = clientes.some((cliente) => cliente.toLocaleLowerCase() === nome.toLocaleLowerCase());
    if (jaExiste) return;

    const proximos = [...clientesExtras, nome];
    setClientesExtras(proximos);
    localStorage.setItem("controle-notas-excel-clientes", JSON.stringify(proximos));
    setNovoCliente("");
    setModalCliente(false);
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
    setModalAviso(false);
  }

  return (
    <div className="excel-page">
      <header className="excel-page-header excel-page-header-actions">
        <div>
          <span className="excel-eyebrow">Pedroso Automação</span>
          <h1>Controle mensal — {formatarCompetencia(competencia)}</h1>
          <p>
            Visão rápida no estilo da planilha, com status mensal, observações, prioridades e avisos sempre
            visíveis.
          </p>
        </div>

        <div className="excel-header-buttons">
          <button className="excel-action-button primary" onClick={() => setModalCliente(true)}>
            Incluir
          </button>
          <button className="excel-action-button" onClick={() => setModalAviso(true)}>
            Incluir aviso
          </button>
        </div>
      </header>

      <main className="excel-layout">
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
                  <div className="excel-client-name">{cliente}</div>
                  <div className="excel-status-cell">
                    <select
                      className={`excel-status-select excel-status-select-${registro.status.toLowerCase()}`}
                      value={registro.status}
                      onChange={(event) => alterarStatus(cliente, event.target.value as StatusExcel)}
                    >
                      {statusDisponiveis.map((status) => (
                        <option key={status} value={status}>
                          {rotulosStatus[status]}
                        </option>
                      ))}
                    </select>
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

        <aside className="excel-side-column">
          <section className="excel-side-card priority-card">
            <span className="excel-eyebrow">Prioridade fixa</span>
            <h2>Controle mercados</h2>
            <p>
              Esses três clientes são sempre prioridade no início do mês. A meta é verificar os acessos entre os
              dias 1 e 3, conciliando com os atendimentos de suporte.
            </p>

            <div className="priority-list">
              {mercadosPrioritarios.map((mercado) => {
                const registro = obterRegistro(mercado);

                return (
                  <div className="priority-row" key={mercado}>
                    <span>{mercado}</span>
                    <strong className={`priority-status priority-status-${registro.status.toLowerCase()}`}>
                      {rotulosStatus[registro.status]}
                    </strong>
                  </div>
                );
              })}
            </div>
          </section>

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

      {modalCliente && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalCliente(false)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div>
                <span className="excel-eyebrow">Novo cliente</span>
                <h2>Incluir cliente</h2>
              </div>
              <button className="excel-modal-close" onClick={() => setModalCliente(false)}>
                ×
              </button>
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
              <button className="excel-action-button" onClick={() => setModalCliente(false)}>
                Cancelar
              </button>
              <button className="excel-action-button primary" onClick={incluirCliente} disabled={!novoCliente.trim()}>
                Incluir
              </button>
            </div>
          </section>
        </div>
      )}

      {modalAviso && (
        <div className="excel-modal-backdrop" onMouseDown={() => setModalAviso(false)}>
          <section className="excel-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="excel-modal-heading">
              <div>
                <span className="excel-eyebrow">Novo aviso</span>
                <h2>Incluir aviso fixo</h2>
              </div>
              <button className="excel-modal-close" onClick={() => setModalAviso(false)}>
                ×
              </button>
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
              <button className="excel-action-button" onClick={() => setModalAviso(false)}>
                Cancelar
              </button>
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
    </div>
  );
}
