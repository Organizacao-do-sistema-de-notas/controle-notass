import { useEffect, useMemo, useState } from "react";
import { listarClientes } from "./api";
import type { Cliente } from "./types";
import "./vinculo-ficha.css";

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

export function SelecionarFichaCliente({ valor, aoAlterar }: {
  valor: number | null;
  aoAlterar: (id: number | null) => void;
}) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    setCarregando(true); setErro("");
    listarClientes().then(lista => { if (ativo) setClientes(lista); })
      .catch(e => { if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível carregar as fichas."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [tentativa]);
  const opcoes = useMemo(() => {
    const termo = normalizar(busca);
    return clientes.filter(cliente => cliente.id === valor || !termo || [cliente.nome, String(cliente.id), cliente.confere?.codigo ?? "", ...(cliente.nomesAlternativos?.map(item => item.nome) ?? [])].some(nome => normalizar(nome).includes(termo)));
  }, [busca, clientes, valor]);
  const selecionado = clientes.find(cliente => cliente.id === valor);
  return (
    <section className="excel-vinculo-ficha" aria-label="Vínculo com ficha do cliente">
      <strong>Ficha do cliente</strong>
      <p>Escolha a ficha correta para esta linha. O vínculo preserva os nomes, informações e registros mensais do Excel.</p>
      <label className="excel-form-field"><span>Buscar ficha para vincular</span>
        <input value={busca} onChange={evento => setBusca(evento.target.value)} placeholder="Nome, apelido ou código do cadastro" />
      </label>
      <label className="excel-form-field"><span>Ficha vinculada</span>
        <select value={valor ?? ""} disabled={carregando || !!erro} onChange={evento => aoAlterar(evento.target.value ? Number(evento.target.value) : null)}>
          <option value="">Sem ficha vinculada</option>
          {valor !== null && !clientes.some(cliente => cliente.id === valor) && <option value={valor}>Ficha #{valor} (vínculo atual)</option>}
          {opcoes.map(cliente => <option key={cliente.id} value={cliente.id}>Cadastro #{cliente.id}{cliente.confere ? ` · Confere #${cliente.confere.codigo}` : ""} — {cliente.nome}{!cliente.ativo ? " · Inativo" : ""}</option>)}
        </select>
      </label>
      {selecionado && <p>Ficha selecionada: {selecionado.nome}</p>}
      {carregando && <p>Carregando fichas...</p>}
      {erro && <div><p role="alert">{erro}</p><button type="button" className="excel-action-button" onClick={() => setTentativa(atual => atual + 1)}>Tentar carregar fichas novamente</button></div>}
      {!carregando && !erro && !clientes.length && <p>Cadastre o cliente no menu ⋯ → Clientes para poder vinculá-lo.</p>}
      <small>Selecione “Sem ficha vinculada” para desvincular. A mudança só é gravada em Salvar alteração.</small>
    </section>
  );
}
