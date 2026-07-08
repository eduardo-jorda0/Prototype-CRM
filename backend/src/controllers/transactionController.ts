import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { recordAudit } from '../utils/audit';

export async function createTransaction(req: Request, res: Response) {
  try {
    const { clientId, description, amount, type, status, date } = req.body;

    if (!clientId || !description || amount === undefined || !type) {
      return res.status(400).json({ error: 'clientId, description, amount e type são obrigatórios' });
    }

    const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const transaction = await prisma.transaction.create({
      data: {
        clientId,
        description,
        amount: Number(amount),
        type,
        status: status || 'PENDENTE',
        date: date ? new Date(date) : new Date(),
      },
    });

    await recordAudit({ entity: 'Transaction', entityId: transaction.id, action: 'CREATE', userId: req.user!.id, changes: transaction });

    return res.status(201).json(transaction);
  } catch (error: any) {
    console.error('Erro ao criar transação:', error);
    return res.status(500).json({ error: 'Erro interno ao criar transação' });
  }
}

export async function getTransactionById(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const transaction = await prisma.transaction.findFirst({
      where: { id, deletedAt: null },
      include: { client: { select: { id: true, name: true, cpf: true } } },
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    return res.json(transaction);
  } catch (error: any) {
    console.error('Erro ao obter transação:', error);
    return res.status(500).json({ error: 'Erro interno ao obter transação' });
  }
}

export async function listTransactions(req: Request, res: Response) {
  try {
    const q: any = (res as any).locals?.validatedQuery || req.query;
    const { status, clientId, search, page = '1', limit = '20' } = q;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { deletedAt: null };
    if (status) whereClause.status = status as string;
    if (clientId) whereClause.clientId = clientId as string;
    if (search) {
      whereClause.OR = [
        { description: { contains: search as string } },
        { client: { name: { contains: search as string } } },
      ];
    }

    // RBAC scoping: Assessors see transactions only for clients that have leads assigned to them
    const user = req.user;
    if (user && user.role === 'ASSESSOR') {
      whereClause.client = { leads: { some: { assignedToId: user.id } } };
    }

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where: whereClause,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
        include: { client: { select: { id: true, name: true, cpf: true } } },
      }),
      prisma.transaction.count({ where: whereClause }),
    ]);

    return res.json({
      data: transactions,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar transações:', error);
    return res.status(500).json({ error: 'Erro interno ao listar transações' });
  }
}

export async function updateTransaction(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { clientId, description, amount, type, status, date } = req.body;

    const existingTransaction = await prisma.transaction.findFirst({ where: { id, deletedAt: null } });
    if (!existingTransaction) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    const dataToUpdate: any = {};
    if (clientId !== undefined) {
      const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
      if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
      dataToUpdate.clientId = clientId;
    }
    if (description !== undefined) dataToUpdate.description = description;
    if (amount !== undefined) dataToUpdate.amount = Number(amount);
    if (type !== undefined) dataToUpdate.type = type;
    if (status !== undefined) dataToUpdate.status = status;
    if (date !== undefined) dataToUpdate.date = new Date(date);

    const updatedTransaction = await prisma.transaction.update({
      where: { id },
      data: dataToUpdate,
      include: { client: { select: { id: true, name: true, cpf: true } } },
    });

    await recordAudit({ entity: 'Transaction', entityId: id, action: 'UPDATE', userId: req.user!.id, changes: dataToUpdate });

    return res.json(updatedTransaction);
  } catch (error: any) {
    console.error('Erro ao atualizar transação:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar transação' });
  }
}

export async function deleteTransaction(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const transaction = await prisma.transaction.findFirst({ where: { id, deletedAt: null } });
    if (!transaction) {
      return res.status(404).json({ error: 'Transação não encontrada' });
    }

    await prisma.transaction.update({ where: { id }, data: { deletedAt: new Date() } });

    await recordAudit({ entity: 'Transaction', entityId: id, action: 'DELETE', userId: req.user!.id, changes: transaction });

    return res.json({ message: 'Transação excluída com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir transação:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir transação' });
  }
}
