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
  // 1. Criar uma contabilidade
  const contabilidade = await prisma.contabilidade.create({
    data: {
      nome: "Contabilidade Teste",
    },
  });

  console.log("Contabilidade criada:");
  console.log(contabilidade);

  // 2. Criar um cliente ligado à contabilidade
  const cliente = await prisma.cliente.create({
    data: {
      nome: "Mercado Avenida",
      contabilidadeId: contabilidade.id,
    },
  });

  console.log("\nCliente criado:");
  console.log(cliente);

  // 3. Criar uma pendência para esse cliente
  const pendencia = await prisma.pendencia.create({
    data: {
      clienteId: cliente.id,
      competencia: "2026-09",
      status: "AGUARDANDO_CLIENTE",
      responsavel: "Guilherme",
      observacao: "Aguardando cliente liberar acesso.",
    },
  });

  console.log("\nPendência criada:");
  console.log(pendencia);

  // 4. Buscar a pendência trazendo cliente e contabilidade juntos
  const pendencias = await prisma.pendencia.findMany({
    include: {
      cliente: {
        include: {
          contabilidade: true,
        },
      },
    },
  });

  console.log("\nPendências cadastradas:");
  console.dir(pendencias, { depth: null });
}

main()
  .catch((erro) => {
    console.error("Erro:");
    console.error(erro);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });