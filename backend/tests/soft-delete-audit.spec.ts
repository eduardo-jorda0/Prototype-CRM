import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';

let adminToken: string;
let assessorToken: string;

beforeAll(async () => {
  await prisma.$connect();
  const adminEmail = `admin+sda@prototype.${Date.now()}`;
  await request(app).post('/api/auth/register').send({ name: 'AdminSDA', email: adminEmail, password: 'pass1234', role: 'ADMIN' });
  const ar = await request(app).post('/api/auth/login').send({ email: adminEmail, password: 'pass1234' });
  adminToken = ar.body.token;

  const asEmail = `assessor+sda@prototype.${Date.now()}`;
  await request(app).post('/api/auth/register').send({ name: 'AssessorSDA', email: asEmail, password: 'pass1234', role: 'ASSESSOR' });
  const asr = await request(app).post('/api/auth/login').send({ email: asEmail, password: 'pass1234' });
  assessorToken = asr.body.token;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({}).catch(() => {});
  await prisma.client.deleteMany({ where: { name: { contains: 'SoftDeleteClient' } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { contains: '+sda@prototype' } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Soft delete', () => {
  it('removes a client from listings without hard-deleting the row, and records an audit log', async () => {
    const created = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'SoftDeleteClient' });
    expect(created.status).toBe(201);
    const clientId = created.body.id;

    const del = await request(app).delete(`/api/clients/${clientId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(del.status).toBe(200);

    // Row still exists in the database, just flagged as deleted
    const rawRow = await prisma.client.findUnique({ where: { id: clientId } });
    expect(rawRow).not.toBeNull();
    expect(rawRow?.deletedAt).not.toBeNull();

    // No longer reachable via the API
    const getRes = await request(app).get(`/api/clients/${clientId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(404);

    const listRes = await request(app).get('/api/clients?limit=100').set('Authorization', `Bearer ${adminToken}`);
    expect(listRes.body.data.some((c: any) => c.id === clientId)).toBe(false);

    // Audit trail captured the delete
    const auditRes = await request(app)
      .get(`/api/audit-logs?entity=Client&entityId=${clientId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.data.some((log: any) => log.action === 'DELETE')).toBe(true);
    expect(auditRes.body.data.some((log: any) => log.action === 'CREATE')).toBe(true);
  }, 30000);
});

describe('Audit log access control', () => {
  it('is only reachable by ADMIN', async () => {
    const res = await request(app).get('/api/audit-logs').set('Authorization', `Bearer ${assessorToken}`);
    expect(res.status).toBe(403);
  });
});

describe('Search', () => {
  it('no longer 500s on clients/leads search (SQLite does not support Prisma mode:insensitive)', async () => {
    const clientsRes = await request(app).get('/api/clients?search=acme').set('Authorization', `Bearer ${adminToken}`);
    expect(clientsRes.status).toBe(200);

    const leadsRes = await request(app).get('/api/leads?search=contrato').set('Authorization', `Bearer ${adminToken}`);
    expect(leadsRes.status).toBe(200);

    const transactionsRes = await request(app).get('/api/transactions?search=pagamento').set('Authorization', `Bearer ${adminToken}`);
    expect(transactionsRes.status).toBe(200);
  }, 20000);
});
