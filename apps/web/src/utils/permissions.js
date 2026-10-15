export const ROLES = {
  MASTER: 'MASTER',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  DIRECTOR: 'DIRECTOR',
  SELLER: 'SELLER',
  USER: 'USER',
  PRE_SALES: 'PRE_SALES'
};

export const ROLE_POLICY_MODULES = [
  {
    key: 'dashboard',
    label: 'Dashboard Geral',
    description: 'Visão consolidada de todos os módulos e indicadores executivos.'
  },
  {
    key: 'leads',
    label: 'Leads',
    description: 'Cadastro e acompanhamento de novos leads corporativos.'
  },
  {
    key: 'opportunities',
    label: 'Oportunidades',
    description: 'Cadastro e acompanhamento de oportunidades corporativas.'
  },
  {
    key: 'publicOpportunities',
    label: 'Busca de Oportunidades Públicas',
    description: 'Monitoramento de editais e licitações em fontes públicas.'
  },
  {
    key: 'ownOpportunitiesOnly',
    label: 'Somente suas oportunidades',
    description: 'Quando ativo, o usuário vê apenas oportunidades criadas por ele.'
  },
  {
    key: 'ownCompaniesOnly',
    label: 'Somente suas empresas B2B',
    description: 'Visualiza apenas empresas sob sua responsabilidade. Admin e Master visualizam todas as empresas disponíveis no seu acesso.'
  },
  {
    key: 'accessSimulador',
    label: 'Simulador',
    description: 'Acesso às calculadoras de precificação e ferramentas de simulação.'
  },
  {
    key: 'simuladorViewPricing',
    label: 'Ver Tabelas de Preços (Simulador)',
    description: 'Permite visualizar tabelas de preços nas calculadoras.'
  },
  {
    key: 'simuladorViewCommissions',
    label: 'Ver Comissões (Simulador)',
    description: 'Permite visualizar comissões nas calculadoras.'
  },
  {
    key: 'simuladorViewDRE',
    label: 'Ver DRE (Simulador)',
    description: 'Permite visualizar Demonstrativo de Resultados nas calculadoras.'
  },
  {
    key: 'manufacturerRegistry',
    label: 'Registro no Fabricante',
    description: 'Gestão de deal registration com fabricantes.'
  },
  {
    key: 'documentation',
    label: 'Documentação',
    description: 'Controle de documentos e validações.'
  },
  {
    key: 'strategicReports',
    label: 'Relatórios Estratégicos',
    description: 'Análises, desempenho e inteligência comercial.'
  },
  {
    key: 'management',
    label: 'Gestão',
    description: 'Projetos, kickoff, fases, acompanhamentos e painéis operacionais.'
  },
  {
    key: 'automation',
    label: 'Automações',
    description: 'Workflows, integrações e execução automatizada de processos.'
  }
];

export const ROLE_ACCESS_POLICY = {
  [ROLES.USER]: {
    dashboard: false,
    leads: true,
    opportunities: true,
    publicOpportunities: true,
    ownOpportunitiesOnly: true,
    ownCompaniesOnly: true,
    accessSimulador: true,
    simuladorViewPricing: false,
    simuladorViewCommissions: false,
    simuladorViewDRE: false,
    manufacturerRegistry: true,
    documentation: true,
    strategicReports: true,
    management: true,
    automation: false,
    administration: false,
    accessB2B: true,
    accessB2G: true,
    accessPreSales: false,
    accessSimulador: true,
    accessManagement: true,
    accessAutomation: false
  },
  [ROLES.SELLER]: {
    dashboard: false,
    leads: true,
    opportunities: true,
    publicOpportunities: true,
    ownOpportunitiesOnly: true,
    ownCompaniesOnly: true,
    accessSimulador: true,
    simuladorViewPricing: false,
    simuladorViewCommissions: false,
    simuladorViewDRE: false,
    manufacturerRegistry: true,
    documentation: true,
    strategicReports: true,
    management: true,
    automation: false,
    administration: false,
    accessB2B: true,
    accessB2G: true,
    accessPreSales: false,
    accessSimulador: true,
    accessManagement: true,
    accessAutomation: false
  },
  [ROLES.PRE_SALES]: {
    dashboard: false,
    leads: true,
    opportunities: true,
    publicOpportunities: false,
    ownOpportunitiesOnly: true,
    ownCompaniesOnly: true,
    accessSimulador: true,
    simuladorViewPricing: false,
    simuladorViewCommissions: false,
    simuladorViewDRE: false,
    manufacturerRegistry: false,
    documentation: false,
    strategicReports: false,
    management: false,
    automation: false,
    administration: false,
    accessB2B: false,
    accessB2G: false,
    accessPreSales: true,
    accessSimulador: true,
    accessManagement: false,
    accessAutomation: false
  },
  [ROLES.ADMIN]: {
    dashboard: true,
    leads: true,
    opportunities: true,
    publicOpportunities: true,
    ownOpportunitiesOnly: false,
    ownCompaniesOnly: false,
    accessSimulador: true,
    simuladorViewPricing: true,
    simuladorViewCommissions: true,
    simuladorViewDRE: true,
    manufacturerRegistry: true,
    documentation: true,
    strategicReports: true,
    management: true,
    automation: true,
    administration: false, // ADMIN não tem acesso à administração MASTER
    accessB2B: true,
    accessB2G: true,
    accessPreSales: true,
    accessSimulador: true,
    accessManagement: true,
    accessAutomation: true
  },
  [ROLES.MASTER]: {
    dashboard: true,
    leads: true,
    opportunities: true,
    publicOpportunities: true,
    ownOpportunitiesOnly: false,
    ownCompaniesOnly: false,
    accessSimulador: true,
    simuladorViewPricing: true,
    simuladorViewCommissions: true,
    simuladorViewDRE: true,
    manufacturerRegistry: true,
    documentation: true,
    strategicReports: true,
    management: true,
    automation: true,
    administration: true, // Apenas MASTER tem acesso à administração
    accessB2B: true,
    accessB2G: true,
    accessPreSales: true,
    accessSimulador: true,
    accessManagement: true,
    accessAutomation: true
  }
};

export const toCanonicalRole = (role, userOrEmail) => {
  const email = typeof userOrEmail === 'string'
    ? userOrEmail.trim().toLowerCase()
    : String(userOrEmail?.email || '').trim().toLowerCase();
  if (email === 'admin@crm.com' || email === 'chorstconsult@gmail.com') return ROLES.MASTER;
  const raw = String(role || '').trim().toUpperCase();
  if (!raw) return ROLES.USER;
  if (raw === 'PRE-VENDAS' || raw === 'PREVENDAS') return ROLES.PRE_SALES;
  if (raw === 'SELLER' || raw === 'VENDEDOR') return ROLES.USER;
  if (raw === 'USUARIO') return ROLES.USER;
  if (raw === ROLES.MANAGER || raw === ROLES.DIRECTOR || raw === 'GERENTE') return ROLES.ADMIN;
  if (raw === ROLES.MASTER || raw === ROLES.ADMIN || raw === ROLES.USER || raw === ROLES.PRE_SALES || raw === ROLES.SELLER) return raw;
  return ROLES.USER;
};

export const normalizeRole = (value, userOrEmail) => {
  return toCanonicalRole(value, userOrEmail);
};

export const roleLabel = (role) => {
  const normalized = toCanonicalRole(role);
  const labels = {
    [ROLES.MASTER]: 'Master',
    [ROLES.ADMIN]: 'Admin',
    [ROLES.MANAGER]: 'Gestor',
    [ROLES.DIRECTOR]: 'Diretoria',
    [ROLES.SELLER]: 'Usuário',
    [ROLES.USER]: 'Usuário',
    [ROLES.PRE_SALES]: 'Pré-Vendas'
  };

  return labels[normalized] || normalized;
};

export const isMaster = (user) => {
  if (!user) return false;
  const email = String(user?.email || '').trim().toLowerCase();
  if (email === 'admin@crm.com' || email === 'chorstconsult@gmail.com') return true;
  return normalizeRole(user?.role) === ROLES.MASTER;
};

export const getRolePolicy = (role) => {
  const canonical = toCanonicalRole(role);
  return ROLE_ACCESS_POLICY[canonical] || ROLE_ACCESS_POLICY[ROLES.USER];
};

export const getUserAccess = (user) => {
  if (!user) user = {};
  const role = toCanonicalRole(user.role);
  const policy = getRolePolicy(role);

  if (role === ROLES.MASTER) {
    return {
      accessB2B: true,
      accessB2G: true,
      accessPreSales: true,
      accessSimulador: true,
      accessManagement: true,
      accessAutomation: true
    };
  }

  return {
    accessB2B: user.accessB2B !== undefined ? Boolean(user.accessB2B) : policy.accessB2B,
    accessB2G: user.accessB2G !== undefined ? Boolean(user.accessB2G) : policy.accessB2G,
    accessPreSales: user.accessPreSales !== undefined ? Boolean(user.accessPreSales) : policy.accessPreSales,
    accessSimulador: user.accessSimulador !== undefined ? Boolean(user.accessSimulador) : policy.accessSimulador,
    accessManagement: user.accessManagement !== undefined ? Boolean(user.accessManagement) : policy.accessManagement,
    accessAutomation: user.accessAutomation !== undefined ? Boolean(user.accessAutomation) : policy.accessAutomation
  };
};

export const getUserPermissions = (user) => {
  if (!user) user = {};
  const role = toCanonicalRole(user.role);
  const policy = getRolePolicy(role);
  return {
    ...policy,
    ...(user.permissionOverrides && typeof user.permissionOverrides === 'object' ? user.permissionOverrides : {}),
    ...(user.permissions && typeof user.permissions === 'object' ? user.permissions : {})
  };
};

export const moduleFromPath = (pathname = '') => {
  const path = String(pathname || '').toLowerCase();

  if (path.startsWith('/dashboard-geral')) {
    return 'DASHBOARD_GERAL';
  }

  if (path.startsWith('/administracao')) {
    return 'ADMINISTRATION';
  }
  if (path.startsWith('/configuracoes')) {
    return 'SETTINGS';
  }

  if (path.startsWith('/simuladores')) {
    return 'SIMULADOR';
  }

  if (path.startsWith('/b2b-kickoff')) {
    return 'B2B';
  }

  if (path.startsWith('/b2g-kickoff')) {
    return 'B2G';
  }

  if (
    path.startsWith('/pre-vendas') ||
    path.startsWith('/solicitacoes') ||
    path.startsWith('/orcamentos') ||
    path.startsWith('/prevendas-distribuidores') ||
    path.startsWith('/prevendas-fornecedores') ||
    path.startsWith('/prevendas-registro-oportunidades') ||
    path.startsWith('/prevendas-cadastros') ||
    path.startsWith('/calculadoras') ||
    path.startsWith('/ratear-produtos') ||
    path.startsWith('/rateios-salvos') ||
    path.startsWith('/rateio-produtos')
  ) {
    return 'PRE_SALES';
  }

  if (
    path.startsWith('/projetos') ||
    path.startsWith('/kickoff') ||
    path.startsWith('/produtos') ||
    path.startsWith('/vendedores') ||
    path.startsWith('/comissoes') ||
    path.startsWith('/metas-performance') ||
    path.startsWith('/pos-venda') ||
    path.startsWith('/relatorios')
  ) {
    return 'GESTAO';
  }

  if (
    path.startsWith('/automacoes') ||
    path.startsWith('/integracoes') ||
    path.startsWith('/funcionalidades-avancadas')
  ) {
    return 'AUTOMATION';
  }

  if (path.startsWith('/b2g-')) {
    return 'B2G';
  }

  if (['/login', '/'].includes(path)) return null;

  return 'B2B';
};

export const canAccessModule = (user, moduleName) => {
  if (!user) return false;
  if (isMaster(user)) return true;

  const role = toCanonicalRole(user.role);
  const policy = getRolePolicy(role);
  const mod = String(moduleName || '').toUpperCase();
  if (mod === 'DASHBOARD_GERAL') {
    return Boolean(getUserPermissions(user).dashboard);
  }
  if (mod === 'ADMINISTRATION') return Boolean(policy.administration);
  if (mod === 'SETTINGS') {
    return role === ROLES.ADMIN || role === ROLES.MASTER;
  }
  if (mod === 'SIMULADOR') {
    return Boolean(getUserPermissions(user).accessSimulador);
  }

  const access = getUserAccess(user);
  if (mod === 'B2B') return access.accessB2B;
  if (mod === 'B2G') return access.accessB2G;
  if (mod === 'PRE_SALES') return access.accessPreSales;
  if (mod === 'SIMULADOR') return access.accessSimulador;
  if (mod === 'GESTAO' || mod === 'MANAGEMENT') return access.accessManagement;
  if (mod === 'AUTOMATION' || mod === 'AUTOMACOES') return access.accessAutomation;

  return false;
};

export const getDefaultRouteForUser = (user) => {
  if (!user) return '/login';
  const role = toCanonicalRole(user.role);

  if (canAccessModule(user, 'DASHBOARD_GERAL')) return '/dashboard-geral';
  if (role === ROLES.ADMIN || role === ROLES.MASTER) return '/configuracoes';

  const access = getUserAccess(user);
  if (access.accessB2B) return '/dashboard';
  if (access.accessB2G) return '/b2g-dashboard';
  if (access.accessPreSales) return '/pre-vendas';
  if (access.accessManagement) return '/projetos';
  if (access.accessAutomation) return '/automacoes';

  return '/login';
};

export const normalizeAllowedRoles = (allowedRoles = []) => {
  return (allowedRoles || []).map((item) => toCanonicalRole(item));
};

export const roleSatisfiesAllowed = (userRole, allowedRoles = []) => {
  const role = toCanonicalRole(userRole);
  const normalizedAllowed = normalizeAllowedRoles(allowedRoles);

  if (normalizedAllowed.length === 0) return true;
  if (role === ROLES.MASTER) return true;
  if (normalizedAllowed.includes(role)) return true;

  return false;
};
