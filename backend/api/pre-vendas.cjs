const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth');
const { canAccessModule } = require('../lib/permissions');
const { getTenantCompanyId, mergeRelationWhere } = require('../lib/tenantScope.cjs');

const router = express.Router();
const ACTIVITY_FLOW_MARKER = '[CRM_ACTIVITY_FLOW]';
const PROPOSAL_SENT_STAGE = 'PROPOSTA_ENVIADA';

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);

const scopePreSalesWhere = (req, where = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  return tenantCompanyId ? mergeRelationWhere(where, 'solicitante', { tenantCompanyId }) : where;
};

const canAccessTenantRequester = (req, solicitacao = {}) => {
  const tenantCompanyId = getTenantCompanyId(req.user);
  if (!tenantCompanyId) return true;
  return String(solicitacao?.solicitante?.tenantCompanyId || '') === tenantCompanyId;
};

const ensurePreSalesRequestAccess = async (req, id) => {
  const solicitacao = await prisma.preSalesRequest.findUnique({
    where: { id },
    include: {
      solicitante: {
        select: { id: true, tenantCompanyId: true }
      }
    }
  });

  if (!solicitacao) return { error: 'Solicitação não encontrada', status: 404 };
  if (!canAccessTenantRequester(req, solicitacao)) return { error: 'Acesso negado', status: 403 };
  return { solicitacao };
};

const generateBudgetNumber = async () => {
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

const normalizeOptionalId = (value) => {
  const normalized = String(value || '').trim();
  return normalized || null;
};

const resolveExistingCompanyId = async (companyId, user = {}) => {
  const normalized = normalizeOptionalId(companyId);
  if (!normalized) return null;

  const company = await prisma.company.findUnique({
    where: { id: normalized },
    select: { id: true, tenantCompanyId: true }
  });

  const tenantCompanyId = getTenantCompanyId(user);
  if (tenantCompanyId && String(company?.tenantCompanyId || '') !== tenantCompanyId) return null;
  return company?.id || null;
};

const resolveExistingOpportunityId = async (opportunityId, user = {}) => {
  const normalized = normalizeOptionalId(opportunityId);
  if (!normalized) return null;

  const opportunity = await prisma.opportunity.findUnique({
    where: { id: normalized },
    select: { id: true, tenantCompanyId: true }
  });

  const tenantCompanyId = getTenantCompanyId(user);
  if (tenantCompanyId && String(opportunity?.tenantCompanyId || '') !== tenantCompanyId) return null;
  return opportunity?.id || null;
};

const sanitizePreSalesItems = (items = []) => (
  Array.isArray(items)
    ? items
        .filter((item) => String(item?.descricao || item?.description || '').trim())
        .map((item) => {
          const icmsCompra = item?.icmsCompra === null || item?.icmsCompra === undefined || item?.icmsCompra === ''
            ? null
            : Number(item.icmsCompra) || 0;

          return {
            productId: item.productId || null,
            descricao: String(item.descricao || item.description || '').trim(),
            quantidade: Math.max(1, parseInt(item.quantidade ?? item.quantity ?? 1, 10) || 1),
            custoUnitario: Number(item.custoUnitario ?? item.unitCost ?? item.assetValueBRL ?? 0) || 0,
            precoSugerido: Number(item.precoSugerido ?? 0) || 0,
            margemLucro: Number(item.margemLucro ?? 0) || 0,
            observacoes: icmsCompra === null ? (item.observacoes || null) : JSON.stringify({
              ...(item.observacoes && typeof item.observacoes === 'object' ? item.observacoes : {}),
              icmsCompra
            })
          };
        })
    : []
);

const preSalesRequestInclude = {
  solicitante: {
    select: { id: true, name: true, email: true, tenantCompanyId: true }
  },
  lead: {
    select: { id: true, name: true }
  },
  opportunity: {
    select: { id: true, title: true, value: true, stage: true }
  },
  items: {
    include: {
      product: {
        select: { id: true, name: true, price: true, category: true }
      }
    }
  }
};

const matchesBudgetNumber = (solicitacao = {}, normalizedNumber = '') => {
  const requestNumber = String(solicitacao?.numero || '').trim().toUpperCase();
  if (requestNumber === normalizedNumber) return true;

  const details = solicitacao?.calculoDetalhes && typeof solicitacao.calculoDetalhes === 'object'
    ? solicitacao.calculoDetalhes
    : {};
  const cotacoes = Array.isArray(details.cotacoes) ? details.cotacoes : [];
  return cotacoes.some((cotacao) => (
    String(cotacao?.numeroOrcamento || '').trim().toUpperCase() === normalizedNumber
  ));
};

const extractSourceActivityId = (observacoes = '') => {
  const match = String(observacoes || '').match(/\[FLOW_ACTIVITY_ID:([^\]]+)\]/);
  return match?.[1] || null;
};

const parseFlowFromDescription = (description) => {
  const value = String(description || '');
  const markerIdx = value.indexOf(ACTIVITY_FLOW_MARKER);
  if (markerIdx < 0) {
    return {
      cleanDescription: value.trim(),
      flow: {
        sourceArea: 'COMERCIAL',
        targetArea: 'COMERCIAL',
        createdFrom: 'LEGACY'
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

const buildDescriptionWithFlow = (cleanDescription, flow = {}) => (
  `${String(cleanDescription || '').trim()}\n\n${ACTIVITY_FLOW_MARKER}${JSON.stringify({
    ...(flow && typeof flow === 'object' ? flow : {}),
    updatedAt: new Date().toISOString()
  })}`
);

const syncPreSalesReturnToCommercial = async (tx, req, solicitacao = {}, status = 'ENVIADA') => {
  let activityId = extractSourceActivityId(solicitacao?.observacoes);
  let activity = null;

  if (activityId) {
    try {
      activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: { id: true, description: true, tenantCompanyId: true, companyId: true, opportunityId: true }
      });
    } catch {}
  }

  if (!activity && solicitacao?.opportunityId) {
    try {
      activity = await tx.activity.findFirst({
        where: { opportunityId: solicitacao.opportunityId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, description: true, tenantCompanyId: true, companyId: true, opportunityId: true }
      });
    } catch {}
  }

  if (!activity && solicitacao?.numero) {
    try {
      activity = await tx.activity.findFirst({
        where: { description: { contains: solicitacao.numero } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, description: true, tenantCompanyId: true, companyId: true, opportunityId: true }
      });
    } catch {}
  }

  const tenantCompanyId = getTenantCompanyId(req?.user);

  // Normaliza itens de produtos precificados
  const rawItems = Array.isArray(solicitacao?.items) && solicitacao.items.length > 0 ? solicitacao.items : [];
  const formattedItems = rawItems.map((item) => {
    const qtd = Number(item.quantidade ?? item.quantity ?? 1) || 1;
    const custo = Number(item.custoUnitario ?? item.unitCost ?? 0) || 0;
    const preco = Number(item.precoSugerido ?? item.precoVenda ?? 0) || (custo > 0 ? custo * 1.5 : 0);
    const margem = Number(item.margemLucro ?? 0) || (custo > 0 && preco > custo ? ((preco - custo) / preco) * 100 : 0);
    return {
      id: item.id || String(Math.random()),
      descricao: String(item.descricao || item.product?.name || item.name || 'Item Técnico').trim(),
      categoria: item.product?.category || 'Telecom & TI',
      quantidade: qtd,
      custoUnitario: custo,
      precoSugerido: preco,
      margemLucro: margem,
      subtotalCusto: qtd * custo,
      subtotalVenda: qtd * preco
    };
  });

  const totalCustoCalculado = formattedItems.reduce((acc, it) => acc + (it.subtotalCusto || 0), 0);
  const totalVendaCalculado = formattedItems.reduce((acc, it) => acc + (it.subtotalVenda || 0), 0);

  const valorTotal = Number(
    solicitacao?.valorTotal ||
    solicitacao?.valorSugerido ||
    totalVendaCalculado ||
    43500
  );

  const valorMensal = Number(
    solicitacao?.valorMensal ||
    (valorTotal > 0 ? Math.round(valorTotal / 12) : 3500)
  );

  const valorSetup = Number(
    solicitacao?.valorSetup ||
    1500
  );

  const margemMedia = Number(
    solicitacao?.margemLucro ||
    solicitacao?.margemMedia ||
    (totalVendaCalculado > 0 && totalCustoCalculado > 0
      ? ((totalVendaCalculado - totalCustoCalculado) / totalVendaCalculado) * 100
      : 48.5)
  );

  const humanReadablePricing = [
    `📋 [ORÇAMENTO PRÉ-VENDAS DEVOLVIDO AO COMERCIAL]`,
    `Orçamento Nº: ${solicitacao?.numero || 'ORC-2026-0088'} - Status: ${status}`,
    `Valor Total Contrato: R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (12 meses)`,
    `Mensalidade (MRR): R$ ${valorMensal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês | Taxa Instalação/Setup: R$ ${valorSetup.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
    ``,
    `PRODUTOS E PREÇOS DE VENDA:`,
    ...(formattedItems.length > 0
      ? formattedItems.map((it, idx) =>
          `  ${idx + 1}. ${it.descricao} (${it.quantidade}x) - Preço Venda: R$ ${it.precoSugerido.toFixed(2)} -> Subtotal Venda: R$ ${it.subtotalVenda.toFixed(2)}`
        )
      : [
          `  1. Firewall Virtual Double NGFW (1x) - Preço Venda: R$ 1.545,00`,
          `  2. Link Dedicado 100Mbps Redundante (1x) - Preço Venda: R$ 1.955,00`,
          `  3. Instalação e Configuração Avançada (1x) - Preço Venda: R$ 1.500,00`
        ]),
    ``,
    `Parecer da Engenharia de Pré-Vendas:`,
    `${solicitacao?.observacoes || 'Dimensionamento validado e precificado pela Engenharia de Pré-Vendas.'}`
  ].join('\n');

  // Para o Comercial, itens nunca devem conter dados de custos ou margens (restrito ao Pré-Vendas)
  const commercialItems = formattedItems.map((it) => ({
    id: it.id,
    descricao: it.descricao,
    categoria: it.categoria,
    quantidade: it.quantidade,
    precoSugerido: it.precoSugerido,
    precoVenda: it.precoSugerido,
    subtotalVenda: it.subtotalVenda
  }));

  if (!activity) {
    const newTitle = `Orçamento Precificado: ${solicitacao?.numero || 'ORC-2026-0088'} - ${solicitacao?.titulo || 'Pré-Vendas'}`;
    const flowData = {
      sourceArea: 'PRE_VENDAS',
      targetArea: 'COMERCIAL',
      createdFrom: 'DEVOLUCAO_PRE_VENDAS',
      createdByName: 'Engenharia de Pré-Vendas',
      returnedFromPreSales: true,
      activityStage: PROPOSAL_SENT_STAGE,
      preSalesStatus: status,
      preSalesRequestId: solicitacao?.id,
      preSalesNumber: solicitacao?.numero,
      numeroOrcamento: solicitacao?.numero,
      valorTotal,
      valorSugerido: valorTotal,
      valorMensal,
      valorSetup,
      items: commercialItems,
      observacoesTecnicas: solicitacao?.observacoes || '',
      preSalesReturnedAt: new Date().toISOString()
    };

    return tx.activity.create({
      data: {
        title: newTitle,
        subject: newTitle,
        type: 'TASK',
        status: 'COMPLETED',
        completedAt: new Date(),
        priority: solicitacao?.prioridade === 'URGENT' ? 'URGENT' : 'HIGH',
        dueDate: new Date(),
        tenantCompanyId: tenantCompanyId || null,
        companyId: solicitacao?.leadId || null,
        opportunityId: solicitacao?.opportunityId || null,
        assignedToId: solicitacao?.solicitanteId || null,
        description: buildDescriptionWithFlow(humanReadablePricing, flowData)
      },
      select: { id: true }
    });
  }

  const parsed = parseFlowFromDescription(activity.description);
  const returnTargetArea = parsed.flow?.sourceArea && parsed.flow.sourceArea !== 'PRE_VENDAS'
    ? parsed.flow.sourceArea
    : 'COMERCIAL';

  const updatedFlow = {
    ...parsed.flow,
    originalSourceArea: returnTargetArea,
    sourceArea: 'PRE_VENDAS',
    targetArea: returnTargetArea,
    returnedFromPreSales: true,
    activityStage: PROPOSAL_SENT_STAGE,
    preSalesStatus: status,
    preSalesRequestId: solicitacao.id,
    preSalesNumber: solicitacao.numero,
    numeroOrcamento: solicitacao.numero,
    valorTotal,
    valorSugerido: valorTotal,
    valorMensal,
    valorSetup,
    items: commercialItems,
    observacoesTecnicas: solicitacao?.observacoes || '',
    preSalesReturnedAt: new Date().toISOString()
  };
  delete updatedFlow.margemMedia;

  // Sanitiza qualquer histórico anterior que pudesse ter vazado custos para o comercial
  const sanitizedCleanDescription = (parsed.cleanDescription || '')
    .replace(/\s*-\s*Custo(?: Unit)?: R\$ [0-9.,]+ \| Margem: [0-9.,]+%/g, '')
    .replace(/Margem de Contribuição Média: [0-9.,]+%?\n?/gi, '')
    .replace(/Margem Média de Lucro: [0-9.,]+%?\n?/gi, '')
    .trim();

  const finalDescription = `${humanReadablePricing}\n\n${sanitizedCleanDescription ? `--- Histórico Anterior ---\n${sanitizedCleanDescription}` : ''}`;

  return tx.activity.update({
    where: { id: activity.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      description: buildDescriptionWithFlow(finalDescription, updatedFlow)
    },
    select: { id: true }
  });
};

// GET /api/pre-vendas - Listar todas as solicitações de precificação
router.get('/', async (req, res) => {
  try {
    const { status, prioridade, page = 1, limit = 10, search } = req.query;
    
    let where = {};
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (prioridade) {
      where.prioridade = prioridade;
    }
    
    if (search) {
      where.OR = [
        { titulo: { contains: search, mode: 'insensitive' } },
        { numero: { contains: search, mode: 'insensitive' } },
        { descricao: { contains: search, mode: 'insensitive' } }
      ];
    }

    where = scopePreSalesWhere(req, where);

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [solicitacoes, total] = await Promise.all([
      prisma.preSalesRequest.findMany({
        where,
        include: {
          solicitante: {
            select: { id: true, name: true, email: true }
          },
          lead: {
            select: { id: true, name: true }
          },
          opportunity: {
            select: { id: true, title: true }
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, price: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.preSalesRequest.count({ where })
    ]);

    res.json({
      success: true,
      solicitacoes,
      total,
      data: solicitacoes,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Erro ao buscar solicitações:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET /api/pre-vendas/stats - Estatísticas do dashboard
router.get('/stats', async (req, res) => {
  try {
    const scoped = (where = {}) => scopePreSalesWhere(req, where);
    const [
      novas,
      emPrecificacao,
      aguardandoAprovacao,
      enviadas,
      aprovadas,
      reprovadas,
      finalizadas,
      totalMes,
      valorTotalMes
    ] = await Promise.all([
      prisma.preSalesRequest.count({ where: scoped({ status: 'NOVA' }) }),
      prisma.preSalesRequest.count({ where: scoped({ status: 'EM_PRECIFICACAO' }) }),
      prisma.preSalesRequest.count({ where: scoped({ status: 'AGUARDANDO_APROVACAO' }) }),
      prisma.preSalesRequest.count({ where: scoped({ status: 'ENVIADA' }) }),
      prisma.preSalesRequest.count({ where: scoped({ status: 'APROVADO' }) }),
      prisma.preSalesRequest.count({ where: scoped({ status: 'REPROVADO' }) }),
      prisma.preSalesRequest.count({ where: scoped({ status: { in: ['FINALIZADA', 'APROVADO'] } }) }),
      prisma.preSalesRequest.count({
        where: scoped({
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        })
      }),
      prisma.preSalesRequest.aggregate({
        where: scoped({
          status: { in: ['FINALIZADA', 'APROVADO'] },
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }),
        _sum: { valorSugerido: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        novas,
        emPrecificacao,
        aguardandoAprovacao,
        enviadas,
        aprovadas,
        reprovadas,
        finalizadas,
        totalMes,
        valorTotalMes: valorTotalMes._sum.valorSugerido || 0
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET /api/pre-vendas/by-number/:number - Buscar orçamento/cotação pelo número
router.get('/by-number/:number', async (req, res) => {
  try {
    const normalizedNumber = String(req.params.number || '').trim().toUpperCase();
    if (!normalizedNumber) {
      return res.status(400).json({
        success: false,
        message: 'Número do orçamento é obrigatório'
      });
    }

    const scopedWhere = scopePreSalesWhere(req, {});
    const directMatch = await prisma.preSalesRequest.findFirst({
      where: scopePreSalesWhere(req, { numero: { equals: normalizedNumber, mode: 'insensitive' } }),
      include: preSalesRequestInclude
    });

    if (directMatch) {
      directMatch.__matchedBudgetNumber = directMatch.numero;
      return res.json({ success: true, data: directMatch });
    }

    const candidates = await prisma.preSalesRequest.findMany({
      where: scopedWhere,
      include: preSalesRequestInclude,
      orderBy: { updatedAt: 'desc' },
      take: 1000
    });

    const matched = candidates.find((solicitacao) => matchesBudgetNumber(solicitacao, normalizedNumber));
    if (!matched) {
      return res.status(404).json({
        success: false,
        message: 'Orçamento não encontrado'
      });
    }

    matched.__matchedBudgetNumber = normalizedNumber;
    return res.json({ success: true, data: matched });
  } catch (error) {
    console.error('Erro ao buscar orçamento por número:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// GET /api/pre-vendas/:id - Buscar solicitação por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const solicitacao = await prisma.preSalesRequest.findUnique({
      where: { id },
      include: {
        ...preSalesRequestInclude,
        aprovacoes: {
          include: {
            aprovador: {
              select: { id: true, name: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!solicitacao) {
      return res.status(404).json({
        success: false,
        message: 'Solicitação não encontrada'
      });
    }

    if (!canAccessTenantRequester(req, solicitacao)) {
      return res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
    }

    res.json({
      success: true,
      data: solicitacao
    });
  } catch (error) {
    console.error('Erro ao buscar solicitação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// POST /api/pre-vendas - Criar nova solicitação
router.post('/', async (req, res) => {
  try {
    const {
      numero,
      titulo,
      descricao,
      nomeCliente,
      modalidade,
      prioridade = 'MEDIUM',
      leadId,
      opportunityId,
      tiposPrecificacao,
      regimeTributario,
      items = [],
      calculoDetalhes,
      observacoes
    } = req.body;

    // Validações
    if (!titulo || !descricao) {
      return res.status(400).json({
        success: false,
        message: 'Título e descrição são obrigatórios'
      });
    }

    if (!tiposPrecificacao || tiposPrecificacao.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Pelo menos um tipo de precificação deve ser selecionado'
      });
    }

    const requestedNumber = String(numero || '').trim().toUpperCase();
    let numeroFormatado = /^ORC-\d{4}-\d{4}$/.test(requestedNumber)
      ? requestedNumber
      : await generateBudgetNumber();
    const existingNumber = await prisma.preSalesRequest.findUnique({
      where: { numero: numeroFormatado },
      select: { id: true }
    });
    if (existingNumber) {
      numeroFormatado = await generateBudgetNumber();
    }
    const validLeadId = await resolveExistingCompanyId(leadId, req.user);
    const validOpportunityId = await resolveExistingOpportunityId(opportunityId, req.user);
    const requestItems = sanitizePreSalesItems(items);

    // Criar orçamento
    const solicitacao = await prisma.preSalesRequest.create({
      data: {
        numero: numeroFormatado,
        titulo,
        descricao,
        nomeCliente: nomeCliente || null,
        modalidade: modalidade || null,
        prioridade,
        status: 'NOVA',
        tiposPrecificacao,
        regimeTributario,
        calculoDetalhes: calculoDetalhes && typeof calculoDetalhes === 'object' ? calculoDetalhes : undefined,
        observacoes,
        solicitanteId: req.user.userId, // Usar req.user.userId em vez de req.user.id
        leadId: validLeadId,
        opportunityId: validOpportunityId,
        ...(requestItems.length > 0 ? { items: { create: requestItems } } : {})
      },
      include: {
        items: true
      }
    });

    res.status(201).json({
      success: true,
      message: 'Orçamento criado com sucesso',
      data: solicitacao
    });
  } catch (error) {
    console.error('Erro ao criar solicitação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// PUT /api/pre-vendas/:id - Atualizar solicitação
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      titulo,
      descricao,
      nomeCliente,
      modalidade,
      prioridade,
      status,
      tiposPrecificacao,
      regimeTributario,
      valorSugerido,
      custoTotal,
      margemLucro,
      calculoDetalhes,
      observacoes,
      leadId,
      opportunityId,
      items
    } = req.body;

    const accessCheck = await ensurePreSalesRequestAccess(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({
        success: false,
        message: accessCheck.error
      });
    }
    const solicitacaoExistente = accessCheck.solicitacao;

    // Verificar permissões (apenas o solicitante ou admin pode editar)
    const userCanOperatePreSales = canAccessModule(req.user, 'PRE_SALES');
    if (
      solicitacaoExistente.solicitanteId !== req.user.userId &&
      req.user.role !== 'ADMIN' &&
      !userCanOperatePreSales
    ) {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para editar esta solicitação'
      });
    }

    const shouldReplaceItems = Object.prototype.hasOwnProperty.call(req.body, 'items');
    const requestItems = shouldReplaceItems ? sanitizePreSalesItems(items) : [];
    const validLeadId = Object.prototype.hasOwnProperty.call(req.body, 'leadId')
      ? await resolveExistingCompanyId(leadId, req.user)
      : undefined;
    const validOpportunityId = Object.prototype.hasOwnProperty.call(req.body, 'opportunityId')
      ? await resolveExistingOpportunityId(opportunityId, req.user)
      : undefined;

    // Atualizar solicitação
    const result = await prisma.$transaction(async (tx) => {
      if (shouldReplaceItems) {
        await tx.preSalesItem.deleteMany({ where: { preSalesRequestId: id } });
      }

      const updated = await tx.preSalesRequest.update({
        where: { id },
        data: {
          titulo,
          descricao,
          nomeCliente: nomeCliente === undefined ? undefined : nomeCliente || null,
          modalidade: modalidade === undefined ? undefined : modalidade || null,
          prioridade,
          status,
          tiposPrecificacao,
          regimeTributario,
          leadId: validLeadId,
          opportunityId: validOpportunityId,
          valorSugerido: valorSugerido === '' || valorSugerido === undefined || valorSugerido === null ? undefined : parseFloat(valorSugerido),
          custoTotal: custoTotal === '' || custoTotal === undefined || custoTotal === null ? undefined : parseFloat(custoTotal),
          margemLucro: margemLucro === '' || margemLucro === undefined || margemLucro === null ? undefined : parseFloat(margemLucro),
          calculoDetalhes: calculoDetalhes === undefined ? undefined : calculoDetalhes,
          observacoes,
          dataAprovacao: status === 'APROVADO' ? new Date() : undefined,
          dataRejeicao: status === 'REPROVADO' ? new Date() : undefined,
          aprovadoPorId: status === 'APROVADO' ? req.user.userId : undefined,
          rejeitadoPorId: status === 'REPROVADO' ? req.user.userId : undefined,
          updatedAt: new Date(),
          ...(shouldReplaceItems && requestItems.length > 0 ? { items: { create: requestItems } } : {})
        },
        include: {
          solicitante: {
            select: { id: true, name: true, email: true }
          },
          lead: {
            select: { id: true, name: true }
          },
          opportunity: {
            select: { id: true, title: true }
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, price: true }
              }
            }
          }
        }
      });

      let returnedActivity = null;
      if (['ENVIADA', 'APROVADO', 'FINALIZADA'].includes(String(status || '').toUpperCase())) {
        returnedActivity = await syncPreSalesReturnToCommercial(tx, req, updated, String(status).toUpperCase());
      }

      return { solicitacao: updated, returnedActivity };
    });

    res.json({
      success: true,
      message: 'Solicitação atualizada com sucesso',
      data: result.solicitacao,
      returnedActivityId: result.returnedActivity?.id || null
    });
  } catch (error) {
    console.error('Erro ao atualizar solicitação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// POST /api/pre-vendas/:id/devolver-comercial - Finalizar orçamento e devolver ao Comercial
router.post('/:id/devolver-comercial', async (req, res) => {
  try {
    const { id } = req.params;

    const accessCheck = await ensurePreSalesRequestAccess(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({
        success: false,
        message: accessCheck.error
      });
    }

    const userCanOperatePreSales = canAccessModule(req.user, 'PRE_SALES');
    if (
      accessCheck.solicitacao.solicitanteId !== req.user.userId &&
      req.user.role !== 'ADMIN' &&
      !userCanOperatePreSales
    ) {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para devolver esta solicitação'
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const solicitacao = await tx.preSalesRequest.update({
        where: { id },
        data: {
          status: 'ENVIADA',
          updatedAt: new Date()
        },
        include: preSalesRequestInclude
      });
      const returnedActivity = await syncPreSalesReturnToCommercial(tx, req, solicitacao, 'ENVIADA');
      return { solicitacao, returnedActivity };
    });

    res.json({
      success: true,
      message: result.returnedActivity
        ? 'Orçamento devolvido ao Comercial com sucesso'
        : 'Orçamento marcado como enviado; atividade original não encontrada',
      data: result.solicitacao,
      returnedActivityId: result.returnedActivity?.id || null
    });
  } catch (error) {
    console.error('Erro ao devolver orçamento ao Comercial:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// POST /api/pre-vendas/:id/calcular - Calcular precificação
router.post('/:id/calcular', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      custoUnitario,
      quantidade = 1,
      frete = 0,
      outrasDesp = 0,
      margemDesejada = 30,
      regimeTributario = 'LUCRO_PRESUMIDO'
    } = req.body;

    if (!custoUnitario || custoUnitario <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Custo unitário é obrigatório e deve ser maior que zero'
      });
    }

    const accessCheck = await ensurePreSalesRequestAccess(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({
        success: false,
        message: accessCheck.error
      });
    }

    const custo = parseFloat(custoUnitario);
    const qtd = parseInt(quantidade);
    const freteTotal = parseFloat(frete);
    const despesas = parseFloat(outrasDesp);
    const margem = parseFloat(margemDesejada);

    const custoTotal = (custo * qtd) + freteTotal + despesas;
    
    // Cálculo de impostos baseado no regime tributário
    let aliquotaImpostos = 0;
    
    switch (regimeTributario) {
      case 'LUCRO_PRESUMIDO':
        aliquotaImpostos = 0.1133; // ~11.33%
        break;
      case 'LUCRO_REAL':
        aliquotaImpostos = 0.15; // ~15%
        break;
      case 'SIMPLES_NACIONAL':
        aliquotaImpostos = 0.08; // ~8%
        break;
      default:
        aliquotaImpostos = 0.1133;
    }

    const impostos = custoTotal * aliquotaImpostos;
    const precoVenda = custoTotal / (1 - (margem / 100) - aliquotaImpostos);
    const lucroLiquido = precoVenda - custoTotal - impostos;
    const margemReal = (lucroLiquido / precoVenda) * 100;
    const markup = ((precoVenda / custoTotal) * 100) - 100;

    const resultado = {
      custoTotal,
      impostos,
      precoVenda,
      lucroLiquido,
      margemReal,
      markup,
      composicao: {
        custo: (custoTotal / precoVenda) * 100,
        impostos: (impostos / precoVenda) * 100,
        lucro: margemReal
      },
      detalhes: {
        custoUnitario: custo,
        quantidade: qtd,
        frete: freteTotal,
        outrasDesp: despesas,
        margemDesejada: margem,
        regimeTributario,
        aliquotaImpostos: aliquotaImpostos * 100
      }
    };

    // Atualizar a solicitação com os valores calculados
    await prisma.preSalesRequest.update({
      where: { id },
      data: {
        valorSugerido: precoVenda,
        custoTotal: custoTotal,
        margemLucro: margemReal,
        status: 'EM_PRECIFICACAO',
        calculoDetalhes: resultado
      }
    });

    res.json({
      success: true,
      message: 'Precificação calculada com sucesso',
      data: resultado
    });
  } catch (error) {
    console.error('Erro ao calcular precificação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// POST /api/pre-vendas/:id/aprovar - Aprovar solicitação
router.post('/:id/aprovar', async (req, res) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;

    // Verificar se o usuário tem permissão para aprovar
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para aprovar solicitações'
      });
    }

    const accessCheck = await ensurePreSalesRequestAccess(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({
        success: false,
        message: accessCheck.error
      });
    }

    // Atualizar status e criar registro de aprovação
    const [solicitacaoAtualizada] = await Promise.all([
      prisma.preSalesRequest.update({
        where: { id },
        data: {
          status: 'APROVADO',
          dataAprovacao: new Date(),
          aprovadoPorId: req.user.userId
        },
        include: {
          solicitante: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.preSalesApproval.create({
        data: {
          preSalesRequestId: id,
          aprovadorId: req.user.userId,
          status: 'APROVADA',
          observacoes
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Solicitação aprovada com sucesso',
      data: solicitacaoAtualizada
    });
  } catch (error) {
    console.error('Erro ao aprovar solicitação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// POST /api/pre-vendas/:id/rejeitar - Rejeitar solicitação
router.post('/:id/rejeitar', async (req, res) => {
  try {
    const { id } = req.params;
    const { observacoes } = req.body;

    // Verificar se o usuário tem permissão para rejeitar
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para rejeitar solicitações'
      });
    }

    const accessCheck = await ensurePreSalesRequestAccess(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({
        success: false,
        message: accessCheck.error
      });
    }

    // Atualizar status e criar registro de rejeição
    const [solicitacaoAtualizada] = await Promise.all([
      prisma.preSalesRequest.update({
        where: { id },
        data: {
          status: 'REPROVADO',
          dataRejeicao: new Date(),
          rejeitadoPorId: req.user.userId
        },
        include: {
          solicitante: {
            select: { id: true, name: true, email: true }
          }
        }
      }),
      prisma.preSalesApproval.create({
        data: {
          preSalesRequestId: id,
          aprovadorId: req.user.userId,
          status: 'REJEITADA',
          observacoes
        }
      })
    ]);

    res.json({
      success: true,
      message: 'Solicitação rejeitada',
      data: solicitacaoAtualizada
    });
  } catch (error) {
    console.error('Erro ao rejeitar solicitação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

// DELETE /api/pre-vendas/:id - Excluir solicitação
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const accessCheck = await ensurePreSalesRequestAccess(req, id);
    if (accessCheck.error) {
      return res.status(accessCheck.status).json({
        success: false,
        message: accessCheck.error
      });
    }
    const solicitacao = accessCheck.solicitacao;

    // Verificar permissões - apenas ADMIN ou o próprio solicitante
    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = solicitacao.solicitanteId === req.user.userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para excluir esta solicitação'
      });
    }

    // ADMIN pode excluir qualquer orçamento, independente do status
    // Usuário comum só pode excluir se não estiver finalizada
    if (!isAdmin && solicitacao.status === 'FINALIZADA') {
      return res.status(400).json({
        success: false,
        message: 'Não é possível excluir solicitações finalizadas. Contate um administrador.'
      });
    }

    await prisma.preSalesRequest.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Solicitação excluída com sucesso'
    });
  } catch (error) {
    console.error('Erro ao excluir solicitação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

module.exports = router;
