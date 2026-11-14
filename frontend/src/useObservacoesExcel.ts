import { useCallback, useEffect, useRef, useState } from "react";
import { definir, type AlteracaoExcel, type EstadoExcel } from "./excel-compartilhado";

type Rascunho = { mes: string; cliente: string; texto: string; anterior: string; salvando: boolean; erro: string };
export const chaveObservacao = (mes: string, cliente: string) => JSON.stringify([mes, cliente]);
export function useObservacoesExcel(estado: EstadoExcel, executar: (ops: AlteracaoExcel[]) => Promise<void>, conectado: boolean) {
  const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
  const atuais = useRef(rascunhos); atuais.current = rascunhos;
  const pendente = Object.keys(rascunhos).length > 0;
  function alterar(mes: string, cliente: string, texto: string) {
    const chave = chaveObservacao(mes, cliente);
    setRascunhos(itens => ({ ...itens, [chave]: {
      mes, cliente, texto, anterior: itens[chave]?.anterior ?? estado.registros[mes]?.[cliente]?.observacao ?? "",
      salvando: itens[chave]?.salvando ?? false, erro: itens[chave]?.erro ?? "",
    } }));
  }
  const salvar = useCallback(async (chave: string, rascunho: Rascunho) => {
    setRascunhos(itens => ({ ...itens, [chave]: { ...itens[chave], salvando: true } }));
    try {
      await executar([definir(["registro", rascunho.mes, rascunho.cliente, "observacao"], rascunho.texto, rascunho.anterior)]);
      setRascunhos(itens => {
        const proximo = { ...itens };
        if (itens[chave]?.texto === rascunho.texto) delete proximo[chave];
        else if (itens[chave]) proximo[chave] = { ...itens[chave], anterior: rascunho.texto, salvando: false, erro: "" };
        return proximo;
      });
    } catch (e) {
      setRascunhos(itens => ({ ...itens, [chave]: { ...itens[chave], salvando: false, erro: e instanceof Error ? e.message : "Não foi possível salvar esta observação." } }));
    }
  }, [executar]);
  useEffect(() => {
    if (!conectado) return;
    const timers = Object.entries(rascunhos).filter(([, item]) => !item.salvando && !item.erro).map(([chave, item]) =>
      window.setTimeout(() => { if (!atuais.current[chave]?.salvando) void salvar(chave, item); }, 450));
    return () => timers.forEach(clearTimeout);
  }, [rascunhos, conectado, salvar]);
  function repetir(chave: string) {
    setRascunhos(itens => {
      const item = itens[chave];
      return item ? { ...itens, [chave]: { ...item, anterior: estado.registros[item.mes]?.[item.cliente]?.observacao ?? "", erro: "", salvando: false } } : itens;
    });
  }
  function descartar(chave: string) { setRascunhos(itens => { const proximo = { ...itens }; delete proximo[chave]; return proximo; }); }
  return { rascunhos, alterar, repetir, descartar, pendente };
}
