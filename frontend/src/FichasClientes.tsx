import { useEffect, useMemo, useRef, useState } from "react";

import {
  atualizarFichaCliente,
  atualizarProcedimentoCliente,
  criarProcedimentoCliente,
  listarClientes,
  listarContabilidades,
  obterFichaCliente,
} from "./api";
import type {
  Cliente,
  Contabilidade,
  FichaCliente,
  FrequenciaAcesso,
  ProcedimentoCliente,
} from "./types";
import "./ficha-cliente.css";

interface Props {
  aoFechar: () => void;
  clienteInicialId?: number | null;
}

function erroMensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a solicitação.";
}

function nomesParaLista(valor: string): string[] {
  return [...new Set(valor.split(/\r?\n/).map((nome) => nome.trim()).filter(Boolean))];
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function FichasClientes({ aoFechar, clienteInicialId = null }: Props) {
  const dialogRef = useRef<HTMLElement>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contabilidades, setContabilidades] = useState<Contabilidade[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [clienteId, setClienteId] = useState<number | null>(clienteInicialId);
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [tentativaLeitura, setTentativaLeitura] = useState(0);
  const [busca, setBusca] = useState("");
  const [buscarEm, setBuscarEm] = useState<"TODOS" | "NOME" | "APELIDOS">("TODOS");
  const [frequencia, setFrequencia] = useState<FrequenciaAcesso>("NAO_DEFINIDA");
  const [contabilidadeId, setContabilidadeId] = useState("");
  const [nomes, setNomes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [adicionais, setAdicionais] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [autor, setAutor] = useState(() => localStorage.getItem("controle-notas-autor") || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [procedimentoId, setProcedimentoId] = useState<number | null>(null);
  const [tituloProcedimento, setTituloProcedimento] = useState("");
  const [descricaoProcedimento, setDescricaoProcedimento] = useState("");
  const fichaAlterada = !!ficha && (
    frequencia !== ficha.frequenciaAcesso
    || contabilidadeId !== (ficha.contabilidadeId === null ? "" : String(ficha.contabilidadeId))
    || observacoes.trim() !== (ficha.observacoesPermanentes ?? "")
    || adicionais.trim() !== (ficha.informacoesAdicionais ?? "").trim()
    || mensagem.trim() !== (ficha.modeloMensagem ?? "")
    || JSON.stringify(nomesParaLista(nomes).sort()) !== JSON.stringify(ficha.nomesAlternativos.map(item => item.nome).sort())
  );
  const procedimentoOriginal = ficha?.procedimentos.find(item => item.id === procedimentoId);
  const procedimentoAlterado = tituloProcedimento.trim() !== (procedimentoOriginal?.titulo ?? "")
    || descricaoProcedimento.trim() !== (procedimentoOriginal?.descricao ?? "");
  const edicaoAtual = useRef({ bloqueado: false, ficha: null as FichaCliente | null });
  const geracaoFicha = useRef(0);
  edicaoAtual.current = { bloqueado: salvando || fichaAlterada || procedimentoAlterado || procedimentoId !== null, ficha };

  useEffect(() => {
    if (!fichaAlterada && !procedimentoAlterado && !salvando) return;
    const proteger = (evento: BeforeUnloadEvent) => { evento.preventDefault(); evento.returnValue = ""; };
    window.addEventListener("beforeunload", proteger);
    return () => window.removeEventListener("beforeunload", proteger);
  }, [fichaAlterada, procedimentoAlterado, salvando]);

  function podeSair() {
    return !salvando && (!(fichaAlterada || procedimentoAlterado)
      || window.confirm("Descartar as alterações não salvas da ficha ou do procedimento?"));
  }
  function fechar() { if (podeSair()) aoFechar(); }
  function podeDescartarProcedimento() {
    return !salvando && (!procedimentoAlterado
      || window.confirm("Descartar as alterações não salvas deste procedimento?"));
  }
  function cancelarProcedimento() {
    if (!podeDescartarProcedimento()) return;
    setProcedimentoId(null); setTituloProcedimento(""); setDescricaoProcedimento("");
  }

  useEffect(() => {
    const anterior = document.activeElement;
    dialogRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus(); };
  }, []);

  function preencherFicha(dados: FichaCliente) {
    setFicha(dados);
    setFrequencia(dados.frequenciaAcesso);
    setContabilidadeId(dados.contabilidadeId === null ? "" : String(dados.contabilidadeId));
    setNomes(dados.nomesAlternativos.map((nome) => nome.nome).join("\n"));
    setObservacoes(dados.observacoesPermanentes ?? "");
    setAdicionais(dados.informacoesAdicionais ?? "");
    setMensagem(dados.modeloMensagem ?? "");
  }

  useEffect(() => {
    let ativo = true;
    Promise.all([listarClientes(), listarContabilidades()])
      .then(([listaClientes, listaContabilidades]) => {
        if (!ativo) return;
        setClientes(listaClientes);
        setContabilidades(listaContabilidades);
      })
      .catch((e: unknown) => { if (ativo) setErro(erroMensagem(e)); })
      .finally(() => { if (ativo) setCarregandoLista(false); });
    return () => { ativo = false; };
  }, []);

  useEffect(() => {
    if (clienteId === null) { setFicha(null); return; }
    let ativo = true;
    setCarregandoFicha(true);
    setFicha(null);
    setErro("");
    setAviso("");
    setProcedimentoId(null);
    setTituloProcedimento("");
    setDescricaoProcedimento("");
    obterFichaCliente(clienteId)
      .then((dados) => {
        if (!ativo) return;
        preencherFicha(dados);
      })
      .catch((e: unknown) => { if (ativo) setErro(erroMensagem(e)); })
      .finally(() => { if (ativo) setCarregandoFicha(false); });
    return () => { ativo = false; };
  }, [clienteId, tentativaLeitura]);

  useEffect(() => {
    if (carregandoLista || carregandoFicha) return;
    let ativo = true, buscando = false;
    const atualizar = async () => {
      if (buscando || edicaoAtual.current.bloqueado || document.hidden) return;
      buscando = true;
      const geracao = geracaoFicha.current;
      try {
        const lista = await listarClientes();
        if (!ativo || geracao !== geracaoFicha.current || edicaoAtual.current.bloqueado) return;
        setClientes(lista);
        if (clienteId !== null && !lista.some(cliente => cliente.id === clienteId)) {
          setClienteId(null); setFicha(null); return;
        }
        if (clienteId !== null && edicaoAtual.current.ficha) {
          const atualizada = await obterFichaCliente(clienteId);
          if (ativo && geracao === geracaoFicha.current && !edicaoAtual.current.bloqueado) preencherFicha(atualizada);
        }
      } catch { /* Preserve the current view and all drafts during a polling failure. */ }
      finally { buscando = false; }
    };
    const timer = window.setInterval(() => void atualizar(), 2000);
    return () => { ativo = false; window.clearInterval(timer); };
  }, [clienteId, carregandoLista, carregandoFicha]);

  const resultados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return clientes;
    return clientes.filter((cliente) => {
      const peloNome = normalizar(cliente.nome).includes(termo);
      const peloApelido = cliente.nomesAlternativos?.some((nome) => normalizar(nome.nome).includes(termo)) ?? false;
      return buscarEm === "NOME" ? peloNome : buscarEm === "APELIDOS" ? peloApelido : peloNome || peloApelido;
    });
  }, [clientes, busca, buscarEm]);
  const nomesRepetidos = useMemo(() => {
    const contagens = new Map<string, number>();
    for (const cliente of clientes) contagens.set(cliente.nome, (contagens.get(cliente.nome) ?? 0) + 1);
    return new Set([...contagens].filter(([, total]) => total > 1).map(([nome]) => nome));
  }, [clientes]);

  async function recarregarFicha(id: number) {
    const dados = await obterFichaCliente(id);
    if (fichaAlterada) setFicha(anterior => anterior ? { ...anterior, procedimentos: dados.procedimentos, historicoContabilidades: dados.historicoContabilidades } : dados);
    else preencherFicha(dados);
  }

  async function salvarFicha() {
    if (!ficha || salvando) return;
    geracaoFicha.current++;
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      const campos: Parameters<typeof atualizarFichaCliente>[1] = {};
      if (frequencia !== ficha.frequenciaAcesso) campos.frequenciaAcesso = frequencia;
      if (observacoes.trim() !== (ficha.observacoesPermanentes ?? "")) campos.observacoesPermanentes = observacoes;
      if (adicionais.trim() !== (ficha.informacoesAdicionais ?? "").trim()) {
        campos.informacoesAdicionais = adicionais;
        campos.valoresAnteriores = { informacoesAdicionais: ficha.informacoesAdicionais ?? "" };
      }
      if (mensagem.trim() !== (ficha.modeloMensagem ?? "")) campos.modeloMensagem = mensagem;
      if (JSON.stringify(nomesParaLista(nomes).sort()) !== JSON.stringify(ficha.nomesAlternativos.map(item => item.nome).sort())) {
        campos.nomesAlternativos = nomesParaLista(nomes);
        campos.valoresAnteriores = { ...campos.valoresAnteriores, nomesAlternativos: ficha.nomesAlternativos.map(item => item.nome) };
      }
      const firma = contabilidadeId === "" ? null : Number(contabilidadeId);
      if (firma !== ficha.contabilidadeId) campos.contabilidadeId = firma;
      if (!Object.keys(campos).length) { setAviso("Ficha salva no banco de dados."); return; }
      const dados = await atualizarFichaCliente(ficha.id, { ...campos, autor: autor.trim() || undefined });
      preencherFicha(dados);
      setClientes((atuais) => atuais.map((cliente) => cliente.id === dados.id ? dados : cliente));
      setAviso("Ficha salva no banco de dados.");
    } catch (e) {
      setErro(erroMensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  async function salvarProcedimento() {
    if (!ficha || !tituloProcedimento.trim() || !descricaoProcedimento.trim()) return;
    geracaoFicha.current++;
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      if (procedimentoId !== null) {
        await atualizarProcedimentoCliente(ficha.id, procedimentoId, {
          titulo: tituloProcedimento.trim(),
          descricao: descricaoProcedimento.trim(),
        });
      } else {
        await criarProcedimentoCliente(ficha.id, tituloProcedimento.trim(), descricaoProcedimento.trim());
      }
      await recarregarFicha(ficha.id);
      setProcedimentoId(null);
      setTituloProcedimento("");
      setDescricaoProcedimento("");
      setAviso("Procedimento salvo.");
    } catch (e) {
      setErro(erroMensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  function editarProcedimento(item: ProcedimentoCliente) {
    if (!podeDescartarProcedimento()) return;
    setProcedimentoId(item.id);
    setTituloProcedimento(item.titulo);
    setDescricaoProcedimento(item.descricao);
  }

  async function alternarProcedimento(item: ProcedimentoCliente) {
    if (!ficha) return;
    geracaoFicha.current++;
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      await atualizarProcedimentoCliente(ficha.id, item.id, { ativo: !item.ativo });
      await recarregarFicha(ficha.id);
      setAviso(item.ativo ? "Procedimento desativado." : "Procedimento reativado.");
    } catch (e) {
      setErro(erroMensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="ficha-backdrop">
      <section ref={dialogRef} className="ficha-dialog" role="dialog" aria-modal="true" aria-labelledby="ficha-titulo"
        aria-busy={salvando} tabIndex={-1} onKeyDown={(evento) => {
          if (evento.key === "Escape") {
            evento.preventDefault();
            evento.stopPropagation();
            fechar();
          }
          if (evento.key === "Tab") {
            const elementos = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
            ) ?? []);
            const primeiro = elementos[0];
            const ultimo = elementos[elementos.length - 1];
            if (evento.shiftKey && document.activeElement === primeiro) {
              evento.preventDefault(); ultimo?.focus();
            } else if (!evento.shiftKey && document.activeElement === ultimo) {
              evento.preventDefault(); primeiro?.focus();
            }
          }
        }}>
        <header className="ficha-header">
          <div>
            <span className="ficha-eyebrow">Cadastro único de clientes</span>
            <h2 id="ficha-titulo">Fichas dos clientes</h2>
            <p>Informações permanentes, procedimentos, contabilidade e mensagens.</p>
          </div>
          <button type="button" className="ficha-fechar" aria-label="Fechar fichas" disabled={salvando} onClick={fechar}>×</button>
        </header>

        <div className="ficha-content">
          <aside className="ficha-lista" aria-label="Clientes cadastrados no banco">
            <label className="ficha-campo">
              Buscar no banco
              <input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome do cliente ou apelido..." />
            </label>
            <label className="ficha-campo">
              Pesquisar por
              <select aria-label="Pesquisar por" value={buscarEm} onChange={(evento) => setBuscarEm(evento.target.value as typeof buscarEm)}>
                <option value="TODOS">Nome e apelidos</option>
                <option value="NOME">Somente nome</option>
                <option value="APELIDOS">Somente apelidos</option>
              </select>
            </label>
            {carregandoLista ? <p>Carregando clientes...</p> : (
              <div className="ficha-resultados">
                {resultados.map((cliente) => (
                  <button type="button" key={cliente.id}
                    disabled={salvando} className={cliente.id === clienteId ? "ficha-item selecionado" : "ficha-item"}
                    onClick={() => {
                      if (salvando) return;
                      if (cliente.id === clienteId && !ficha && !carregandoFicha) {
                        setTentativaLeitura((atual) => atual + 1);
                      } else if (cliente.id !== clienteId && podeSair()) {
                        setClienteId(cliente.id);
                      }
                    }}>
                    <span className="ficha-item-nome">{cliente.nome}</span>
                    {cliente.confere && <small className="ficha-item-codigo">Confere #{cliente.confere.codigo}</small>}
                    {!cliente.confere && nomesRepetidos.has(cliente.nome) && <small className="ficha-item-codigo">Cadastro #{cliente.id}</small>}
                  </button>
                ))}
                {resultados.length === 0 && <p>Nenhum cliente encontrado no PostgreSQL.</p>}
              </div>
            )}
            <p className="ficha-nota">Este é o mesmo cadastro usado no Excel e no menu Clientes. Cada cliente tem uma única ficha, identificada pelo código do cadastro.</p>
          </aside>

          <div className="ficha-detalhes">
            {erro && <p role="alert" className="ficha-mensagem erro">{erro}</p>}
            {erro.startsWith("Outro computador alterou") && <button type="button" className="ficha-botao" disabled={salvando} onClick={() => { if (podeSair()) setTentativaLeitura(atual => atual + 1); }}>Recarregar ficha após revisar</button>}
            {aviso && <p role="status" className="ficha-mensagem sucesso">{aviso}</p>}

            {carregandoFicha && <p>Carregando ficha do cliente...</p>}
            {!ficha && !carregandoFicha && (
              <div className="ficha-vazio">Selecione um cliente à esquerda para consultar ou editar sua ficha.</div>
            )}

            {ficha && (
              <>
                <fieldset className="ficha-edicao" disabled={salvando}>
                <h3 className="ficha-cliente-nome">{ficha.nome}</h3>
                <p className="ficha-identificacao">Cadastro #{ficha.id}</p>
                {ficha.confere && <p className="ficha-identificacao">Código no Confere: {ficha.confere.codigo}</p>}
                <div className="ficha-campos-duplos">
                  <label className="ficha-campo">
                    Frequência de acesso
                    <select value={frequencia} onChange={(evento) => setFrequencia(evento.target.value as FrequenciaAcesso)}>
                      <option value="NAO_DEFINIDA">Não definida</option>
                      <option value="MENSAL">Mensal</option>
                      <option value="EVENTUAL">Eventual</option>
                    </select>
                  </label>
                  <label className="ficha-campo">
                    Contabilidade responsável
                    <select value={contabilidadeId} onChange={(evento) => setContabilidadeId(evento.target.value)}>
                      <option value="">Não cadastrada</option>
                      {contabilidades.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                    </select>
                  </label>
                </div>
                <label className="ficha-campo">
                  Outros nomes para pesquisa (um por linha)
                  <textarea rows={3} value={nomes} onChange={(evento) => setNomes(evento.target.value)} placeholder="Razão social, nome fantasia, abreviações..." />
                </label>
                <p className="ficha-descricao">Adicione também os apelidos usados pela equipe, um por linha. Eles ficam disponíveis na pesquisa após salvar a ficha.</p>
                <label className="ficha-campo">
                  Anotações permanentes
                  <textarea rows={4} maxLength={20000} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} placeholder="Informações importantes deste cliente..." />
                </label>
                <label className="ficha-campo">
                  Informações adicionais
                  <textarea rows={4} maxLength={20000} value={adicionais} onChange={evento => setAdicionais(evento.target.value)} placeholder="Particularidades e orientações deste cliente..." />
                </label>
                <p className="ficha-descricao">Estas informações também aparecem no botão ? do cliente no Excel.</p>
                <label className="ficha-campo">
                  Modelo manual de mensagem à contabilidade
                  <textarea rows={5} maxLength={20000} value={mensagem} onChange={(evento) => setMensagem(evento.target.value)} placeholder="Primeira NF-e: [preencher]\nÚltima NF-e: [preencher]..." />
                </label>
                <label className="ficha-campo">
                  Responsável pela alteração de contabilidade (opcional)
                  <input maxLength={150} value={autor} onChange={(evento) => setAutor(evento.target.value)} placeholder="Seu nome" />
                </label>
                <div className="ficha-acoes">
                  <button type="button" className="ficha-botao primario" disabled={salvando} onClick={salvarFicha}>
                    {salvando ? "Salvando..." : "Salvar ficha"}
                  </button>
                </div>

                <div className="ficha-separador" />
                <h4>Procedimentos de suporte</h4>
                <p className="ficha-descricao">Instruções específicas deste cliente, válidas para atendimentos futuros.</p>
                <div className="ficha-procedimentos">
                  {ficha.procedimentos.map((item) => (
                    <article key={item.id} className={item.ativo ? "ficha-procedimento" : "ficha-procedimento inativo"}>
                      <div className="ficha-procedimento-topo">
                        <strong>{item.titulo}</strong>
                        <span>{item.ativo ? "Ativo" : "Inativo"}</span>
                      </div>
                      <p>{item.descricao}</p>
                      <div className="ficha-acoes">
                        <button type="button" className="ficha-botao" disabled={salvando} onClick={() => editarProcedimento(item)}>Editar</button>
                        <button type="button" className="ficha-botao" disabled={salvando} onClick={() => alternarProcedimento(item)}>
                          {item.ativo ? "Desativar" : "Reativar"}
                        </button>
                      </div>
                    </article>
                  ))}
                  {ficha.procedimentos.length === 0 && <p>Nenhum procedimento cadastrado.</p>}
                </div>
                <h4>{procedimentoId === null ? "Adicionar procedimento" : "Editar procedimento"}</h4>
                <label className="ficha-campo">
                  Título
                  <input value={tituloProcedimento} onChange={(evento) => setTituloProcedimento(evento.target.value)} maxLength={200} placeholder="Ex.: Envio manual das notas" />
                </label>
                <label className="ficha-campo">
                  Passo a passo
                  <textarea maxLength={20000} value={descricaoProcedimento} onChange={(evento) => setDescricaoProcedimento(evento.target.value)} rows={4} placeholder="Descreva como realizar o atendimento..." />
                </label>
                <div className="ficha-acoes">
                  {procedimentoId !== null && (
                    <button type="button" className="ficha-botao" onClick={cancelarProcedimento}>Cancelar edição</button>
                  )}
                  <button type="button" className="ficha-botao primario" disabled={salvando || !tituloProcedimento.trim() || !descricaoProcedimento.trim()} onClick={salvarProcedimento}>
                    Salvar procedimento
                  </button>
                </div>

                <div className="ficha-separador" />
                <h4>Histórico de contabilidades</h4>
                {ficha.historicoContabilidades.length ? (
                  <ul className="ficha-historico">
                    {ficha.historicoContabilidades.map((item) => (
                      <li key={item.id}>
                        <strong>{item.nomeAnterior ?? "Sem contabilidade"} → {item.nomeNova ?? "Sem contabilidade"}</strong>
                        <small>{new Date(item.criadoEm).toLocaleString("pt-BR")}{item.autor ? " · " + item.autor : ""}</small>
                      </li>
                    ))}
                  </ul>
                ) : <p className="ficha-descricao">Nenhuma troca de contabilidade registrada até agora.</p>}
                </fieldset>
              </>
            )}
          </div>
        </div>

        <footer className="ficha-footer">
          Não registre senhas nesta ficha. A autenticação e o controle de acesso ainda serão implementados.
        </footer>
      </section>
    </div>
  );
}
