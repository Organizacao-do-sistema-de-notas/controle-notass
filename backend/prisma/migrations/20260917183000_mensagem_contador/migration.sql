ALTER TYPE "TipoHistoricoPendencia" ADD VALUE 'MENSAGEM_CONTADOR';

ALTER TABLE "Pendencia"
ADD COLUMN "mensagemContador" TEXT;
