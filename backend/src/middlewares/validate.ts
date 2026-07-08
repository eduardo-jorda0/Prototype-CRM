import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const createClientSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  status: z.string().optional(),
});

export const createTransactionSchema = z.object({
  clientId: z.string().uuid(),
  description: z.string().min(1),
  amount: z.preprocess((v) => Number(v), z.number()),
  type: z.string().min(1),
  status: z.string().optional(),
  date: z.string().optional(),
});

export const updateTransactionSchema = z.object({
  clientId: z.string().uuid().optional(),
  description: z.string().min(1).optional(),
  amount: z.preprocess((v) => Number(v), z.number()).optional(),
  type: z.string().min(1).optional(),
  status: z.string().optional(),
  date: z.string().optional(),
});

export const createLeadSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  value: z.preprocess((v) => Number(v), z.number()).optional(),
  status: z.string().optional(),
  proximaAcao: z.string().optional().nullable(),
  dataFollowUp: z.string().optional().nullable(),
});

export const updateLeadSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  assignedToId: z.string().uuid().optional().nullable(),
  value: z.preprocess((v) => Number(v), z.number()).optional(),
  status: z.string().optional(),
  proximaAcao: z.string().optional().nullable(),
  dataFollowUp: z.string().optional().nullable(),
});

export const updateClientSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  cpf: z.string().optional().nullable(),
  status: z.string().optional(),
});

export const updateLeadStageSchema = z.object({
  status: z.string().min(1),
});

export const addInteractionSchema = z.object({
  type: z.string().min(1),
  content: z.string().min(1),
  leadId: z.string().optional().nullable(),
});

export function validateBody(schema: z.ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Validação falhou', issues: result.error.format() });
    }
    req.body = result.data;
    return next();
  };
}

export const listQuerySchema = z.object({
  page: z.preprocess((v) => Number(v), z.number().int().min(1).default(1)).optional(),
  limit: z.preprocess((v) => Number(v), z.number().int().min(1).max(100).default(10)).optional(),
  search: z.string().optional(),
  status: z.string().optional(),
});

export function validateQuery(schema: z.ZodSchema<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return res.status(400).json({ error: 'Query validation failed', issues: result.error.format() });
    }
    (res as any).locals = (res as any).locals || {};
    (res as any).locals.validatedQuery = result.data;
    return next();
  };
}

export const importExecuteSchema = z.object({
  target: z.enum(['clients', 'leads', 'transactions']),
  rows: z.array(z.record(z.string())).max(5000),
  mapping: z.record(z.string()),
});
