const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const portfolio = [
  { id: 'monthly', title: 'Backup mensal', ownerId: 'nilton', stage: 'QUALIFICATION', value: 54000,
    projectType: 'SINGLE', monthlyValue: null, projectMonths: null, contractMonths: null,
    revenueType: 'MENSAL', contractPeriodMonths: 12, monthlyRecurringValue: 4500, totalContractValue: 54000,
    leadEntryDate: '2026-10-21', actualCloseDate: null, probability: 50 },
  { id: 'one-time', title: 'Backup pontual', ownerId: 'nilton', stage: 'QUALIFICATION', value: 15000,
    projectType: 'SINGLE', installationFee: 2500, revenueType: null,
    leadEntryDate: '2026-10-20', actualCloseDate: null, probability: 50 }
];
const now = new Date('2026-10-21T15:00:00Z');
const expected = { activeMrr: 0, periodRecurring: 0, periodOneTime: 0,
  recurringPipelineMonthly: 4500, recurringPipelineTotal: 54000, oneTimePipeline: 17500, undatedWins: 0 };

const apiRoots = process.env.B2B_REVENUE_RUNTIME ? [process.env.B2B_REVENUE_RUNTIME] : ['backend', 'apps/api'];
for (const base of apiRoots) {
  const analytics = import(`../../${base}/lib/b2bDashboardAnalytics.js`);
  test(`${base}: explicit monthly revenue overrides legacy SINGLE and open deals are not won revenue`, async () => {
    const { buildB2BDashboardAnalytics } = await analytics;
    const result = buildB2BDashboardAnalytics(portfolio, { now, period: 'year' });
    assert.deepEqual(result.revenue, expected);
    assert.equal(result.kpis.pipelineValue, 71500);
    assert.equal(result.kpis.totalOpportunities, 2);
  });

  test(`${base}: won and lost monthly contracts are separated from the open portfolio`, async () => {
    const { buildB2BDashboardAnalytics } = await analytics;
    const won = portfolio.map(row => ({ ...row, stage: 'WON', actualCloseDate: '2026-10-01' }));
    const result = buildB2BDashboardAnalytics(won, { now, period: 'year' });
    assert.deepEqual(result.revenue, { activeMrr: 4500, periodRecurring: 4500, periodOneTime: 17500,
      recurringPipelineMonthly: 0, recurringPipelineTotal: 0, oneTimePipeline: 0, undatedWins: 0 });
    assert.deepEqual(buildB2BDashboardAnalytics(portfolio.map(row => ({ ...row, stage: 'LOST' })), { now }).revenue,
      { ...expected, recurringPipelineMonthly: 0, recurringPipelineTotal: 0, oneTimePipeline: 0 });
  });

  test(`${base}: B2B API selects persisted revenue fields and returns the same breakdown`, async () => {
    const { buildB2BDashboardAnalytics } = await analytics;
    let query;
    const prisma = { company: { count: async () => 1 }, opportunity: {
      count: async () => portfolio.length, groupBy: async () => [],
      findMany: async args => {
        query = args;
        return portfolio.map(row => Object.fromEntries(Object.keys(args.select).map(key => [key, row[key]])));
      }
    } };
    const file = `${base}/api/dashboard.js`;
    const source = fs.readFileSync(file, 'utf8').replace(/^import .*;\n/gm, '')
      .replace('export default async function handler', 'return async function handler');
    const handler = new Function('prisma', 'getTenantCompanyId', 'buildB2BDashboardAnalytics', source)(
      prisma, user => user.tenantCompanyId,
      (rows, options) => buildB2BDashboardAnalytics(rows, { ...options, now })
    );
    const response = await handler({ method: 'GET', query: { type: 'b2b', ownerId: 'nilton', period: 'year' },
      user: { userId: 'master', role: 'MASTER', tenantCompanyId: 'tenant-1' } });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).revenue, expected);
    assert.equal(query.where.ownerId, 'nilton');
    assert.equal(query.where.tenantCompanyId, 'tenant-1');
    for (const field of ['revenueType', 'monthlyRecurringValue', 'contractPeriodMonths', 'totalContractValue', 'totalProductsValue', 'setupValue']) {
      assert.equal(query.select[field], true, `Missing financial field: ${field}`);
    }
  });
}
