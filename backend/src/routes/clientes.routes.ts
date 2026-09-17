import { Router } from "express";

import {
  atualizarCliente,
  buscarClientePorId,
  criarCliente,
  listarClientes,
} from "../controllers/clientes.controller.ts";

export const clientesRouter = Router();

clientesRouter.get("/", listarClientes);
clientesRouter.get("/:id", buscarClientePorId);
clientesRouter.post("/", criarCliente);
clientesRouter.patch("/:id", atualizarCliente);
