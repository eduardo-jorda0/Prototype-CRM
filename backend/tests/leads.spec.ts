import request from 'supertest';
import app from '../src/index';
import prisma from '../src/utils/prisma';

let token: string;

beforeAll(async () => {
  await prisma.$connect();
  const email = `test+leads@prototype.${Date.now()}`;
  await request(app).post('/api/auth/register').send({ name: 'LeadUser', email, password: 'pass1234' });
  const res = await request(app).post('/api/auth/login').send({ email, password: 'pass1234' });
  token = res.body.token;
});

afterAll(async () => {
  await prisma.lead.deleteMany({ where: { title: { contains: 'TestLead' } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { email: { contains: 'test+leads' } } }).catch(() => {});
  await prisma.$disconnect();
});

describe('Leads', () => {
  it('should create a lead via import execute and list leads', async () => {
    // create a client first
    const clientRes = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ name: 'ClientForLead' });
    expect(clientRes.status).toBe(201);

    const lead = { title: 'TestLead', clientId: clientRes.body.id };
    const importRes = await request(app).post('/api/import/execute').set('Authorization', `Bearer ${token}`).send({ target: 'leads', rows: [lead], mapping: { title: 'title', clientId: 'clientId' } });
    expect(importRes.status).toBe(200);

    const list = await request(app).get('/api/leads').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data)).toBe(true);
  }, 30000);

  it('should create, read, update and delete a lead through the dedicated endpoints', async () => {
    const clientRes = await request(app).post('/api/clients').set('Authorization', `Bearer ${token}`).send({ name: 'ClientForLeadCrud' });
    expect(clientRes.status).toBe(201);

    const createRes = await request(app)
      .post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Lead CRUD',
        description: 'Lead para testar CRUD',
        clientId: clientRes.body.id,
        value: 1500,
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body).toHaveProperty('id');

    const leadId = createRes.body.id;

    const getRes = await request(app).get(`/api/leads/${leadId}`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe('Lead CRUD');

    const updateRes = await request(app)
      .put(`/api/leads/${leadId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'PROPOSTA' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('PROPOSTA');

    const deleteRes = await request(app).delete(`/api/leads/${leadId}`).set('Authorization', `Bearer ${token}`);
    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error).toBe('Acesso não autorizado para esta função');
  }, 30000);
});
