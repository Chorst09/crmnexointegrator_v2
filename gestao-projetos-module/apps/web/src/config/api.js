// Configuração da API - Detecta automaticamente o ambiente
const getApiBaseUrl = () => {
  const explicitApiUrl = String(import.meta.env.VITE_API_URL || '').trim();
  const isProd = import.meta.env.PROD;

  const normalizePathBase = (value) => {
    const clean = String(value || '')
      .trim()
      .replace(/^\.\/+/, '')
      .replace(/\/+$/, '');

    if (!clean) return '/api';
    if (clean === 'api' || clean === '/api') return '/api';
    if (clean.startsWith('/')) return clean;
    return `/${clean}`;
  };

  // Permite definir URL absoluta no build (Coolify, ambientes separados etc.)
  if (explicitApiUrl) {
    const normalized = explicitApiUrl.replace(/\/+$/, '');

    // URL absoluta: validações extras para evitar host inválido em produção.
    if (/^https?:\/\//i.test(normalized)) {
      let parsed;
      try {
        parsed = new URL(normalized);
      } catch {
        return '/api';
      }

      const hostname = String(parsed.hostname || '').toLowerCase();

      // Em produção, nunca faz sentido apontar o browser para localhost/127.0.0.1.
      if (isProd && (hostname === 'localhost' || hostname === '127.0.0.1')) {
        return '/api';
      }

      // Em produção, host de rótulo único (ex.: https://api) costuma ser configuração inválida.
      if (isProd && hostname && !hostname.includes('.') && hostname !== 'localhost' && hostname !== '127.0.0.1') {
        return '/api';
      }

      return normalized;
    }

    // URL relativa explícita: normaliza para sempre começar com "/".
    return normalizePathBase(normalized);
  }

  // Em produção sem VITE_API_URL definido, usa URL relativa
  if (isProd || import.meta.env.VITE_USE_RELATIVE_URL === 'true') {
    return '/api';
  }

  // Em desenvolvimento, usa localhost
  return 'http://127.0.0.1:3002/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Função auxiliar para construir URLs de API
export const buildApiUrl = (endpoint) => {
  const base = String(API_BASE_URL || '/api').replace(/\/+$/, '');
  const path = String(endpoint || '/').startsWith('/') ? String(endpoint || '/') : `/${String(endpoint || '/')}`;
  return `${base}${path}`;
};

// URLs específicas
export const API_ENDPOINTS = {
  auth: {
    login: `${API_BASE_URL}/auth/login`,
    logout: `${API_BASE_URL}/auth/logout`,
    me: `${API_BASE_URL}/auth/me`,
    register: `${API_BASE_URL}/auth/register`,
    forgotPassword: `${API_BASE_URL}/auth/forgot-password`
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
  b2g: `${API_BASE_URL}/b2g`,
  solicitacoes: `${API_BASE_URL}/solicitacoes`,
  pdfGenerator: `${API_BASE_URL}/pdf-generator`,
  settings: `${API_BASE_URL}/settings`,
  settingsLogo: `${API_BASE_URL}/settings/logo`,
  projetos: `${API_BASE_URL}/projetos`,
  integration: {
    openapi: `${API_BASE_URL}/integration/openapi`,
    partners: `${API_BASE_URL}/integration/admin/partners`,
    rotateSecret: (partnerId) => `${API_BASE_URL}/integration/admin/partners/${partnerId}/rotate-secret`
  },
  licensing: {
    publicPlans: `${API_BASE_URL}/licensing/public/plans`,
    publicCreatePreference: `${API_BASE_URL}/checkout/create-preference`,
    publicCheckoutConfirm: `${API_BASE_URL}/licensing/public/checkout/confirm`,
    plans: `${API_BASE_URL}/licensing/plans`,
    companies: `${API_BASE_URL}/licensing/companies`,
    updateCompany: (companyId) => `${API_BASE_URL}/licensing/companies/${companyId}`,
    approveCompany: (companyId) => `${API_BASE_URL}/licensing/companies/${companyId}/approve`,
    companyLicense: (companyId) => `${API_BASE_URL}/licensing/companies/${companyId}/license`,
    companyRolePolicies: (companyId) => `${API_BASE_URL}/licensing/companies/${companyId}/role-policies`,
    companyUsers: (companyId) => `${API_BASE_URL}/licensing/companies/${companyId}/users`,
    deleteCompany: (companyId) => `${API_BASE_URL}/licensing/companies/${companyId}`,
    permissionsTemplates: `${API_BASE_URL}/licensing/permissions/templates`
  }
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
