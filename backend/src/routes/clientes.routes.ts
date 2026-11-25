import { Router } from "express";

import {
  atualizarCliente,
  buscarClientePorId,
  criarCliente,
  excluirCliente,
  listarClientes,
} from "../controllers/clientes.controller.ts";

import {
  atualizarFichaCliente,
  atualizarProcedimentoCliente,
  criarProcedimentoCliente,
  obterFichaCliente,
} from "../controllers/fichas.controller.ts";

export const clientesRouter = Router();

clientesRouter.get("/", listarClientes);
clientesRouter.get("/:id", buscarClientePorId);
clientesRouter.post("/", criarCliente);
clientesRouter.patch("/:id", atualizarCliente);
clientesRouter.delete("/:id", excluirCliente);

clientesRouter.get("/:id/ficha", obterFichaCliente);
clientesRouter.patch("/:id/ficha", atualizarFichaCliente);
clientesRouter.post("/:id/procedimentos", criarProcedimentoCliente);
clientesRouter.patch("/:id/procedimentos/:procedimentoId", atualizarProcedimentoCliente);
