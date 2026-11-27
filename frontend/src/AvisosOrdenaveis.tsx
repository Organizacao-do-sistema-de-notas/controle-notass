import { useId, useRef, useState, type PointerEvent } from "react";
import type { AvisoExtra } from "./excel-compartilhado";
import "./avisos-ordenaveis.css";

type Destino = { id: string; depois: boolean };
type Arrasto = { id: string; ponteiro: number; x: number; y: number; ativo: boolean; ordem: string[] };
const xaxim = "fixo:xaxim-gas";
function mover(ordem: string[], origem: string, destino: Destino): string[] {
  if (origem === destino.id) return ordem;
  const resultado = ordem.filter(id => id !== origem);
  resultado.splice(resultado.indexOf(destino.id) + Number(destino.depois), 0, origem);
  return resultado;
}

export function AvisosOrdenaveis({ avisos, ordemSalva, disponivel, ocupado, aoOrdenar }: {
  avisos: AvisoExtra[]; ordemSalva?: string[]; disponivel: boolean; ocupado: boolean;
  aoOrdenar: (ordem: string[], anterior: string[]) => Promise<void>;
}) {
  const ajuda = useId();
  const lista = useRef<HTMLDivElement>(null);
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({});
  const arrasto = useRef<Arrasto | null>(null);
  const emGravacao = useRef(false);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [destino, setDestino] = useState<Destino | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const existentes = [xaxim, ...avisos.map(aviso => `aviso:${aviso.id}`)];
  const ordem = [...(ordemSalva ?? []).filter(id => existentes.includes(id)), ...existentes.filter(id => !ordemSalva?.includes(id))];
  const bloqueado = !disponivel || ocupado;

  async function salvar(nova: string[], anterior: string[], focar?: string) {
    if (emGravacao.current || bloqueado || nova.every((id, indice) => id === anterior[indice])) return;
    emGravacao.current = true; setErro(""); setMensagem("Salvando ordem dos avisos...");
    try {
      await aoOrdenar(nova, anterior);
      setMensagem("Ordem dos avisos salva.");
      if (focar) requestAnimationFrame(() => botoes.current[focar]?.focus());
    } catch (e) {
      setMensagem(""); setErro(e instanceof Error ? e.message : "Não foi possível salvar a ordem. Tente mover o aviso novamente.");
    } finally { emGravacao.current = false; }
  }
  function alvo(evento: PointerEvent): Destino | null {
    const card = document.elementFromPoint(evento.clientX, evento.clientY)?.closest<HTMLElement>("[data-aviso-id]");
    if (!card || !lista.current?.contains(card) || !card.dataset.avisoId) return null;
    const area = card.getBoundingClientRect();
    return { id: card.dataset.avisoId, depois: evento.clientY > area.top + area.height / 2 };
  }
  function iniciar(evento: PointerEvent<HTMLButtonElement>, id: string) {
    if (bloqueado || emGravacao.current || !evento.isPrimary || evento.button !== 0) return;
    evento.preventDefault(); evento.currentTarget.focus(); evento.currentTarget.setPointerCapture(evento.pointerId);
    arrasto.current = { id, ponteiro: evento.pointerId, x: evento.clientX, y: evento.clientY, ativo: false, ordem: [...ordem] };
  }
  function arrastar(evento: PointerEvent<HTMLButtonElement>) {
    const atual = arrasto.current;
    if (!atual || atual.ponteiro !== evento.pointerId) return;
    if (!atual.ativo && Math.hypot(evento.clientX - atual.x, evento.clientY - atual.y) < 6) return;
    atual.ativo = true; setArrastando(atual.id); setDestino(alvo(evento)); evento.preventDefault();
  }
  function terminar(evento: PointerEvent<HTMLButtonElement>, cancelar = false) {
    const atual = arrasto.current;
    if (!atual || atual.ponteiro !== evento.pointerId) return;
    const final = cancelar ? null : alvo(evento);
    arrasto.current = null; setArrastando(null); setDestino(null);
    if (evento.currentTarget.hasPointerCapture(evento.pointerId)) evento.currentTarget.releasePointerCapture(evento.pointerId);
    if (atual.ativo && final) void salvar(mover(atual.ordem, atual.id, final), atual.ordem);
  }

  return (
    <div className="avisos-ordenaveis" ref={lista} role="group" aria-label="Avisos em ordem personalizada" aria-busy={ocupado}>
      <p id={ajuda} className="avisos-ajuda">Segure e arraste pelo ícone ⋮⋮. No teclado, use as setas para cima e para baixo.</p>
      {ordem.map(id => {
        const aviso = avisos.find(item => `aviso:${item.id}` === id);
        const titulo = id === xaxim ? "Xaxim Gás" : aviso!.titulo;
        const marcador = destino?.id === id && arrastando !== id ? destino.depois ? " destino-depois" : " destino-antes" : "";
        return <section key={id} data-aviso-id={id}
          className={`excel-side-card aviso-ordenavel ${id === xaxim ? "xaxim-card" : "custom-notice-card"}${arrastando === id ? " arrastando" : ""}${marcador}`}>
          <button type="button" className="aviso-arrastar" ref={elemento => { botoes.current[id] = elemento; }}
            disabled={bloqueado} aria-label={`Ordenar aviso ${titulo}`} aria-describedby={ajuda}
            title="Segure e arraste para ordenar; ou use as setas do teclado"
            onPointerDown={evento => iniciar(evento, id)} onPointerMove={arrastar} onPointerUp={evento => terminar(evento)}
            onPointerCancel={evento => terminar(evento, true)} onLostPointerCapture={evento => terminar(evento, true)}
            onKeyDown={evento => {
              if (evento.key === "Escape") { arrasto.current = null; setArrastando(null); setDestino(null); return; }
              if (!["ArrowUp", "ArrowDown"].includes(evento.key)) return;
              evento.preventDefault();
              const indice = ordem.indexOf(id) + (evento.key === "ArrowUp" ? -1 : 1);
              if (ordem[indice]) void salvar(mover(ordem, id, { id: ordem[indice], depois: evento.key === "ArrowDown" }), ordem, id);
            }}><span aria-hidden="true">⋮⋮</span></button>
          {id === xaxim ? <>
            <span className="xaxim-alert">Extremamente importante</span>
            <h2>Xaxim Gás</h2>
            <p>Empresa do web. Todo dia 01, enviar os arquivos manualmente para o e-mail abaixo. Este aviso fica sempre visível para não ser esquecido.</p>
            <strong className="xaxim-email">rubinhogmasters@gmail.com</strong>
          </> : <><span className="excel-eyebrow">Aviso fixo</span><h2>{aviso!.titulo}</h2><p>{aviso!.texto}</p></>}
        </section>;
      })}
      {mensagem && <p className="avisos-estado" role="status">{mensagem}</p>}
      {erro && <p className="avisos-erro" role="alert">{erro}</p>}
    </div>
  );
}
