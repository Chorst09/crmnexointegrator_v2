const number = (value) => Number(value) || 0;
export const summarizeCalculatorSnapshot = (snapshot = {}) => {
  const result = { finalPrice: 0, monthlyPrice: 0, baseCost: 0, impostosValor: 0, margemEComissaoValor: 0 };
  for (const item of snapshot.saleItems || []) {
    const qty = number(item.quantity);
    result.finalPrice += number(item.calculation?.rbUnitario) * qty;
    result.baseCost += number(item.unitCost) * qty;
    result.impostosValor += number(item.calculation?.impostosValor) * qty;
    result.margemEComissaoValor += number(item.calculation?.marginComissaoValor) * qty;
  }
  for (const item of snapshot.rentalItems || []) {
    const qty = number(item.quantity);
    const period = Math.max(1, number(item.pricing?.rentalPeriod) || 12);
    const monthly = number(item.calculation?.rbUnitario) * qty;
    result.monthlyPrice += monthly;
    result.finalPrice += monthly * period;
    result.baseCost += number(item.calculation?.monthlyCost) * qty * period;
    result.impostosValor += number(item.calculation?.impostosValor) * qty;
    result.margemEComissaoValor += number(item.calculation?.marginComissaoValor) * qty;
  }
  for (const item of snapshot.serviceItems || []) {
    const monthly = item.billingType === 'MENSAL';
    const period = monthly ? Math.max(1, Math.floor(number(item.servicePeriod) || 12)) : 1;
    const price = number(item.calculation?.totalSellPrice);
    const cost = number(item.calculation?.totalCost);
    if (monthly) result.monthlyPrice += price;
    result.finalPrice += price * period;
    result.baseCost += cost * period;
    result.impostosValor += (price - cost) * period * 0.3;
    result.margemEComissaoValor += (price - cost) * period * 0.7;
  }
  return result;
};
