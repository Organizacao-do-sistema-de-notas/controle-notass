-- Add source mappings without changing existing customers or accounting firms.
CREATE TABLE "ClienteConfere" (
  "codigo" TEXT NOT NULL,
  "clienteId" INTEGER NOT NULL,
  "dadosOrigem" JSONB NOT NULL,
  "hashOrigem" TEXT NOT NULL,
  "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClienteConfere_pkey" PRIMARY KEY ("codigo")
);
CREATE UNIQUE INDEX "ClienteConfere_clienteId_key" ON "ClienteConfere"("clienteId");
ALTER TABLE "ClienteConfere" ADD CONSTRAINT "ClienteConfere_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ContabilidadeConfere" (
  "codigo" TEXT NOT NULL,
  "grupo" TEXT NOT NULL,
  "nomeOrigem" TEXT NOT NULL,
  "contabilidadeId" INTEGER NOT NULL,
  "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContabilidadeConfere_pkey" PRIMARY KEY ("codigo")
);
CREATE INDEX "ContabilidadeConfere_grupo_idx" ON "ContabilidadeConfere"("grupo");
CREATE INDEX "ContabilidadeConfere_contabilidadeId_idx" ON "ContabilidadeConfere"("contabilidadeId");
ALTER TABLE "ContabilidadeConfere" ADD CONSTRAINT "ContabilidadeConfere_contabilidadeId_fkey"
  FOREIGN KEY ("contabilidadeId") REFERENCES "Contabilidade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
