import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import path from 'path';
import apiRoutes from './routes/api';
const swaggerUi = require('swagger-ui-express');
const openapi = require('../docs/openapi.updated.json');
import prisma from './utils/prisma';
import { scheduleAutoBackup } from './utils/backup';

dotenv.config();

const app = express();

scheduleAutoBackup(Number(process.env.BACKUP_INTERVAL_HOURS) || 24);

// Security + logging
app.use(helmet());
app.use(cors());
app.use(morgan('tiny'));
app.use(
  rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // limit each IP
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
const uploadsDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsDir));

app.use('/api', apiRoutes);

// Swagger UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openapi));

app.get('/', (_req, res) => {
  res.json({ message: 'prototype CRM backend is running' });
});

app.post('/api/system/seed', (_req, res) => {
  try {
    const { exec } = require('child_process');
    // Run seed command in the backend directory
    exec('npx ts-node prisma/seed.ts', { cwd: path.join(__dirname, '..') }, (error: any, stdout: any, stderr: any) => {
      if (error) {
        console.error(`Seed exec error: ${error}`);
        res.status(500).json({ error: error.message, stderr });
        return;
      }
      res.json({ success: true, stdout });
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/launcher', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../index.html'));
});

app.get('/health', async (_req, res) => {
  try {
    await prisma.$connect();
    await prisma.$disconnect();
    return res.json({ status: 'ok' });
  } catch (err) {
    return res.status(500).json({ status: 'error', detail: String(err) });
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
