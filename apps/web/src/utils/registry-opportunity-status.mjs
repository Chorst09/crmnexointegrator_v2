// Approval of a registration is separate from winning the commercial opportunity.
export const REGISTRY_OPPORTUNITY_STATUSES = [
  { value: 'ABERTA', label: 'Aberta', color: '#ff7a00', open: true },
  { value: 'EM_ANALISE', label: 'Em análise', color: '#f6b40b', open: true },
  { value: 'EM_COTACAO', label: 'Em cotação', color: '#f6b40b', open: true },
  { value: 'AGUARDANDO_APROVACAO', label: 'Aguardando aprovação', color: '#f59e0b', open: true },
  { value: 'APROVADO', label: 'Aprovado', color: '#34d399', open: true },
  { value: 'NEGADO', label: 'Negado', color: '#fb7185', open: false },
  { value: 'PRECIFICADA', label: 'Precificada', color: '#1f7fe5', open: true },
  { value: 'DEVOLVIDA', label: 'Devolvida', color: '#18c8df', open: false },
  { value: 'GANHA', label: 'Ganha', color: '#34d399', open: false },
  { value: 'PERDIDA', label: 'Perdida', color: '#fb7185', open: false }
];

export const getRegistryStatusLabel = (status = 'ABERTA') =>
  REGISTRY_OPPORTUNITY_STATUSES.find(item => item.value === String(status).toUpperCase())?.label || status;

export const isRegistryOpportunityOpen = (status) =>
  REGISTRY_OPPORTUNITY_STATUSES.some(item => item.value === String(status || '').toUpperCase() && item.open);
