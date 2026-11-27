import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { excluirCliente, listarClientes } from "./api";
import type { Cliente } from "./types";
import type { RespostaExcel } from "./excel-compartilhado";
import "./excluir-cliente.css";
import { ConfirmarExclusao } from "./ConfirmarExclusao";
import { bloquearRolagem } from "./bloquear-rolagem";

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function ExcluirCliente({ aoFechar, aoExcluir }: {
  aoFechar: () => void;
  aoExcluir: (resposta: RespostaExcel, id: number) => void | Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const emExclusao = useRef(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [pesquisa, setPesquisa] = useState("");
  const [id, setId] = useState("");
  const [confirmacao, setConfirmacao] = useState<Cliente | null>(null);
  const selecionado = clientes.find(cliente => String(cliente.id) === id);
  const filtrados = useMemo(() => {
    const termos = normalizar(pesquisa).split(/\s+/).filter(Boolean);
    return [...clientes].sort((a, b) => a.id - b.id).filter(cliente => {
      const indice = normalizar([String(cliente.id), cliente.nome, ...(cliente.nomesAlternativos ?? []).map(item => item.nome)].join(" "));
      return termos.every(termo => indice.includes(termo));
    });
  }, [clientes, pesquisa]);

  useLayoutEffect(() => {
    const anterior = document.activeElement;
    const elemento = dialog.current;
    const liberar = bloquearRolagem();
    elemento?.showModal();
    return () => {
      elemento?.close(); liberar();
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro(""); setId("");
    listarClientes().then(lista => { if (ativo) setClientes(lista); })
      .catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar os clientes."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tentativa]);
  useEffect(() => {
    if (!salvando) return;
    const proteger = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", proteger);
    dialog.current?.focus();
    return () => window.removeEventListener("beforeunload", proteger);
  }, [salvando]);

  function fechar() { if (!emExclusao.current) aoFechar(); }
  async function confirmar() {
    if (!confirmacao || carregando || emExclusao.current) return;
    emExclusao.current = true; setSalvando(true); setErro("");
    try {
      const resposta = await excluirCliente(confirmacao.id, confirmacao.nome);
      await aoExcluir(resposta, confirmacao.id);
      aoFechar();
    } catch (e) { throw e; }
    finally { emExclusao.current = false; setSalvando(false); }
  }

  return (
    <><dialog ref={dialog} className="exclusao-cliente-dialog" aria-labelledby="exclusao-cliente-titulo" aria-busy={salvando} tabIndex={-1}
      onCancel={evento => { evento.preventDefault(); fechar(); }}
      onKeyDown={evento => {
        if (evento.key === "Escape") { evento.preventDefault(); evento.stopPropagation(); fechar(); }
        if (evento.key !== "Tab") return;
        const elementos = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled)"));
        const primeiro = elementos[0], ultimo = elementos[elementos.length - 1];
        if (!primeiro) { evento.preventDefault(); evento.currentTarget.focus(); }
        else if (evento.shiftKey && (document.activeElement === primeiro || document.activeElement === evento.currentTarget)) { evento.preventDefault(); ultimo.focus(); }
        else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
      }}
      onClick={evento => {
        if (evento.target !== evento.currentTarget) return;
        const area = evento.currentTarget.getBoundingClientRect();
        if (evento.clientX < area.left || evento.clientX > area.right || evento.clientY < area.top || evento.clientY > area.bottom) fechar();
      }}>
      <header className="exclusao-cliente-cabecalho">
        <h2 id="exclusao-cliente-titulo">Excluir cliente</h2>
        <button type="button" className="close-button" disabled={salvando} aria-label="Fechar exclusão de cliente" onClick={fechar}>×</button>
      </header>
      <p>A exclusão vale para o Excel, o Painel e as fichas. Os registros mensais, informações e históricos ficam preservados no banco.</p>
      <fieldset disabled={carregando || salvando}>
        <label>Pesquisar cliente
          <input autoFocus value={pesquisa} placeholder="Nome, apelido ou número do cadastro..." onChange={evento => { setPesquisa(evento.target.value); setId(""); }} />
        </label>
        <div className="exclusao-cliente-tabela">
          <table aria-label="Clientes disponíveis para exclusão">
            <thead><tr><th scope="col">Nº</th><th scope="col">Cliente</th><th scope="col">Situação</th></tr></thead>
            <tbody>{filtrados.map(cliente => <tr key={cliente.id} className={id === String(cliente.id) ? "selecionado" : ""}>
              <td>#{cliente.id}</td>
              <td><button type="button" className="cliente-seletor-opcao" aria-label={`Selecionar cliente #${cliente.id} — ${cliente.nome}`}
                aria-pressed={id === String(cliente.id)} onClick={() => setId(String(cliente.id))}>{cliente.nome}</button></td>
              <td>{cliente.ativo ? "Ativo" : "Inativo"}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </fieldset>
      {carregando ? <p role="status">Carregando clientes...</p> : clientes.length === 0 ? <p>Nenhum cliente disponível para excluir.</p> : filtrados.length === 0 ? <p>Nenhum cliente encontrado para essa pesquisa.</p> : null}
      {selecionado && <p className="exclusao-cliente-selecao">Selecionado: <strong>#{selecionado.id} — {selecionado.nome}</strong></p>}
      {erro && <p className="alert error" role="alert">{erro}</p>}
      <footer className="exclusao-cliente-acoes">
        <button type="button" className="button secondary" disabled={carregando || salvando} onClick={() => setTentativa(valor => valor + 1)}>Atualizar lista</button>
        <button type="button" className="button secondary" disabled={salvando} onClick={fechar}>Cancelar</button>
        <button type="button" className="button exclusao-cliente-confirmar" disabled={!selecionado || carregando || salvando} onClick={() => setConfirmacao(selecionado ?? null)}>{salvando ? "Excluindo..." : "Excluir cliente"}</button>
      </footer>
    </dialog>
    {confirmacao && <ConfirmarExclusao aoCancelar={() => setConfirmacao(null)} aoConfirmar={confirmar}
      descricao={<><p>Excluir o cliente <strong>#{confirmacao.id} — {confirmacao.nome}</strong>?</p><p>Ele será retirado do Excel, do Painel e das fichas. Os registros e históricos permanecerão guardados no banco.</p></>} />}
    </>
  );
}
