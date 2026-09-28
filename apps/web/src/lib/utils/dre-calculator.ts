/**
 * Utilitários para cálculo de DRE (Demonstrativo de Resultado do Exercício)
 */

export interface DRECalculationInput {
  monthlyRevenue: number;
  installationRevenue: number;
  serviceCost: number;
  bandwidthCost: number;
  lastMileCost: number;
  simplesNacional: number;
  commissions: number;
  expenseCost: number;
  contractPeriod: number;
}

export interface DREResult {
  receitaMensal: number;
  receitaInstalacao: number;
  receitaTotalPrimeiromes: number;
  custoServico: number;
  custoBanda: number;
  lastMile: number;
  simplesNacional: number;
  totalComissoes: number;
  custoDespesa: number;
  balance: number;
  margemLiquida: number;
  markup: number;
  lucratividade: number;
  rentabilidade: number;
}

/**
 * Calcula DRE para um período específico
 */
export const calculateDRE = (input: DRECalculationInput): DREResult => {
  const {
    monthlyRevenue,
    installationRevenue,
    serviceCost,
    bandwidthCost,
    lastMileCost,
    simplesNacional,
    commissions,
    expenseCost,
  } = input;

  // Receita total do primeiro mês (inclui instalação)
  const receitaTotalPrimeiromes = monthlyRevenue + installationRevenue;

  // Custo total
  const totalCost = serviceCost + bandwidthCost + lastMileCost + simplesNacional + commissions + expenseCost;

  // Balance (Lucro Líquido)
  const balance = receitaTotalPrimeiromes - totalCost;

  // Cálculos de margem e markup
  const margemLiquida = receitaTotalPrimeiromes > 0 ? (balance / receitaTotalPrimeiromes) * 100 : 0;
  const markup = totalCost > 0 ? (balance / totalCost) * 100 : 0;

  // Lucratividade e rentabilidade (mesmo valor conforme padrão)
  const lucratividade = margemLiquida;
  const rentabilidade = margemLiquida;

  return {
    receitaMensal: monthlyRevenue,
    receitaInstalacao: installationRevenue,
    receitaTotalPrimeiromes,
    custoServico: serviceCost,
    custoBanda: bandwidthCost,
    lastMile: lastMileCost,
    simplesNacional,
    totalComissoes: commissions,
    custoDespesa: expenseCost,
    balance,
    margemLiquida,
    markup,
    lucratividade,
    rentabilidade
  };
};

/**
 * Calcula DRE para múltiplos períodos
 */
export const calculateMultiplePeriodDRE = (
  input: DRECalculationInput,
  periods: number[] = [12, 24, 36, 48, 60]
): Record<number, DREResult> => {
  const results: Record<number, DREResult> = {};

  periods.forEach(period => {
    if (period <= input.contractPeriod) {
      results[period] = calculateDRE(input);
    }
  });

  return results;
};

/**
 * Calcula payback baseado no DRE
 */
export const calculatePaybackFromDRE = (
  installationRevenue: number,
  serviceCost: number,
  monthlyRevenue: number,
  contractPeriod: number
): number => {
  if (monthlyRevenue <= 0) return 0;
  
  return Math.ceil((installationRevenue + serviceCost) / monthlyRevenue);
};

/**
 * Valida se os valores do DRE estão consistentes
 */
export const validateDREValues = (input: DRECalculationInput): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (input.monthlyRevenue < 0) {
    errors.push('Receita mensal não pode ser negativa');
  }

  if (input.installationRevenue < 0) {
    errors.push('Receita de instalação não pode ser negativa');
  }

  if (input.serviceCost < 0) {
    errors.push('Custo de serviço não pode ser negativo');
  }

  if (input.contractPeriod <= 0) {
    errors.push('Período contratual deve ser maior que zero');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Formata resultado do DRE para exibição
 */
export const formatDREForDisplay = (dre: DREResult) => {
  return {
    ...dre,
    receitaMensalFormatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dre.receitaMensal),
    receitaInstalacaoFormatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dre.receitaInstalacao),
    balanceFormatted: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dre.balance),
    margemLiquidaFormatted: `${dre.margemLiquida.toFixed(2)}%`,
    markupFormatted: `${dre.markup.toFixed(2)}%`
  };
};