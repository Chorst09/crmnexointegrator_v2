/**
 * Utilitários para resumo de oportunidades
 */

export const getOpportunitySummary = (opportunities) => {
  if (!Array.isArray(opportunities) || opportunities.length === 0) {
    return {
      total: 0,
      value: 0,
      won: 0,
      wonValue: 0
    };
  }

  return {
    total: opportunities.length,
    value: opportunities.reduce((sum, opp) => sum + (Number(opp.value) || 0), 0),
    won: opportunities.filter(opp => opp.stage === 'WON').length,
    wonValue: opportunities
      .filter(opp => opp.stage === 'WON')
      .reduce((sum, opp) => sum + (Number(opp.value) || 0), 0)
  };
};
