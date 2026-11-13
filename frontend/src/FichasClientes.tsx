import { useEffect, useMemo, useState } from "react";

import {
  atualizarContabilidadeCliente,
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
}

function erroMensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : "Não foi possível concluir a solicitação.";
}

function nomesParaLista(valor: string): string[] {
  return [...new Set(valor.split(/\r?\n/).map((nome) => nome.trim()).filter(Boolean))];
}

function normalizar(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function FichasClientes({ aoFechar }: Props) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [contabilidades, setContabilidades] = useState<Contabilidade[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [busca, setBusca] = useState("");
  const [frequencia, setFrequencia] = useState<FrequenciaAcesso>("NAO_DEFINIDA");
  const [contabilidadeId, setContabilidadeId] = useState("");
  const [nomes, setNomes] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [autor, setAutor] = useState(() => localStorage.getItem("controle-notas-autor") || "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [procedimentoId, setProcedimentoId] = useState<number | null>(null);
  const [tituloProcedimento, setTituloProcedimento] = useState("");
  const [descricaoProcedimento, setDescricaoProcedimento] = useState("");

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
        setFicha(dados);
        setFrequencia(dados.frequenciaAcesso);
        setContabilidadeId(dados.contabilidadeId === null ? "" : String(dados.contabilidadeId));
        setNomes(dados.nomesAlternativos.map((nome) => nome.nome).join("\n"));
        setObservacoes(dados.observacoesPermanentes ?? "");
        setMensagem(dados.modeloMensagem ?? "");
      })
      .catch((e: unknown) => { if (ativo) setErro(erroMensagem(e)); })
      .finally(() => { if (ativo) setCarregandoFicha(false); });
    return () => { ativo = false; };
  }, [clienteId]);

  const resultados = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return clientes;
    return clientes.filter((cliente) => normalizar(cliente.nome).includes(termo) ||
      cliente.nomesAlternativos?.some((nome) => normalizar(nome.nome).includes(termo)));
  }, [clientes, busca]);

  async function recarregarFicha(id: number) {
    setFicha(await obterFichaCliente(id));
  }

  async function salvarFicha() {
    if (!ficha) return;
    setSalvando(true);
    setErro("");
    setAviso("");
    try {
      await atualizarFichaCliente(ficha.id, {
        frequenciaAcesso: frequencia,
        observacoesPermanentes: observacoes,
        modeloMensagem: mensagem,
        nomesAlternativos: nomesParaLista(nomes),
      });
      const novoId = contabilidadeId === "" ? null : Number(contabilidadeId);
      if (novoId !== ficha.contabilidadeId) {
        await atualizarContabilidadeCliente(ficha.id, novoId, autor.trim() || undefined);
      }
      await recarregarFicha(ficha.id);
      setClientes((atuais) => atuais.map((cliente) => cliente.id === ficha.id ?
        { ...cliente, nomesAlternativos: nomesParaLista(nomes).map((nome) => ({ nome })) } : cliente));
      setAviso("Ficha salva no banco de dados.");
    } catch (e) {
      setErro(erroMensagem(e));
    } finally {
      setSalvando(false);
    }
  }

  async function salvarProcedimento() {
    if (!ficha || !tituloProcedimento.trim() || !descricaoProcedimento.trim()) return;
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
    setProcedimentoId(item.id);
    setTituloProcedimento(item.titulo);
    setDescricaoProcedimento(item.descricao);
  }

  async function alternarProcedimento(item: ProcedimentoCliente) {
    if (!ficha) return;
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
      <section className="ficha-dialog" role="dialog" aria-modal="true" aria-labelledby="ficha-titulo">
        <header className="ficha-header">
          <div>
            <span className="ficha-eyebrow">Cadastro centralizado · PostgreSQL</span>
            <h2 id="ficha-titulo">Fichas dos clientes</h2>
            <p>Informações permanentes, procedimentos, contabilidade e mensagens.</p>
          </div>
          <button type="button" className="ficha-fechar" aria-label="Fechar fichas" onClick={aoFechar}>×</button>
        </header>

        <div className="ficha-content">
          <aside className="ficha-lista" aria-label="Clientes cadastrados no banco">
            <label className="ficha-campo">
              Buscar no banco
              <input value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome do cliente ou apelido..." />
            </label>
            {carregandoLista ? <p>Carregando clientes...</p> : (
              <div className="ficha-resultados">
                {resultados.map((cliente) => (
                  <button type="button" key={cliente.id}
                    className={cliente.id === clienteId ? "ficha-item selecionado" : "ficha-item"}
                    onClick={() => setClienteId(cliente.id)}>
                    {cliente.nome}
                  </button>
                ))}
                {resultados.length === 0 && <p>Nenhum cliente encontrado no PostgreSQL.</p>}
              </div>
            )}
            <p className="ficha-nota">Os clientes da tabela Excel ainda são locais. A integração entre os dois cadastros será feita em uma próxima etapa.</p>
          </aside>

          <div className="ficha-detalhes">
            {erro && <p role="alert" className="ficha-mensagem erro">{erro}</p>}
            {aviso && <p role="status" className="ficha-mensagem sucesso">{aviso}</p>}

            {carregandoFicha && <p>Carregando ficha do cliente...</p>}
            {!ficha && !carregandoFicha && (
              <div className="ficha-vazio">Selecione um cliente à esquerda para consultar ou editar sua ficha.</div>
            )}

            {ficha && (
              <>
                <h3 className="ficha-cliente-nome">{ficha.nome}</h3>
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
                <label className="ficha-campo">
                  Anotações permanentes
                  <textarea rows={4} value={observacoes} onChange={(evento) => setObservacoes(evento.target.value)} placeholder="Informações importantes deste cliente..." />
                </label>
                <label className="ficha-campo">
                  Modelo manual de mensagem à contabilidade
                  <textarea rows={5} value={mensagem} onChange={(evento) => setMensagem(evento.target.value)} placeholder="Primeira NF-e: [preencher]\nÚltima NF-e: [preencher]..." />
                </label>
                <label className="ficha-campo">
                  Responsável pela alteração de contabilidade (opcional)
                  <input value={autor} onChange={(evento) => setAutor(evento.target.value)} placeholder="Seu nome" />
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
                  <textarea value={descricaoProcedimento} onChange={(evento) => setDescricaoProcedimento(evento.target.value)} rows={4} placeholder="Descreva como realizar o atendimento..." />
                </label>
                <div className="ficha-acoes">
                  {procedimentoId !== null && (
                    <button type="button" className="ficha-botao" onClick={() => {
                      setProcedimentoId(null);
                      setTituloProcedimento("");
                      setDescricaoProcedimento("");
                    }}>Cancelar edição</button>
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
