import { prisma } from '../lib/prisma.js';

export default async function handler(req) {
  const path = new URL(req.url || '/', 'http://localhost').pathname;
  const executeMatch = path.match(/\/([^/]+)\/execute\/?$/);

  if (req.method === 'POST' && executeMatch) {
    const body = await req.json();
    const workflowId = executeMatch[1];

    try {
      const result = await executeWorkflow(
        workflowId,
        { ...(body.triggerData || {}), ownerId: req.user?.userId },
        req.user?.userId
      );

      return Response.json({
        message: result.executed
          ? 'Workflow executado com sucesso'
          : `Workflow não executado: ${result.reason}`,
        ...result
      });
    } catch (error) {
      return Response.json({ error: error.message || 'Erro ao executar workflow' }, { status: 400 });
    }
  }

  if (req.method === 'GET') {
    const { type, active, category } = req.query || {};
    
    const where = {};
    if (active !== undefined) where.isActive = active === 'true';
    if (category) where.category = category;
    if (type) where.type = type;

    const workflows = await prisma.advancedWorkflow.findMany({
      where,
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            triggeredBy: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: { executions: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    
    return Response.json(workflows);
  }

  if (req.method === 'POST') {
    const body = await req.json();
    
    const workflow = await prisma.advancedWorkflow.create({
      data: {
        name: body.name,
        description: body.description,
        type: body.type,
        category: body.category || 'GENERAL',
        trigger: body.trigger,
        conditions: body.conditions,
        actions: body.actions,
        escalationRules: body.escalationRules || {},
        priority: body.priority || 'MEDIUM',
        isActive: body.isActive !== false
      }
    });
    
    return Response.json(workflow);
  }

  if (req.method === 'PUT') {
    const body = await req.json();
    const { id } = body;
    
    const workflow = await prisma.advancedWorkflow.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        type: body.type,
        category: body.category,
        trigger: body.trigger,
        conditions: body.conditions,
        actions: body.actions,
        escalationRules: body.escalationRules,
        priority: body.priority,
        isActive: body.isActive
      }
    });
    
    return Response.json(workflow);
  }

  if (req.method === 'DELETE') {
    const body = await req.json();
    const { id } = body;
    
    await prisma.advancedWorkflow.delete({
      where: { id }
    });
    
    return Response.json({ message: 'Workflow excluído com sucesso' });
  }

  return Response.json({ error: 'Método não permitido' }, { status: 405 });
}

// Função para executar workflow
export async function executeWorkflow(workflowId, triggerData, userId) {
  const workflow = await prisma.advancedWorkflow.findFirst({
    where: { id: workflowId, isActive: true }
  });

  if (!workflow) {
    throw new Error('Workflow não encontrado ou inativo');
  }

  // Verificar condições
  const conditionsMet = evaluateConditions(workflow.conditions, triggerData);
  
  if (!conditionsMet) {
    return { executed: false, reason: 'Condições não atendidas' };
  }

  // Criar execução
  const execution = await prisma.workflowExecution.create({
    data: {
      workflowId,
      triggeredById: userId,
      triggerData,
      status: 'RUNNING'
    }
  });

  try {
    // Executar ações
    const results = [];
    for (const action of workflow.actions) {
      const result = await executeAction(action, triggerData, execution.id);
      results.push(result);
    }

    // Atualizar execução como concluída
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED',
        results,
        completedAt: new Date()
      }
    });

    return { executed: true, executionId: execution.id, results };
  } catch (error) {
    // Atualizar execução como falha
    await prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: 'FAILED',
        error: error.message,
        completedAt: new Date()
      }
    });

    // Verificar regras de escalação
    if (workflow.escalationRules && workflow.escalationRules.onFailure) {
      await handleEscalation(workflow.escalationRules.onFailure, triggerData, error);
    }

    throw error;
  }
}

function evaluateConditions(conditions, data) {
  if (!conditions || conditions.length === 0) return true;

  return conditions.every(condition => {
    const { field, operator, value } = condition;
    const fieldValue = getNestedValue(data, field);

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      case 'contains':
        return String(fieldValue).includes(String(value));
      case 'in':
        return Array.isArray(value) && value.includes(fieldValue);
      case 'exists':
        return fieldValue !== undefined && fieldValue !== null;
      default:
        return false;
    }
  });
}

async function executeAction(action, triggerData, executionId) {
  const { type } = action;
  const params = action.params || action.config || {};

  switch (type) {
    case 'CREATE_ACTIVITY':
      return await createActivity(params, triggerData);
    
    case 'SEND_EMAIL':
      return await sendEmail(params, triggerData);
    
    case 'SEND_NOTIFICATION':
    case 'CREATE_NOTIFICATION':
      return await sendNotification(params, triggerData);

    case 'SEND_WHATSAPP':
      return {
        success: true,
        channel: 'WHATSAPP',
        message: replaceVariables(params.message || 'Mensagem enviada pelo workflow', triggerData)
      };

    case 'ASSIGN_LEAD':
    case 'ASSIGN_TO_USER':
      return {
        success: true,
        assignmentStrategy: params.strategy || 'manual',
        assignedToId: params.assignedToId || triggerData.ownerId || null
      };

    case 'UPDATE_FIELD':
      return {
        success: true,
        field: params.field || action.field || null,
        value: params.value || action.value || null
      };
    
    case 'UPDATE_OPPORTUNITY':
      return await updateOpportunity(params, triggerData);
    
    case 'ASSIGN_TO_USER':
      return await assignToUser(params, triggerData);
    
    case 'CREATE_APPROVAL_REQUEST':
      return await createApprovalRequest(params, triggerData);
    
    case 'ESCALATE':
      return await escalateToManager(params, triggerData);
    
    case 'WEBHOOK':
      return await callWebhook(params, triggerData);
    
    default:
      throw new Error(`Tipo de ação não suportado: ${type}`);
  }
}

async function createActivity(params, data) {
  const assignedToId = params.assignedToId || data.ownerId;

  if (!assignedToId) {
    return {
      success: true,
      skippedPersistence: true,
      reason: 'Nenhum usuário responsável informado para criar a atividade'
    };
  }

  const activity = await prisma.activity.create({
    data: {
      type: params.type || 'TASK',
      subject: replaceVariables(params.subject, data),
      description: replaceVariables(params.description, data),
      priority: params.priority || 'MEDIUM',
      dueDate: params.dueDate ? new Date(params.dueDate) : null,
      assignedToId,
      companyId: data.companyId,
      opportunityId: data.opportunityId
    }
  });

  return { success: true, activityId: activity.id };
}

async function sendEmail(params, data) {
  // Implementar envio de e-mail
  const emailData = {
    to: replaceVariables(params.to, data),
    subject: replaceVariables(params.subject, data),
    body: replaceVariables(params.body, data),
    template: params.template
  };

  // Aqui você integraria com seu provedor de e-mail
  console.log('Enviando e-mail:', emailData);
  
  return { success: true, emailSent: true };
}

async function sendNotification(params, data) {
  const notification = await prisma.notification.create({
    data: {
      type: params.type || 'WORKFLOW',
      title: replaceVariables(params.title, data),
      message: replaceVariables(params.message, data),
      channel: params.channel || 'IN_APP',
      recipientId: params.recipientId || data.ownerId,
      status: 'SENT',
      sentAt: new Date()
    }
  });

  return { success: true, notificationId: notification.id };
}

async function handleEscalation(escalationRule, data, error) {
  const { type, params } = escalationRule;

  switch (type) {
    case 'NOTIFY_MANAGER':
      // Notificar gerente
      await sendNotification({
        title: 'Falha em Workflow',
        message: `Workflow falhou: ${error.message}`,
        recipientId: params.managerId,
        channel: 'EMAIL'
      }, data);
      break;
    
    case 'CREATE_TICKET':
      // Criar ticket de suporte
      await prisma.supportTicket.create({
        data: {
          title: 'Falha em Workflow Automático',
          description: `Erro: ${error.message}\nDados: ${JSON.stringify(data)}`,
          priority: 'HIGH',
          category: 'Sistema',
          assignedToId: params.assignedToId
        }
      });
      break;
  }
}

function replaceVariables(template, data) {
  if (!template) return '';
  
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    return getNestedValue(data, path) || match;
  });
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}
