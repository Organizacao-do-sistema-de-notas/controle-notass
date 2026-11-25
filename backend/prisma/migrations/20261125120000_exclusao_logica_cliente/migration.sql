-- Keep the client and every related history; exclusion only hides it from use.
ALTER TABLE "Cliente" ADD COLUMN "excluidoEm" TIMESTAMP(3);
