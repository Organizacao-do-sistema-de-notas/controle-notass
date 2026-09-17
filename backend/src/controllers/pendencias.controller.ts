import type { Request, Response } from "express";

import { StatusPendencia } from "../../generated/prisma/enums.ts";
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

function competenciaValida(valor: unknown): valor is string {
  return typeof valor === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

function statusValido(valor: unknown): valor is StatusPendencia {
  return typeof valor === "string" && Object.values(StatusPendencia).includes(valor as StatusPendencia);
}

function textoOpcional(valor: unknown): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto.length > 0 ? texto : null;
}

export async function listarPendencias(req: Request, res: Response): Promise<void> {
  const { competencia, status, clienteId } = req.query;

  if (competencia !== undefined && !competenciaValida(competencia)) {
    res.status(400).json({ erro: "Competência inválida. Use o formato AAAA-MM." });
    return;
  }

  if (status !== undefined && !statusValido(status)) {
    res.status(400).json({ erro: "Status de pendência inválido." });
    return;
  }

  let clienteIdNumero: number | undefined;

  if (clienteId !== undefined) {
    if (typeof clienteId !== "string") {
      res.status(400).json({ erro: "clienteId inválido." });
      return;
    }

    const id = obterId(clienteId);

    if (id === null) {
      res.status(400).json({ erro: "clienteId inválido." });
      return;
    }

    clienteIdNumero = id;
  }

  try {
    const pendencias = await prisma.pendencia.findMany({
      where: {
        competencia: competencia as string | undefined,
        status: status as StatusPendencia | undefined,
        clienteId: clienteIdNumero,
      },
      include: {
        cliente: {
          include: {
            contabilidade: true,
          },
        },
      },
      orderBy: [
        {
          atualizadoEm: "desc",
        },
        {
          criadoEm: "desc",
        },
      ],
    });

    res.json(pendencias);
  } catch (erro) {
    console.error("Erro ao listar pendências:", erro);
    res.status(500).json({ erro: "Erro ao listar pendências." });
  }
}

export async function buscarPendenciaPorId(req: Request, res: Response): Promise<void> {
  const id = obterId(req.params.id);

  if (id === null) {
    res.status(400).json({ erro: "ID de pendência inválido." });
    return;
  }

  try {
    const pendencia = await prisma.pendencia.findUnique({
      where: { id },
      include: {
        cliente: {
          include: {
            contabilidade: true,
          },
        },
      },
    });

    if (!pendencia) {
      res.status(404).json({ erro: "Pendência não encontrada." });
      return;
    }

    res.json(pendencia);
  } catch (erro) {
    console.error("Erro ao buscar pendência:", erro);
    res.status(500).json({ erro: "Erro ao buscar pendência." });
  }
}

export async function criarPendencia(req: Request, res: Response): Promise<void> {
  const { clienteId, competencia, status, responsavel, observacao } = req.body;

  if (!Number.isInteger(clienteId) || clienteId <= 0) {
    res.status(400).json({ erro: "clienteId é obrigatório e deve ser um número inteiro positivo." });
    return;
  }

  if (!competenciaValida(competencia)) {
    res.status(400).json({ erro: "Competência inválida. Use o formato AAAA-MM." });
    return;
  }

  if (status !== undefined && !statusValido(status)) {
    res.status(400).json({ erro: "Status de pendência inválido." });
    return;
  }

  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId },
    });

    if (!cliente) {
      res.status(404).json({ erro: "Cliente não encontrado." });
      return;
    }

    const existente = await prisma.pendencia.findUnique({
      where: {
        clienteId_competencia: {
          clienteId,
          competencia,
        },
      },
    });

    if (existente) {
      res.status(409).json({
        erro: "Já existe uma pendência para este cliente nesta competência.",
        pendenciaId: existente.id,
      });
      return;
    }

    const statusInicial = status ?? StatusPendencia.PENDENTE;

    const pendencia = await prisma.pendencia.create({
      data: {
        clienteId,
        competencia,
        status: statusInicial,
        responsavel: textoOpcional(responsavel),
        observacao: textoOpcional(observacao),
        concluidoEm: statusInicial === StatusPendencia.CONCLUIDO ? new Date() : null,
      },
      include: {
        cliente: {
          include: {
            contabilidade: true,
          },
        },
      },
    });

    res.status(201).json(pendencia);
  } catch (erro) {
    console.error("Erro ao criar pendência:", erro);
    res.status(500).json({ erro: "Erro ao criar pendência." });
  }
}

export async function atualizarPendencia(req: Request, res: Response): Promise<void> {
  const id = obterId(req.params.id);
  const { status, responsavel, observacao } = req.body;

  if (id === null) {
    res.status(400).json({ erro: "ID de pendência inválido." });
    return;
  }

  if (status !== undefined && !statusValido(status)) {
    res.status(400).json({ erro: "Status de pendência inválido." });
    return;
  }

  if (responsavel !== undefined && responsavel !== null && typeof responsavel !== "string") {
    res.status(400).json({ erro: "Responsável inválido." });
    return;
  }

  if (observacao !== undefined && observacao !== null && typeof observacao !== "string") {
    res.status(400).json({ erro: "Observação inválida." });
    return;
  }

  if (status === undefined && responsavel === undefined && observacao === undefined) {
    res.status(400).json({ erro: "Nenhum campo foi informado para atualização." });
    return;
  }

  try {
    const existente = await prisma.pendencia.findUnique({
      where: { id },
    });

    if (!existente) {
      res.status(404).json({ erro: "Pendência não encontrada." });
      return;
    }

    const pendencia = await prisma.pendencia.update({
      where: { id },
      data: {
        status,
        responsavel: responsavel !== undefined ? textoOpcional(responsavel) : undefined,
        observacao: observacao !== undefined ? textoOpcional(observacao) : undefined,
        concluidoEm:
          status === undefined
            ? undefined
            : status === StatusPendencia.CONCLUIDO
              ? existente.concluidoEm ?? new Date()
              : null,
      },
      include: {
        cliente: {
          include: {
            contabilidade: true,
          },
        },
      },
    });

    res.json(pendencia);
  } catch (erro) {
    console.error("Erro ao atualizar pendência:", erro);
    res.status(500).json({ erro: "Erro ao atualizar pendência." });
  }
}
