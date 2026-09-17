import type { Request, Response } from "express";

import { StatusPendencia } from "../../generated/prisma/enums.ts";
import { prisma } from "../lib/prisma.ts";

function competenciaValida(valor: unknown): valor is string {
  return typeof valor === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor);
}

const ordemStatus: Record<StatusPendencia, number> = {
  [StatusPendencia.PENDENTE]: 1,
  [StatusPendencia.AGUARDANDO_CLIENTE]: 2,
  [StatusPendencia.EM_ATENDIMENTO]: 3,
  [StatusPendencia.CONCLUIDO]: 4,
};

export async function listarCompetencias(_req: Request, res: Response): Promise<void> {
  try {
    const registros = await prisma.pendencia.findMany({
      distinct: ["competencia"],
      select: {
        competencia: true,
      },
      orderBy: {
        competencia: "desc",
      },
    });

    res.json(registros.map((registro) => registro.competencia));
  } catch (erro) {
    console.error("Erro ao listar competências:", erro);
    res.status(500).json({ erro: "Erro ao listar competências." });
  }
}

export async function obterPainelMensal(req: Request, res: Response): Promise<void> {
  const { competencia } = req.query;

  if (!competenciaValida(competencia)) {
    res.status(400).json({
      erro: "A competência é obrigatória e deve usar o formato AAAA-MM.",
    });
    return;
  }

  try {
    const pendencias = await prisma.pendencia.findMany({
      where: {
        competencia,
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
          take: 1,
        },
      },
      orderBy: {
        atualizadoEm: "desc",
      },
    });

    const totais = {
      total: pendencias.length,
      emAberto: 0,
      pendente: 0,
      aguardandoCliente: 0,
      emAtendimento: 0,
      concluido: 0,
    };

    for (const pendencia of pendencias) {
      switch (pendencia.status) {
        case StatusPendencia.PENDENTE:
          totais.pendente += 1;
          totais.emAberto += 1;
          break;
        case StatusPendencia.AGUARDANDO_CLIENTE:
          totais.aguardandoCliente += 1;
          totais.emAberto += 1;
          break;
        case StatusPendencia.EM_ATENDIMENTO:
          totais.emAtendimento += 1;
          totais.emAberto += 1;
          break;
        case StatusPendencia.CONCLUIDO:
          totais.concluido += 1;
          break;
      }
    }

    const itens = pendencias
      .map((pendencia) => {
        const ultimoEvento = pendencia.historico[0] ?? null;

        return {
          id: pendencia.id,
          competencia: pendencia.competencia,
          status: pendencia.status,
          responsavel: pendencia.responsavel,
          observacao: pendencia.observacao,
          criadoEm: pendencia.criadoEm,
          atualizadoEm: pendencia.atualizadoEm,
          concluidoEm: pendencia.concluidoEm,
          cliente: {
            id: pendencia.cliente.id,
            nome: pendencia.cliente.nome,
            ativo: pendencia.cliente.ativo,
          },
          contabilidade: pendencia.cliente.contabilidade,
          ultimaMovimentacao: ultimoEvento
            ? {
                tipo: ultimoEvento.tipo,
                autor: ultimoEvento.autor,
                criadoEm: ultimoEvento.criadoEm,
              }
            : {
                tipo: null,
                autor: null,
                criadoEm: pendencia.atualizadoEm,
              },
        };
      })
      .sort((a, b) => {
        const diferencaStatus = ordemStatus[a.status] - ordemStatus[b.status];

        if (diferencaStatus !== 0) {
          return diferencaStatus;
        }

        return b.atualizadoEm.getTime() - a.atualizadoEm.getTime();
      });

    res.json({
      competencia,
      totais,
      pendencias: itens,
    });
  } catch (erro) {
    console.error("Erro ao montar painel mensal:", erro);
    res.status(500).json({ erro: "Erro ao montar painel mensal." });
  }
}
