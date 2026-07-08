import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export async function addClientInteraction(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { type, content, leadId } = req.body;

    if (!type || !content) {
      return res.status(400).json({ error: 'Tipo e conteúdo são obrigatórios' });
    }

    const client = await prisma.client.findFirst({ where: { id, deletedAt: null } });
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const interaction = await prisma.interaction.create({
      data: {
        type,
        content,
        clientId: id,
        leadId: leadId || null,
        userId: req.user!.id,
      },
    });

    return res.status(201).json(interaction);
  } catch (error: any) {
    console.error('Erro ao adicionar interação:', error);
    return res.status(500).json({ error: 'Erro interno ao adicionar interação' });
  }
}
