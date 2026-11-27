import { useEffect, useRef, useState } from 'react';
import { listarCompetencias, listarHistoricoPendencia, obterPainel } from './api';
import { consultarExcel, type RespostaExcel } from './excel-compartilhado';
import { deslocarMes, mesAtual, rotuloMes } from './meses';
import { bloquearRolagem } from './bloquear-rolagem';
import type { HistoricoPendencia, PainelMensal } from './types';
import './consulta-meses.css';

const estados = { PENDENTE: 'Pendente', AGUARDANDO_CLIENTE: 'Aguardando cliente', EM_ATENDIMENTO: 'Em atendimento', CONCLUIDO: 'Concluído' };
const tipos = { CRIACAO: 'Pendência criada', STATUS: 'Estado alterado', RESPONSAVEL: 'Responsável alterado', OBSERVACAO: 'Observação alterada', MENSAGEM_CONTADOR: 'Mensagem alterada' };
const valorHistorico = (valor: string | null) => valor && valor in estados ? estados[valor as keyof typeof estados] : valor || '—';
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const erroTexto = (erro: unknown) => erro instanceof Error ? erro.message : 'Não foi possível consultar os registros.';

export function ConsultaMeses({ aoFechar }: { aoFechar: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [mes, setMes] = useState(() => deslocarMes(mesAtual(), -7));
  const [meses, setMeses] = useState<string[]>([]);
  const [busca, setBusca] = useState('');
  const [painel, setPainel] = useState<PainelMensal | null>(null);
  const [excel, setExcel] = useState<RespostaExcel | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [historico, setHistorico] = useState<{ id: number; nome: string; eventos: HistoricoPendencia[] } | null>(null);
  const [lendoHistorico, setLendoHistorico] = useState(false);
  const geracaoHistorico = useRef(0);
  useEffect(() => {
    const anterior = document.activeElement;
    const liberar = bloquearRolagem();
    dialog.current?.showModal();
    return () => { dialog.current?.close(); liberar(); if (anterior instanceof HTMLElement && anterior.isConnected) anterior.focus(); };
  }, []);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro(''); setPainel(null); setHistorico(null); setLendoHistorico(false); geracaoHistorico.current++;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) { setCarregando(false); return; }
    Promise.all([listarCompetencias(), obterPainel(mes), consultarExcel()]).then(([lista, dados, snapshot]) => {
      if (ativo) { setMeses(lista); setPainel(dados); setExcel(snapshot); }
    }).catch(e => { if (ativo) setErro(erroTexto(e)); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; geracaoHistorico.current++; };
  }, [mes, tentativa]);
  async function abrirHistorico(id: number, nome: string) {
    const geracao = ++geracaoHistorico.current;
    setHistorico(null); setLendoHistorico(true); setErro('');
    try {
      const eventos = await listarHistoricoPendencia(id);
      if (geracao === geracaoHistorico.current) setHistorico({ id, nome, eventos });
    } catch (e) { if (geracao === geracaoHistorico.current) setErro(erroTexto(e)); }
    finally { if (geracao === geracaoHistorico.current) setLendoHistorico(false); }
  }
  const registros = painel?.pendencias.filter(item => normalizar(`${item.cliente.nome} ${item.cliente.id}`).includes(normalizar(busca))) ?? [];
  const chaves = new Map(Object.entries(excel?.estado?.vinculosClientes ?? {}).map(([chave, id]) => [id, chave]));
  return (
    <dialog ref={dialog} className="consulta-meses" aria-labelledby="consulta-meses-titulo" onCancel={e => { e.preventDefault(); aoFechar(); }}>
      <header>
        <div><h2 id="consulta-meses-titulo">Consultar meses antigos</h2><p>Consulte os registros e históricos de qualquer mês.</p></div>
        <button type="button" className="close-button" aria-label="Fechar consulta de meses" onClick={aoFechar}>×</button>
      </header>
      <div className="consulta-meses-filtros">
        <label><span>Mês da consulta</span><input type="month" value={mes} min="0001-01" max="9999-12" onChange={e => setMes(e.target.value)} /></label>
        <label><span>Meses com registros</span><select aria-label="Meses com registros" value={meses.includes(mes) ? mes : ''} onChange={e => { if (e.target.value) setMes(e.target.value); }}>
          <option value="">Selecionar mês registrado…</option>{meses.map(item => <option key={item} value={item}>{rotuloMes(item)}</option>)}
        </select></label>
        <label><span>Pesquisar cliente na consulta</span><input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome ou número do cadastro" /></label>
        <button type="button" className="button secondary" disabled={carregando} onClick={() => setTentativa(v => v + 1)}>Atualizar consulta</button>
      </div>
      {erro && <p role="alert">{erro} <button type="button" onClick={() => setTentativa(v => v + 1)}>Tentar novamente</button></p>}
      {carregando ? <p role="status">Consultando registros…</p> : painel && <>
        <p className="consulta-meses-contagem">{rotuloMes(mes)} · {registros.length} registro(s)</p>
        <div className="consulta-meses-tabela"><table aria-label="Registros do mês consultado">
          <thead><tr><th>Cadastro</th><th>Cliente</th><th>Estado</th><th>Observação no Excel</th><th>Histórico</th></tr></thead>
          <tbody>{registros.map(item => <tr key={item.id}>
            <td>#{item.cliente.id}</td><td>{item.cliente.nome}</td><td>{estados[item.status]}</td>
            <td>{excel?.estado?.registros[mes]?.[chaves.get(item.cliente.id) ?? '']?.observacao || '—'}</td>
            <td><button type="button" className="button secondary" disabled={lendoHistorico} onClick={() => void abrirHistorico(item.id, item.cliente.nome)} aria-label={`Consultar histórico de ${item.cliente.nome}`}>Consultar</button></td>
          </tr>)}</tbody>
        </table></div>
        {registros.length === 0 && <p>Nenhum registro encontrado para esta consulta.</p>}
      </>}
      {lendoHistorico && <p role="status">Carregando histórico…</p>}
      {historico && <section className="consulta-meses-historico" aria-label={`Histórico de ${historico.nome}`}>
        <h3>Histórico de {historico.nome}</h3>
        {historico.eventos.length === 0 ? <p>Nenhuma atividade registrada.</p> : <ol>{historico.eventos.map(evento => <li key={evento.id}>
          <time>{new Date(evento.criadoEm).toLocaleString('pt-BR')}</time> — {tipos[evento.tipo]} · {evento.autor || 'Equipe'}: {valorHistorico(evento.valorAnterior)} → {valorHistorico(evento.valorNovo)}
        </li>)}</ol>}
      </section>}
      <footer><button type="button" className="button secondary" onClick={aoFechar}>Fechar consulta</button></footer>
    </dialog>
  );
}
