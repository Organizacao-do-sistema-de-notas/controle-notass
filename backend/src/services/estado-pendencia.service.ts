import type { Prisma, Pendencia } from '../../generated/prisma/client.ts';
import type { StatusPendencia } from '../../generated/prisma/enums.ts';
import type { StatusExcel } from '../excel/estado.ts';

export const estadoDoPainel: Record<StatusExcel, StatusPendencia> = {
  PENDENTE: 'PENDENTE', AGUARDANDO: 'AGUARDANDO_CLIENTE', EM_ATENDIMENTO: 'EM_ATENDIMENTO', OK: 'CONCLUIDO',
};
export const estadoDoExcel: Record<StatusPendencia, StatusExcel> = {
  PENDENTE: 'PENDENTE', AGUARDANDO_CLIENTE: 'AGUARDANDO', EM_ATENDIMENTO: 'EM_ATENDIMENTO', CONCLUIDO: 'OK',
};

// The caller holds Cliente/Pendencia locks throughout this transaction.
export async function gravarEstadoPendencia(tx: Prisma.TransactionClient, existente: Pendencia, status: StatusPendencia, autor: string | null = null, instante = new Date()) {
  if (status === existente.status) return;
  await tx.pendencia.update({ where: { id: existente.id }, data: {
    status, concluidoEm: status === 'CONCLUIDO' ? existente.concluidoEm ?? instante : null,
  } });
  await tx.historicoPendencia.create({ data: {
    pendenciaId: existente.id, tipo: 'STATUS', valorAnterior: existente.status, valorNovo: status, autor, criadoEm: instante,
  } });
}
