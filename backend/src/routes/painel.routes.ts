import { Router } from "express";

import {
  listarCompetencias,
  obterPainelMensal,
} from "../controllers/painel.controller.ts";

export const painelRouter = Router();

painelRouter.get("/competencias", listarCompetencias);
painelRouter.get("/", obterPainelMensal);
