import { useRef, useState } from "react";

import { App } from "./App";
import { ExcelViewV2 } from "./ExcelViewV2";
import { Cadastros, type AbaCadastro } from "./Cadastros";
import { MenuCadastros } from "./MenuCadastros";
import { SeletorMes } from "./SeletorMes";
import { competenciaRapida } from "./meses";
import { ConsultaMeses } from "./ConsultaMeses";

type ModoTela = "painel" | "excel";

export function RootApp() {
  const [cadastroAberto, setCadastroAberto] = useState<AbaCadastro | null>(null);
  const [consultaAberta, setConsultaAberta] = useState(false);
  const [revisaoCadastros, setRevisaoCadastros] = useState(0);
  const botaoCadastros = useRef<HTMLButtonElement>(null);
  const [pendenciasExcel, setPendenciasExcel] = useState({ gravando: false, rascunhos: false });
  const [pendenciasPainel, setPendenciasPainel] = useState({ gravando: false, rascunhos: false });
  const [modo, setModo] = useState<ModoTela>(() => {
    return localStorage.getItem("controle-notas-modo") === "excel" ? "excel" : "painel";
  });
  const [competenciaExcel, setCompetenciaExcel] = useState(() => {
    return competenciaRapida(localStorage.getItem("controle-notas-excel-mes"));
  });

  function trocarModo(novoModo: ModoTela) {
    if (novoModo !== modo) {
      const pendencias = modo === "excel" ? pendenciasExcel : pendenciasPainel;
      const nome = modo === "excel" ? "Excel" : "Painel";
      if (pendencias.gravando) return;
      if (pendencias.rascunhos && !window.confirm(`Há alterações ainda não salvas no ${nome}. Deseja sair e descartar os rascunhos?`)) return;
    }
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
              <SeletorMes valor={competenciaExcel} aoAlterar={trocarCompetencia} rotulo="Mês"
                contexto="Excel" nomeAcessivel="Selecionar mês da visão Excel" />
            )}
          </div>

          <div className="mode-switcher-actions">
            <div className="mode-switcher-segmented">
              <button
                type="button"
                className={modo === "painel" ? "mode-button active" : "mode-button"}
                disabled={modo === "excel" && pendenciasExcel.gravando}
                onClick={() => trocarModo("painel")}
              >
                Painel
              </button>
              <button
                type="button"
                className={modo === "excel" ? "mode-button active" : "mode-button"}
                disabled={modo === "painel" && pendenciasPainel.gravando}
                onClick={() => trocarModo("excel")}
              >
                Excel
              </button>
            </div>
            <MenuCadastros aoAbrir={setCadastroAberto} aoConsultarMeses={() => setConsultaAberta(true)} refBotao={botaoCadastros} />
          </div>
        </div>
      </nav>

      {modo === "painel" ? <App revisaoCadastros={revisaoCadastros} aoPendenciasAlteradas={setPendenciasPainel} /> : <ExcelViewV2 competencia={competenciaExcel} aoPendenciasAlteradas={setPendenciasExcel} />}
      {consultaAberta && <ConsultaMeses aoFechar={() => {
        setConsultaAberta(false);
        requestAnimationFrame(() => botaoCadastros.current?.focus());
      }} />}
      {cadastroAberto && <Cadastros abaInicial={cadastroAberto}
        aoFechar={() => {
          setCadastroAberto(null);
          requestAnimationFrame(() => botaoCadastros.current?.focus());
        }}
        aoAtualizar={() => setRevisaoCadastros(valor => valor + 1)} />}
    </>
  );
}
