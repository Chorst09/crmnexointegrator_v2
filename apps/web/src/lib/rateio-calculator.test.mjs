import assert from 'node:assert/strict';
import { calcRateio, validateCompositionSelection } from './rateio-calculator.mjs';

const targets = Array.from({ length: 4 }, (_, index) => ({
  sku: `ALVO-${index + 1}`,
  desc: `Produto alvo ${index + 1}`,
  ncm: '0000.00.00',
  custo: 1000 + index * 250,
  preco: 1800 + index * 300,
  qty: 1,
  un: '/mês',
  operationType: 'locacao',
  period: 36,
}));

const components = Array.from({ length: 24 }, (_, index) => ({
  sku: `COMP-${String(index + 1).padStart(2, '0')}`,
  desc: `Componente ${index + 1}`,
  ncm: '0000.00.00',
  custo: 80 + index * 5,
  preco: 120 + index * 6,
  qty: (index % 3) + 1,
  un: 'UN',
}));

const expenses = [
  { tipo: 'Frete', desc: 'Frete projeto', valor: 1500, metodo: 'custo', pagador: 'Proprio', conta: '3.1.01.01' },
  { tipo: 'Seguro', desc: 'Seguro projeto', valor: 350, metodo: 'venda', pagador: 'Proprio', conta: '3.1.01.02' },
];

const items = [...targets, ...components];
const composition = {
  targetSkus: targets.map(item => item.sku),
  sourceSkus: components.map(item => item.sku),
};
const result = calcRateio(items, expenses, {}, items, composition);

assert.equal(result.ok, true);
assert.equal(result.compositionTotals.targetCount, 4);
assert.equal(result.compositionTotals.sourceCount, 24);
assert.equal(result.billing.billingType, 'mensal');
assert.equal(result.billing.periodMonths, 36);
assert.equal(result.results.filter(item => item.compositionRole === 'target').length, 4);
assert.equal(result.results.filter(item => item.compositionRole === 'source').length, 24);

const totalExpenses = expenses.reduce((sum, expense) => sum + expense.valor, 0);
const sourceCostTotal = components.reduce((sum, item) => sum + item.custo * item.qty, 0);
const targetOwnCostTotal = targets.reduce((sum, item) => sum + item.custo * item.qty, 0);
const finalTargetTotal = result.results
  .filter(item => item.compositionRole === 'target')
  .reduce((sum, item) => sum + item.novoCusto * item.prod.qty, 0);

assert.ok(Math.abs(result.somaCheck - totalExpenses) < 0.02);
assert.ok(Math.abs(result.compositionTotals.sourceCostTotal - sourceCostTotal) < 0.02);
assert.ok(Math.abs(result.compositionTotals.finalTargetCostTotal - (targetOwnCostTotal + sourceCostTotal + totalExpenses)) < 0.02);
assert.ok(Math.abs(finalTargetTotal - result.compositionTotals.finalTargetCostTotal) < 0.02);
assert.ok(Math.abs(result.billing.contractTotal - result.billing.recurringTotal * 36) < 0.02);

const pontualResult = calcRateio(
  items.map(item => ({ ...item, un: 'UN', operationType: 'venda', period: 0 })),
  expenses,
  {},
  items.map(item => ({ ...item, un: 'UN', operationType: 'venda', period: 0 })),
  composition,
);

assert.equal(pontualResult.billing.billingType, 'pontual');
assert.equal(pontualResult.billing.contractTotal, 0);
assert.ok(pontualResult.billing.oneTimeTotal > 0);

assert.deepEqual(validateCompositionSelection({ targetItems: targets, sourceItems: components }), []);
assert.deepEqual(validateCompositionSelection({ targetItems: targets.slice(0, 2), sourceItems: components }), []);
assert.ok(validateCompositionSelection({ targetItems: [], sourceItems: components }).some(issue => issue.includes('ao menos 1 produto alvo')));

// Cenario especifico: 2 produtos alvo com vinculacao 1-para-1 de componentes
const fwItems = [
  { sku: 'FW-40F', desc: 'Firewall 40F', ncm: '0000', custo: 5559.18, preco: 5559.18, qty: 1, un: 'UN' },
  { sku: 'LIC-FW', desc: 'Licenciamento Firewall e SD WAN', ncm: '0000', custo: 2164.80, preco: 2164.80, qty: 1, un: 'UN' },
  { sku: 'U6-AP', desc: 'UBIQUITI U6+ UNIFI AP AC WIFI6', ncm: '0000', custo: 3640.00, preco: 3640.00, qty: 3, un: 'UN' },
  { sku: 'MK-RB', desc: 'MIKROTIK ROUTERBOARD RB4011IGS+RM', ncm: '0000', custo: 1562.64, preco: 1562.64, qty: 1, un: 'UN' },
];
const mappedResult = calcRateio(fwItems, [], {}, fwItems, {
  targetSkus: ['FW-40F', 'U6-AP'],
  sourceSkus: ['LIC-FW', 'MK-RB'],
  sourceTargetMap: {
    'LIC-FW': ['FW-40F'],
    'MK-RB': ['U6-AP'],
  },
});
const fwRow = mappedResult.results.find(r => r.prod.sku === 'FW-40F');
const u6Row = mappedResult.results.find(r => r.prod.sku === 'U6-AP');
assert.equal(fwRow.sourceCostTotal, 2164.80);
assert.equal(fwRow.novoCusto, 7723.98);
assert.deepEqual(fwRow.composedSourceSkus, ['LIC-FW']);
assert.equal(u6Row.sourceCostTotal, 1562.64);
assert.equal(u6Row.novoCusto, 4160.88);
assert.deepEqual(u6Row.composedSourceSkus, ['MK-RB']);

console.log('rateio-calculator: ok');
