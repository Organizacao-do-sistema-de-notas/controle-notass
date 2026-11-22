import type { Prisma } from '../../generated/prisma/client.ts';

// Status, observation and message updates share the same row lock. Read the
// previous value only after acquiring it so history reflects the actual order.
export async function bloquearPendencia(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT "id" FROM "Pendencia" WHERE "id" = ${id} FOR UPDATE`;
  return tx.pendencia.findUnique({ where: { id } });
}

export const relacoesPendencia = {
  cliente: { include: { contabilidade: true } },
  historico: { orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }] },
} satisfies Prisma.PendenciaInclude;
