import dotenv from 'dotenv';
import path from 'path';
import { performBackup } from '../src/utils/backup';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

try {
  const result = performBackup();
  console.log(`Backup criado: ${result.file} (${result.size} bytes)`);
} catch (err) {
  console.error('Falha ao criar backup:', err);
  process.exit(1);
}
