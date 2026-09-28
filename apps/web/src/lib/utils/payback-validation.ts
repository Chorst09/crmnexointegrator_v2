/**
 * Utilitários para validação de payback nas calculadoras
 */

export interface PaybackValidation {
  actualPayback: number;
  maxPayback: number;
  isValid: boolean;
}

/**
 * Calcula e valida o payback baseado nos parâmetros fornecidos
 */
export const validatePayback = (
  installationFee: number,
  serviceCost: number,
  monthlyRevenue: number,
  contractTerm: number
): PaybackValidation => {
  // Calcula o payback em meses
  const actualPayback = monthlyRevenue > 0 
    ? Math.ceil((installationFee + serviceCost) / monthlyRevenue)
    : 0;

  // Define o payback máximo baseado no prazo contratual
  let maxPayback: number;
  if (contractTerm >= 60) {
    maxPayback = 24;
  } else if (contractTerm >= 48) {
    maxPayback = 20;
  } else if (contractTerm >= 36) {
    maxPayback = 18;
  } else if (contractTerm >= 24) {
    maxPayback = 12;
  } else {
    maxPayback = 6;
  }

  return {
    actualPayback,
    maxPayback,
    isValid: actualPayback <= maxPayback
  };
};

/**
 * Calcula payback para diferentes tipos de serviço
 */
export const calculatePaybackForService = (
  type: 'fiber' | 'radio' | 'double' | 'man' | 'vm',
  installationFee: number,
  serviceCost: number,
  monthlyRevenue: number,
  contractTerm: number
): PaybackValidation => {
  return validatePayback(installationFee, serviceCost, monthlyRevenue, contractTerm);
};

/**
 * Formata mensagem de payback para exibição
 */
export const formatPaybackMessage = (validation: PaybackValidation, contractTerm: number): string => {
  if (validation.isValid) {
    return `O payback de ${validation.actualPayback} meses está dentro do limite de ${validation.maxPayback} meses.`;
  } else {
    return `O payback de ${validation.actualPayback} meses excede o limite de ${validation.maxPayback} meses para contratos de ${contractTerm} meses.`;
  }
};

/**
 * Retorna a classe CSS apropriada para o status do payback
 */
export const getPaybackStatusClass = (isValid: boolean): string => {
  return isValid ? 'text-green-400' : 'text-red-400';
};

/**
 * Retorna o ícone apropriado para o status do payback
 */
export const getPaybackStatusIcon = (isValid: boolean): string => {
  return isValid ? '✅ Dentro do limite' : '⚠️ Acima do limite';
};