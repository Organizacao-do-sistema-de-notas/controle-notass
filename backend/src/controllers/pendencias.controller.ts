import type { Request, Response } from "express";

import {
  StatusPendencia,
  TipoHistoricoPendencia,
} from "../../generated/prisma/enums.ts";
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

function autorValido(valor: unknown): boolean {
  return valor === undefined || valor === null || typeof valor === "string";
}

type EventoHistorico = {
  tipo: TipoHistoricoPendencia;
  valorAnterior: string | null;
  valorNovo: string | null;
  autor: string | null;
};

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
        historico: {
          orderBy: {
            criadoEm: "desc",
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

export async function listarHistoricoPendencia(req: Request, res: Response): Promise<void> {
  const id = obterId(req.params.id);

  if (id === null) {
    res.status(400).json({ erro: "ID de pendência inválido." });
    return;
  }

  try {
    const pendencia = await prisma.pendencia.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!pendencia) {
      res.status(404).json({ erro: "Pendência não encontrada." });
      return;
    }

    const historico = await prisma.historicoPendencia.findMany({
      where: {
        pendenciaId: id,
      },
      orderBy: {
        criadoEm: "desc",
      },
    });

    res.json(historico);
  } catch (erro) {
    console.error("Erro ao listar histórico da pendência:", erro);
    res.status(500).json({ erro: "Erro ao listar histórico da pendência." });
  }
}

export async function criarPendencia(req: Request, res: Response): Promise<void> {
  const { clienteId, competencia, status, responsavel, observacao, autor } = req.body;

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

  if (responsavel !== undefined && responsavel !== null && typeof responsavel !== "string") {
    res.status(400).json({ erro: "Responsável inválido." });
    return;
  }

  if (observacao !== undefined && observacao !== null && typeof observacao !== "string") {
    res.status(400).json({ erro: "Observação inválida." });
    return;
  }

  if (!autorValido(autor)) {
    res.status(400).json({ erro: "Autor inválido." });
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
    const responsavelInicial = textoOpcional(responsavel);
    const observacaoInicial = textoOpcional(observacao);
    const autorHistorico = textoOpcional(autor);

    const eventosHistorico: EventoHistorico[] = [
      {
        tipo: TipoHistoricoPendencia.CRIACAO,
        valorAnterior: null,
        valorNovo: statusInicial,
        autor: autorHistorico,
      },
    ];

    if (responsavelInicial !== null) {
      eventosHistorico.push({
        tipo: TipoHistoricoPendencia.RESPONSAVEL,
        valorAnterior: null,
        valorNovo: responsavelInicial,
        autor: autorHistorico,
      });
    }

    if (observacaoInicial !== null) {
      eventosHistorico.push({
        tipo: TipoHistoricoPendencia.OBSERVACAO,
        valorAnterior: null,
        valorNovo: observacaoInicial,
        autor: autorHistorico,
      });
    }

    const pendencia = await prisma.pendencia.create({
      data: {
        clienteId,
        competencia,
        status: statusInicial,
        responsavel: responsavelInicial,
        observacao: observacaoInicial,
        concluidoEm: statusInicial === StatusPendencia.CONCLUIDO ? new Date() : null,
        historico: {
          create: eventosHistorico,
        },
      },
      include: {
        cliente: {
          include: {
            contabilidade: true,
          },
        },
        historico: {
          orderBy: {
            criadoEm: "desc",
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
  const { status, responsavel, observacao, autor } = req.body;

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

  if (!autorValido(autor)) {
    res.status(400).json({ erro: "Autor inválido." });
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

    const responsavelNovo =
      responsavel !== undefined ? textoOpcional(responsavel) : existente.responsavel;
    const observacaoNova =
      observacao !== undefined ? textoOpcional(observacao) : existente.observacao;
    const autorHistorico = textoOpcional(autor);

    const eventosHistorico: EventoHistorico[] = [];

    if (status !== undefined && status !== existente.status) {
      eventosHistorico.push({
        tipo: TipoHistoricoPendencia.STATUS,
        valorAnterior: existente.status,
        valorNovo: status,
        autor: autorHistorico,
      });
    }

    if (responsavel !== undefined && responsavelNovo !== existente.responsavel) {
      eventosHistorico.push({
        tipo: TipoHistoricoPendencia.RESPONSAVEL,
        valorAnterior: existente.responsavel,
        valorNovo: responsavelNovo,
        autor: autorHistorico,
      });
    }

    if (observacao !== undefined && observacaoNova !== existente.observacao) {
      eventosHistorico.push({
        tipo: TipoHistoricoPendencia.OBSERVACAO,
        valorAnterior: existente.observacao,
        valorNovo: observacaoNova,
        autor: autorHistorico,
      });
    }

    if (eventosHistorico.length === 0) {
      const pendenciaAtual = await prisma.pendencia.findUnique({
        where: { id },
        include: {
          cliente: {
            include: {
              contabilidade: true,
            },
          },
          historico: {
            orderBy: {
              criadoEm: "desc",
            },
          },
        },
      });

      res.json(pendenciaAtual);
      return;
    }

    const pendencia = await prisma.$transaction(async (tx) => {
      const atualizada = await tx.pendencia.update({
        where: { id },
        data: {
          status,
          responsavel: responsavel !== undefined ? responsavelNovo : undefined,
          observacao: observacao !== undefined ? observacaoNova : undefined,
          concluidoEm:
            status === undefined
              ? undefined
              : status === StatusPendencia.CONCLUIDO
                ? existente.concluidoEm ?? new Date()
                : null,
        },
      });

      for (const evento of eventosHistorico) {
        await tx.historicoPendencia.create({
          data: {
            pendenciaId: id,
            ...evento,
          },
        });
      }

      return atualizada;
    });

    const pendenciaCompleta = await prisma.pendencia.findUnique({
      where: { id: pendencia.id },
      include: {
        cliente: {
          include: {
            contabilidade: true,
          },
        },
        historico: {
          orderBy: {
            criadoEm: "desc",
          },
        },
      },
    });

    res.json(pendenciaCompleta);
  } catch (erro) {
    console.error("Erro ao atualizar pendência:", erro);
    res.status(500).json({ erro: "Erro ao atualizar pendência." });
  }
}
