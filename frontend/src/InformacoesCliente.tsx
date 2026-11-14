import { useLayoutEffect, useRef, useState } from "react";
import { LIMITE_INFORMACOES_CLIENTE } from "./informacoes-cliente-storage";
import "./informacoes-cliente.css";

export function InformacoesCliente({ nome, texto, aoFechar, aoSalvar, disponivel }: {
  nome: string; texto: string; aoFechar: () => void;
  aoSalvar: (texto: string, anterior: string) => Promise<void>; disponivel: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const caixa = useRef<HTMLTextAreaElement>(null);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(texto);
  const [original, setOriginal] = useState(texto);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const alterado = editando && rascunho !== original;
  function fechar() {
    if (salvando) return;
    if (alterado && !window.confirm("Descartar as informações adicionais que ainda não foram salvas?")) return;
    aoFechar();
  }
  async function salvar() {
    if (!editando || salvando || !disponivel) return;
    setSalvando(true); setErro(""); setAviso("");
    try {
      await aoSalvar(rascunho.trim(), original);
      setEditando(false); setAviso("Informações salvas.");
    } catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar as informações."); }
    finally { setSalvando(false); }
  }
  useLayoutEffect(() => {
    const elemento = ref.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    elemento?.showModal();
    return () => { elemento?.close(); document.body.style.overflow = overflow; };
  }, []);

  return (
    <dialog ref={ref} className="cliente-info-dialog" aria-labelledby="cliente-info-titulo"
      aria-busy={salvando} onCancel={evento => { evento.preventDefault(); fechar(); }}
      onKeyDown={evento => {
        if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); fechar(); }
        if (evento.key === "Tab") {
          const elementos = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea:not(:disabled)"));
          const primeiro = elementos[0];
          const ultimo = elementos[elementos.length - 1];
          if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo?.focus(); }
          else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro?.focus(); }
        }
      }}
      onClick={evento => {
        if (evento.target !== evento.currentTarget) return;
        const area = evento.currentTarget.getBoundingClientRect();
        if (evento.clientX < area.left || evento.clientX > area.right || evento.clientY < area.top || evento.clientY > area.bottom) fechar();
      }}>
      <header className="cliente-info-cabecalho">
        <div><span>Informações adicionais</span><h2 id="cliente-info-titulo">{nome}</h2></div>
        <button type="button" className="cliente-info-x" aria-label="Fechar informações adicionais" title="Fechar" disabled={salvando} onClick={fechar}>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 16 16"><path d="m3 3 10 10M13 3 3 13" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
        </button>
      </header>
      <div className="cliente-info-conteudo">
        <label className="cliente-info-campo">Informações deste cliente
          <textarea ref={caixa} className="cliente-info-texto" aria-label="Informações adicionais" rows={7}
            maxLength={LIMITE_INFORMACOES_CLIENTE} readOnly={!editando} disabled={salvando}
            value={editando ? rascunho : texto} onChange={evento => { setRascunho(evento.target.value); setAviso(""); }}
            placeholder="Nenhuma informação adicional cadastrada. Clique em Alterar para preencher." />
        </label>
        <div className="cliente-info-edicao">
          <button type="button" className="excel-action-button" disabled={salvando || !disponivel} onClick={() => {
            if (editando) { setEditando(false); setErro(""); setAviso(""); }
            else { setRascunho(texto); setOriginal(texto); setEditando(true); setErro(""); setAviso(""); requestAnimationFrame(() => caixa.current?.focus()); }
          }}>{editando ? "Cancelar alteração" : "Alterar"}</button>
          <span>{editando ? "Revise o texto e clique em Salvar." : "Clique em Alterar para editar."}</span>
        </div>
        {editando && texto !== original && <div className="cliente-info-conflito">
          <p>O texto salvo foi alterado em outro computador. Confira antes de continuar.</p>
          <details><summary>Ver texto atual do banco</summary><p>{texto || "(vazio)"}</p></details>
          <button type="button" className="excel-action-button" disabled={salvando} onClick={() => { setRascunho(texto); setOriginal(texto); setErro(""); }}>Usar texto do banco</button>
          <button type="button" className="excel-action-button" disabled={salvando} onClick={() => { setOriginal(texto); setErro(""); }}>Manter meu texto após revisar</button>
        </div>}
        {erro && <p className="cliente-info-erro" role="alert">{erro}</p>}
        {aviso && <p className="cliente-info-sucesso" role="status">{aviso}</p>}
      </div>
      <footer className="cliente-info-rodape">
        <p>Informações permanentes, separadas das observações do mês.<br />Salvas no banco compartilhado entre os computadores.</p>
        <button type="button" className="cliente-info-salvar" disabled={!editando || !disponivel || salvando}
          onClick={() => void salvar()}><span>{salvando ? "Salvando..." : "Salvar"}</span></button>
      </footer>
    </dialog>
  );
}
