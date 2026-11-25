import { useCallback, useEffect, useRef, useState } from "react";
import { alterarExcel, consultarExcel, ErroExcel, estadoVazio, importarExcel, type AlteracaoExcel, type ImportacaoExcel, type RespostaExcel } from "./excel-compartilhado";
import { lerLegadoExcel } from "./excel-legado";

const chaveImportacao = "controle-notas-excel-importacao-compartilhada";
export function useExcelCompartilhado() {
  const [snapshot, setSnapshot] = useState<RespostaExcel>({ instancia: null, revisao: 0, estado: estadoVazio() });
  const atual = useRef(snapshot);
  const carregadoRef = useRef(false);
  const ativo = useRef(true);
  const fila = useRef<Promise<unknown>>(Promise.resolve());
  const geracaoLeitura = useRef(0);
  const [carregado, setCarregado] = useState(false);
  const [conectado, setConectado] = useState(false);
  const [erro, setErro] = useState("");
  const [erroImportacao, setErroImportacao] = useState("");
  const [gravando, setGravando] = useState(0);
  const [legado] = useState(lerLegadoExcel);
  const [assinaturaImportada, setAssinaturaImportada] = useState(() => { try { return localStorage.getItem(chaveImportacao) || ""; } catch { return ""; } });
  const [resultadoImportacao, setResultadoImportacao] = useState<ImportacaoExcel | null>(null);
  const aplicar = useCallback((resposta: RespostaExcel) => {
    if (!ativo.current) return;
    if (resposta.estado && (!carregadoRef.current || resposta.instancia !== atual.current.instancia || resposta.revisao > atual.current.revisao)) {
      atual.current = resposta; setSnapshot(resposta);
    }
    carregadoRef.current = true; setCarregado(true); setConectado(true); setErro("");
  }, []);
  const atualizar = useCallback(async () => {
    const geracao = geracaoLeitura.current;
    try { const resposta = await consultarExcel(carregadoRef.current ? atual.current : undefined); if (geracao === geracaoLeitura.current) aplicar(resposta); }
    catch (e) { if (ativo.current && geracao === geracaoLeitura.current) { setConectado(false); setErro(e instanceof ErroExcel && e.status === 400 ? e.message : "Não foi possível acessar os dados compartilhados. Confira a conexão com o notebook e tente novamente."); } }
  }, [aplicar]);
  useEffect(() => {
    ativo.current = true;
    void atualizar();
    const timer = window.setInterval(() => { if (!document.hidden) void atualizar(); }, 2000);
    const aoVoltar = () => { if (!document.hidden) void atualizar(); };
    window.addEventListener("focus", aoVoltar); document.addEventListener("visibilitychange", aoVoltar);
    return () => { ativo.current = false; clearInterval(timer); window.removeEventListener("focus", aoVoltar); document.removeEventListener("visibilitychange", aoVoltar); };
  }, [atualizar]);
  const executar = useCallback(async (alteracoes: AlteracaoExcel[]) => {
    setGravando(valor => valor + 1);
    const tarefa = fila.current.catch(() => {}).then(() => { geracaoLeitura.current++; return alterarExcel(alteracoes); });
    fila.current = tarefa.catch(() => {});
    try { aplicar(await tarefa); }
    catch (e) { if (e instanceof ErroExcel && e.resposta) aplicar(e.resposta); throw e; }
    finally { if (ativo.current) setGravando(valor => valor - 1); }
  }, [aplicar]);
  async function importar() {
    setGravando(valor => valor + 1); setErroImportacao("");
    try {
      const tarefa = fila.current.catch(() => {}).then(() => { geracaoLeitura.current++; return importarExcel(legado.estado); });
      fila.current = tarefa.catch(() => {});
      const resultado = await tarefa;
      aplicar(resultado); setResultadoImportacao(resultado);
      const marcador = `${resultado.instancia}:${legado.assinatura}`;
      try { localStorage.setItem(chaveImportacao, marcador); } catch { /* Original local keys remain untouched. */ }
      setAssinaturaImportada(marcador);
    } catch (e) { setErroImportacao(e instanceof Error ? e.message : "Não foi possível importar os dados locais."); }
    finally { setGravando(valor => valor - 1); }
  }
  return { estado: snapshot.estado!, snapshot, carregado, conectado, erro, erroImportacao, gravando, atualizar, executar, importar, legado, resultadoImportacao,
    temLegadoPendente: legado.temDados && assinaturaImportada !== `${snapshot.instancia}:${legado.assinatura}` };
}
