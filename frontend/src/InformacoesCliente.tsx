import { useLayoutEffect, useRef } from "react";
import "./informacoes-cliente.css";

export function InformacoesCliente({ nome, texto, aoFechar }: {
  nome: string; texto: string; aoFechar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const elemento = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    elemento?.showModal();
    return () => { elemento?.close(); document.body.style.overflow = overflow; };
  }, []);

  return (
    <dialog ref={ref} className="cliente-info-dialog" aria-labelledby="cliente-info-titulo"
      onCancel={evento => { evento.preventDefault(); aoFechar(); }}
      onKeyDown={evento => {
        if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); aoFechar(); }
        if (evento.key === "Tab") {
          const elementos = Array.from(evento.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
          const primeiro = elementos[0];
          const ultimo = elementos[elementos.length - 1];
          if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo?.focus(); }
          else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro?.focus(); }
        }
      }}
      onClick={evento => {
        if (evento.target !== evento.currentTarget) return;
        const area = evento.currentTarget.getBoundingClientRect();
        if (evento.clientX < area.left || evento.clientX > area.right || evento.clientY < area.top || evento.clientY > area.bottom) aoFechar();
      }}>
      <header className="cliente-info-cabecalho">
        <div><span>Informações adicionais</span><h2 id="cliente-info-titulo">{nome}</h2></div>
        <button type="button" aria-label="Fechar informações adicionais" onClick={aoFechar}>×</button>
      </header>
      {texto.trim() ? <p className="cliente-info-texto">{texto}</p> : (
        <div className="cliente-info-vazio"><p>Nenhuma informação adicional cadastrada para este cliente.</p>
          <p>Use <strong>Alterar Cliente</strong> para cadastrar as particularidades dele.</p></div>
      )}
      <footer className="cliente-info-rodape">
        <p>Informações permanentes, separadas das observações do mês.<br />Salvas neste navegador, junto aos cadastros da visão Excel.</p>
        <button type="button" className="excel-action-button" onClick={aoFechar}>Fechar</button>
      </footer>
    </dialog>
  );
}
