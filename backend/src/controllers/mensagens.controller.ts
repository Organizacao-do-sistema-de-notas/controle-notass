import type { Request, Response } from "express";

import { TipoHistoricoPendencia } from "../../generated/prisma/enums.ts";
import { prisma } from "../lib/prisma.ts";
import {
  gerarLinkWhatsApp,
  normalizarMensagemContador,
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

function textoOpcional(valor: unknown): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  const texto = valor.trim();
  return texto.length > 0 ? texto : null;
}

export async function obterMensagemContador(req: Request, res: Response): Promise<void> {
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

    const mensagem = pendencia.mensagemContador;

    res.json({
      pendenciaId: pendencia.id,
      cliente: {
        id: pendencia.cliente.id,
        nome: pendencia.cliente.nome,
      },
      contabilidade: pendencia.cliente.contabilidade,
      competencia: pendencia.competencia,
      mensagem,
      temMensagem: mensagem !== null && mensagem.length > 0,
      linkWhatsApp: mensagem ? gerarLinkWhatsApp(mensagem) : null,
    });
  } catch (erro) {
    console.error("Erro ao buscar mensagem do contador:", erro);
    res.status(500).json({ erro: "Erro ao buscar mensagem do contador." });
  }
}

export async function salvarMensagemContador(req: Request, res: Response): Promise<void> {
  const id = obterId(req.params.id);
  const { mensagem, autor } = req.body;

  if (id === null) {
    res.status(400).json({ erro: "ID de pendência inválido." });
    return;
  }

  if (mensagem === undefined || (mensagem !== null && typeof mensagem !== "string")) {
    res.status(400).json({
      erro: "Informe a mensagem como texto. Use null ou texto vazio para limpar.",
    });
    return;
  }

  if (autor !== undefined && autor !== null && typeof autor !== "string") {
    res.status(400).json({ erro: "Autor inválido." });
    return;
  }

  const mensagemNova =
    typeof mensagem === "string"
      ? normalizarMensagemContador(mensagem) || null
      : null;
  const autorHistorico = textoOpcional(autor);

  try {
    const existente = await prisma.pendencia.findUnique({
      where: { id },
      include: {
        cliente: {
          include: {
            contabilidade: true,
          },
        },
      },
    });

    if (!existente) {
      res.status(404).json({ erro: "Pendência não encontrada." });
      return;
    }

    if (existente.mensagemContador !== mensagemNova) {
      await prisma.$transaction(async (tx) => {
        await tx.pendencia.update({
          where: { id },
          data: {
            mensagemContador: mensagemNova,
          },
        });

        await tx.historicoPendencia.create({
          data: {
            pendenciaId: id,
            tipo: TipoHistoricoPendencia.MENSAGEM_CONTADOR,
            valorAnterior: existente.mensagemContador,
            valorNovo: mensagemNova,
            autor: autorHistorico,
          },
        });
      });
    }

    res.json({
      pendenciaId: existente.id,
      cliente: {
        id: existente.cliente.id,
        nome: existente.cliente.nome,
      },
      contabilidade: existente.cliente.contabilidade,
      competencia: existente.competencia,
      mensagem: mensagemNova,
      temMensagem: mensagemNova !== null && mensagemNova.length > 0,
      linkWhatsApp: mensagemNova ? gerarLinkWhatsApp(mensagemNova) : null,
    });
  } catch (erro) {
    console.error("Erro ao salvar mensagem do contador:", erro);
    res.status(500).json({ erro: "Erro ao salvar mensagem do contador." });
  }
}
