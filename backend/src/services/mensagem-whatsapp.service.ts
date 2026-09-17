export function normalizarMensagemContador(valor: string): string {
  return valor
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((linha) => linha.trimEnd())
    .join("\n")
    .trim();
}

export function gerarLinkWhatsApp(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`;
}
