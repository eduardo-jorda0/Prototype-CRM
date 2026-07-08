import prisma from './prisma';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export async function recordAudit(params: {
  entity: string;
  entityId: string;
  action: AuditAction;
  userId: string;
  changes?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        userId: params.userId,
        changes: params.changes ? JSON.stringify(params.changes) : null,
      },
    });
  } catch (err) {
    console.error('Falha ao registrar log de auditoria:', err);
  }
}
