/** Exportação não destrutiva das informações da visualização Excel armazenadas no navegador.
 * O arquivo gerado permanece no computador do usuário; nada é enviado ao servidor.
 */
export interface BackupExcel {
  formato: "controle-notass-excel-localstorage";
  versao: 1;
  criadoEm: string;
  itens: Record<string, string>;
}

const PREFIXO = "controle-notas-excel-";

export function coletarBackupExcel(storage: Pick<Storage, "length" | "key" | "getItem">): BackupExcel {
  const itens: Record<string, string> = {};
  for (let indice = 0; indice < storage.length; indice += 1) {
    const chave = storage.key(indice);
    if (!chave || !chave.startsWith(PREFIXO)) continue;
    const valor = storage.getItem(chave);
    if (valor !== null) itens[chave] = valor;
  }
  return {
    formato: "controle-notass-excel-localstorage",
    versao: 1,
    criadoEm: new Date().toISOString(),
    itens,
  };
}

export function baixarBackupExcel(): number {
  const backup = coletarBackupExcel(window.localStorage);
  const quantidade = Object.keys(backup.itens).length;
  if (quantidade === 0) {
    throw new Error("Não há dados locais da visualização Excel para exportar neste navegador.");
  }
  const arquivo = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  const momento = backup.criadoEm.replace(/[:.]/g, "-");
  link.href = url;
  link.download = `controle-notass-backup-excel-${momento}.json`;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return quantidade;
}
