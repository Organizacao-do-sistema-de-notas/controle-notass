import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import "./arrasto-cartoes.css";

type Destino = { id: string; depois: boolean };
type Mover = (origem: string, destino: string, depois: boolean, anterior: string[]) => Promise<void>;
type Inicio = { id: string; pointer: number; x: number; y: number; atualX: number; atualY: number;
  scrollX: number; scrollY: number; ativo: boolean; ordem: string[]; elemento: HTMLElement; mover: Mover };
type Visual = { id: string; x: number; y: number; destino: Destino | null };
export function moverNaOrdem<T>(ordem: T[], origem: T, destino: T, depois: boolean): T[] {
  if (origem === destino) return ordem;
  const nova = ordem.filter(id => id !== origem);
  nova.splice(nova.indexOf(destino) + Number(depois), 0, origem);
  return nova;
}

export function useArrastoCartoes({ ids, bloqueado, aoMover, aoSelecionar }: {
  ids: string[]; bloqueado: boolean; aoMover: Mover; aoSelecionar?: (id: string) => void;
}) {
  const grupo = useRef<HTMLDivElement>(null);
  const inicio = useRef<Inicio | null>(null);
  const frame = useRef(0);
  const emGravacao = useRef(false);
  const [visual, setVisual] = useState<Visual | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  function alvo(x: number, y: number, origem: string): Destino | null {
    const elemento = document.elementsFromPoint(x, y).map(item => item.closest<HTMLElement>('[data-arrastavel-id]'))
      .find(item => item && grupo.current?.contains(item) && item.dataset.arrastavelId !== origem);
    if (!elemento?.dataset.arrastavelId) return null;
    const area = elemento.getBoundingClientRect();
    return { id: elemento.dataset.arrastavelId, depois: y > area.top + area.height / 2 };
  }
  function limpar() {
    const atual = inicio.current;
    inicio.current = null; cancelAnimationFrame(frame.current); setVisual(null);
    if (atual?.elemento.hasPointerCapture(atual.pointer)) atual.elemento.releasePointerCapture(atual.pointer);
  }
  useEffect(() => {
    const escapar = (evento: globalThis.KeyboardEvent) => { if (evento.key === 'Escape' && inicio.current) { evento.preventDefault(); limpar(); } };
    window.addEventListener('keydown', escapar);
    return () => { window.removeEventListener('keydown', escapar); cancelAnimationFrame(frame.current); };
  }, []);
  async function salvar(origem: string, destino: Destino, anterior: string[], mover: Mover, focar = false) {
    if (bloqueado || emGravacao.current || moverNaOrdem(anterior, origem, destino.id, destino.depois).every((id, i) => id === anterior[i])) return;
    emGravacao.current = true; setErro(""); setMensagem("Salvando ordem...");
    try {
      await mover(origem, destino.id, destino.depois, anterior); setMensagem("Ordem salva.");
      if (focar) requestAnimationFrame(() => {
        const card = Array.from(grupo.current?.querySelectorAll<HTMLElement>('[data-arrastavel-id]') ?? []).find(item => item.dataset.arrastavelId === origem);
        (card?.querySelector<HTMLElement>('[data-drag-handle]') ?? card)?.focus();
      });
    } catch (e) { setMensagem(""); setErro(e instanceof Error ? e.message : "Não foi possível salvar a ordem. Tente novamente."); }
    finally { emGravacao.current = false; }
  }
  function atualizar() {
    const atual = inicio.current;
    if (!atual?.ativo) return;
    const distancia = 42;
    const passo = atual.atualY < distancia ? -12 : atual.atualY > window.innerHeight - distancia ? 12 : 0;
    if (passo) window.scrollBy(0, passo);
    const novo: Visual = { id: atual.id, x: atual.atualX - atual.x + window.scrollX - atual.scrollX,
      y: atual.atualY - atual.y + window.scrollY - atual.scrollY, destino: alvo(atual.atualX, atual.atualY, atual.id) };
    setVisual(anterior => anterior?.id === novo.id && anterior.x === novo.x && anterior.y === novo.y
      && anterior.destino?.id === novo.destino?.id && anterior.destino?.depois === novo.destino?.depois ? anterior : novo);
    frame.current = requestAnimationFrame(atualizar);
  }
  function vincular(id: string) {
    const selecionado = visual?.id === id;
    const destino = visual?.destino?.id === id ? visual.destino : null;
    return {
      'data-arrastavel-id': id,
      'data-em-arrasto': selecionado ? 'true' : undefined,
      'data-destino-arrasto': destino ? destino.depois ? 'depois' : 'antes' : undefined,
      style: selecionado ? { transform: `translate3d(${visual.x}px, ${visual.y}px, 0)`, zIndex: 50, pointerEvents: 'none' } as CSSProperties : undefined,
      onPointerDown: (evento: PointerEvent<HTMLElement>) => {
        if (bloqueado || emGravacao.current || !evento.isPrimary || evento.button !== 0) return;
        const target = evento.target as HTMLElement;
        const puxador = target.closest('[data-drag-handle]');
        if ((!puxador && target.closest('button, input, select, textarea, a')) || (evento.pointerType === 'touch' && !puxador)) return;
        evento.preventDefault(); aoSelecionar?.(id); evento.currentTarget.focus({ preventScroll: true });
        evento.currentTarget.setPointerCapture(evento.pointerId);
        inicio.current = { id, pointer: evento.pointerId, x: evento.clientX, y: evento.clientY, atualX: evento.clientX, atualY: evento.clientY,
          scrollX: window.scrollX, scrollY: window.scrollY, ativo: false, ordem: [...ids], elemento: evento.currentTarget, mover: aoMover };
      },
      onPointerMove: (evento: PointerEvent<HTMLElement>) => {
        const atual = inicio.current;
        if (!atual || atual.pointer !== evento.pointerId) return;
        atual.atualX = evento.clientX; atual.atualY = evento.clientY;
        if (!atual.ativo && Math.hypot(evento.clientX - atual.x, evento.clientY - atual.y) >= 6) { atual.ativo = true; atualizar(); }
      },
      onPointerUp: (evento: PointerEvent<HTMLElement>) => {
        const atual = inicio.current;
        if (!atual || atual.pointer !== evento.pointerId) return;
        const destino = alvo(evento.clientX, evento.clientY, atual.id);
        limpar();
        if (atual.ativo && destino) void salvar(atual.id, destino, atual.ordem, atual.mover);
      },
      onPointerCancel: limpar,
      onLostPointerCapture: () => { if (inicio.current) limpar(); },
    };
  }
  function teclado(evento: KeyboardEvent, id: string) {
    if (!['ArrowUp', 'ArrowDown'].includes(evento.key)) return;
    evento.preventDefault(); evento.stopPropagation();
    const indice = ids.indexOf(id) + (evento.key === 'ArrowUp' ? -1 : 1);
    if (ids[indice]) void salvar(id, { id: ids[indice], depois: evento.key === 'ArrowDown' }, ids, aoMover, true);
  }
  return { grupo, vincular, teclado, erro, mensagem, arrastando: visual !== null };
}
