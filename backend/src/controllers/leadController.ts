import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { recordAudit } from '../utils/audit';

const VALID_STAGES = ['NOVO', 'PROPOSTA', 'NEGOCIACAO', 'GANHO', 'PERDIDO'];

function normalizeStage(status?: string) {
  if (!status) return undefined;
  return status.toUpperCase();
}

function parseCurrencyValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return 0;

  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  return Number(normalized) || 0;
}

function getLeadImportField(row: any, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return '';
}

function parseFollowUpDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function createLead(req: Request, res: Response) {
  try {
    const { title, description, clientId, assignedToId, value, status, proximaAcao, dataFollowUp } = req.body;
    const currentUser = req.user;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return res.status(400).json({ error: 'O título do lead é obrigatório' });
    }

    if (!currentUser) {
      return res.status(401).json({ error: 'Usuario nao autenticado' });
    }

    const leadAssigneeId = assignedToId || currentUser.id;

    if (currentUser.role !== 'ADMIN' && leadAssigneeId !== currentUser.id) {
      return res.status(403).json({ error: 'Vendedores so podem criar leads para si mesmos' });
    }

    if (clientId) {
      const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
      if (!client) {
        return res.status(404).json({ error: 'Cliente não encontrado' });
      }
    }

    if (leadAssigneeId) {
      const user = await prisma.user.findUnique({ where: { id: leadAssigneeId } });
      if (!user) {
        return res.status(404).json({ error: 'Usuário responsável não encontrado' });
      }
    }

    const normalizedStatus = normalizeStage(status);
    if (normalizedStatus && !VALID_STAGES.includes(normalizedStatus)) {
      return res.status(400).json({ error: `Status inválido. Valores válidos: ${VALID_STAGES.join(', ')}` });
    }

    const lead = await prisma.lead.create({
      data: {
        title: title.trim(),
        description: description || null,
        clientId: clientId || null,
        assignedToId: leadAssigneeId,
        value: Number(value) || 0,
        status: normalizedStatus || 'NOVO',
        proximaAcao: proximaAcao || null,
        dataFollowUp: parseFollowUpDate(dataFollowUp),
      },
      include: {
        client: { select: { id: true, name: true, cpf: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
    });

    await recordAudit({ entity: 'Lead', entityId: lead.id, action: 'CREATE', userId: currentUser.id, changes: lead });

    return res.status(201).json(lead);
  } catch (error: any) {
    console.error('Erro ao criar lead:', error);
    return res.status(500).json({ error: 'Erro interno ao criar lead' });
  }
}

export async function importLeads(req: Request, res: Response) {
  try {
    const currentUser = req.user;
    const rows = Array.isArray(req.body) ? req.body : req.body?.leads;

    if (!currentUser) {
      return res.status(401).json({ error: 'Usuario nao autenticado' });
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'Envie um array de leads para importar' });
    }

    if (rows.length > 500) {
      return res.status(400).json({ error: 'Importacao limitada a 500 leads por envio' });
    }

    const emails = Array.from(new Set(
      rows
        .map((row: any) => getLeadImportField(row, ['vendedor_email', 'email_vendedor', 'seller_email', 'assignedToEmail']).toLowerCase())
        .filter(Boolean),
    ));

    const users = await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, name: true, email: true, role: true },
    });
    const usersByEmail = new Map(users.map((user) => [user.email.toLowerCase(), user]));

    const missingEmails = emails.filter((email) => !usersByEmail.has(email));
    if (missingEmails.length > 0) {
      return res.status(400).json({ error: `Vendedor nao encontrado: ${missingEmails.join(', ')}` });
    }

    const createdLeads = await prisma.$transaction(async (tx) => {
      const created = [];

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const title = getLeadImportField(row, ['nome_lead', 'lead_nome', 'nome', 'title', 'lead', 'Nome do Lead']);
        const company = getLeadImportField(row, ['empresa', 'company', 'cliente', 'client', 'Empresa']);
        const sellerEmail = getLeadImportField(row, ['vendedor_email', 'email_vendedor', 'seller_email', 'assignedToEmail']).toLowerCase();
        const description = getLeadImportField(row, ['descricao', 'description', 'observacao', 'observacoes']);
        const rawStatus = getLeadImportField(row, ['status', 'etapa', 'stage']);
        const normalizedStatus = normalizeStage(rawStatus) || 'NOVO';
        const proximaAcao = getLeadImportField(row, ['proxima_acao', 'proximaacao', 'next_action']);
        const dataFollowUp = getLeadImportField(row, ['data_follow_up', 'datafollowup', 'follow_up_date']);

        if (!title) {
          throw new Error(`Linha ${index + 1}: nome do lead obrigatorio`);
        }

        if (!company) {
          throw new Error(`Linha ${index + 1}: empresa obrigatoria`);
        }

        if (!sellerEmail) {
          throw new Error(`Linha ${index + 1}: vendedor_email obrigatorio`);
        }

        if (!VALID_STAGES.includes(normalizedStatus)) {
          throw new Error(`Linha ${index + 1}: status invalido`);
        }

        const assignedUser = usersByEmail.get(sellerEmail);
        if (!assignedUser) {
          throw new Error(`Linha ${index + 1}: vendedor nao encontrado`);
        }

        if (currentUser.role !== 'ADMIN' && assignedUser.id !== currentUser.id) {
          throw new Error(`Linha ${index + 1}: vendedores so podem importar leads para si mesmos`);
        }

        const client = await tx.client.create({
          data: {
            name: company,
            status: 'ATIVO',
          },
        });

        const lead = await tx.lead.create({
          data: {
            title,
            description: description || null,
            clientId: client.id,
            assignedToId: assignedUser.id,
            value: parseCurrencyValue(row.valor_estimado ?? row.valor ?? row.value ?? row.amount),
            status: normalizedStatus,
            proximaAcao: proximaAcao || null,
            dataFollowUp: parseFollowUpDate(dataFollowUp),
          },
          include: {
            client: { select: { id: true, name: true, cpf: true } },
            assignedTo: { select: { id: true, name: true, email: true, role: true } },
          },
        });

        created.push(lead);
      }

      return created;
    });

    await Promise.all(createdLeads.map((lead) =>
      recordAudit({ entity: 'Lead', entityId: lead.id, action: 'CREATE', userId: currentUser.id, changes: { source: 'import' } }),
    ));

    return res.status(201).json({
      data: createdLeads,
      meta: { imported: createdLeads.length },
    });
  } catch (error: any) {
    console.error('Erro ao importar leads:', error);
    return res.status(400).json({ error: error.message || 'Erro interno ao importar leads' });
  }
}

export async function getLeadById(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const lead = await prisma.lead.findFirst({
      where: { id, deletedAt: null },
      include: {
        client: { select: { id: true, name: true, cpf: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
        interactions: {
          orderBy: { date: 'desc' },
          take: 50,
          include: {
            user: { select: { id: true, name: true, role: true } },
          },
        },
      },
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    return res.json(lead);
  } catch (error: any) {
    console.error('Erro ao obter lead:', error);
    return res.status(500).json({ error: 'Erro interno ao obter lead' });
  }
}

export async function listLeads(req: Request, res: Response) {
  try {
    const q: any = (res as any).locals?.validatedQuery || req.query;
    const { status, search, page = '1', limit = '20' } = q;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = { deletedAt: null };

    if (status) {
      whereClause.status = status as string;
    }

    if (search) {
      whereClause.OR = [
        { title: { contains: search as string } },
        { description: { contains: search as string } },
        { client: { name: { contains: search as string } } },
      ];
    }

    // RBAC scoping: Assessors/Closers see only leads assigned to them
    const user = req.user;
    if (user && (user.role === 'ASSESSOR' || user.role === 'CLOSER')) {
      whereClause.assignedToId = user.id;
    }

    const [leads, total] = await prisma.$transaction([
      prisma.lead.findMany({
        where: whereClause,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          client: { select: { id: true, name: true, cpf: true } },
          assignedTo: { select: { id: true, name: true, role: true } },
        },
      }),
      prisma.lead.count({ where: whereClause }),
    ]);

    return res.json({
      data: leads,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar leads:', error);
    return res.status(500).json({ error: 'Erro interno ao listar leads' });
  }
}

export async function updateLead(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { title, description, clientId, assignedToId, value, status, proximaAcao, dataFollowUp } = req.body;

    const existingLead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!existingLead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    if (clientId !== undefined) {
      if (clientId) {
        const client = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
        if (!client) {
          return res.status(404).json({ error: 'Cliente não encontrado' });
        }
      }
    }

    if (assignedToId !== undefined) {
      if (assignedToId) {
        const user = await prisma.user.findUnique({ where: { id: assignedToId } });
        if (!user) {
          return res.status(404).json({ error: 'Usuário responsável não encontrado' });
        }
      }
    }

    const dataToUpdate: any = {};
    if (title !== undefined) {
      if (!title || typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({ error: 'O título do lead é obrigatório' });
      }
      dataToUpdate.title = title.trim();
    }
    if (description !== undefined) dataToUpdate.description = description || null;
    if (clientId !== undefined) dataToUpdate.clientId = clientId || null;
    if (assignedToId !== undefined) dataToUpdate.assignedToId = assignedToId || null;
    if (value !== undefined) dataToUpdate.value = Number(value) || 0;
    if (proximaAcao !== undefined) dataToUpdate.proximaAcao = proximaAcao || null;
    if (dataFollowUp !== undefined) dataToUpdate.dataFollowUp = parseFollowUpDate(dataFollowUp);
    if (status !== undefined) {
      const normalizedStatus = normalizeStage(status);
      if (!normalizedStatus || !VALID_STAGES.includes(normalizedStatus)) {
        return res.status(400).json({ error: `Status inválido. Valores válidos: ${VALID_STAGES.join(', ')}` });
      }
      dataToUpdate.status = normalizedStatus;
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: dataToUpdate,
      include: {
        client: { select: { id: true, name: true, cpf: true } },
        assignedTo: { select: { id: true, name: true, role: true } },
      },
    });

    await recordAudit({ entity: 'Lead', entityId: id, action: 'UPDATE', userId: req.user!.id, changes: dataToUpdate });

    return res.json(updatedLead);
  } catch (error: any) {
    console.error('Erro ao atualizar lead:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar lead' });
  }
}

export async function updateLeadStage(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };
    const { status } = req.body;

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ error: 'Status do lead obrigatório' });
    }

    const normalizedStatus = normalizeStage(status);
    if (!normalizedStatus || !VALID_STAGES.includes(normalizedStatus)) {
      return res.status(400).json({ error: `Status inválido. Valores válidos: ${VALID_STAGES.join(', ')}` });
    }

    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });

    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrada' });
    }

    const updatedLead = await prisma.lead.update({
      where: { id },
      data: { status: normalizedStatus },
    });

    await recordAudit({ entity: 'Lead', entityId: id, action: 'UPDATE', userId: req.user!.id, changes: { status: normalizedStatus } });

    return res.json(updatedLead);
  } catch (error: any) {
    console.error('Erro ao atualizar status do lead:', error);
    return res.status(500).json({ error: 'Erro interno ao atualizar lead' });
  }
}

export async function deleteLead(req: Request, res: Response) {
  try {
    const { id } = req.params as { id: string };

    const lead = await prisma.lead.findFirst({ where: { id, deletedAt: null } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead não encontrado' });
    }

    await prisma.lead.update({ where: { id }, data: { deletedAt: new Date() } });

    await recordAudit({ entity: 'Lead', entityId: id, action: 'DELETE', userId: req.user!.id, changes: lead });

    return res.json({ message: 'Lead excluído com sucesso' });
  } catch (error: any) {
    console.error('Erro ao excluir lead:', error);
    return res.status(500).json({ error: 'Erro interno ao excluir lead' });
  }
}

export async function getDashboardMetrics(req: Request, res: Response) {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      return res.status(401).json({ error: 'Usuario nao autenticado' });
    }

    const whereClause: any = { deletedAt: null };
    if (currentUser.role === 'ASSESSOR' || currentUser.role === 'CLOSER') {
      whereClause.assignedToId = currentUser.id;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const [totalLeads, wonLeads, wonLeadsThisMonth] = await Promise.all([
      prisma.lead.count({ where: whereClause }),
      prisma.lead.count({ where: { ...whereClause, status: 'GANHO' } }),
      prisma.lead.findMany({
        where: {
          ...whereClause,
          status: 'GANHO',
          updatedAt: { gte: monthStart, lt: monthEnd },
        },
        select: { value: true },
      }),
    ]);

    const receitaDoMes = wonLeadsThisMonth.reduce((sum, lead) => sum + Number(lead.value || 0), 0);
    const taxaConversao = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    return res.json({
      receitaDoMes,
      taxaConversao,
      totalLeads,
      wonLeads,
    });
  } catch (error: any) {
    console.error('Erro ao calcular métricas do dashboard:', error);
    return res.status(500).json({ error: 'Erro interno ao calcular métricas do dashboard' });
  }
}
