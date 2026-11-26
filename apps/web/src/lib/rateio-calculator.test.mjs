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

// Cenario 4 alvos com quantidades diferentes de componentes (4, 2, 3, 1) + locacao mensal
const fourTargets = [
  { sku: 'A1', desc: 'Alvo 1', ncm: '0000', custo: 1000, preco: 1000, qty: 2, un: '/mês' },
  { sku: 'A2', desc: 'Alvo 2', ncm: '0000', custo: 500, preco: 500, qty: 1, un: '/mês' },
  { sku: 'A3', desc: 'Alvo 3', ncm: '0000', custo: 800, preco: 800, qty: 4, un: '/mês' },
  { sku: 'A4', desc: 'Alvo 4', ncm: '0000', custo: 300, preco: 300, qty: 1, un: '/mês' },
];
const tenComponents = [
  { sku: 'C1', desc: 'Comp 1', ncm: '0000', custo: 100, preco: 100, qty: 1, un: 'UN' },
  { sku: 'C2', desc: 'Comp 2', ncm: '0000', custo: 200, preco: 200, qty: 1, un: 'UN' },
  { sku: 'C3', desc: 'Comp 3', ncm: '0000', custo: 150, preco: 150, qty: 2, un: 'UN' },
  { sku: 'C4', desc: 'Comp 4', ncm: '0000', custo: 50, preco: 50, qty: 1, un: 'UN' },
  { sku: 'C5', desc: 'Comp 5', ncm: '0000', custo: 300, preco: 300, qty: 1, un: 'UN' },
  { sku: 'C6', desc: 'Comp 6', ncm: '0000', custo: 100, preco: 100, qty: 2, un: 'UN' },
  { sku: 'C7', desc: 'Comp 7', ncm: '0000', custo: 400, preco: 400, qty: 1, un: 'UN' },
  { sku: 'C8', desc: 'Comp 8', ncm: '0000', custo: 200, preco: 200, qty: 1, un: 'UN' },
  { sku: 'C9', desc: 'Comp 9', ncm: '0000', custo: 200, preco: 200, qty: 1, un: 'UN' },
  { sku: 'C10', desc: 'Comp 10', ncm: '0000', custo: 250, preco: 250, qty: 1, un: 'UN' },
];
const fourResult = calcRateio([...fourTargets, ...tenComponents], [], {}, [...fourTargets, ...tenComponents], {
  targetSkus: ['A1', 'A2', 'A3', 'A4'],
  sourceSkus: tenComponents.map(c => c.sku),
  billingMode: 'mensal',
  periodMonths: 24,
  sourceTargetMap: {
    C1: ['A1'], C2: ['A1'], C3: ['A1'], C4: ['A1'], // 4 componentes -> 100+200+300+50 = 650
    C5: ['A2'], C6: ['A2'],                         // 2 componentes -> 300+200 = 500
    C7: ['A3'], C8: ['A3'], C9: ['A3'],             // 3 componentes -> 400+200+200 = 800
    C10: ['A4'],                                    // 1 componente  -> 250
  },
});
const a1 = fourResult.results.find(r => r.prod.sku === 'A1');
const a2 = fourResult.results.find(r => r.prod.sku === 'A2');
const a3 = fourResult.results.find(r => r.prod.sku === 'A3');
const a4 = fourResult.results.find(r => r.prod.sku === 'A4');
assert.equal(a1.sourceCostTotal, 650);
assert.equal(a1.novoCusto, 1325); // 1000 + (650 / 2)
assert.equal(a2.sourceCostTotal, 500);
assert.equal(a2.novoCusto, 1000); // 500 + 500
assert.equal(a3.sourceCostTotal, 800);
assert.equal(a3.novoCusto, 1000); // 800 + (800 / 4)
assert.equal(a4.sourceCostTotal, 250);
assert.equal(a4.novoCusto, 550);  // 300 + 250
assert.equal(fourResult.billing.billingType, 'mensal');
assert.equal(fourResult.billing.periodMonths, 24);
assert.equal(fourResult.billing.recurringTotal, 1325 * 2 + 1000 + 1000 * 4 + 550);
assert.equal(fourResult.billing.contractTotal, fourResult.billing.recurringTotal * 24);

console.log('rateio-calculator: ok');
