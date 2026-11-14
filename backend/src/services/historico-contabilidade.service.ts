import type { Prisma } from '../../generated/prisma/client.ts';

// Serialize reads and writes for this client so concurrent changes cannot record
// the same stale previous accounting firm. Both client update routes use this lock.
export async function bloquearCliente(tx: Prisma.TransactionClient, id: number) {
  await tx.$queryRaw`SELECT "id" FROM "Cliente" WHERE "id" = ${id} FOR UPDATE`;
  return tx.cliente.findUnique({ where: { id }, include: { contabilidade: true } });
}

type Vinculo = {
  id: number;
  contabilidadeId: number | null;
  contabilidade: { nome: string } | null;
};

export async function registrarTrocaContabilidade(
  tx: Prisma.TransactionClient, anterior: Vinculo, atual: Vinculo, autor?: string,
) {
  if (anterior.contabilidadeId === atual.contabilidadeId) return;
  await tx.historicoContabilidadeCliente.create({
    data: {
      clienteId: atual.id,
      // PostgreSQL NOW() uses transaction start time, before the row lock.
      // Record the actual change time to keep concurrent history in order.
      criadoEm: new Date(),
      nomeAnterior: anterior.contabilidade?.nome ?? null,
      nomeNova: atual.contabilidade?.nome ?? null,
      autor: autor?.trim() || null,
    },
  });
}

export class ContabilidadeNaoEncontrada extends Error {
  constructor() { super('Contabilidade não encontrada.'); }
}
