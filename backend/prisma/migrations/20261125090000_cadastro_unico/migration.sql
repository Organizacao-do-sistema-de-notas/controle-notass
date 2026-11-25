-- Preserve existing clients and histories; NULL means no additional information yet.
ALTER TABLE "Cliente" ADD COLUMN "informacoesAdicionais" TEXT;
