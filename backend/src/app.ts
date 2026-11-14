import cors from "cors";
import express from "express";
import type { ErrorRequestHandler } from "express";

import { clientesRouter } from "./routes/clientes.routes.ts";
import { contabilidadesRouter } from "./routes/contabilidades.routes.ts";
import { painelRouter } from "./routes/painel.routes.ts";
import { pendenciasRouter } from "./routes/pendencias.routes.ts";
import { excelRouter } from "./routes/excel.routes.ts";

export const app = express();

app.use(cors());
const erroExcel: ErrorRequestHandler = (erro, _req, res, _next) => {
  const status = erro?.type === "entity.too.large" ? 413 : erro instanceof SyntaxError ? 400 : 500;
  res.status(status).json({ erro: status === 413 ? "Os dados locais excedem o limite desta importação. Os originais continuam preservados." : status === 400 ? "JSON inválido." : "Não foi possível concluir a operação do controle compartilhado." });
};
app.use("/excel", express.json({ limit: "6mb" }), excelRouter, erroExcel);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    mensagem: "API Controle Notass funcionando!",
  });
});

app.use("/clientes", clientesRouter);
app.use("/contabilidades", contabilidadesRouter);
app.use("/painel", painelRouter);
app.use("/pendencias", pendenciasRouter);

app.use((_req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada.",
  });
});
