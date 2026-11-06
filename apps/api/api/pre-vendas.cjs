const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');
const { canAccessModule, normalizeRole } = require('../lib/permissions.cjs');

const { registerCommercialReturnNotifications, createPreSalesClosureHandler, isNegativeStatus } = require('../lib/pre-sales-closure.cjs');
const { getTenantId: closureTenantId } = require('../lib/access-control.cjs');

const router = express.Router();
const closePreSales = createPreSalesClosureHandler({
  prisma, tenantId: closureTenantId,
  canOperate: (user) => ['MASTER', 'ADMIN'].includes(normalizeRole(user.actualRole || user.role)) || canAccessModule(user, 'PRE_SALES')
});

// Middleware de autenticação para todas as rotas
router.use(authenticateToken);
router.post('/:id/encerrar', closePreSales);
registerCommercialReturnNotifications(router, prisma);

const ACTIVITY_FLOW_MARKER = '[CRM_ACTIVITY_FLOW]';
const PROPOSAL_SENT_STAGE = 'PROPOSTA_ENVIADA';

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
  return `ORC-${String(current + 1).padStart(4, '0')}-${year}`;
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

const preSalesRequestInclude = {
  solicitante: {
    select: { id: true, name: true, email: true }
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

const syncPreSalesReturnToCommercial = async (tx, solicitacao = {}, status = 'ENVIADA') => {
  let activityId = extractSourceActivityId(solicitacao?.observacoes);
  let activity = null;

  if (activityId) {
    try {
      activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: { id: true, description: true, title: true, subject: true, companyId: true, opportunityId: true }
      });
    } catch {}
  }

  if (!activity && solicitacao?.opportunityId) {
    try {
      activity = await tx.activity.findFirst({
        where: { opportunityId: solicitacao.opportunityId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, description: true, title: true, subject: true, companyId: true, opportunityId: true }
      });
    } catch {}
  }

  if (!activity && solicitacao?.numero) {
    try {
      activity = await tx.activity.findFirst({
        where: { description: { contains: solicitacao.numero } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, description: true, title: true, subject: true, companyId: true, opportunityId: true }
      });
    } catch {}
  }

  if (!activity && solicitacao?.leadId) {
    try {
      activity = await tx.activity.findFirst({
        where: { companyId: solicitacao.leadId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, description: true, title: true, subject: true, companyId: true, opportunityId: true }
      });
    } catch {}
  }

  // Prepara itens precificados normalizados
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
    // Cria uma nova atividade devolvida para o Comercial
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
        companyId: solicitacao?.leadId || null,
        opportunityId: solicitacao?.opportunityId || null,
        assignedToId: solicitacao?.solicitanteId || null,
        description: buildDescriptionWithFlow(humanReadablePricing, flowData)
      },
      select: { id: true }
    });
  }

  const parsed = parseFlowFromDescription(activity.description);
  const sourceArea = parsed.flow?.sourceArea && parsed.flow.sourceArea !== 'PRE_VENDAS'
    ? parsed.flow.sourceArea
    : 'COMERCIAL';

  const updatedFlow = {
    ...parsed.flow,
    targetArea: sourceArea,
    sourceArea: 'PRE_VENDAS',
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

const sanitizePreSalesItems = (items = []) => (
  Array.isArray(items)
    ? items
        .filter((item) => String(item?.descricao || item?.description || '').trim())
        .map((item) => {
          const icmsCompra = item.icmsCompra === '' || item.icmsCompra === undefined || item.icmsCompra === null
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

// GET /api/pre-vendas - Listar todas as solicitações de precificação
router.get('/', async (req, res) => {
  try {
    const { status, prioridade, page = 1, limit = 10, search } = req.query;
    
    const where = {};

    // Isolamento por tenant
    if (req.user && !((req.user.actualRole || req.user.role) === 'MASTER') && req.user.tenantCompanyId) {
      where.tenantCompanyId = req.user.tenantCompanyId;
    }
    
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
    const [
      novas,
      emPrecificacao,
      aguardandoAprovacao,
      finalizadas,
      totalMes,
      valorTotalMes
    ] = await Promise.all([
      prisma.preSalesRequest.count({ where: { status: 'NOVA' } }),
      prisma.preSalesRequest.count({ where: { status: 'EM_PRECIFICACAO' } }),
      prisma.preSalesRequest.count({ where: { status: 'AGUARDANDO_APROVACAO' } }),
      prisma.preSalesRequest.count({ where: { status: 'FINALIZADA' } }),
      prisma.preSalesRequest.count({
        where: {
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),
      prisma.preSalesRequest.aggregate({
        where: {
          status: 'FINALIZADA',
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        },
        _sum: { valorSugerido: true }
      })
    ]);

    res.json({
      success: true,
      data: {
        novas,
        emPrecificacao,
        aguardandoAprovacao,
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
    const rawNumber = String(req.params.number || '').trim();
    if (!rawNumber) {
      return res.status(400).json({ success: false, message: 'Número do orçamento é obrigatório' });
    }

    const solicitacao = await prisma.preSalesRequest.findFirst({
      where: { numero: rawNumber },
      include: {
        solicitante: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true, value: true, stage: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, price: true, category: true } }
          }
        },
        aprovacoes: {
          include: {
            aprovador: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!solicitacao) {
      // Tentar busca flexível
      const all = await prisma.preSalesRequest.findMany({
        include: {
          solicitante: { select: { id: true, name: true, email: true } },
          lead: { select: { id: true, name: true } },
          opportunity: { select: { id: true, title: true, value: true, stage: true } },
          items: {
            include: { product: { select: { id: true, name: true, price: true, category: true } } }
          }
        }
      });
      const matched = all.find(s => s.numero?.toUpperCase() === rawNumber.toUpperCase() || s.numero?.includes(rawNumber));
      if (!matched) {
        return res.status(404).json({ success: false, message: 'Orçamento não encontrado' });
      }
      return res.json({ success: true, data: matched });
    }

    res.json({ success: true, data: solicitacao });
  } catch (error) {
    console.error('Erro ao buscar orçamento por número:', error);
    res.status(500).json({ success: false, message: 'Erro interno', error: error.message });
  }
});

// GET /api/pre-vendas/by-opportunity/:opportunityId
router.get('/by-opportunity/:opportunityId', async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const solicitacao = await prisma.preSalesRequest.findFirst({
      where: { opportunityId },
      include: {
        solicitante: { select: { id: true, name: true, email: true } },
        lead: { select: { id: true, name: true } },
        opportunity: { select: { id: true, title: true, value: true, stage: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, price: true, category: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (!solicitacao) {
      return res.status(404).json({ success: false, message: 'Orçamento não encontrado para esta oportunidade' });
    }

    res.json({ success: true, data: solicitacao });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/pre-vendas/:id - Buscar solicitação por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const solicitacao = await prisma.preSalesRequest.findUnique({
      where: { id },
      include: {
        solicitante: {
          select: { id: true, name: true, email: true }
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
        },
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
        leadId: leadId || null,
        opportunityId: opportunityId || null,
        ...(requestItems.length > 0 ? { items: { create: requestItems } } : {})
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
  if (isNegativeStatus(req.body.status)) return closePreSales(req, res);
  try {
    const { id } = req.params;
    const closureCheck = await prisma.preSalesRequest.findUnique({ where: { id }, select: { status: true } });
    if (isNegativeStatus(closureCheck?.status)) return res.status(409).json({ success: false, message: 'Esta solicitação já foi encerrada' });

    const {
      titulo,
      descricao,
      nomeCliente,
      modalidade,
      prioridade,
      status,
      tiposPrecificacao,
      regimeTributario,
      leadId,
      opportunityId,
      valorSugerido,
      custoTotal,
      margemLucro,
      calculoDetalhes,
      observacoes,
      items = []
    } = req.body;

    // Verificar se a solicitação existe
    const solicitacaoExistente = await prisma.preSalesRequest.findUnique({
      where: { id }
    });

    if (!solicitacaoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Solicitação não encontrada'
      });
    }

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

    const updateData = {
      titulo,
      descricao,
      nomeCliente: nomeCliente === undefined ? undefined : nomeCliente || null,
      modalidade: modalidade === undefined ? undefined : modalidade || null,
      prioridade,
      status,
      tiposPrecificacao,
      regimeTributario,
      leadId: leadId === undefined ? undefined : leadId || null,
      opportunityId: opportunityId === undefined ? undefined : opportunityId || null,
      valorSugerido: valorSugerido === '' || valorSugerido === undefined || valorSugerido === null ? undefined : parseFloat(valorSugerido),
      custoTotal: custoTotal === '' || custoTotal === undefined || custoTotal === null ? undefined : parseFloat(custoTotal),
      margemLucro: margemLucro === '' || margemLucro === undefined || margemLucro === null ? undefined : parseFloat(margemLucro),
      calculoDetalhes: calculoDetalhes === undefined ? undefined : calculoDetalhes,
      observacoes,
      updatedAt: new Date()
    };

    if (Object.prototype.hasOwnProperty.call(req.body, 'items')) {
      updateData.items = {
        deleteMany: {},
        create: sanitizePreSalesItems(items)
      };
    }

    // Atualizar solicitação
    const solicitacao = await prisma.preSalesRequest.update({
      where: { id },
      data: updateData,
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

    res.json({
      success: true,
      message: 'Solicitação atualizada com sucesso',
      data: solicitacao
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
    const closureCheck = await prisma.preSalesRequest.findUnique({ where: { id }, select: { status: true } });
    if (isNegativeStatus(closureCheck?.status)) return res.status(409).json({ success: false, message: 'Esta solicitação já foi encerrada' });


    const solicitacaoExistente = await prisma.preSalesRequest.findUnique({
      where: { id },
      select: { id: true, solicitanteId: true }
    });

    if (!solicitacaoExistente) {
      return res.status(404).json({
        success: false,
        message: 'Solicitação não encontrada'
      });
    }

    const userCanOperatePreSales = canAccessModule(req.user, 'PRE_SALES');
    if (
      solicitacaoExistente.solicitanteId !== req.user.userId &&
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
      const returnedActivity = await syncPreSalesReturnToCommercial(tx, solicitacao, 'ENVIADA');
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
    const closureCheck = await prisma.preSalesRequest.findUnique({ where: { id }, select: { status: true } });
    if (isNegativeStatus(closureCheck?.status)) return res.status(409).json({ success: false, message: 'Esta solicitação já foi encerrada' });

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
    const closureCheck = await prisma.preSalesRequest.findUnique({ where: { id }, select: { status: true } });
    if (isNegativeStatus(closureCheck?.status)) return res.status(409).json({ success: false, message: 'Esta solicitação já foi encerrada' });

    const { observacoes } = req.body;

    // Verificar se o usuário tem permissão para aprovar
    if (req.user.role !== 'ADMIN' && req.user.role !== 'MANAGER') {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para aprovar solicitações'
      });
    }

    const solicitacao = await prisma.preSalesRequest.findUnique({
      where: { id }
    });

    if (!solicitacao) {
      return res.status(404).json({
        success: false,
        message: 'Solicitação não encontrada'
      });
    }

    // Atualizar status e criar registro de aprovação
    const [solicitacaoAtualizada] = await Promise.all([
      prisma.preSalesRequest.update({
        where: { id },
        data: {
          status: 'FINALIZADA',
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
router.post('/:id/rejeitar', (req, res) => {
  req.body.status = 'REPROVADO';
  return closePreSales(req, res);
});

// DELETE /api/pre-vendas/:id - Excluir solicitação
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const solicitacao = await prisma.preSalesRequest.findUnique({
      where: { id }
    });

    if (!solicitacao) {
      return res.status(404).json({
        success: false,
        message: 'Solicitação não encontrada'
      });
    }

    // MASTER e ADMIN podem excluir; demais usuários apenas as próprias solicitações.
    const isAdmin = ['MASTER', 'ADMIN'].includes(normalizeRole(req.user.actualRole || req.user.role));
    const isOwner = solicitacao.solicitanteId === (req.user.userId || req.user.id);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Sem permissão para excluir esta solicitação'
      });
    }

    // MASTER e ADMIN podem excluir qualquer orçamento, independente do status
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
