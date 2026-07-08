import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

export async function listUploads(req: Request, res: Response) {
  try {
    const pageNum = Math.max(parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(String(req.query.limit ?? '20'), 10) || 20, 1), 100);

    if (!fs.existsSync(uploadsDir)) {
      return res.json({ files: [], meta: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 } });
    }

    const files = await fs.promises.readdir(uploadsDir);
    const total = files.length;
    const start = (pageNum - 1) * limitNum;
    const items = files
      .slice(start, start + limitNum)
      .map((f) => ({ name: f, url: `/uploads/${encodeURIComponent(f)}` }));

    return res.json({
      files: items,
      meta: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
    });
  } catch (err) {
    return res.status(500).json({ error: 'Unable to read uploads' });
  }
}

export async function deleteUpload(req: Request, res: Response) {
  try {
    const { filename } = req.params as { filename: string };
    const safeName = path.basename(filename);
    const filePath = path.join(uploadsDir, safeName);
    await fs.promises.unlink(filePath);
    return res.json({ message: 'Deleted' });
  } catch (err) {
    return res.status(500).json({ error: 'Unable to delete file' });
  }
}

export function cleanupUploads(olderThanHours = 24) {
  const cutoff = Date.now() - olderThanHours * 3600 * 1000;
  if (!fs.existsSync(uploadsDir)) return 0;
  const files = fs.readdirSync(uploadsDir);
  let removed = 0;
  files.forEach((f) => {
    const p = path.join(uploadsDir, f);
    const stat = fs.statSync(p);
    if (stat.mtime.getTime() < cutoff) {
      try {
        fs.unlinkSync(p);
        removed++;
      } catch (e) {
        // ignore
      }
    }
  });
  return removed;
}
