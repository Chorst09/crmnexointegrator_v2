const ROLE_ACCESS_DEFAULTS = {
  MASTER: { accessB2B: true, accessB2G: true, accessPreSales: true, accessManagement: true, accessAutomation: true },
  ADMIN: { accessB2B: true, accessB2G: true, accessPreSales: true, accessManagement: true, accessAutomation: true },
  MANAGER: { accessB2B: true, accessB2G: true, accessPreSales: true, accessManagement: true, accessAutomation: true },
  DIRECTOR: { accessB2B: true, accessB2G: true, accessPreSales: false, accessManagement: true, accessAutomation: false },
  SELLER: { accessB2B: true, accessB2G: true, accessPreSales: false, accessManagement: false, accessAutomation: false },
  USER: { accessB2B: true, accessB2G: false, accessPreSales: false, accessManagement: false, accessAutomation: false },
  PRE_SALES: { accessB2B: false, accessB2G: false, accessPreSales: true, accessManagement: false, accessAutomation: false }
};

const ROLE_PERMISSION_TEMPLATES = {
  MASTER: {
    dashboard: true,
    leads: true,
    oportunidades: true,
    buscaOportunidadesPublicas: true,
    somenteSuasOportunidades: false,
    registroNoFabricante: true,
    documentacao: true,
    relatoriosEstrategicos: true,
    historico: true,
    precificacao: true,
    administracaoLicenciamento: true,
    administracaoUsuarios: true,
    billing: true,
    integrations: true,
    gestao: true,
    automacoes: true
  },
  ADMIN: {
    dashboard: true,
    leads: true,
    oportunidades: true,
    buscaOportunidadesPublicas: true,
    somenteSuasOportunidades: false,
    registroNoFabricante: true,
    documentacao: true,
    relatoriosEstrategicos: true,
    historico: true,
    precificacao: true,
    administracaoLicenciamento: false,
    administracaoUsuarios: true,
    billing: true,
    integrations: true,
    gestao: true,
    automacoes: true
  },
  USER: {
    dashboard: false,
    leads: true,
    oportunidades: true,
    buscaOportunidadesPublicas: true,
    somenteSuasOportunidades: true,
    registroNoFabricante: true,
    documentacao: true,
    relatoriosEstrategicos: true,
    historico: true,
    precificacao: false,
    administracaoLicenciamento: false,
    administracaoUsuarios: false,
    billing: false,
    integrations: false,
    gestao: false,
    automacoes: false
  },
  PRE_SALES: {
    dashboard: false,
    leads: true,
    oportunidades: true,
    buscaOportunidadesPublicas: false,
    somenteSuasOportunidades: true,
    registroNoFabricante: false,
    documentacao: false,
    relatoriosEstrategicos: false,
    historico: false,
    precificacao: true,
    administracaoLicenciamento: false,
    administracaoUsuarios: false,
    billing: false,
    integrations: false,
    gestao: false,
    automacoes: false
  },
  MANAGER: {
    dashboard: true,
    leads: true,
    oportunidades: true,
    buscaOportunidadesPublicas: true,
    somenteSuasOportunidades: false,
    registroNoFabricante: true,
    documentacao: true,
    relatoriosEstrategicos: true,
    historico: true,
    precificacao: true,
    administracaoLicenciamento: false,
    administracaoUsuarios: true,
    billing: false,
    integrations: true,
    gestao: true,
    automacoes: true
  },
  DIRECTOR: {
    dashboard: true,
    leads: true,
    oportunidades: true,
    buscaOportunidadesPublicas: true,
    somenteSuasOportunidades: false,
    registroNoFabricante: true,
    documentacao: true,
    relatoriosEstrategicos: true,
    historico: true,
    precificacao: false,
    administracaoLicenciamento: false,
    administracaoUsuarios: false,
    billing: false,
    integrations: false,
    gestao: true,
    automacoes: false
  },
  SELLER: {
    dashboard: false,
    leads: true,
    oportunidades: true,
    buscaOportunidadesPublicas: true,
    somenteSuasOportunidades: true,
    registroNoFabricante: true,
    documentacao: true,
    relatoriosEstrategicos: true,
    historico: true,
    precificacao: false,
    administracaoLicenciamento: false,
    administracaoUsuarios: false,
    billing: false,
    integrations: false,
    gestao: false,
    automacoes: false
  }
};

function normalizeRole(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PRE-VENDAS' || raw === 'PREVENDAS') return 'PRE_SALES';
  if (raw === 'USUARIO') return 'USER';
  return raw || 'USER';
}

function getRoleAccessDefaults(role) {
  const normalizedRole = normalizeRole(role);
  return ROLE_ACCESS_DEFAULTS[normalizedRole] || ROLE_ACCESS_DEFAULTS.USER;
}

function resolveUserAccess(role, inputAccess = {}) {
  const normalizedRole = normalizeRole(role);
  const base = getRoleAccessDefaults(normalizedRole);

  if (normalizedRole === 'MASTER') {
    return { ...base };
  }

  const accessB2B = inputAccess.accessB2B !== undefined ? Boolean(inputAccess.accessB2B) : base.accessB2B;
  const accessB2G = inputAccess.accessB2G !== undefined ? Boolean(inputAccess.accessB2G) : base.accessB2G;
  const accessPreSales = inputAccess.accessPreSales !== undefined ? Boolean(inputAccess.accessPreSales) : base.accessPreSales;
  const accessManagement = inputAccess.accessManagement !== undefined ? Boolean(inputAccess.accessManagement) : base.accessManagement;
  const accessAutomation = inputAccess.accessAutomation !== undefined ? Boolean(inputAccess.accessAutomation) : base.accessAutomation;

  return {
    accessB2B,
    accessB2G,
    accessPreSales,
    accessManagement,
    accessAutomation
  };
}

function isMaster(user = {}) {
  return normalizeRole(user.actualRole || user.role) === 'MASTER';
}

function canManageLicensing(user = {}) {
  const role = normalizeRole(user.actualRole || user.role);
  return role === 'MASTER' || role === 'ADMIN';
}

function canAccessModule(user = {}, moduleName) {
  if (!user) return false;
  if (isMaster(user)) return true;

  const role = normalizeRole(user.actualRole || user.role);
  const moduleUpper = String(moduleName || '').trim().toUpperCase();

  if (role === 'PRE_SALES') return moduleUpper === 'PRE_SALES';

  const accessB2B = Boolean(user.accessB2B);
  const accessB2G = Boolean(user.accessB2G);
  const accessPreSales = Boolean(user.accessPreSales);
  const accessManagement = Boolean(user.accessManagement);
  const accessAutomation = Boolean(user.accessAutomation);

  if (moduleUpper === 'B2B') return accessB2B;
  if (moduleUpper === 'B2G') return accessB2G;
  if (moduleUpper === 'PRE_SALES') return accessPreSales;
  if (moduleUpper === 'GESTAO' || moduleUpper === 'MANAGEMENT') return accessManagement;
  if (moduleUpper === 'AUTOMATION' || moduleUpper === 'AUTOMACOES') return accessAutomation;

  return false;
}

function getPermissionTemplate(role, overrides = {}) {
  const normalizedRole = normalizeRole(role);
  const base = ROLE_PERMISSION_TEMPLATES[normalizedRole] || ROLE_PERMISSION_TEMPLATES.USER;

  if (!overrides || typeof overrides !== 'object') return { ...base };

  const normalizedOverrides = { ...overrides };
  const aliases = {
    opportunities: 'oportunidades',
    publicOpportunities: 'buscaOportunidadesPublicas',
    ownOpportunitiesOnly: 'somenteSuasOportunidades',
    manufacturerRegistry: 'registroNoFabricante',
    documentation: 'documentacao',
    strategicReports: 'relatoriosEstrategicos',
    management: 'gestao',
    automation: 'automacoes'
  };
  Object.entries(aliases).forEach(([source, target]) => {
    if (Object.prototype.hasOwnProperty.call(normalizedOverrides, source)) {
      normalizedOverrides[target] = Boolean(normalizedOverrides[source]);
    }
  });

  return {
    ...base,
    ...normalizedOverrides
  };
}

module.exports = {
  ROLE_ACCESS_DEFAULTS,
  ROLE_PERMISSION_TEMPLATES,
  normalizeRole,
  getRoleAccessDefaults,
  resolveUserAccess,
  isMaster,
  canManageLicensing,
  canAccessModule,
  getPermissionTemplate
};
