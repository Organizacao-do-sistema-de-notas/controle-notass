import { estadoVazio, type EstadoExcel } from "./excel-compartilhado";

export function lerLegadoExcel() {
  const estado = estadoVazio();
  const originais: Record<string, string> = {};
  const avisos: string[] = [];
  const campos = {
    "controle-notas-excel-clientes": "clientesExtras",
    "controle-notas-excel-clientes-nomes": "nomesAlterados",
    "controle-notas-excel-clientes-apelidos": "nomesBusca",
    "controle-notas-excel-clientes-informacoes": "informacoesClientes",
    "controle-notas-excel-avisos": "avisosExtras",
  } as const;
  try {
    for (const chave of Object.keys(localStorage)) {
      const campo = campos[chave as keyof typeof campos];
      const mes = /^controle-notas-excel-registros-(\d{4}-(?:0[1-9]|1[0-2]))$/.exec(chave)?.[1];
      if (!campo && !mes) continue;
      const bruto = localStorage.getItem(chave);
      if (bruto === null) continue;
      originais[chave] = bruto;
      try {
        const valor: unknown = JSON.parse(bruto);
        if (mes) {
          if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw Error();
          estado.registros[mes] = valor as EstadoExcel["registros"][string];
        } else if (campo === "clientesExtras" || campo === "avisosExtras") {
          if (!Array.isArray(valor)) throw Error();
          Object.assign(estado, { [campo]: valor });
        } else {
          if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw Error();
          const pares = Object.entries(valor).filter(([, item]) => campo === "nomesBusca" ? Array.isArray(item) && item.every(nome => typeof nome === "string") : typeof item === "string");
          if (pares.length !== Object.keys(valor).length) avisos.push(chave);
          Object.assign(estado, { [campo!]: Object.fromEntries(pares) });
        }
      } catch { avisos.push(chave); }
    }
  } catch { avisos.push("armazenamento do navegador indisponível"); }
  const serializado = JSON.stringify(originais);
  let hash = 2166136261;
  for (let i = 0; i < serializado.length; i++) hash = Math.imul(hash ^ serializado.charCodeAt(i), 16777619);
  return { estado, originais, avisos, assinatura: `${serializado.length}:${hash >>> 0}`, temDados: Object.keys(originais).length > 0 };
}

export function baixarCopiaLocal(originais: Record<string, string>) {
  const blob = new Blob([JSON.stringify({ versao: 1, exportadoEm: new Date().toISOString(), dadosLocais: originais }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a"); link.href = url; link.download = "controle-notas-dados-locais.json";
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
