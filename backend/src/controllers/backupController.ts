import { Request, Response } from 'express';
import { performBackup, listBackupFiles } from '../utils/backup';

export async function runBackupNow(_req: Request, res: Response) {
  try {
    const result = performBackup();
    return res.status(201).json(result);
  } catch (error: any) {
    console.error('Erro ao executar backup:', error);
    return res.status(500).json({ error: error.message || 'Erro interno ao executar backup' });
  }
}

export async function listBackups(_req: Request, res: Response) {
  try {
    const files = listBackupFiles();
    return res.json({ data: files });
  } catch (error: any) {
    console.error('Erro ao listar backups:', error);
    return res.status(500).json({ error: 'Erro interno ao listar backups' });
  }
}
