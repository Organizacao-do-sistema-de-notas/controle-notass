import { Router } from "express";

import { gerarMensagemWhatsApp } from "../controllers/mensagens.controller.ts";
import {
  atualizarPendencia,
  buscarPendenciaPorId,
  criarPendencia,
  listarHistoricoPendencia,
  listarPendencias,
} from "../controllers/pendencias.controller.ts";

export const pendenciasRouter = Router();

pendenciasRouter.get("/", listarPendencias);
pendenciasRouter.get("/:id/historico", listarHistoricoPendencia);
pendenciasRouter.get("/:id/mensagem", gerarMensagemWhatsApp);
pendenciasRouter.get("/:id", buscarPendenciaPorId);
pendenciasRouter.post("/", criarPendencia);
pendenciasRouter.patch("/:id", atualizarPendencia);
