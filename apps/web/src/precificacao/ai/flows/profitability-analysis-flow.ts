import type { FinancialStatementLine } from '@/app/lib/pricing-engine';

export type ProfitabilityAnalysisInput = {
  durationMonths: number;
  grossRevenue: FinancialStatementLine;
  taxes: FinancialStatementLine;
  netRevenue: FinancialStatementLine;
  cogs: FinancialStatementLine;
  grossProfit: FinancialStatementLine;
  commissions: FinancialStatementLine;
  netIncome: FinancialStatementLine;
};

export type ProfitabilityAnalysisOutput = string;

const brl = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const pct = (value: number) => `${(value || 0).toFixed(2)}%`;

export async function analyzeProfitability(input: ProfitabilityAnalysisInput): Promise<ProfitabilityAnalysisOutput> {
  const grossMargin = input.grossProfit.percentageOfRevenue;
  const netMargin = input.netIncome.percentageOfRevenue;
  const taxLoad = input.taxes.percentageOfRevenue;
  const commissionLoad = input.commissions.percentageOfRevenue;
  const costLoad = input.cogs.percentageOfRevenue;

  const marginHealth = netMargin >= 20
    ? 'saudável e acima do patamar mínimo recomendado'
    : netMargin >= 10
      ? 'viável, porém com espaço limitado para absorver variações de custo'
      : 'pressionada e exige revisão antes de avançar para proposta final';

  const riskFocus = [
    costLoad > 55 ? `custos diretos elevados (${pct(costLoad)} da receita)` : null,
    taxLoad > 18 ? `carga tributária alta (${pct(taxLoad)})` : null,
    commissionLoad > 7 ? `comissões relevantes (${pct(commissionLoad)})` : null,
    netMargin < 10 ? `margem líquida baixa (${pct(netMargin)})` : null,
  ].filter(Boolean);

  return [
    `Análise do contrato projetado para ${input.durationMonths} meses.`,
    '',
    `A receita bruta mensal projetada é de ${brl(input.grossRevenue.monthlyValue)}, com receita líquida de ${brl(input.netRevenue.monthlyValue)} após impostos. A margem bruta está em ${pct(grossMargin)} e a margem líquida operacional em ${pct(netMargin)}, o que indica uma estrutura ${marginHealth}.`,
    '',
    riskFocus.length > 0
      ? `Pontos de atenção: ${riskFocus.join('; ')}. Esses fatores podem reduzir a folga financeira caso haja desconto comercial, atraso de implantação ou variação de fornecedores.`
      : 'A estrutura de custos, impostos e comissões está equilibrada para o cenário atual, sem um ponto crítico isolado dominando a rentabilidade.',
    '',
    `Sugestões práticas: valide se os custos recorrentes estão completos, preserve uma margem mínima antes de conceder desconto e simule alternativas de prazo quando o setup pesar no início do contrato. Se a negociação exigir redução de preço, priorize redução de escopo ou ajuste de comissão antes de reduzir diretamente o valor mensal.`,
    '',
    `Conclusão: o contrato gera lucro líquido mensal projetado de ${brl(input.netIncome.monthlyValue)} e resultado total de ${brl(input.netIncome.totalValue)}. Use este diagnóstico como apoio financeiro interno antes da precificação final.`
  ].join('\n');
}
