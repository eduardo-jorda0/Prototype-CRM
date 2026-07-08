import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export async function listAuditLogs(req: Request, res: Response) {
  try {
    const q: any = (res as any).locals?.validatedQuery || req.query;
    const { entity, entityId, page = '1', limit = '20' } = q;
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const whereClause: any = {};
    if (entity) whereClause.entity = entity as string;
    if (entityId) whereClause.entityId = entityId as string;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
      prisma.auditLog.count({ where: whereClause }),
    ]);

    return res.json({
      data: logs,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Erro ao listar logs de auditoria:', error);
    return res.status(500).json({ error: 'Erro interno ao listar logs de auditoria' });
  }
}
