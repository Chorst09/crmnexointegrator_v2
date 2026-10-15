export const normalizeNegotiationType = (value) => {
  const text = String(value || '').trim();
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (!normalized) return '';
  if (normalized === 'new_client' || normalized.includes('cliente novo') || normalized.includes('nova venda')) return 'Cliente Novo';
  if (normalized === 'base_client' || normalized.includes('cliente da base')) return 'Cliente da Base';
  if (normalized === 'renewal' || normalized.includes('renov')) return 'Renovações';
  if (normalized.includes('up selling') || normalized.includes('upselling') || normalized.includes('up-sell')) return 'Up Selling';
  return text;
};

export const projectClientTypeFromNegotiation = (value) => {
  const normalized = normalizeNegotiationType(value);
  if (normalized === 'Cliente Novo') return 'NEW_CLIENT';
  if (normalized === 'Renovações') return 'RENEWAL';
  if (normalized === 'Cliente da Base' || normalized === 'Up Selling') return 'BASE_CLIENT';
  return '';
};

