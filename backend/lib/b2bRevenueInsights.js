const DAY = 86400000;
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const key = d => d.toISOString().slice(0, 10);
const monthStart = (d, offset = 0) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + offset, 1));
const installment = (start, offset) => {
  const m = monthStart(start, offset);
  const last = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), Math.min(start.getUTCDate(), last)));
};
const sum = (rows, field) => round(rows.reduce((n, row) => n + row[field], 0));
const monthlyBuckets = (start, end) => {
  const rows = [];
  for (let d = monthStart(start); d <= end; d = monthStart(d, 1)) {
    rows.push({ month: key(d), label: new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(d), recurring: 0, products: 0, setup: 0, potential: 0 });
  }
  return rows;
};

// Receives the SAME normalized, authorized portfolio as the existing KPIs.
export function buildB2BRevenueInsights(rows, { start, end }, period) {
  const won = rows.filter(r => r.stage === 'WON');
  const open = rows.filter(r => !['WON', 'LOST'].includes(r.stage));
  const previousEnd = new Date(start.getTime() - DAY);
  const previousStart = new Date(previousEnd.getTime() - (end - start));
  const projectionStart = monthStart(end, 1);
  const projectionEnd = new Date(monthStart(end, 13).getTime() - DAY);
  const details = Object.fromEntries(['activeMrr', 'periodRecurring', 'periodOneTime', 'recurringPipelineMonthly', 'recurringPipelineTotal', 'oneTimePipeline', 'periodProducts', 'periodSetup'].map(k => [k, []]));
  const monthly = monthlyBuckets(start, end);
  const projection = monthlyBuckets(projectionStart, projectionEnd);
  const at = (d, a, b) => d && d >= a && d <= b;
  const detail = (r, amount) => ({ id: r.id, number: r.number, title: r.title || 'Oportunidade', client: r.company?.name || 'Não informado', owner: r.owner?.name || 'Não informado', monthly: r.__monthlyValue, months: r.__monthly ? r.__months : null, start: r.__closed ? key(r.__closed) : null, end: r.__monthly && r.__closed ? key(installment(r.__closed, r.__months)) : null, expected: r.__expected ? key(r.__expected) : null, amount: round(amount) });
  const addDetail = (k, r, amount) => { if (amount > 0) details[k].push(detail(r, amount)); };
  const add = (buckets, when, field, amount, a, b) => {
    if (!at(when, a, b)) return;
    const bucket = buckets.find(item => item.month.slice(0, 7) === key(when).slice(0, 7));
    if (bucket) bucket[field] += amount;
  };
  const previous = { activeMrr: 0, periodRecurring: 0, periodOneTime: 0 };
  const expirationRows = [];
  for (const r of won) {
    const closed = r.__closed;
    if (!closed || closed > end) continue;
    let recurring = 0;
    const products = r.__monthly ? 0 : Math.max(0, r.__value - r.__setup);
    const setup = r.__setup;
    if (at(closed, start, end)) {
      addDetail('periodProducts', r, products);
      addDetail('periodSetup', r, setup);
      addDetail('periodOneTime', r, products + setup);
    }
    add(monthly, closed, 'products', products, start, end);
    add(monthly, closed, 'setup', setup, start, end);
    if (at(closed, previousStart, previousEnd)) previous.periodOneTime += products + setup;
    if (!r.__monthly) continue;
    const expires = installment(closed, r.__months);
    if (end < expires) {
      addDetail('activeMrr', r, r.__monthlyValue);
      const days = Math.round((expires - end) / DAY);
      if (days <= 90) expirationRows.push({ ...detail(r, r.__monthlyValue), days });
    }
    if (closed <= previousEnd && previousEnd < expires) previous.activeMrr += r.__monthlyValue;
    // Only iterate installments that could fall within the horizon.
    const maxOffset = Math.min(r.__months - 1, (projectionEnd.getUTCFullYear() - closed.getUTCFullYear()) * 12 + projectionEnd.getUTCMonth() - closed.getUTCMonth());
    for (let i = 0; i <= maxOffset; i++) {
      const due = installment(closed, i);
      if (at(due, start, end)) recurring += r.__monthlyValue;
      if (at(due, previousStart, previousEnd)) previous.periodRecurring += r.__monthlyValue;
      add(monthly, due, 'recurring', r.__monthlyValue, start, end);
      add(projection, due, 'recurring', r.__monthlyValue, projectionStart, projectionEnd);
    }
    addDetail('periodRecurring', r, recurring);
  }
  for (const r of open) {
    addDetail(r.__monthly ? 'recurringPipelineMonthly' : 'oneTimePipeline', r, r.__monthly ? r.__monthlyValue : r.__value);
    if (r.__monthly) addDetail('recurringPipelineTotal', r, r.__value);
    if (!r.__expected || r.__expected <= end) continue;
    const weight = r.__probability / 100;
    add(projection, r.__expected, 'potential', (r.__monthly ? r.__setup : r.__value) * weight, projectionStart, projectionEnd);
    if (r.__monthly) {
      for (let i = 0; i < Math.min(r.__months, 13); i++) {
        const due = installment(r.__expected, i);
        if (due > projectionEnd) break;
        add(projection, due, 'potential', r.__monthlyValue * weight, projectionStart, projectionEnd);
      }
    }
  }
  const current = { activeMrr: sum(details.activeMrr, 'amount'), periodRecurring: sum(details.periodRecurring, 'amount'), periodOneTime: sum(details.periodOneTime, 'amount') };
  current.total = round(current.periodRecurring + current.periodOneTime);
  previous.total = previous.periodRecurring + previous.periodOneTime;
  const comparison = Object.fromEntries(Object.entries(current).map(([k, value]) => [k, { current: value, previous: round(previous[k]), delta: round(value - previous[k]), percent: previous[k] > 0 ? round((value - previous[k]) / previous[k] * 100) : null }]));
  const finish = buckets => buckets.map(b => ({ ...b, recurring: round(b.recurring), products: round(b.products), setup: round(b.setup), potential: round(b.potential), total: round(b.recurring + b.products + b.setup) }));
  return {
    comparison: { available: period !== 'all', start: key(previousStart), end: key(previousEnd), days: Math.round((end - start) / DAY) + 1, metrics: comparison },
    breakdown: { products: sum(details.periodProducts, 'amount'), setup: sum(details.periodSetup, 'amount') },
    details, monthly: finish(monthly), projection: finish(projection),
    projectionPeriod: { start: key(projectionStart), end: key(projectionEnd) },
    expirations: { rows: expirationRows.sort((a, b) => a.days - b.days), bands: [30, 60, 90].map(days => ({ days, count: expirationRows.filter(r => r.days <= days).length, monthlyRevenue: sum(expirationRows.filter(r => r.days <= days), 'amount') })) },
    exclusions: { undatedWins: won.filter(r => !r.__closed).length, unscheduledOpen: open.filter(r => !r.__expected || r.__expected <= end).length }
  };
}
