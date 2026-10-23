const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { splitFinancialRevenue: split, financialRevenueAnalysis: analysis, financialSegment, financialStages } = require('../../backend/lib/financial-revenue.cjs');

test('monthly contract keeps monthly, term and setup in separate units', () => {
  const row = split({ revenueType: 'MENSAL', contractPeriodMonths: 12, monthlyRecurringValue: 1000, setupValue: 500, value: 999 });
  assert.equal(row.recurringMonthly, 1000);
  assert.equal(row.recurringTotal, 12000);
  assert.equal(row.oneTime, 500);
  assert.equal(row.total, 12500);
  assert.equal(row.kind, 'Mensal + pontual');
});

test('one-time products and setup are counted once and explicit zero is respected', () => {
  const row = split({ revenueType: 'PONTUAL', totalProductsValue: 1800, setupValue: 250, value: 2050 });
  assert.equal(row.total, 2050);
  assert.equal(row.recurringMonthly, 0);
  assert.equal(split({ revenueType: 'MENSAL', contractPeriodMonths: 12, monthlyRecurringValue: 0, value: 999 }).total, 0);
});

test('legacy contracts derive monthly values only when the term is known', () => {
  assert.equal(split({ projectType: 'MONTHLY', contractMonths: 24, value: 4800 }).recurringMonthly, 200);
  const incomplete = split({ projectType: 'MONTHLY', value: 4800 });
  assert.equal(incomplete.recurringMonthly, 0);
  assert.equal(incomplete.recurringTotal, 4800);
  assert.equal(incomplete.incomplete, true);
});

test('B2G supports mixed monthly and one-time revenue stored in the description', () => {
  const row = split({ b2gStage: 'analise', value: 999, description: JSON.stringify({ valorEstimadoMensal: 100, prazoContratual: 24, valorEstimadoPontual: 50 }) });
  assert.equal(row.recurringMonthly, 100);
  assert.equal(row.recurringTotal, 2400);
  assert.equal(row.oneTime, 50);
  assert.equal(row.total, 2450);
  assert.equal(financialSegment({ number: 'B2G-123', company: { clientType: 'B2B' } }), 'B2G');
  assert.equal(split({ company: { clientType: 'B2G' }, description: { estimatedMonthlyValue: 200, contractTermMonths: 3, estimatedOneTimeValue: 100 } }).total, 700);
  const inferred = split({ company: { clientType: 'B2G' }, description: { contractType: 'MENSAL', estimatedValue: 2450, contractTermMonths: 24, estimatedOneTimeValue: 50 } });
  assert.equal(inferred.recurringMonthly, 100);
  assert.equal(inferred.total, 2450);
});

test('unknown legacy values remain visible without being labelled one-time', () => {
  const row = split({ value: 900, description: 'Texto livre' });
  assert.equal(row.unclassified, 900);
  assert.equal(row.oneTime, 0);
  assert.equal(row.total, 900);
  assert.equal(row.kind, 'Não classificada');
});

const fixtures = [
  { id: 'won-b2b', title: 'Link', stage: 'WON', company: { clientType: 'B2B' }, revenueType: 'MENSAL', monthlyRecurringValue: 100, contractPeriodMonths: 12, setupValue: 50 },
  { id: 'won-b2g', title: 'Governo', stage: 'PROPOSAL', b2gStage: 'ganho', description: JSON.stringify({ valorEstimadoMensal: 200, prazoContratual: 24, valorEstimadoPontual: 150 }) },
  { id: 'open', title: 'Venda', stage: 'LEAD', company: { clientType: 'B2B' }, revenueType: 'PONTUAL', totalProductsValue: 300, setupValue: 20 },
  { id: 'lost', stage: 'LOST', value: 99999 }
];

test('won, open and lost are separate and component totals reconcile', () => {
  const result = analysis(fixtures);
  assert.equal(result.won.recurringMonthly, 300);
  assert.equal(result.won.recurringTotal, 6000);
  assert.equal(result.won.oneTime, 200);
  assert.equal(result.won.total, 6200);
  assert.equal(result.open.total, 320);
  assert.equal(result.wonBySegment.reduce((s, row) => s + row.total, 0), result.won.total);
  assert.equal(financialStages(fixtures, 'B2B').find(row => row.estagio === 'LEAD').oneTime, 320);
});

test('backend and apps/api use identical revenue normalization', () => {
  assert.equal(fs.readFileSync('backend/lib/financial-revenue.cjs', 'utf8'), fs.readFileSync('apps/api/lib/financial-revenue.cjs', 'utf8'));
});

for (const filename of ['backend/api/financial-analysis.js', 'apps/api/api/financial-analysis.cjs']) {
  test(`${filename} returns reconciled cards, charts and opportunity details`, async () => {
    let handler, response, query;
    const model = { findMany: async () => [] };
    const prisma = { opportunity: { findMany: async input => { query = input; return fixtures; } }, commission: model, simulatorProposal: model };
    vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
      require(name) {
        if (name === 'express') return { Router: () => ({ get(_path, callback) { handler = callback; } }) };
        if (name.includes('/prisma')) return { prisma };
        if (name.includes('chorst-privacy')) return { canAccessChorstData: () => false, CHORST_EMAIL: 'private@example.test' };
        return require(path.resolve(path.dirname(filename), name));
      }, module: { exports: {} }, console
    });
    await handler({ query: { periodo: 'ano', vendedor: 'Maria' }, user: {} }, { json(body) { response = body; }, status(code) { throw new Error(`Unexpected HTTP ${code}`); } });
    assert.equal(response.geral.receita_realizada, 6200);
    assert.equal(response.b2b.receita_realizada, 1250);
    assert.equal(response.b2g.receita_realizada, 4950);
    assert.equal(response.geral.revenue.won.total, response.geral.receita_realizada);
    assert.equal(response.b2b.estagios.find(row => row.estagio === 'LEAD').valor, 320);
    assert.equal(response.b2g.tabela_oportunidades[0].recurringMonthly, 200);
    assert.equal(response.b2g.tabela_oportunidades[0].oneTime, 150);
    assert.equal(query.owner, undefined);
    assert.equal(query.where.owner.email.not, 'private@example.test');
    assert.equal(query.where.owner.name.contains, 'Maria');
    assert.ok(query.where.createdAt.gte instanceof Date || query.where.createdAt.gte.toISOString());
    assert.equal(response.simulador.valor_total_estimado, 0);
  });
}
