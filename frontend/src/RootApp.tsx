import { useState } from "react";

import { App } from "./App";
import { ExcelView } from "./ExcelView";

type ModoTela = "painel" | "excel";

export function RootApp() {
  const [modo, setModo] = useState<ModoTela>(() => {
    return localStorage.getItem("controle-notas-modo") === "excel" ? "excel" : "painel";
  });

  function trocarModo(novoModo: ModoTela) {
    setModo(novoModo);
    localStorage.setItem("controle-notas-modo", novoModo);
  }

  return (
    <>
      <nav className="mode-switcher" aria-label="Alternar visualização do sistema">
        <div className="mode-switcher-inner">
          <div>
            <strong>Visualização</strong>
            <span>Escolha como acompanhar o mês</span>
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

      {modo === "painel" ? <App /> : <ExcelView />}
    </>
  );
}
