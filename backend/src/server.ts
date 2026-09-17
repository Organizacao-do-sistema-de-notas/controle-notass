import { config } from "dotenv";
import cors from "cors";
import express from "express";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { prisma } from "./lib/prisma.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(currentDir, "../../.env"),
});

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    mensagem: "API Controle Notass funcionando!",
  });
});

app.get("/clientes", async (_req, res) => {
  try {
    const clientes = await prisma.cliente.findMany({
      include: {
        contabilidade: true,
      },
      orderBy: {
        nome: "asc",
      },
    });

    res.json(clientes);
  } catch (erro) {
    console.error("Erro ao buscar clientes:", erro);

    res.status(500).json({
      erro: "Erro ao buscar clientes.",
    });
  }
});

app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});
