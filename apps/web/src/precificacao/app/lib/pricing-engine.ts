
export interface ProductItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unitCost: number;
}

export interface PricingInput {
  upfrontItems: ProductItem[];   // Itens de Setup/CAPEX
  recurringItems: ProductItem[]; // Itens Recorrentes/OPEX
  projectBillingMode?: 'standard' | 'monthly';
  durationMonths: number;    
  markupPercentage: number;  
  taxRatePercentage: number; 
  commissionPercentage: number; 
  operatingExpensePercentage?: number;
  taxRegimeName?: string;
}

export interface FinancialStatementLine {
  label: string;
  monthlyValue: number;
  totalValue: number;
  percentageOfRevenue: number;
  isSubtotal?: boolean;
}

export interface PricingOutput {
  totalUpfrontCost: number;
  totalMonthlyRecurringCost: number;
  monthlyAmortization: number;
  baseMonthlyCost: number;
  finalMonthlyPrice: number;
  totalContractValue: number; 
  metrics: {
    roi: number;
    paybackMonths: number;
    ebitda: number;
    ebitdaMargin: number;
    breakEvenMonthlyPrice: number;
  };
  dre: {
    grossRevenue: FinancialStatementLine;
    taxes: FinancialStatementLine;
    netRevenue: FinancialStatementLine;
    cogs: FinancialStatementLine;
    grossProfit: FinancialStatementLine;
    commissions: FinancialStatementLine;
    operatingExpenses: FinancialStatementLine;
    netIncome: FinancialStatementLine;
  };
}

export const getPricingDenominator = (input: Pick<PricingInput, 'markupPercentage' | 'taxRatePercentage' | 'commissionPercentage' | 'operatingExpensePercentage'>) => {
  const targetMarginRate = Math.max(0, input.markupPercentage || 0) / 100;
  const taxRate = Math.max(0, input.taxRatePercentage || 0) / 100;
  const commissionRate = Math.max(0, input.commissionPercentage || 0) / 100;
  const operatingExpenseRate = Math.max(0, input.operatingExpensePercentage || 0) / 100;
  return 1 - targetMarginRate - taxRate - commissionRate - operatingExpenseRate;
};

export const calculateSalePriceFromMonthlyCost = (
  monthlyCost: number,
  input: Pick<PricingInput, 'markupPercentage' | 'taxRatePercentage' | 'commissionPercentage' | 'operatingExpensePercentage'>
) => {
  const safeCost = Math.max(0, Number(monthlyCost) || 0);
  const denominator = getPricingDenominator(input);
  if (denominator <= 0) {
    return safeCost * (1 + (Math.max(0, input.markupPercentage || 0) / 100));
  }
  return safeCost / denominator;
};

export class PricingEngine {
  static calculate(input: PricingInput): PricingOutput {
    const { 
      upfrontItems, recurringItems, markupPercentage, 
      durationMonths, taxRatePercentage, commissionPercentage
    } = input;
    const operatingExpensePercentage = input.operatingExpensePercentage || 0;

    const safeDuration = durationMonths > 0 ? durationMonths : 1;

    // Calcula os totais baseados nas listas
    const totalUpfrontCost = upfrontItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);
    const totalMonthlyRecurringCost = recurringItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0);

    // 1. Precificação Base
    const monthlyAmortization = totalUpfrontCost / safeDuration;
    const baseMonthlyCost = monthlyAmortization + totalMonthlyRecurringCost;
    
    const finalMonthlyPrice = calculateSalePriceFromMonthlyCost(baseMonthlyCost, input);
    const totalContractValue = finalMonthlyPrice * safeDuration;

    const createLine = (label: string, monthly: number, isSubtotal = false): FinancialStatementLine => ({
      label,
      monthlyValue: Math.max(0, monthly),
      totalValue: Math.max(0, monthly * safeDuration),
      percentageOfRevenue: finalMonthlyPrice > 0 ? (monthly / finalMonthlyPrice) * 100 : 0,
      isSubtotal
    });

    // 2. DRE Projetada
    const monthlyGrossRevenue = finalMonthlyPrice;
    const monthlyTaxes = monthlyGrossRevenue * (taxRatePercentage / 100);
    const monthlyNetRevenue = monthlyGrossRevenue - monthlyTaxes;
    
    const monthlyCogs = totalMonthlyRecurringCost + monthlyAmortization; 
    const monthlyGrossProfit = monthlyNetRevenue - monthlyCogs;
    
    const monthlyCommissions = monthlyGrossRevenue * (commissionPercentage / 100);
    const monthlyOperatingExpenses = monthlyGrossRevenue * (operatingExpensePercentage / 100);
    const monthlyNetIncome = monthlyGrossProfit - monthlyCommissions - monthlyOperatingExpenses;

    // 3. Métricas
    const totalNetProfit = monthlyNetIncome * safeDuration;
    const roi = totalUpfrontCost > 0 ? (totalNetProfit / totalUpfrontCost) * 100 : 0;
    
    const monthlyCashFlow = monthlyNetIncome + monthlyAmortization;
    const paybackMonths = monthlyCashFlow > 0 ? totalUpfrontCost / monthlyCashFlow : (totalUpfrontCost > 0 ? 999 : 0);

    const marginDeductions = (taxRatePercentage / 100) + (commissionPercentage / 100) + (operatingExpensePercentage / 100);
    const breakEvenMonthlyPrice = marginDeductions < 1 
      ? baseMonthlyCost / (1 - marginDeductions)
      : baseMonthlyCost;

    return {
      totalUpfrontCost,
      totalMonthlyRecurringCost,
      monthlyAmortization,
      baseMonthlyCost,
      finalMonthlyPrice,
      totalContractValue,
      metrics: {
        roi,
        paybackMonths: Math.min(paybackMonths, safeDuration * 2),
        ebitda: monthlyNetIncome,
        ebitdaMargin: finalMonthlyPrice > 0 ? (monthlyNetIncome / finalMonthlyPrice) * 100 : 0,
        breakEvenMonthlyPrice
      },
      dre: {
        grossRevenue: createLine("Receita Bruta (Faturamento)", monthlyGrossRevenue, true),
        taxes: createLine(`(-) Impostos Diretos (${taxRatePercentage}%)`, monthlyTaxes),
        netRevenue: createLine("(=) Receita Líquida", monthlyNetRevenue, true),
        cogs: createLine("(-) Custos Operacionais / CPV", monthlyCogs),
        grossProfit: createLine("(=) Margem de Contribuição", monthlyGrossProfit, true),
        commissions: createLine(`(-) Comissões de Vendas (${commissionPercentage}%)`, monthlyCommissions),
        operatingExpenses: createLine(`(-) Encargos e Despesas Comerciais (${operatingExpensePercentage}%)`, monthlyOperatingExpenses),
        netIncome: createLine("(=) Lucro Líquido Operacional", monthlyNetIncome, true),
      }
    };
  }
}
