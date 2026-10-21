const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

// Execute the general dashboard's actual financial reducer without mounting charts.
const page = fs.readFileSync('apps/web/src/pages/DashboardGeral.jsx', 'utf8');
const helpers = page.slice(page.indexOf('const normalizeProjectType ='), page.indexOf('const revenueBreakdownFromNotices ='));
const generalRevenue = new Function('toArray', 'toNumber', 'parseJsonObject', 'MONTHLY_PROJECT_TYPE', `${helpers}\nreturn revenueBreakdownFromOpportunities;`)(
  value => Array.isArray(value) ? value : [],
  value => Number.isFinite(Number(value)) ? Number(value) : 0,
  value => { try { return JSON.parse(value) || {}; } catch { return {}; } },
  'MONTHLY'
);

test('general and B2B dashboards agree on monthly contracts, products and setup', async () => {
  const { buildB2BDashboardAnalytics } = await import('../../apps/api/lib/b2bDashboardAnalytics.js');
  for (const item of [
    { projectType: 'MONTHLY', projectMonths: 24, monthlyValue: 150.5, value: 3612 },
    { revenueType: 'MENSAL', contractPeriodMonths: 24, monthlyRecurringValue: 150.5, totalContractValue: 3612, value: 999 },
    { revenueType: 'PONTUAL', totalProductsValue: 1800, setupValue: 250, value: 999 },
    { projectType: 'SINGLE', value: 1800, installationFee: 250 },
    { projectType: 'MONTHLY', contractMonths: 36, value: 7200 },
    { projectType: 'MONTHLY', projectMonths: 12, monthlyValue: 0, value: 999 },
    { projectType: 'MONTHLY', projectMonths: 12, monthlyValue: '', value: 1200 }
  ]) {
    const row = { stage: 'LEAD', probability: 50, ...item };
    const general = generalRevenue([row]);
    const b2b = buildB2BDashboardAnalytics([row]);
    assert.equal(general.total, b2b.kpis.pipelineValue);
    assert.equal(general.monthly, b2b.revenue.recurringPipelineMonthly);
    assert.equal(general.single, b2b.revenue.oneTimePipeline);
  }
  assert.equal(generalRevenue([{ projectType: 'MONTHLY', projectMonths: 24, monthlyValue: 150.5, value: 3612 }]).total, 3612);
  assert.equal(generalRevenue([{ projectType: 'SINGLE', value: 1800, installationFee: 250 }]).total, 2050);
});

test('B2G monthly and one-time calculations remain intact', () => {
  const result = generalRevenue([{ b2gStage: 'analise', value: 999, description: JSON.stringify({ valorEstimadoMensal: 100, prazoContratual: 24, valorEstimadoPontual: 50 }) }]);
  assert.equal(result.monthly, 100);
  assert.equal(result.contract, 2400);
  assert.equal(result.single, 50);
  assert.equal(result.total, 2450);
});

for (const file of ['apps/api/api/dashboard.js', 'backend/api/dashboard.js']) {
  test(`${file}: general API supplies persisted revenue fields to the dashboard`, async () => {
    const fixture = { id: 'monthly', value: 3612, projectType: 'MONTHLY', projectMonths: 24, contractMonths: 24, monthlyValue: 150.5, installationFee: 0 };
    const queries = [];
    const model = { count: async () => 0, findMany: async () => [], findUnique: async () => null };
    const prisma = new Proxy({}, { get: (_, name) => name === 'opportunity' ? {
      findMany: async query => {
        queries.push(query);
        return query.where.b2gStage === null ? [Object.fromEntries(Object.keys(query.select).map(key => [key, fixture[key]]))] : [];
      }
    } : model });
    const source = fs.readFileSync(file, 'utf8').replace(/^import .*;\n/gm, '').replace('export default async function handler', 'return async function handler');
    const handler = new Function('prisma', 'getTenantCompanyId', source)(prisma, () => 'tenant-qa');
    const response = await handler({ method: 'GET', query: { type: 'general' }, user: {} });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.opportunitiesB2B[0].monthlyValue, 150.5);
    assert.equal(data.opportunitiesB2B[0].contractMonths, 24);
    assert.equal(data.opportunitiesB2B[0].installationFee, 0);
    assert.equal(generalRevenue(data.opportunitiesB2B).total, 3612);
    assert.equal(queries[0].where.tenantCompanyId, 'tenant-qa');
  });
}
