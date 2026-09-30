const B2G_SIGNAL_PATTERN = /(\bB2G\b|GOVERNO|\bGOV\b|LICIT|EDITAL|TERMO DE REFER[ÊE]NCIA)/i;

const toNormalizedText = (value) => String(value || '').trim();

export const normalizeClientType = (value) => {
  const normalized = toNormalizedText(value).toUpperCase();
  if (normalized === 'B2B' || normalized === 'B2G') return normalized;
  return null;
};

const hasB2GSignal = (value) => {
  const text = toNormalizedText(value);
  if (!text) return false;
  return B2G_SIGNAL_PATTERN.test(text);
};

const hasB2GDescriptionShape = (value) => {
  const text = toNormalizedText(value);
  if (!text) return false;
  if (hasB2GSignal(text)) return true;
  if (!text.startsWith('{')) return false;
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object') return false;
    return Boolean(
      parsed.noticeId ||
      parsed.numeroEdital ||
      parsed.orgaoEntidade ||
      parsed.faseAtual ||
      parsed.modalidade
    );
  } catch {
    return false;
  }
};

export const inferCompanyClientType = (company, fallback = 'B2B') => {
  const directType = normalizeClientType(company?.clientType);
  if (directType) return directType;

  if (
    hasB2GSignal(company?.segment) ||
    hasB2GSignal(company?.marketSegment) ||
    hasB2GSignal(company?.businessModel)
  ) {
    return 'B2G';
  }

  return fallback;
};

export const inferOpportunityClientType = (opportunity, companyOrResolver, fallback = 'B2B') => {
  const directType = normalizeClientType(opportunity?.clientType);
  if (directType) return directType;

  if (String(opportunity?.number || '').toUpperCase().startsWith('B2G-')) return 'B2G';
  if (normalizeClientType(opportunity?.projectClientType) === 'B2G') return 'B2G';
  if (opportunity?.b2gStage) return 'B2G';

  if (hasB2GSignal(opportunity?.source)) return 'B2G';
  if (hasB2GDescriptionShape(opportunity?.description)) return 'B2G';

  const company = typeof companyOrResolver === 'function'
    ? companyOrResolver(opportunity)
    : (companyOrResolver || opportunity?.company || null);

  if (company) return inferCompanyClientType(company, fallback);

  return fallback;
};

export const isCompanyInClientType = (company, targetClientType, fallback = 'B2B') => {
  const expected = normalizeClientType(targetClientType) || fallback;
  return inferCompanyClientType(company, fallback) === expected;
};

export const isOpportunityInClientType = (
  opportunity,
  targetClientType,
  companyOrResolver,
  fallback = 'B2B'
) => {
  const expected = normalizeClientType(targetClientType) || fallback;
  return inferOpportunityClientType(opportunity, companyOrResolver, fallback) === expected;
};
