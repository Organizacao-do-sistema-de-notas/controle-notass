CREATE TABLE "ExcelCompartilhado" (
    "id" TEXT NOT NULL,
    "instancia" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "revisao" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExcelCompartilhado_pkey" PRIMARY KEY ("id")
);
