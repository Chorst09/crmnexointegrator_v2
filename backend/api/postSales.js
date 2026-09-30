const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken } = require('../lib/auth');
const { getTenantCompanyId, mergeRelationWhere, tenantScopedWhere } = require('../lib/tenantScope.cjs');

const router = express.Router();
const prisma = new PrismaClient();

const scopeCompanyRelationWhere = (req, where = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  return tenantCompanyId ? mergeRelationWhere(where, 'company', { tenantCompanyId }) : where;
};

const canAccessCompanyId = async (req, companyId) => {
  const normalized = String(companyId || '').trim();
  if (!normalized) return false;
  const company = await prisma.company.findFirst({
    where: { id: normalized, ...tenantScopedWhere(req.user) },
    select: { id: true }
  });
  return Boolean(company);
};

// ===== ONBOARDING =====

// Listar onboardings
router.get('/onboarding', authenticateToken, async (req, res) => {
  try {
    const { status, companyId, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let where = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;

    // Filtrar por permissão
    if (req.user.role === 'SELLER') {
      where.assignedToId = req.user.userId;
    }
    where = scopeCompanyRelationWhere(req, where);

    const [onboardings, total] = await Promise.all([
      prisma.customerOnboarding.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
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
    const { companyId, contractId, assignedToId, expectedEndDate, description, steps } = req.body;

    if (!companyId || !assignedToId) {
      return res.status(400).json({ error: 'Empresa e responsável são obrigatórios' });
    }
    if (!(await canAccessCompanyId(req, companyId))) {
      return res.status(403).json({ error: 'Empresa não pertence a este tenant' });
    }

    const onboarding = await prisma.customerOnboarding.create({
      data: {
        companyId,
        contractId: contractId || null,
        assignedToId,
        expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null,
        description: description || null,
        status: 'IN_PROGRESS',
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
          select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
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

// Atualizar onboarding
router.put('/onboarding/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, assignedToId, expectedEndDate, description } = req.body;

    const current = await prisma.customerOnboarding.findFirst({
      where: scopeCompanyRelationWhere(req, { id })
    });
    if (!current) {
      return res.status(404).json({ error: 'Onboarding não encontrado' });
    }

    if (req.user.role === 'SELLER' && current.assignedToId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const data = {};
    if (status) {
      data.status = status;
      if (status === 'COMPLETED') data.actualEndDate = new Date();
      if (status !== 'COMPLETED') data.actualEndDate = null;
    }
    if (assignedToId !== undefined) data.assignedToId = assignedToId || current.assignedToId;
    if (expectedEndDate !== undefined) data.expectedEndDate = expectedEndDate ? new Date(expectedEndDate) : null;
    if (description !== undefined) data.description = description || null;

    const onboarding = await prisma.customerOnboarding.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true, document: true, clientType: true, churnRisk: true } },
        contract: { select: { id: true, number: true, title: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { steps: true } }
      }
    });

    res.json(onboarding);
  } catch (error) {
    console.error('Erro ao atualizar onboarding:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar step do onboarding
router.put('/onboarding/:id/steps/:stepId', authenticateToken, async (req, res) => {
  try {
    const { id, stepId } = req.params;
    const { status, completedAt } = req.body;

    // Verificar permissão
    const onboarding = await prisma.customerOnboarding.findFirst({
      where: scopeCompanyRelationWhere(req, { id })
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
    } else {
      await prisma.customerOnboarding.update({
        where: { id },
        data: {
          status: completedSteps.length > 0 ? 'IN_PROGRESS' : 'PENDING',
          actualEndDate: null
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

    let where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (companyId) where.companyId = companyId;

    // Filtrar por permissão
    if (req.user.role === 'SELLER') {
      where.assignedToId = req.user.userId;
    }
    where = scopeCompanyRelationWhere(req, where);

    const [tickets, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
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
    const { title, description, priority, category, companyId, assignedToId } = req.body;

    if (!title || !description || !companyId) {
      return res.status(400).json({ 
        error: 'Título, descrição e empresa são obrigatórios' 
      });
    }
    if (!(await canAccessCompanyId(req, companyId))) {
      return res.status(403).json({ error: 'Empresa não pertence a este tenant' });
    }

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

    // Calcular SLA baseado na prioridade
    const slaHours = {
      'LOW': 72,
      'MEDIUM': 24,
      'HIGH': 8,
      'URGENT': 4
    };

    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + (slaHours[priority] || 24));

    const ticket = await prisma.supportTicket.create({
      data: {
        number,
        title,
        description,
        priority: priority || 'MEDIUM',
        category,
        companyId,
        assignedToId: assignedToId || req.user.userId,
        slaDeadline
      },
      include: {
        company: {
          select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
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

// Atualizar ticket
router.put('/support/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, priority, category, status, assignedToId } = req.body;

    const current = await prisma.supportTicket.findFirst({
      where: scopeCompanyRelationWhere(req, { id })
    });
    if (!current) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (req.user.role === 'SELLER' && current.assignedToId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const data = {};
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (priority !== undefined) data.priority = priority;
    if (category !== undefined) data.category = category;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;
    if (status !== undefined) {
      data.status = status;
      if (['RESOLVED', 'CLOSED'].includes(status)) data.resolvedAt = new Date();
      if (!['RESOLVED', 'CLOSED'].includes(status)) data.resolvedAt = null;
    }

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true, document: true, clientType: true, churnRisk: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { responses: true } }
      }
    });

    res.json(ticket);
  } catch (error) {
    console.error('Erro ao atualizar ticket:', error);
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

    const ticket = await prisma.supportTicket.findFirst({
      where: scopeCompanyRelationWhere(req, { id })
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }
    if (req.user.role === 'SELLER' && ticket.assignedToId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
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

    await prisma.supportTicket.update({
      where: { id },
      data: { status: isInternal ? undefined : 'IN_PROGRESS' }
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

    let where = {};
    if (status) where.status = status;
    if (companyId) where.companyId = companyId;
    where = scopeCompanyRelationWhere(req, where);

    const [surveys, total] = await Promise.all([
      prisma.nPSSurvey.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
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
    if (!(await canAccessCompanyId(req, companyId))) {
      return res.status(403).json({ error: 'Empresa não pertence a este tenant' });
    }

    const survey = await prisma.nPSSurvey.create({
      data: {
        companyId,
        contractId: contractId || null,
        status: 'SENT',
        sentAt: new Date()
      },
      include: {
        company: {
          select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
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
      },
      include: {
        company: { select: { id: true, name: true, document: true, clientType: true, churnRisk: true } },
        contract: { select: { id: true, number: true, title: true } }
      }
    });

    res.json(survey);
  } catch (error) {
    console.error('Erro ao responder pesquisa NPS:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar respostas de um ticket
router.get('/support/:id/responses', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const ticket = await prisma.supportTicket.findFirst({
      where: scopeCompanyRelationWhere(req, { id })
    });
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket não encontrado' });
    }

    if (req.user.role === 'SELLER' && ticket.assignedToId !== req.user.userId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const responses = await prisma.ticketResponse.findMany({
      where: { ticketId: id },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    res.json({ responses });
  } catch (error) {
    console.error('Erro ao listar respostas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== CHURN ALERTS =====

// Resolver alerta de churn
router.put('/churn-alerts/:id/resolve', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const alert = await prisma.churnAlert.findFirst({
      where: scopeCompanyRelationWhere(req, { id })
    });
    if (!alert) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }

    const updated = await prisma.churnAlert.update({
      where: { id },
      data: {
        status: 'RESOLVED'
      },
      include: {
        company: {
          select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
        },
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Resetar churnRisk da empresa
    await prisma.company.update({
      where: { id: alert.companyId },
      data: { churnRisk: 0 }
    });

    res.json(updated);
  } catch (error) {
    console.error('Erro ao resolver alerta de churn:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar alertas de churn
router.get('/churn-alerts', authenticateToken, async (req, res) => {
  try {
    const { riskLevel, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    let where = {};
    if (riskLevel) where.riskLevel = riskLevel;
    if (status) where.status = status;

    // Filtrar por permissão
    if (req.user.role === 'SELLER') {
      where.assignedToId = req.user.userId;
    }
    where = scopeCompanyRelationWhere(req, where);

    const [alerts, total] = await Promise.all([
      prisma.churnAlert.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
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

// Processar detecção de churn
router.post('/churn-alerts/detect', authenticateToken, async (req, res) => {
  try {
    if (!['MASTER', 'ADMIN', 'MANAGER'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar empresas ativas para análise
    const companies = await prisma.company.findMany({
      where: { status: 'ACTIVE', ...tenantScopedWhere(req.user) },
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
        npssurveys: {
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

    for (const company of companies) {
      let churnScore = 0;
      const reasons = [];

      // 1. Contratos próximos do vencimento (30 pontos)
      const contractsExpiringSoon = company.contracts.filter(contract => {
        const daysToExpire = Math.ceil((new Date(contract.endDate) - new Date()) / (1000 * 60 * 60 * 24));
        return daysToExpire <= 30 && daysToExpire > 0;
      });

      if (contractsExpiringSoon.length > 0) {
        churnScore += 30;
        reasons.push('Contratos próximos do vencimento');
      }

      // 2. Muitos tickets de suporte (25 pontos)
      if (company.supportTickets.length > 5) {
        churnScore += 25;
        reasons.push('Alto volume de tickets de suporte');
      }

      // 3. NPS baixo (35 pontos)
      const recentNPS = company.npssurveys.filter(survey => survey.score !== null);
      const avgNPS = recentNPS.length > 0 
        ? recentNPS.reduce((sum, survey) => sum + survey.score, 0) / recentNPS.length 
        : null;

      if (avgNPS !== null && avgNPS <= 6) {
        churnScore += 35;
        reasons.push(`NPS baixo (${avgNPS.toFixed(1)})`);
      }

      // 4. Baixa atividade recente (20 pontos)
      if (company.activities.length === 0) {
        churnScore += 20;
        reasons.push('Sem atividades recentes');
      }

      // 5. Tickets não resolvidos (15 pontos)
      const unresolvedTickets = company.supportTickets.filter(
        ticket => !['RESOLVED', 'CLOSED'].includes(ticket.status)
      );

      if (unresolvedTickets.length > 0) {
        churnScore += 15;
        reasons.push('Tickets não resolvidos');
      }

      // Atualizar churn risk da empresa
      await prisma.company.update({
        where: { id: company.id },
        data: { churnRisk: churnScore }
      });

      // Criar alerta se score alto e não existe alerta ativo
      if (churnScore >= 50) {
        const existingAlert = await prisma.churnAlert.findFirst({
          where: {
            companyId: company.id,
            status: 'ACTIVE'
          }
        });

        if (!existingAlert) {
          let riskLevel = 'MEDIUM';
          if (churnScore >= 80) riskLevel = 'CRITICAL';
          else if (churnScore >= 65) riskLevel = 'HIGH';

          const alert = await prisma.churnAlert.create({
            data: {
              companyId: company.id,
              riskLevel,
              reasons,
              score: churnScore,
              assignedToId: req.user.userId
            },
            include: {
              company: {
                select: { id: true, name: true, document: true, clientType: true, churnRisk: true }
              },
              assignedTo: { select: { id: true, name: true, email: true } }
            }
          });

          newAlerts.push(alert);
        }
      }
    }

    res.json({
      message: `Análise de churn concluída. ${newAlerts.length} novos alertas criados.`,
      newAlerts
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
        where: scopeCompanyRelationWhere(req, where),
        _count: { status: true }
      }),
      // Suporte
      prisma.supportTicket.groupBy({
        by: ['status'],
        where: scopeCompanyRelationWhere(req, where),
        _count: { status: true }
      }),
      // NPS
      prisma.nPSSurvey.aggregate({
        where: scopeCompanyRelationWhere(req, {
          ...where,
          status: 'RESPONDED'
        }),
        _avg: { score: true },
        _count: { score: true }
      }),
      // Churn
      prisma.churnAlert.groupBy({
        by: ['riskLevel'],
        where: scopeCompanyRelationWhere(req, { status: 'ACTIVE' }),
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
