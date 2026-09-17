import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.ts";
import {
  formatarCompetencia,
  gerarMensagemPendencia,
} from "../services/mensagem-whatsapp.service.ts";

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

export async function gerarMensagemWhatsApp(req: Request, res: Response): Promise<void> {
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

    const mensagem = gerarMensagemPendencia({
      clienteNome: pendencia.cliente.nome,
      competencia: pendencia.competencia,
      status: pendencia.status,
      observacao: pendencia.observacao,
    });

    res.json({
      pendenciaId: pendencia.id,
      cliente: {
        id: pendencia.cliente.id,
        nome: pendencia.cliente.nome,
      },
      contabilidade: pendencia.cliente.contabilidade,
      competencia: pendencia.competencia,
      competenciaFormatada: formatarCompetencia(pendencia.competencia),
      status: pendencia.status,
      mensagem,
      linkWhatsApp: `https://wa.me/?text=${encodeURIComponent(mensagem)}`,
    });
  } catch (erro) {
    console.error("Erro ao gerar mensagem para WhatsApp:", erro);
    res.status(500).json({ erro: "Erro ao gerar mensagem para WhatsApp." });
  }
}
