const test = require('node:test');
const assert = require('node:assert/strict');
const load = () => import('../../apps/web/src/components/executiveModuleMetrics.mjs');

test('module cards reconcile contract composition and deduplicate shared clients', async () => {
  const {buildExecutiveModuleMetrics} = await load();
  const m=buildExecutiveModuleMetrics({
    companiesB2B:[{id:'a',status:'ACTIVE'},{id:'b',status:'INACTIVE'}],companiesB2G:[{id:'a',status:'ACTIVE'}],
    contractsRange:[{value:100,status:'ACTIVE'},{value:50,status:'RENEWAL_PENDING'},{value:25,status:'AWAITING_SIGNATURE'},{value:0,status:'ACTIVE'}]
  });
  assert.equal(m.clients,2);
  assert.equal(m.activeClientPercent,50);
  assert.equal(m.portfolio,175);
  assert.deepEqual(m.contractGroups.map(group=>group.value),[100,50,25]);
});

test('GovFlow counts only live deadlines in the next 30 calendar days', async () => {
  const {buildExecutiveModuleMetrics} = await load();
  const m=buildExecutiveModuleMetrics({b2gNoticesRange:[
    {status:'MONITORANDO',proposalDueDate:'2026-11-18T12:00:00'},
    {status:'ANALISE_EM_ANDAMENTO',proposalDueDate:'2026-12-18T20:00:00'},
    {status:'GANHO',proposalDueDate:'2026-11-20'},
    {status:'CANCELADA',proposalDueDate:'2026-11-20'},
    {status:'MONITORANDO',proposalDueDate:'2026-12-19'},
    {status:'MONITORANDO',proposalDueDate:'2026-11-17'},
    {status:'MONITORANDO',proposalDueDate:'invalid',openingDate:'2026-11-19'}
  ]},new Date('2026-11-18T12:00:00'));
  assert.equal(m.notices,7);
  assert.equal(m.inAnalysis,1);
  assert.equal(m.expiring,3);
});

test('pre-sales trend and completion use real request status and entry dates', async () => {
  const {buildExecutiveModuleMetrics} = await load();
  const m=buildExecutiveModuleMetrics({buckets:[{key:'2026-10'},{key:'2026-11'}],preSalesRange:[
    {createdAt:'2026-10-10T12:00:00',status:'FINALIZADA'},
    {createdAt:'2026-11-10T12:00:00',status:'NOVA'},
    {createdAt:'invalid',status:'NOVA'}
  ]});
  assert.deepEqual(m.monthlyPreSales,[1,1]);
  assert.equal(m.completed,1);
  assert.equal(m.requests,3);
  assert.ok(Math.abs(m.completionRate-100/3)<1e-10);
  const empty=buildExecutiveModuleMetrics();
  assert.equal(empty.completionRate,0);
  assert.equal(empty.activeClientPercent,0);
  assert.equal(empty.portfolio,0);
});
