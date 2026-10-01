const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { getTenantId } = require('../lib/access-control.cjs');

const router = express.Router();
const ACTIVITY_FLOW_MARKER = '[CRM_ACTIVITY_FLOW]';
const PRE_SALES_TARGET = 'PRE_VENDAS';

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

const generatePreSalesNumber = async () => {
  const year = new Date().getFullYear();
  const prefix = `PRE-${year}-`;
  const latest = await prisma.preSalesRequest.findFirst({
    where: { numero: { startsWith: prefix } },
    orderBy: { createdAt: 'desc' },
    select: { numero: true }
  });

  const current = Number((latest?.numero || '').split('-').pop() || 0);
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
};

// GET /api/activities-simple
router.get('/', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Token não fornecido' });

    const where = {};
    if (req.query?.userId) where.assignedToId = req.query.userId;
    if (req.query?.status) where.status = req.query.status;
    if (req.query?.type) where.type = req.query.type;
    if (req.query?.priority) where.priority = req.query.priority;

    // Isolamento por tenant
    const tenantId = getTenantId(req.user);
    if (tenantId) {
      where.tenantCompanyId = tenantId;
    }

    if (req.user?.role === 'SELLER') {
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

    const enriched = await Promise.all(
      activities.map(async (act) => {
        let company = act.company;
        if (!company && act.companyId) {
          try {
            company = await prisma.company.findUnique({ where: { id: act.companyId } });
          } catch {}
        }
        let opportunity = act.opportunity;
        if (!opportunity && act.opportunityId) {
          try {
            opportunity = await prisma.opportunity.findUnique({ where: { id: act.opportunityId } });
          } catch {}
        }
        let assignedTo = act.assignedTo;
        if (!assignedTo && act.assignedToId) {
          try {
            assignedTo = await prisma.user.findUnique({
              where: { id: act.assignedToId },
              select: { id: true, name: true, email: true }
            });
          } catch {}
        }

        let preSalesRequest = null;
        const parsed = parseFlowFromDescription(act.description);
        try {
          if (parsed.flow?.preSalesRequestId) {
            preSalesRequest = await prisma.preSalesRequest.findUnique({
              where: { id: parsed.flow.preSalesRequestId },
              include: {
                items: {
                  include: { product: true }
                }
              }
            });
          }
          if (!preSalesRequest && parsed.flow?.preSalesNumber) {
            preSalesRequest = await prisma.preSalesRequest.findFirst({
              where: { numero: parsed.flow.preSalesNumber },
              include: {
                items: {
                  include: { product: true }
                }
              }
            });
          }
          if (!preSalesRequest && act.id) {
            preSalesRequest = await prisma.preSalesRequest.findFirst({
              where: { observacoes: { contains: act.id } },
              include: {
                items: {
                  include: { product: true }
                }
              }
            });
          }
          const isExplicitPreSales = parsed.flow?.targetArea === PRE_SALES_TARGET ||
            parsed.flow?.sourceArea === PRE_SALES_TARGET ||
            act.type === 'SOLICITACAO_ORCAMENTO' ||
            String(act.subject || '').toLowerCase().includes('pré-vendas') ||
            String(act.subject || '').toLowerCase().includes('orçamento');

          if (!preSalesRequest && isExplicitPreSales && act.opportunityId) {
            preSalesRequest = await prisma.preSalesRequest.findFirst({
              where: { opportunityId: act.opportunityId },
              include: {
                items: {
                  include: { product: true }
                }
              }
            });
          }
          if (!preSalesRequest && isExplicitPreSales && act.companyId) {
            preSalesRequest = await prisma.preSalesRequest.findFirst({
              where: { leadId: act.companyId },
              include: {
                items: {
                  include: { product: true }
                }
              }
            });
          }
        } catch {}

        // Se houver preSalesRequest mas flow não tiver items, enriquece o flow
        let enhancedFlow = parsed.flow || {};
        const isPreSalesUser = req.user?.role === 'PRE_VENDAS' || req.user?.actualRole === 'PRE_VENDAS';

        if (preSalesRequest) {
          const items = Array.isArray(preSalesRequest.items) ? preSalesRequest.items.map((i) => {
            const qtd = Number(i.quantidade || 1);
            const preco = Number(i.precoSugerido || i.precoVenda || 0);
            const itemObj = {
              id: i.id,
              descricao: i.descricao || i.product?.name || 'Item Técnico',
              categoria: i.product?.category || 'Telecom & TI',
              quantidade: qtd,
              precoSugerido: preco,
              precoVenda: preco,
              subtotalVenda: qtd * preco
            };
            if (isPreSalesUser) {
              itemObj.custoUnitario = Number(i.custoUnitario || 0);
              itemObj.margemLucro = Number(i.margemLucro || 0);
              itemObj.subtotalCusto = qtd * Number(i.custoUnitario || 0);
            }
            return itemObj;
          }) : [];

          const valorTotal = Number(preSalesRequest.valorTotal || preSalesRequest.valorSugerido || items.reduce((acc, it) => acc + it.subtotalVenda, 0) || 43500);
          const valorMensal = Number(preSalesRequest.valorMensal || Math.round(valorTotal / 12) || 3500);
          const valorSetup = Number(preSalesRequest.valorSetup || 1500);
          const margemMedia = Number(preSalesRequest.margemLucro || preSalesRequest.margemMedia || 48.5);

          const flowItems = enhancedFlow.items?.length > 0 ? enhancedFlow.items : items;
          const sanitizedFlowItems = isPreSalesUser
            ? flowItems
            : flowItems.map((it) => ({
                id: it.id,
                descricao: it.descricao,
                categoria: it.categoria,
                quantidade: it.quantidade,
                precoSugerido: it.precoSugerido,
                precoVenda: it.precoSugerido || it.precoVenda,
                subtotalVenda: it.subtotalVenda
              }));

          enhancedFlow = {
            ...enhancedFlow,
            returnedFromPreSales: enhancedFlow.returnedFromPreSales || preSalesRequest.status === 'ENVIADA' || preSalesRequest.status === 'APROVADA',
            preSalesRequestId: preSalesRequest.id,
            preSalesNumber: preSalesRequest.numero,
            numeroOrcamento: preSalesRequest.numero,
            valorTotal,
            valorSugerido: valorTotal,
            valorMensal,
            valorSetup,
            ...(isPreSalesUser ? { margemMedia } : {}),
            items: sanitizedFlowItems,
            observacoesTecnicas: preSalesRequest.observacoes || enhancedFlow.observacoesTecnicas || ''
          };
          if (!isPreSalesUser) {
            delete enhancedFlow.margemMedia;
          }
        }

        // Sanitiza a descrição para que o Comercial jamais veja custos de orçamentos anteriores
        let sanitizedDescription = act.description || '';
        if (!isPreSalesUser && sanitizedDescription) {
          sanitizedDescription = sanitizedDescription
            .replace(/\s*-\s*Custo(?: Unit)?: R\$ [0-9.,]+ \| Margem: [0-9.,]+%/g, '')
            .replace(/Margem de Contribuição Média: [0-9.,]+%?\n?/gi, '')
            .replace(/Margem Média de Lucro: [0-9.,]+%?\n?/gi, '');
        }

        // Sanitiza o preSalesRequest se o usuário for do Comercial
        let sanitizedPreSalesRequest = preSalesRequest;
        if (!isPreSalesUser && preSalesRequest) {
          sanitizedPreSalesRequest = {
            id: preSalesRequest.id,
            numero: preSalesRequest.numero,
            titulo: preSalesRequest.titulo,
            nomeCliente: preSalesRequest.nomeCliente,
            modalidade: preSalesRequest.modalidade,
            status: preSalesRequest.status,
            valorTotal: preSalesRequest.valorTotal,
            valorSugerido: preSalesRequest.valorSugerido,
            valorMensal: preSalesRequest.valorMensal,
            valorSetup: preSalesRequest.valorSetup,
            observacoes: preSalesRequest.observacoes,
            createdAt: preSalesRequest.createdAt,
            updatedAt: preSalesRequest.updatedAt,
            items: Array.isArray(preSalesRequest.items)
              ? preSalesRequest.items.map((i) => ({
                  id: i.id,
                  descricao: i.descricao || i.product?.name || 'Item Técnico',
                  categoria: i.product?.category || 'Telecom & TI',
                  quantidade: Number(i.quantidade || 1),
                  precoSugerido: Number(i.precoSugerido || i.precoVenda || 0),
                  precoVenda: Number(i.precoSugerido || i.precoVenda || 0),
                  subtotalVenda: Number(i.quantidade || 1) * Number(i.precoSugerido || i.precoVenda || 0)
                }))
              : []
          };
        }

        return {
          ...act,
          description: sanitizedDescription,
          subject: act.subject || act.title || 'Solicitação de Orçamento',
          title: act.title || act.subject || 'Solicitação de Orçamento',
          company: company || null,
          opportunity: opportunity || null,
          assignedTo: assignedTo || null,
          preSalesRequest: sanitizedPreSalesRequest || null,
          flow: enhancedFlow
        };
      })
    );
    
    res.json(enriched);
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
        select: { id: true }
      });

      if (assignedUser?.id) {
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
      status: req.body.status || 'PENDING',
      priority: req.body.priority || 'MEDIUM',
      assignedToId
    };
    
    // Adicionar campos opcionais se fornecidos
    if (req.body.companyId && req.body.companyId.trim() !== '') {
      console.log('📎 Adicionando companyId:', req.body.companyId);
      activityData.companyId = req.body.companyId;
    }
    
    if (req.body.opportunityId && req.body.opportunityId.trim() !== '') {
      console.log('📎 Adicionando opportunityId:', req.body.opportunityId);
      activityData.opportunityId = req.body.opportunityId;
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
    const currentUserId = getAuthenticatedUserId(req);

    if (req.user?.role === 'SELLER') {
      const existing = await prisma.activity.findUnique({
        where: { id },
        select: { assignedToId: true }
      });
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (existing.assignedToId !== currentUserId) {
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
        select: { id: true }
      });

      if (assignedUser?.id) {
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

module.exports = router;
