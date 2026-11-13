import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.ts";

const frequencias = ["NAO_DEFINIDA", "MENSAL", "EVENTUAL"] as const;
type Frequencia = (typeof frequencias)[number];

function idPositivo(valor: unknown): number | null {
  if (typeof valor !== "string" || !/^[0-9]+$/.test(valor)) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function textoOpcional(valor: unknown, limite: number): string | null | undefined {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  if (typeof valor !== "string" || valor.length > limite) throw new Error("Campo de texto inválido ou muito longo.");
  return valor.trim() || null;
}

export async function obterFichaCliente(req: Request, res: Response): Promise<void> {
  const id = idPositivo(req.params.id);
  if (!id) { res.status(400).json({ erro: "ID de cliente inválido." }); return; }
  try {
    const cliente = await prisma.cliente.findUnique({
      where: { id },
      include: {
        contabilidade: true,
        nomesAlternativos: { orderBy: { nome: "asc" } },
        procedimentos: { orderBy: { criadoEm: "asc" } },
        historicoContabilidades: { orderBy: { criadoEm: "desc" } },
      },
    });
    if (!cliente) { res.status(404).json({ erro: "Cliente não encontrado." }); return; }
    res.json(cliente);
  } catch (erro) {
    console.error("Erro ao carregar ficha:", erro);
    res.status(500).json({ erro: "Erro ao carregar ficha do cliente." });
  }
}

export async function atualizarFichaCliente(req: Request, res: Response): Promise<void> {
  const id = idPositivo(req.params.id);
  if (!id) { res.status(400).json({ erro: "ID de cliente inválido." }); return; }

  try {
    const corpo = req.body;
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
      res.status(400).json({ erro: "Dados inválidos." }); return;
    }
    const { frequenciaAcesso, observacoesPermanentes, modeloMensagem, nomesAlternativos } = corpo;
    if (frequenciaAcesso !== undefined && !frequencias.includes(frequenciaAcesso as Frequencia)) {
      res.status(400).json({ erro: "Frequência inválida." }); return;
    }
    const observacoes = textoOpcional(observacoesPermanentes, 20000);
    const modelo = textoOpcional(modeloMensagem, 20000);
    let nomes: string[] | undefined;
    if (nomesAlternativos !== undefined) {
      if (!Array.isArray(nomesAlternativos) || nomesAlternativos.length > 30 ||
          nomesAlternativos.some((nome: unknown) => typeof nome !== "string" || !nome.trim() || nome.length > 200)) {
        res.status(400).json({ erro: "Informe uma lista válida de nomes alternativos." }); return;
      }
      nomes = [...new Set((nomesAlternativos as string[]).map(nome => nome.trim()))];
    }
    if (frequenciaAcesso === undefined && observacoes === undefined && modelo === undefined && nomes === undefined) {
      res.status(400).json({ erro: "Nenhum campo de ficha informado." }); return;
    }
    const ficha = await prisma.$transaction(async tx => {
      const existente = await tx.cliente.findUnique({ where: { id }, select: { id: true } });
      if (!existente) return null;
      await tx.cliente.update({
        where: { id },
        data: { frequenciaAcesso, observacoesPermanentes: observacoes, modeloMensagem: modelo },
      });
      if (nomes !== undefined) {
        await tx.clienteNomeAlternativo.deleteMany({ where: { clienteId: id } });
        if (nomes.length > 0) {
          await tx.clienteNomeAlternativo.createMany({ data: nomes.map(nome => ({ clienteId: id, nome })) });
        }
      }
      return tx.cliente.findUnique({
        where: { id },
        include: {
          contabilidade: true,
          nomesAlternativos: { orderBy: { nome: "asc" } },
          procedimentos: { orderBy: { criadoEm: "asc" } },
          historicoContabilidades: { orderBy: { criadoEm: "desc" } },
        },
      });
    });
    if (!ficha) { res.status(404).json({ erro: "Cliente não encontrado." }); return; }
    res.json(ficha);
  } catch (erro) {
    if (erro instanceof Error && erro.message === "Campo de texto inválido ou muito longo.") {
      res.status(400).json({ erro: erro.message }); return;
    }
    console.error("Erro ao salvar ficha:", erro);
    res.status(500).json({ erro: "Erro ao salvar ficha do cliente." });
  }
}

export async function criarProcedimentoCliente(req: Request, res: Response): Promise<void> {
  const clienteId = idPositivo(req.params.id);
  const { titulo, descricao } = req.body ?? {};
  if (!clienteId || typeof titulo !== "string" || !titulo.trim() || titulo.length > 200 ||
      typeof descricao !== "string" || !descricao.trim() || descricao.length > 20000) {
    res.status(400).json({ erro: "Cliente, título ou descrição inválidos." }); return;
  }
  try {
    const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } });
    if (!cliente) { res.status(404).json({ erro: "Cliente não encontrado." }); return; }
    const procedimento = await prisma.procedimentoCliente.create({
      data: { clienteId, titulo: titulo.trim(), descricao: descricao.trim() },
    });
    res.status(201).json(procedimento);
  } catch (erro) {
    console.error("Erro ao criar procedimento:", erro);
    res.status(500).json({ erro: "Erro ao criar procedimento." });
  }
}

export async function atualizarProcedimentoCliente(req: Request, res: Response): Promise<void> {
  const clienteId = idPositivo(req.params.id);
  const procedimentoId = idPositivo(req.params.procedimentoId);
  if (!clienteId || !procedimentoId) {
    res.status(400).json({ erro: "Identificador inválido." }); return;
  }
  const { titulo, descricao, ativo } = req.body ?? {};
  if ((titulo === undefined && descricao === undefined && ativo === undefined) ||
      (titulo !== undefined && (typeof titulo !== "string" || !titulo.trim() || titulo.length > 200)) ||
      (descricao !== undefined && (typeof descricao !== "string" || !descricao.trim() || descricao.length > 20000)) ||
      (ativo !== undefined && typeof ativo !== "boolean")) {
    res.status(400).json({ erro: "Campos de procedimento inválidos." }); return;
  }
  try {
    const alterado = await prisma.procedimentoCliente.updateMany({
      where: { id: procedimentoId, clienteId },
      data: {
        titulo: titulo === undefined ? undefined : titulo.trim(),
        descricao: descricao === undefined ? undefined : descricao.trim(),
        ativo,
      },
    });
    if (alterado.count === 0) { res.status(404).json({ erro: "Procedimento não encontrado." }); return; }
    const procedimento = await prisma.procedimentoCliente.findUnique({ where: { id: procedimentoId } });
    res.json(procedimento);
  } catch (erro) {
    console.error("Erro ao atualizar procedimento:", erro);
    res.status(500).json({ erro: "Erro ao atualizar procedimento." });
  }
}
