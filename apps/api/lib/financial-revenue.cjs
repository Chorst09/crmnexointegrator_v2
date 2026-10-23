const numeric = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : null;
const first = (...values) => values.map(numeric).find(value => value !== null) ?? null;
const positive = (...values) => values.map(numeric).find(value => value > 0) ?? null;
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const upper = value => String(value || '').trim().toUpperCase();
const description = item => {
  try {
    const parsed = typeof item.description === 'string' ? JSON.parse(item.description) : item.description;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
};

function financialSegment(item) {
  if (['B2B', 'B2G'].includes(upper(item.clientType))) return upper(item.clientType);
  if (upper(item.number).startsWith('B2G-') || item.b2gStage || upper(item.projectClientType) === 'B2G') return 'B2G';
  return upper(item.company?.clientType) === 'B2G' ? 'B2G' : 'B2B';
}

function financialStage(item) {
  const stage = upper(item.stage);
  if (['WON', 'LOST'].includes(stage)) return stage;
  const b2g = upper(item.b2gStage).replace(/[\s-]+/g, '_');
  if (['GANHO', 'GANHA', 'WON'].includes(b2g)) return 'WON';
  if (['PERDIDO', 'PERDIDA', 'LOST', 'NO_GO'].includes(b2g)) return 'LOST';
  return stage;
}

function splitFinancialRevenue(item) {
  const desc = description(item);
  const b2g = financialSegment(item) === 'B2G';
  const descMonthly = b2g ? first(desc.estimatedMonthlyValue, desc.valorEstimadoMensal) : null;
  const descOneTime = b2g ? first(desc.estimatedOneTimeValue, desc.valorEstimadoPontual) : null;
  const type = upper(item.revenueType) || (b2g ? upper(desc.contractType || desc.tipoContrato) : '');
  const months = positive(item.contractPeriodMonths, b2g ? desc.contractTermMonths : null, b2g ? desc.prazoContratual : null, item.projectMonths, item.contractMonths);
  const monthly = first(item.monthlyRecurringValue, descMonthly, item.monthlyValue);
  const setup = first(item.setupValue, item.installationFee) ?? 0;
  const nominal = first(item.totalContractValue, b2g ? desc.estimatedValue : null, b2g ? desc.valorEstimadoTotal : null, item.value) ?? 0;
  const isMonthly = ['MENSAL', 'MONTHLY'].includes(type) || (!['PONTUAL', 'SINGLE'].includes(type) && (upper(item.projectType) === 'MONTHLY' || (monthly ?? 0) > 0));
  let recurringMonthly = 0, recurringTotal = 0, oneTime = 0, unclassified = 0, incomplete = false;
  if (isMonthly) {
    oneTime = descOneTime ?? setup;
    const recurringBase = b2g && descOneTime !== null && numeric(item.totalContractValue) === null ? Math.max(0, nominal - oneTime) : nominal;
    recurringMonthly = monthly ?? (months ? recurringBase / months : 0);
    recurringTotal = months ? recurringMonthly * months : recurringBase;
    incomplete = !months;
  } else if (['PONTUAL', 'SINGLE'].includes(type) || upper(item.projectType) === 'SINGLE' || descOneTime !== null || numeric(item.totalProductsValue) !== null) {
    oneTime = descOneTime ?? ((first(item.totalProductsValue, item.value) ?? 0) + setup);
  } else {
    unclassified = first(item.value) ?? 0;
  }
  return {
    recurringMonthly: round(recurringMonthly), recurringTotal: round(recurringTotal),
    oneTime: round(oneTime), unclassified: round(unclassified),
    total: round(recurringTotal + oneTime + unclassified), months,
    kind: unclassified > 0 ? 'Não classificada' : isMonthly && oneTime > 0 ? 'Mensal + pontual' : isMonthly ? 'Mensal' : 'Pontual',
    incomplete,
    missingClassification: unclassified > 0
  };
}

function summarizeFinancialRevenue(items) {
  const result = { recurringMonthly: 0, recurringTotal: 0, oneTime: 0, unclassified: 0, total: 0, count: items.length, incompleteCount: 0, unclassifiedCount: 0 };
  for (const item of items) {
    const row = item._revenue || splitFinancialRevenue(item);
    for (const key of ['recurringMonthly', 'recurringTotal', 'oneTime', 'unclassified', 'total']) result[key] += row[key];
    result.incompleteCount += Number(row.incomplete);
    result.unclassifiedCount += Number(row.missingClassification);
  }
  for (const key of ['recurringMonthly', 'recurringTotal', 'oneTime', 'unclassified', 'total']) result[key] = round(result[key]);
  return result;
}

function financialRevenueAnalysis(items) {
  const won = items.filter(item => financialStage(item) === 'WON');
  const open = items.filter(item => !['WON', 'LOST'].includes(financialStage(item)));
  const groups = rows => ['B2B', 'B2G'].map(segment => ({ label: segment, ...summarizeFinancialRevenue(rows.filter(item => financialSegment(item) === segment)) })).filter(row => row.count > 0);
  return { won: summarizeFinancialRevenue(won), open: summarizeFinancialRevenue(open), wonBySegment: groups(won), openBySegment: groups(open) };
}

function financialStages(items, segment) {
  const labels = segment === 'B2G'
    ? { LEAD: 'Identificação', QUALIFICATION: 'Qualificação / Edital', DIAGNOSIS: 'Análise', PROPOSAL: 'Proposta / Licitação', NEGOTIATION: 'Negociação / Recurso', WON: 'Homologado / Ganho', LOST: 'Perdido / Não seguir' }
    : { LEAD: 'Lead', QUALIFICATION: 'Qualificação', DIAGNOSIS: 'Diagnóstico', PROPOSAL: 'Proposta enviada', NEGOTIATION: 'Negociação', WON: 'Fechado ganho', LOST: 'Perdido' };
  return Object.entries(labels).map(([estagio, label]) => {
    const summary = summarizeFinancialRevenue(items.filter(item => financialStage(item) === estagio));
    return { ...summary, estagio, label, valor: summary.total };
  });
}

module.exports = { financialSegment, financialStage, splitFinancialRevenue, summarizeFinancialRevenue, financialRevenueAnalysis, financialStages };
