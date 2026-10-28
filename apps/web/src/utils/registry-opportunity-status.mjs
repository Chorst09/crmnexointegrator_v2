// Approval of a registration is separate from winning the commercial opportunity.
export const REGISTRY_OPPORTUNITY_STATUSES = [
  { value: 'EM_ANALISE', label: 'Em análise', color: '#f6b40b', open: true },
  { value: 'APROVADO', label: 'Aprovado', color: '#34d399', open: true },
  { value: 'NEGADO', label: 'Negado', color: '#fb7185', open: false }
];

export const normalizeRegistryStatus = (status) => {
  const key = String(status || '').trim().toUpperCase();
  if (['APROVADO', 'GANHA'].includes(key)) return 'APROVADO';
  if (['NEGADO', 'PERDIDA', 'DEVOLVIDA'].includes(key)) return 'NEGADO';
  return 'EM_ANALISE';
};

export const getRegistryStatusLabel = (status) =>
  REGISTRY_OPPORTUNITY_STATUSES.find(item => item.value === normalizeRegistryStatus(status)).label;

export const isRegistryOpportunityOpen = (status) =>
  REGISTRY_OPPORTUNITY_STATUSES.some(item => item.value === normalizeRegistryStatus(status) && item.open);
