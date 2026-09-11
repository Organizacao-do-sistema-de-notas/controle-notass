import "dotenv/config";

import { PrismaClient } from "../generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  const cliente = await prisma.cliente.create({
    data: {
      nome: "Mercado Teste",
    },
  });

  console.log("Cliente criado:");
  console.log(cliente);

  const clientes = await prisma.cliente.findMany();

  console.log("\nClientes cadastrados:");
  console.log(clientes);
}

main()
  .catch((erro) => {
    console.error("Erro:", erro);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });