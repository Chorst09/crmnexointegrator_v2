const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { getTenantCompanyId, isTenantRecordVisible, tenantScopedWhere } = require('../lib/tenantScope.cjs');

const { canAccessModule, normalizeRole: normalizeClosureRole } = require('../lib/permissions');
const { createPreSalesClosureHandler, parseClosureFlow } = require('../lib/pre-sales-closure.cjs');
const router = express.Router();
const closePreSalesActivity = createPreSalesClosureHandler({
  prisma, tenantId: getTenantCompanyId, sourceType: 'ACTIVITY',
  canOperate: (user) => ['MASTER', 'ADMIN'].includes(normalizeClosureRole(user.actualRole || user.role)) || canAccessModule(user, 'PRE_SALES')
});
router.post('/:id/encerrar-prevendas', closePreSalesActivity);
const ACTIVITY_FLOW_MARKER = '[CRM_ACTIVITY_FLOW]';
const PRE_SALES_TARGET = 'PRE_VENDAS';

const normalizeRole = (user = {}) => String(user.actualRole || user.role || '').trim().toUpperCase();
const canDeleteActivity = (user = {}) => ['ADMIN', 'MASTER'].includes(normalizeRole(user));

const normalizeFlowArea = (value, fallback = 'COMERCIAL') => {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

  if (!raw) return fallback;
  if (raw === 'PREVENDAS') return PRE_SALES_TARGET;
  if (raw === 'B2B_PRIVADO') return 'B2B';
  if (raw === 'B2G_GOVERNO') return 'B2G';
  return raw;
};

const parseFlowFromDescription = (description) => {
  const value = String(description || '');
  const markerIdx = value.indexOf(ACTIVITY_FLOW_MARKER);

  if (markerIdx < 0) {
    return {
      hasMarker: false,
      cleanDescription: value.trim(),
      flow: {
        sourceArea: 'COMERCIAL',
        targetArea: 'COMERCIAL',
        createdFrom: 'LEGACY',
        createdByName: ''
      }
    };
  }

  const cleanDescription = value.slice(0, markerIdx).trim();
  const raw = value.slice(markerIdx + ACTIVITY_FLOW_MARKER.length).trim();
  let flow = {};

  try {
    flow = JSON.parse(raw);
  } catch {
    flow = {};
  }

  return {
    hasMarker: true,
    cleanDescription,
    flow: {
      ...(flow && typeof flow === 'object' ? flow : {}),
      sourceArea: flow?.sourceArea || 'COMERCIAL',
      targetArea: flow?.targetArea || 'COMERCIAL',
      createdFrom: flow?.createdFrom || 'ATIVIDADES',
      createdByName: flow?.createdByName || ''
    }
  };
};

const getAuthenticatedUserId = (req) => req.user?.userId || req.user?.id || null;

// O acesso ao módulo também pode ser concedido a perfis comerciais.
// A colaboração permanece restrita à fila de pré-vendas do mesmo tenant.
const canUsePreSalesQueue = (user = {}) => Boolean(
  getTenantCompanyId(user) && (user.accessPreSales === true || ['PRE_SALES', 'PRE_VENDAS'].includes(normalizeRole(user)))
);

const isPreSalesActivity = (activity = {}) => {
  const { flow, hasMarker } = parseFlowFromDescription(activity.description);
  return hasMarker && [flow.sourceArea, flow.targetArea].some((area) => normalizeFlowArea(area) === PRE_SALES_TARGET);
};

const canCollaborateOnActivity = (user, activity) => (
  isTenantRecordVisible(user, activity) && canUsePreSalesQueue(user) && isPreSalesActivity(activity)
);

const findTenantCompany = async (req, companyId) => {
  const normalized = String(companyId || '').trim();
  if (!normalized) return null;
  const company = await prisma.company.findUnique({
    where: { id: normalized },
    select: { id: true, tenantCompanyId: true }
  });
  return company && isTenantRecordVisible(req.user, company) ? company : null;
};

const findTenantOpportunity = async (req, opportunityId) => {
  const normalized = String(opportunityId || '').trim();
  if (!normalized) return null;
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: normalized },
    select: { id: true, tenantCompanyId: true }
  });
  return opportunity && isTenantRecordVisible(req.user, opportunity) ? opportunity : null;
};

const generatePreSalesNumber = async () => {
  const year = new Date().getFullYear();
  const suffix = `-${year}`;
  const currentYearRequests = await prisma.preSalesRequest.findMany({
    where: {
      numero: {
        startsWith: 'ORC-',
        endsWith: suffix
      }
    },
    select: { numero: true }
  });

  const current = currentYearRequests.reduce((max, request) => {
    const match = String(request?.numero || '').match(/^ORC-(\d{4})-\d{4}$/);
    const parsed = match ? parseInt(match[1], 10) : 0;
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 0);
  const next = current + 1;
  return `ORC-${String(next).padStart(4, '0')}-${year}`;
};

// GET /api/activities-simple
router.get('/', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Token não fornecido' });

    const where = {
      ...tenantScopedWhere(req.user)
    };
    if (req.query?.userId) where.assignedToId = req.query.userId;
    if (req.query?.status) where.status = req.query.status;
    if (req.query?.type) where.type = req.query.type;
    if (req.query?.priority) where.priority = req.query.priority;
    if (req.user?.role === 'SELLER' && !canUsePreSalesQueue(req.user)) {
      where.assignedToId = getAuthenticatedUserId(req);
    }

    const activities = await prisma.activity.findMany({
      where,
      include: {
        company: true,
        opportunity: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ]
    });
    
    const isPreSalesUser = req.user?.role === 'PRE_VENDAS' || req.user?.actualRole === 'PRE_VENDAS';
    const visibleActivities = req.user?.role === 'SELLER'
      ? activities.filter((act) => act.assignedToId === getAuthenticatedUserId(req) || canCollaborateOnActivity(req.user, act))
      : activities;
    const sanitized = visibleActivities.map((act) => {
      let desc = act.description || '';
      if (!isPreSalesUser && desc) {
        desc = desc
          .replace(/\s*-\s*Custo(?: Unit)?: R\$ [0-9.,]+ \| Margem: [0-9.,]+%/g, '')
          .replace(/Margem de Contribuição Média: [0-9.,]+%?\n?/gi, '')
          .replace(/Margem Média de Lucro: [0-9.,]+%?\n?/gi, '');
      }
      return {
        ...act,
        description: desc
      };
    });
    
    res.json(sanitized);
  } catch (error) {
    console.error('Erro ao buscar atividades:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/activities-simple
router.post('/', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Token não fornecido' });

    console.log('🟢 POST /api/activities-simple recebido');
    console.log('📦 Body completo:', JSON.stringify(req.body, null, 2));

    const currentUserId = getAuthenticatedUserId(req);
    if (!currentUserId) {
      return res.status(400).json({ error: 'Usuário autenticado inválido' });
    }

    const parsedDescription = parseFlowFromDescription(req.body.description || '');
    const explicitSourceArea = normalizeFlowArea(req.body.sourceArea, '');
    const explicitTargetArea = normalizeFlowArea(req.body.targetArea, '');
    const shouldInjectFlowMetadata = !parsedDescription.hasMarker && (explicitSourceArea || explicitTargetArea);
    const finalFlow = {
      sourceArea: normalizeFlowArea(
        parsedDescription.hasMarker ? parsedDescription.flow.sourceArea : explicitSourceArea,
        'COMERCIAL'
      ),
      targetArea: normalizeFlowArea(
        parsedDescription.hasMarker ? parsedDescription.flow.targetArea : explicitTargetArea,
        'COMERCIAL'
      ),
      createdFrom: parsedDescription.hasMarker ? parsedDescription.flow.createdFrom : 'ATIVIDADES',
      createdByName: parsedDescription.hasMarker
        ? parsedDescription.flow.createdByName
        : (req.body.createdByName || req.user?.name || '')
    };
    const descriptionWithFlow = shouldInjectFlowMetadata
      ? `${String(req.body.description || '').trim()}\n\n${ACTIVITY_FLOW_MARKER}${JSON.stringify({
        ...finalFlow,
        createdAt: new Date().toISOString()
      })}`
      : (req.body.description || '');

    const requestedAssignedToId = String(req.body.assignedToId || '').trim();
    let assignedToId = currentUserId;

    if (req.user.role === 'SELLER') {
      assignedToId = currentUserId;
    } else if (requestedAssignedToId) {
      const assignedUser = await prisma.user.findUnique({
        where: { id: requestedAssignedToId },
        select: { id: true, tenantCompanyId: true }
      });

      const tenantCompanyId = getTenantCompanyId(req.user);
      if (assignedUser?.id && (!tenantCompanyId || assignedUser.tenantCompanyId === tenantCompanyId)) {
        assignedToId = assignedUser.id;
      } else {
        console.warn('⚠️ assignedToId inválido recebido em /activities-simple, usando usuário autenticado.', {
          requestedAssignedToId,
          fallbackUserId: currentUserId
        });
      }
    }
    
    const activityData = {
      type: req.body.type || 'TASK',
      subject: req.body.subject || 'Sem título',
      description: descriptionWithFlow,
      status: 'PENDING',
      priority: req.body.priority || 'MEDIUM',
      assignedToId,
      tenantCompanyId: getTenantCompanyId(req.user)
    };
    
    // Adicionar campos opcionais se fornecidos
    if (req.body.companyId && req.body.companyId.trim() !== '') {
      console.log('📎 Adicionando companyId:', req.body.companyId);
      const company = await findTenantCompany(req, req.body.companyId);
      if (!company) return res.status(403).json({ error: 'Empresa não pertence a este tenant' });
      activityData.companyId = company.id;
    }
    
    if (req.body.opportunityId && req.body.opportunityId.trim() !== '') {
      console.log('📎 Adicionando opportunityId:', req.body.opportunityId);
      const opportunity = await findTenantOpportunity(req, req.body.opportunityId);
      if (!opportunity) return res.status(403).json({ error: 'Oportunidade não pertence a este tenant' });
      activityData.opportunityId = opportunity.id;
    }
    
    if (req.body.dueDate) {
      console.log('📅 Adicionando dueDate:', req.body.dueDate);
      activityData.dueDate = new Date(req.body.dueDate);
    }
    
    console.log('💾 Dados finais da atividade:', JSON.stringify(activityData, null, 2));
    
    const activity = await prisma.activity.create({
      data: activityData,
      include: {
        company: true,
        opportunity: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    console.log('✅ Atividade criada com sucesso:', activity.id);

    let generatedPreSalesRequestId = null;
    const parsedFlow = parseFlowFromDescription(activity.description);
    const sourceArea = normalizeFlowArea(parsedFlow.flow.sourceArea, finalFlow.sourceArea);
    const targetArea = normalizeFlowArea(parsedFlow.flow.targetArea, finalFlow.targetArea);
    const shouldCreatePreSalesRequest =
      targetArea === PRE_SALES_TARGET &&
      sourceArea !== PRE_SALES_TARGET;

    if (shouldCreatePreSalesRequest) {
      try {
        const activityMarker = `[FLOW_ACTIVITY_ID:${activity.id}]`;
        const existing = await prisma.preSalesRequest.findFirst({
          where: {
            observacoes: {
              contains: activityMarker
            }
          },
          select: { id: true }
        });

        if (!existing) {
          const numero = await generatePreSalesNumber();
          const request = await prisma.preSalesRequest.create({
            data: {
              numero,
              titulo: activity.subject || 'Solicitação do Comercial',
              descricao: parsedFlow.cleanDescription || activity.description || 'Solicitação recebida via atividade',
              status: 'NOVA',
              prioridade: activity.priority || 'MEDIUM',
              tiposPrecificacao: Array.isArray(req.body.tiposPrecificacao) && req.body.tiposPrecificacao.length > 0
                ? req.body.tiposPrecificacao
                : ['VENDA'],
              observacoes: [
                activityMarker,
                `Origem: ${sourceArea}`,
                `Destino: ${targetArea}`,
                'Solicitação gerada automaticamente a partir de atividade.'
              ].join('\n'),
              solicitanteId: currentUserId,
              leadId: activity.companyId || null,
              opportunityId: activity.opportunityId || null
            },
            select: { id: true }
          });

          generatedPreSalesRequestId = request.id;
          console.log('💰 Solicitação de pré-vendas gerada automaticamente:', request.id);
        }
      } catch (preSalesError) {
        console.error('Erro ao gerar solicitação automática de pré-vendas:', preSalesError);
      }
    }
    
    res.json({ success: true, activity, generatedPreSalesRequestId });
  } catch (error) {
    console.error('🔴 ERRO DETALHADO ao criar atividade:');
    console.error('❌ Mensagem:', error.message);
    console.error('📚 Stack:', error.stack);
    console.error('🔢 Código:', error.code);
    console.error('📦 Body que causou erro:', JSON.stringify(req.body, null, 2));
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
});

// PUT /api/activities-simple
router.put('/', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Token não fornecido' });

    const { id, status } = req.body;
    const closureActivity = await prisma.activity.findUnique({ where: { id } });
    if (parseClosureFlow(closureActivity?.description).flow.preSalesClosure) {
      return res.status(409).json({ error: 'Esta cotação já foi encerrada; o retorno ao comercial deve ser preservado' });
    }
    if (status === 'CANCELLED' && isPreSalesActivity(closureActivity || {})) {
      req.params = { ...req.params, id };
      req.body.status = 'CANCELADA';
      return closePreSalesActivity(req, res);
    }
    const currentUserId = getAuthenticatedUserId(req);

    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { assignedToId: true, tenantCompanyId: true, description: true }
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!isTenantRecordVisible(req.user, existing)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (req.user?.role === 'SELLER') {
      if (existing.assignedToId !== currentUserId && !canCollaborateOnActivity(req.user, existing)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
    }

    const nextData = {};
    if (status) {
      nextData.status = status;
      nextData.completedAt = status === 'COMPLETED' ? new Date() : null;
    }

    if (typeof req.body.subject === 'string' && req.body.subject.trim()) {
      nextData.subject = req.body.subject.trim();
    }

    if (typeof req.body.description === 'string') {
      nextData.description = req.body.description;
    }

    if (typeof req.body.priority === 'string' && req.body.priority.trim()) {
      nextData.priority = req.body.priority.trim();
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'dueDate')) {
      nextData.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
    }

    const requestedAssignedToId = String(req.body.assignedToId || '').trim();
    if (requestedAssignedToId) {
      if (req.user?.role === 'SELLER' && requestedAssignedToId !== currentUserId) {
        return res.status(403).json({ error: 'Acesso negado' });
      }

      const assignedUser = await prisma.user.findUnique({
        where: { id: requestedAssignedToId },
        select: { id: true, tenantCompanyId: true }
      });

      const tenantCompanyId = getTenantCompanyId(req.user);
      if (assignedUser?.id && (!tenantCompanyId || assignedUser.tenantCompanyId === tenantCompanyId)) {
        nextData.assignedToId = assignedUser.id;
      }
    }

    const activity = await prisma.activity.update({
      where: { id },
      data: nextData,
      include: {
        company: true,
        opportunity: true,
        assignedTo: {
          select: { id: true, name: true, email: true }
        }
      }
    });
    
    res.json({ success: true, activity });
  } catch (error) {
    console.error('Erro ao atualizar atividade:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message 
    });
  }
});

// DELETE /api/activities-simple/:id
router.delete('/:id', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Token não fornecido' });
    if (!canDeleteActivity(req.user)) {
      return res.status(403).json({ error: 'Apenas usuários Admin e Master podem excluir atividades' });
    }

    const { id } = req.params;
    const existing = await prisma.activity.findUnique({
      where: { id },
      select: { id: true, tenantCompanyId: true }
    });

    if (!existing) return res.status(404).json({ error: 'Atividade não encontrada' });
    if (!isTenantRecordVisible(req.user, existing)) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await prisma.activity.delete({ where: { id } });
    res.json({ success: true, deletedId: id });
  } catch (error) {
    console.error('Erro ao excluir atividade:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

module.exports = router;
