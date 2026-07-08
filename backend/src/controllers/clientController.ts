import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { validateCPF, validateEmail, formatCPF } from '../utils/validators';
import { recordAudit } from '../utils/audit';

export async function createClient(req: Request, res: Response) {
  try {
    const { name, email, phone, cpf, status } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'O nome do cliente é obrigatório' });
    }

    if (email && !validateEmail(email)) {
      return res.status(400).json({ error: 'E-mail em formato inválido' });
    }

    let formattedCPF = cpf;
    if (cpf) {
      if (!validateCPF(cpf)) {
        return res.status(400).json({ error: 'CPF inválido' });
      }
      formattedCPF = formatCPF(cpf);

      // Verificar se CPF já está cadastrado
      const existingClient = await prisma.client.findUnique({
        where: { cpf: formattedCPF },
      });
      if (existingClient) {
        return res.status(400).json({ error: 'Já existe um cliente cadastrado com este CPF' });
      }
    }

    const client = await prisma.client.create({
      data: {
        name,
        email,
        phone,
        cpf: formattedCPF,
        status: status || 'ATIVO',
      },
    });

    // Registrar interação automática
    await prisma.interaction.create({
      data: {
        type: 'NOTE',
        content: `Cliente criado com status ${client.status}`,
        clientId: client.id,
        userId: req.user!.id,
      },
    });

    await recordAudit({ entity: 'Client', entityId: client.id, action: 'CREATE', userId: req.user!.id, changes: client });

    return res.status(201).json(client);
  } catch (error: any) {
    console.error('Erro ao criar cliente:', error);
    return res.status(500).json({ error: 'Erro interno ao criar cliente' });
  }
}

export async function listClients(req: Request, res: Response) {
  try {
    const q: any = (res as any).locals?.validatedQuery || req.query;
    const { search, status, page = '1', limit = '10' } = q;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Filtros de busca
    const whereClause: any = { deletedAt: null };

    if (status) {
      whereClause.status = status as string;
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search as string } },
        { email: { contains: search as string } },
        { cpf: { contains: search as string } },
      ];
    }

    // RBAC scoping: Assessors AND Closers see only clients that have leads assigned to them
    const user = req.user;
    if (user && (user.role === 'ASSESSOR' || user.role === 'CLOSER')) {
      whereClause.leads = { some: { assignedToId: user.id } };
    }

    const [clients, total] = await prisma.$transaction([
      prisma.client.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          _count: {
            select: { leads: true, transactions: true },
          },
        },
      }),
      prisma.client.count({ where: whereClause }),
    ]);

    return res.json({
      data: clients,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar clientes:', error);
    return res.status(500).json({ error: 'Erro interno ao listar clientes' });
  }
}

export async function getClientById(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const client = await prisma.client.findFirst({
      where: { id, deletedAt: null },
      include: {
        leads: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'desc' },
          take: 50,
        },
        transactions: {
          where: { deletedAt: null },
          orderBy: { date: 'desc' },
          take: 50,
        },
        interactions: {
          orderBy: { date: 'desc' },
          take: 50,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    return res.json(client);
  } catch (error: any) {
    console.error('Erro ao obter cliente:', error);
    return res.status(500).json({ error: 'Erro interno ao obter cliente' });
  }
}

export async function updateClient(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { name, email, phone, cpf, status } = req.body;

    const existingClient = await prisma.client.findFirst({
      where: { id, deletedAt: null },
    });

    if (!existingClient) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    const dataToUpdate: any = {};

    if (name) dataToUpdate.name = name;
    if (phone !== undefined) dataToUpdate.phone = phone;
    if (status) dataToUpdate.status = status;

    if (email !== undefined) {
      if (email && !validateEmail(email)) {
        return res.status(400).json({ error: 'E-mail em formato inválido' });
      }
      dataToUpdate.email = email;
    }

    if (cpf !== undefined) {
      if (cpf) {
        if (!validateCPF(cpf)) {
          return res.status(400).json({ error: 'CPF inválido' });
        }
        const formattedCPF = formatCPF(cpf);

        // Se mudou o CPF, verificar se já pertence a outro cliente
        if (formattedCPF !== existingClient.cpf) {
          const cpfInUse = await prisma.client.findUnique({
            where: { cpf: formattedCPF },
          });
          if (cpfInUse) {
            return res.status(400).json({ error: 'Já existe um cliente cadastrado com este CPF' });
          }
        }
        dataToUpdate.cpf = formattedCPF;
      } else {
        dataToUpdate.cpf = null;
      }
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data: dataToUpdate,
    });

    // Registrar interação
    await prisma.interaction.create({
      data: {
        type: 'NOTE',
        content: `Cliente atualizado: ${Object.keys(dataToUpdate).join(', ')}`,
        clientId: id,
        userId: req.user!.id,
      },
    });

    await recordAudit({ entity: 'Client', entityId: id, action: 'UPDATE', userId: req.user!.id, changes: dataToUpdate });

    return res.json(updatedClient);
  } catch (error: any) {
    console.error('Erro ao atualizar cliente:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar cliente' });
  }
}

export async function deleteClient(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const client = await prisma.client.findFirst({
      where: { id, deletedAt: null },
    });

    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }

    await prisma.client.update({
      where: { id },
      // Free up the unique cpf slot so a genuinely new client can reuse it; the
      // original value is preserved in the audit trail below.
      data: { deletedAt: new Date(), cpf: null },
    });

    await recordAudit({ entity: 'Client', entityId: id, action: 'DELETE', userId: req.user!.id, changes: client });

    return res.json({ message: 'Cliente excluído com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir cliente:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir cliente' });
  }
}
