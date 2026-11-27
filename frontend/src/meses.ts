export function mesAtual(): string {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

export function deslocarMes(mes: string, quantidade: number): string {
  const [ano, numero] = mes.split("-").map(Number);
  const data = new Date(ano, numero - 1 + quantidade, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function mesesRapidos(referencia = mesAtual()): string[] {
  return Array.from({ length: 13 }, (_, indice) => deslocarMes(referencia, indice - 6));
}

export function competenciaRapida(valor: string | null): string {
  return valor && mesesRapidos().includes(valor) ? valor : mesAtual();
}

export function rotuloMes(mes: string): string {
  const [ano, numero] = mes.split("-").map(Number);
  const nome = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date(ano, numero - 1, 1));
  return `${nome.charAt(0).toUpperCase()}${nome.slice(1)}/${String(ano).slice(-2)}`;
}
