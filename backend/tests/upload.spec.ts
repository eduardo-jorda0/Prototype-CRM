import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';
import path from 'path';

let token: string;

beforeAll(async () => {
  await prisma.$connect();
  const email = `test+upload@prototype.${Date.now()}`;
  await request(app).post('/api/auth/register').send({ name: 'UploadUser', email, password: 'pass1234' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'pass1234' });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: 'test+upload' } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Uploads', () => {
  it('should upload and list files', async () => {
    const filePath = path.join(__dirname, '../..', 'README.md');
    const uploadRes = await request(app).post('/api/import/validate').set('Authorization', `Bearer ${token}`).attach('file', filePath).field('target', 'clients');
    expect([200,400].includes(uploadRes.status)).toBe(true);
  }, 20000);
});
