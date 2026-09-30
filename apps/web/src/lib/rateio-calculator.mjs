export const TARGET_PRODUCT_GOAL = 4;
export const COMPONENT_PRODUCT_RECOMMENDATION = 20;

export const D = (value, decimals = 4) => Number((Number(value) || 0).toFixed(decimals));

const itemTotalCost = (item) => D(item.custo * item.qty, 4);
const itemTotalSale = (item) => D(item.preco * item.qty, 4);

const isMonthlyItem = (item) =>
  item?.operationType === 'locacao' ||
  item?.billingType === 'mensal' ||
  item?.un === '/mês';

const billingTypeForItems = (items) =>
  items.some(isMonthlyItem) ? 'mensal' : 'pontual';

const distributeAmount = (buckets, amount, baseFor) => {
  const totalBase = buckets.reduce((sum, bucket) => sum + D(baseFor(bucket), 4), 0);
  if (totalBase <= 0 || buckets.length === 0 || amount === 0) return buckets.map(() => 0);

  let accumulated = 0;
  return buckets.map((bucket, index) => {
    const value = index === buckets.length - 1
      ? D(amount - accumulated, 4)
      : D((D(baseFor(bucket), 4) / totalBase) * amount, 4);
    if (index !== buckets.length - 1) accumulated = D(accumulated + value, 4);
    return value;
  });
};

export function summarizeCompositionBilling(results) {
  const targets = results.filter(item => item.compositionRole === 'target');
  const visible = targets.length > 0 ? targets : results;
  const billingType = billingTypeForItems(visible.map(item => item.prod));
  const periodMonths = Math.max(...visible.map(item => Number(item.prod.period) || 0), 0);
  const monthlyTotal = visible.reduce((sum, item) => sum + D(item.novoCusto * item.prod.qty, 4), 0);

  return {
    billingType,
    periodMonths,
    recurringTotal: billingType === 'mensal' ? monthlyTotal : 0,
    oneTimeTotal: billingType === 'pontual' ? monthlyTotal : 0,
    contractTotal: billingType === 'mensal' && periodMonths > 0 ? D(monthlyTotal * periodMonths, 4) : 0,
  };
}

export function validateCompositionSelection({ targetItems = [], sourceItems = [] }) {
  const issues = [];
  if (targetItems.length !== TARGET_PRODUCT_GOAL) {
    issues.push(`Selecione exatamente ${TARGET_PRODUCT_GOAL} produtos alvo para compor o preço do projeto.`);
  }
  if (sourceItems.length === 0) {
    issues.push('Selecione ao menos um produto componente para compor os alvos.');
  }
  if (sourceItems.length > 0 && sourceItems.length < COMPONENT_PRODUCT_RECOMMENDATION) {
    issues.push(`A composição está com ${sourceItems.length} componente(s); para projetos completos, revise se os mais de ${COMPONENT_PRODUCT_RECOMMENDATION} itens base foram importados/marcados.`);
  }
  return issues;
}

export function calcRateio(items, expenses, manualWeights, scope, composition) {
  const merged = Object.fromEntries(items.map(item => [item.sku, {
    prod: item,
    totalRateado: 0,
    expenseRateado: undefined,
    sourceCostTotal: 0,
    composedSourceSkus: [],
    compositionRole: undefined,
    composedTargetSkus: undefined,
    billingType: isMonthlyItem(item) ? 'mensal' : 'pontual',
  }]));
  const totalExp = D(expenses.reduce((sum, expense) => sum + D(expense.valor, 4), 0), 4);

  expenses.forEach(expense => {
    const baseFor = (item) => {
      if (expense.metodo === 'custo') return itemTotalCost(item);
      if (expense.metodo === 'venda') return itemTotalSale(item);
      if (expense.metodo === 'qty') return D(item.qty, 4);
      return D(manualWeights[item.sku] || 0, 4);
    };

    const allocations = distributeAmount(scope, D(expense.valor, 4), baseFor);
    scope.forEach((item, index) => {
      if (!merged[item.sku]) return;
      merged[item.sku].totalRateado = D(merged[item.sku].totalRateado + allocations[index], 4);
    });
  });

  if (composition) {
    const targetBuckets = composition.targetSkus.map(sku => merged[sku]).filter(Boolean);
    const sourceBuckets = composition.sourceSkus.map(sku => merged[sku]).filter(Boolean);

    if (targetBuckets.length > 0) {
      const sourceCostTotal = D(sourceBuckets.reduce((sum, bucket) => sum + itemTotalCost(bucket.prod), 0), 4);
      const composedExpenseTotal = D(scope.reduce((sum, item) => sum + (merged[item.sku]?.totalRateado || 0), 0), 4);
      const composedTotal = D(sourceCostTotal + composedExpenseTotal, 4);
      const targetCostBase = targetBuckets.reduce((sum, bucket) => sum + itemTotalCost(bucket.prod), 0);
      const baseForTarget = targetCostBase > 0
        ? (bucket) => itemTotalCost(bucket.prod)
        : (bucket) => D(bucket.prod.qty, 4);

      scope.forEach(item => {
        if (!composition.targetSkus.includes(item.sku) && merged[item.sku]) {
          merged[item.sku].totalRateado = 0;
          merged[item.sku].expenseRateado = 0;
          merged[item.sku].compositionRole = composition.sourceSkus.includes(item.sku) ? 'source' : undefined;
          merged[item.sku].composedTargetSkus = composition.targetSkus;
        }
      });

      const totalAllocations = distributeAmount(targetBuckets, composedTotal, baseForTarget);
      const expenseAllocations = distributeAmount(targetBuckets, composedExpenseTotal, baseForTarget);
      const sourceAllocations = distributeAmount(targetBuckets, sourceCostTotal, baseForTarget);

      targetBuckets.forEach((bucket, index) => {
        bucket.totalRateado = totalAllocations[index];
        bucket.expenseRateado = expenseAllocations[index];
        bucket.sourceCostTotal = sourceAllocations[index];
        bucket.composedSourceSkus = composition.sourceSkus;
        bucket.compositionRole = 'target';
        bucket.billingType = billingTypeForItems([bucket.prod, ...sourceBuckets.map(source => source.prod)]);
      });
    }
  }

  let somaCheck = 0;
  const results = Object.values(merged).map(({ prod, totalRateado, expenseRateado, sourceCostTotal, composedSourceSkus, compositionRole, composedTargetSkus, billingType }) => {
    const rat = D(totalRateado, 4);
    const expenseRat = D(expenseRateado ?? totalRateado, 4);
    const ratUnit = prod.qty > 0 ? D(rat / prod.qty, 4) : 0;
    const novoCusto = D(prod.custo + ratUnit, 4);
    const importedMargin = typeof prod.margemProposta === 'number' ? D(prod.margemProposta, 4) : undefined;
    const mgAnt = importedMargin ?? (prod.preco > 0 ? D((prod.preco - prod.custo) / prod.preco, 4) : 0);
    const mgNova = importedMargin ?? (prod.preco > 0 ? D((prod.preco - novoCusto) / prod.preco, 4) : 0);
    const totC = itemTotalCost(prod);
    const totV = itemTotalSale(prod);
    const part = totalExp > 0 ? D(expenseRat / totalExp, 4) : 0;
    somaCheck = D(somaCheck + expenseRat, 4);
    return {
      prod,
      rat,
      expenseRat,
      ratUnit,
      novoCusto,
      mgAnt,
      mgNova,
      totC,
      totV,
      part,
      delta: D(mgNova - mgAnt, 4),
      sourceCostTotal: D(sourceCostTotal || 0, 4),
      composedSourceSkus,
      compositionRole,
      composedTargetSkus,
      billingType,
    };
  });

  const effectiveResults = composition
    ? results.filter(item => item.compositionRole === 'target')
    : results;
  const effectiveTotalVenda = effectiveResults.reduce((sum, item) => sum + item.totV, 0);
  const avgMgAnt = effectiveTotalVenda > 0 ? D(effectiveResults.reduce((sum, item) => sum + item.mgAnt * item.totV, 0) / effectiveTotalVenda, 4) : 0;
  const avgMgNova = effectiveTotalVenda > 0 ? D(effectiveResults.reduce((sum, item) => sum + item.mgNova * item.totV, 0) / effectiveTotalVenda, 4) : 0;
  const diff = D(totalExp - somaCheck, 4);
  const billing = summarizeCompositionBilling(effectiveResults);

  return {
    results,
    avgMgAnt,
    avgMgNova,
    somaCheck,
    totalExp,
    diff,
    ok: Math.abs(diff) < 0.02,
    compositionTotals: composition ? {
      targetCount: effectiveResults.length,
      sourceCount: composition.sourceSkus.length,
      sourceCostTotal: D(effectiveResults.reduce((sum, item) => sum + (item.sourceCostTotal || 0), 0), 4),
      expenseTotal: D(effectiveResults.reduce((sum, item) => sum + item.expenseRat, 0), 4),
      allocatedTotal: D(effectiveResults.reduce((sum, item) => sum + item.rat, 0), 4),
      targetOwnCostTotal: D(effectiveResults.reduce((sum, item) => sum + item.totC, 0), 4),
      finalTargetCostTotal: D(effectiveResults.reduce((sum, item) => sum + D(item.novoCusto * item.prod.qty, 4), 0), 4),
    } : undefined,
    billing,
  };
}
