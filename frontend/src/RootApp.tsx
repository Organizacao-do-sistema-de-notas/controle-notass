import { useMemo, useState } from "react";

import { App } from "./App";
import { ExcelView } from "./ExcelView";

type ModoTela = "painel" | "excel";

function mesAtual(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}`;
}

function formatarMes(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  const data = new Date(Number(ano), Number(mes) - 1, 1);
  const nomeMes = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(data);
  const nomeCapitalizado = nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1);
  return `${nomeCapitalizado}/${ano.slice(-2)}`;
}

function gerarMeses(competenciaAtual: string): string[] {
  const [anoTexto] = competenciaAtual.split("-");
  const anoCentral = Number(anoTexto) || new Date().getFullYear();
  const meses: string[] = [];

  for (let ano = anoCentral - 2; ano <= anoCentral + 2; ano += 1) {
    for (let mes = 1; mes <= 12; mes += 1) {
      meses.push(`${ano}-${String(mes).padStart(2, "0")}`);
    }
  }

  return meses;
}

export function RootApp() {
  const [modo, setModo] = useState<ModoTela>(() => {
    return localStorage.getItem("controle-notas-modo") === "excel" ? "excel" : "painel";
  });
  const [competenciaExcel, setCompetenciaExcel] = useState(() => {
    return localStorage.getItem("controle-notas-excel-mes") || mesAtual();
  });

  const mesesDisponiveis = useMemo(() => gerarMeses(competenciaExcel), [competenciaExcel]);

  function trocarModo(novoModo: ModoTela) {
    setModo(novoModo);
    localStorage.setItem("controle-notas-modo", novoModo);
  }

  function trocarCompetencia(valor: string) {
    setCompetenciaExcel(valor);
    localStorage.setItem("controle-notas-excel-mes", valor);
  }

  return (
    <>
      <nav className="mode-switcher" aria-label="Alternar visualização do sistema">
        <div className="mode-switcher-inner">
          <div className="mode-switcher-left">
            <div className="mode-switcher-copy">
              <strong>Visualização</strong>
              <span>Escolha como acompanhar o mês</span>
            </div>

            {modo === "excel" && (
              <label className="month-picker">
                <span>Mês</span>
                <div className="month-picker-control">
                  <select
                    value={competenciaExcel}
                    onChange={(event) => trocarCompetencia(event.target.value)}
                    aria-label="Selecionar mês da visão Excel"
                  >
                    {mesesDisponiveis.map((mes) => (
                      <option key={mes} value={mes}>
                        {formatarMes(mes)}
                      </option>
                    ))}
                  </select>
                  <span className="month-calendar-icon" aria-hidden="true" />
                </div>
              </label>
            )}
          </div>

          <div className="mode-switcher-actions">
            <button
              type="button"
              className={modo === "painel" ? "mode-button active" : "mode-button"}
              onClick={() => trocarModo("painel")}
            >
              Painel
            </button>
            <button
              type="button"
              className={modo === "excel" ? "mode-button active" : "mode-button"}
              onClick={() => trocarModo("excel")}
            >
              Excel
            </button>
          </div>
        </div>
      </nav>

      {modo === "painel" ? <App /> : <ExcelView competencia={competenciaExcel} />}
    </>
  );
}
