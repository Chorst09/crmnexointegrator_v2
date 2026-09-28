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
assert.ok(validateCompositionSelection({ targetItems: targets.slice(0, 3), sourceItems: components }).some(issue => issue.includes('exatamente 4')));

console.log('rateio-calculator: ok');
