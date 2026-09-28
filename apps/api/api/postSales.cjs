const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');
const { getTenantId } = require('../lib/access-control.cjs');

const router = express.Router();

// ===== ONBOARDING =====

// Listar onboardings
router.get('/onboarding', authenticateToken, async (req, res) => {
  try {
    const { status, companyId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    // Isolamento por tenant
    const tenantId = getTenantId(req.user);
    if (tenantId) {
      where.company = { tenantCompanyId: tenantId };
    }

    // Filtrar por permissão de papel
    if (req.user.role === 'SELLER') {
      where.assignedToId = req.user.userId;
    }

    const [onboardings, total] = await Promise.all([
      prisma.customerOnboarding.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true }
          },
          contract: {
            select: { id: true, number: true, title: true }
          },
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          steps: {
            orderBy: { order: 'asc' }
          },
          _count: {
            select: { steps: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.customerOnboarding.count({ where })
    ]);

    res.json({
      onboardings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar onboardings:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar onboarding
router.post('/onboarding', authenticateToken, async (req, res) => {
  try {
    const { companyId, contractId, expectedEndDate, steps } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Empresa é obrigatória' });
    }

    const onboarding = await prisma.customerOnboarding.create({
      data: {
        companyId,
        contractId,
        expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
        assignedToId: req.user.userId,
        steps: {
          create: steps?.map((step, index) => ({
            title: step.title,
            description: step.description,
            dueDate: step.dueDate ? new Date(step.dueDate) : null,
            order: index + 1
          })) || []
        }
      },
      include: {
        company: {
          select: { id: true, name: true, document: true }
        },
        contract: {
          select: { id: true, number: true, title: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        },
        steps: {
          orderBy: { order: 'asc' }
        }
      }
    });

    res.status(201).json(onboarding);
  } catch (error) {
    console.error('Erro ao criar onboarding:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar step do onboarding
router.put('/onboarding/:id/steps/:stepId', authenticateToken, async (req, res) => {
  try {
    const { id, stepId } = req.params;
    const { status, completedAt } = req.body;

    // Verificar permissão
    const onboarding = await prisma.customerOnboarding.findUnique({
      where: { id }
    });

    if (!onboarding) {
      return res.status(404).json({ error: 'Onboarding não encontrado' });
    }

    if (req.user.role === 'SELLER' && onboarding.assignedToId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const step = await prisma.onboardingStep.update({
      where: { id: stepId },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : null
      }
    });

    // Verificar se todos os steps foram concluídos
    const allSteps = await prisma.onboardingStep.findMany({
      where: { onboardingId: id }
    });

    const completedSteps = allSteps.filter(s => s.status === 'COMPLETED');
    
    if (completedSteps.length === allSteps.length) {
      await prisma.customerOnboarding.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          actualEndDate: new Date()
        }
      });
    }

    res.json(step);
  } catch (error) {
    console.error('Erro ao atualizar step:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== SUPORTE =====

// Listar tickets
router.get('/support', authenticateToken, async (req, res) => {
  try {
    const { status, priority, companyId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (companyId) where.companyId = companyId;

    // Isolamento por tenant
    const tenantId = getTenantId(req.user);
    if (tenantId) {
      where.company = { tenantCompanyId: tenantId };
    }

    // Filtrar por permissão de papel
    if (req.user.role === 'SELLER') {
      where.assignedToId = req.user.userId;
    }

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true }
          },
          assignedTo: {
            select: { id: true, name: true, email: true }
          },
          _count: {
            select: { responses: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.supportTicket.count({ where })
    ]);

    res.json({
      tickets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar tickets:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar ticket
router.post('/support', authenticateToken, async (req, res) => {
  try {
    const { title, description, priority, category, companyId } = req.body;

    if (!title || !description || !companyId) {
      return res.status(400).json({ 
        error: 'Título, descrição e empresa são obrigatórios' 
      });
    }

    // Buscar empresa para determinar tipo de cliente
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { clientType: true },
      include: {
        contracts: {
          where: { status: 'ACTIVE' },
          select: { slaResponseTime: true, slaResolutionTime: true }
        }
      }
    });

    const clientType = company?.clientType || 'B2B';

    // Gerar número do ticket
    const year = new Date().getFullYear();
    const count = await prisma.supportTicket.count({
      where: {
        createdAt: {
          gte: new Date(`${year}-01-01`),
          lt: new Date(`${year + 1}-01-01`)
        }
      }
    });
    const number = `SUP${year}${String(count + 1).padStart(4, '0')}`;

    // Calcular SLA baseado na prioridade e tipo de cliente
    // Priorizar SLA do contrato se existir
    let slaHours;
    const activeContract = company?.contracts?.[0];
    
    if (activeContract?.slaResolutionTime) {
      slaHours = activeContract.slaResolutionTime;
    } else {
      // SLA padrão por tipo de cliente e prioridade
      const slaMatrix = {
        B2B: {
          'LOW': 72,      // 3 dias
          'MEDIUM': 24,   // 1 dia
          'HIGH': 8,      // 8 horas
          'URGENT': 4     // 4 horas
        },
        B2G: {
          'LOW': 120,     // 5 dias (processos mais lentos)
          'MEDIUM': 48,   // 2 dias
          'HIGH': 24,     // 1 dia
          'URGENT': 8     // 8 horas
        },
        B2C: {
          'LOW': 48,      // 2 dias
          'MEDIUM': 12,   // 12 horas
          'HIGH': 4,      // 4 horas
          'URGENT': 2     // 2 horas
        }
      };
      
      slaHours = slaMatrix[clientType]?.[priority] || 24;
    }

    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + slaHours);

    const ticket = await prisma.supportTicket.create({
      data: {
        number,
        title,
        description,
        priority: priority || 'MEDIUM',
        category,
        companyId,
        assignedToId: req.user.userId,
        slaDeadline
      },
      include: {
        company: {
          select: { id: true, name: true, document: true, clientType: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json(ticket);
  } catch (error) {
    console.error('Erro ao criar ticket:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Adicionar resposta ao ticket
router.post('/support/:id/responses', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { message, isInternal } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }

    const response = await prisma.ticketResponse.create({
      data: {
        message,
        isInternal: isInternal || false,
        ticketId: id,
        authorId: req.user.userId
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    res.status(201).json(response);
  } catch (error) {
    console.error('Erro ao adicionar resposta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== NPS =====

// Listar pesquisas NPS
router.get('/nps', authenticateToken, async (req, res) => {
  try {
    const { status, companyId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    const [surveys, total] = await Promise.all([
      prisma.nPSSurvey.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true }
          },
          contract: {
            select: { id: true, number: true, title: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.nPSSurvey.count({ where })
    ]);

    res.json({
      surveys,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar pesquisas NPS:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar pesquisa NPS
router.post('/nps', authenticateToken, async (req, res) => {
  try {
    const { companyId, contractId } = req.body;

    if (!companyId) {
      return res.status(400).json({ error: 'Empresa é obrigatória' });
    }

    const survey = await prisma.nPSSurvey.create({
      data: {
        companyId,
        contractId
      },
      include: {
        company: {
          select: { id: true, name: true, document: true }
        },
        contract: {
          select: { id: true, number: true, title: true }
        }
      }
    });

    res.status(201).json(survey);
  } catch (error) {
    console.error('Erro ao criar pesquisa NPS:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Responder pesquisa NPS (endpoint público)
router.put('/nps/:id/respond', async (req, res) => {
  try {
    const { id } = req.params;
    const { score, feedback } = req.body;

    if (score === undefined || score < 0 || score > 10) {
      return res.status(400).json({ error: 'Score deve ser entre 0 e 10' });
    }

    const survey = await prisma.nPSSurvey.update({
      where: { id },
      data: {
        score: parseInt(score),
        feedback,
        status: 'RESPONDED',
        respondedAt: new Date()
      }
    });

    res.json(survey);
  } catch (error) {
    console.error('Erro ao responder pesquisa NPS:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== CHURN ALERTS =====

// Listar alertas de churn
router.get('/churn-alerts', authenticateToken, async (req, res) => {
  try {
    const { riskLevel, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (riskLevel) where.riskLevel = riskLevel;
    if (status) where.status = status;

    // Filtrar por permissão
    if (req.user.role === 'SELLER') {
      where.assignedToId = req.user.userId;
    }

    const [alerts, total] = await Promise.all([
      prisma.churnAlert.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true, churnRisk: true }
          },
          assignedTo: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.churnAlert.count({ where })
    ]);

    res.json({
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar alertas de churn:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Pesos de churn por tipo de cliente
const CHURN_WEIGHTS = {
  B2B: {
    contractExpiring: 30,
    highTickets: 25,
    lowNPS: 35,
    lowActivity: 20,
    unresolvedTickets: 15
  },
  B2G: {
    contractExpiring: 40,  // Mais crítico em B2G (editais têm prazos rígidos)
    highTickets: 15,       // Menos relevante (processos burocráticos)
    lowNPS: 10,            // Menos aplicável (avaliação formal diferente)
    lowActivity: 10,       // Normal em B2G (ciclos mais longos)
    unresolvedTickets: 25  // Mais crítico (pode afetar renovação)
  },
  B2C: {
    contractExpiring: 25,
    highTickets: 30,
    lowNPS: 40,
    lowActivity: 15,
    unresolvedTickets: 20
  }
};

// Processar detecção de churn
router.post('/churn-alerts/detect', authenticateToken, async (req, res) => {
  try {
    if (!['ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar empresas ativas para análise
    const companies = await prisma.company.findMany({
      where: { status: 'ACTIVE' },
      include: {
        contracts: {
          where: { status: 'ACTIVE' }
        },
        supportTickets: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // últimos 30 dias
            }
          }
        },
        npsSurveys: {
          where: {
            status: 'RESPONDED',
            respondedAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // últimos 90 dias
            }
          }
        },
        activities: {
          where: {
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }
      }
    });

    const newAlerts = [];
    const stats = { B2B: 0, B2G: 0, B2C: 0 };

    for (const company of companies) {
      let churnScore = 0;
      const reasons = [];
      
      // Determinar tipo de cliente (com fallback para B2B)
      const clientType = company.clientType || 'B2B';
      const weights = CHURN_WEIGHTS[clientType];

      // 1. Contratos próximos do vencimento
      const contractsExpiringSoon = company.contracts.filter(contract => {
        const daysToExpire = Math.ceil((new Date(contract.endDate) - new Date()) / (1000 * 60 * 60 * 24));
        return daysToExpire <= 30 && daysToExpire > 0;
      });

      if (contractsExpiringSoon.length > 0) {
        churnScore += weights.contractExpiring;
        reasons.push(`Contratos próximos do vencimento (${contractsExpiringSoon.length})`);
      }

      // 2. Muitos tickets de suporte
      const ticketThreshold = clientType === 'B2G' ? 8 : 5; // B2G tolera mais tickets
      if (company.supportTickets.length > ticketThreshold) {
        churnScore += weights.highTickets;
        reasons.push(`Alto volume de tickets (${company.supportTickets.length})`);
      }

      // 3. NPS baixo (apenas para B2B e B2C)
      if (clientType !== 'B2G') {
        const recentNPS = company.npsSurveys.filter(survey => survey.score !== null);
        const avgNPS = recentNPS.length > 0 
          ? recentNPS.reduce((sum, survey) => sum + survey.score, 0) / recentNPS.length 
          : null;

        if (avgNPS !== null && avgNPS <= 6) {
          churnScore += weights.lowNPS;
          reasons.push(`NPS baixo (${avgNPS.toFixed(1)})`);
        }
      }

      // 4. Baixa atividade recente
      const activityThreshold = clientType === 'B2G' ? 0 : 1; // B2G pode ter 0 atividades
      if (company.activities.length <= activityThreshold) {
        churnScore += weights.lowActivity;
        reasons.push('Sem atividades recentes');
      }

      // 5. Tickets não resolvidos
      const unresolvedTickets = company.supportTickets.filter(
        ticket => !['RESOLVED', 'CLOSED'].includes(ticket.status)
      );

      if (unresolvedTickets.length > 0) {
        churnScore += weights.unresolvedTickets;
        reasons.push(`Tickets não resolvidos (${unresolvedTickets.length})`);
      }

      // Atualizar churn risk da empresa
      await prisma.company.update({
        where: { id: company.id },
        data: { churnRisk: churnScore }
      });

      // Threshold de alerta varia por tipo
      const alertThreshold = clientType === 'B2G' ? 40 : 50;
      
      if (churnScore >= alertThreshold) {
        const existingAlert = await prisma.churnAlert.findFirst({
          where: {
            companyId: company.id,
            status: 'ACTIVE'
          }
        });

        if (!existingAlert) {
          // Níveis de risco ajustados por tipo
          let riskLevel = 'MEDIUM';
          if (clientType === 'B2G') {
            if (churnScore >= 70) riskLevel = 'CRITICAL';
            else if (churnScore >= 55) riskLevel = 'HIGH';
          } else {
            if (churnScore >= 80) riskLevel = 'CRITICAL';
            else if (churnScore >= 65) riskLevel = 'HIGH';
          }

          const alert = await prisma.churnAlert.create({
            data: {
              companyId: company.id,
              riskLevel,
              reasons,
              score: churnScore
            },
            include: {
              company: {
                select: { id: true, name: true, document: true, clientType: true }
              }
            }
          });

          newAlerts.push(alert);
          stats[clientType]++;
        }
      }
    }

    res.json({
      message: `Análise de churn concluída. ${newAlerts.length} novos alertas criados.`,
      newAlerts,
      stats: {
        total: newAlerts.length,
        byType: stats
      }
    });
  } catch (error) {
    console.error('Erro na detecção de churn:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Relatório de pós-venda
router.get('/reports/summary', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const where = {};
    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const [
      onboardingStats,
      supportStats,
      npsStats,
      churnStats
    ] = await Promise.all([
      // Onboarding
      prisma.customerOnboarding.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      // Suporte
      prisma.supportTicket.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      // NPS
      prisma.nPSSurvey.aggregate({
        where: {
          ...where,
          status: 'RESPONDED'
        },
        _avg: { score: true },
        _count: { score: true }
      }),
      // Churn
      prisma.churnAlert.groupBy({
        by: ['riskLevel'],
        where: { status: 'ACTIVE' },
        _count: { riskLevel: true }
      })
    ]);

    res.json({
      onboarding: onboardingStats,
      support: supportStats,
      nps: {
        averageScore: npsStats._avg.score || 0,
        totalResponses: npsStats._count.score || 0
      },
      churn: churnStats
    });
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;