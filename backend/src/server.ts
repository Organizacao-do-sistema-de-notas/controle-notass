import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { app } from "./app.ts";
import { prisma } from "./lib/prisma.ts";

const currentDir = dirname(fileURLToPath(import.meta.url));

config({
  path: resolve(currentDir, "../../.env"),
});

const portaConfigurada = Number(process.env.PORT);
const port = Number.isInteger(portaConfigurada) && portaConfigurada > 0 ? portaConfigurada : 3000;

const server = app.listen(port, () => {
  console.log(`Servidor rodando em http://localhost:${port}`);
});

async function encerrarServidor(sinal: string): Promise<void> {
  console.log(`\n${sinal} recebido. Encerrando servidor...`);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  void encerrarServidor("SIGINT");
});

process.on("SIGTERM", () => {
  void encerrarServidor("SIGTERM");
});
