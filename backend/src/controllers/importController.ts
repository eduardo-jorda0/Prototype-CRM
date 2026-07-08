import { Request, Response } from 'express';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import prisma from '../utils/prisma';
import { validateCPF, formatCPF, validateEmail } from '../utils/validators';
import { importExecuteSchema } from '../middlewares/validate';

const KNOWN_TARGETS = ['clients', 'leads', 'transactions'];

function normalizeHeader(header: string) {
  const cleaned = header.toLowerCase().trim();

  if (['nome', 'name', 'cliente'].includes(cleaned)) return 'name';
  if (['email', 'e-mail'].includes(cleaned)) return 'email';
  if (['telefone', 'phone', 'phone1', 'phone2'].includes(cleaned)) return 'phone';
  if (['cpf', 'doc', 'documento'].includes(cleaned)) return 'cpf';
  if (['status', 'situacao'].includes(cleaned)) return 'status';
  if (['titulo', 'title'].includes(cleaned)) return 'title';
  if (['descricao', 'description', 'desc'].includes(cleaned)) return 'description';
  if (['valor', 'value', 'amount'].includes(cleaned)) return 'amount';
  if (['data', 'date', 'dueDate'].includes(cleaned)) return 'date';
  if (['clienteid', 'clientid', 'client_id'].includes(cleaned)) return 'clientId';
  return '';
}

export async function validateImport(req: Request, res: Response) {
  try {
    const target = (req.body.target as string)?.toLowerCase();
    if (!target || !KNOWN_TARGETS.includes(target)) {
      return res.status(400).json({ error: 'Target inválido. Use clients, leads ou transactions.' });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'Arquivo não fornecido.' });
    }

    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!['.xlsx', '.xls', '.csv'].includes(ext)) {
      fs.unlink(file.path, () => {});
      return res.status(400).json({ error: 'Formato de arquivo inválido para importação.' });
    }

    const workbook = xlsx.readFile(file.path, { cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as Array<Array<string>>;

    if (rawRows.length < 2) {
      return res.status(400).json({ error: 'Planilha vazia ou sem cabeçalho.' });
    }

    const headers = rawRows[0].map((header) => String(header || '').trim());
    const preview = rawRows.slice(1, 11).map((row) => {
      const parsed: any = {};
      headers.forEach((header, idx) => {
        parsed[header] = row[idx] ?? '';
      });
      return parsed;
    });

    const suggestions = headers.map((header) => ({
      original: header,
      suggested: normalizeHeader(header),
    }));

    fs.unlink(file.path, () => {});

    return res.json({ target, headers, suggestions, preview });
  } catch (error: any) {
    console.error('Erro ao validar importação:', error);
    return res.status(500).json({ error: 'Erro interno ao validar importação.' });
  }
}

export async function executeImport(req: Request, res: Response) {
  try {
    const { target, rows, mapping } = req.body;
    const lowerTarget = (target as string)?.toLowerCase();

    if (!lowerTarget || !KNOWN_TARGETS.includes(lowerTarget)) {
      return res.status(400).json({ error: 'Target inválido. Use clients, leads ou transactions.' });
    }

    // Validate payload using Zod schema
    try {
      importExecuteSchema.parse({ target: lowerTarget, rows, mapping });
    } catch (err: any) {
      return res.status(400).json({ error: 'Payload inválido para importação', detail: err.errors || err.message });
    }

    const created: any[] = [];
    const errors: any[] = [];

    for (const [index, row] of rows.entries()) {
      const record: any = {};
      Object.entries(mapping).forEach(([targetField, originalHeader]) => {
        record[targetField] = row[originalHeader as string] ?? ''; 
      });

      try {
        if (lowerTarget === 'clients') {
          if (!record.name) throw new Error('Campo name obrigatorio');

          if (record.email && !validateEmail(record.email)) {
            throw new Error('E-mail inválido');
          }

          let formattedCPF: string | null = null;
          if (record.cpf) {
            if (!validateCPF(record.cpf)) throw new Error('CPF inválido');
            formattedCPF = formatCPF(record.cpf);
          }

          const existingClient = formattedCPF
            ? await prisma.client.findUnique({ where: { cpf: formattedCPF } })
            : null;

          if (existingClient) {
            throw new Error('CPF já cadastrado');
          }

          const client = await prisma.client.create({
            data: {
              name: record.name,
              email: record.email || null,
              phone: record.phone || null,
              cpf: formattedCPF,
              status: record.status || 'ATIVO',
            },
          });
          created.push(client);
        } else if (lowerTarget === 'leads') {
          if (!record.title) throw new Error('Campo title obrigatorio');

          let clientId = record.clientId || null;
          if (!clientId && record.clientCpf) {
            const formattedCPF = validateCPF(record.clientCpf) ? formatCPF(record.clientCpf) : null;
            if (formattedCPF) {
              const client = await prisma.client.findUnique({ where: { cpf: formattedCPF } });
              clientId = client?.id || null;
            }
          }

          const lead = await prisma.lead.create({
            data: {
              title: record.title,
              description: record.description || null,
              value: Number(record.amount || 0) || 0,
              status: record.status || 'NOVO',
              clientId,
            },
          });
          created.push(lead);
        } else if (lowerTarget === 'transactions') {
          if (!record.description || record.amount === undefined) {
            throw new Error('Campos description e amount obrigatórios');
          }

          let clientId = record.clientId;
          if (!clientId && record.clientCpf) {
            const formattedCPF = validateCPF(record.clientCpf) ? formatCPF(record.clientCpf) : null;
            if (formattedCPF) {
              const client = await prisma.client.findUnique({ where: { cpf: formattedCPF } });
              clientId = client?.id;
            }
          }

          if (!clientId) throw new Error('clientId ou clientCpf obrigatório');

          const transaction = await prisma.transaction.create({
            data: {
              clientId,
              description: record.description,
              amount: Number(record.amount) || 0,
              type: record.type || 'ENTRADA',
              status: record.status || 'PENDENTE',
              date: record.date ? new Date(record.date) : new Date(),
            },
          });
          created.push(transaction);
        }
      } catch (error: any) {
        errors.push({ row: index + 1, error: error.message || 'Erro desconhecido' });
      }
    }

    return res.json({ created, errors, total: rows.length });
  } catch (error: any) {
    console.error('Erro ao executar importação:', error);
    return res.status(500).json({ error: 'Erro interno ao executar importação.' });
  }
}
