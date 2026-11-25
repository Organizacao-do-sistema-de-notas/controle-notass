import type { Prisma } from '../../generated/prisma/client.ts';
import { bloquearCliente } from './historico-contabilidade.service.ts';

// Status, observation and message updates share the same row lock. Read the
// previous value only after acquiring it so history reflects the actual order.
export async function bloquearPendencia(tx: Prisma.TransactionClient, id: number) {
  const referencia = await tx.pendencia.findUnique({ where: { id }, select: { clienteId: true } });
  if (!referencia || !await bloquearCliente(tx, referencia.clienteId)) return null;
  await tx.$queryRaw`SELECT "id" FROM "Pendencia" WHERE "id" = ${id} FOR UPDATE`;
  return tx.pendencia.findUnique({ where: { id } });
}

export const relacoesPendencia = {
  cliente: { include: { contabilidade: true } },
  historico: { orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }] },
} satisfies Prisma.PendenciaInclude;
