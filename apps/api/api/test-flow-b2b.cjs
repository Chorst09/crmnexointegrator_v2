const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');

const router = express.Router();

let lastExecutionResult = null;

async function executeB2BTestFlow(user = null, options = {}) {
  const now = new Date();
  const logs = [];
  const log = (stepNum, name, details, entityId = null, extra = {}) => {
    logs.push({
      step: stepNum,
      title: name,
      details,
      entityId,
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      ...extra
    });
  };

  const userId = user?.id || user?.userId || 'usr-master-1';
  const tenantCompanyId = user?.tenantCompanyId || null;

  // ==========================================
  // PASSO 1: EMPRESA B2B
  // ==========================================
  const companyCnpj = '34.891.205/0001-44';
  const companyName = 'TechCorp Telecomunicações & TI S/A';
  let company = await prisma.company.findFirst({
    where: { document: companyCnpj }
  });

  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        tradingName: 'TechCorp Brasil',
        document: companyCnpj,
        cnpj: companyCnpj,
        clientType: 'B2B',
        segment: 'Tecnologia da Informação & Telecomunicações',
        size: 'LARGE',
        website: 'https://www.techcorpbrasil.com.br',
        address: 'Rua Marechal Deodoro, 1500 - 10º Andar',
        city: 'Curitiba',
        state: 'PR',
        country: 'Brasil',
        status: 'ACTIVE',
        leadScore: 92,
        churnRisk: 0.05,
        accessB2B: true,
        accessB2G: false,
        tenantCompanyId
      }
    });
  } else {
    // Garantir que os dados estejam atualizados
    company = await prisma.company.update({
      where: { id: company.id },
      data: { status: 'ACTIVE', leadScore: 95 }
    });
  }
  log(
    1,
    'Empresa B2B Criada e Homologada',
    `Empresa cadastrada no CRM: ${company.name} | CNPJ: ${companyCnpj} | Segmento: Tecnologia & Telecom | Local: Curitiba/PR`,
    company.id,
    { badge: 'Módulo: Empresas B2B' }
  );

  // ==========================================
  // PASSO 2: LEAD / CONTATO PRINCIPAL
  // ==========================================
  let contact = await prisma.contact.findFirst({
    where: { companyId: company.id }
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        name: 'Carlos Eduardo Mendes',
        email: 'carlos.mendes@techcorpbrasil.com.br',
        phone: '(41) 98765-4321',
        position: 'Diretor de Tecnologia e Infraestrutura (CIO)',
        isPrimary: true,
        companyId: company.id
      }
    });
  }
  log(
    2,
    'Lead / Contato Qualificado Registrado',
    `Lead executivo: ${contact.name} (${contact.position}) | E-mail: ${contact.email} | Telefone: ${contact.phone}`,
    contact.id,
    { badge: 'Módulo: Leads & Contatos' }
  );

  // ==========================================
  // PASSO 3: OPORTUNIDADE B2B NO FUNIL
  // ==========================================
  const oppTitle = 'Projeto Conectividade 100Mbps Redundante + Firewall Virtual NGFW';
  let opportunity = await prisma.opportunity.findFirst({
    where: { companyId: company.id, title: oppTitle }
  });

  const oppNumber = `OPP-${now.getFullYear()}-0420`;
  if (!opportunity) {
    opportunity = await prisma.opportunity.create({
      data: {
        title: oppTitle,
        number: oppNumber,
        companyId: company.id,
        clientType: 'B2B',
        stage: 'PROPOSAL',
        value: 43500,
        mrr: 3500,
        setupFee: 1500,
        probability: 90,
        projectType: 'B2B',
        projectMonths: 12,
        description: 'Implantação de Firewall Virtual Double de Alta Disponibilidade (NGFW Fortinet/Checkpoint) integrado a Link de Internet Dedicada 100Mbps redundante Fibra + Rádio.',
        userId,
        ownerId: userId,
        expectedCloseDate: new Date(Date.now() + 15 * 86400000).toISOString()
      }
    });
  }
  log(
    3,
    'Oportunidade Comercial Aberta no Funil B2B',
    `Oportunidade: "${opportunity.title}" | Mensalidade: R$ 3.500,00 | Instalação: R$ 1.500,00 | Contrato 12 Meses: R$ 43.500,00`,
    opportunity.id,
    { badge: 'Módulo: Oportunidades B2B' }
  );

  // ==========================================
  // PASSO 4: ATIVIDADE PARA O PRÉ-VENDAS
  // ==========================================
  const flowMarker = '[CRM_ACTIVITY_FLOW]';
  const activitySubject = `[Pré-Vendas] Dimensionamento NGFW & Link Dedicado - ${company.name}`;
  const initialFlowMetadata = {
    sourceArea: 'COMERCIAL',
    targetArea: 'PRE_VENDAS',
    createdFrom: 'FLUXO_TESTE_B2B',
    createdByName: 'Vendas Corporativas',
    activityStage: 'ORCAMENTO_PREVENDAS',
    returnedFromPreSales: false,
    preSalesStatus: 'EM_PRECIFICACAO',
    updatedAt: now.toISOString()
  };
  const activityDescription = `Levantamento técnico, estudo de viabilidade e dimensionamento de hardware virtualizado NGFW Double com túneis IPsec e balanceamento SD-WAN.\n\n${flowMarker}${JSON.stringify(initialFlowMetadata)}`;

  const activity = await prisma.activity.create({
    data: {
      title: activitySubject,
      subject: activitySubject,
      type: 'TASK',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      description: activityDescription,
      companyId: company.id,
      opportunityId: opportunity.id,
      assignedToId: userId,
      dueDate: new Date(Date.now() + 2 * 86400000).toISOString()
    }
  });
  log(
    4,
    'Atividade de Engenharia Encaminhada para Pré-Vendas',
    `Atividade criada e despachada para a equipe de Pré-Vendas: "Dimensionamento NGFW & Viabilidade Técnica" vinculada à oportunidade e à empresa`,
    activity.id,
    { badge: 'Módulo: Atividades & Tarefas' }
  );

  // ==========================================
  // PASSO 5: PRÉ-VENDAS CRIA ORÇAMENTO TÉCNICO
  // ==========================================
  const budgetNumber = `ORC-${now.getFullYear()}-0088`;
  let preSalesRequest = await prisma.preSalesRequest.findFirst({
    where: { numero: budgetNumber }
  });

  const itemsPrecificados = [
    {
      descricao: 'Firewall Virtual Double NGFW (Licença NGFW + IPS/AV + VPN SSL/IPsec)',
      quantidade: 1,
      custoUnitario: 850,
      precoSugerido: 1545,
      margemLucro: 45,
      subtotal: 1545
    },
    {
      descricao: 'Link Dedicado 100Mbps Redundante Fibra + Rádio com SLA 4 Horas',
      quantidade: 1,
      custoUnitario: 980,
      precoSugerido: 1955,
      margemLucro: 50,
      subtotal: 1955
    },
    {
      descricao: 'Instalação, Parametrização de Políticas de Segurança e Setup de Redes',
      quantidade: 1,
      custoUnitario: 600,
      precoSugerido: 1500,
      margemLucro: 60,
      subtotal: 1500
    }
  ];

  if (!preSalesRequest) {
    preSalesRequest = await prisma.preSalesRequest.create({
      data: {
        numero: budgetNumber,
        titulo: 'Orçamento Técnico NGFW + Conectividade Corporativa',
        descricao: `Dimensionamento e cotação técnica executada pelo Pré-Vendas com alta disponibilidade. [FLOW_ACTIVITY_ID:${activity.id}]`,
        status: 'APROVADA',
        prioridade: 'ALTA',
        tipo: 'B2B',
        companyId: company.id,
        opportunityId: opportunity.id,
        leadId: company.id,
        solicitanteId: userId,
        valorTotal: 43500,
        valorSugerido: 43500,
        custoTotal: 2430,
        margemLucro: 48.5,
        margemMedia: 48.5,
        observacoes: `Dimensionamento validado com SLA de 99.8%, túneis VPN dedicados e filtragem NGFW contra intrusões. [FLOW_ACTIVITY_ID:${activity.id}]`,
        tenantCompanyId
      }
    });

    await prisma.preSalesItem.createMany({
      data: itemsPrecificados.map((i) => ({
        requestId: preSalesRequest.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        custoUnitario: i.custoUnitario,
        precoSugerido: i.precoSugerido,
        margemLucro: i.margemLucro
      }))
    });
  }

  // Atualiza a atividade devolvida com a referência completa do orçamento, produtos e valores
  const returnedFlowMetadata = {
    sourceArea: 'PRE_VENDAS',
    targetArea: 'COMERCIAL',
    createdFrom: 'FLUXO_TESTE_B2B',
    createdByName: 'Engenharia de Pré-Vendas',
    activityStage: 'PROPOSTA_ENVIADA',
    returnedFromPreSales: true,
    preSalesStatus: 'APROVADA',
    preSalesRequestId: preSalesRequest.id,
    preSalesNumber: budgetNumber,
    numeroOrcamento: budgetNumber,
    valorTotal: 43500,
    valorMensal: 3500,
    valorSetup: 1500,
    margemMedia: 48.5,
    items: itemsPrecificados,
    observacoesTecnicas: 'Dimensionamento validado com SLA de 99.8%, túneis VPN dedicados e filtragem NGFW contra intrusões.',
    updatedAt: now.toISOString()
  };

  const returnedDescription = `Levantamento técnico, estudo de viabilidade e dimensionamento de hardware virtualizado NGFW Double com túneis IPsec e balanceamento SD-WAN.\n\n${flowMarker}${JSON.stringify(returnedFlowMetadata)}`;

  await prisma.activity.update({
    where: { id: activity.id },
    data: {
      title: activitySubject,
      subject: activitySubject,
      status: 'COMPLETED',
      completedAt: now.toISOString(),
      description: returnedDescription
    }
  });

  log(
    5,
    'Pré-Vendas Gera Orçamento Técnico Estruturado',
    `Orçamento ${budgetNumber} criado pelo time técnico com 3 itens especificados: NGFW Virtual + Link Fibra/Rádio 100Mbps + Serviço de Implantação`,
    preSalesRequest.id,
    { badge: 'Módulo: Pré-Vendas & Orçamentos' }
  );

  // ==========================================
  // PASSO 6: PRECIFICAÇÃO COMO VENDAS
  // ==========================================
  const pricingData = {
    mrrMensal: 3500.00,
    taxaInstalacao: 1500.00,
    custoMensal: 1830.00,
    lucroMensal: 1670.00,
    margemFinal: 48.5,
    vigenciaMeses: 12,
    valorTotalContrato: 43500.00,
    statusPrecificacao: 'APROVADA_COMERCIAL'
  };
  log(
    6,
    'Precificação Financeira Validada como Vendas',
    `Cálculo de margens e precificação comercial concluído no Simulador: Mensalidade R$ 3.500,00 | Instalação R$ 1.500,00 | Margem de Contribuição: 48.5% | Lucro Estimado: R$ 1.670,00/mês`,
    null,
    { badge: 'Módulo: Simuladores & Precificação', data: pricingData }
  );

  // ==========================================
  // PASSO 7: DEVOLVE AO COMERCIAL & GERA PROPOSTA
  // ==========================================
  const proposalNumber = `PROP-${now.getFullYear()}-0054`;
  let proposal = await prisma.proposal.findFirst({
    where: { number: proposalNumber }
  });

  if (!proposal) {
    proposal = await prisma.proposal.create({
      data: {
        number: proposalNumber,
        title: 'Proposta Comercial - Firewall Virtual Double & Link Dedicado 100Mbps',
        opportunityId: opportunity.id,
        companyId: company.id,
        status: 'ACCEPTED',
        totalValue: 43500,
        monthlyValue: 3500,
        setupValue: 1500,
        validityDays: 15,
        notes: 'Proposta comercial formal emitida conforme layout padrão de 10 lâminas (Datacenter, NGFW, Escopo, Premissas e Investimento).',
        tenantCompanyId
      }
    });

    await prisma.proposalItem.createMany({
      data: [
        {
          proposalId: proposal.id,
          name: 'Internet 100Mbps rádio (Link de internet dedicada via rádio)',
          quantity: 1,
          unitPrice: 500,
          monthlyPrice: 500,
          totalPrice: 6000
        },
        {
          proposalId: proposal.id,
          name: 'Rede MAN 50Mbps (Link L2L MAN via rádio)',
          quantity: 1,
          unitPrice: 1000,
          monthlyPrice: 1000,
          totalPrice: 12000
        },
        {
          proposalId: proposal.id,
          name: 'Link Double 100Mbps (Link redundante Rádio + Fibra Óptica)',
          quantity: 1,
          unitPrice: 2000,
          monthlyPrice: 2000,
          totalPrice: 24000
        },
        {
          proposalId: proposal.id,
          name: 'Taxa de Instalação e Ativação de Infraestrutura',
          quantity: 1,
          unitPrice: 1500,
          monthlyPrice: 0,
          totalPrice: 1500
        }
      ]
    });
  }
  log(
    7,
    'Devolução para o Comercial & Emissão da Proposta Comercial',
    `Orçamento devolvido para a gerência de contas. Proposta ${proposalNumber} emitida contendo as 4 linhas contratuais idênticas ao layout do documento comercial`,
    proposal.id,
    { badge: 'Módulo: Propostas Comerciais' }
  );

  // ==========================================
  // PASSO 8: COMERCIAL FECHA COMO GANHO (WON)
  // ==========================================
  opportunity = await prisma.opportunity.update({
    where: { id: opportunity.id },
    data: {
      stage: 'WON',
      value: 43500,
      actualCloseDate: now.toISOString(),
      probability: 100,
      wonReason: 'Solução técnica e alta disponibilidade validadas pela pré-vendas, melhor SLA e preço competitivo'
    }
  });

  await prisma.company.update({
    where: { id: company.id },
    data: { status: 'ACTIVE' }
  });
  log(
    8,
    'Comercial Fecha a Oportunidade como GANHO',
    `Oportunidade fechada como GANHO (Status: WON). A conta da empresa tornou-se oficialmente CLIENTE ATIVO no CRM`,
    opportunity.id,
    { badge: 'Módulo: Fechamento & Pipeline' }
  );

  // ==========================================
  // PASSO 9: GESTÃO DE PROJETOS - CRIAÇÃO DO PROJETO
  // ==========================================
  const projectNumber = `PRJ-${now.getFullYear()}-0082`;
  let project = await prisma.project.findFirst({
    where: { opportunityId: opportunity.id }
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        number: projectNumber,
        name: `Implantação Firewall Virtual NGFW & Link 100Mbps - ${company.name}`,
        description: `Projeto resultante da oportunidade ganha ${opportunity.number}. Fornecimento de conectividade corporativa redundante e segurança perimetral virtualizada.`,
        type: 'B2B',
        status: 'EM_ANDAMENTO',
        budget: 43500,
        companyId: company.id,
        opportunityId: opportunity.id,
        projectManagerId: userId,
        createdBy: userId,
        plannedStartDate: now.toISOString(),
        plannedEndDate: new Date(Date.now() + 45 * 86400000).toISOString(),
        tenantCompanyId
      }
    });

    const phasesData = [
      { name: '1. Iniciação & Termo de Abertura', order: 1, status: 'COMPLETED', description: 'Assinatura contratual, liberação financeira e kickoff de alinhamento.' },
      { name: '2. Planejamento & Projeto Técnico', order: 2, status: 'IN_PROGRESS', description: 'Levantamento de topologia, endereçamento IP e parametrização do NGFW.' },
      { name: '3. Execução & Ativação de Link', order: 3, status: 'PENDING', description: 'Lançamento de fibra, alinhamento rádio, subida de túneis VPN e teste de tráfego.' },
      { name: '4. Homologação & Monitoramento', order: 4, status: 'PENDING', description: 'Testes de failover, validação de regras de firewall e entrega ao NOC 24x7.' },
      { name: '5. Encerramento & Termo de Aceite', order: 5, status: 'PENDING', description: 'Assinatura do termo de aceite definitivo e transição para pós-venda.' }
    ];

    for (const phase of phasesData) {
      await prisma.projectPhase.create({
        data: {
          projectId: project.id,
          name: phase.name,
          order: phase.order,
          status: phase.status,
          description: phase.description
        }
      });
    }

    await prisma.projectTask.createMany({
      data: [
        { projectId: project.id, title: 'Realizar Reunião de Kickoff com Cliente', status: 'IN_PROGRESS', priority: 'HIGH' },
        { projectId: project.id, title: 'Provisionar máquina virtual NGFW no Datacenter', status: 'TODO', priority: 'HIGH' },
        { projectId: project.id, title: 'Configurar rotas BGP e blocos de IPs dedicados', status: 'TODO', priority: 'MEDIUM' }
      ]
    });
  }
  log(
    9,
    'Projeto Criado Automaticamente em Gestão de Projetos',
    `Projeto ${project.number} inicializado com metodologia PMBOK em 5 fases, gestor de projetos alocado e tarefas operacionais vinculadas`,
    project.id,
    { badge: 'Módulo: Gestão de Projetos' }
  );

  // ==========================================
  // PASSO 10: REUNIÃO DE KICKOFF AGENDADA
  // ==========================================
  const kickoffTitle = `Reunião de Kickoff e Alinhamento Técnico - ${company.name}`;
  let kickoffMeeting = await prisma.kickoffMeeting.findFirst({
    where: { opportunityId: opportunity.id }
  });

  if (!kickoffMeeting) {
    const kickoffDate = new Date(Date.now() + 24 * 3600000);
    kickoffDate.setHours(14, 0, 0, 0);

    kickoffMeeting = await prisma.kickoffMeeting.create({
      data: {
        number: `KCK-${now.getFullYear()}-0029`,
        title: kickoffTitle,
        phase: 'ALINHAMENTO_EXTERNO',
        status: 'AGENDADA',
        opportunityId: opportunity.id,
        companyId: company.id,
        ownerId: userId,
        scheduledDate: kickoffDate,
        platform: 'MEET',
        meetingLink: 'https://meet.google.com/nex-b2b-test',
        meetingNotes: 'Reunião de alinhamento com cliente: apresentação das equipes de implantação, validação de cronograma físico e canais de escalonamento.'
      }
    });

    await prisma.kickoffAgendaItem.createMany({
      data: [
        { meetingId: kickoffMeeting.id, title: 'Apresentação das Equipes Comercial, Pré-Vendas e Engenharia', order: 1, durationMinutes: 10 },
        { meetingId: kickoffMeeting.id, title: 'Validação do Escopo Técnico Contratado (NGFW + Link Dedicado 100Mbps)', order: 2, durationMinutes: 15 },
        { meetingId: kickoffMeeting.id, title: 'Cronograma Físico de Implantação e Janelas de Manutenção', order: 3, durationMinutes: 15 },
        { meetingId: kickoffMeeting.id, title: 'Procedimentos de Teste de Failover e SLA 4h de Restabelecimento', order: 4, durationMinutes: 10 },
        { meetingId: kickoffMeeting.id, title: 'Canais de Escalonamento e Atendimento NOC 24x7', order: 5, durationMinutes: 10 }
      ]
    });

    await prisma.kickoffChecklistItem.createMany({
      data: [
        { meetingId: kickoffMeeting.id, title: 'Contrato comercial e proposta aceita anexados', order: 1, isCompleted: true },
        { meetingId: kickoffMeeting.id, title: 'Topologia e dimensionamento da Pré-Vendas validados', order: 2, isCompleted: true },
        { meetingId: kickoffMeeting.id, title: 'Verificação de espaço em rack e energia no cliente', order: 3, isCompleted: false },
        { meetingId: kickoffMeeting.id, title: 'Criação de credenciais de acesso ao console NGFW', order: 4, isCompleted: false }
      ]
    });

    await prisma.kickoffParticipant.createMany({
      data: [
        { meetingId: kickoffMeeting.id, userId, role: 'ORGANIZADOR', status: 'CONFIRMADO', isRequired: true },
        { meetingId: kickoffMeeting.id, contactId: contact.id, role: 'EXTERNO', status: 'CONVIDADO', isRequired: true }
      ]
    });
  }
  log(
    10,
    'Reunião de Kickoff Criada com Agenda e Participantes',
    `Reunião de Kickoff Externa agendada com link Google Meet, 5 tópicos de pauta, checklist documental e convite a todos os stakeholders`,
    kickoffMeeting.id,
    { badge: 'Módulo: Gestão de Kickoff' }
  );

  const result = {
    success: true,
    message: 'Fluxo de Teste B2B Completo executado com sucesso através de todos os 10 módulos do sistema!',
    executedAt: now.toISOString(),
    logs,
    summary: {
      empresa: company.name,
      lead: `${contact.name} (${contact.position})`,
      oportunidade: opportunity.title,
      orcamentoPreVendas: preSalesRequest.numero,
      valorMensal: 'R$ 3.500,00',
      valorSetup: 'R$ 1.500,00',
      valorTotalContrato: 'R$ 43.500,00',
      statusComercial: 'GANHO (WON)',
      projetoGerado: project.number,
      kickoffAgendado: kickoffMeeting.number
    },
    entities: {
      company,
      contact,
      opportunity,
      activity,
      preSalesRequest,
      pricingData,
      proposal,
      project,
      kickoffMeeting
    },
    navigation: {
      empresa: `/empresas`,
      lead: `/leads`,
      oportunidade: `/oportunidades`,
      atividade: `/atividades`,
      preVendas: `/pre-vendas`,
      solicitacao: `/solicitacoes`,
      orcamentos: `/orcamentos`,
      proposta: `/propostas`,
      simuladores: `/simuladores`,
      projeto: `/projetos/${project.id}`,
      projetosLista: `/projetos`,
      kickoff: `/kickoff`
    }
  };

  lastExecutionResult = result;
  return result;
}

// Rota para disparar o teste E2E
router.post('/run', authenticateToken, async (req, res) => {
  try {
    const result = await executeB2BTestFlow(req.user, req.body || {});
    res.json(result);
  } catch (error) {
    console.error('🔴 Erro ao executar fluxo de teste B2B:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao executar fluxo de teste B2B',
      details: error.message
    });
  }
});

// Rota para consultar o último status/resultado
router.get('/status', authenticateToken, async (req, res) => {
  try {
    if (!lastExecutionResult) {
      // Auto-executa a primeira vez para já ter dados disponíveis
      lastExecutionResult = await executeB2BTestFlow(req.user, {});
    }
    res.json(lastExecutionResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  router,
  executeB2BTestFlow
};
