-- CreateEnum
CREATE TYPE "TipoHistoricoPendencia" AS ENUM ('CRIACAO', 'STATUS', 'RESPONSAVEL', 'OBSERVACAO');

-- CreateTable
CREATE TABLE "HistoricoPendencia" (
    "id" SERIAL NOT NULL,
    "pendenciaId" INTEGER NOT NULL,
    "tipo" "TipoHistoricoPendencia" NOT NULL,
    "valorAnterior" TEXT,
    "valorNovo" TEXT,
    "autor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoPendencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoricoPendencia_pendenciaId_criadoEm_idx" ON "HistoricoPendencia"("pendenciaId", "criadoEm");

-- AddForeignKey
ALTER TABLE "HistoricoPendencia" ADD CONSTRAINT "HistoricoPendencia_pendenciaId_fkey" FOREIGN KEY ("pendenciaId") REFERENCES "Pendencia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
