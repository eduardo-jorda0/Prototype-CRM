import prisma from '../src/utils/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  console.log('🌱 Iniciando seed do banco...');

  // 1️⃣ LIMPAR DADOS ANTIGOS (cuidado em produção!)
  await prisma.interaction.deleteMany({});
  await prisma.transaction.deleteMany({});
  await prisma.lead.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ Dados antigos limpos');

  // 2️⃣ CRIAR USUÁRIOS (Atualizados para @prototype.com)
  const hashedPassword = await bcrypt.hash('123456', 10);

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin System',
      email: 'admin@prototype.com',
      password: hashedPassword,
      role: 'ADMIN' as any,
    },
  });

  const closerUser = await prisma.user.create({
    data: {
      name: 'João Vendedor',
      email: 'joao@prototype.com',
      password: hashedPassword,
      role: 'CLOSER' as any,
    },
  });

  const assessorUser = await prisma.user.create({
    data: {
      name: 'Maria Assessora',
      email: 'maria@prototype.com',
      password: hashedPassword,
      role: 'ASSESSOR' as any,
    },
  });

  console.log('✅ Usuários criados');
  console.log('    📧 Admin: admin@prototype.com');
  console.log('    📧 Closer: joao@prototype.com');
  console.log('    📧 Assessor: maria@prototype.com');
  console.log('    🔑 Senha de todos: 123456');

  // 3️⃣ CRIAR CLIENTES REALISTAS
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        name: 'Acme Corporation Brasil',
        email: 'contato@acmebr.com.br',
        phone: '(11) 3456-7890',
        cpf: '12.345.678/0001-90',
        status: 'ATIVO',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Tech Solutions LTDA',
        email: 'vendas@techsolutions.com.br',
        phone: '(21) 98765-4321',
        cpf: '98.765.432/0001-10',
        status: 'ATIVO',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Comércio Eletrônico XYZ',
        email: 'contato@xyzcomerce.com.br',
        phone: '(85) 3333-3333',
        cpf: '11.111.111/0001-11',
        status: 'ATIVO',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Consultoria & Estratégia',
        email: 'info@consultorapremium.com.br',
        phone: '(31) 99999-8888',
        cpf: '22.222.222/0001-22',
        status: 'ATIVO',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Logística Express',
        email: 'atendimento@logisticaexpress.com.br',
        phone: '(47) 3456-7890',
        cpf: '33.333.333/0001-33',
        status: 'ATIVO',
      },
    }),
    prisma.client.create({
      data: {
        name: 'Manufactura 4.0',
        email: 'manufatura@industrial.com.br',
        phone: '(41) 2222-3333',
        cpf: '44.444.444/0001-44',
        status: 'INATIVO',
      },
    }),
  ]);

  console.log(`✅ ${clients.length} clientes criados`);

  // 4️⃣ CRIAR LEADS COM DIFERENTES ESTÁGIOS
  const leads = await Promise.all([
    prisma.lead.create({
      data: {
        title: 'Contrato Enterprise - Acme Corp',
        description: 'Oportunidade de venda grande. Cliente procurando solução integrada.',
        status: 'NOVO',
        value: 150000,
        clientId: clients[0].id,
        assignedToId: closerUser.id,
      },
    }),
    prisma.lead.create({
      data: {
        title: 'Implementação Cloud - Tech Solutions',
        description: 'Cliente interessado em migrar infraestrutura para nuvem. Já teve reunião inicial.',
        status: 'NOVO',
        value: 75000,
        clientId: clients[1].id,
        assignedToId: closerUser.id,
        proximaAcao: 'Ligar para alinhar escopo',
        dataFollowUp: new Date(),
      },
    }),
    prisma.lead.create({
      data: {
        title: 'Pacote Premium - E-commerce XYZ',
        description: 'Proposta enviada em 25/06. Cliente avaliando. Reunião de fechamento marcada.',
        status: 'PROPOSTA',
        value: 45000,
        clientId: clients[2].id,
        assignedToId: closerUser.id,
        proximaAcao: 'Enviar contrato revisado',
        dataFollowUp: new Date('2026-07-01'),
      },
    }),
    prisma.lead.create({
      data: {
        title: 'Consultoria Estratégica - Consultoria Premium',
        description: 'Em negociação de preço e escopo. Cliente quer desconto de 15%.',
        status: 'NEGOCIACAO',
        value: 60000,
        clientId: clients[3].id,
        assignedToId: assessorUser.id,
        proximaAcao: 'Retornar com proposta de desconto',
        dataFollowUp: new Date('2026-07-10'),
      },
    }),
    prisma.lead.create({
      data: {
        title: 'Contrato Fechado - Logística Express',
        description: 'Contrato assinado em 28/06. Início da implementação em 01/07.',
        status: 'GANHO',
        value: 120000,
        clientId: clients[4].id,
        assignedToId: assessorUser.id,
      },
    }),
    prisma.lead.create({
      data: {
        title: 'Manufatura 4.0 - Oportunidade Perdida',
        description: 'Cliente escolheu concorrente. Foco em preço menor.',
        status: 'PERDIDO',
        value: 95000,
        clientId: clients[5].id,
        assignedToId: assessorUser.id,
      },
    }),
  ]);

  console.log(`✅ ${leads.length} leads criados com diferentes estágios`);

  // 5️⃣ CRIAR TRANSAÇÕES (Alinhadas com o ano corrente de 2026)
  const transactions = await Promise.all([
    prisma.transaction.create({
      data: {
        description: 'Pagamento - Serviços prestados Junho',
        amount: 25000,
        type: 'ENTRADA',
        status: 'PAGO',
        date: new Date('2026-06-30'),
        clientId: clients[4].id,
      },
    }),
    prisma.transaction.create({
      data: {
        description: 'Fatura #001 - Suporte técnico',
        amount: 5000,
        type: 'ENTRADA',
        status: 'PAGO',
        date: new Date('2026-06-28'),
        clientId: clients[1].id,
      },
    }),
    prisma.transaction.create({
      data: {
        description: 'Adiantamento de contrato anual',
        amount: 50000,
        type: 'ENTRADA',
        status: 'PENDENTE',
        date: new Date('2026-07-05'),
        clientId: clients[0].id,
      },
    }),
    prisma.transaction.create({
      data: {
        description: 'Reembolso de passagens aéreas',
        amount: 3200,
        type: 'SAIDA',
        status: 'PAGO',
        date: new Date('2026-06-25'),
        clientId: clients[0].id,
      },
    }),
    prisma.transaction.create({
      data: {
        description: 'Material para apresentação ao cliente',
        amount: 1500,
        type: 'SAIDA',
        status: 'PENDENTE',
        date: new Date('2026-07-02'),
        clientId: clients[2].id,
      },
    }),
  ]);

  console.log(`✅ ${transactions.length} transações criadas`);

  // 6️⃣ CRIAR INTERAÇÕES/TIMELINE
  const interactions = await Promise.all([
    prisma.interaction.create({
      data: {
        type: 'CALL',
        content: 'Ligação para briefing inicial. Cliente muito interessado. Agendou reunião para 30/06.',
        clientId: clients[0].id,
        leadId: leads[0].id,
        userId: closerUser.id,
        date: new Date('2026-06-27'),
      },
    }),
    prisma.interaction.create({
      data: {
        type: 'EMAIL',
        content: 'Enviado orçamento detalhado com 3 propostas diferentes.',
        clientId: clients[2].id,
        leadId: leads[2].id,
        userId: closerUser.id,
        date: new Date('2026-06-25'),
      },
    }),
    prisma.interaction.create({
      data: {
        type: 'MEETING',
        content: 'Reunião presencial. Apresentação técnica. Cliente validou todas as funcionalidades solicitadas.',
        clientId: clients[1].id,
        leadId: leads[1].id,
        userId: assessorUser.id,
        date: new Date('2026-06-24'),
      },
    }),
    prisma.interaction.create({
      data: {
        type: 'NOTE',
        content: 'Negociação em andamento. CTO solicitou benchmark com 2 concorrentes. Prazo: 48h.',
        clientId: clients[3].id,
        leadId: leads[3].id,
        userId: closerUser.id,
        date: new Date('2026-06-29'),
      },
    }),
    prisma.interaction.create({
      data: {
        type: 'MEETING',
        content: 'Reunião de assinatura do contrato. Todos os termos acordados. Implementação começa 01/07.',
        clientId: clients[4].id,
        leadId: leads[4].id,
        userId: adminUser.id,
        date: new Date('2026-06-28'),
      },
    }),
    prisma.interaction.create({
      data: {
        type: 'NOTE',
        content: 'Cliente não respondeu últimas 2 tentativas. Possível perda de oportunidade.',
        clientId: clients[5].id,
        leadId: leads[5].id,
        userId: closerUser.id,
        date: new Date('2026-06-26'),
      },
    }),
  ]);

  console.log(`✅ ${interactions.length} interações criadas`);

  // 7️⃣ RESUMO FINAL (Porta ajustada para o seu Vite local)
  console.log('\n' + '='.repeat(50));
  console.log('✨ SEED CONCLUÍDO COM SUCESSO! ✨');
  console.log('='.repeat(50));
  console.log(`
📊 DADOS DE DEMONSTRAÇÃO CRIADOS:
  👥 Usuários: 3
      - Admin: admin@prototype.com
      - Closer: joao@prototype.com
      - Assessor: maria@prototype.com
      - Senha para todos: 123456

  🏢 Clientes: ${clients.length}
  🎯 Leads: ${leads.length} (Distribuídos no Kanban)
  💰 Transações: ${transactions.length} (Dados de Fluxo de Caixa)
  💬 Interações: ${interactions.length} (Linha do Tempo preenchida)

🎬 PRÓXIMO PASSO PARA APRESENTAÇÃO:
  1. Certifique-se de que o backend e frontend estão rodando (npm run dev)
  2. Acesse http://localhost:5173
  3. Faça login com admin@prototype.com / 123456
  4. Encante sua audiência com os dados!
  `);

  console.log('='.repeat(50));
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
