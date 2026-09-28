/**
 * Utilitários para tratamento de entradas de formulário
 */

/**
 * Manipula entrada de valores monetários, convertendo vírgulas para pontos
 * e garantindo que apenas números válidos sejam aceitos
 */
export const handleMonetaryInput = (
  value: string,
  setter: (value: number) => void,
  changeHandler?: () => void
) => {
  // Remove caracteres não numéricos exceto vírgula e ponto
  const cleanValue = value.replace(/[^0-9,.]/g, '');
  
  // Converte vírgula para ponto para parsing
  const numericValue = parseFloat(cleanValue.replace(',', '.'));
  
  // Define o valor (0 se não for um número válido)
  setter(isNaN(numericValue) ? 0 : numericValue);
  
  // Chama o handler de mudança se fornecido
  if (changeHandler) {
    changeHandler();
  }
};

/**
 * Manipula entrada de valores percentuais
 */
export const handlePercentageInput = (
  value: string,
  setter: (value: number) => void,
  changeHandler?: () => void,
  maxValue: number = 100
) => {
  const cleanValue = value.replace(/[^0-9,.]/g, '');
  const numericValue = parseFloat(cleanValue.replace(',', '.'));
  
  // Limita o valor ao máximo especificado
  const finalValue = isNaN(numericValue) ? 0 : Math.min(numericValue, maxValue);
  
  setter(finalValue);
  
  if (changeHandler) {
    changeHandler();
  }
};

/**
 * Manipula entrada de valores inteiros
 */
export const handleIntegerInput = (
  value: string,
  setter: (value: number) => void,
  changeHandler?: () => void,
  minValue: number = 0
) => {
  const cleanValue = value.replace(/[^0-9]/g, '');
  const numericValue = parseInt(cleanValue);
  
  const finalValue = isNaN(numericValue) ? minValue : Math.max(numericValue, minValue);
  
  setter(finalValue);
  
  if (changeHandler) {
    changeHandler();
  }
};

/**
 * Cria um handler otimizado para entrada monetária
 */
export const createMonetaryHandler = (
  setter: (value: number) => void,
  changeHandler?: () => void
) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    handleMonetaryInput(e.target.value, setter, changeHandler);
  };
};

/**
 * Cria um handler otimizado para entrada percentual
 */
export const createPercentageHandler = (
  setter: (value: number) => void,
  changeHandler?: () => void,
  maxValue: number = 100
) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    handlePercentageInput(e.target.value, setter, changeHandler, maxValue);
  };
};

/**
 * Cria um handler otimizado para entrada de inteiros
 */
export const createIntegerHandler = (
  setter: (value: number) => void,
  changeHandler?: () => void,
  minValue: number = 0
) => {
  return (e: React.ChangeEvent<HTMLInputElement>) => {
    handleIntegerInput(e.target.value, setter, changeHandler, minValue);
  };
};