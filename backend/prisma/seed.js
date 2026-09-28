const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar regiões
  const regiao1 = await prisma.region.upsert({
    where: { code: 'SP' },
    update: {},
    create: {
      name: 'São Paulo',
      code: 'SP',
      country: 'Brasil',
      state: 'São Paulo',
      isActive: true
    }
  });

  const regiao2 = await prisma.region.upsert({
    where: { code: 'RJ' },
    update: {},
    create: {
      name: 'Rio de Janeiro',
      code: 'RJ',
      country: 'Brasil',
      state: 'Rio de Janeiro',
      isActive: true
    }
  });

  const regiao3 = await prisma.region.upsert({
    where: { code: 'SUL' },
    update: {},
    create: {
      name: 'Região Sul',
      code: 'SUL',
      country: 'Brasil',
      isActive: true
    }
  });

  // Criar usuários com senhas hasheadas
  const master = await prisma.user.upsert({
    where: { email: 'chorstconsult@gmail.com' },
    update: {
      name: 'Master Admin',
      role: 'MASTER',
      quota: 999999
    },
    create: {
      name: 'Master Admin',
      email: 'chorstconsult@gmail.com',
      password: await bcrypt.hash('Admin@2026', 10),
      role: 'MASTER',
      quota: 999999
    }
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@crm.com' },
    update: {},
    create: {
      name: 'Administrador',
      email: 'admin@crm.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
      quota: 100000
    }
  });

  const vendedor1 = await prisma.user.upsert({
    where: { email: 'joao@crm.com' },
    update: {},
    create: {
      name: 'João Silva',
      email: 'joao@crm.com',
      password: await bcrypt.hash('vendedor123', 10),
      role: 'SELLER',
      regionId: regiao1.id,
      quota: 50000
    }
  });

  const vendedor2 = await prisma.user.upsert({
    where: { email: 'maria@crm.com' },
    update: {},
    create: {
      name: 'Maria Santos',
      email: 'maria@crm.com',
      password: await bcrypt.hash('vendedor123', 10),
      role: 'SELLER',
      regionId: regiao1.id,
      quota: 45000
    }
  });

  const vendedor3 = await prisma.user.upsert({
    where: { email: 'carlos@crm.com' },
    update: {},
    create: {
      name: 'Carlos Oliveira',
      email: 'carlos@crm.com',
      password: await bcrypt.hash('vendedor123', 10),
      role: 'SELLER',
      regionId: regiao3.id,
      quota: 40000
    }
  });

  const vendedor4 = await prisma.user.upsert({
    where: { email: 'ana@crm.com' },
    update: {},
    create: {
      name: 'Ana Costa',
      email: 'ana@crm.com',
      password: await bcrypt.hash('vendedor123', 10),
      role: 'SELLER',
      regionId: regiao2.id,
      quota: 35000
    }
  });

  // Criar produtos
  const produto1 = await prisma.product.create({
    data: {
      name: 'Sistema CRM Premium',
      description: 'Sistema completo de gestão de relacionamento com clientes',
      category: 'Software',
      price: 2500.00,
      margin: 60,
      active: true
    }
  });

  const produto2 = await prisma.product.create({
    data: {
      name: 'Consultoria em Vendas',
      description: 'Consultoria especializada em processos de vendas',
      category: 'Serviços',
      price: 5000.00,
      margin: 80,
      active: true
    }
  });

  const produto3 = await prisma.product.create({
    data: {
      name: 'Treinamento Comercial',
      description: 'Treinamento para equipes comerciais',
      category: 'Treinamento',
      price: 1500.00,
      margin: 70,
      active: true
    }
  });

  // Criar empresas
  const empresa1 = await prisma.company.create({
    data: {
      name: 'Tech Solutions Ltda',
      document: '12.345.678/0001-90',
      segment: 'Tecnologia',
      size: 'MEDIUM',
      website: 'https://techsolutions.com.br',
      logo: 'https://via.placeholder.com/200x80/3B82F6/FFFFFF?text=Tech+Solutions',
      address: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      status: 'ACTIVE',
      leadScore: 85,
      regionId: regiao1.id,
      contacts: {
        create: [
          {
            name: 'Carlos Oliveira',
            email: 'carlos@techsolutions.com.br',
            phone: '(11) 99999-1111',
            position: 'Diretor de TI',
            isPrimary: true
          }
        ]
      }
    }
  });

  const empresa2 = await prisma.company.create({
    data: {
      name: 'Inovação Digital S.A.',
      document: '98.765.432/0001-10',
      segment: 'Marketing Digital',
      size: 'SMALL',
      website: 'https://inovacaodigital.com.br',
      logo: 'https://via.placeholder.com/200x80/10B981/FFFFFF?text=Inovacao+Digital',
      address: 'Rua das Flores, 500',
      city: 'Rio de Janeiro',
      state: 'RJ',
      status: 'PROSPECT',
      leadScore: 70,
      regionId: regiao2.id,
      contacts: {
        create: [
          {
            name: 'Ana Costa',
            email: 'ana@inovacaodigital.com.br',
            phone: '(21) 88888-2222',
            position: 'CEO',
            isPrimary: true
          }
        ]
      }
    }
  });

  const empresa3 = await prisma.company.create({
    data: {
      name: 'StartUp Ventures',
      document: '11.222.333/0001-44',
      segment: 'Startups',
      size: 'MICRO',
      city: 'Belo Horizonte',
      state: 'MG',
      status: 'LEAD',
      leadScore: 45,
      regionId: regiao1.id,
      contacts: {
        create: [
          {
            name: 'Pedro Almeida',
            email: 'pedro@startupventures.com.br',
            phone: '(31) 77777-3333',
            position: 'Fundador',
            isPrimary: true
          }
        ]
      }
    }
  });

  // Empresas adicionais para demonstrar Lead Scoring
  const empresa4 = await prisma.company.create({
    data: {
      name: 'Mega Corp Enterprise',
      document: '22.333.444/0001-55',
      segment: 'FINANCEIRO',
      size: 'ENTERPRISE',
      website: 'https://megacorp.com.br',
      address: 'Av. Faria Lima, 2000',
      city: 'São Paulo',
      state: 'SP',
      status: 'LEAD',
      leadScore: 95, // Hot Lead
      regionId: regiao1.id,
      contacts: {
        create: [
          {
            name: 'Roberto Silva',
            email: 'roberto@megacorp.com.br',
            phone: '(11) 99999-4444',
            position: 'CTO',
            isPrimary: true
          },
          {
            name: 'Fernanda Lima',
            email: 'fernanda@megacorp.com.br',
            phone: '(11) 99999-5555',
            position: 'Diretora Comercial',
            isPrimary: false
          }
        ]
      }
    }
  });

  const empresa5 = await prisma.company.create({
    data: {
      name: 'Pequena Empresa Ltda',
      document: '33.444.555/0001-66',
      segment: 'Comércio',
      size: 'SMALL',
      city: 'Curitiba',
      state: 'PR',
      status: 'LEAD',
      leadScore: 25, // Low Priority
      regionId: regiao3.id,
      contacts: {
        create: [
          {
            name: 'José Santos',
            email: 'jose@pequenaempresa.com.br',
            phone: '(41) 88888-6666',
            position: 'Proprietário',
            isPrimary: true
          }
        ]
      }
    }
  });

  const empresa6 = await prisma.company.create({
    data: {
      name: 'Indústria Moderna S.A.',
      document: '44.555.666/0001-77',
      segment: 'MANUFATURA',
      size: 'LARGE',
      website: 'https://industriamoderna.com.br',
      address: 'Distrito Industrial, 100',
      city: 'Porto Alegre',
      state: 'RS',
      status: 'LEAD',
      leadScore: 75, // Warm Lead
      regionId: regiao3.id,
      contacts: {
        create: [
          {
            name: 'Marcos Oliveira',
            email: 'marcos@industriamoderna.com.br',
            phone: '(51) 77777-7777',
            position: 'Gerente de TI',
            isPrimary: true
          }
        ]
      }
    }
  });

  // Criar contratos
  const contrato1 = await prisma.contract.create({
    data: {
      number: 'CTR-2024-001',
      title: 'Contrato CRM Tech Solutions',
      description: 'Contrato de licenciamento e suporte do sistema CRM',
      value: 15000.00,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-12-31'),
      status: 'ACTIVE',
      companyId: empresa1.id
    }
  });

  const contrato2 = await prisma.contract.create({
    data: {
      number: 'CTR-2024-002',
      title: 'Contrato Consultoria Inovação Digital',
      description: 'Contrato de consultoria em processos de vendas',
      value: 8000.00,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-07-31'),
      status: 'ACTIVE',
      companyId: empresa2.id
    }
  });

  const contrato3 = await prisma.contract.create({
    data: {
      number: 'CTR-2024-003',
      title: 'Contrato StartUp Ventures',
      description: 'Contrato de implementação de sistema de vendas',
      value: 12000.00,
      startDate: new Date('2024-03-01'),
      endDate: new Date('2025-02-28'),
      status: 'ACTIVE',
      companyId: empresa3.id
    }
  });

  // Criar oportunidades
  const oportunidade1 = await prisma.opportunity.create({
    data: {
      title: 'Implementação CRM Tech Solutions',
      description: 'Projeto de implementação do sistema CRM para gestão de clientes',
      value: 15000.00,
      probability: 80,
      stage: 'PROPOSAL',
      source: 'WEBSITE',
      expectedCloseDate: new Date('2024-02-15'),
      companyId: empresa1.id,
      ownerId: vendedor1.id,
      products: {
        create: [
          {
            productId: produto1.id,
            quantity: 6,
            unitPrice: 2500.00,
            discount: 0
          }
        ]
      }
    }
  });

  const oportunidade2 = await prisma.opportunity.create({
    data: {
      title: 'Consultoria Inovação Digital',
      description: 'Consultoria em processos de vendas e marketing',
      value: 8000.00,
      probability: 60,
      stage: 'NEGOTIATION',
      source: 'REFERRAL',
      expectedCloseDate: new Date('2024-01-30'),
      companyId: empresa2.id,
      ownerId: vendedor2.id,
      products: {
        create: [
          {
            productId: produto2.id,
            quantity: 1,
            unitPrice: 5000.00,
            discount: 0
          },
          {
            productId: produto3.id,
            quantity: 2,
            unitPrice: 1500.00,
            discount: 0
          }
        ]
      }
    }
  });

  const oportunidade3 = await prisma.opportunity.create({
    data: {
      title: 'Treinamento StartUp Ventures',
      description: 'Treinamento comercial para equipe de vendas',
      value: 3000.00,
      probability: 40,
      stage: 'QUALIFICATION',
      source: 'PHONE',
      expectedCloseDate: new Date('2024-03-01'),
      companyId: empresa3.id,
      ownerId: vendedor1.id,
      products: {
        create: [
          {
            productId: produto3.id,
            quantity: 2,
            unitPrice: 1500.00,
            discount: 0
          }
        ]
      }
    }
  });

  // Oportunidade para Hot Lead (Mega Corp)
  const oportunidade4 = await prisma.opportunity.create({
    data: {
      title: 'Transformação Digital Mega Corp',
      description: 'Projeto completo de transformação digital',
      value: 50000.00,
      probability: 90,
      stage: 'PROPOSAL',
      source: 'REFERRAL',
      expectedCloseDate: new Date('2024-02-28'),
      companyId: empresa4.id,
      ownerId: vendedor1.id, // Vendedor mais experiente para hot lead
      products: {
        create: [
          {
            productId: produto1.id,
            quantity: 20,
            unitPrice: 2500.00,
            discount: 0
          }
        ]
      }
    }
  });

  // Oportunidade para Warm Lead (Indústria Moderna)
  const oportunidade5 = await prisma.opportunity.create({
    data: {
      title: 'Modernização Indústria Moderna',
      description: 'Implementação de sistema CRM para indústria',
      value: 12000.00,
      probability: 65,
      stage: 'DIAGNOSIS',
      source: 'CAMPAIGN',
      expectedCloseDate: new Date('2024-03-15'),
      companyId: empresa6.id,
      ownerId: vendedor3.id,
      products: {
        create: [
          {
            productId: produto1.id,
            quantity: 4,
            unitPrice: 2500.00,
            discount: 10
          },
          {
            productId: produto2.id,
            quantity: 1,
            unitPrice: 2000.00,
            discount: 0
          }
        ]
      }
    }
  });

  // Criar uma oportunidade fechada (WON)
  const oportunidadeWon = await prisma.opportunity.create({
    data: {
      title: 'CRM Básico - Projeto Concluído',
      description: 'Implementação básica do CRM já finalizada',
      value: 5000.00,
      probability: 100,
      stage: 'WON',
      source: 'EMAIL',
      expectedCloseDate: new Date('2024-01-15'),
      actualCloseDate: new Date('2024-01-15'),
      companyId: empresa1.id,
      ownerId: vendedor2.id,
      products: {
        create: [
          {
            productId: produto1.id,
            quantity: 2,
            unitPrice: 2500.00,
            discount: 0
          }
        ]
      }
    }
  });

  // Criar atividades
  await prisma.activity.createMany({
    data: [
      {
        type: 'CALL',
        subject: 'Ligação inicial - Tech Solutions',
        description: 'Primeira ligação para apresentar nossa solução',
        status: 'COMPLETED',
        priority: 'HIGH',
        dueDate: new Date('2024-01-10'),
        completedAt: new Date('2024-01-10'),
        companyId: empresa1.id,
        opportunityId: oportunidade1.id,
        assignedToId: vendedor1.id
      },
      {
        type: 'MEETING',
        subject: 'Reunião de apresentação - Inovação Digital',
        description: 'Apresentar proposta de consultoria',
        status: 'PENDING',
        priority: 'HIGH',
        dueDate: new Date('2024-01-25'),
        companyId: empresa2.id,
        opportunityId: oportunidade2.id,
        assignedToId: vendedor2.id
      },
      {
        type: 'EMAIL',
        subject: 'Follow-up StartUp Ventures',
        description: 'Enviar material sobre treinamento comercial',
        status: 'PENDING',
        priority: 'MEDIUM',
        dueDate: new Date('2024-01-22'),
        companyId: empresa3.id,
        opportunityId: oportunidade3.id,
        assignedToId: vendedor1.id
      }
    ]
  });

  // Criar comissões
  await prisma.commission.create({
    data: {
      percentage: 10,
      amount: 500.00,
      status: 'PAID',
      paidAt: new Date('2024-01-20'),
      opportunityId: oportunidadeWon.id,
      sellerId: vendedor2.id
    }
  });

  await prisma.commission.create({
    data: {
      percentage: 8,
      amount: 1200.00,
      status: 'APPROVED',
      opportunityId: oportunidade1.id,
      sellerId: vendedor1.id
    }
  });

  // Criar workflows de aprovação
  const workflowApproval = await prisma.approvalWorkflow.create({
    data: {
      name: 'Aprovação de Propostas',
      type: 'PROPOSAL_APPROVAL',
      steps: {
        step1: { approverId: admin.id, required: true },
        step2: { approverId: vendedor1.id, required: false }
      },
      isActive: true
    }
  });

  // Criar solicitação de aprovação
  const approvalRequest = await prisma.approvalRequest.create({
    data: {
      workflowId: workflowApproval.id,
      entityType: 'Proposal',
      entityId: 'prop_123',
      requesterId: vendedor1.id,
      status: 'PENDING',
      data: {
        proposalValue: 15000,
        discount: 10
      },
      steps: {
        create: [
          {
            stepNumber: 1,
            approverId: admin.id,
            status: 'PENDING'
          }
        ]
      }
    }
  });

  // Criar integrações
  await prisma.integration.createMany({
    data: [
      {
        name: 'WhatsApp Business',
        type: 'WHATSAPP',
        config: { phone: '+5511999999999' },
        isActive: true,
        apiKey: 'wa_key_123456789'
      },
      {
        name: 'Mailchimp',
        type: 'EMAIL_MARKETING',
        config: { listId: 'main_list' },
        isActive: true,
        apiKey: 'mc_key_987654321'
      },
      {
        name: 'Asterisk VoIP',
        type: 'VOIP',
        config: { server: 'voip.empresa.com' },
        isActive: false,
        apiKey: 'voip_key_456789123'
      }
    ]
  });



  // Criar concorrentes
  await prisma.competitor.createMany({
    data: [
      {
        name: 'Salesforce',
        website: 'https://salesforce.com',
        strengths: 'Líder de mercado, muitas funcionalidades',
        weaknesses: 'Preço alto, complexidade',
        pricing: 'A partir de $25/usuário/mês',
        marketShare: 19.5,
        isActive: true
      },
      {
        name: 'HubSpot',
        website: 'https://hubspot.com',
        strengths: 'Fácil de usar, versão gratuita',
        weaknesses: 'Limitações na versão gratuita',
        pricing: 'Gratuito até $1,200/mês',
        marketShare: 8.8,
        isActive: true
      },
      {
        name: 'Pipedrive',
        website: 'https://pipedrive.com',
        strengths: 'Interface simples, foco em vendas',
        weaknesses: 'Funcionalidades limitadas de marketing',
        pricing: 'A partir de $14.90/usuário/mês',
        marketShare: 4.2,
        isActive: true
      }
    ]
  });

  // Criar tabela de preços
  const tabelaPreco = await prisma.priceTable.create({
    data: {
      name: 'Tabela Padrão 2024',
      description: 'Tabela de preços padrão para o ano de 2024',
      isDefault: true,
      validFrom: new Date('2024-01-01'),
      validUntil: new Date('2024-12-31'),
      regionId: regiao1.id,
      prices: {
        create: [
          {
            productId: produto1.id,
            price: 2500.00,
            minQuantity: 1,
            maxQuantity: 5,
            discount: 0
          },
          {
            productId: produto1.id,
            price: 2250.00,
            minQuantity: 6,
            maxQuantity: 10,
            discount: 10
          },
          {
            productId: produto2.id,
            price: 5000.00,
            minQuantity: 1,
            discount: 0
          },
          {
            productId: produto3.id,
            price: 1500.00,
            minQuantity: 1,
            discount: 0
          }
        ]
      }
    }
  });

  // Criar regras de cross-sell
  await prisma.crossSellRule.createMany({
    data: [
      {
        name: 'CRM + Consultoria',
        mainProductId: produto1.id,
        suggestedProductId: produto2.id,
        probability: 0.7,
        discount: 15,
        isActive: true
      },
      {
        name: 'CRM + Treinamento',
        mainProductId: produto1.id,
        suggestedProductId: produto3.id,
        probability: 0.5,
        discount: 10,
        isActive: true
      }
    ]
  });

  // Criar regras de upsell
  await prisma.upSellRule.createMany({
    data: [
      {
        name: 'CRM Premium para Enterprise',
        mainProductId: produto1.id,
        targetProductId: produto1.id, // Mesmo produto, versão superior
        minQuantity: 10,
        discount: 20,
        isActive: true
      }
    ]
  });

  // Criar metas de vendas
  await prisma.salesTarget.createMany({
    data: [
      {
        sellerId: vendedor1.id,
        targetValue: 50000,
        targetDeals: 10,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        description: 'Meta Q1 2024 - João Silva',
        bonusPercentage: 5
      },
      {
        sellerId: vendedor2.id,
        targetValue: 45000,
        targetDeals: 8,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        description: 'Meta Q1 2024 - Maria Santos',
        bonusPercentage: 5
      },
      {
        sellerId: vendedor3.id,
        targetValue: 40000,
        targetDeals: 7,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-03-31'),
        description: 'Meta Q1 2024 - Carlos Oliveira',
        bonusPercentage: 4
      }
    ]
  });

  // Criar bonificação por equipe
  const teamBonus = await prisma.teamBonus.create({
    data: {
      regionId: regiao1.id,
      totalAmount: 10000,
      description: 'Bonificação por atingir meta coletiva da região SP',
      period: 'Q1 2024',
      criteria: {
        type: 'COLLECTIVE_TARGET',
        targetValue: 150000,
        achieved: 165000
      },
      distributions: {
        create: [
          {
            sellerId: vendedor1.id,
            amount: 4000,
            percentage: 40
          },
          {
            sellerId: vendedor2.id,
            amount: 3500,
            percentage: 35
          },
          {
            sellerId: admin.id,
            amount: 2500,
            percentage: 25
          }
        ]
      }
    }
  });

  // Criar workflows avançados
  await prisma.advancedWorkflow.createMany({
    data: [
      {
        name: 'Escalação Automática de Oportunidades',
        description: 'Escala oportunidades de alto valor para gerentes',
        type: 'ESCALATION',
        category: 'SALES',
        trigger: {
          event: 'OPPORTUNITY_CREATED',
          conditions: [
            { field: 'value', operator: 'greater_than', value: 25000 }
          ]
        },
        conditions: [
          { field: 'probability', operator: 'greater_than', value: 70 }
        ],
        actions: [
          {
            type: 'SEND_NOTIFICATION',
            params: {
              title: 'Oportunidade de Alto Valor',
              message: 'Nova oportunidade de {{value}} requer atenção',
              recipientId: admin.id,
              channel: 'EMAIL'
            }
          },
          {
            type: 'CREATE_ACTIVITY',
            params: {
              type: 'TASK',
              subject: 'Revisar oportunidade de alto valor',
              description: 'Oportunidade {{title}} no valor de {{value}}',
              priority: 'HIGH',
              assignedToId: admin.id
            }
          }
        ],
        escalationRules: {
          onFailure: {
            type: 'NOTIFY_MANAGER',
            params: { managerId: admin.id }
          }
        },
        priority: 'HIGH',
        isActive: true
      },
      {
        name: 'Follow-up Automático Pós-Proposta',
        description: 'Cria follow-up automático após envio de proposta',
        type: 'SEQUENTIAL',
        category: 'SALES',
        trigger: {
          event: 'PROPOSAL_SENT'
        },
        conditions: [],
        actions: [
          {
            type: 'CREATE_ACTIVITY',
            params: {
              type: 'CALL',
              subject: 'Follow-up da proposta {{proposalNumber}}',
              description: 'Ligar para cliente sobre proposta enviada',
              priority: 'MEDIUM',
              dueDate: '+3 days'
            }
          }
        ],
        priority: 'MEDIUM',
        isActive: true
      }
    ]
  });

  // Criar notificações de exemplo
  await prisma.notification.createMany({
    data: [
      {
        type: 'WORKFLOW',
        title: 'Workflow Executado',
        message: 'Workflow de escalação foi executado com sucesso',
        channel: 'IN_APP',
        recipientId: admin.id,
        status: 'SENT',
        sentAt: new Date()
      },
      {
        type: 'REMINDER',
        title: 'Meta Próxima do Vencimento',
        message: 'Sua meta trimestral vence em 15 dias',
        channel: 'EMAIL',
        recipientId: vendedor1.id,
        status: 'DELIVERED',
        sentAt: new Date()
      }
    ]
  });

  // Criar dados de pós-venda
  
  // Onboardings
  const onboarding1 = await prisma.customerOnboarding.create({
    data: {
      companyId: empresa1.id,
      contractId: contrato1.id,
      assignedToId: vendedor1.id,
      status: 'IN_PROGRESS',
      expectedEndDate: new Date('2024-02-28'),
      description: 'Onboarding completo do sistema CRM',
      steps: {
        create: [
          {
            title: 'Configuração inicial do sistema',
            description: 'Configurar parâmetros básicos do CRM',
            status: 'APPROVED',
            order: 1,
            completedAt: new Date('2024-01-15')
          },
          {
            title: 'Treinamento da equipe',
            description: 'Treinar usuários no uso do sistema',
            status: 'PENDING',
            order: 2,
            dueDate: new Date('2024-01-30')
          },
          {
            title: 'Migração de dados',
            description: 'Importar dados do sistema anterior',
            status: 'PENDING',
            order: 3,
            dueDate: new Date('2024-02-15')
          }
        ]
      }
    }
  });

  const onboarding2 = await prisma.customerOnboarding.create({
    data: {
      companyId: empresa2.id,
      assignedToId: vendedor2.id,
      status: 'PENDING',
      expectedEndDate: new Date('2024-03-15'),
      description: 'Implementação do CRM para marketing digital',
      steps: {
        create: [
          {
            title: 'Análise de requisitos',
            description: 'Levantar necessidades específicas',
            status: 'PENDING',
            order: 1,
            dueDate: new Date('2024-02-01')
          },
          {
            title: 'Configuração personalizada',
            description: 'Configurar módulos específicos',
            status: 'PENDING',
            order: 2,
            dueDate: new Date('2024-02-15')
          }
        ]
      }
    }
  });

  // Tickets de suporte
  const ticket1 = await prisma.supportTicket.create({
    data: {
      number: 'SUP20240001',
      title: 'Problema na sincronização de dados',
      description: 'Os dados não estão sincronizando corretamente entre módulos',
      priority: 'HIGH',
      category: 'Técnico',
      status: 'IN_PROGRESS',
      companyId: empresa1.id,
      assignedToId: vendedor1.id,
      slaDeadline: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 horas
      responses: {
        create: [
          {
            message: 'Ticket recebido, iniciando análise do problema.',
            isInternal: false,
            authorId: vendedor1.id
          },
          {
            message: 'Identificado problema na configuração do banco de dados.',
            isInternal: true,
            authorId: admin.id
          }
        ]
      }
    }
  });

  const ticket2 = await prisma.supportTicket.create({
    data: {
      number: 'SUP20240002',
      title: 'Solicitação de treinamento adicional',
      description: 'Equipe precisa de treinamento avançado em relatórios',
      priority: 'MEDIUM',
      category: 'Treinamento',
      status: 'OPEN',
      companyId: empresa2.id,
      assignedToId: vendedor2.id,
      slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
    }
  });

  // Pesquisas NPS
  const nps1 = await prisma.nPSSurvey.create({
    data: {
      companyId: empresa1.id,
      contractId: contrato1.id,
      score: 9,
      feedback: 'Excelente atendimento e produto de qualidade!',
      status: 'RESPONDED',
      sentAt: new Date('2024-01-15'),
      respondedAt: new Date('2024-01-20')
    }
  });

  const nps2 = await prisma.nPSSurvey.create({
    data: {
      companyId: empresa2.id,
      contractId: contrato2.id,
      score: 6,
      feedback: 'Produto bom, mas o suporte poderia ser mais rápido.',
      status: 'RESPONDED',
      sentAt: new Date('2024-01-10'),
      respondedAt: new Date('2024-01-18')
    }
  });

  const nps3 = await prisma.nPSSurvey.create({
    data: {
      companyId: empresa3.id,
      contractId: contrato3.id,
      status: 'SENT',
      sentAt: new Date('2024-01-22')
    }
  });

  // Alertas de churn
  const churnAlert1 = await prisma.churnAlert.create({
    data: {
      companyId: empresa3.id,
      riskLevel: 'HIGH',
      score: 75,
      reasons: ['Sem atividades recentes', 'Tickets não resolvidos', 'NPS baixo'],
      assignedToId: vendedor1.id,
      status: 'ACTIVE'
    }
  });

  const churnAlert2 = await prisma.churnAlert.create({
    data: {
      companyId: empresa5.id,
      riskLevel: 'MEDIUM',
      score: 55,
      reasons: ['Baixo engajamento', 'Suporte limitado'],
      assignedToId: vendedor3.id,
      status: 'ACTIVE'
    }
  });

  // Criar templates de proposta
  console.log('📄 Criando templates de proposta...');
  
  const templatePadrao = await prisma.proposalTemplate.create({
    data: {
      name: 'Template Padrão',
      description: 'Template básico para propostas comerciais',
      isDefault: true,
      coverEnabled: false,
      headerEnabled: true,
      headerText: 'PROPOSTA COMERCIAL',
      headerHeight: 80,
      footerEnabled: true,
      footerText: 'Documento confidencial - Uso restrito',
      footerHeight: 60,
      indexEnabled: false,
      sections: [
        { id: 'company', title: 'Informações da Empresa', enabled: true, order: 1 },
        { id: 'proposal', title: 'Detalhes da Proposta', enabled: true, order: 2 },
        { id: 'items', title: 'Itens da Proposta', enabled: true, order: 3 },
        { id: 'financial', title: 'Resumo Financeiro', enabled: true, order: 4 }
      ],
      primaryColor: '#3B82F6',
      secondaryColor: '#64748B',
      fontFamily: 'Inter',
      fontSize: 12,
      pageMargins: { top: 40, right: 40, bottom: 40, left: 40 },
      pageSize: 'A4',
      pageOrientation: 'portrait'
    }
  });

  const templateCompleto = await prisma.proposalTemplate.create({
    data: {
      name: 'Template Corporativo Completo',
      description: 'Template profissional com capa, índice e seções completas',
      isDefault: false,
      coverEnabled: true,
      coverTitle: 'PROPOSTA COMERCIAL',
      coverSubtitle: 'Solução personalizada para seu negócio',
      coverBackground: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      headerEnabled: true,
      headerText: 'PROPOSTA COMERCIAL',
      headerHeight: 100,
      footerEnabled: true,
      footerText: 'Documento confidencial - Todos os direitos reservados',
      footerHeight: 80,
      indexEnabled: true,
      indexTitle: 'Sumário Executivo',
      sections: [
        { id: 'cover', title: 'Capa', enabled: true, order: 0 },
        { id: 'index', title: 'Sumário Executivo', enabled: true, order: 1 },
        { id: 'introduction', title: 'Apresentação da Empresa', enabled: true, order: 2 },
        { id: 'company', title: 'Informações do Cliente', enabled: true, order: 3 },
        { id: 'proposal', title: 'Detalhes da Proposta', enabled: true, order: 4 },
        { id: 'items', title: 'Produtos e Serviços', enabled: true, order: 5 },
        { id: 'financial', title: 'Investimento', enabled: true, order: 6 },
        { id: 'terms', title: 'Termos e Condições', enabled: true, order: 7 },
        { id: 'timeline', title: 'Cronograma de Implementação', enabled: true, order: 8 },
        { id: 'signature', title: 'Aprovação e Assinatura', enabled: true, order: 9 }
      ],
      primaryColor: '#1E40AF',
      secondaryColor: '#475569',
      fontFamily: 'Inter',
      fontSize: 11,
      pageMargins: { top: 60, right: 50, bottom: 60, left: 50 },
      pageSize: 'A4',
      pageOrientation: 'portrait'
    }
  });

  const templateMinimalista = await prisma.proposalTemplate.create({
    data: {
      name: 'Template Minimalista',
      description: 'Design limpo e moderno para propostas objetivas',
      isDefault: false,
      coverEnabled: true,
      coverTitle: 'Proposta',
      coverSubtitle: 'Simples. Direto. Eficiente.',
      coverBackground: '#FFFFFF',
      headerEnabled: false,
      footerEnabled: true,
      footerText: 'Proposta válida conforme condições especificadas',
      footerHeight: 40,
      indexEnabled: false,
      sections: [
        { id: 'cover', title: 'Capa', enabled: true, order: 0 },
        { id: 'proposal', title: 'Proposta', enabled: true, order: 1 },
        { id: 'items', title: 'Itens', enabled: true, order: 2 },
        { id: 'financial', title: 'Valores', enabled: true, order: 3 },
        { id: 'signature', title: 'Aceite', enabled: true, order: 4 }
      ],
      primaryColor: '#000000',
      secondaryColor: '#6B7280',
      fontFamily: 'Inter',
      fontSize: 13,
      pageMargins: { top: 60, right: 60, bottom: 60, left: 60 },
      pageSize: 'A4',
      pageOrientation: 'portrait'
    }
  });

  console.log('✅ Seed concluído com sucesso!');
  console.log(`👤 Usuários criados: ${admin.name}, ${vendedor1.name}, ${vendedor2.name}, ${vendedor3.name}, ${vendedor4.name}`);
  console.log(`🏢 Empresas criadas: 6 empresas com diferentes lead scores`);
  console.log(`📦 Produtos criados: ${produto1.name}, ${produto2.name}, ${produto3.name}`);
  console.log(`💰 Oportunidades criadas: 6 (1 fechada, 5 em andamento)`);
  console.log(`📅 Atividades criadas: 3`);
  console.log(`💵 Comissões criadas: 2`);
  console.log(`🎯 Lead Scores: Hot Lead (95), Warm Leads (70-85), Cold Lead (45), Low Priority (25)`);
  console.log(`🔗 Integrações: 3 (WhatsApp, E-mail, VoIP)`);
  console.log(`🌍 Regiões: 3 (SP, RJ, SUL)`);
  console.log(`🏆 Concorrentes: 3 (Salesforce, HubSpot, Pipedrive)`);
  console.log(`📄 Templates: ${templatePadrao.name}, ${templateCompleto.name}, ${templateMinimalista.name}`);
  console.log(`💰 Tabelas de preço: 1 (com 4 produtos)`);
  console.log(`🔄 Regras cross-sell: 2`);
  console.log(`⬆️ Regras upsell: 1`);
  console.log(`✅ Workflows de aprovação: 1 com 1 solicitação pendente`);
  console.log(`🎯 Metas de vendas: 3 (Q1 2024)`);
  console.log(`👥 Bonificação por equipe: 1 (Região SP)`);
  console.log(`🔄 Workflows avançados: 2 (Escalação e Follow-up)`);
  console.log(`🔔 Notificações: 2 (Workflow e Reminder)`);
  console.log(`🎯 Onboardings: 2 (1 em progresso, 1 pendente)`);
  console.log(`🎫 Tickets de suporte: 2 (1 em progresso, 1 aberto)`);
  console.log(`📊 Pesquisas NPS: 3 (2 respondidas, 1 enviada)`);
  console.log(`⚠️ Alertas de churn: 2 (1 alto risco, 1 médio risco)`);
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
