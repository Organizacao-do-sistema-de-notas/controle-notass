import type { Request, Response } from "express";

import { prisma } from "../lib/prisma.ts";
import { corpoValido, idValido, obterId } from "../utils/validacao-cliente.ts";
import { bloquearCliente, registrarTrocaContabilidade } from "../services/historico-contabilidade.service.ts";
import { acessarCadastro, ExclusaoClienteRecusada, garantirCadastroUnico } from "../excel/cadastro-unico.ts";

export async function listarClientes(_req: Request, res: Response): Promise<void> {
  try {
    await garantirCadastroUnico();
    const clientes = await prisma.cliente.findMany({
      where: { excluidoEm: null },
      include: {
        contabilidade: true,
        confere: { select: { codigo: true } },
        nomesAlternativos: { select: { nome: true } },
      },
      orderBy: [{ nome: "asc" }, { id: "asc" }],
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
      where: { id, excluidoEm: null },
      include: {
        contabilidade: true,
        confere: { select: { codigo: true } },
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

export async function excluirCliente(req: Request, res: Response): Promise<void> {
  const id = obterId(req.params.id);
  if (id === null) { res.status(400).json({ erro: "ID de cliente inválido." }); return; }
  if (!corpoValido(req.body) || Object.keys(req.body).some(chave => chave !== "nomeConfirmado")
    || typeof req.body.nomeConfirmado !== "string" || !req.body.nomeConfirmado.trim() || req.body.nomeConfirmado.length > 200) {
    res.status(400).json({ erro: "Confirme o nome do cliente para excluir." }); return;
  }
  try {
    const snapshot = await acessarCadastro({ excluir: { id, nomeConfirmado: req.body.nomeConfirmado } });
    res.json({ ...snapshot, id, excluido: true });
  } catch (erro) {
    if (erro instanceof ExclusaoClienteRecusada) { res.status(erro.status).json({ erro: erro.message }); return; }
    console.error("Erro ao excluir cliente:", erro);
    res.status(500).json({ erro: "Não foi possível excluir o cliente. Confira a conexão e tente novamente." });
  }
}

export async function criarCliente(req: Request, res: Response): Promise<void> {
  if (!corpoValido(req.body)) { res.status(400).json({ erro: "Dados inválidos." }); return; }
  const { nome, contabilidadeId } = req.body;

  if (typeof nome !== "string" || (nome.trim().length === 0 || nome.length > 200)) {
    res.status(400).json({ erro: "O nome do cliente é obrigatório." });
    return;
  }

  if (
    contabilidadeId !== undefined &&
    contabilidadeId !== null &&
    !idValido(contabilidadeId)
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
        confere: { select: { codigo: true } },
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
  if (!corpoValido(req.body)) { res.status(400).json({ erro: "Dados inválidos." }); return; }
  const { nome, ativo, contabilidadeId, autor } = req.body;

  if (id === null) { res.status(400).json({ erro: "ID de cliente inválido." }); return; }
  if (nome !== undefined && (typeof nome !== "string" || nome.trim().length === 0 || nome.length > 200)) {
    res.status(400).json({ erro: "Nome de cliente inválido." }); return;
  }
  if (ativo !== undefined && typeof ativo !== "boolean") {
    res.status(400).json({ erro: "O campo ativo deve ser booleano." }); return;
  }
  if (contabilidadeId !== undefined && contabilidadeId !== null &&
      !idValido(contabilidadeId)) {
    res.status(400).json({ erro: "contabilidadeId inválido." }); return;
  }
  if (autor !== undefined && (typeof autor !== "string" || autor.length > 150)) {
    res.status(400).json({ erro: "Autor inválido." }); return;
  }
  if (nome === undefined && ativo === undefined && contabilidadeId === undefined) {
    res.status(400).json({ erro: "Nenhum campo foi informado para atualização." }); return;
  }

  try {
    if (contabilidadeId !== undefined && contabilidadeId !== null) {
      const contabilidade = await prisma.contabilidade.findUnique({ where: { id: contabilidadeId } });
      if (!contabilidade) { res.status(404).json({ erro: "Contabilidade não encontrada." }); return; }
    }
    const resultado = await prisma.$transaction(async (tx) => {
      const existente = await bloquearCliente(tx, id);
      if (!existente) return null;
      const cliente = await tx.cliente.update({
        where: { id },
        data: {
          nome: nome === undefined ? undefined : nome.trim(),
          ativo,
          contabilidadeId,
        },
        include: { contabilidade: true },
      });
      await registrarTrocaContabilidade(tx, existente, cliente, autor);
      return cliente;
    });
    if (!resultado) { res.status(404).json({ erro: "Cliente não encontrado." }); return; }
    res.json(resultado);
  } catch (erro) {
    console.error("Erro ao atualizar cliente:", erro);
    res.status(500).json({ erro: "Erro ao atualizar cliente." });
  }
}
