import fs from 'fs';
import path from 'path';

const PRISMA_DIR = path.join(__dirname, '..', '..', 'prisma');
const BACKUPS_DIR = path.join(__dirname, '..', '..', 'backups');
const RETENTION_COUNT = 14;

function getSqliteFilePath(): string | null {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('file:')) return null;
  const relativePath = url.slice('file:'.length);
  return path.resolve(PRISMA_DIR, relativePath);
}

export function performBackup(): { file: string; size: number } {
  const dbPath = getSqliteFilePath();
  if (!dbPath || !fs.existsSync(dbPath)) {
    throw new Error('Banco de dados SQLite não encontrado para backup');
  }

  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dbName = path.basename(dbPath, path.extname(dbPath));
  const backupFileName = `${dbName}-${timestamp}.db`;
  const backupPath = path.join(BACKUPS_DIR, backupFileName);

  fs.copyFileSync(dbPath, backupPath);
  pruneOldBackups();

  return { file: backupFileName, size: fs.statSync(backupPath).size };
}

function pruneOldBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return;
  const files = fs.readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => ({ name: f, mtime: fs.statSync(path.join(BACKUPS_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  files.slice(RETENTION_COUNT).forEach((f) => {
    try {
      fs.unlinkSync(path.join(BACKUPS_DIR, f.name));
    } catch {
      // ignore
    }
  });
}

export function listBackupFiles() {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs.readdirSync(BACKUPS_DIR)
    .filter((f) => f.endsWith('.db'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUPS_DIR, f));
      return { name: f, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function scheduleAutoBackup(intervalHours = 24) {
  if (process.env.NODE_ENV === 'test') return;

  const intervalMs = intervalHours * 60 * 60 * 1000;
  setInterval(() => {
    try {
      const result = performBackup();
      console.log(`[backup] Backup automático criado: ${result.file} (${result.size} bytes)`);
    } catch (err) {
      console.error('[backup] Falha ao criar backup automático:', err);
    }
  }, intervalMs).unref();
}
