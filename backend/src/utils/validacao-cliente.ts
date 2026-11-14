const MAX_INT_POSTGRES = 2_147_483_647;

export function idValido(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor > 0 && valor <= MAX_INT_POSTGRES;
}

export function obterId(valor: unknown): number | null {
  if (typeof valor !== 'string' || !/^[0-9]+$/.test(valor)) return null;
  const id = Number(valor);
  return idValido(id) ? id : null;
}

export function corpoValido(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === 'object' && !Array.isArray(valor);
}
