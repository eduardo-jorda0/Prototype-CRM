import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { contains: 'test+' } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Auth', () => {
  it('should register and login a user', async () => {
    const email = `test+${Date.now()}@prototype.test`;

    const reg = await request(app).post('/api/auth/register').send({ name: 'Teste', email, password: 'pass1234' });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toHaveProperty('id');

    const login = await request(app).post('/api/auth/login').send({ email, password: 'pass1234' });
    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty('token');
  }, 20000);
});
