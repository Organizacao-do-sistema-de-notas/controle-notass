import { useState } from "react";

import { App } from "./App";
import { ExcelView } from "./ExcelView";

type ModoTela = "painel" | "excel";

function mesAtual(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}`;
}

export function RootApp() {
  const [modo, setModo] = useState<ModoTela>(() => {
    return localStorage.getItem("controle-notas-modo") === "excel" ? "excel" : "painel";
  });
  const [competenciaExcel, setCompetenciaExcel] = useState(() => {
    return localStorage.getItem("controle-notas-excel-mes") || mesAtual();
  });

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
          <div className="mode-switcher-copy">
            <strong>Visualização</strong>
            <span>Escolha como acompanhar o mês</span>
          </div>

          {modo === "excel" && (
            <label className="month-picker">
              <span>Mês</span>
              <input
                type="month"
                value={competenciaExcel}
                onChange={(event) => trocarCompetencia(event.target.value)}
              />
            </label>
          )}

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
