-- CreateEnum
CREATE TYPE "StatusPendencia" AS ENUM ('PENDENTE', 'AGUARDANDO_CLIENTE', 'EM_ATENDIMENTO', 'CONCLUIDO');

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "contabilidadeId" INTEGER,
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Contabilidade" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contabilidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pendencia" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "competencia" TEXT NOT NULL,
    "status" "StatusPendencia" NOT NULL DEFAULT 'PENDENTE',
    "responsavel" TEXT,
    "observacao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "concluidoEm" TIMESTAMP(3),

    CONSTRAINT "Pendencia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pendencia_clienteId_competencia_key" ON "Pendencia"("clienteId", "competencia");

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_contabilidadeId_fkey" FOREIGN KEY ("contabilidadeId") REFERENCES "Contabilidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pendencia" ADD CONSTRAINT "Pendencia_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
