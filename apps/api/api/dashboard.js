import activityMarket from '../lib/activityMarket.cjs';
const { resolveActivityMarket } = activityMarket;
import { buildMarketDashboardOverview } from '../lib/marketDashboardOverview.mjs';
import { prisma } from '../lib/prisma.js';
import { buildB2BDashboardAnalytics } from '../lib/b2bDashboardAnalytics.js';
import { getTenantCompanyId } from '../lib/tenantScope.js';

// Roles que podem ver dados de toda a equipe no dashboard B2B
const canSeeAllOpportunitiesDash = (user = {}) =>
  ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(
    String(user?.actualRole || user?.role || '').trim().toUpperCase()
  );

const GENERAL_DASHBOARD_DAYS = 180;

const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const countRows = (count) => Array.from({ length: Math.max(0, toNumber(count)) }, () => ({}));

const rangeStartDate = (days = GENERAL_DASHBOARD_DAYS) =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const touchedSinceWhere = (since) => ({
  OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }]
});

const safeQuery = async (operation, fallback) => {
  try {
    return await operation();
  } catch (error) {
    console.warn('Dashboard geral: modulo ignorado por erro na consulta:', error?.message || error);
    return fallback;
  }
};

const leadStatsWhere = (clientType, tenantCompanyId = null, ownerId = null) => ({
  clientType,
  ...(ownerId ? {opportunities:{some:{ownerId}}} : {}),
  status: { not: 'INACTIVE' },
  ...(tenantCompanyId ? { tenantCompanyId } : {})
});

const buildLeadStats = async (clientType, tenantCompanyId = null, ownerId = null) => {
  const [hotLeads, warmLeads, coldLeads, lowPriority] = await Promise.all([
    prisma.company.count({ where: { ...leadStatsWhere(clientType, tenantCompanyId, ownerId), leadScore: { gte: 80, lte: 100 } } }),
    prisma.company.count({ where: { ...leadStatsWhere(clientType, tenantCompanyId, ownerId), leadScore: { gte: 60, lte: 79 } } }),
    prisma.company.count({ where: { ...leadStatsWhere(clientType, tenantCompanyId, ownerId), leadScore: { gte: 40, lte: 59 } } }),
    prisma.company.count({ where: { ...leadStatsWhere(clientType, tenantCompanyId, ownerId), leadScore: { gte: 0, lte: 39 } } })
  ]);

  return {
    hotLeads,
    warmLeads,
    coldLeads,
    lowPriority,
    total: hotLeads + warmLeads + coldLeads + lowPriority
  };
};

const groupB2BCommercialField = async (where, field, outputKey = field) => {
  const rows = await prisma.opportunity.findMany({
    where,
    select: {
      [field]: true,
      source: true
    }
  });

  const grouped = new Map();
  rows.forEach((row) => {
    const rawValue = field === 'leadSourceDetail'
      ? (row.leadSourceDetail || row.source || 'Não informado')
      : (row[field] || 'Não informado');
    const value = String(rawValue || 'Não informado').trim() || 'Não informado';
    grouped.set(value, (grouped.get(value) || 0) + 1);
  });

  return [...grouped.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({
      [outputKey]: value,
      _count: { [outputKey]: count }
    }));
};

const readPreSalesRegistry = async () => {
  const row = await prisma.systemSetting.findUnique({ where: { key: 'pre_sales_registry_v1' } });
  try {
    const parsed = row?.value ? JSON.parse(row.value) : {};
    return Array.isArray(parsed?.oportunidades) ? parsed.oportunidades : [];
  } catch {
    return [];
  }
};

const buildModuleHealth = (items) =>
  items.map(({ key, label, data, count }) => ({
    key,
    label,
    endpoint: '/api/dashboard?type=general',
    enabled: true,
    status: 'ok',
    count: count ?? (Array.isArray(data) ? data.length : toNumber(data?.total || 0)),
    data,
    error: null
  }));

const mergeRelationWhere = (where = {}, relationName, relationWhere = {}) => ({
  ...where,
  [relationName]: {
    ...(
      where[relationName] && typeof where[relationName] === 'object' && !Array.isArray(where[relationName])
        ? where[relationName]
        : {}
    ),
    ...relationWhere
  }
});

const groupRevenueByMonth = (rows = [], dateField = 'actualCloseDate') => {
  const byMonth = new Map();
  for (const row of rows) {
    const dateValue = row?.[dateField];
    if (!dateValue) continue;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) continue;

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const previous = byMonth.get(key) || { month: new Date(date.getFullYear(), date.getMonth(), 1), revenue: 0, deals: 0 };
    previous.revenue += Number(row.value || 0);
    previous.deals += 1;
    byMonth.set(key, previous);
  }

  return [...byMonth.values()].sort((a, b) => a.month - b.month);
};

const buildGeneralDashboard = async (user = {}) => {
  const since = rangeStartDate(730);
  const allOwners = canSeeAllOpportunitiesDash(user);
  const userId = user.id || user.userId;
  if (!allOwners && !userId) throw Object.assign(new Error('Usuário sem identificação'), { status: 403 });
  const ownerWhere = allOwners ? {} : { ownerId: userId };
  const role = String(user.actualRole || user.role || '').toUpperCase();
  const enabled = { B2B: user.accessB2B !== false && role !== 'USER_B2G', B2G: user.accessB2G !== false && role !== 'USER_B2B' };
  const failures = new Set();
  const skipped = new Set();
  const query = async (key, operation, fallback) => {
    if ((key.endsWith('B2B') && !enabled.B2B) || ((key.endsWith('B2G') || key === 'b2g') && !enabled.B2G) || (!allOwners && ['workflows','automationRules','integrations','regions','prevendasOportunidades'].includes(key)) || (!allOwners && user.accessPreSales===false && ['preSales','preSalesPocs'].includes(key))) {skipped.add(key);return fallback;}
    try { return await operation(); } catch { failures.add(key); return fallback; }
  };
  const tenantCompanyId = getTenantCompanyId(user);
  const tenantWhere = tenantCompanyId ? { tenantCompanyId } : {};
  const tenantUsers = tenantCompanyId
    ? await prisma.user.findMany({ where: { tenantCompanyId }, select: { id: true } })
    : [];
  const tenantUserIds = tenantUsers.map((item) => item.id);
  const tenantUserRelationWhere = { ...(tenantCompanyId ? { tenantCompanyId } : {}), ...(!allOwners ? { id: userId } : {}) };
  const companySelect = { id:true,name:true,clientType:true,status:true,state:true,city:true,address:true,leadScore:true,createdAt:true,updatedAt:true };
  const opportunitySelect = {
    id: true,
    title: true,
    ownerId: true,
    companyId: true,
    company: { select: companySelect },
    probability: true,
    expectedCloseDate: true,
    actualCloseDate: true,
    value: true,
    description: true,
    projectType: true,
    projectMonths: true,
    contractMonths: true,
    monthlyValue: true,
    installationFee: true,
    revenueType: true,
    contractPeriodMonths: true,
    monthlyRecurringValue: true,
    totalContractValue: true,
    totalProductsValue: true,
    setupValue: true,
    number: true,
    stage: true,
    b2gStage: true,
    createdAt: true,
    updatedAt: true,
    owner: { select: { id: true, name: true } }
  };

  const [
    opportunitiesB2B,
    opportunitiesB2G,
    companiesB2BRows,
    companiesB2GRows,
    b2gNotices,
    preSalesRows,
    preSalesTotal,
    preSalesPocs,
    activities,
    productsActiveCount,
    sellers,
    proposals,
    contracts,
    commissionsCount,
    salesTargetsCount,
    leadStatsB2B,
    leadStatsB2G,
    workflowsCount,
    automationRulesCount,
    automationNotificationsCount,
    integrationsCount,
    regionsCount,
    prevendasOportunidades
  ] = await Promise.all([
    query('opportunitiesB2B',() => prisma.opportunity.findMany({
      where: {
        ...tenantWhere,
        ...ownerWhere,
        company: { clientType: 'B2B' },
        b2gStage: null,
        OR: [{ number: null }, { NOT: { number: { startsWith: 'B2G-' } } }]
      },
      select: opportunitySelect,
      orderBy: { updatedAt: 'desc' }
    }), []),
    query('opportunitiesB2G',() => prisma.opportunity.findMany({
      where: {
        ...tenantWhere,
        ...ownerWhere,
        AND: [
          {
            OR: [
              { b2gStage: { not: null } },
              { number: { startsWith: 'B2G-' } },
              { company: { clientType: 'B2G' } }
            ]
          }
        ]
      },
      select: opportunitySelect,
      orderBy: { updatedAt: 'desc' }
    }), []),
    query('companiesB2B',() => prisma.company.findMany({ where: { ...tenantWhere, clientType: 'B2B', ...(!allOwners ? {opportunities:{some:ownerWhere}} : {}) }, select: companySelect }), []),
    query('companiesB2G',() => prisma.company.findMany({ where: { ...tenantWhere, clientType: 'B2G', ...(!allOwners ? {opportunities:{some:ownerWhere}} : {}) }, select: companySelect }), []),
    tenantCompanyId || !allOwners ? [] : query('b2g',() => prisma.bidNotice.findMany({
      where: { OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }] },
      select: { id: true, title: true, status: true, estimatedValue: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    }), []),
    query('preSales',() => prisma.preSalesRequest.findMany({
      where: { ...touchedSinceWhere(since), ...((tenantCompanyId || !allOwners) ? { solicitante: tenantUserRelationWhere } : {}) },
      select: { id: true, titulo: true, numero: true, status: true, createdAt: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' }
    }), []),
    query('preSales',() => prisma.preSalesRequest.count({ where: (tenantCompanyId || !allOwners) ? { solicitante: tenantUserRelationWhere } : {} }), 0),
    query('preSalesPocs',() => prisma.preSalesPoc.findMany({
      where: {
        OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }, { dueDate: { gte: since } }],
        ...(!allOwners ? { createdById: userId } : tenantCompanyId ? { createdById: { in: tenantUserIds } } : {})
      },
      select: {id:true,title:true,status:true,dueDate:true,createdAt:true,updatedAt:true},
      orderBy: { updatedAt: 'desc' }
    }), []),
    query('activities',() => prisma.activity.findMany({
      where: { ...tenantWhere, ...(!allOwners ? {assignedToId:userId} : {}) },
      select: { id:true,subject:true,description:true,status:true,type:true,dueDate:true,createdAt:true,updatedAt:true,company:{select:{id:true,name:true,clientType:true}},opportunity:{select:{id:true,value:true,b2gStage:true,number:true,company:{select:{clientType:true}}}} },
      orderBy: { updatedAt: 'desc' }
    }), []),
    query('products',() => prisma.product.count({ where: { ...tenantWhere, active: true } }), 0),
    query('sellers',() => prisma.user.findMany({
      where: { role: {in:['SELLER','USER']}, ...tenantUserRelationWhere },
      select: { id: true, name: true, _count: { select: { opportunities: true } } },
      orderBy: { name: 'asc' }
    }), []),
    query('proposals',() => prisma.proposal.findMany({
      where: {
        OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }],
        ...((tenantCompanyId || !allOwners) ? { opportunity: { ...tenantWhere, ...ownerWhere } } : {})
      },
      select: { id:true,title:true,totalValue:true,status:true,createdAt:true,updatedAt:true }
    }), []),
    query('contracts',() => prisma.contract.findMany({
      where: {
        ...(tenantCompanyId ? { company: { tenantCompanyId } } : {}), ...(!allOwners ? {opportunity:ownerWhere} : {})
      },
      select: { id:true,title:true,value:true,status:true,companyId:true,startDate:true,endDate:true,createdAt:true,updatedAt:true }
    }), []),
    query('commissions',() => prisma.commission.count({ where: (tenantCompanyId || !allOwners) ? { opportunity: {...tenantWhere,...ownerWhere} } : {} }), 0),
    query('salesTargets',() => prisma.salesTarget.count({ where: (tenantCompanyId || !allOwners) ? { seller: tenantUserRelationWhere } : {} }), 0),
    query('leadStatsB2B',() => buildLeadStats('B2B', tenantCompanyId, allOwners ? null : userId), { hotLeads: 0, warmLeads: 0, coldLeads: 0, lowPriority: 0, total: 0 }),
    query('leadStatsB2G',() => buildLeadStats('B2G', tenantCompanyId, allOwners ? null : userId), { hotLeads: 0, warmLeads: 0, coldLeads: 0, lowPriority: 0, total: 0 }),
    tenantCompanyId ? 0 : query('workflows',() => (prisma.workflow || prisma.advancedWorkflow).count(), 0),
    tenantCompanyId ? 0 : query('automationRules',() => prisma.automationRule.count(), 0),
    query('automationNotifications',() => prisma.notification.count({ where: (tenantCompanyId || !allOwners) ? { recipient: tenantUserRelationWhere } : {} }), 0),
    tenantCompanyId ? 0 : query('integrations',() => prisma.integration.count(), 0),
    tenantCompanyId ? 0 : query('regions',() => prisma.region.count(), 0),
    tenantCompanyId ? [] : query('prevendasOportunidades',readPreSalesRegistry, [])
  ]);

  const data = {
    opportunitiesB2B,
    opportunitiesB2G,
    companiesB2B: companiesB2BRows,
    companiesB2G: companiesB2GRows,
    b2g: b2gNotices,
    prevendasOportunidades,
    preSales: { rows: preSalesRows, total: preSalesTotal },
    preSalesPocs,
    activities: activities.map(item=>({...item,clientType:resolveActivityMarket(item)})),
    products: countRows(productsActiveCount).map(() => ({ active: true })),
    sellers,
    proposals,
    contracts,
    commissions: countRows(commissionsCount),
    salesTargets: countRows(salesTargetsCount),
    leadStatsB2B,
    leadStatsB2G,
    workflows: countRows(workflowsCount),
    automationRules: countRows(automationRulesCount),
    automationNotifications: countRows(automationNotificationsCount),
    integrations: countRows(integrationsCount),
    regions: countRows(regionsCount)
  };

  return {
    data,
    moduleHealth: buildModuleHealth([
      { key: 'opportunitiesB2B', label: 'Oportunidades B2B', data: opportunitiesB2B },
      { key: 'opportunitiesB2G', label: 'Oportunidades B2G', data: opportunitiesB2G },
      { key: 'companiesB2B', label: 'Empresas B2B', data: data.companiesB2B, count: companiesB2BRows.length },
      { key: 'companiesB2G', label: 'Empresas B2G', data: data.companiesB2G, count: companiesB2GRows.length },
      { key: 'b2g', label: 'Editais B2G', data: b2gNotices },
      { key: 'prevendasOportunidades', label: 'Registro Pré-Vendas', data: prevendasOportunidades },
      { key: 'preSales', label: 'Pré-vendas', data: data.preSales, count: preSalesTotal },
      { key: 'preSalesPocs', label: 'POCs Pré-Vendas', data: preSalesPocs },
      { key: 'activities', label: 'Atividades', data: activities },
      { key: 'products', label: 'Produtos', data: data.products, count: productsActiveCount },
      { key: 'sellers', label: 'Equipe comercial', data: sellers },
      { key: 'proposals', label: 'Propostas', data: proposals },
      { key: 'contracts', label: 'Contratos', data: contracts },
      { key: 'commissions', label: 'Comissões', data: data.commissions, count: commissionsCount },
      { key: 'salesTargets', label: 'Metas comerciais', data: data.salesTargets, count: salesTargetsCount },
      { key: 'leadStatsB2B', label: 'Lead scoring B2B', data: leadStatsB2B, count: leadStatsB2B.total },
      { key: 'leadStatsB2G', label: 'Lead scoring B2G', data: leadStatsB2G, count: leadStatsB2G.total },
      { key: 'workflows', label: 'Workflows', data: data.workflows, count: workflowsCount },
      { key: 'automationRules', label: 'Regras de automação', data: data.automationRules, count: automationRulesCount },
      { key: 'automationNotifications', label: 'Notificações automação', data: data.automationNotifications, count: automationNotificationsCount },
      { key: 'integrations', label: 'Integrações', data: data.integrations, count: integrationsCount },
      { key: 'regions', label: 'Regiões', data: data.regions, count: regionsCount }
    ]).map(item => ({...item, enabled: !skipped.has(item.key), status: failures.has(item.key) ? 'error' : skipped.has(item.key) ? 'skipped' : item.status, error: failures.has(item.key) ? 'Não foi possível consultar este módulo' : null}))
  };
};

export default async function handler(req) {
  if (req.method === 'GET') {
    const { type = 'executive', userId, period = '6', ownerId, temperature: tempFilter } = req.query || {};
    const tenantCompanyId = getTenantCompanyId(req.user);
    const withOpportunityTenant = (where = {}) => tenantCompanyId ? { ...where, tenantCompanyId } : where;
    const withCompanyTenant = (where = {}) => tenantCompanyId ? { ...where, tenantCompanyId } : where;
    const withActivityTenant = (where = {}) => tenantCompanyId ? { ...where, tenantCompanyId } : where;
    const withUserTenant = (where = {}) => tenantCompanyId ? { ...where, tenantCompanyId } : where;
    const withOpportunityRelationTenant = (where = {}) =>
      tenantCompanyId ? mergeRelationWhere(where, 'opportunity', { tenantCompanyId }) : where;

    try {
      if (type === 'module-overview') {
        const market=String(req.query?.market || '').toUpperCase();
        try {
          return Response.json(await buildMarketDashboardOverview({prisma,user:req.user,market,tenantCompanyId}));
        } catch(error) {
          return Response.json({error:error.message},{status:error.status || 500});
        }
      }
      if (type === 'general') {
        return Response.json(await buildGeneralDashboard(req.user));
      }

      if (type === 'executive') {
        // Dashboard Executivo
        const monthsBack = parseInt(period);
        const revenueStartDate = new Date(Date.now() - (Number.isFinite(monthsBack) ? monthsBack : 6) * 30 * 24 * 60 * 60 * 1000);
        const [
          totalCompanies,
          totalOpportunities,
          wonOpportunities,
          lostOpportunities,
          pipelineValue,
          wonValue,
          avgTicket,
          totalActivities,
          overdueActivities,
          totalProposals,
          totalCommissions
        ] = await Promise.all([
          prisma.company.count({ where: withCompanyTenant() }),
          prisma.opportunity.count({ where: withOpportunityTenant({ stage: { notIn: ['WON', 'LOST'] } }) }),
          prisma.opportunity.count({ where: withOpportunityTenant({ stage: 'WON' }) }),
          prisma.opportunity.count({ where: withOpportunityTenant({ stage: 'LOST' }) }),
          prisma.opportunity.aggregate({
            where: withOpportunityTenant({ stage: { notIn: ['WON', 'LOST'] } }),
            _sum: { value: true }
          }),
          prisma.opportunity.aggregate({
            where: withOpportunityTenant({ stage: 'WON' }),
            _sum: { value: true }
          }),
          prisma.opportunity.aggregate({
            where: withOpportunityTenant({ stage: 'WON' }),
            _avg: { value: true }
          }),
          prisma.activity.count({ where: withActivityTenant() }),
          prisma.activity.count({
            where: withActivityTenant({
              dueDate: { lt: new Date() },
              status: { notIn: ['COMPLETED', 'CANCELLED'] }
            })
          }),
          prisma.proposal.count({ where: withOpportunityRelationTenant() }),
          prisma.commission.aggregate({
            where: withOpportunityRelationTenant({ status: 'APPROVED' }),
            _sum: { amount: true }
          })
        ]);

        const conversion = (wonOpportunities + lostOpportunities) > 0 
          ? (wonOpportunities / (wonOpportunities + lostOpportunities)) * 100 
          : 0;

        // Funil por etapa
        const funnelData = await prisma.opportunity.groupBy({
          by: ['stage'],
          where: withOpportunityTenant(),
          _count: { stage: true },
          _sum: { value: true },
          orderBy: {
            stage: 'asc'
          }
        });

        const monthlyRevenueRows = await prisma.opportunity.findMany({
          where: withOpportunityTenant({
            stage: 'WON',
            actualCloseDate: {
              gte: revenueStartDate,
              not: null
            }
          }),
          select: {
            actualCloseDate: true,
            value: true
          }
        });

        // Performance por vendedor
        const sellerPerformance = await prisma.opportunity.groupBy({
          by: ['ownerId'],
          where: withOpportunityTenant({ stage: 'WON' }),
          _count: { ownerId: true },
          _sum: { value: true }
        });

        // Buscar nomes dos vendedores
        const sellerIds = sellerPerformance.map(s => s.ownerId);
        const sellers = await prisma.user.findMany({
          where: withUserTenant({ id: { in: sellerIds } }),
          select: { id: true, name: true }
        });

        const sellerData = sellerPerformance.map(perf => {
          const seller = sellers.find(s => s.id === perf.ownerId);
          return {
            sellerId: perf.ownerId,
            sellerName: seller?.name || 'Desconhecido',
            deals: perf._count.ownerId,
            revenue: perf._sum.value || 0
          };
        });

        // Origem de leads
        const leadSources = await prisma.opportunity.groupBy({
          by: ['source'],
          _count: { source: true },
          where: withOpportunityTenant({ source: { not: null } })
        });

        // Motivos de perda
        const lossReasons = await prisma.opportunity.groupBy({
          by: ['lossReason'],
          _count: { lossReason: true },
          where: withOpportunityTenant({
            stage: 'LOST',
            lossReason: { not: null }
          })
        });

        return Response.json({
          kpis: {
            totalCompanies,
            totalOpportunities,
            wonOpportunities,
            lostOpportunities,
            pipelineValue: pipelineValue._sum.value || 0,
            wonValue: wonValue._sum.value || 0,
            avgTicket: avgTicket._avg.value || 0,
            conversionRate: Math.round(conversion * 100) / 100,
            totalActivities,
            overdueActivities,
            totalProposals,
            totalCommissions: totalCommissions._sum.amount || 0
          },
          charts: {
            funnel: funnelData,
            monthlyRevenue: groupRevenueByMonth(monthlyRevenueRows).map(m => ({
              month: m.month,
              revenue: m.revenue,
              deals: m.deals
            })),
            sellerPerformance: sellerData,
            leadSources,
            lossReasons
          }
        });
      }

      // ----------------------------------------------------
// B2G – Editais (com filtro de datas avançado)
// ----------------------------------------------------
if (type === 'b2g') {
  // Parâmetros esperados na querystring: startDate, endDate (formato YYYY-MM-DD)
  const rawStart = req.query.startDate;
  const rawEnd   = req.query.endDate;

  const parse = (s) => s ? new Date(s) : undefined;
  let start = parse(rawStart);
  let end   = parse(rawEnd);

  // Garante start <= end
  if (start && end && start > end) { const tmp = start; start = end; end = tmp; }

  const dateWhere = (start && end)
    ? { createdAt: { gte: start, lte: end } }
    : start ? { createdAt: { gte: start } }
    : end   ? { createdAt: { lte: end } }
    : {};

  const tenantWhere = getTenantCompanyId(req.user)
    ? { tenantCompanyId: getTenantCompanyId(req.user) }
    : {};

  const b2gNotices = await prisma.bidNotice.findMany({
    where: {
      ...tenantWhere,
      ...dateWhere,
    },
    select: {
      id: true,
      status: true,
      estimatedValue: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return Response.json({ b2gNotices });
}
// ----------------------------------------------------
if (type === 'b2b') {
        const b2bOpportunityFilter = { b2gStage: null, OR: [{ number: null }, { NOT: { number: { startsWith: 'B2G-' } } }] };
        const baseWhere = withOpportunityTenant({ ...b2bOpportunityFilter, company: { clientType: 'B2B' } });
        const effectiveOwnerId = canSeeAllOpportunitiesDash(req.user)
          ? (ownerId || null)
          : (req.user?.userId || req.user?.id);
        if (!canSeeAllOpportunitiesDash(req.user) && !effectiveOwnerId) {
          return Response.json({ error: 'Usuário não identificado' }, { status: 403 });
        }
        if (effectiveOwnerId) baseWhere.ownerId = effectiveOwnerId;
        const temperatureRange = {
          '0': { gte: 0, lte: 0 }, '25': { gte: 1, lte: 25 },
          '50': { gte: 26, lte: 50 }, '75': { gte: 51, lte: 75 }, '100': { gte: 76, lte: 100 }
        };
        const whereClause = { ...baseWhere };
        if (temperatureRange[tempFilter]) whereClause.probability = temperatureRange[tempFilter];

        // Read the complete, scoped portfolio; every chart uses this same set.
        // Period filters affect entry/closure history, never the current portfolio.
        const [totalCompanies, totalOpportunities, opportunities, probabilities] = await Promise.all([
          prisma.company.count({ where: withCompanyTenant({ clientType: 'B2B' }) }),
          prisma.opportunity.count({ where: { ...whereClause } }),
          prisma.opportunity.findMany({
            where: whereClause,
            select: {
              id: true, title: true, number: true, stage: true, value: true, probability: true,
              ownerId: true, leadEntryDate: true, expectedCloseDate: true, actualCloseDate: true,
              exitDate: true, createdAt: true, updatedAt: true, leadSourceDetail: true, source: true,
              projectTower: true, projectClientType: true,
              projectType: true, projectMonths: true, contractMonths: true, monthlyValue: true, installationFee: true,
              revenueType: true, contractPeriodMonths: true, monthlyRecurringValue: true,
              totalContractValue: true, totalProductsValue: true, setupValue: true,
              company: { select: { id: true, name: true } },
              owner: { select: { id: true, name: true } }
            },
            orderBy: { updatedAt: 'desc' }
          }),
          prisma.opportunity.groupBy({ by: ['probability'], where: baseWhere, _count: { probability: true } })
        ]);
        const analytics = buildB2BDashboardAnalytics(opportunities, { period });
        const temperatureCounts = Object.fromEntries(Object.entries(temperatureRange).map(([level, band]) => [
          level, probabilities.filter(row => row.probability >= band.gte && row.probability <= band.lte)
            .reduce((total, row) => total + row._count.probability, 0)
        ]));
        return Response.json({
          ...analytics,
          kpis: { ...analytics.kpis, totalCompanies, totalOpportunities },
          temperatureCounts,
          opportunities
        });
      }

      if (type === 'seller' && userId) {
        const selectedSeller = await prisma.user.findFirst({
          where: withUserTenant({ id: userId }),
          select: { id: true }
        });

        if (!selectedSeller) {
          return Response.json({ error: 'Vendedor não encontrado ou fora da empresa atual' }, { status: 403 });
        }

        // Dashboard do Vendedor
        const [
          myOpportunities,
          myActivities,
          myCommissions,
          myQuota,
          myProposals
        ] = await Promise.all([
          prisma.opportunity.findMany({
            where: withOpportunityTenant({ ownerId: userId, stage: { not: 'LOST' } }),
            include: { company: true }
          }),
          prisma.activity.findMany({
            where: withActivityTenant({
              assignedToId: userId,
              status: { in: ['PENDING', 'IN_PROGRESS'] }
            }),
            include: { company: true, opportunity: true },
            orderBy: { dueDate: 'asc' },
            take: 10
          }),
          prisma.commission.aggregate({
            where: withOpportunityRelationTenant({ sellerId: userId, status: 'APPROVED' }),
            _sum: { amount: true }
          }),
          prisma.user.findFirst({
            where: withUserTenant({ id: userId }),
            select: { quota: true }
          }),
          prisma.proposal.count({
            where: withOpportunityRelationTenant({
              opportunity: { ownerId: userId }
            })
          })
        ]);

        const pipelineValue = myOpportunities.reduce((sum, opp) => sum + opp.value, 0);
        const wonValue = myOpportunities
          .filter(opp => opp.stage === 'WON')
          .reduce((sum, opp) => sum + opp.value, 0);

        return Response.json({
          kpis: {
            pipelineValue,
            wonValue,
            quota: myQuota?.quota || 0,
            quotaAchievement: myQuota?.quota ? (wonValue / myQuota.quota) * 100 : 0,
            pendingActivities: myActivities.length,
            totalCommissions: myCommissions._sum.amount || 0,
            totalProposals: myProposals
          },
          opportunities: myOpportunities,
          activities: myActivities
        });
      }

      if (type === 'manager') {
        // Dashboard do Gestor
        const [
          teamPerformance,
          pipelineByStage,
          activitiesOverdue,
          conversionBySource
        ] = await Promise.all([
          prisma.opportunity.groupBy({
            by: ['ownerId'],
            _count: { ownerId: true },
            _sum: { value: true },
            where: withOpportunityTenant({ stage: { notIn: ['LOST'] } })
          }),
          prisma.opportunity.groupBy({
            by: ['stage'],
            where: withOpportunityTenant(),
            _count: { stage: true },
            _sum: { value: true }
          }),
          prisma.activity.count({
            where: withActivityTenant({
              dueDate: { lt: new Date() },
              status: { notIn: ['COMPLETED', 'CANCELLED'] }
            })
          }),
          prisma.opportunity.groupBy({
            by: ['source'],
            _count: { source: true },
            where: withOpportunityTenant({
              source: { not: null },
              stage: 'WON'
            })
          })
        ]);

        return Response.json({
          kpis: {
            teamSize: teamPerformance.length,
            activitiesOverdue,
            totalPipeline: pipelineByStage.reduce((sum, stage) => sum + (stage._sum.value || 0), 0)
          },
          charts: {
            teamPerformance,
            pipelineByStage,
            conversionBySource
          }
        });
      }

      return Response.json({ error: 'Invalid dashboard type' }, { status: 400 });

    } catch (error) {
      console.error('Dashboard error:', error);
      return Response.json({ error: error.status===403 ? 'Acesso não autorizado' : 'Internal server error' }, { status: error.status===403 ? 403 : 500 });
    }
  }

  return new Response('Method not allowed', { status: 405 });
}
