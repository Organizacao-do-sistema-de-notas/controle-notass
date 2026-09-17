import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.ts";

function obterId(valor: unknown): number | null {
  if (typeof valor !== "string") {
    return null;
  }

  const id = Number(valor);

  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

export async function listarContabilidades(_req: Request, res: Response): Promise<void> {
  try {
    const contabilidades = await prisma.contabilidade.findMany({
      include: {
        _count: {
          select: {
            clientes: true,
          },
        },
      },
      orderBy: {
        nome: "asc",
      },
    });

    res.json(contabilidades);
  } catch (erro) {
    console.error("Erro ao listar contabilidades:", erro);
    res.status(500).json({ erro: "Erro ao listar contabilidades." });
  }
}

export async function criarContabilidade(req: Request, res: Response): Promise<void> {
  const { nome } = req.body;

  if (typeof nome !== "string" || nome.trim().length === 0) {
    res.status(400).json({ erro: "O nome da contabilidade é obrigatório." });
    return;
  }

  try {
    const contabilidade = await prisma.contabilidade.create({
      data: {
        nome: nome.trim(),
      },
    });

    res.status(201).json(contabilidade);
  } catch (erro) {
    console.error("Erro ao criar contabilidade:", erro);
    res.status(500).json({ erro: "Erro ao criar contabilidade." });
  }
}

export async function atualizarContabilidade(req: Request, res: Response): Promise<void> {
  const id = obterId(req.params.id);
  const { nome } = req.body;

  if (id === null) {
    res.status(400).json({ erro: "ID de contabilidade inválido." });
    return;
  }

  if (typeof nome !== "string" || nome.trim().length === 0) {
    res.status(400).json({ erro: "O nome da contabilidade é obrigatório." });
    return;
  }

  try {
    const existente = await prisma.contabilidade.findUnique({
      where: { id },
    });

    if (!existente) {
      res.status(404).json({ erro: "Contabilidade não encontrada." });
      return;
    }

    const contabilidade = await prisma.contabilidade.update({
      where: { id },
      data: {
        nome: nome.trim(),
      },
    });

    res.json(contabilidade);
  } catch (erro) {
    console.error("Erro ao atualizar contabilidade:", erro);
    res.status(500).json({ erro: "Erro ao atualizar contabilidade." });
  }
}
