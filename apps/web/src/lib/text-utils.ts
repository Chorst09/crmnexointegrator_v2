/**
 * Normaliza texto removendo espaços extras e fazendo trim
 */
export const normalizeText = (value: unknown): string =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

/**
 * Normaliza texto para comparação (lowercase)
 */
export const normalizeComparable = (value: unknown): string =>
  normalizeText(value).toLowerCase();

/**
 * Normaliza lista de textos, retornando o primeiro não-vazio
 */
export const normalizeTextList = (...values: unknown[]): string => {
  const source = values.find((value) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value != null;
  });

  if (Array.isArray(source)) {
    return source.filter(Boolean).join(', ');
  }

  return normalizeText(source);
};
