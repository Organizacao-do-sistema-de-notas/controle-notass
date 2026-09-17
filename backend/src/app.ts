import cors from "cors";
import express from "express";

import { clientesRouter } from "./routes/clientes.routes.ts";
import { contabilidadesRouter } from "./routes/contabilidades.routes.ts";
import { pendenciasRouter } from "./routes/pendencias.routes.ts";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    mensagem: "API Controle Notass funcionando!",
  });
});

app.use("/clientes", clientesRouter);
app.use("/contabilidades", contabilidadesRouter);
app.use("/pendencias", pendenciasRouter);

app.use((_req, res) => {
  res.status(404).json({
    erro: "Rota não encontrada.",
  });
});
