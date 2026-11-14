import { useEffect, useMemo, useRef, useState } from "react";
import {
  atualizarCliente, atualizarContabilidade, criarCliente, criarContabilidade,
  listarClientes, listarContabilidades, obterFichaCliente,
} from "./api";
import type { Cliente, Contabilidade, HistoricoContabilidadeCliente } from "./types";
import "./cadastros.css";

export type AbaCadastro = "clientes" | "contabilidades";
type FormCliente = { id: number | null; nome: string; ativo: boolean; contabilidadeId: string };
type FormContabilidade = { id: number | null; nome: string };

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}
function ordenar<T extends { nome: string; id: number }>(lista: T[]) {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR") || a.id - b.id);
}
function mensagem(erro: unknown) {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a solicitação.";
}
function clienteParaForm(cliente: Cliente): FormCliente {
  return { id: cliente.id, nome: cliente.nome, ativo: cliente.ativo, contabilidadeId: cliente.contabilidadeId === null ? "" : String(cliente.contabilidadeId) };
}
function compararCliente(form: FormCliente | null) {
  return form ? JSON.stringify({ ...form, nome: form.nome.trim() }) : "";
}

export function Cadastros({ abaInicial, aoFechar, aoAtualizar }: {
  abaInicial: AbaCadastro; aoFechar: () => void; aoAtualizar: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [aba, setAba] = useState(abaInicial);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contabilidades, setContabilidades] = useState<Contabilidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("TODOS");
  const [filtroContabilidade, setFiltroContabilidade] = useState("TODAS");
  const [formCliente, setFormCliente] = useState<FormCliente | null>(null);
  const [baseCliente, setBaseCliente] = useState<FormCliente | null>(null);
  const [formContabilidade, setFormContabilidade] = useState<FormContabilidade | null>(null);
  const [baseContabilidade, setBaseContabilidade] = useState<FormContabilidade | null>(null);
  const [novaContabilidade, setNovaContabilidade] = useState(false);
  const [nomeNovaContabilidade, setNomeNovaContabilidade] = useState("");
  const [autor, setAutor] = useState(() => localStorage.getItem("controle-notas-autor") || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [historico, setHistorico] = useState<HistoricoContabilidadeCliente[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(false);
  const [erroHistorico, setErroHistorico] = useState("");
  const [revisaoHistorico, setRevisaoHistorico] = useState(0);
  const clienteId = formCliente?.id ?? null;
  const clienteAlterado = compararCliente(formCliente) !== compararCliente(baseCliente);
  const contabilidadeAlterada = formContabilidade?.nome.trim() !== baseContabilidade?.nome.trim();
  const alterado = clienteAlterado || contabilidadeAlterada || !!nomeNovaContabilidade.trim();

  useEffect(() => {
    const anterior = document.activeElement;
    const elemento = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    elemento?.showModal();
    return () => {
      elemento?.close();
      document.body.style.overflow = overflow;
      if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus();
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErroCarga("");
    Promise.all([listarClientes(), listarContabilidades()]).then(([lista, firmas]) => {
      if (ativo) { setClientes(ordenar(lista)); setContabilidades(ordenar(firmas)); }
    }).catch((e: unknown) => { if (ativo) setErroCarga(mensagem(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tentativa]);

  useEffect(() => {
    setHistorico([]); setErroHistorico("");
    if (clienteId === null) { setCarregandoHistorico(false); return; }
    let ativo = true;
    setCarregandoHistorico(true);
    obterFichaCliente(clienteId).then(dados => { if (ativo) setHistorico(dados.historicoContabilidades); })
      .catch((e: unknown) => { if (ativo) setErroHistorico(mensagem(e)); })
      .finally(() => { if (ativo) setCarregandoHistorico(false); });
    return () => { ativo = false; };
  }, [clienteId, revisaoHistorico]);

  const resultados = useMemo(() => clientes.filter(cliente => {
    const termo = normalizar(busca);
    const nomeEncontrado = !termo || normalizar(cliente.nome).includes(termo)
      || cliente.nomesAlternativos?.some(item => normalizar(item.nome).includes(termo))
      || (cliente.confere?.codigo.includes(termo) ?? false);
    return nomeEncontrado && (situacao === "TODOS" || cliente.ativo === (situacao === "ATIVOS"))
      && (filtroContabilidade === "TODAS" || (filtroContabilidade === "SEM"
        ? cliente.contabilidadeId === null : String(cliente.contabilidadeId) === filtroContabilidade));
  }), [clientes, busca, situacao, filtroContabilidade]);
  const firmasFiltradas = useMemo(() => contabilidades.filter(item => normalizar(item.nome).includes(normalizar(busca))), [contabilidades, busca]);
  const clientesPorContabilidade = useMemo(() => {
    const contagens = new Map<number, number>();
    for (const cliente of clientes) {
      if (cliente.contabilidadeId !== null) contagens.set(cliente.contabilidadeId, (contagens.get(cliente.contabilidadeId) ?? 0) + 1);
    }
    return contagens;
  }, [clientes]);

  function podeSair() {
    return !salvando && (!alterado || window.confirm("Descartar as alterações não salvas deste cadastro?"));
  }
  function limparMensagens() { setErro(""); setAviso(""); }
  function trocarAba(valor: AbaCadastro) {
    if (aba === valor || !podeSair()) return;
    setAba(valor); setBusca(""); setFormCliente(null); setBaseCliente(null);
    setFormContabilidade(null); setBaseContabilidade(null);
    setNovaContabilidade(false); setNomeNovaContabilidade(""); limparMensagens();
  }
  function selecionarCliente(cliente?: Cliente) {
    if ((cliente && cliente.id === clienteId) || !podeSair()) return;
    const form = cliente ? clienteParaForm(cliente) : { id: null, nome: "", ativo: true, contabilidadeId: "" };
    setFormCliente(form); setBaseCliente(form);
    setHistorico([]); setErroHistorico(""); setCarregandoHistorico(!!cliente);
    setNovaContabilidade(false); setNomeNovaContabilidade(""); limparMensagens();
  }
  function selecionarContabilidade(item?: Contabilidade) {
    if ((item && item.id === formContabilidade?.id) || !podeSair()) return;
    const form = { id: item?.id ?? null, nome: item?.nome ?? "" };
    setFormContabilidade(form); setBaseContabilidade(form); limparMensagens();
  }
  function editarCliente(dados: Partial<FormCliente>) {
    setFormCliente(atual => atual ? { ...atual, ...dados } : atual); limparMensagens();
  }
  async function salvarCliente() {
    if (!formCliente?.nome.trim() || !clienteAlterado || salvando) return;
    if (novaContabilidade && nomeNovaContabilidade.trim()) {
      setErro("Cadastre a nova contabilidade antes de salvar o cliente."); return;
    }
    setSalvando(true); limparMensagens();
    try {
      const firmaId = formCliente.contabilidadeId === "" ? null : Number(formCliente.contabilidadeId);
      let dados: Cliente;
      if (formCliente.id === null) {
        dados = await criarCliente(formCliente.nome.trim(), firmaId);
      } else {
        dados = await atualizarCliente(formCliente.id, {
          ...(formCliente.nome.trim() !== baseCliente?.nome.trim() ? { nome: formCliente.nome.trim() } : {}),
          ...(formCliente.ativo !== baseCliente?.ativo ? { ativo: formCliente.ativo } : {}),
          ...(formCliente.contabilidadeId !== baseCliente?.contabilidadeId ? { contabilidadeId: firmaId } : {}),
          autor: autor.trim() || undefined,
        });
      }
      const form = clienteParaForm(dados);
      setFormCliente(form); setBaseCliente(form);
      setClientes(atuais => ordenar(atuais.some(item => item.id === dados.id)
        ? atuais.map(item => item.id === dados.id ? { ...item, ...dados } : item) : [...atuais, dados]));
      setRevisaoHistorico(valor => valor + 1); aoAtualizar();
      setAviso("Cliente salvo.");
    } catch (e) { setErro(mensagem(e)); }
    finally { setSalvando(false); }
  }
  async function salvarContabilidade(vincular = false) {
    const nome = vincular ? nomeNovaContabilidade.trim() : formContabilidade?.nome.trim();
    if (!nome || salvando) return;
    setSalvando(true); limparMensagens();
    try {
      const dados = !vincular && formContabilidade?.id !== null && formContabilidade?.id !== undefined
        ? await atualizarContabilidade(formContabilidade.id, nome) : await criarContabilidade(nome);
      setContabilidades(atuais => ordenar(atuais.some(item => item.id === dados.id)
        ? atuais.map(item => item.id === dados.id ? { ...item, ...dados } : item) : [...atuais, dados]));
      setClientes(atuais => atuais.map(item => item.contabilidadeId === dados.id ? { ...item, contabilidade: dados } : item));
      if (vincular) {
        setFormCliente(atual => atual ? { ...atual, contabilidadeId: String(dados.id) } : atual);
        setNovaContabilidade(false); setNomeNovaContabilidade("");
        setAviso("Contabilidade cadastrada. Salve o cliente para concluir o vínculo.");
      } else {
        const form = { id: dados.id, nome: dados.nome };
        setFormContabilidade(form); setBaseContabilidade(form); setAviso("Contabilidade salva.");
      }
      aoAtualizar();
    } catch (e) { setErro(mensagem(e)); }
    finally { setSalvando(false); }
  }
  const selecionado = clientes.find(item => item.id === clienteId);

  return (
    <dialog ref={dialog} className="cadastros-dialog" aria-labelledby="cadastros-titulo" aria-busy={salvando}
      onKeyDown={evento => {
        if (evento.key === "Escape") {
          evento.preventDefault(); evento.stopPropagation();
          if (podeSair()) aoFechar();
          return;
        }
        if (evento.key !== "Tab") return;
        const elementos = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
        ));
        const primeiro = elementos[0];
        const ultimo = elementos[elementos.length - 1];
        if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo?.focus(); }
        else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro?.focus(); }
      }}
      onCancel={evento => { evento.preventDefault(); if (podeSair()) aoFechar(); }}
      onClick={evento => {
        if (evento.target !== evento.currentTarget) return;
        const retangulo = evento.currentTarget.getBoundingClientRect();
        if ((evento.clientX < retangulo.left || evento.clientX > retangulo.right || evento.clientY < retangulo.top || evento.clientY > retangulo.bottom) && podeSair()) aoFechar();
      }}>
      <header className="cadastros-cabecalho">
        <div><span className="cadastros-legenda">Organização do sistema</span><h2 id="cadastros-titulo">Cadastros</h2>
          <p>Clientes e contabilidades, em um só lugar.</p></div>
        <button type="button" className="cadastros-fechar" aria-label="Fechar cadastros" disabled={salvando}
          onClick={() => { if (podeSair()) aoFechar(); }}>×</button>
      </header>
      <nav className="cadastros-abas" aria-label="Tipo de cadastro">
        <button type="button" aria-pressed={aba === "clientes"} disabled={salvando} onClick={() => trocarAba("clientes")}>Clientes</button>
        <button type="button" aria-pressed={aba === "contabilidades"} disabled={salvando} onClick={() => trocarAba("contabilidades")}>Contabilidades</button>
      </nav>
      {carregando ? <p className="cadastros-estado">Carregando cadastros...</p> : erroCarga ? (
        <div className="cadastros-estado"><p role="alert">{erroCarga}</p><button className="button secondary" onClick={() => setTentativa(valor => valor + 1)}>Tentar novamente</button></div>
      ) : (
        <div className="cadastros-layout">
          <section className="cadastros-lista" aria-label={aba === "clientes" ? "Lista de clientes" : "Lista de contabilidades"}>
            <div className="cadastros-lista-topo"><h3>{aba === "clientes" ? "Todos os clientes" : "Todas as contabilidades"}</h3>
              <button className="button secondary" disabled={salvando} onClick={() => aba === "clientes" ? selecionarCliente() : selecionarContabilidade()}>
                {aba === "clientes" ? "Novo cliente" : "Nova contabilidade"}</button></div>
            <label className="cadastros-campo">{aba === "clientes" ? "Buscar clientes" : "Buscar contabilidades"}
              <input type="search" value={busca} onChange={evento => setBusca(evento.target.value)} placeholder={aba === "clientes" ? "Nome, apelido ou código do Confere" : "Nome da contabilidade"} /></label>
            {aba === "clientes" && <div className="cadastros-filtros">
              <label className="cadastros-campo">Situação
                <select value={situacao} onChange={evento => setSituacao(evento.target.value)}><option value="TODOS">Todos</option><option value="ATIVOS">Ativos</option><option value="INATIVOS">Inativos</option></select></label>
              <label className="cadastros-campo">Filtrar por contabilidade
                <select value={filtroContabilidade} onChange={evento => setFiltroContabilidade(evento.target.value)}>
                  <option value="TODAS">Todas</option><option value="SEM">Sem contabilidade</option>
                  {contabilidades.map(item => <option value={item.id} key={item.id}>{item.nome}</option>)}
                </select></label>
            </div>}
            <p className="cadastros-contagem">{aba === "clientes" ? `${resultados.length} de ${clientes.length} clientes` : `${firmasFiltradas.length} de ${contabilidades.length} contabilidades`}</p>
            <ul className="cadastros-resultados">
              {aba === "clientes" ? resultados.map(cliente => (
                <li key={cliente.id}><button type="button" className="cadastros-linha" disabled={salvando} aria-pressed={cliente.id === clienteId}
                  aria-label={`Editar cliente ${cliente.nome} (${cliente.confere ? `Confere #${cliente.confere.codigo}` : `#${cliente.id}`})`}
                  onClick={() => selecionarCliente(cliente)}>
                  <span><strong>{cliente.nome}</strong><small>{cliente.contabilidade?.nome || "Sem contabilidade"}</small>
                    {cliente.confere && <small>Confere #{cliente.confere.codigo}</small>}</span>
                  <span className={cliente.ativo ? "cadastros-situacao ativo" : "cadastros-situacao"}>{cliente.ativo ? "Ativo" : "Inativo"}</span>
                </button></li>
              )) : firmasFiltradas.map(item => (
                <li key={item.id}><button type="button" className="cadastros-linha" disabled={salvando} aria-pressed={item.id === formContabilidade?.id}
                  aria-label={`Editar contabilidade ${item.nome} (#${item.id})`} onClick={() => selecionarContabilidade(item)}>
                  <span><strong>{item.nome}</strong><small>{clientesPorContabilidade.get(item.id) === 1 ? "1 cliente vinculado" : `${clientesPorContabilidade.get(item.id) ?? 0} clientes vinculados`}</small></span>
                </button></li>
              ))}
              {(aba === "clientes" ? resultados.length : firmasFiltradas.length) === 0 && <li className="cadastros-vazio">
                {(aba === "clientes" ? clientes.length : contabilidades.length) === 0 ? "Nenhum cadastro ainda. Use o botão acima para começar." : "Nenhum resultado para estes filtros."}
              </li>}
            </ul>
            {aba === "clientes" && <p className="cadastros-nota">Esta lista reúne os clientes cadastrados no sistema. A tabela Excel mantém seus registros separados.</p>}
          </section>
          <section className="cadastros-editor" aria-label="Editar cadastro">
            {erro && <p className="cadastros-mensagem erro" role="alert">{erro}</p>}
            {aviso && <p className="cadastros-mensagem sucesso" role="status">{aviso}</p>}
            {aba === "clientes" && formCliente ? (
              <form onSubmit={evento => { evento.preventDefault(); void salvarCliente(); }}>
                <h3>{clienteId === null ? "Novo cliente" : "Editar cliente"}</h3>
                {selecionado?.confere && <p className="cadastros-nota">Código no Confere: {selecionado.confere.codigo}</p>}
                <fieldset disabled={salvando} className="cadastros-campos">
                  <label className="cadastros-campo">Nome do cliente<input value={formCliente.nome} maxLength={200} required onChange={evento => editarCliente({ nome: evento.target.value })} /></label>
                  {clienteId !== null && <label className="cadastros-campo">Situação do cliente
                    <select value={formCliente.ativo ? "ATIVO" : "INATIVO"} onChange={evento => editarCliente({ ativo: evento.target.value === "ATIVO" })}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label>}
                  <label className="cadastros-campo">Contabilidade do cliente
                    <select value={formCliente.contabilidadeId} onChange={evento => editarCliente({ contabilidadeId: evento.target.value })}>
                      <option value="">Sem contabilidade</option>{contabilidades.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
                    </select></label>
                  <button type="button" className="cadastros-link" onClick={() => {
                    setNovaContabilidade(!novaContabilidade); setNomeNovaContabilidade("");
                  }}>{novaContabilidade ? "Cancelar nova contabilidade" : "Cadastrar uma contabilidade"}</button>
                  {novaContabilidade && <div className="cadastros-nova-firma">
                    <label className="cadastros-campo">Nome da nova contabilidade<input value={nomeNovaContabilidade} maxLength={200} onChange={evento => setNomeNovaContabilidade(evento.target.value)} onKeyDown={evento => {
                      if (evento.key === "Enter") { evento.preventDefault(); void salvarContabilidade(true); }
                    }} /></label>
                    <button type="button" className="button secondary" disabled={!nomeNovaContabilidade.trim()} onClick={() => void salvarContabilidade(true)}>Cadastrar e selecionar</button>
                  </div>}
                  <label className="cadastros-campo">Responsável pela alteração (opcional)<input value={autor} maxLength={150} onChange={evento => setAutor(evento.target.value)} placeholder="Seu nome" /></label>
                  <p className="cadastros-nota">Ao trocar ou remover a contabilidade, o vínculo anterior fica no histórico.</p>
                  <button className="button primary" disabled={!formCliente.nome.trim() || !clienteAlterado || (novaContabilidade && !!nomeNovaContabilidade.trim())}>{salvando ? "Salvando..." : "Salvar cliente"}</button>
                </fieldset>
                {clienteId !== null && <section className="cadastros-historico" aria-label="Histórico de contabilidades">
                  <h4>Histórico de contabilidades</h4>
                  {carregandoHistorico ? <p>Carregando histórico...</p> : erroHistorico ? <div><p role="alert">Não foi possível carregar o histórico. {erroHistorico}</p><button type="button" className="cadastros-link" disabled={salvando} onClick={() => setRevisaoHistorico(valor => valor + 1)}>Recarregar histórico</button></div>
                    : historico.length === 0 ? <p>Nenhuma troca de contabilidade registrada.</p> : <ul>{historico.map(item => <li key={item.id}>
                      <strong>{item.nomeAnterior || "Sem contabilidade"} → {item.nomeNova || "Sem contabilidade"}</strong>
                      <small>{new Date(item.criadoEm).toLocaleString("pt-BR")}{item.autor ? ` · ${item.autor}` : ""}</small>
                    </li>)}</ul>}
                </section>}
              </form>
            ) : aba === "contabilidades" && formContabilidade ? (
              <form onSubmit={evento => { evento.preventDefault(); void salvarContabilidade(); }}>
                <h3>{formContabilidade.id === null ? "Nova contabilidade" : "Editar contabilidade"}</h3>
                <fieldset disabled={salvando} className="cadastros-campos">
                  <label className="cadastros-campo">Nome da contabilidade<input value={formContabilidade.nome} maxLength={200} required onChange={evento => { setFormContabilidade({ ...formContabilidade, nome: evento.target.value }); limparMensagens(); }} /></label>
                  <p className="cadastros-nota">Alterar o nome preserva os clientes vinculados e os registros anteriores do histórico.</p>
                  <button className="button primary" disabled={!formContabilidade.nome.trim() || !contabilidadeAlterada}>{salvando ? "Salvando..." : "Salvar contabilidade"}</button>
                </fieldset>
              </form>
            ) : <div className="cadastros-selecione"><span aria-hidden="true">↗</span><h3>Selecione um cadastro</h3><p>Escolha um item na lista para editar ou crie um novo cadastro.</p></div>}
          </section>
        </div>
      )}
    </dialog>
  );
}
