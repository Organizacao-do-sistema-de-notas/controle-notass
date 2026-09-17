import { Router } from "express";

import {
  atualizarPendencia,
  buscarPendenciaPorId,
  criarPendencia,
  listarPendencias,
} from "../controllers/pendencias.controller.ts";

export const pendenciasRouter = Router();

pendenciasRouter.get("/", listarPendencias);
pendenciasRouter.get("/:id", buscarPendenciaPorId);
pendenciasRouter.post("/", criarPendencia);
pendenciasRouter.patch("/:id", atualizarPendencia);
