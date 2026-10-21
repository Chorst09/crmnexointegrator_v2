const DAY = 86400000;
const STAGES = ['LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
const LABELS = { LEAD: 'Lead', QUALIFICATION: 'Qualificação', DIAGNOSIS: 'Diagnóstico', PROPOSAL: 'Proposta', NEGOTIATION: 'Negociação', WON: 'Ganhas', LOST: 'Perdidas' };
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const probability = value => Math.min(100, Math.max(0, number(value)));
const date = value => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return null;
  // Lifecycle fields are calendar dates, including dates imported at midnight.
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
};
const key = value => value.toISOString().slice(0, 10);
const month = value => key(value).slice(0, 7);
const monthStart = (value, offset = 0) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + offset, 1));
const sum = (rows, field) => rows.reduce((total, row) => total + number(row[field]), 0);
const round = value => Math.round(value * 100) / 100;

export function getB2BPeriod(period = 'year', now = new Date(), rows = []) {
  const today = date(new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now));
  let start;
  let daily = false;
  if (/^\d+d$/.test(period)) {
    const days = Math.min(366, Math.max(1, parseInt(period, 10)));
    start = new Date(today.getTime() - (days - 1) * DAY);
    daily = days <= 45;
  } else if (period === 'month') {
    start = monthStart(today);
    daily = true;
  } else if (period === 'quarter') {
    start = new Date(Date.UTC(today.getUTCFullYear(), Math.floor(today.getUTCMonth() / 3) * 3, 1));
  } else if (period === 'year') {
    start = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  } else if (period === 'all') {
    const dates = rows.flatMap(row => [date(row.leadEntryDate) || date(row.createdAt), date(row.actualCloseDate) || date(row.exitDate)]).filter(value => value && value <= today);
    start = dates.length ? monthStart(new Date(Math.min(...dates.map(value => value.getTime())))) : monthStart(today);
  } else {
    const months = Math.min(120, Math.max(1, parseInt(period, 10) || 6));
    start = monthStart(today, 1 - months);
  }
  return { start, end: today, daily };
}

const group = (rows, field, labels = {}) => {
  const groups = new Map();
  for (const row of rows) {
    const raw = String(row[field] || '').trim() || 'Não informado';
    const label = labels[raw] || raw;
    const entry = groups.get(label) || { label, count: 0, value: 0, weightedValue: 0 };
    entry.count += 1;
    entry.value += row.__value;
    entry.weightedValue += row.__weightedValue;
    groups.set(label, entry);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.value - a.value);
};

export function buildB2BDashboardAnalytics(opportunities = [], { period = 'year', now = new Date() } = {}) {
  const range = getB2BPeriod(period, now, opportunities);
  const inPeriod = value => value && value >= range.start && value <= range.end;
  const rows = opportunities.map(item => {
    if (item.revenueType === 'MENSAL') item = { ...item, projectType: 'MONTHLY', projectMonths: item.contractPeriodMonths || item.projectMonths || item.contractMonths, monthlyValue: item.monthlyRecurringValue ?? item.monthlyValue, value: item.totalContractValue ?? item.value };
    if (item.revenueType === 'PONTUAL') item = { ...item, projectType: 'SINGLE', value: item.totalProductsValue ?? item.value, installationFee: item.setupValue ?? item.installationFee };
    const entry = date(item.leadEntryDate) || date(item.createdAt);
    const closed = date(item.actualCloseDate) || (item.stage === 'LOST' ? date(item.exitDate) : null);
    const updated = date(item.updatedAt);
    const expected = date(item.expectedCloseDate);
    const monthly = item.projectType === 'MONTHLY';
    const months = Math.max(1, Math.trunc(number(item.projectMonths || item.contractMonths) || 12));
    const monthlyValue = item.monthlyValue !== null && item.monthlyValue !== undefined && item.monthlyValue !== ''
      ? Math.max(0, number(item.monthlyValue)) : Math.max(0, number(item.value)) / months;
    const setup = Math.max(0, number(item.installationFee));
    const value = monthly ? monthlyValue * months : Math.max(0, number(item.value)) + setup;
    const age = entry && entry <= range.end ? Math.floor((range.end - entry) / DAY) : null;
    const idle = updated && updated <= range.end ? Math.floor((range.end - updated) / DAY) : null;
    const overdue = expected && expected < range.end ? Math.floor((range.end - expected) / DAY) : 0;
    return { ...item, __monthly: monthly, __months: months, __monthlyValue: monthlyValue, __setup: setup, __stage: item.stage, __stageLabel: LABELS[item.stage] || item.stage, __entry: entry, __closed: closed, __expected: expected, __value: value, __probability: probability(item.probability), __weightedValue: value * probability(item.probability) / 100, __ageDays: age, __idleDays: idle, __overdueDays: overdue };
  });
  const open = rows.filter(row => !['WON', 'LOST'].includes(row.stage));
  const won = rows.filter(row => row.stage === 'WON');
  const lost = rows.filter(row => row.stage === 'LOST');
  const buckets = new Map();
  for (let cursor = range.daily ? range.start : monthStart(range.start); cursor <= range.end; cursor = range.daily ? new Date(cursor.getTime() + DAY) : monthStart(cursor, 1)) {
    const bucketKey = range.daily ? key(cursor) : month(cursor);
    buckets.set(bucketKey, { date: key(cursor), label: range.daily ? `${String(cursor.getUTCDate()).padStart(2, '0')}/${String(cursor.getUTCMonth() + 1).padStart(2, '0')}` : new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(cursor), entries: 0, won: 0, lost: 0, enteredValue: 0, revenue: 0 });
  }
  for (const row of rows) {
    if (inPeriod(row.__entry)) {
      const bucket = buckets.get(range.daily ? key(row.__entry) : month(row.__entry));
      bucket.entries += 1;
      bucket.enteredValue += row.__value;
    }
    if (['WON', 'LOST'].includes(row.stage) && inPeriod(row.__closed)) {
      const bucket = buckets.get(range.daily ? key(row.__closed) : month(row.__closed));
      if (row.stage === 'WON') { bucket.won += 1; bucket.revenue += row.__value; }
      else bucket.lost += 1;
    }
  }
  const timeline = [...buckets.values()];
  // Revenue schedule is a projection from won contracts, not collected invoices.
  // First installment is recognized on closure; later installments use that day,
  // clamped to the last calendar day for shorter months.
  const revenueTimeline = [...buckets.values()].map(row => ({ date: row.date, label: row.label, recurring: 0, oneTime: 0 }));
  const revenueBuckets = new Map(revenueTimeline.map(row => [range.daily ? row.date : row.date.slice(0, 7), row]));
  const addRevenue = (when, field, value) => {
    if (!inPeriod(when)) return;
    const bucket = revenueBuckets.get(range.daily ? key(when) : month(when));
    if (bucket) bucket[field] += value;
  };
  let activeMrr = 0;
  for (const row of won) {
    if (!row.__closed || row.__closed > range.end) continue;
    if (!row.__monthly) { addRevenue(row.__closed, 'oneTime', row.__value); continue; }
    const installmentDate = offset => {
      const start = monthStart(row.__closed, offset);
      const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
      return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), Math.min(row.__closed.getUTCDate(), lastDay)));
    };
    if (range.end < installmentDate(row.__months)) activeMrr += row.__monthlyValue;
    addRevenue(row.__closed, 'oneTime', row.__setup);
    for (let offset = 0; offset < row.__months; offset += 1) {
      const due = installmentDate(offset);
      if (due > range.end) break;
      addRevenue(due, 'recurring', row.__monthlyValue);
    }
  }
  const revenue = {
    activeMrr: round(activeMrr),
    periodRecurring: round(sum(revenueTimeline, 'recurring')),
    periodOneTime: round(sum(revenueTimeline, 'oneTime')),
    recurringPipelineMonthly: round(sum(open.filter(row => row.__monthly), '__monthlyValue')),
    recurringPipelineTotal: round(sum(open.filter(row => row.__monthly), '__value')),
    oneTimePipeline: round(sum(open.filter(row => !row.__monthly), '__value')),
    undatedWins: won.filter(row => !row.__closed).length
  };

  const forecast = Array.from({ length: 6 }, (_, index) => ({ month: key(monthStart(range.end, index)), forecast: 0, nominal: 0, deals: 0 }));
  for (const row of open) {
    if (!row.__expected || row.__expected < range.end) continue;
    const bucket = forecast.find(item => item.month.slice(0, 7) === month(row.__expected));
    if (bucket) { bucket.forecast += row.__weightedValue; bucket.nominal += row.__value; bucket.deals += 1; }
  }
  const owners = new Map();
  for (const row of rows) {
    const ownerId = row.ownerId || row.owner?.id || 'unassigned';
    const owner = owners.get(ownerId) || { sellerId: ownerId, sellerName: row.owner?.name || 'Não informado', total: 0, open: 0, won: 0, lost: 0, pipelineValue: 0, weightedValue: 0, revenue: 0, periodDeals: 0, periodRevenue: 0 };
    owner.total += 1;
    if (row.stage === 'WON') {
      owner.won += 1;
      owner.revenue += row.__value;
      if (inPeriod(row.__closed)) { owner.periodDeals += 1; owner.periodRevenue += row.__value; }
    } else if (row.stage === 'LOST') owner.lost += 1;
    else { owner.open += 1; owner.pipelineValue += row.__value; owner.weightedValue += row.__weightedValue; }
    owners.set(ownerId, owner);
  }
  const sellerPerformance = [...owners.values()].sort((a, b) => b.pipelineValue - a.pipelineValue || b.open - a.open || b.total - a.total);
  const stageRows = STAGES.filter(stage => !['WON', 'LOST'].includes(stage)).map(stage => {
    const items = open.filter(row => row.stage === stage);
    return { stage, label: LABELS[stage], count: items.length, value: sum(items, '__value'), weightedValue: sum(items, '__weightedValue') };
  });
  const temperatureRows = [
    { label: '0%', min: 0, max: 0, color: '#ef4444' },
    { label: '1–25%', min: 1, max: 25, color: '#f97316' },
    { label: '26–50%', min: 26, max: 50, color: '#f6b40b' },
    { label: '51–75%', min: 51, max: 75, color: '#18c8df' },
    { label: '76–100%', min: 76, max: 100, color: '#22c55e' }
  ].map(band => {
    const items = open.filter(row => row.__probability >= band.min && row.__probability <= band.max);
    return { ...band, count: items.length, value: sum(items, '__value') };
  });
  const agingRows = [
    { label: '0–15 dias', min: 0, max: 15 }, { label: '16–30 dias', min: 16, max: 30 },
    { label: '31–60 dias', min: 31, max: 60 }, { label: '61–90 dias', min: 61, max: 90 },
    { label: '+90 dias', min: 91, max: Infinity }, { label: 'Sem data', min: null, max: null }
  ].map(band => {
    const items = open.filter(row => band.min === null ? row.__ageDays === null : row.__ageDays !== null && row.__ageDays >= band.min && row.__ageDays <= band.max);
    return { label: band.label, count: items.length, value: sum(items, '__value') };
  });
  const riskRows = open.map(row => ({ ...row,
    __riskPriority: row.__overdueDays > 0 ? 4 : row.__idleDays >= 30 ? 3 : !row.__expected ? 2 : row.__value <= 0 ? 1 : 0,
    __riskReason: row.__overdueDays > 0 ? `Fechamento previsto atrasado há ${row.__overdueDays} dias` : row.__idleDays >= 30 ? `Sem atualização há ${row.__idleDays} dias` : !row.__expected ? 'Sem previsão de fechamento' : row.__value <= 0 ? 'Valor comercial não informado' : ''
  })).filter(row => row.__riskPriority > 0).sort((a, b) => b.__riskPriority - a.__riskPriority || b.__overdueDays - a.__overdueDays || b.__value - a.__value).slice(0, 5);
  const sourceRows = group(rows.map(row => ({ ...row, __source: row.leadSourceDetail || row.source })), '__source');
  return {
    period: { start: key(range.start), end: key(range.end), daily: range.daily },
    revenue,
    kpis: {
      totalOpportunities: rows.length, openOpportunities: open.length, wonOpportunities: won.length, lostOpportunities: lost.length,
      activeLeads: open.filter(row => row.stage === 'LEAD').length, pipelineValue: round(sum(open, '__value')), weightedPipelineValue: round(sum(open, '__weightedValue')),
      wonValue: round(sum(won, '__value')), avgTicket: won.length ? round(sum(won, '__value') / won.length) : 0,
      conversionRate: won.length + lost.length ? round(won.length / (won.length + lost.length) * 100) : 0,
      pipelineTemperature: open.length ? round(sum(open, '__probability') / open.length) : 0,
      newOpportunities: sum(timeline, 'entries'), periodWon: sum(timeline, 'won'), periodRevenue: round(sum(timeline, 'revenue')),
      overdueOpportunities: open.filter(row => row.__overdueDays > 0).length,
      unscheduledOpportunities: open.filter(row => !row.__expected).length,
      unscheduledValue: round(sum(open.filter(row => !row.__expected), '__value')),
      undatedClosures: [...won, ...lost].filter(row => !row.__closed).length,
      missingEntryDates: rows.filter(row => !row.__entry || row.__entry > range.end).length,
      unpricedOpportunities: open.filter(row => row.__value <= 0).length
    },
    charts: {
      funnel: STAGES.map(stage => { const items = rows.filter(row => row.stage === stage); return { stage, _count: { stage: items.length }, _sum: { value: round(sum(items, '__value')) } }; }),
      leadSources: sourceRows.map(row => ({ source: row.label, _count: { source: row.count } })),
      revenueTimeline: revenueTimeline.map(row => ({ ...row, recurring: round(row.recurring), oneTime: round(row.oneTime) })),
      timeline, forecast: forecast.map(row => ({ ...row, nominal: round(row.nominal), forecast: round(row.forecast) })),
      monthlyRevenue: timeline.map(row => ({ month: row.date, revenue: round(row.revenue), deals: row.won })),
      sellerPerformance
    },
    insights: { stageRows, temperatureRows, agingRows, riskRows, towerRows: group(open, 'projectTower'), clientTypeRows: group(open, 'projectClientType', { NEW_CLIENT: 'Cliente novo', BASE_CLIENT: 'Cliente da base', RENEWAL: 'Renovação' }) }
  };
}
