const CALCULATOR_SETTINGS_STORAGE_KEY = 'crm-calculadoras-settings-v1';

const DEFAULT_SETTINGS = {
  regimesTributarios: [
    {
      id: 'LUCRO_PRESUMIDO',
      nome: 'Lucro Presumido',
      pis: 0.65,
      cofins: 3,
      csll: 9,
      irpj: 15,
      icms: 18,
      iss: 5,
      cbs: 0,
      ibs: 0,
      is: 0,
      basePresuncaoServico: 32,
      anexoIII: 0,
      usaReforma: false,
      ativo: true,
    },
  ],
  custosDespesas: {
    comissaoServico: 5,
    despesasAdmin: 2,
    outrasDespesas: 1,
    despesasVariaveisPercentual: 0,
    custoFinanceiroMensal: 1.17,
    depreciacao: 0,
  },
};

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getActiveRegime = (settings: any) => {
  const regimes = Array.isArray(settings?.regimesTributarios) && settings.regimesTributarios.length > 0
    ? settings.regimesTributarios
    : DEFAULT_SETTINGS.regimesTributarios;
  return regimes.find((regime: any) => regime?.ativo) || regimes[0] || DEFAULT_SETTINGS.regimesTributarios[0];
};

export const loadCalculatorPricingSettings = () => {
  let stored = DEFAULT_SETTINGS;

  try {
    const raw = localStorage.getItem(CALCULATOR_SETTINGS_STORAGE_KEY);
    if (raw) stored = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    stored = DEFAULT_SETTINGS;
  }

  const regime = getActiveRegime(stored);
  const custos = { ...DEFAULT_SETTINGS.custosDespesas, ...(stored as any)?.custosDespesas };
  const baseServico = toNumber(regime?.basePresuncaoServico, 100) / 100;

  const directTaxes = regime?.usaReforma
    ? toNumber(regime?.cbs) + toNumber(regime?.ibs) + toNumber(regime?.is)
    : toNumber(regime?.pis) + toNumber(regime?.cofins) + toNumber(regime?.iss);
  const incomeTaxes = (toNumber(regime?.csll) + toNumber(regime?.irpj)) * baseServico;
  const simplesRate = toNumber(regime?.anexoIII);
  const taxRatePercentage = regime?.id === 'SIMPLES_NACIONAL' && simplesRate > 0
    ? simplesRate
    : directTaxes + incomeTaxes;

  const commissionPercentage = toNumber(custos.comissaoServico);
  const markupPercentage = toNumber(custos.margemLucroServico, 20);
  const operatingExpensePercentage = [
    custos.despesasAdmin,
    custos.outrasDespesas,
    custos.despesasVariaveisPercentual,
    custos.depreciacao,
  ].reduce((sum, value) => sum + toNumber(value), 0);

  return {
    regimeName: regime?.nome || 'Regime da Calculadora',
    taxRatePercentage: Number(taxRatePercentage.toFixed(2)),
    commissionPercentage: Number(commissionPercentage.toFixed(2)),
    operatingExpensePercentage: Number(operatingExpensePercentage.toFixed(2)),
    markupPercentage: Number(markupPercentage.toFixed(2)),
  };
};
