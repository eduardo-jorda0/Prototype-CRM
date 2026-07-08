import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';

let token: string;

beforeAll(async () => {
  await prisma.$connect();
  const email = `test+client@prototype.${Date.now()}`;
  await request(app).post('/api/auth/register').send({ name: 'ClientTest', email, password: 'pass1234' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'pass1234' });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.client.deleteMany({ where: { name: { contains: 'ClientTest' } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { contains: 'test+client' } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Clients', () => {
  it('should create and list clients', async () => {
    const create = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'ClientTest', email: 'client@test.local' });
    expect(create.status).toBe(201);
    const list = await request(app).get('/api/clients').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
  }, 20000);
});
