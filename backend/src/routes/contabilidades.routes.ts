import { Router } from "express";

import {
  atualizarContabilidade,
  criarContabilidade,
  listarContabilidades,
} from "../controllers/contabilidades.controller.ts";

export const contabilidadesRouter = Router();

contabilidadesRouter.get("/", listarContabilidades);
contabilidadesRouter.post("/", criarContabilidade);
contabilidadesRouter.patch("/:id", atualizarContabilidade);
