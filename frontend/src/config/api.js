// Configuração da API - Detecta automaticamente o ambiente
const getApiBaseUrl = () => {
  // Em produção, usa URL relativa
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return '/api';
  }
  // Em desenvolvimento, usa localhost
  return 'http://127.0.0.1:3001/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Função auxiliar para construir URLs de API
export const buildApiUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
};

// URLs específicas
export const API_ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/auth/login`,
    logout: `${API_BASE_URL}/auth/logout`,
    me: `${API_BASE_URL}/auth/me`
  },
  users: `${API_BASE_URL}/users`,
  salesTargets: `${API_BASE_URL}/sales-targets`,
  companies: `${API_BASE_URL}/companies`,
  opportunities: `${API_BASE_URL}/opportunities`,
  activities: `${API_BASE_URL}/activities`,
  products: `${API_BASE_URL}/products`,
  proposals: `${API_BASE_URL}/proposals`,
  proposalTemplates: `${API_BASE_URL}/proposal-templates`,
  commissions: `${API_BASE_URL}/commissions`,
  dashboard: `${API_BASE_URL}/dashboard`,
  leadScoring: `${API_BASE_URL}/leadScoring`,
  leadDistribution: `${API_BASE_URL}/leadDistribution`,
  contracts: `${API_BASE_URL}/contracts`,
  postSales: `${API_BASE_URL}/post-sales`,
  integrations: `${API_BASE_URL}/integrations`,
  whatsapp: `${API_BASE_URL}/whatsapp`,
  emailMarketing: `${API_BASE_URL}/email-marketing`,
  voip: `${API_BASE_URL}/voip`,
  priceTables: `${API_BASE_URL}/price-tables`,
  competitors: `${API_BASE_URL}/competitors`,
  regions: `${API_BASE_URL}/regions`,
  crossSell: `${API_BASE_URL}/cross-sell`,
  upsell: `${API_BASE_URL}/upsell`,
  approvals: `${API_BASE_URL}/approvals`,
  teamCommissions: `${API_BASE_URL}/team-commissions`,
  advancedWorkflows: `${API_BASE_URL}/advanced-workflows`,
  solicitacoes: `${API_BASE_URL}/solicitacoes`,
  pdfGenerator: `${API_BASE_URL}/pdf-generator`
};

// Headers padrão com autenticação
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };
};

export const getHeaders = () => ({
  'Content-Type': 'application/json'
});
