import { Router } from "express";
import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { Prisma } from "../../generated/prisma/client.ts";
import { prisma } from "../lib/prisma.ts";
import { aplicarAlteracoes, ConflitoExcel, DadosExcelInvalidos, estadoVazio, importarAusentes, validarAlteracoes, validarEstado } from "../excel/estado.ts";

export const excelRouter = Router();
const id = "principal";
const json = (valor: unknown) => valor as Prisma.InputJsonValue;
const resposta = (registro: { instancia: string; revisao: number; dados: unknown } | null) => ({
  instancia: registro?.instancia ?? null, revisao: registro?.revisao ?? 0,
  estado: registro ? validarEstado(registro.dados) : estadoVazio(),
});
excelRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
excelRouter.get("/estado", async (req, res) => {
  try {
    const meta = await prisma.excelCompartilhado.findUnique({ where: { id }, select: { revisao: true, instancia: true } });
    if (meta && req.query.revisao === String(meta.revisao) && req.query.instancia === meta.instancia) {
      res.json({ ...meta, estado: null }); return;
    }
    res.json(resposta(await prisma.excelCompartilhado.findUnique({ where: { id } })));
  } catch (erro) { console.error("Erro ao ler controle compartilhado:", erro); res.status(500).json({ erro: "Não foi possível ler os dados compartilhados." }); }
});
for (const importar of [false, true]) {
  const handler = async (req: import("express").Request, res: import("express").Response) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new DadosExcelInvalidos("Requisição inválida.");
      const chave = importar ? "estado" : "alteracoes";
      if (Object.keys(req.body).some(nome => nome !== chave)) throw new DadosExcelInvalidos("Campos não reconhecidos na requisição.");
      const estadoLocal = importar ? validarEstado(req.body.estado) : null;
      const alteracoes = importar ? [] : validarAlteracoes(req.body.alteracoes);
      const resultado = await prisma.$transaction(async tx => {
        const instancia = randomUUID();
        const inicial = JSON.stringify(estadoVazio());
        await tx.$executeRaw`INSERT INTO "ExcelCompartilhado" ("id", "instancia", "dados", "revisao") VALUES (${id}, ${instancia}, ${inicial}::jsonb, 0) ON CONFLICT ("id") DO NOTHING`;
        await tx.$queryRaw`SELECT "id" FROM "ExcelCompartilhado" WHERE "id" = ${id} FOR UPDATE`;
        const registro = await tx.excelCompartilhado.findUniqueOrThrow({ where: { id } });
        const atual = validarEstado(registro.dados);
        const lote = estadoLocal ? importarAusentes(atual, estadoLocal) : { estado: aplicarAlteracoes(atual, alteracoes), importados: 0, conflitos: [] };
        const mudou = !isDeepStrictEqual(atual, lote.estado);
        const salvo = mudou ? await tx.excelCompartilhado.update({ where: { id }, data: { dados: json(lote.estado), revisao: { increment: 1 } } }) : registro;
        return { ...resposta(salvo), ...(importar ? { importados: lote.importados, totalConflitos: lote.conflitos.length, conflitos: lote.conflitos.slice(0, 500) } : {}) };
      });
      res.json(resultado);
    } catch (erro) {
      if (erro instanceof DadosExcelInvalidos) { res.status(400).json({ erro: erro.message }); return; }
      if (erro instanceof ConflitoExcel) {
        const registro = await prisma.excelCompartilhado.findUnique({ where: { id } });
        res.status(409).json({ erro: erro.message, ...resposta(registro), caminhos: erro.caminhos }); return;
      }
      console.error("Erro ao salvar controle compartilhado:", erro);
      res.status(500).json({ erro: "Não foi possível salvar os dados compartilhados. O texto não foi descartado." });
    }
  };
  if (importar) excelRouter.post("/importar", handler);
  else excelRouter.patch("/estado", handler);
}
