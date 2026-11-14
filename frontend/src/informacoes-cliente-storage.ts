export const CHAVE_INFORMACOES_CLIENTES = "controle-notas-excel-clientes-informacoes";
export const LIMITE_INFORMACOES_CLIENTE = 20000;

export function lerInformacoesClientes(): Record<string, string> {
  try {
    const valor: unknown = JSON.parse(localStorage.getItem(CHAVE_INFORMACOES_CLIENTES) || "{}");
    if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
    return Object.fromEntries(Object.entries(valor).filter(([, texto]) => typeof texto === "string"));
  } catch { return {}; }
}

// The client form changes several local keys. Restore previous values if a
// write fails, and keep the form open so the user can preserve the typed text.
export function salvarDadosClienteLocal(atualizacoes: Record<string, unknown>) {
  const anteriores = new Map<string, string | null>();
  const gravados: string[] = [];
  try {
    for (const chave of Object.keys(atualizacoes)) anteriores.set(chave, localStorage.getItem(chave));
    for (const [chave, valor] of Object.entries(atualizacoes)) {
      localStorage.setItem(chave, JSON.stringify(valor));
      gravados.push(chave);
    }
  } catch {
    let restaurado = true;
    for (const chave of gravados.reverse()) {
      try {
        const anterior = anteriores.get(chave);
        if (anterior === null || anterior === undefined) localStorage.removeItem(chave);
        else localStorage.setItem(chave, anterior);
      } catch { restaurado = false; }
    }
    throw new Error(restaurado
      ? "Não foi possível salvar neste navegador. Os campos foram mantidos para você tentar novamente ou copiar o texto."
      : "Não foi possível concluir a gravação. Copie o texto e confira os dados antes de tentar novamente.");
  }
}
