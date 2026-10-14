'use strict';
// Read-only checks. Tokens are short-lived and never printed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const target = process.argv[2] || '/var/www/crmnexointegrator_3026';
const base = process.argv[3] || 'https://nexos.chorstconsult.com.br';
const backendRequire = createRequire(`${target}/backend/package.json`);
backendRequire('dotenv').config({ path: `${target}/.env` });
const connection = new URL(process.env.DATABASE_URL);
assert.equal(connection.pathname, '/nexoscrm');
assert.equal(connection.port, '5433');
const { PrismaClient } = backendRequire('@prisma/client');
const prisma = new PrismaClient();
const jwt = backendRequire('jsonwebtoken');
const select = {
  id: true, title: true, stage: true, value: true, probability: true, ownerId: true, companyId: true,
  leadEntryDate: true, createdAt: true, updatedAt: true, actualCloseDate: true, exitDate: true,
  expectedCloseDate: true, projectTower: true, projectClientType: true, source: true, leadSourceDetail: true,
  company: { select: { id: true, name: true } }, owner: { select: { id: true, name: true } }
};
const tokenFor = user => jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '20m' });
const read = async (token, params) => {
  const response = await fetch(`${base}/api/dashboard?${new URLSearchParams({ type: 'b2b', ...params })}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000)
  });
  assert.equal(response.status, 200, 'Dashboard must answer successfully');
  const result = await response.json();
  assert.ok(!/(password|refreshToken|JWT_SECRET|DATABASE_URL)/i.test(JSON.stringify(result)), 'Response must not contain credentials');
  return result;
};
(async () => {
  try {
    const { buildB2BDashboardAnalytics } = await import(pathToFileURL(`${target}/backend/lib/b2bDashboardAnalytics.js`));
    const users = await prisma.user.findMany({ select: { id: true, role: true, tenantCompanyId: true, accessB2B: true, name: true, email: true } });
    const master = users.find(user => user.role === 'MASTER' && user.accessB2B);
    assert.ok(master, 'An existing master account is required for full-portfolio validation');
    const token = tokenFor(master);
    const rows = await prisma.opportunity.findMany({ where: { b2gStage: null, company: { clientType: 'B2B' } }, select });
    let baseline;
    for (const period of ['30d', 'month', 'quarter', '6', 'year', 'all']) {
      const result = await read(token, { period });
      const expected = buildB2BDashboardAnalytics(rows, { period });
      for (const field of ['totalOpportunities', 'openOpportunities', 'pipelineValue', 'weightedPipelineValue', 'newOpportunities', 'periodWon', 'periodLost', 'periodRevenue', 'pipelineTemperature', 'unpricedOpportunities', 'overdueOpportunities', 'unscheduledOpportunities']) {
        assert.equal(result.kpis[field], expected.kpis[field], `Calculation differs: ${period}/${field}`);
      }
      assert.equal(result.opportunities.length, rows.length, 'The API must return the complete portfolio');
      assert.equal(result.charts.timeline.length, expected.charts.timeline.length);
      assert.deepEqual(result.charts.forecast, expected.charts.forecast);
      if (period === 'year') baseline = result;
    }
    const owner = rows.find(row => row.ownerId)?.ownerId;
    if (owner) {
      const filtered = await read(token, { ownerId: owner, temperature: '25', period: 'year' });
      const expected = rows.filter(row => row.ownerId === owner && row.probability >= 1 && row.probability <= 25);
      assert.deepEqual(filtered.opportunities.map(row => row.id).sort(), expected.map(row => row.id).sort());
    }
    const roles = [];
    for (const role of ['SELLER', 'USER', 'ADMIN', 'MANAGER']) {
      const user = users.find(user => user.role === role && user.accessB2B);
      if (!user) continue;
      const restricted = ['SELLER', 'USER'].includes(role);
      const scope = { b2gStage: null, company: { clientType: 'B2B' }, tenantCompanyId: user.tenantCompanyId || null, ...(restricted ? { ownerId: user.id } : { ownerId: owner }) };
      const expected = await prisma.opportunity.findMany({ where: scope, select: { id: true } });
      const result = await read(tokenFor(user), { ownerId: owner, period: 'year' });
      assert.deepEqual(result.opportunities.map(row => row.id).sort(), expected.map(row => row.id).sort(), `${role} scope is incorrect`);
      roles.push(role);
    }
    const unauthenticated = await fetch(`${base}/api/dashboard?type=b2b`);
    assert.equal(unauthenticated.status, 401);
    fs.writeFileSync('/tmp/nexos-b2b-validation-session.json', JSON.stringify({ token, user: { ...master, actualRole: master.role, accessB2G: true } }), { mode: 0o600 });
    console.log(JSON.stringify({ status: 'passed', periods: 6, roles, records: rows.length, kpis: baseline.kpis }));
  } finally { await prisma.$disconnect(); }
})().catch(() => { console.error('Production B2B calculation/permission validation failed'); process.exitCode = 1; });
