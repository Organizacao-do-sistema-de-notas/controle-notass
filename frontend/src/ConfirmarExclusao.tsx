import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./confirmar-exclusao.css";
import { bloquearRolagem } from "./bloquear-rolagem";

export function ConfirmarExclusao({ descricao, aoCancelar, aoConfirmar }: {
  descricao: ReactNode; aoCancelar: () => void; aoConfirmar: () => Promise<void>;
}) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const gravando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  useLayoutEffect(() => {
    const anterior = document.activeElement;
    const liberar = bloquearRolagem();
    const elemento = dialog.current;
    elemento?.showModal(); cancelar.current?.focus();
    return () => {
      elemento?.close(); liberar();
      if (anterior instanceof HTMLElement && anterior.isConnected) {
        const pai = anterior.closest('dialog');
        if (!pai || pai.open) anterior.focus();
      }
    };
  }, []);
  useEffect(() => {
    if (!ocupado) return;
    const proteger = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [ocupado]);
  async function confirmar() {
    if (gravando.current) return;
    gravando.current = true; setOcupado(true); setErro("");
    try { await aoConfirmar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível excluir. Tente novamente."); }
    finally { gravando.current = false; setOcupado(false); }
  }
  return <dialog ref={dialog} role="alertdialog" className="confirmar-exclusao" aria-labelledby={id} aria-describedby={`${id}-texto`} aria-busy={ocupado}
    onCancel={evento => { evento.preventDefault(); evento.stopPropagation(); if (!gravando.current) aoCancelar(); }}
    onKeyDown={evento => { if (evento.key === "Escape") evento.stopPropagation(); }}>
    <h2 id={id}>Confirmar exclusão</h2>
    <div id={`${id}-texto`} className="confirmar-exclusao-texto">{descricao}</div>
    {erro && <p role="alert" className="alert error">{erro}</p>}
    <footer>
      <button type="button" ref={cancelar} className="button secondary" disabled={ocupado} onClick={aoCancelar}>Cancelar</button>
      <button type="button" className="button confirmar-exclusao-vermelho" disabled={ocupado} onClick={() => void confirmar()}>{ocupado ? "Excluindo..." : "Excluir"}</button>
    </footer>
  </dialog>;
}
