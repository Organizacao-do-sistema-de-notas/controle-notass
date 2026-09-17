import { Router } from "express";

import {
  obterMensagemContador,
  salvarMensagemContador,
} from "../controllers/mensagens.controller.ts";
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
pendenciasRouter.get("/:id/mensagem", obterMensagemContador);
pendenciasRouter.put("/:id/mensagem", salvarMensagemContador);
pendenciasRouter.get("/:id", buscarPendenciaPorId);
pendenciasRouter.post("/", criarPendencia);
pendenciasRouter.patch("/:id", atualizarPendencia);
