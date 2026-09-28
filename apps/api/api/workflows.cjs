const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken, requireRole } = require('../lib/auth.cjs');
const { getTenantId } = require('../lib/access-control.cjs');

const router = express.Router();

const getWorkflowDelegate = () => prisma.workflow || prisma.advancedWorkflow || null;
const getAutomationRuleDelegate = () => prisma.automationRule || null;
const emptyPagination = (page, limit) => ({
  page: parseInt(page),
  limit: parseInt(limit),
  total: 0,
  pages: 0
});

// ===== WORKFLOWS =====

// Listar workflows
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { active, trigger, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const workflowDelegate = getWorkflowDelegate();

    if (!workflowDelegate) {
      return res.json({
        workflows: [],
        pagination: emptyPagination(page, limit)
      });
    }

    const where = {};
    if (active !== undefined) {
      if (prisma.workflow) where.active = active === 'true';
      if (prisma.advancedWorkflow) where.isActive = active === 'true';
    }
    if (trigger && prisma.workflow) where.trigger = trigger;

    // Isolamento por tenant
    const tenantId = getTenantId(req.user);
    if (tenantId) {
      where.tenantCompanyId = tenantId;
    }

    const [workflows, total] = await Promise.all([
      workflowDelegate.findMany({
        where,
        include: {
          _count: {
            select: { executions: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      workflowDelegate.count({ where })
    ]);

    res.json({
      workflows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar workflows:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar workflow
router.post('/', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { name, description, trigger, conditions, actions } = req.body;

    if (!name || !trigger || !conditions || !actions) {
      return res.status(400).json({ 
        error: 'Nome, trigger, condições e ações são obrigatórios' 
      });
    }

    const workflow = await prisma.workflow.create({
      data: {
        name,
        description,
        trigger,
        conditions,
        actions
      }
    });

    res.status(201).json(workflow);
  } catch (error) {
    console.error('Erro ao criar workflow:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Executar workflow
router.post('/:id/execute', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { triggerData } = req.body;

    const workflow = await prisma.workflow.findUnique({
      where: { id }
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow não encontrado' });
    }

    if (!workflow.active) {
      return res.status(400).json({ error: 'Workflow está inativo' });
    }

    // Criar execução
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId: id,
        triggerData: triggerData || {},
        status: 'RUNNING'
      }
    });

    try {
      // Executar ações do workflow
      const result = await executeWorkflowActions(workflow, triggerData || {});

      // Atualizar execução como concluída
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          result
        }
      });

      res.json({ execution: { ...execution, status: 'COMPLETED', result } });
    } catch (error) {
      // Atualizar execução como falha
      await prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          error: error.message
        }
      });

      throw error;
    }
  } catch (error) {
    console.error('Erro ao executar workflow:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== REGRAS DE AUTOMAÇÃO =====

// Listar regras de automação
router.get('/automation-rules', authenticateToken, async (req, res) => {
  try {
    const { type, active, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;
    const automationRuleDelegate = getAutomationRuleDelegate();

    if (!automationRuleDelegate) {
      return res.json({
        rules: [],
        pagination: emptyPagination(page, limit)
      });
    }

    const where = {};
    if (type) where.type = type;
    if (active !== undefined) where.active = active === 'true';

    const [rules, total] = await Promise.all([
      automationRuleDelegate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      automationRuleDelegate.count({ where })
    ]);

    res.json({
      rules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar regras:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar regra de automação
router.post('/automation-rules', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { name, description, type, conditions, actions, active } = req.body;

    if (!name || !type || !conditions || !actions) {
      return res.status(400).json({ 
        error: 'Nome, tipo, condições e ações são obrigatórios' 
      });
    }

    const rule = await prisma.automationRule.create({
      data: {
        name,
        description,
        type,
        conditions,
        actions,
        active: active !== false
      }
    });

    res.status(201).json(rule);
  } catch (error) {
    console.error('Erro ao criar regra:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar regra de automação
router.put('/automation-rules/:id', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, conditions, actions, active } = req.body;

    if (!name || !type || !conditions || !actions) {
      return res.status(400).json({
        error: 'Nome, tipo, condições e ações são obrigatórios'
      });
    }

    const rule = await prisma.automationRule.update({
      where: { id },
      data: {
        name,
        description,
        type,
        conditions,
        actions,
        active: active !== false
      }
    });

    res.json(rule);
  } catch (error) {
    console.error('Erro ao atualizar regra:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Executar automações pendentes
router.post('/automation-rules/execute-pending', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { active: true }
    });

    const results = [];

    for (const rule of rules) {
      try {
        const result = await executeAutomationRule(rule);
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          success: true,
          result
        });

        // Atualizar última execução
        await prisma.automationRule.update({
          where: { id: rule.id },
          data: { lastRun: new Date() }
        });
      } catch (error) {
        results.push({
          ruleId: rule.id,
          ruleName: rule.name,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      message: `${results.length} regras processadas`,
      results
    });
  } catch (error) {
    console.error('Erro ao executar automações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Executar regra de automação individual
router.post('/automation-rules/:id/execute', authenticateToken, requireRole(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await prisma.automationRule.findUnique({ where: { id } });

    if (!rule) {
      return res.status(404).json({ error: 'Regra não encontrada' });
    }

    const result = await executeAutomationRule(rule);

    await prisma.automationRule.update({
      where: { id },
      data: { lastRun: new Date() }
    });

    res.json({
      message: `Regra "${rule.name}" executada com sucesso`,
      result
    });
  } catch (error) {
    console.error('Erro ao executar regra:', error);
    res.status(500).json({ error: error.message || 'Erro interno do servidor' });
  }
});

// ===== NOTIFICAÇÕES =====

// Listar notificações
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const { type, channel, status, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (type) where.type = type;
    if (channel) where.channel = channel;
    if (status) where.status = status;

    // Filtrar por usuário se não for admin
    if (req.user.role !== 'ADMIN') {
      where.recipientId = req.user.userId;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          recipient: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.notification.count({ where })
    ]);

    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Erro ao listar notificações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar notificação
router.post('/notifications', authenticateToken, async (req, res) => {
  try {
    const { type, title, message, channel, recipientId, metadata } = req.body;

    if (!type || !title || !message || !channel) {
      return res.status(400).json({ 
        error: 'Tipo, título, mensagem e canal são obrigatórios' 
      });
    }

    const notification = await prisma.notification.create({
      data: {
        type,
        title,
        message,
        channel,
        recipientId,
        metadata: metadata || {}
      },
      include: {
        recipient: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    // Processar envio da notificação
    try {
      await processNotification(notification);
      
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: 'SENT',
          sentAt: new Date()
        }
      });
    } catch (error) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED' }
      });
    }

    res.status(201).json(notification);
  } catch (error) {
    console.error('Erro ao criar notificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Marcar notificação como lida
router.put('/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { 
        id,
        recipientId: req.user.userId // Só pode marcar suas próprias notificações
      },
      data: {
        readAt: new Date()
      }
    });

    res.json(notification);
  } catch (error) {
    console.error('Erro ao marcar notificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ===== FUNÇÕES AUXILIARES =====

async function executeWorkflowActions(workflow, triggerData) {
  const results = [];
  
  for (const action of workflow.actions) {
    try {
      let result;
      
      switch (action.type) {
        case 'CREATE_TASK':
          result = await createAutomaticTask(action.params, triggerData);
          break;
        case 'SEND_EMAIL':
          result = await sendEmailNotification(action.params, triggerData);
          break;
        case 'SEND_WHATSAPP':
          result = await sendWhatsAppNotification(action.params, triggerData);
          break;
        case 'DISTRIBUTE_LEAD':
          result = await distributeLeadAutomatically(action.params, triggerData);
          break;
        case 'CREATE_FOLLOW_UP':
          result = await createFollowUpActivity(action.params, triggerData);
          break;
        default:
          result = { error: `Tipo de ação não suportado: ${action.type}` };
      }
      
      results.push({ action: action.type, success: true, result });
    } catch (error) {
      results.push({ action: action.type, success: false, error: error.message });
    }
  }
  
  return results;
}

async function executeAutomationRule(rule) {
  const results = [];
  const actions = Array.isArray(rule.actions)
    ? rule.actions
    : [{
        type: rule.type === 'FOLLOW_UP' ? 'CREATE_FOLLOW_UP' : 'CREATE_TASK',
        params: {
          title: rule.actions?.main || rule.name,
          subject: rule.actions?.main || rule.name,
          description: rule.description
        }
      }];
  
  // Buscar dados baseados no tipo de automação
  let targetData = [];
  
  switch (rule.type) {
    case 'LEAD_DISTRIBUTION':
      targetData = await findLeadsForDistribution(rule.conditions);
      break;
    case 'FOLLOW_UP':
      targetData = await findOpportunitiesForFollowUp(rule.conditions);
      break;
    case 'TASK_CREATION':
      targetData = await findItemsForTaskCreation(rule.conditions);
      break;
    case 'CHURN_DETECTION':
      targetData = await findCompaniesForChurnDetection(rule.conditions);
      break;
  }
  
  // Executar ações para cada item encontrado
  for (const item of targetData) {
    for (const action of actions) {
      try {
        const result = await executeAutomationAction(action, item);
        results.push({ item: item.id, action: action.type, success: true, result });
      } catch (error) {
        results.push({ item: item.id, action: action.type, success: false, error: error.message });
      }
    }
  }
  
  return results;
}

async function createAutomaticTask(params, triggerData) {
  const { title, description, priority, dueDate, assignedToId, companyId, opportunityId } = params;
  const responsibleUserId = assignedToId || triggerData.userId;

  if (!responsibleUserId) {
    return { skippedPersistence: true, reason: 'Nenhum usuário responsável informado para criar a tarefa' };
  }
  
  const activity = await prisma.activity.create({
    data: {
      type: 'TASK',
      subject: title,
      description,
      priority: priority || 'MEDIUM',
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId: responsibleUserId,
      companyId: companyId || triggerData.companyId,
      opportunityId: opportunityId || triggerData.opportunityId
    }
  });
  
  return { activityId: activity.id };
}

async function sendEmailNotification(params, triggerData) {
  // Simular envio de email
  console.log('📧 Enviando email:', params);
  
  await prisma.notification.create({
    data: {
      type: 'SYSTEM',
      title: params.subject,
      message: params.body,
      channel: 'EMAIL',
      recipientId: params.recipientId || triggerData.userId,
      metadata: {
        email: params.email,
        subject: params.subject
      }
    }
  });
  
  return { sent: true, email: params.email };
}

async function sendWhatsAppNotification(params, triggerData) {
  // Simular envio de WhatsApp
  console.log('📱 Enviando WhatsApp:', params);
  
  await prisma.notification.create({
    data: {
      type: 'SYSTEM',
      title: 'WhatsApp Message',
      message: params.message,
      channel: 'WHATSAPP',
      recipientId: params.recipientId || triggerData.userId,
      metadata: {
        phone: params.phone
      }
    }
  });
  
  return { sent: true, phone: params.phone };
}

async function distributeLeadAutomatically(params, triggerData) {
  // Implementar distribuição automática de leads
  const { leadDistribution } = require('../lib/leadDistribution');
  
  if (triggerData.companyId) {
    const result = await leadDistribution.distributeCompanyLead(triggerData.companyId);
    return result;
  }
  
  return { error: 'Company ID not provided' };
}

async function createFollowUpActivity(params, triggerData) {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + (params.daysFromNow || 1));
  const responsibleUserId = triggerData.userId || params.assignedToId;

  if (!responsibleUserId) {
    return { skippedPersistence: true, reason: 'Nenhum usuário responsável informado para criar o follow-up' };
  }
  
  const activity = await prisma.activity.create({
    data: {
      type: 'FOLLOW_UP',
      subject: params.subject || 'Follow-up automático',
      description: params.description,
      priority: 'MEDIUM',
      dueDate,
      assignedToId: responsibleUserId,
      companyId: triggerData.companyId,
      opportunityId: triggerData.opportunityId
    }
  });
  
  return { activityId: activity.id };
}

async function findLeadsForDistribution(conditions) {
  return await prisma.company.findMany({
    where: {
      status: 'LEAD',
      opportunities: {
        none: {} // Empresas sem oportunidades
      }
    },
    take: conditions.limit || 10
  });
}

async function findOpportunitiesForFollowUp(conditions) {
  const daysAgo = new Date();
  daysAgo.setDate(daysAgo.getDate() - (conditions.daysWithoutActivity || 7));
  
  return await prisma.opportunity.findMany({
    where: {
      stage: {
        in: ['LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION']
      },
      activities: {
        none: {
          createdAt: {
            gte: daysAgo
          }
        }
      }
    },
    include: {
      company: true,
      owner: true
    },
    take: conditions.limit || 20
  });
}

async function findItemsForTaskCreation(conditions) {
  // Implementar lógica específica baseada nas condições
  return [];
}

async function findCompaniesForChurnDetection(conditions) {
  return await prisma.company.findMany({
    where: {
      status: 'ACTIVE',
      churnRisk: {
        gte: conditions.minChurnScore || 50
      }
    },
    include: {
      contracts: true,
      supportTickets: true
    },
    take: conditions.limit || 50
  });
}

async function executeAutomationAction(action, item) {
  switch (action.type) {
    case 'CREATE_TASK':
      return await createAutomaticTask(action.params, { companyId: item.id });
    case 'SEND_EMAIL':
      return await sendEmailNotification(action.params, { companyId: item.id });
    case 'CREATE_FOLLOW_UP':
      return await createFollowUpActivity(action.params, { companyId: item.id });
    default:
      throw new Error(`Ação não suportada: ${action.type}`);
  }
}

async function processNotification(notification) {
  // Simular processamento de notificação
  console.log(`📬 Processando notificação ${notification.channel}:`, notification.title);
  
  switch (notification.channel) {
    case 'EMAIL':
      // Integração com serviço de email
      break;
    case 'WHATSAPP':
      // Integração com WhatsApp Business API
      break;
    case 'SMS':
      // Integração com serviço de SMS
      break;
    default:
      // Notificação in-app
      break;
  }
  
  return true;
}

module.exports = router;
