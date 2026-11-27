import { useId, useState } from "react";
import { mesesRapidos, rotuloMes } from "./meses";
import "./seletor-mes.css";

export function SeletorMes({ valor, aoAlterar, rotulo, contexto, nomeAcessivel }: {
  valor: string; aoAlterar: (mes: string) => void; rotulo: string;
  contexto: "Excel" | "Painel"; nomeAcessivel: string;
}) {
  const id = useId();
  const [meses] = useState(mesesRapidos);
  const indice = meses.indexOf(valor);
  return (
    <div className="seletor-mes">
      <label htmlFor={id}>{rotulo}</label>
      <div className="seletor-mes-controles">
        <button type="button" className="seletor-mes-passo" aria-label={`Mês anterior no ${contexto}`}
          title="Voltar um mês" disabled={indice <= 0} onClick={() => aoAlterar(meses[indice - 1])}>−1</button>
        <select id={id} value={valor} aria-label={nomeAcessivel} onChange={evento => aoAlterar(evento.target.value)}>
          {meses.map(mes => <option key={mes} value={mes}>{rotuloMes(mes)}</option>)}
        </select>
        <button type="button" className="seletor-mes-passo" aria-label={`Mês seguinte no ${contexto}`}
          title="Avançar um mês" disabled={indice < 0 || indice >= meses.length - 1} onClick={() => aoAlterar(meses[indice + 1])}>+1</button>
      </div>
    </div>
  );
}
