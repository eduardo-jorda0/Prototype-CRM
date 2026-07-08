import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';

let adminToken: string;
let assessorToken: string;

beforeAll(async () => {
  await prisma.$connect();
  const adminEmail = `admin+test@prototype.${Date.now()}`;
  await request(app).post('/api/auth/register').send({ name: 'AdminTest', email: adminEmail, password: 'pass1234', role: 'ADMIN' });
  const ar = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'pass1234' });
  adminToken = ar.body.token;

  const asEmail = `assessor+test@prototype.${Date.now()}`;
  await request(app).post('/api/auth/register').send({ name: 'AssessTest', email: asEmail, password: 'pass1234', role: 'ASSESSOR' });
  const asr = await request(app).post('/api/auth/login').send({ email: asEmail, password: 'pass1234' });
  assessorToken = asr.body.token;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: 'admin+test' } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { contains: 'assessor+test' } } }).catch(() => {});
  await prisma.client.deleteMany({ where: { name: { contains: 'RBACClient' } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('RBAC enforcement', () => {
  it('assessor cannot delete clients created by others', async () => {
    // Admin creates client
    const c = await request(app).post('/api/clients').set('Authorization', `Bearer ${adminToken}`).send({ name: 'RBACClient' });
    expect(c.status).toBe(201);

    // Assessor attempts delete
    const del = await request(app).delete(`/api/clients/${c.body.id}`).set('Authorization', `Bearer ${assessorToken}`);
    expect([401,403,404]).toContain(del.status);
  }, 20000);
});
