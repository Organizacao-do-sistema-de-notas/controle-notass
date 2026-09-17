import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.ts";

function obterId(valor: string): number | null {
  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

export async function listarClientes(_req: Request, res: Response): Promise<void> {
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
    console.error("Erro ao listar clientes:", erro);
    res.status(500).json({ erro: "Erro ao listar clientes." });
  }
}

export async function buscarClientePorId(req: Request, res: Response): Promise<void> {
  const id = obterId(req.params.id);

  if (id === null) {
    res.status(400).json({ erro: "ID de cliente inválido." });
    return;
  }

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        contabilidade: true,
        pendencias: {
          orderBy: {
            criadoEm: "desc",
          },
        },
      },
    });

    if (!cliente) {
      res.status(404).json({ erro: "Cliente não encontrado." });
      return;
    }

    res.json(cliente);
  } catch (erro) {
    console.error("Erro ao buscar cliente:", erro);
    res.status(500).json({ erro: "Erro ao buscar cliente." });
  }
}

export async function criarCliente(req: Request, res: Response): Promise<void> {
  const { nome, contabilidadeId } = req.body;

  if (typeof nome !== "string" || nome.trim().length === 0) {
    res.status(400).json({ erro: "O nome do cliente é obrigatório." });
    return;
  }

  if (
    contabilidadeId !== undefined &&
    contabilidadeId !== null &&
    (!Number.isInteger(contabilidadeId) || contabilidadeId <= 0)
  ) {
    res.status(400).json({ erro: "contabilidadeId inválido." });
    return;
  }

  try {
    if (contabilidadeId !== undefined && contabilidadeId !== null) {
      const contabilidade = await prisma.contabilidade.findUnique({
        where: { id: contabilidadeId },
      });

      if (!contabilidade) {
        res.status(404).json({ erro: "Contabilidade não encontrada." });
        return;
      }
    }

    const cliente = await prisma.cliente.create({
      data: {
        nome: nome.trim(),
        contabilidadeId: contabilidadeId ?? null,
      },
      include: {
        contabilidade: true,
      },
    });

    res.status(201).json(cliente);
  } catch (erro) {
    console.error("Erro ao criar cliente:", erro);
    res.status(500).json({ erro: "Erro ao criar cliente." });
  }
}

export async function atualizarCliente(req: Request, res: Response): Promise<void> {
  const id = obterId(req.params.id);
  const { nome, ativo, contabilidadeId } = req.body;

  if (id === null) {
    res.status(400).json({ erro: "ID de cliente inválido." });
    return;
  }

  if (nome !== undefined && (typeof nome !== "string" || nome.trim().length === 0)) {
    res.status(400).json({ erro: "Nome de cliente inválido." });
    return;
  }

  if (ativo !== undefined && typeof ativo !== "boolean") {
    res.status(400).json({ erro: "O campo ativo deve ser booleano." });
    return;
  }

  if (
    contabilidadeId !== undefined &&
    contabilidadeId !== null &&
    (!Number.isInteger(contabilidadeId) || contabilidadeId <= 0)
  ) {
    res.status(400).json({ erro: "contabilidadeId inválido." });
    return;
  }

  if (nome === undefined && ativo === undefined && contabilidadeId === undefined) {
    res.status(400).json({ erro: "Nenhum campo foi informado para atualização." });
    return;
  }

  try {
    const existente = await prisma.cliente.findUnique({
      where: { id },
    });

    if (!existente) {
      res.status(404).json({ erro: "Cliente não encontrado." });
      return;
    }

    if (contabilidadeId !== undefined && contabilidadeId !== null) {
      const contabilidade = await prisma.contabilidade.findUnique({
        where: { id: contabilidadeId },
      });

      if (!contabilidade) {
        res.status(404).json({ erro: "Contabilidade não encontrada." });
        return;
      }
    }

    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nome: nome !== undefined ? nome.trim() : undefined,
        ativo,
        contabilidadeId,
      },
      include: {
        contabilidade: true,
      },
    });

    res.json(cliente);
  } catch (erro) {
    console.error("Erro ao atualizar cliente:", erro);
    res.status(500).json({ erro: "Erro ao atualizar cliente." });
  }
}
