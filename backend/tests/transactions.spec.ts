import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';

let token: string;

beforeAll(async () => {
  await prisma.$connect();
  const email = `test+txn@prototype.${Date.now()}`;
  await request(app).post('/api/auth/register').send({ name: 'TxnUser', email, password: 'pass1234' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'pass1234' });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.transaction.deleteMany({ where: { description: { contains: 'TxnTest' } } }).catch(() => {});
  await prisma.client.deleteMany({ where: { name: { contains: 'ClientForTxn' } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { contains: 'test+txn' } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Transactions', () => {
  it('should create and list transactions', async () => {
    const clientRes = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ name: 'ClientForTxn' });
    expect(clientRes.status).toBe(201);

    const tx = { clientId: clientRes.body.id, description: 'TxnTest', amount: 100.5, type: 'ENTRADA' };
    const create = await request(app).post('/api/transactions').set('Authorization', `Bearer ${token}`).send(tx);
    expect(create.status).toBe(201);

    const list = await request(app).get('/api/transactions').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
  }, 20000);
});
