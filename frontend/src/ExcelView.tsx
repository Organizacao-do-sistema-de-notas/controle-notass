type LinhaCliente = {
  nome: string;
  status: "OK" | "ATENCAO";
  observacao?: string;
};

const clientes: LinhaCliente[] = [
  { nome: "Atintex PU e Tintas Leal - enviar XML e gerar relatório", status: "OK" },
  { nome: "Fabrica do pão", status: "OK" },
  { nome: "cristina", status: "OK", observacao: "4157 cancelada / 4155 inutilizada" },
  {
    nome: "Galo gás - contabilidade Eduardo Bocão",
    status: "OK",
    observacao: "11.489 / 11.431 / 11.356 inutilizadas / 922 cancelada",
  },
  { nome: "Web", status: "OK" },
  { nome: "Grande Rio, ct-es de entrada, envio manual", status: "OK" },
  { nome: "Adrisal", status: "OK" },
  { nome: "ADR", status: "OK" },
  { nome: "Nutriunião UVA - rações do vale", status: "OK" },
  { nome: "Nutriunião PU - rações do vale", status: "OK" },
  { nome: "Bom dia filial", status: "OK" },
  { nome: "Bom dia Matriz", status: "OK" },
  { nome: "Compre bem", status: "OK" },
  { nome: "Speedy copy", status: "OK" },
  { nome: "Agro Vale", status: "OK" },
  { nome: "Toca do Javali", status: "OK" },
  { nome: "Javali Armas", status: "OK" },
  { nome: "FL caminhões (NF-e envio manual)", status: "OK" },
  { nome: "Ferro Velho", status: "OK" },
  { nome: "MR Máximo (WEB), muita contingência no web (de novo)", status: "OK" },
  { nome: "Sérgio Andrukiu UVA", status: "OK" },
  { nome: "Sérgio Andrukiu PU", status: "OK" },
  { nome: "Ciocco Sorvetes", status: "OK" },
  { nome: "MM cell UVA (IBC)", status: "OK" },
  { nome: "MM cell PU (smart)", status: "OK" },
  { nome: "MM cell CM (matias)", status: "OK" },
];

const mercadosPrioritarios = ["Bom dia filial", "Bom dia Matriz", "Compre bem"];

export function ExcelView() {
  return (
    <div className="excel-page">
      <header className="excel-page-header">
        <div>
          <span className="excel-eyebrow">Pedroso Automação</span>
          <h1>Controle mensal — visão planilha</h1>
          <p>
            Uma visão rápida inspirada na planilha atual, mantendo clientes, status, observações e prioridades
            sempre visíveis.
          </p>
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
            {clientes.map((cliente) => (
              <div className="excel-table-row" key={cliente.nome}>
                <div className="excel-client-name">{cliente.nome}</div>
                <div className="excel-status-cell">
                  <span className={`excel-status excel-status-${cliente.status.toLowerCase()}`}>
                    {cliente.status}
                  </span>
                </div>
                <div className={cliente.observacao ? "excel-note has-note" : "excel-note"}>
                  {cliente.observacao ?? "—"}
                </div>
              </div>
            ))}
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
              {mercadosPrioritarios.map((mercado) => (
                <div className="priority-row" key={mercado}>
                  <span>{mercado}</span>
                  <strong>OK</strong>
                </div>
              ))}
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

          <section className="excel-side-card info-card">
            <span className="excel-eyebrow">Como usar esta tela</span>
            <h2>Leitura rápida</h2>
            <p>
              A proposta desta visão é funcionar como a planilha: bater o olho e saber quem já está OK, quem tem
              observação e quais clientes precisam de atenção primeiro. Depois podemos tornar cada linha editável
              e conectar tudo ao banco.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
