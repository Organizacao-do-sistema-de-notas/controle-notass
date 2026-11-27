import { useId } from "react";
import type { AvisoExtra } from "./excel-compartilhado";
import { moverNaOrdem, useArrastoCartoes } from "./useArrastoCartoes";
import "./avisos-ordenaveis.css";

const xaxim = "fixo:xaxim-gas";
export function AvisosOrdenaveis({ avisos, ordemSalva, disponivel, ocupado, selecionado, aoSelecionar, aoOrdenar }: {
  avisos: AvisoExtra[]; ordemSalva?: string[]; disponivel: boolean; ocupado: boolean;
  selecionado: string | null; aoSelecionar: (id: string) => void;
  aoOrdenar: (ordem: string[], anterior: string[]) => Promise<void>;
}) {
  const ajuda = useId();
  const existentes = [xaxim, ...avisos.map(aviso => `aviso:${aviso.id}`)];
  const ordem = [...(ordemSalva ?? []).filter(id => existentes.includes(id)), ...existentes.filter(id => !ordemSalva?.includes(id))];
  const arrasto = useArrastoCartoes({ ids: ordem, bloqueado: !disponivel || ocupado, aoSelecionar,
    aoMover: (origem, destino, depois, anterior) => aoOrdenar(moverNaOrdem(anterior, origem, destino, depois), anterior) });
  return <div className="avisos-ordenaveis" ref={arrasto.grupo} role="group" aria-label="Avisos em ordem personalizada" aria-busy={ocupado}>
    <p id={ajuda} className="visualmente-oculto">Clique para selecionar. Segure e arraste o cartão para mover. No teclado, use as setas; no toque, use o puxador.</p>
    {ordem.map(id => {
      const aviso = avisos.find(item => `aviso:${item.id}` === id);
      const titulo = id === xaxim ? "Xaxim Gás" : aviso!.titulo;
      return <section key={id} data-aviso-id={id} tabIndex={0} {...arrasto.vincular(id)}
        className={`excel-side-card aviso-ordenavel cartao-arrastavel ${id === xaxim ? "xaxim-card" : "custom-notice-card"}${selecionado === id ? " aviso-selecionado" : ""}`}
        aria-label={`Aviso ${titulo}`} aria-describedby={ajuda} onClick={() => aoSelecionar(id)}
        onKeyDown={evento => { if (evento.target === evento.currentTarget) { if (['Enter', ' '].includes(evento.key)) { evento.preventDefault(); aoSelecionar(id); } else arrasto.teclado(evento, id); } }}>
        <button type="button" className="aviso-arrastar" data-drag-handle disabled={!disponivel || ocupado}
          aria-label={`Ordenar aviso ${titulo}`} title="Arraste o cartão para mover; ou use as setas do teclado"
          onKeyDown={evento => arrasto.teclado(evento, id)}><span aria-hidden="true">⋮⋮</span></button>
        {id === xaxim ? <>
          <span className="xaxim-alert">Extremamente importante</span><h2>Xaxim Gás</h2>
          <p>Empresa do web. Todo dia 01, enviar os arquivos manualmente para o e-mail abaixo. Este aviso fica sempre visível para não ser esquecido.</p>
          <strong className="xaxim-email">rubinhogmasters@gmail.com</strong>
        </> : <><span className="excel-eyebrow">Aviso fixo</span><h2>{aviso!.titulo}</h2><p>{aviso!.texto}</p></>}
      </section>;
    })}
    {arrasto.mensagem && <p className="avisos-estado" role="status">{arrasto.mensagem}</p>}
    {arrasto.erro && <p className="avisos-erro" role="alert">{arrasto.erro}</p>}
  </div>;
}
