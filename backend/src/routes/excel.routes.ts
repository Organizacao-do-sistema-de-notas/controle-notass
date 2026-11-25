import { Router } from "express";
import { acessarCadastro } from "../excel/cadastro-unico.ts";
import { ConflitoExcel, DadosExcelInvalidos, validarAlteracoes, validarEstado } from "../excel/estado.ts";

export const excelRouter = Router();
excelRouter.use((_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });

async function falhar(erro: unknown, res: import("express").Response) {
  if (erro instanceof DadosExcelInvalidos) { res.status(400).json({ erro: erro.message }); return; }
  if (erro instanceof ConflitoExcel) {
    const atual = await acessarCadastro();
    res.status(409).json({ erro: erro.message, ...atual, caminhos: erro.caminhos }); return;
  }
  console.error("Erro no cadastro compartilhado:", erro);
  res.status(500).json({ erro: "Não foi possível acessar os dados compartilhados. Os dados não foram descartados." });
}

excelRouter.get("/estado", async (req, res) => {
  try {
    const atual = await acessarCadastro();
    const semAlteracoes = req.query.revisao === String(atual.revisao) && req.query.instancia === atual.instancia;
    res.json({ ...atual, estado: semAlteracoes ? null : atual.estado });
  } catch (erro) { await falhar(erro, res); }
});
for (const importar of [false, true]) {
  const handler = async (req: import("express").Request, res: import("express").Response) => {
    try {
      if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) throw new DadosExcelInvalidos("Requisição inválida.");
      const chave = importar ? "estado" : "alteracoes";
      if (Object.keys(req.body).some(nome => nome !== chave)) throw new DadosExcelInvalidos("Campos não reconhecidos na requisição.");
      res.json(await acessarCadastro(importar ? { importar: validarEstado(req.body.estado) } : { alteracoes: validarAlteracoes(req.body.alteracoes) }));
    } catch (erro) { await falhar(erro, res); }
  };
  if (importar) excelRouter.post("/importar", handler);
  else excelRouter.patch("/estado", handler);
}
