const toArray = (value) => (Array.isArray(value) ? value : []);
const toNumber = (value) => {
  const normalized = typeof value === 'string'
    ? value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.')
    : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const parseUserFromStorage = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (date) => `${monthLabels[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
const OPEN_STAGES = new Set(['LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION']);
const MONTHLY_PROJECT_TYPE = 'MONTHLY';
const B2B_STAGE_SUMMARY = [
  { key: 'LEAD', label: 'Lead', tone: "text-sky-700 dark:text-sky-200", bar: 'bg-sky-400', chartColor: '#38bdf8' },
  { key: 'QUALIFICATION', label: 'Qualificação', tone: "text-blue-700 dark:text-blue-200", bar: 'bg-blue-400', chartColor: '#60a5fa' },
  { key: 'DIAGNOSIS', label: 'Diagnóstico', tone: "text-teal-700 dark:text-teal-200", bar: 'bg-teal-400', chartColor: '#2dd4bf' },
  { key: 'PROPOSAL', label: 'Proposta', tone: "text-amber-700 dark:text-amber-200", bar: 'bg-amber-400', chartColor: '#fbbf24' },
  { key: 'NEGOTIATION', label: 'Negociação', tone: "text-orange-700 dark:text-orange-200", bar: 'bg-orange-400', chartColor: '#fb923c' },
  { key: 'WON', label: 'Ganhas', tone: "text-emerald-700 dark:text-emerald-200", bar: 'bg-emerald-400', chartColor: '#34d399' },
  { key: 'LOST', label: 'Perdidas', tone: "text-[rgb(var(--crm-ink-rgb)_/_1)]", bar: "bg-[rgb(var(--crm-surface-rgb)_/_1)]", chartColor: '#94a3b8' }
];
const B2G_STAGE_SUMMARY = [
  { key: 'ANALISE', label: 'Análise', tone: "text-cyan-700 dark:text-cyan-200", bar: 'bg-cyan-400', chartColor: '#22d3ee' },
  { key: 'PROPOSTA_ENVIADA', label: 'Proposta enviada', tone: "text-amber-700 dark:text-amber-200", bar: 'bg-amber-400', chartColor: '#fbbf24' },
  { key: 'HABILITACAO', label: 'Habilitação', tone: "text-indigo-700 dark:text-indigo-200", bar: 'bg-indigo-400', chartColor: '#818cf8' },
  { key: 'RECURSO', label: 'Recurso', tone: "text-orange-700 dark:text-orange-200", bar: 'bg-orange-400', chartColor: '#fb923c' },
  { key: 'SUSPENSO', label: 'Suspenso', chartColor: '#94a3b8' },
  { key: 'HOMOLOGADO', label: 'Homologado', chartColor: '#60a5fa' },
  { key: 'CONCLUIDO', label: 'Concluído', chartColor: '#c084fc' },
  { key: 'GANHO', label: 'Ganho', tone: "text-emerald-700 dark:text-emerald-200", bar: 'bg-emerald-400', chartColor: '#34d399' }
];

const normalizeB2GStageKey = (value) => {
  const key = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const aliases = {
    LEAD: 'ANALISE',
    QUALIFICATION: 'ANALISE',
    DIAGNOSIS: 'ANALISE',
    ANALISE: 'ANALISE',
    ANALISE_EM_ANDAMENTO: 'ANALISE',
    PROPOSTA: 'PROPOSTA_ENVIADA',
    PROPOSAL: 'PROPOSTA_ENVIADA',
    PROPOSTA_ENVIADA: 'PROPOSTA_ENVIADA',
    HABILITACAO: 'HABILITACAO',
    NEGOTIATION: 'HABILITACAO',
    RECURSO: 'RECURSO',
    GANHO: 'GANHO',
    GANHA: 'GANHO',
    WON: 'GANHO',
    PERDIDO: 'PERDIDO',
    LOST: 'PERDIDO',
    NO_GO: 'NO_GO'
  };

  return aliases[key] || key;
};

const createMonthBuckets = (count = 6) => {
  const now = new Date();
  const buckets = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: monthKey(date), label: monthLabel(date) });
  }
  return buckets;
};

const buildLeadStatsFromCompanies = (companies = []) => {
  const stats = { hotLeads: 0, warmLeads: 0, coldLeads: 0, lowPriority: 0, total: 0 };
  toArray(companies).forEach((company) => {
    const score = toNumber(company?.leadScore);
    if (score >= 80) stats.hotLeads += 1;
    else if (score >= 60) stats.warmLeads += 1;
    else if (score >= 40) stats.coldLeads += 1;
    else stats.lowPriority += 1;
  });
  stats.total = stats.hotLeads + stats.warmLeads + stats.coldLeads + stats.lowPriority;
  return stats;
};

const normalizeProjectType = (value) =>
  String(value || '').trim().toUpperCase() === MONTHLY_PROJECT_TYPE ? MONTHLY_PROJECT_TYPE : 'SINGLE';

const normalizeProjectMonths = (value) => {
  const months = Number(value);
  return Number.isFinite(months) && months > 0 ? months : 12;
};

const pickNumber = (...values) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};

const revenueBreakdownFromOpportunities = (rows = []) =>
  toArray(rows).reduce((acc, item) => {
    const b2g = parseJsonObject(item?.description);
    const hasB2GFinancialShape = Boolean(
      item?.clientType === 'B2G' ||
      item?.b2gStage ||
      b2g.processNumber ||
      b2g.numeroEdital ||
      b2g.modality ||
      b2g.modalidade ||
      b2g.contractTermMonths ||
      b2g.prazoContratual ||
      b2g.estimatedMonthlyValue !== undefined ||
      b2g.valorEstimadoMensal !== undefined ||
      b2g.estimatedOneTimeValue !== undefined ||
      b2g.valorEstimadoPontual !== undefined
    );
    const b2gMonthly = pickNumber(b2g.estimatedMonthlyValue, b2g.valorEstimadoMensal);
    const b2gOneTime = pickNumber(b2g.estimatedOneTimeValue, b2g.valorEstimadoPontual);
    const b2gContractType = String(b2g.contractType || b2g.tipoContrato || '').trim().toUpperCase();
    const b2gMonths = b2gContractType === 'PONTUAL'
      ? 1
      : normalizeProjectMonths(b2g.contractTermMonths || b2g.prazoContratual || item?.projectMonths);
    const b2gTotal = pickNumber(b2g.estimatedValue, b2g.valorEstimadoTotal, item?.value, item?.estimatedValue);

    if (hasB2GFinancialShape && (b2gMonthly > 0 || b2gTotal > 0 || b2gOneTime > 0)) {
      const calculatedTotal = (b2gMonthly * b2gMonths) + b2gOneTime;
      const total = b2gMonthly > 0 ? calculatedTotal : (b2gTotal || b2gOneTime);
      acc.monthly += b2gMonthly;
      acc.contract += b2gMonthly > 0 ? b2gMonthly * b2gMonths : 0;
      acc.single += b2gOneTime || (b2gMonthly > 0 ? 0 : total);
      acc.total += total;
      acc.monthlyCount += b2gMonthly > 0 ? 1 : 0;
      acc.singleCount += b2gMonthly > 0 ? 0 : 1;
      acc.count += 1;
      return acc;
    }

    if (item.revenueType === 'MENSAL') item = { ...item, projectType: 'MONTHLY', projectMonths: item.contractPeriodMonths || item.projectMonths || item.contractMonths, monthlyValue: item.monthlyRecurringValue ?? item.monthlyValue, value: item.totalContractValue ?? item.value };
    if (item.revenueType === 'PONTUAL') item = { ...item, projectType: 'SINGLE', value: item.totalProductsValue ?? item.value, installationFee: item.setupValue ?? item.installationFee };
    const value = Math.max(0, toNumber(item?.value));
    const setup = Math.max(0, toNumber(item?.installationFee));
    const isMonthly = normalizeProjectType(item?.projectType) === MONTHLY_PROJECT_TYPE;
    if (isMonthly) {
      const months = Math.max(1, Math.trunc(normalizeProjectMonths(item?.projectMonths || item?.contractMonths)));
      // value stores the contract total; monthlyValue is the installment.
      // Older opportunities may only have the total recorded.
      const monthlyValue = item?.monthlyValue !== null && item?.monthlyValue !== undefined && item?.monthlyValue !== ''
        ? Math.max(0, toNumber(item.monthlyValue)) : value / months;
      const contractTotal = Math.round(monthlyValue * months * 100) / 100;
      acc.monthly += monthlyValue;
      acc.contract += contractTotal;
      acc.total += contractTotal;
      acc.monthlyCount += 1;
    } else {
      acc.single += value + setup;
      acc.total += value + setup;
      acc.singleCount += 1;
    }
    acc.count += 1;
    return acc;
  }, { monthly: 0, contract: 0, single: 0, total: 0, count: 0, monthlyCount: 0, singleCount: 0 });

const revenueBreakdownFromNotices = (rows = []) =>
  toArray(rows).reduce((acc, item) => {
    const value = toNumber(item?.estimatedValue);
    acc.single += value;
    acc.total += value;
    acc.singleCount += 1;
    acc.count += 1;
    return acc;
  }, { monthly: 0, contract: 0, single: 0, total: 0, count: 0, monthlyCount: 0, singleCount: 0 });

const mergeRevenueBreakdowns = (...items) =>
  items.reduce((acc, item) => ({
    monthly: acc.monthly + toNumber(item?.monthly),
    contract: acc.contract + toNumber(item?.contract),
    single: acc.single + toNumber(item?.single),
    total: acc.total + toNumber(item?.total),
    count: acc.count + toNumber(item?.count),
    monthlyCount: acc.monthlyCount + toNumber(item?.monthlyCount),
    singleCount: acc.singleCount + toNumber(item?.singleCount)
  }), { monthly: 0, contract: 0, single: 0, total: 0, count: 0, monthlyCount: 0, singleCount: 0 });

const buildB2BStageBreakdown = (rows = []) => {
  const base = Object.fromEntries(
    B2B_STAGE_SUMMARY.map((stage) => [
      stage.key,
      { ...stage, total: 0, monthly: 0, contract: 0, single: 0, count: 0 }
    ])
  );

  toArray(rows).forEach((item) => {
    const stage = String(item?.stage || 'LEAD').trim().toUpperCase();
    if (!base[stage]) return;
    const revenue = revenueBreakdownFromOpportunities([item]);
    base[stage].total += revenue.total;
    base[stage].monthly += revenue.monthly;
    base[stage].contract += revenue.contract;
    base[stage].single += revenue.single;
    base[stage].count += 1;
  });

  return B2B_STAGE_SUMMARY.map((stage) => base[stage.key]);
};

const resolveB2GSummaryStage = (item = {}) => {
  const b2gStage = normalizeB2GStageKey(item?.b2gStage);
  if (b2gStage) return b2gStage;

  return normalizeB2GStageKey(item?.stage) || 'ANALISE';
};

const buildB2GStageBreakdown = (rows = []) => {
  const base = Object.fromEntries(
    B2G_STAGE_SUMMARY.map((stage) => [
      stage.key,
      { ...stage, total: 0, monthly: 0, contract: 0, single: 0, count: 0 }
    ])
  );

  toArray(rows).forEach((item) => {
    const stage = resolveB2GSummaryStage(item);
    if (!base[stage]) return;
    const revenue = revenueBreakdownFromOpportunities([item]);
    base[stage].total += revenue.total;
    base[stage].monthly += revenue.monthly;
    base[stage].contract += revenue.contract;
    base[stage].single += revenue.single;
    base[stage].count += 1;
  });

  return B2G_STAGE_SUMMARY.map((stage) => base[stage.key]);
};


export function buildGeneralDashboardMetrics(data = {}, timeRange = '30') {
    const rangeDays = toNumber(timeRange) || 180;
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - rangeDays);

    const inRange = (value) => {
      const date = toDate(value);
      if (!date) return false;
      return date >= rangeStart;
    };

    const opportunitiesB2B = toArray(data.opportunitiesB2B);
    const opportunitiesB2G = toArray(data.opportunitiesB2G);
    const companiesB2B = toArray(data.companiesB2B);
    const companiesB2G = toArray(data.companiesB2G);
    const b2gNotices = toArray(data.b2g);
    const preSales = toArray(data.preSales?.rows);
    const preSalesPocs = toArray(data.preSalesPocs);
    const prevendasOportunidades = toArray(data.prevendasOportunidades);
    const activities = toArray(data.activities);
    const products = toArray(data.products);
    const sellers = toArray(data.sellers);
    const proposals = toArray(data.proposals);
    const contracts = toArray(data.contracts);
    const commissions = toArray(data.commissions);
    const salesTargets = toArray(data.salesTargets);
    const workflows = toArray(data.workflows);
    const automationRules = toArray(data.automationRules);
    const automationNotifications = toArray(data.automationNotifications);
    const integrations = toArray(data.integrations);
    const regions = toArray(data.regions);

    const opportunitiesB2BRange = opportunitiesB2B.filter((item) => inRange(item.createdAt || item.updatedAt));
    const opportunitiesB2GRange = opportunitiesB2G.filter((item) => inRange(item.createdAt || item.updatedAt));
    const b2gNoticesRange = b2gNotices.filter((item) => inRange(item.createdAt || item.updatedAt));
    // Sem filtro de data — o backend já retorna os registros relevantes; evita double-filter que zeraria os dados
    const preSalesRange = preSales;
    const preSalesPocsRange = preSalesPocs;
    const activitiesRange = activities.filter((item) => inRange(item.createdAt || item.updatedAt || item.dueDate));
    const proposalsRange = proposals.filter((item) => inRange(item.createdAt || item.updatedAt || item.sentAt));
    const contractsRange = contracts.filter((item) => inRange(item.createdAt || item.updatedAt || item.startDate));

    const openB2B = opportunitiesB2BRange.filter((item) => OPEN_STAGES.has(String(item.stage || '').toUpperCase()));
    const wonB2B = opportunitiesB2BRange.filter((item) => String(item.stage || '').toUpperCase() === 'WON' && inRange(item.actualCloseDate));
    const lostB2B = opportunitiesB2BRange.filter((item) => String(item.stage || '').toUpperCase() === 'LOST');

    const openB2GOpps = opportunitiesB2GRange.filter((item) => !['GANHO','PERDIDO','NO_GO'].includes(resolveB2GSummaryStage(item)));
    const wonB2GOpps = opportunitiesB2GRange.filter((item) => resolveB2GSummaryStage(item) === 'GANHO' && inRange(item.actualCloseDate));

    const activeNoticeStatuses = new Set([
      'MONITORANDO',
      'ANALISE_EM_ANDAMENTO',
      'ANALISE_CONCLUIDA',
      'PROPOSTA_EM_PREPARACAO',
      'ENVIADA',
      'SUSPENSA'
    ]);
    const wonNoticeStatuses = new Set(['GANHO']);

    const activeB2GNotices = b2gNoticesRange.filter((item) => activeNoticeStatuses.has(String(item.status || '').toUpperCase()));
    const wonB2GNotices = b2gNoticesRange.filter((item) => wonNoticeStatuses.has(String(item.status || '').toUpperCase()));
    const inAnalysisB2G = b2gNoticesRange.filter((item) => String(item.status || '').toUpperCase() === 'ANALISE_EM_ANDAMENTO');

    const pendingPreSalesStatuses = new Set(['NOVA', 'EM_PRECIFICACAO', 'AGUARDANDO_APROVACAO']);
    const donePreSalesStatuses = new Set(['FINALIZADA']);
    const pendingPreSales = preSalesRange.filter((item) => pendingPreSalesStatuses.has(String(item.status || '').toUpperCase()));
    const donePreSales = preSalesRange.filter((item) => donePreSalesStatuses.has(String(item.status || '').toUpperCase()));
    const activePocStatuses = new Set(['PLANEJAMENTO', 'EM_ANDAMENTO', 'VALIDACAO']);
    const finalPocStatuses = new Set(['APROVADA', 'DESCARTADA']);
    const activePreSalesPocs = preSalesPocsRange.filter((item) => activePocStatuses.has(String(item.status || '').toUpperCase()));

    // Registro de Oportunidades Pré-Vendas (prevendasOportunidades)
    const regOppOpenStatuses = new Set(['ABERTA', 'EM_ANALISE', 'EM_COTACAO', 'PRECIFICADA']);
    const regOppTotal = prevendasOportunidades.length;
    const regOppAbertos = prevendasOportunidades.filter((item) => regOppOpenStatuses.has(String(item.status || '').toUpperCase())).length;
    const regOppGanhos = prevendasOportunidades.filter((item) => String(item.status || '').toUpperCase() === 'GANHA').length;
    const regOppValor = prevendasOportunidades.reduce((acc, item) => acc + Number(item.valorEstimado || 0), 0);
    const approvedPreSalesPocs = preSalesPocsRange.filter((item) => String(item.status || '').toUpperCase() === 'APROVADA');
    const blockedPreSalesPocs = preSalesPocsRange.filter((item) => String(item.status || '').toUpperCase() === 'BLOQUEADA');
    const overduePreSalesPocs = preSalesPocsRange.filter((item) => {
      const dueDate = toDate(item.dueDate);
      if (!dueDate) return false;
      return dueDate < new Date() && !finalPocStatuses.has(String(item.status || '').toUpperCase());
    });

    const pendingActivities = activities.filter((item) => {
      const status = String(item.status || '').toUpperCase();
      return status === 'PENDING' || status === 'OPEN' || status === 'IN_PROGRESS' || status === 'SCHEDULED';
    });

    const overdueActivities = activities.filter((item) => {
      const dueDate = toDate(item.dueDate);
      if (!dueDate) return false;
      const status = String(item.status || '').toUpperCase();
      if (status === 'COMPLETED' || status === 'DONE' || status === 'CANCELLED') return false;
      return dueDate < new Date();
    });

    const nowDash = new Date();
    const daysDash = (n) => new Date(nowDash.getTime() + n * 24 * 60 * 60 * 1000);
    const expiringOportunidades = prevendasOportunidades.filter((item) => {
      if (!item.dataValidade) return false;
      const val = toDate(item.dataValidade);
      if (!val) return false;
      return val <= daysDash(30) && val > nowDash;
    });
    const expiredOportunidades = prevendasOportunidades.filter((item) => {
      if (!item.dataValidade) return false;
      const val = toDate(item.dataValidade);
      if (!val) return false;
      return val < nowDash;
    });
    const expiring7 = expiringOportunidades.filter((item) => toDate(item.dataValidade) <= daysDash(7));
    const expiring15 = expiringOportunidades.filter((item) => {
      const v = toDate(item.dataValidade);
      return v > daysDash(7) && v <= daysDash(15);
    });
    const expiring30 = expiringOportunidades.filter((item) => {
      const v = toDate(item.dataValidade);
      return v > daysDash(15) && v <= daysDash(30);
    });

    const activeProducts = products.filter((item) => item?.active !== false);

    const b2bRevenue = revenueBreakdownFromOpportunities(openB2B);
    const b2bStageBreakdown = buildB2BStageBreakdown(opportunitiesB2BRange);
    const b2gOpportunityRevenue = revenueBreakdownFromOpportunities(openB2GOpps);
    const b2gNoticeRevenue = revenueBreakdownFromNotices(activeB2GNotices);
    const b2gStageBreakdown = buildB2GStageBreakdown(opportunitiesB2GRange);
    const b2gRevenue = b2gOpportunityRevenue;
    const consolidatedRevenue = mergeRevenueBreakdowns(b2bRevenue, b2gRevenue);
    const b2bWonRevenue = revenueBreakdownFromOpportunities(wonB2B);
    const b2gWonRevenue = revenueBreakdownFromOpportunities(wonB2GOpps);

    const b2bPipelineValue = b2bRevenue.total;
    const b2bWonValue = b2bWonRevenue.total;
    const b2gNoticePipelineValue = b2gNoticeRevenue.total;
    const b2gNoticeWonValue = revenueBreakdownFromNotices(wonB2GNotices).total;
    const b2gOpportunityPipelineValue = b2gOpportunityRevenue.total;
    const b2gOpportunityWonValue = revenueBreakdownFromOpportunities(wonB2GOpps).total;

    const totalPipeline = b2bPipelineValue + b2gOpportunityPipelineValue;
    const totalWonValue = b2bWonValue + b2gOpportunityWonValue;
    const previousStart = new Date(rangeStart);
    previousStart.setDate(previousStart.getDate() - rangeDays);
    const inPreviousRange = item => {
      const date = toDate(item.createdAt || item.updatedAt);
      return date && date >= previousStart && date < rangeStart;
    };
    const previousOpportunities = [...opportunitiesB2B, ...opportunitiesB2G].filter(inPreviousRange);
    const previousMetrics = {
      revenue: revenueBreakdownFromOpportunities([...opportunitiesB2B,...opportunitiesB2G].filter(item=>{const date=toDate(item.actualCloseDate);return (String(item.stage).toUpperCase()==='WON' || resolveB2GSummaryStage(item)==='GANHO') && date && date>=previousStart && date<rangeStart;})).total,
      pipeline: revenueBreakdownFromOpportunities(previousOpportunities.filter(item => item.b2gStage ? !['GANHO','PERDIDO','NO_GO'].includes(resolveB2GSummaryStage(item)) : OPEN_STAGES.has(String(item.stage || '').toUpperCase()))).total,
      opportunities: previousOpportunities.length,
      publicOpportunities: opportunitiesB2G.filter(inPreviousRange).filter(item=>!['GANHO','PERDIDO','NO_GO'].includes(resolveB2GSummaryStage(item))).length,
      notices: b2gNotices.filter(inPreviousRange).filter(item => activeNoticeStatuses.has(String(item.status || '').toUpperCase())).length
    };

    const b2bConversion = opportunitiesB2BRange.length > 0
      ? (opportunitiesB2BRange.filter(item=>String(item.stage).toUpperCase()==='WON').length / opportunitiesB2BRange.length) * 100
      : 0;
    const b2gConversion = opportunitiesB2GRange.length > 0
      ? (opportunitiesB2GRange.filter(item=>resolveB2GSummaryStage(item)==='GANHO').length / opportunitiesB2GRange.length) * 100
      : 0;
    const previousB2B = opportunitiesB2B.filter(inPreviousRange);
    const previousB2G = opportunitiesB2G.filter(inPreviousRange);
    const conversionComparison = {
      B2B: previousB2B.length ? b2bConversion - previousB2B.filter(item => String(item.stage).toUpperCase() === 'WON').length / previousB2B.length * 100 : null,
      B2G: previousB2G.length ? b2gConversion - previousB2G.filter(item => resolveB2GSummaryStage(item) === 'GANHO').length / previousB2G.length * 100 : null
    };
    const preSalesApproval = preSalesRange.length > 0
      ? (donePreSales.length / preSalesRange.length) * 100
      : 0;

    const leadStatsB2B =
      data?.leadStatsB2B && Object.keys(data.leadStatsB2B).length > 0
        ? data.leadStatsB2B
        : buildLeadStatsFromCompanies(companiesB2B);
    const leadStatsB2G =
      data?.leadStatsB2G && Object.keys(data.leadStatsB2G).length > 0
        ? data.leadStatsB2G
        : buildLeadStatsFromCompanies(companiesB2G);

    const hotLeads = toNumber(leadStatsB2B.hotLeads) + toNumber(leadStatsB2G.hotLeads);
    const warmLeads = toNumber(leadStatsB2B.warmLeads) + toNumber(leadStatsB2G.warmLeads);

    const teamMap = {};
    [...opportunitiesB2BRange, ...opportunitiesB2GRange].forEach((item) => {
      const ownerName = item?.owner?.name || 'Sem responsável';
      const ownerKey = item.ownerId || item.owner?.id || ownerName;
      if (!teamMap[ownerKey]) {
        teamMap[ownerKey] = { id: ownerKey, name: ownerName, total: 0, won: 0, pipeline: 0 };
      }
      teamMap[ownerKey].total += 1;
      if (String(item.stage || '').toUpperCase() === 'WON' || resolveB2GSummaryStage(item) === 'GANHO') {
        teamMap[ownerKey].won += 1;
      }
      if (item.b2gStage ? !['GANHO','PERDIDO','NO_GO'].includes(resolveB2GSummaryStage(item)) : OPEN_STAGES.has(String(item.stage || '').toUpperCase())) {
        teamMap[ownerKey].pipeline += revenueBreakdownFromOpportunities([item]).total;
      }
    });

    let teamPerformance = Object.values(teamMap)
      .sort((a, b) => b.pipeline - a.pipeline || b.total - a.total);


    const buckets = createMonthBuckets(12);
    // Cohort conversion: current wins / entries in each month, using the active period.
    const conversionHistory = (items, isWon) => buckets.map(bucket => {
      const entries = items.filter(item => {
        const date = toDate(item.createdAt || item.updatedAt);
        return date && monthKey(date) === bucket.key;
      });
      const won = entries.filter(isWon).length;
      return { label: bucket.label, total: entries.length, won, value: entries.length ? won / entries.length * 100 : null };
    });
    const conversionSeries = {
      B2B: conversionHistory(opportunitiesB2BRange, item => String(item.stage).toUpperCase() === 'WON'),
      B2G: conversionHistory(opportunitiesB2GRange, item => resolveB2GSummaryStage(item) === 'GANHO')
    };
    const monthIndex = new Map(buckets.map((item, idx) => [item.key, idx]));

    const monthlyPotential = new Array(buckets.length).fill(0);
    const monthlyWon = new Array(buckets.length).fill(0);
    const monthlyActivities = new Array(buckets.length).fill(0);
    const monthlyB2B = {
      recurring: new Array(buckets.length).fill(0),
      contract: new Array(buckets.length).fill(0),
      single: new Array(buckets.length).fill(0)
    };
    const monthlyB2G = {
      recurring: new Array(buckets.length).fill(0),
      contract: new Array(buckets.length).fill(0),
      single: new Array(buckets.length).fill(0)
    };

    const addOpportunityRevenueToBucket = (item, bucketSet) => {
      const createdDate = toDate(item.createdAt || item.updatedAt);
      if (!createdDate) return;
      const idx = monthIndex.get(monthKey(createdDate));
      if (idx === undefined) return;
      const revenue = revenueBreakdownFromOpportunities([item]);
      bucketSet.recurring[idx] += revenue.monthly;
      bucketSet.contract[idx] += revenue.contract;
      bucketSet.single[idx] += revenue.single;
    };

    opportunitiesB2BRange.forEach((item) => addOpportunityRevenueToBucket(item, monthlyB2B));
    opportunitiesB2GRange.forEach((item) => addOpportunityRevenueToBucket(item, monthlyB2G));

    [...opportunitiesB2BRange.map(item=>({...item,__won:String(item.stage).toUpperCase()==='WON',__open:OPEN_STAGES.has(String(item.stage).toUpperCase())})), ...opportunitiesB2GRange.map(item=>({...item,__won:resolveB2GSummaryStage(item)==='GANHO',__open:!['GANHO','PERDIDO','NO_GO'].includes(resolveB2GSummaryStage(item))}))].forEach(item=>{
      const entry = toDate(item.createdAt || item.updatedAt);
      const close = toDate(item.actualCloseDate);
      const entryIndex = entry ? monthIndex.get(monthKey(entry)) : undefined;
      const closeIndex = close ? monthIndex.get(monthKey(close)) : undefined;
      if(item.__open && entryIndex!==undefined)monthlyPotential[entryIndex]+=revenueBreakdownFromOpportunities([item]).total;
      if(item.__won && closeIndex!==undefined)monthlyWon[closeIndex]+=revenueBreakdownFromOpportunities([item]).total;
    });

    activitiesRange.forEach((item) => {
      const createdDate = toDate(item.createdAt || item.updatedAt || item.dueDate);
      if (!createdDate) return;
      const idx = monthIndex.get(monthKey(createdDate));
      if (idx === undefined) return;
      monthlyActivities[idx] += 1;
    });

    const stageOrder = ['LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    const stageLabels = {
      LEAD: 'Lead',
      QUALIFICATION: 'Qualificação',
      DIAGNOSIS: 'Diagnóstico',
      PROPOSAL: 'Proposta',
      NEGOTIATION: 'Negociação',
      WON: 'Ganhas',
      LOST: 'Perdidas'
    };

    const countByStage = (rows) => {
      const result = Object.fromEntries(stageOrder.map((stage) => [stage, 0]));
      rows.forEach((row) => {
        const stage = String(row.stage || '').toUpperCase();
        if (stage in result) result[stage] += 1;
      });
      return stageOrder.map((stage) => result[stage]);
    };

    const b2bStageCounts = countByStage(opportunitiesB2BRange);
    const b2gOppStageCounts = countByStage(opportunitiesB2GRange);

    return {
      opportunitiesB2BRange,
      opportunitiesB2GRange,
      companiesB2B,
      companiesB2G,
      b2gNoticesRange,
      preSalesRange,
      preSalesPocsRange,
      activitiesRange,
      proposalsRange,
      contractsRange,
      commissions,
      salesTargets,
      workflows,
      automationRules,
      automationNotifications,
      integrations,
      regions,
      pendingActivities,
      overdueActivities,
      activeProducts,
      activeB2GNotices,
      activeB2GOpportunities: openB2GOpps,
      inAnalysisB2G,
      pendingPreSales,
      donePreSales,
      activePreSalesPocs,
      approvedPreSalesPocs,
      blockedPreSalesPocs,
      overduePreSalesPocs,
      regOppTotal,
      regOppAbertos,
      regOppGanhos,
      regOppValor,
      b2bRevenue,
      b2bStageBreakdown,
      b2gRevenue,
      b2gStageBreakdown,
      consolidatedRevenue,
      b2bWonRevenue,
      b2gWonRevenue,
      totalPipeline,
      totalWonValue,
      undatedWonCount: [...opportunitiesB2BRange.filter(item=>String(item.stage).toUpperCase()==='WON'),...opportunitiesB2GRange.filter(item=>resolveB2GSummaryStage(item)==='GANHO')].filter(item=>!toDate(item.actualCloseDate)).length,
      previousMetrics,
      b2bPipelineValue,
      b2bWonValue,
      b2bConversion,
      conversionComparison,
      conversionSeries,
      b2gConversion,
      preSalesApproval,
      hotLeads,
      warmLeads,
      leadStatsB2B,
      leadStatsB2G,
      teamPerformance,
      buckets,
      monthlyPotential,
      monthlyWon,
      monthlyActivities,
      monthlyB2B,
      monthlyB2G,
      stageOrder,
      stageLabels,
      b2bStageCounts,
      b2gOppStageCounts,
      expiringOportunidades,
      expiredOportunidades,
      expiring7,
      expiring15,
      expiring30
    };

}

export { toNumber, parseUserFromStorage, revenueBreakdownFromOpportunities };
