-- Acrescenta dados permanentes dos clientes sem excluir ou modificar cadastros existentes.
CREATE TYPE "FrequenciaAcesso" AS ENUM ('NAO_DEFINIDA', 'MENSAL', 'EVENTUAL');

ALTER TABLE "Cliente"
  ADD COLUMN "frequenciaAcesso" "FrequenciaAcesso" NOT NULL DEFAULT 'NAO_DEFINIDA',
  ADD COLUMN "observacoesPermanentes" TEXT,
  ADD COLUMN "modeloMensagem" TEXT;

CREATE TABLE "ClienteNomeAlternativo" (
  "id" SERIAL NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "nome" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClienteNomeAlternativo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProcedimentoCliente" (
  "id" SERIAL NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "titulo" TEXT NOT NULL,
  "descricao" TEXT NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProcedimentoCliente_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HistoricoContabilidadeCliente" (
  "id" SERIAL NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "nomeAnterior" TEXT,
  "nomeNova" TEXT,
  "autor" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HistoricoContabilidadeCliente_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClienteNomeAlternativo_clienteId_nome_key" ON "ClienteNomeAlternativo"("clienteId", "nome");
CREATE INDEX "ProcedimentoCliente_clienteId_ativo_idx" ON "ProcedimentoCliente"("clienteId", "ativo");
CREATE INDEX "HistoricoContabilidadeCliente_clienteId_criadoEm_idx" ON "HistoricoContabilidadeCliente"("clienteId", "criadoEm");

ALTER TABLE "ClienteNomeAlternativo"
  ADD CONSTRAINT "ClienteNomeAlternativo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcedimentoCliente"
  ADD CONSTRAINT "ProcedimentoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HistoricoContabilidadeCliente"
  ADD CONSTRAINT "HistoricoContabilidadeCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
