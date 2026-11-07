import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = (await readFile(new URL('../../apps/web/src/utils/preSalesBudgetPrint.js', import.meta.url), 'utf8'))
  .replace("import { logCostAccessAudit } from './auditLogger';", 'const logCostAccessAudit = () => {};');
const { buildPreSalesBudgetPrintHtml } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const proposal = {
  number: 'ORC-0002-2026',
  pricing: { rentalPeriod: 36, desiredMargin: 42 },
  result: { finalPrice: 66777.336, monthlyPrice: 1756.427, baseCost: 987654 },
  snapshot: {
    saleItems: [{ description: 'Venda', quantity: 2, unitCost: 999999, calculation: { rbUnitario: 100.125 } }],
    rentalItems: [{ description: '<Firewall>', quantity: 3, unitCost: 999999, calculation: { rbUnitario: 316.4 } }],
    serviceItems: [{ description: 'Setup', estimatedHours: 16, calculation: { sellPricePerHour: 221.62, totalSellPrice: 3545.97, totalCost: 999999 } }]
  }
};
const request = {
  items: [{ descricao: 'Item original sem preço', quantidade: 1, precoSugerido: 0 }],
  calculoDetalhes: {
    propostaPrecificada: proposal,
    propostasPrecificadas: [{ number: 'VERSAO-ANTIGA' }],
    cotacoes: [{ distribuidor: 'DISTRIBUIDOR-SECRETO', itens: [{ custoUnitario: 999999, quantidade: 1 }] }]
  }
};
test('commercial PDF shows priced sales, rental periods, quantities and service hours without internal costs', () => {
  const html = buildPreSalesBudgetPrintHtml(request, { hideCosts: true });
  for (const expected of ['Itens — Venda', 'Itens — Locação', 'Itens — Serviços', '&lt;Firewall&gt;', '34.171,20', '16h', '221,62', '3.545,97', '66.777,34', '1.756,43']) assert.ok(html.includes(expected), expected);
  for (const hidden of ['Item original sem preço', 'DISTRIBUIDOR-SECRETO', '999.999', '987.654', 'Custo Base', 'Margem', 'VERSAO-ANTIGA']) assert.ok(!html.includes(hidden), hidden);
});
test('legacy proposal without snapshot does not invent zero sale prices or expose costs', () => {
  const html = buildPreSalesBudgetPrintHtml({ items: request.items, calculoDetalhes: { propostaPrecificada: { result: { finalPrice: 10 } } } }, { hideCosts: true });
  assert.ok(html.includes('Detalhamento dos itens precificados não disponível'));
  assert.ok(!html.includes('Item original sem preço'));
});
test('internal report retains distributor cost section', () => {
  const html = buildPreSalesBudgetPrintHtml(request, { hideCosts: false });
  assert.ok(html.includes('DISTRIBUIDOR-SECRETO'));
  assert.ok(html.includes('Custo Base'));
});

test('rental row includes unit monthly and monthly total for three units, followed by separate billing totals', () => {
  const html = buildPreSalesBudgetPrintHtml(request, { hideCosts: true });
  assert.ok(html.includes('Unitário mensal'));
  assert.ok(html.includes('Total mensal'));
  const rentalRow = html.match(/<tr><td[^>]*>&lt;Firewall&gt;[\s\S]*?<\/tr>/)[0];
  for (const value of ['316,40', '949,20', '36', '34.171,20']) assert.ok(rentalRow.includes(value), value);
  const summary = html.slice(html.indexOf('Resumo de valores mensais e pontuais'));
  for (const value of ['949,20', '200,25', '3.545,97', '3.746,22']) assert.ok(summary.includes(value), value);
  assert.ok(html.indexOf('Resumo de valores mensais e pontuais') > html.indexOf('Proposta Precificada'));
});

test('monthly services appear in monthly summary and contract total, while legacy services remain punctual', () => {
  const monthly = structuredClone(request);
  monthly.calculoDetalhes.propostaPrecificada.snapshot.serviceItems.push({ description: 'Suporte mensal', billingType: 'MENSAL', servicePeriod: 36, estimatedHours: 12, calculation: { sellPricePerHour: 214.5325, totalSellPrice: 2574.39 } });
  const html = buildPreSalesBudgetPrintHtml(monthly, { hideCosts: true });
  const row = html.match(/<tr><td[^>]*>Suporte mensal[\s\S]*?<\/tr>/)[0];
  for (const expected of ['Mensal', '12h', '2.574,39', '36', '92.678,04']) assert.ok(row.includes(expected), expected);
  const summary = html.slice(html.indexOf('Resumo de valores mensais e pontuais'));
  for (const expected of ['3.523,59', '3.746,22', '2.574,39', '3.545,97']) assert.ok(summary.includes(expected), expected);
});

test('service calculator counts monthly revenue once and multiplies contract revenue and costs by months', async () => {
  const calculatorSource = await readFile(new URL('../../apps/web/src/pages/Calculadoras.jsx', import.meta.url), 'utf8');
  const helpers = calculatorSource.slice(calculatorSource.indexOf('const CALCULATOR_SETTINGS_STORAGE_KEY'), calculatorSource.indexOf('export default function Calculadoras'));
  const { calculateOperation } = await import(`data:text/javascript;base64,${Buffer.from(helpers + '\nexport { calculateOperation };').toString('base64')}`);
  const result = calculateOperation({
    operationType: 'servicos', activeRegimeId: 'LUCRO_PRESUMIDO',
    regimes: [{ id: 'LUCRO_PRESUMIDO', nome: 'Lucro Presumido', pis: 0, cofins: 0, iss: 0, irpj: 0, csll: 0 }],
    outrosCustos: { comissaoServico: 0, despesasAdmin: 0, outrasDespesas: 0 },
    laborCostConfig: { geral: { diasUteis: 20, horasDia: 8 }, encargos: {}, beneficios: {} },
    serviceItems: [
      { id: 'monthly', baseSalary: 1600, estimatedHours: 10, billingType: 'MENSAL', servicePeriod: 36 },
      { id: 'once', baseSalary: 1600, estimatedHours: 2, billingType: 'PONTUAL' }
    ], desiredMargin: 0, saleItems: [], rentalItems: []
  }).calculationResults;
  assert.equal(result.monthlyPrice, 100);
  assert.equal(result.finalPrice, 3620);
  assert.equal(result.baseCost, 3620);
});
