import { useEffect, useMemo, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModernTable from '../components/ModernTable';
import Modal from '../components/Modal';
import { API_BASE_URL, API_ENDPOINTS, buildApiUrl, getAuthHeaders } from '../config/api';
import { ROLE_POLICY_MODULES, getRolePolicy } from '../utils/permissions';

const resolvePublicUrl = (maybeRelativeUrl) => {
  if (!maybeRelativeUrl) return null;
  if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl;

  // If API is absolute (e.g. https://host/api), map uploads to same host (https://host/uploads/...)
  if (/^https?:\/\//i.test(API_BASE_URL)) {
    const base = API_BASE_URL.replace(/\/api\/?$/i, '');
    return `${base}${maybeRelativeUrl}`;
  }

  // Same-origin deployment (Coolify / nginx proxy)
  return maybeRelativeUrl;
};

const emitBrandingUpdated = (payload = {}) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('crm-branding-updated', { detail: payload }));
};

const DEFAULT_PARTNER_FORM = {
  name: '',
  type: 'ERP',
  provider: 'TOTVS',
  partnerTier: 'BRONZE',
  scopes: 'b2b:read b2b:write b2g:read b2g:write pre_sales:read pre_sales:write',
  webhookUrl: '',
  rateLimitPerMinute: ''
};

const parseScopes = (value) =>
  String(value || '')
    .split(/[\s,]+/g)
    .map((item) => item.trim())
    .filter(Boolean);

const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const normalizeRole = (value, userOrEmail) => {
  const email = typeof userOrEmail === 'string'
    ? userOrEmail.trim().toLowerCase()
    : String(userOrEmail?.email || '').trim().toLowerCase();
  if (email === 'admin@crm.com' || email === 'chorstconsult@gmail.com') return 'MASTER';
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PRE-VENDAS' || raw === 'PREVENDAS') return 'PRE_SALES';
  if (raw === 'USUARIO') return 'USER';
  if (raw === 'MANAGER' || raw === 'DIRECTOR' || raw === 'GERENTE') return 'ADMIN';
  if (raw === 'SELLER' || raw === 'VENDEDOR') return 'USER';
  return raw || 'USER';
};

const roleLabel = (value) => {
  const role = normalizeRole(value);
  const labels = {
    MASTER: 'Master',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    DIRECTOR: 'Diretor',
    SELLER: 'Vendedor',
    USER: 'User',
    PRE_SALES: 'Pre-Vendas'
  };

  return labels[role] || role;
};

const resolveAccessByRole = (role, currentAccess) => {
  if (!currentAccess) currentAccess = {};
  const normalizedRole = normalizeRole(role);

  if (normalizedRole === 'MASTER') {
    return { accessB2B: true, accessB2G: true, accessPreSales: true, accessSimulador: true, accessManagement: true, accessAutomation: true };
  }

  const defaults = {
    ADMIN: { accessB2B: true, accessB2G: true, accessPreSales: true, accessSimulador: true, accessManagement: true, accessAutomation: true },
    MANAGER: { accessB2B: true, accessB2G: true, accessPreSales: true, accessSimulador: true, accessManagement: true, accessAutomation: true },
    DIRECTOR: { accessB2B: true, accessB2G: true, accessPreSales: false, accessSimulador: true, accessManagement: true, accessAutomation: false },
    PRE_SALES: { accessB2B: false, accessB2G: false, accessPreSales: true, accessSimulador: true, accessManagement: false, accessAutomation: false },
    USER: { accessB2B: true, accessB2G: false, accessPreSales: false, accessSimulador: true, accessManagement: false, accessAutomation: false }
  }[normalizedRole] || { accessB2B: true, accessB2G: false, accessPreSales: false, accessSimulador: true, accessManagement: false, accessAutomation: false };

  const accessB2B = currentAccess.accessB2B !== undefined ? Boolean(currentAccess.accessB2B) : defaults.accessB2B;
  const accessB2G = currentAccess.accessB2G !== undefined ? Boolean(currentAccess.accessB2G) : defaults.accessB2G;
  const accessPreSales = currentAccess.accessPreSales !== undefined ? Boolean(currentAccess.accessPreSales) : defaults.accessPreSales;
  const accessSimulador = currentAccess.accessSimulador !== undefined ? Boolean(currentAccess.accessSimulador) : defaults.accessSimulador;
  const accessManagement = currentAccess.accessManagement !== undefined ? Boolean(currentAccess.accessManagement) : defaults.accessManagement;
  const accessAutomation = currentAccess.accessAutomation !== undefined ? Boolean(currentAccess.accessAutomation) : defaults.accessAutomation;

  return {
    accessB2B,
    accessB2G,
    accessPreSales,
    accessSimulador,
    accessManagement,
    accessAutomation
  };
};

const normalizeCompanyModuleAccess = (company) => {
  if (!company) company = {};
  const accessB2B = company.accessB2B !== undefined ? Boolean(company.accessB2B) : true;
  const accessB2G = company.accessB2G !== undefined ? Boolean(company.accessB2G) : false;
  const accessPreSales = company.accessPreSales !== undefined ? Boolean(company.accessPreSales) : false;
  const accessSimulador = company.accessSimulador !== undefined ? Boolean(company.accessSimulador) : true;
  const accessManagement = company.accessManagement !== undefined ? Boolean(company.accessManagement) : false;
  const accessAutomation = company.accessAutomation !== undefined ? Boolean(company.accessAutomation) : false;
  return {
    accessB2B,
    accessB2G,
    accessPreSales,
    accessSimulador,
    accessManagement,
    accessAutomation
  };
};

const companyModuleBadges = (company = {}) => {
  const access = normalizeCompanyModuleAccess(company);
  return [
    access.accessB2B && 'B2B',
    access.accessB2G && 'B2G',
    access.accessPreSales && 'Pré-vendas',
    access.accessSimulador && 'Simulador',
    access.accessManagement && 'Gestão',
    access.accessAutomation && 'Automações'
  ].filter(Boolean);
};

const MODULE_ACCESS_ITEMS = [
  { key: 'accessB2B', label: 'B2B', description: 'CRM comercial, empresas, oportunidades e propostas.' },
  { key: 'accessB2G', label: 'B2G', description: 'Licitações, editais, análises e pipeline de governo.' },
  { key: 'accessPreSales', label: 'Pré-vendas', description: 'Solicitações, orçamentos, calculadoras e apoio técnico.' },
  { key: 'accessSimulador', label: 'Simulador', description: 'Calculadoras avançadas de precificação e simulações.' },
  { key: 'accessManagement', label: 'Gestão', description: 'Projetos, kickoff, pós-venda e relatórios operacionais.' },
  { key: 'accessAutomation', label: 'Automações', description: 'Fluxos automáticos, integrações e jornadas.' }
];

const constrainAccessToCompanyModules = (access, company) => {
  if (!access) access = {};
  if (!company) company = {};
  const companyAccess = normalizeCompanyModuleAccess(company);
  return {
    accessB2B: Boolean(access.accessB2B && companyAccess.accessB2B),
    accessB2G: Boolean(access.accessB2G && companyAccess.accessB2G),
    accessPreSales: Boolean(access.accessPreSales && companyAccess.accessPreSales),
    accessSimulador: Boolean(access.accessSimulador && companyAccess.accessSimulador),
    accessManagement: Boolean(access.accessManagement && companyAccess.accessManagement),
    accessAutomation: Boolean(access.accessAutomation && companyAccess.accessAutomation)
  };
};

const SETTINGS_TABS = [
  { id: 'perfil', label: 'Perfil', icon: '👤' },
  { id: 'empresa', label: 'Empresa', icon: '🏢' },
  { id: 'plano_contratado', label: 'Plano Contratado', icon: '📄', adminOnly: true, settingsRouteOnly: true },
  { id: 'politicas_role', label: 'Políticas por Role', icon: '🧭', adminOnly: true, settingsRouteOnly: true },
  { id: 'avisos', label: 'Avisos', icon: '🔔' },
  { id: 'seguranca', label: 'Segurança', icon: '🔒' },
  { id: 'backup', label: 'Backup', icon: '💾' },
  { id: 'usuarios_acessos', label: 'Usuários e Acessos', icon: '👥' },
  { id: 'gestao_empresas', label: 'Gestão de Empresas', icon: '🏛️', masterOnly: true, adminRouteOnly: true },
  { id: 'licenciamento', label: 'Administração de Licenças', icon: '🛡️', masterOnly: true, adminRouteOnly: true }
];

const ROLE_POLICY_VISIBLE_ROLES = ['USER', 'PRE_SALES', 'ADMIN', 'MASTER'];
const ROLE_POLICY_EDITABLE_ROLES = ['USER', 'PRE_SALES', 'ADMIN'];

const ROLE_POLICY_ACCESS_KEYS = MODULE_ACCESS_ITEMS.map((item) => item.key);
const buildRolePolicyDraft = (role, company) => {
  const normalizedRole = normalizeRole(role);
  const stored = company?.rolePolicyOverrides?.[normalizedRole] || {};
  const moduleAccess = constrainAccessToCompanyModules(
    {
      ...resolveAccessByRole(normalizedRole, {}),
      ...(stored.moduleAccess && typeof stored.moduleAccess === 'object' ? stored.moduleAccess : {})
    },
    company
  );
  const permissions = {
    ...getRolePolicy(normalizedRole),
    ...(stored.permissions && typeof stored.permissions === 'object' ? stored.permissions : {})
  };

  return { moduleAccess, permissions };
};

const buildRolePolicyDrafts = (roles, company) => {
  return roles.reduce((acc, role) => {
    acc[role] = buildRolePolicyDraft(role, company);
    return acc;
  }, {});
};

const extractCollection = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.companies)) return payload.companies;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
};

const normalizeCompanyForManagement = (company, source = 'licensing', index = 0) => {
  const status = String(company?.status || (company?.isActive ? 'ACTIVE' : '') || '')
    .trim()
    .toUpperCase();

  const usersCountRaw =
    company?.usersCount ??
    company?._count?.users ??
    (Array.isArray(company?.users) ? company.users.length : null);

  const usersCount = Number.isFinite(Number(usersCountRaw)) ? Number(usersCountRaw) : null;

  return {
    id: String(company?.id || `${source}-${index}`),
    source,
    name: String(company?.name || 'Empresa sem nome'),
    legalName: company?.legalName || null,
    email: company?.email || null,
    phone: company?.phone || null,
    cnpj: company?.cnpj || company?.document || null,
    planName: company?.license?.plan?.name || company?.planName || (source === 'operational' ? 'Operacional' : 'Sem plano'),
    status: status || 'ACTIVE',
    usersCount,
    adminsCount:
      company?.adminsCount ??
      (Array.isArray(company?.users)
        ? company.users.filter((user) => normalizeRole(user?.role) === 'ADMIN').length
        : null),
    users: Array.isArray(company?.users) ? company.users : [],
    contacts: Array.isArray(company?.contacts) ? company.contacts : [],
    opportunitiesCount:
      company?._count?.opportunities ??
      (Array.isArray(company?.opportunities) ? company.opportunities.length : null),
    segment: company?.segment || null,
    size: company?.size || null,
    leadScore: company?.leadScore ?? null,
    churnRisk: company?.churnRisk ?? null,
    address: company?.address || null,
    city: company?.city || null,
    state: company?.state || null,
    country: company?.country || null,
    notes: company?.notes || null,
    ...normalizeCompanyModuleAccess(company),
    rolePolicyOverrides:
      company?.rolePolicyOverrides && typeof company.rolePolicyOverrides === 'object'
        ? company.rolePolicyOverrides
        : {},
    license: company?.license || null,
    createdAt: company?.createdAt || null,
    updatedAt: company?.updatedAt || null
  };
};

const getCompanyStatusMeta = (status) => {
  const normalized = String(status || '').trim().toUpperCase();

  if (normalized === 'ACTIVE') {
    return {
      label: '✓ Ativo',
      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    };
  }

  if (normalized === 'LEAD') {
    return {
      label: 'Lead',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
    };
  }

  if (normalized === 'PROSPECT') {
    return {
      label: 'Aguardando aprovação',
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/70 dark:text-amber-100'
    };
  }

  if (normalized === 'SUSPENDED') {
    return {
      label: 'Suspenso',
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    };
  }

  if (normalized === 'CANCELED') {
    return {
      label: 'Cancelado',
      className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
  }

  return {
    label: normalized || 'Indefinido',
    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
  };
};

const DEFAULT_COMPANY_FORM = {
  companyName: '',
  document: '',
  email: '',
  phone: '',
  responsibleName: '',
  responsibleEmail: '',
  responsiblePhone: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
  adminConfirmPassword: '',
  planCode: 'MENSAL',
  status: 'PROSPECT',
  accessB2B: true,
  accessB2G: false,
  accessPreSales: false,
  accessManagement: false,
  accessAutomation: false
};

const formatDateLabel = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

export default function Administracao() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('perfil');
  const [users, setUsers] = useState([]);
  const [regions, setRegions] = useState([]);
  const [settings, setSettings] = useState({ appName: '', logoUrl: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    tenantCompanyId: '',
    regionId: '',
    quota: '',
    accessB2B: true,
    accessB2G: true,
    accessPreSales: false,
    accessManagement: false,
    accessAutomation: false,
    isCompanyOwner: false
  });
  const [savingUser, setSavingUser] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [integrationPartners, setIntegrationPartners] = useState([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerForm, setPartnerForm] = useState(DEFAULT_PARTNER_FORM);
  const [savingPartner, setSavingPartner] = useState(false);
  const [rotatingSecretId, setRotatingSecretId] = useState(null);
  const [latestCredentials, setLatestCredentials] = useState(null);
  const [licensingPlans, setLicensingPlans] = useState([]);
  const [licensingCompanies, setLicensingCompanies] = useState([]);
  const [loadingLicensing, setLoadingLicensing] = useState(false);
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [companyForm, setCompanyForm] = useState({ ...DEFAULT_COMPANY_FORM });
  const [savingCompany, setSavingCompany] = useState(false);
  const [licenseDrafts, setLicenseDrafts] = useState({});
  const [savingLicenseFor, setSavingLicenseFor] = useState(null);
  const [showCompanyUserModal, setShowCompanyUserModal] = useState(false);
  const [targetCompanyForUser, setTargetCompanyForUser] = useState(null);
  const [companyUserForm, setCompanyUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'USER',
    accessB2B: true,
    accessB2G: true,
    accessPreSales: false,
    accessManagement: false,
    accessAutomation: false
  });
  const [savingCompanyUser, setSavingCompanyUser] = useState(false);
  const [rolePolicyDrafts, setRolePolicyDrafts] = useState({});
  const [savingRolePolicies, setSavingRolePolicies] = useState(false);
  const [alertsPrefs, setAlertsPrefs] = useState({
    email: true,
    push: true,
    licensing: true,
    security: true,
    reports: false
  });
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [securityForm, setSecurityForm] = useState({
    email: '',
    newPassword: '',
    confirmPassword: '',
    recoveryCode: ''
  });
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [showCompanyDetailsModal, setShowCompanyDetailsModal] = useState(false);
  const [selectedCompanyDetails, setSelectedCompanyDetails] = useState(null);
  const [loadingCompanyDetails, setLoadingCompanyDetails] = useState(false);
  const [showCompanyEditModal, setShowCompanyEditModal] = useState(false);
  const [editingManagementCompany, setEditingManagementCompany] = useState(null);
  const [companyEditForm, setCompanyEditForm] = useState({
    name: '',
    legalName: '',
    cnpj: '',
    email: '',
    phone: '',
    status: 'PROSPECT',
    segment: '',
    notes: '',
    accessB2B: true,
    accessB2G: false,
    accessPreSales: false,
    accessManagement: false,
    accessAutomation: false
  });
  const [savingCompanyEdit, setSavingCompanyEdit] = useState(false);
  const [approvingCompanyId, setApprovingCompanyId] = useState(null);
  const [savingSecurity, setSavingSecurity] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupResult, setBackupResult] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreFileInfo, setRestoreFileInfo] = useState(null);
  const [restoreSuccessData, setRestoreSuccessData] = useState(null);
  const [routineStatus, setRoutineStatus] = useState(null);
  const [routineLoading, setRoutineLoading] = useState(false);
  const [activeBackupSubTab, setActiveBackupSubTab] = useState('rotina');
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    description: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isDanger: true,
    onConfirm: null
  });

  const closeConfirm = () => {
    setConfirmDialog((prev) => ({ ...prev, isOpen: false, onConfirm: null }));
  };
  const sessionUser = useMemo(() => {
    try {
      const userRaw = localStorage.getItem('user');
      const u = userRaw ? JSON.parse(userRaw) : null;
      if (u) {
        const email = String(u.email || '').trim().toLowerCase();
        if (email === 'admin@crm.com' || email === 'chorstconsult@gmail.com') {
          u.role = 'MASTER';
        }
      }
      return u;
    } catch {
      return null;
    }
  }, []);
  const isMasterSession = normalizeRole(sessionUser?.role, sessionUser) === 'MASTER';
  const isAdminSession = normalizeRole(sessionUser?.role, sessionUser) === 'ADMIN';
  const isAdministrationRoute = location.pathname.startsWith('/administracao');
  const defaultTab = isAdministrationRoute
    ? (isMasterSession ? 'gestao_empresas' : 'usuarios_acessos')
    : (isAdminSession ? 'plano_contratado' : 'perfil');
  const availableTabs = useMemo(
    () =>
      SETTINGS_TABS.filter((tab) => {
        if (tab.masterOnly && !isMasterSession) return false;
        if (tab.adminOnly && !isMasterSession && !isAdminSession) return false;
        if (tab.adminRouteOnly && !isAdministrationRoute) return false;
        if (tab.settingsRouteOnly && isAdministrationRoute) return false;
        return true;
      }),
    [isAdministrationRoute, isAdminSession, isMasterSession]
  );
  const rolePolicyVisibleRoles = useMemo(
    () => (isMasterSession ? ROLE_POLICY_VISIBLE_ROLES : ['USER', 'PRE_SALES', 'ADMIN']),
    [isMasterSession]
  );
  const validTabIds = useMemo(() => new Set(availableTabs.map((tab) => tab.id)), [availableTabs]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabFromQuery = String(params.get('tab') || '').trim();
    if (tabFromQuery && validTabIds.has(tabFromQuery)) {
      setActiveTab(tabFromQuery);
      return;
    }

    setActiveTab(defaultTab);
  }, [defaultTab, location.search, validTabIds]);

  useEffect(() => {
    if (validTabIds.has(activeTab)) return;
    setActiveTab(defaultTab);
  }, [activeTab, defaultTab, validTabIds]);

  const licensingSummary = useMemo(
    () => ({
      totalCompanies: licensingCompanies.length,
      activeLicenses: licensingCompanies.filter((company) => company?.license?.status === 'ACTIVE').length
    }),
    [licensingCompanies]
  );
  const contractedCompany = useMemo(() => {
    if (!licensingCompanies.length) return null;
    if (isMasterSession && sessionUser?.tenantCompanyId) {
      return licensingCompanies.find((company) => company.id === sessionUser.tenantCompanyId) || licensingCompanies[0];
    }
    return licensingCompanies[0];
  }, [isMasterSession, licensingCompanies, sessionUser?.tenantCompanyId]);
  const contractedCompanyAccess = useMemo(
    () => normalizeCompanyModuleAccess(contractedCompany || {}),
    [contractedCompany]
  );

  useEffect(() => {
    if (!contractedCompany) {
      setRolePolicyDrafts({});
      return;
    }

    setRolePolicyDrafts(buildRolePolicyDrafts(rolePolicyVisibleRoles, contractedCompany));
  }, [contractedCompany, rolePolicyVisibleRoles]);

  const resetSessionAndGoToLogin = (message) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true, state: { message } });
  };

  const loadManagementCompanies = async () => {
    console.log('🔵 loadManagementCompanies chamada');
    console.log('👤 isMasterSession:', isMasterSession);
    
    // Gestão global de empresas é exclusiva do MASTER.
    if (!isMasterSession) {
      console.log('⚠️  Usuário não é MASTER, não pode acessar gestão de empresas');
      setCompanies([]);
      setLoadingCompanies(false);
      return;
    }
    
    setLoadingCompanies(true);
    try {
      console.log('📡 Buscando empresas do licensing...');
      const licensingRes = await fetch(API_ENDPOINTS.licensing.companies, {
        headers: getAuthHeaders()
      });

      console.log('📡 Response status:', licensingRes.status);

      if (licensingRes.ok) {
        const licensingPayload = await licensingRes.json().catch(() => ({}));
        console.log('📦 Payload do licensing:', licensingPayload);
        const licensingCompaniesList = extractCollection(licensingPayload);
        console.log('📋 Empresas encontradas:', licensingCompaniesList.length);
        setCompanies(
          licensingCompaniesList.map((company, index) => normalizeCompanyForManagement(company, 'licensing', index))
        );
        return;
      } else if (licensingRes.status === 403 || licensingRes.status === 401) {
        console.log('⚠️  Sem permissão para acessar empresas de licenciamento');
        setCompanies([]);
        return;
      }

      console.log('❌ Erro ao buscar empresas de licenciamento:', licensingRes.status);
      setCompanies([]);
    } catch (err) {
      console.error('❌ Erro ao carregar empresas:', err);
      setCompanies([]);
    } finally {
      setLoadingCompanies(false);
      console.log('✅ loadManagementCompanies finalizada');
    }
  };

  const openCompanyDetails = async (company) => {
    setSelectedCompanyDetails(company || null);
    setShowCompanyDetailsModal(true);

    if (!company?.id) return;

    setLoadingCompanyDetails(true);
    try {
      if (company.source === 'operational') {
        const res = await fetch(`${API_ENDPOINTS.companies}?id=${encodeURIComponent(company.id)}`, {
          headers: getAuthHeaders()
        });

        if (res.ok) {
          const payload = await res.json().catch(() => null);
          if (payload && typeof payload === 'object') {
            setSelectedCompanyDetails(normalizeCompanyForManagement(payload, 'operational'));
          }
        }
        return;
      }

      if (company.source === 'licensing') {
        const res = await fetch(API_ENDPOINTS.licensing.companyUsers(company.id), {
          headers: getAuthHeaders()
        });

        if (res.ok) {
          const payload = await res.json().catch(() => ({}));
          const users = extractCollection(payload);
          setSelectedCompanyDetails((prev) => ({
            ...(prev || {}),
            users,
            usersCount: users.length,
            adminsCount: users.filter((user) => normalizeRole(user?.role) === 'ADMIN').length
          }));
        }
      }
    } catch (err) {
      console.error('Erro ao carregar detalhes da empresa:', err);
    } finally {
      setLoadingCompanyDetails(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    // Carregar empresas quando a tab for acessada
    if (isAdministrationRoute && activeTab === 'gestao_empresas' && isMasterSession) {
      loadManagementCompanies();
    }
  }, [activeTab, isAdministrationRoute, isMasterSession]);

  useEffect(() => {
    if (sessionUser?.email) {
      setSecurityForm((prev) => ({ ...prev, email: sessionUser.email }));
    }

    try {
      const stored = localStorage.getItem('crm_alerts_prefs_v1');
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        setAlertsPrefs((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // No-op
    }
  }, [sessionUser]);

  const loadIntegrationPartners = async () => {
    try {
      setLoadingPartners(true);

      const res = await fetch(API_ENDPOINTS.integration.partners, {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        // Mantém UX estável mesmo se rota não estiver disponível no ambiente atual
        if (res.status !== 404) {
          throw new Error(`Erro ao carregar parceiros de integração: ${res.status}`);
        }
        setIntegrationPartners([]);
        return;
      }

      const data = await res.json();
      setIntegrationPartners(Array.isArray(data?.data) ? data.data : []);
    } catch (e) {
      console.error(e);
      setError((prev) => prev || e.message || 'Erro ao carregar parceiros de integração');
      setIntegrationPartners([]);
    } finally {
      setLoadingPartners(false);
    }
  };

  const buildLicenseDraft = (company) => {
    const activeLicense = company?.license || null;
    const fallbackPlanId = licensingPlans?.[0]?.id || '';

    return {
      planId: activeLicense?.plan?.id || fallbackPlanId,
      status: activeLicense?.status || 'ACTIVE',
      startDate: toDateInput(activeLicense?.startDate) || toDateInput(new Date()),
      endDate: toDateInput(activeLicense?.endDate),
      priceAtPurchase: activeLicense?.priceAtPurchase ?? activeLicense?.plan?.price ?? '',
      seats: activeLicense?.seats ?? activeLicense?.plan?.seatsIncluded ?? 1,
      notes: activeLicense?.notes || '',
      paymentStatus: activeLicense?.paymentStatus || 'CONFIRMED',
      paymentReference: ''
    };
  };

  const loadLicensingData = async () => {
    if (!isMasterSession && !isAdminSession) {
      setLicensingPlans([]);
      setLicensingCompanies([]);
      setLicenseDrafts({});
      return;
    }

    try {
      setLoadingLicensing(true);
      const [plansRes, companiesRes] = await Promise.all([
        isMasterSession
          ? fetch(API_ENDPOINTS.licensing.plans, { headers: getAuthHeaders() })
          : Promise.resolve({ ok: true, json: async () => ({ data: [] }) }),
        fetch(API_ENDPOINTS.licensing.companies, { headers: getAuthHeaders() })
      ]);

      const plansData = plansRes.ok ? await plansRes.json().catch(() => ({})) : {};
      const companiesData = companiesRes.ok ? await companiesRes.json().catch(() => ({})) : {};

      const plans = extractCollection(plansData);
      const companies = extractCollection(companiesData);

      setLicensingPlans(plans);
      setLicensingCompanies(companies);

      const draftMap = {};
      companies.forEach((company) => {
        draftMap[company.id] = {
          ...buildLicenseDraft(company),
          planId: company?.license?.plan?.id || plans?.[0]?.id || ''
        };
      });
      setLicenseDrafts(draftMap);
    } catch (e) {
      console.error(e);
      setError((prev) => prev || e.message || 'Erro ao carregar dados de licenciamento');
    } finally {
      setLoadingLicensing(false);
    }
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const [usersRes, regionsRes, settingsRes] = await Promise.all([
        fetch(API_ENDPOINTS.users, { headers: getAuthHeaders() }),
        fetch(API_ENDPOINTS.regions, { headers: getAuthHeaders() }),
        fetch(API_ENDPOINTS.settings, { headers: getAuthHeaders() })
      ]);

      if ([usersRes, regionsRes, settingsRes].some((response) => response.status === 401)) {
        resetSessionAndGoToLogin('Sessão expirada ou alterada pela restauração do backup. Faça login novamente.');
        return;
      }

      if (!usersRes.ok) throw new Error(`Erro ao carregar usuários: ${usersRes.status}`);
      if (!regionsRes.ok) throw new Error(`Erro ao carregar regiões: ${regionsRes.status}`);
      if (!settingsRes.ok) throw new Error(`Erro ao carregar configurações: ${settingsRes.status}`);

      const [usersData, regionsData, settingsData] = await Promise.all([
        usersRes.json(),
        regionsRes.json(),
        settingsRes.json()
      ]);

      setUsers(Array.isArray(usersData) ? usersData : []);
      setRegions(Array.isArray(regionsData) ? regionsData : []);
      setSettings({
        appName: settingsData?.appName || '',
        logoUrl: settingsData?.logoUrl || null
      });

      if (isMasterSession || isAdminSession) {
        await loadLicensingData();
      } else {
        setLicensingPlans([]);
        setLicensingCompanies([]);
        setLicenseDrafts({});
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const openNewUser = () => {
    const userRolePolicy = rolePolicyDrafts.USER || buildRolePolicyDraft('USER', contractedCompany);
    const defaultAccess = isMasterSession
      ? resolveAccessByRole('USER', userRolePolicy.moduleAccess)
      : constrainAccessToCompanyModules(userRolePolicy.moduleAccess, contractedCompany);

    setEditingUser(null);
    setUserForm({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      tenantCompanyId: isMasterSession ? '' : contractedCompany?.id || '',
      regionId: '',
      quota: '',
      commissionSalePercentage: '',
      commissionProject12: '',
      commissionProject24: '',
      commissionProject36: '',
      commissionProject48: '',
      commissionProject60: '',
      ...defaultAccess,
      isCompanyOwner: false
    });
    setShowUserModal(true);
  };

  const openEditUser = (user) => {
    const normalizedRole = normalizeRole(user?.role || 'USER');
    const resolvedAccess = resolveAccessByRole(normalizedRole, {
      accessB2B: user?.accessB2B,
      accessB2G: user?.accessB2G,
      accessPreSales: user?.accessPreSales,
      accessManagement: user?.accessManagement,
      accessAutomation: user?.accessAutomation
    });
    const safeAccess = isMasterSession ? resolvedAccess : constrainAccessToCompanyModules(resolvedAccess, contractedCompany);

    setEditingUser(user);
    setUserForm({
      name: user?.name || '',
      email: user?.email || '',
      password: '',
      role: normalizedRole,
      tenantCompanyId: user?.tenantCompanyId || user?.tenantCompany?.id || '',
      regionId: user?.region?.id || user?.regionId || '',
      quota: typeof user?.quota === 'number' ? String(user.quota) : '',
      commissionSalePercentage: user?.commissionSalePercentage != null ? String(user.commissionSalePercentage) : '',
      commissionProject12: user?.commissionProject12 != null ? String(user.commissionProject12) : '',
      commissionProject24: user?.commissionProject24 != null ? String(user.commissionProject24) : '',
      commissionProject36: user?.commissionProject36 != null ? String(user.commissionProject36) : '',
      commissionProject48: user?.commissionProject48 != null ? String(user.commissionProject48) : '',
      commissionProject60: user?.commissionProject60 != null ? String(user.commissionProject60) : '',
      accessB2B: safeAccess.accessB2B,
      accessB2G: safeAccess.accessB2G,
      accessPreSales: safeAccess.accessPreSales,
      accessManagement: safeAccess.accessManagement,
      accessAutomation: safeAccess.accessAutomation,
      isCompanyOwner: user?.isCompanyOwner !== undefined ? Boolean(user.isCompanyOwner) : false
    });
    setShowUserModal(true);
  };

  const saveUser = async (e) => {
    e.preventDefault();

    try {
      setSavingUser(true);
      setError(null);

      const userAccess = isMasterSession
        ? userForm
        : constrainAccessToCompanyModules(userForm, contractedCompany);
      const payload = {
        name: userForm.name?.trim(),
        email: userForm.email?.trim(),
        role: normalizeRole(userForm.role),
        tenantCompanyId: userForm.tenantCompanyId || null,
        regionId: userForm.regionId || null,
        quota: userForm.quota === '' ? null : Number(userForm.quota),
        commissionSalePercentage: userForm.commissionSalePercentage === '' ? null : Number(userForm.commissionSalePercentage),
        commissionProject12: userForm.commissionProject12 === '' ? null : Number(userForm.commissionProject12),
        commissionProject24: userForm.commissionProject24 === '' ? null : Number(userForm.commissionProject24),
        commissionProject36: userForm.commissionProject36 === '' ? null : Number(userForm.commissionProject36),
        commissionProject48: userForm.commissionProject48 === '' ? null : Number(userForm.commissionProject48),
        commissionProject60: userForm.commissionProject60 === '' ? null : Number(userForm.commissionProject60),
        accessB2B: Boolean(userAccess.accessB2B),
        accessB2G: Boolean(userAccess.accessB2G),
        accessPreSales: Boolean(userAccess.accessPreSales),
        accessManagement: Boolean(userAccess.accessManagement),
        accessAutomation: Boolean(userAccess.accessAutomation),
        isCompanyOwner: Boolean(userForm.isCompanyOwner)
      };

      if (!editingUser) {
        if (!userForm.password) {
          throw new Error('Senha é obrigatória para novo usuário');
        }
        payload.password = userForm.password;
      } else if (userForm.password) {
        payload.password = userForm.password;
      }

      const res = await fetch(API_ENDPOINTS.users, {
        method: editingUser ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(editingUser ? { id: editingUser.id, ...payload } : payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Erro ao salvar usuário: ${res.status}`);
      }

      setShowUserModal(false);
      setEditingUser(null);
      await loadAll();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao salvar usuário');
    } finally {
      setSavingUser(false);
    }
  };

  const deleteUser = (user) => {
    if (!user?.id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Usuário',
      description: `Tem certeza que deseja excluir o usuário "${user.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir Usuário',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        closeConfirm();
        try {
          setError(null);
          const res = await fetch(API_ENDPOINTS.users, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify({ id: user.id })
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `Erro ao excluir usuário: ${res.status}`);
          await loadAll();
        } catch (e) {
          console.error(e);
          setError(e.message || 'Erro ao excluir usuário');
        }
      }
    });
  };

  const saveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setError(null);

      const res = await fetch(API_ENDPOINTS.settings, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          appName: settings.appName
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erro ao salvar configurações: ${res.status}`);
      const nextSettings = { appName: data?.appName || '', logoUrl: data?.logoUrl || null };
      setSettings(nextSettings);
      emitBrandingUpdated(nextSettings);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao salvar configurações');
    } finally {
      setSavingSettings(false);
    }
  };

  const uploadLogo = async () => {
    if (!logoFile) return;

    try {
      setLogoUploading(true);
      setError(null);

      const token = localStorage.getItem('token');
      const form = new FormData();
      form.append('file', logoFile);

      const res = await fetch(API_ENDPOINTS.settingsLogo, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erro ao enviar logo: ${res.status}`);

      const nextSettings = { appName: data?.appName || '', logoUrl: data?.logoUrl || null };
      setSettings(nextSettings);
      emitBrandingUpdated(nextSettings);
      setLogoFile(null);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao enviar logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const removeLogo = async () => {
    try {
      setSavingSettings(true);
      setError(null);

      const res = await fetch(API_ENDPOINTS.settings, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ logoUrl: '' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erro ao remover logo: ${res.status}`);

      const nextSettings = { appName: data?.appName || '', logoUrl: data?.logoUrl || null };
      setSettings(nextSettings);
      emitBrandingUpdated(nextSettings);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao remover logo');
    } finally {
      setSavingSettings(false);
    }
  };

  const saveAlertsPreferences = async () => {
    try {
      setSavingAlerts(true);
      localStorage.setItem('crm_alerts_prefs_v1', JSON.stringify(alertsPrefs));
    } finally {
      setSavingAlerts(false);
    }
  };

  const updateSecurityPassword = async (e) => {
    e.preventDefault();
    try {
      setSavingSecurity(true);
      setError(null);
      setBackupResult('');

      if (!securityForm.email || !securityForm.newPassword || !securityForm.confirmPassword) {
        throw new Error('Preencha email, nova senha e confirmação');
      }

      if (securityForm.newPassword.length < 6) {
        throw new Error('A nova senha precisa ter ao menos 6 caracteres');
      }

      if (securityForm.newPassword !== securityForm.confirmPassword) {
        throw new Error('As senhas não conferem');
      }

      const res = await fetch(API_ENDPOINTS.auth.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: securityForm.email,
          newPassword: securityForm.newPassword,
          confirmPassword: securityForm.confirmPassword,
          recoveryCode: securityForm.recoveryCode
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erro ao atualizar senha: ${res.status}`);

      setBackupResult('Senha atualizada com sucesso.');
      setSecurityForm((prev) => ({
        ...prev,
        newPassword: '',
        confirmPassword: '',
        recoveryCode: ''
      }));
    } catch (e2) {
      console.error(e2);
      setError(e2.message || 'Erro ao atualizar senha');
    } finally {
      setSavingSecurity(false);
    }
  };

  const exportBackupSnapshot = async () => {
    try {
      setBackupLoading(true);
      setError(null);
      setBackupResult('');

      const res = await fetch(buildApiUrl('/admin/backup/export'), {
        headers: getAuthHeaders()
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Erro ao exportar backup completo: ${res.status}`);
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      const filenameMatch = disposition.match(/filename="?([^"]+)"?/i);
      const filename =
        filenameMatch?.[1] ||
        `nexoscrm-backup-completo-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);

      setBackupResult('Backup completo exportado com sucesso.');
    } catch (e2) {
      console.error(e2);
      setError(e2.message || 'Erro ao exportar backup');
    } finally {
      setBackupLoading(false);
    }
  };

  const fetchRoutineStatus = useCallback(async () => {
    try {
      setRoutineLoading(true);
      const res = await fetch(buildApiUrl('/admin/backup/routine-status'), {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setRoutineStatus(data);
      }
    } catch (e) {
      console.warn('Erro ao carregar status da rotina de backup:', e);
    } finally {
      setRoutineLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchRoutineStatus();
    }
  }, [activeTab, fetchRoutineStatus]);

  const performActualRestore = async (fileText, backupJson) => {
    const parseModuleData = (modules, key) => {
      const raw = modules?.[key];
      if (Array.isArray(raw)) return raw;
      if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.data)) return raw.data;
        if (Array.isArray(raw.items)) return raw.items;
      }
      return [];
    };

    const normalizeCompanyKey = (value) => String(value || '').trim().toLowerCase();

    const normalizeRecordForModule = (moduleName, record) => {
      if (!record || typeof record !== 'object') return null;

      if (moduleName === 'priceTables') {
        return {
          id: record.id,
          name: record.name || '',
          description: record.description || '',
          validFrom: record.validFrom || null,
          validUntil: record.validUntil || null,
          region: record.region || null,
          customerSegment: record.customerSegment || null,
          isDefault: Boolean(record.isDefault),
          prices: Array.isArray(record.prices)
            ? record.prices.map((item) => ({
                productId: item.productId || item.product?.id || '',
                price: Number(item.price || 0),
                minQuantity: Number(item.minQuantity || 1),
                maxQuantity: item.maxQuantity === null || item.maxQuantity === undefined ? null : Number(item.maxQuantity),
                discount: Number(item.discount || 0)
              }))
            : []
        };
      }

      if (moduleName === 'competitors') {
        return {
          id: record.id,
          name: record.name || '',
          website: record.website || null,
          strengths: record.strengths || null,
          weaknesses: record.weaknesses || null,
          pricing: record.pricing || null,
          marketShare: record.marketShare || null,
          notes: record.notes || null,
          isActive: record.isActive !== false
        };
      }

      if (moduleName === 'regions') {
        return {
          id: record.id,
          name: record.name || '',
          code: record.code || '',
          country: record.country || 'Brasil',
          state: record.state || '',
          city: record.city || '',
          isActive: record.isActive !== false
        };
      }

      if (moduleName === 'companies') {
        return {
          id: record.id,
          name: record.name || '',
          document: record.document || record.cnpj || null,
          email: record.email || null,
          phone: record.phone || null,
          status: record.status || 'ACTIVE',
          segment: record.segment || null,
          leadScore: record.leadScore ?? 0,
          notes: record.notes || null
        };
      }

      if (moduleName === 'products') {
        return {
          id: record.id,
          name: record.name || '',
          sku: record.sku || null,
          category: record.category || null,
          price: Number(record.price || 0),
          cost: Number(record.cost || 0),
          margin: Number(record.margin || 0),
          status: record.status || 'Ativo'
        };
      }

      if (moduleName === 'opportunities') {
        return {
          ...record,
          id: record.id || undefined
        };
      }

      if (moduleName === 'activities') {
        return {
          ...record,
          id: record.id || undefined
        };
      }

      if (moduleName === 'crossSell') {
        return {
          id: record.id,
          name: record.name || '',
          mainProductId: record.mainProductId || record.mainProduct?.id || '',
          suggestedProductId: record.suggestedProductId || record.suggestedProduct?.id || '',
          probability: Number(record.probability || 0),
          discount: Number(record.discount || 0),
          isActive: record.isActive !== false
        };
      }

      if (moduleName === 'upSell') {
        return {
          id: record.id,
          name: record.name || '',
          mainProductId: record.mainProductId || record.mainProduct?.id || '',
          targetProductId: record.targetProductId || record.targetProduct?.id || '',
          minQuantity: Number(record.minQuantity || 1),
          discount: Number(record.discount || 0),
          isActive: record.isActive !== false
        };
      }

      if (moduleName === 'approvals') {
        return {
          ...record,
          id: record.id || undefined
        };
      }

      return record;
    };

    try {
      setRestoreLoading(true);
      setError(null);
      setBackupResult('Iniciando restauração dos dados...');

      // 1. Tentar restaurar pelo endpoint centralizado /admin/backup/restore
      const isFull = backupJson?.format === 'nexoscrm-full-system-backup' || Boolean(backupJson?.database?.tables);
      
      try {
        const restoreRes = await fetch(buildApiUrl('/admin/backup/restore'), {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'X-Restore-Confirmation': 'RESTAURAR_BACKUP_COMPLETO'
          },
          body: fileText
        });
        const restoreData = await restoreRes.json().catch(() => ({}));

        if (restoreRes.ok) {
          setRestoreFile(null);
          setBackupResult(
            `Backup restaurado com sucesso: ${restoreData?.database?.tableCount || 0} tabela(s), ${restoreData?.database?.totalRows || 0} registro(s), ${restoreData?.uploads?.restoredFiles || 0} arquivo(s) de upload.`
          );
          resetSessionAndGoToLogin('Backup restaurado com sucesso. Faça login novamente com um usuário existente no backup restaurado.');
          return;
        }

        if (isFull) {
          const errorMsg =
            restoreData?.message ||
            restoreData?.error ||
            `Erro ao restaurar backup completo (${restoreRes.status})`;
          throw new Error(errorMsg);
        }
      } catch (err) {
        if (isFull) {
          throw err;
        }
        console.warn('Endpoint centralizado falhou, continuando restauração módulo a módulo:', err.message);
      }

      const modules = backupJson?.modules || {};
      const headers = getAuthHeaders();
      const restoreStats = {
        users: 0,
        modules: 0,
        settings: false
      };

      if (backupJson?.settings && typeof backupJson.settings === 'object') {
        const settingsPayload = {
          appName: String(backupJson.settings.appName || '').trim() || 'CRM NEXOS'
        };
        const settingsRes = await fetch(API_ENDPOINTS.settings, {
          method: 'PUT',
          headers,
          body: JSON.stringify(settingsPayload)
        });
        if (!settingsRes.ok) {
          const details = await settingsRes.json().catch(() => ({}));
          throw new Error(details?.error || 'Falha ao restaurar configurações da empresa');
        }
        restoreStats.settings = true;
      }

      const currentUsersRes = await fetch(API_ENDPOINTS.users, { headers });
      const currentUsers = currentUsersRes.ok ? await currentUsersRes.json().catch(() => []) : [];
      const currentUsersById = new Map((Array.isArray(currentUsers) ? currentUsers : []).map((item) => [String(item.id || ''), item]));
      const availableOwnerIds = new Set(
        (Array.isArray(currentUsers) ? currentUsers : []).map((item) => String(item.id || '')).filter(Boolean)
      );
      const currentCompaniesRes = await fetch(API_ENDPOINTS.companies, { headers });
      const currentCompanies = currentCompaniesRes.ok ? await currentCompaniesRes.json().catch(() => []) : [];
      const availableCompanyIds = new Set(
        (Array.isArray(currentCompanies) ? currentCompanies : []).map((item) => String(item.id || '')).filter(Boolean)
      );
      const currentCompanyIdByName = new Map(
        (Array.isArray(currentCompanies) ? currentCompanies : [])
          .filter((item) => item?.name)
          .map((item) => [normalizeCompanyKey(item.name), String(item.id || '')])
      );
      const sourceCompanies = parseModuleData(modules, 'companies');
      const sourceCompanyById = new Map(
        sourceCompanies
          .filter((item) => item?.id)
          .map((item) => [String(item.id), item])
      );
      const companyIdMap = new Map();
      const skippedUsers = [];
      const skippedOpportunities = [];
      const restoreOwnerFallbackId = String(sessionUser?.id || '').trim() || null;

      const usersToRestore = parseModuleData(modules, 'users');
      for (const rawUser of usersToRestore) {
        const email = String(rawUser?.email || '').trim().toLowerCase();
        const name = String(rawUser?.name || '').trim();
        if (!email || !name) continue;

        const existingById = currentUsersById.get(String(rawUser?.id || ''));
        const targetUser = existingById || null;
        const payload = {
          id: targetUser?.id,
          name,
          email,
          role: rawUser?.role || 'USER',
          active: rawUser?.active !== false,
          companyId: rawUser?.companyId || null
        };

        const res = await fetch(API_ENDPOINTS.users, {
          method: targetUser ? 'PUT' : 'POST',
          headers,
          body: JSON.stringify(targetUser ? payload : { ...payload, password: `Restore#${Math.floor(1000 + Math.random() * 9000)}` })
        });

        if (!res.ok) {
          const details = await res.json().catch(() => ({}));
          const reason = details?.error || `Falha ao restaurar usuário ${email}`;

          // Em restore multi-tenant, pode existir usuário de outra empresa ou email já existente.
          // Nesses casos, registra e continua para não bloquear os módulos.
          if (res.status === 403 || res.status === 409) {
            skippedUsers.push(`${email}: ${reason}`);
            continue;
          }

          throw new Error(reason);
        }

        const restoredUser = await res.json().catch(() => null);
        if (restoredUser?.id) {
          currentUsersById.set(String(restoredUser.id), restoredUser);
          availableOwnerIds.add(String(restoredUser.id));
        }
        restoreStats.users += 1;
      }

      const moduleEndpoints = [
        ['regions', API_ENDPOINTS.regions],
        ['companies', API_ENDPOINTS.companies],
        ['products', API_ENDPOINTS.products],
        ['priceTables', API_ENDPOINTS.priceTables],
        ['crossSell', API_ENDPOINTS.crossSell],
        ['upSell', API_ENDPOINTS.upsell],
        ['approvals', API_ENDPOINTS.approvals],
        ['opportunities', API_ENDPOINTS.opportunities],
        ['activities', API_ENDPOINTS.activities]
      ];

      for (const [moduleName, endpoint] of moduleEndpoints) {
        const items = parseModuleData(modules, moduleName);
        for (const item of items) {
          const sourceCompanyId = moduleName === 'companies'
            ? String(item?.id || '').trim()
            : String(item?.companyId || '').trim();
          const payload = normalizeRecordForModule(moduleName, item);
          if (!payload) continue;

          if (moduleName === 'companies') {
            // Para backend que ignora ID no create, removemos id do payload e mapeamos depois.
            delete payload.id;
          }

          if (moduleName === 'opportunities') {
            const mappedCompanyId = companyIdMap.get(sourceCompanyId) || sourceCompanyId;
            payload.companyId = mappedCompanyId || payload.companyId;

            if (!payload.companyId || !availableCompanyIds.has(String(payload.companyId))) {
              const sourceCompany = sourceCompanyById.get(sourceCompanyId);
              const fallbackCompanyId = sourceCompany?.name
                ? currentCompanyIdByName.get(normalizeCompanyKey(sourceCompany.name))
                : null;

              if (fallbackCompanyId) {
                payload.companyId = fallbackCompanyId;
              }
            }

            if (!payload.companyId || !availableCompanyIds.has(String(payload.companyId))) {
              skippedOpportunities.push(String(payload.title || payload.id || 'Sem título'));
              continue;
            }

            const ownerId = String(payload.ownerId || '').trim();
            if (!ownerId || !availableOwnerIds.has(ownerId)) {
              payload.ownerId = restoreOwnerFallbackId || undefined;
            }
          }

          const res = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload)
          });
          if (!res.ok) {
            const details = await res.json().catch(() => ({}));
            throw new Error(details?.error || `Falha ao restaurar módulo ${moduleName}`);
          }

          if (moduleName === 'companies') {
            const restoredCompany = await res.json().catch(() => null);
            const restoredCompanyId = String(restoredCompany?.id || '').trim();
            if (restoredCompanyId) {
              availableCompanyIds.add(restoredCompanyId);
              if (restoredCompany?.name) {
                currentCompanyIdByName.set(normalizeCompanyKey(restoredCompany.name), restoredCompanyId);
              }
              if (sourceCompanyId) {
                companyIdMap.set(sourceCompanyId, restoredCompanyId);
              }
            }
          }

          restoreStats.modules += 1;
        }
      }

      await loadAll();
      setRestoreFile(null);
      const skippedUsersNote =
        skippedUsers.length > 0
          ? `, ${skippedUsers.length} usuário(s) ignorado(s) por permissão/conflito`
          : '';
      const skippedOpportunitiesNote =
        skippedOpportunities.length > 0
          ? `, ${skippedOpportunities.length} oportunidade(s) ignorada(s) por empresa não mapeada`
          : '';
      setBackupResult(
        `Restauração concluída: ${restoreStats.users} usuário(s), ${restoreStats.modules} registro(s) de módulos${restoreStats.settings ? ', configurações aplicadas' : ''}${skippedUsersNote}${skippedOpportunitiesNote}.`
      );
    } catch (e2) {
      console.error(e2);
      setError(e2.message || 'Erro ao restaurar backup');
    } finally {
      setRestoreLoading(false);
    }
  };

  const restoreBackupSnapshot = async () => {
    if (!restoreFile) {
      setError('Selecione um arquivo de backup (.json) para restaurar.');
      return;
    }

    try {
      setError(null);
      setBackupResult('');

      const fileText = await restoreFile.text();
      let backupJson;
      try {
        backupJson = JSON.parse(fileText);
      } catch (parseErr) {
        throw new Error('Arquivo de backup inválido: o arquivo selecionado não contém um JSON válido.');
      }

      const isFull = backupJson?.format === 'nexoscrm-full-system-backup' || Boolean(backupJson?.database?.tables);
      const title = isFull ? 'Restaurar Backup Completo' : 'Restaurar Backup Modular';
      const description = isFull
        ? `A restauração completa vai substituir todas as tabelas do banco pelos dados do arquivo selecionado (${backupJson?.database?.tableCount || 0} tabela(s), ${backupJson?.database?.totalRows || 0} registro(s)).\n\nDeseja continuar com a restauração?`
        : 'Deseja restaurar os dados dos módulos (usuários, empresas, produtos, oportunidades, etc.) contidos neste arquivo de backup?';

      setConfirmDialog({
        isOpen: true,
        title,
        description,
        confirmText: isFull ? 'Restaurar Banco Completo' : 'Restaurar Módulos',
        cancelText: 'Cancelar',
        isDanger: Boolean(isFull),
        onConfirm: () => performActualRestore(fileText, backupJson)
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Erro ao processar arquivo de backup');
    }
  };

  const openNewPartner = () => {
    setPartnerForm(DEFAULT_PARTNER_FORM);
    setShowPartnerModal(true);
  };

  const savePartner = async (e) => {
    e.preventDefault();

    try {
      setSavingPartner(true);
      setError(null);

      const payload = {
        name: partnerForm.name?.trim(),
        type: partnerForm.type,
        provider: partnerForm.provider,
        partnerTier: partnerForm.partnerTier,
        scopes: parseScopes(partnerForm.scopes),
        webhookUrl: partnerForm.webhookUrl?.trim() || undefined,
        rateLimitPerMinute:
          partnerForm.rateLimitPerMinute === '' ? undefined : Number(partnerForm.rateLimitPerMinute)
      };

      if (!payload.name) {
        throw new Error('Nome do parceiro é obrigatório');
      }

      const res = await fetch(API_ENDPOINTS.integration.partners, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error?.message || data?.error || `Erro ao criar parceiro: ${res.status}`);
      }

      const credentials = data?.data?.credentials || null;
      const partner = data?.data?.partner || null;

      if (credentials && partner) {
        setLatestCredentials({
          partnerName: partner.name,
          ...credentials
        });
      }

      setShowPartnerModal(false);
      setPartnerForm(DEFAULT_PARTNER_FORM);
      await loadIntegrationPartners();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao criar parceiro');
    } finally {
      setSavingPartner(false);
    }
  };

  const rotatePartnerSecret = (partner) => {
    if (!partner?.id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Rotacionar Credenciais',
      description: `Rotacionar credenciais OAuth2 do parceiro "${partner.name}"? As credenciais anteriores serão invalidadas imediatamente.`,
      confirmText: 'Rotacionar',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        try {
          setRotatingSecretId(partner.id);
          setError(null);

          const res = await fetch(API_ENDPOINTS.integration.rotateSecret(partner.id), {
            method: 'POST',
            headers: getAuthHeaders()
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            throw new Error(data?.error?.message || data?.error || `Erro ao rotacionar segredo: ${res.status}`);
          }

          const credentials = data?.data?.credentials || null;
          if (credentials) {
            setLatestCredentials({
              partnerName: partner.name,
              ...credentials
            });
          }

          await loadIntegrationPartners();
        } catch (e) {
          console.error(e);
          setError(e.message || 'Erro ao rotacionar segredo');
        } finally {
          setRotatingSecretId(null);
        }
      }
    });
  };

  const openNewCompany = () => {
    setCompanyForm({ ...DEFAULT_COMPANY_FORM });
    setShowCompanyModal(true);
  };

  const createCompany = async (e) => {
    e.preventDefault();
    try {
      setSavingCompany(true);
      setError(null);

      // Validações
      if (!companyForm.companyName?.trim()) {
        throw new Error('Nome da empresa é obrigatório');
      }
      if (!companyForm.document?.trim()) {
        throw new Error('CNPJ é obrigatório');
      }
      if (!companyForm.email?.trim()) {
        throw new Error('Email da empresa é obrigatório');
      }
      if (!companyForm.phone?.trim()) {
        throw new Error('Telefone da empresa é obrigatório');
      }
      if (!companyForm.responsibleName?.trim()) {
        throw new Error('Nome do responsável é obrigatório');
      }
      if (!companyForm.responsibleEmail?.trim()) {
        throw new Error('Email do responsável é obrigatório');
      }
      if (!companyForm.responsiblePhone?.trim()) {
        throw new Error('Telefone do responsável é obrigatório');
      }
      if (!companyForm.adminName?.trim()) {
        throw new Error('Nome do administrador é obrigatório');
      }
      if (!companyForm.adminEmail?.trim()) {
        throw new Error('Email do administrador é obrigatório');
      }
      if (!companyForm.adminPassword || companyForm.adminPassword.length < 6) {
        throw new Error('Senha do administrador deve ter no mínimo 6 caracteres');
      }
      if (companyForm.adminPassword !== companyForm.adminConfirmPassword) {
        throw new Error('As senhas do administrador não conferem');
      }

      // Usar a API de confirmação de checkout para criar empresa, licença e usuário admin pendentes de aprovação.
      const payload = {
        paymentId: 'MANUAL-' + Date.now(),
        paymentReference: 'MANUAL-' + Date.now(),
        paymentStatus: 'CONFIRMED',
        planCode: companyForm.planCode || 'MENSAL',
        company: {
          name: companyForm.companyName.trim(),
          email: companyForm.email.trim(),
          cnpj: companyForm.document.trim(),
          phone: companyForm.phone.trim(),
          accessB2B: Boolean(companyForm.accessB2B),
          accessB2G: Boolean(companyForm.accessB2G),
          accessPreSales: Boolean(companyForm.accessPreSales),
          accessManagement: Boolean(companyForm.accessManagement),
          accessAutomation: Boolean(companyForm.accessAutomation)
        },
        adminUser: {
          name: companyForm.adminName.trim(),
          email: companyForm.adminEmail.trim(),
          password: companyForm.adminPassword
        }
      };

      console.log('📤 Criando empresa via API de checkout:', payload);

      const res = await fetch(API_ENDPOINTS.licensing.publicCheckoutConfirm, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        throw new Error(data?.error || `Erro ao criar empresa: ${res.status}`);
      }

      console.log('✅ Empresa criada com sucesso:', data);

      setShowCompanyModal(false);
      setCompanyForm({ ...DEFAULT_COMPANY_FORM });

      // Recarregar lista de empresas
      await loadManagementCompanies();
      
      // Mostrar mensagem de sucesso
      alert(`Empresa "${companyForm.companyName}" cadastrada e aguardando aprovação do MASTER.\n\nUsuário Admin:\nEmail: ${companyForm.adminEmail}\nSenha: ${companyForm.adminPassword}\n\nConfira módulos e políticas de acesso em Gestão de Empresas antes de aprovar.`);
      
    } catch (e) {
      console.error('❌ Erro ao criar empresa:', e);
      setError(e.message || 'Erro ao criar empresa');
    } finally {
      setSavingCompany(false);
    }
  };

  const updateLicenseDraft = (companyId, patch) => {
    setLicenseDrafts((prev) => ({
      ...prev,
      [companyId]: {
        ...(prev[companyId] || {}),
        ...patch
      }
    }));
  };

  const saveCompanyLicense = async (company) => {
    if (!company?.id) return;
    const draft = licenseDrafts[company.id];
    if (!draft?.planId) {
      setError('Selecione um plano para salvar a licença');
      return;
    }

    try {
      setSavingLicenseFor(company.id);
      setError(null);

      const payload = {
        planId: draft.planId,
        status: draft.status,
        startDate: draft.startDate || undefined,
        endDate: draft.endDate || undefined,
        priceAtPurchase:
          draft.priceAtPurchase === '' || draft.priceAtPurchase === null
            ? undefined
            : Number(draft.priceAtPurchase),
        seats: draft.seats === '' || draft.seats === null ? undefined : Number(draft.seats),
        notes: draft.notes || undefined,
        paymentStatus: draft.paymentStatus || 'CONFIRMED',
        paymentReference: draft.paymentReference || undefined
      };

      const res = await fetch(API_ENDPOINTS.licensing.companyLicense(company.id), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erro ao salvar licença: ${res.status}`);

      await loadLicensingData();
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao salvar licença');
    } finally {
      setSavingLicenseFor(null);
    }
  };

  const approveCompany = (company) => {
    if (!company?.id) return;
    const modules = companyModuleBadges(company).join(', ') || 'nenhum módulo';
    setConfirmDialog({
      isOpen: true,
      title: 'Aprovar Empresa',
      description: `Aprovar a empresa "${company.name}"?\n\nConfira antes de aprovar:\n- Plano: ${company.planName || 'Sem plano'}\n- Módulos liberados: ${modules}\n- Políticas de acesso conforme a compra\n\nApós aprovar, o admin da empresa poderá acessar o sistema.`,
      confirmText: 'Aprovar Empresa',
      cancelText: 'Cancelar',
      isDanger: false,
      onConfirm: async () => {
        try {
          setApprovingCompanyId(company.id);
          setError(null);

          const res = await fetch(API_ENDPOINTS.licensing.approveCompany(company.id), {
            method: 'POST',
            headers: getAuthHeaders()
          });

          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `Erro ao aprovar empresa: ${res.status}`);

          await Promise.all([loadLicensingData(), loadManagementCompanies()]);
        } catch (e) {
          console.error(e);
          setError(e.message || 'Erro ao aprovar empresa');
        } finally {
          setApprovingCompanyId(null);
        }
      }
    });
  };

  const openEditManagementCompany = (company) => {
    if (!company?.id) return;
    setEditingManagementCompany(company);
    setCompanyEditForm({
      name: String(company?.name || ''),
      legalName: String(company?.legalName || ''),
      cnpj: String(company?.cnpj || ''),
      email: String(company?.email || ''),
      phone: String(company?.phone || ''),
      status: String(company?.status || 'ACTIVE'),
      segment: String(company?.segment || ''),
      notes: String(company?.notes || ''),
      ...normalizeCompanyModuleAccess(company)
    });
    setShowCompanyEditModal(true);
  };

  const closeEditManagementCompany = () => {
    setShowCompanyEditModal(false);
    setEditingManagementCompany(null);
    setSavingCompanyEdit(false);
  };

  const saveEditedManagementCompany = async (e) => {
    e.preventDefault();
    if (!editingManagementCompany?.id) return;

    try {
      setSavingCompanyEdit(true);
      setError(null);

      const name = String(companyEditForm.name || '').trim();
      if (!name) {
        throw new Error('Nome da empresa é obrigatório');
      }

      const payload = {
        id: editingManagementCompany.id,
        name,
        legalName: String(companyEditForm.legalName || '').trim() || null,
        document: String(companyEditForm.cnpj || '').trim() || null,
        cnpj: String(companyEditForm.cnpj || '').trim() || null,
        email: String(companyEditForm.email || '').trim().toLowerCase() || null,
        phone: String(companyEditForm.phone || '').trim() || null,
        status: String(companyEditForm.status || 'ACTIVE').trim().toUpperCase(),
        segment: String(companyEditForm.segment || '').trim() || null,
        notes: String(companyEditForm.notes || '').trim() || null,
        accessB2B: Boolean(companyEditForm.accessB2B),
        accessB2G: Boolean(companyEditForm.accessB2G),
        accessPreSales: Boolean(companyEditForm.accessPreSales),
        accessManagement: Boolean(companyEditForm.accessManagement),
        accessAutomation: Boolean(companyEditForm.accessAutomation)
      };

      const res = await fetch(API_ENDPOINTS.licensing.updateCompany(editingManagementCompany.id), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erro ao editar empresa: ${res.status}`);

      closeEditManagementCompany();
      await Promise.all([loadLicensingData(), loadManagementCompanies()]);
    } catch (e2) {
      console.error(e2);
      setError(e2.message || 'Erro ao editar empresa');
    } finally {
      setSavingCompanyEdit(false);
    }
  };

  const deleteCompany = (company) => {
    if (!company?.id) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Excluir Empresa',
      description: `Excluir a empresa "${company.name}" e todos os usuários/licenças vinculados? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir Empresa',
      cancelText: 'Cancelar',
      isDanger: true,
      onConfirm: async () => {
        try {
          setError(null);
          const requestInit = {
            method: 'DELETE',
            headers: getAuthHeaders()
          };

          const res = await fetch(API_ENDPOINTS.licensing.deleteCompany(company.id), requestInit);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `Erro ao excluir empresa: ${res.status}`);
          if (selectedCompanyDetails?.id === company.id) {
            setShowCompanyDetailsModal(false);
            setSelectedCompanyDetails(null);
          }
          await Promise.all([loadLicensingData(), loadManagementCompanies()]);
        } catch (e) {
          console.error(e);
          setError(e.message || 'Erro ao excluir empresa');
        }
      }
    });
  };

  const openCreateCompanyUser = (company) => {
    const defaultAccess = constrainAccessToCompanyModules(
      { accessB2B: true, accessB2G: true, accessPreSales: false, accessManagement: false, accessAutomation: false },
      company
    );
    setTargetCompanyForUser(company);
    setCompanyUserForm({
      name: '',
      email: '',
      password: '',
      role: 'USER',
      ...defaultAccess
    });
    setShowCompanyUserModal(true);
  };

  const saveCompanyUser = async (e) => {
    e.preventDefault();
    if (!targetCompanyForUser?.id) return;

    try {
      setSavingCompanyUser(true);
      setError(null);

      const userAccess = constrainAccessToCompanyModules(companyUserForm, targetCompanyForUser);
      const payload = {
        name: companyUserForm.name?.trim(),
        email: companyUserForm.email?.trim(),
        password: companyUserForm.password?.trim() || undefined,
        role: normalizeRole(companyUserForm.role),
        accessB2B: userAccess.accessB2B,
        accessB2G: userAccess.accessB2G,
        accessPreSales: userAccess.accessPreSales,
        accessManagement: userAccess.accessManagement,
        accessAutomation: userAccess.accessAutomation
      };

      if (!payload.name || !payload.email) {
        throw new Error('Nome e email são obrigatórios');
      }

      const res = await fetch(API_ENDPOINTS.licensing.companyUsers(targetCompanyForUser.id), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `Erro ao criar usuário: ${res.status}`);

      const generatedPassword = data?.data?.generatedPassword || null;

      setShowCompanyUserModal(false);
      await loadLicensingData();

      if (generatedPassword) {
        window.alert(`Usuário criado com sucesso.\nSenha gerada: ${generatedPassword}`);
      }
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao criar usuário da empresa');
    } finally {
      setSavingCompanyUser(false);
    }
  };

  const handleUserRoleChange = (nextRoleValue) => {
    const nextRole = normalizeRole(nextRoleValue);
    setUserForm((prev) => {
      const resolvedAccess = resolveAccessByRole(nextRole, prev);
      const rolePolicyAccess = rolePolicyDrafts[nextRole]?.moduleAccess || resolvedAccess;
      const access = isMasterSession
        ? resolveAccessByRole(nextRole, rolePolicyAccess)
        : constrainAccessToCompanyModules(rolePolicyAccess, contractedCompany);
      return {
        ...prev,
        role: nextRole,
        ...access,
        isCompanyOwner: nextRole === 'ADMIN' ? prev.isCompanyOwner : false
      };
    });
  };

  const handleUserModuleToggle = (moduleKey, checked) => {
    setUserForm((prev) => {
      const role = normalizeRole(prev.role);
      if (role === 'MASTER') {
        const resolvedAccess = resolveAccessByRole(role, prev);
        const access = isMasterSession ? resolvedAccess : constrainAccessToCompanyModules(resolvedAccess, contractedCompany);
        return { ...prev, ...access };
      }

      const next = isMasterSession
        ? { ...prev, [moduleKey]: Boolean(checked) }
        : {
            ...prev,
            ...constrainAccessToCompanyModules({ ...prev, [moduleKey]: Boolean(checked) }, contractedCompany)
          };
      if (!next.accessB2B && !next.accessB2G && !next.accessPreSales && !next.accessManagement && !next.accessAutomation) {
        if (isMasterSession) {
          next.accessB2B = true;
        } else {
          const fallbackModule = MODULE_ACCESS_ITEMS.find((item) => contractedCompanyAccess[item.key]);
          if (fallbackModule) next[fallbackModule.key] = true;
        }
      }
      return next;
    });
  };

  const handleRolePolicyModuleToggle = (role, moduleKey, checked) => {
    const normalizedRole = normalizeRole(role);
    if (!ROLE_POLICY_EDITABLE_ROLES.includes(normalizedRole)) return;
    if (!ROLE_POLICY_ACCESS_KEYS.includes(moduleKey)) return;
    if (!isMasterSession && !isAdminSession) return;
    if (!contractedCompanyAccess[moduleKey]) return;

    setRolePolicyDrafts((prev) => {
      const current = prev[normalizedRole] || buildRolePolicyDraft(normalizedRole, contractedCompany);
      const nextModuleAccess = constrainAccessToCompanyModules(
        {
          ...current.moduleAccess,
          [moduleKey]: Boolean(checked)
        },
        contractedCompany
      );

      return {
        ...prev,
        [normalizedRole]: {
          ...current,
          moduleAccess: nextModuleAccess
        }
      };
    });
  };

  const handleRolePolicyPermissionToggle = (role, permissionKey, checked) => {
    const normalizedRole = normalizeRole(role);
    if (!ROLE_POLICY_EDITABLE_ROLES.includes(normalizedRole)) return;
    if (!ROLE_POLICY_MODULES.some((item) => item.key === permissionKey)) return;
    if (!isMasterSession && !isAdminSession) return;

    setRolePolicyDrafts((prev) => {
      const current = prev[normalizedRole] || buildRolePolicyDraft(normalizedRole, contractedCompany);
      return {
        ...prev,
        [normalizedRole]: {
          ...current,
          permissions: {
            ...current.permissions,
            [permissionKey]: Boolean(checked)
          }
        }
      };
    });
  };

  const saveRolePolicies = async () => {
    if (!contractedCompany?.id) return;

    try {
      setSavingRolePolicies(true);
      setError(null);

      const policies = rolePolicyVisibleRoles.reduce((acc, role) => {
        const normalizedRole = normalizeRole(role);
        if (!ROLE_POLICY_EDITABLE_ROLES.includes(normalizedRole)) return acc;
        const draft = rolePolicyDrafts[normalizedRole] || buildRolePolicyDraft(normalizedRole, contractedCompany);
        acc[normalizedRole] = {
          moduleAccess: constrainAccessToCompanyModules(draft.moduleAccess, contractedCompany),
          permissions: ROLE_POLICY_MODULES.reduce((permissions, item) => {
            permissions[item.key] = Boolean(draft.permissions?.[item.key]);
            return permissions;
          }, {})
        };
        return acc;
      }, {});

      const res = await fetch(API_ENDPOINTS.licensing.companyRolePolicies(contractedCompany.id), {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ policies })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Erro ao salvar políticas: ${res.status}`);
      }

      await Promise.all([loadLicensingData(), loadAll()]);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Erro ao salvar políticas por role');
    } finally {
      setSavingRolePolicies(false);
    }
  };

  const handleCompanyUserRoleChange = (nextRoleValue) => {
    const nextRole = normalizeRole(nextRoleValue);
    setCompanyUserForm((prev) => ({
      ...prev,
      role: nextRole,
      ...constrainAccessToCompanyModules(resolveAccessByRole(nextRole, prev), targetCompanyForUser)
    }));
  };

  const handleCompanyUserModuleToggle = (moduleKey, checked) => {
    setCompanyUserForm((prev) => {
      const role = normalizeRole(prev.role);
      if (['MASTER', 'ADMIN', 'PRE_SALES'].includes(role)) {
        return {
          ...prev,
          ...constrainAccessToCompanyModules(resolveAccessByRole(role, prev), targetCompanyForUser)
        };
      }

      const next = constrainAccessToCompanyModules(
        { ...prev, [moduleKey]: Boolean(checked) },
        targetCompanyForUser
      );
      if (!next.accessB2B && !next.accessB2G && !next.accessPreSales && !next.accessManagement && !next.accessAutomation) {
        const companyAccess = normalizeCompanyModuleAccess(targetCompanyForUser);
        next.accessB2B = Boolean(companyAccess.accessB2B);
        next.accessB2G = !next.accessB2B && Boolean(companyAccess.accessB2G);
        next.accessPreSales = !next.accessB2B && !next.accessB2G && Boolean(companyAccess.accessPreSales);
        next.accessManagement = !next.accessB2B && !next.accessB2G && !next.accessPreSales && Boolean(companyAccess.accessManagement);
        next.accessAutomation = !next.accessB2B && !next.accessB2G && !next.accessPreSales && !next.accessManagement && Boolean(companyAccess.accessAutomation);
      }
      return next;
    });
  };

  const handleCompanyModuleToggle = (setter, moduleKey, checked) => {
    setter((prev) => {
      return { ...prev, [moduleKey]: Boolean(checked) };
    });
  };

  const usersColumns = useMemo(() => {
    const companyById = new Map(licensingCompanies.map((company) => [company.id, company]));
    return [
      {
        key: 'name',
        label: 'Nome',
        render: (u) => (
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.name}</div>
            <div className="text-xs text-gray-500 dark:text-slate-200">{u.email}</div>
          </div>
        )
      },
      {
        key: 'role',
        label: 'Perfil',
        render: (u) => (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:text-gray-100">
            {roleLabel(u.role)}
          </span>
        )
      },
      {
        key: 'tenantCompany',
        label: 'Empresa',
        render: (u) => {
          const company = u.tenantCompany || companyById.get(u.tenantCompanyId);
          return (
            <div className="text-sm text-gray-900 dark:text-gray-100">
              {company?.name || company?.legalName || '-'}
            </div>
          );
        }
      },
      {
        key: 'region',
        label: 'Região',
        render: (u) => (
          <div className="text-sm text-gray-900 dark:text-gray-100">
            {u.region?.name || '-'}
          </div>
        )
      },
      {
        key: 'quota',
        label: 'Cota',
        render: (u) => (
          <div className="text-sm text-gray-900 dark:text-gray-100">
            {typeof u.quota === 'number'
              ? u.quota.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
              : '-'}
          </div>
        )
      },
      {
        key: 'commissionSalePercentage',
        label: 'Comissões',
        render: (u) => {
          const parts = [];
          if (u.commissionSalePercentage != null) parts.push(`Venda: ${u.commissionSalePercentage}%`);
          if (u.commissionProject12 != null) parts.push(`12m: ${u.commissionProject12}%`);
          if (u.commissionProject24 != null) parts.push(`24m: ${u.commissionProject24}%`);
          if (u.commissionProject36 != null) parts.push(`36m: ${u.commissionProject36}%`);
          if (u.commissionProject48 != null) parts.push(`48m: ${u.commissionProject48}%`);
          if (u.commissionProject60 != null) parts.push(`60m: ${u.commissionProject60}%`);
          return parts.length > 0 ? (
            <div className="text-xs leading-relaxed text-gray-600 dark:text-slate-300">
              {parts.map((p, i) => <div key={i}>{p}</div>)}
            </div>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          );
        }
      },
      {
        key: 'createdAt',
        label: 'Criado em',
        render: (u) => (
          <div className="text-sm text-gray-700 dark:text-gray-200">
            {u.createdAt ? new Date(u.createdAt).toLocaleDateString('pt-BR') : '-'}
          </div>
        )
      }
    ];
  }, [licensingCompanies]);

  const logoSrc = resolvePublicUrl(settings.logoUrl);
  const pageTitle = isAdministrationRoute ? 'Administração' : 'Configurações';
  const pageDescription = isAdministrationRoute
    ? 'Administração global de empresas, planos, licenças e aprovações.'
    : 'Plano contratado, políticas por role e preferências da empresa.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
          <p className="text-gray-600 dark:text-slate-200">
            {pageDescription}
          </p>
        </div>
        {activeTab === 'usuarios_acessos' && (
          <button
            onClick={openNewUser}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Novo Usuário
          </button>
        )}
        {activeTab === 'licenciamento' && (
          <button
            onClick={openNewCompany}
            disabled={!isMasterSession}
            className="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title={isMasterSession ? 'Cadastrar nova empresa' : 'Somente MASTER pode cadastrar empresa manualmente'}
          >
            Nova Empresa
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          <strong>Erro:</strong> {error}
        </div>
      )}

      <div className="border-b border-gray-200 dark:border-blue-500/20">
        <nav className="-mb-px flex flex-wrap gap-x-6">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-200 dark:hover:text-slate-100 dark:hover:border-blue-400/50 dark:border-blue-500/30'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'perfil' && (
        <div className="crm-card rounded-2xl p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Perfil</h2>
          <p className="text-sm text-gray-600 dark:text-slate-200">
            Dados da sua conta e identificação da sessão atual.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-300">Nome</div>
              <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{sessionUser?.name || '-'}</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-300">Email</div>
              <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{sessionUser?.email || '-'}</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-300">Role</div>
              <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{roleLabel(sessionUser?.role)}</div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-300">Acesso</div>
              <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {isMasterSession
                  ? 'Administração global completa (MASTER)'
                  : 'Configurações da empresa e gestão de usuários (ADMIN)'}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'empresa' && (
        <div className="crm-card rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Identidade do Sistema</h2>
            <p className="text-sm text-gray-600 dark:text-slate-200">Nome e logo exibidos no menu lateral</p>
          </div>

          <form onSubmit={saveSettings} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nome do sistema</label>
              <input
                type="text"
                value={settings.appName}
                onChange={(e) => setSettings((s) => ({ ...s, appName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="CRM NEXOS"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={savingSettings}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingSettings ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>

          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Logo</h3>
                <p className="text-xs text-gray-600 dark:text-slate-200">Envie uma imagem (PNG/JPG/WebP/GIF/SVG) até 5MB</p>
              </div>
              {settings.logoUrl && (
                <button
                  type="button"
                  onClick={removeLogo}
                  disabled={savingSettings}
                  className="text-red-600 hover:text-red-700 text-sm font-medium disabled:opacity-50"
                >
                  Remover
                </button>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="w-20 h-20 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <span className="text-3xl">💼</span>
                )}
              </div>

              <div className="flex-1 space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-gray-700 dark:text-slate-100"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={uploadLogo}
                    disabled={!logoFile || logoUploading}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {logoUploading ? 'Enviando...' : 'Enviar Logo'}
                  </button>
                  {logoFile && (
                    <span className="text-xs text-gray-600 dark:text-slate-200">{logoFile.name}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'avisos' && (
        <div className="crm-card rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Avisos</h2>
            <p className="text-sm text-gray-600 dark:text-slate-200">Defina como deseja receber notificações do sistema.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['email', 'Alertas por email'],
              ['push', 'Alertas no painel'],
              ['licensing', 'Atualizações de licenciamento'],
              ['security', 'Alertas de segurança'],
              ['reports', 'Resumo diário de relatórios']
            ].map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-blue-500/20 px-4 py-3"
              >
                <span className="text-sm text-gray-800 dark:text-slate-100">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(alertsPrefs[key])}
                  onChange={(e) => setAlertsPrefs((prev) => ({ ...prev, [key]: e.target.checked }))}
                />
              </label>
            ))}
          </div>
          <div>
            <button
              type="button"
              onClick={saveAlertsPreferences}
              disabled={savingAlerts}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {savingAlerts ? 'Salvando...' : 'Salvar preferências'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'seguranca' && (
        <div className="crm-card rounded-2xl p-6 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Segurança</h2>
            <p className="text-sm text-gray-600 dark:text-slate-200">
              Redefina senha com código mestre de recuperação.
            </p>
          </div>

          <form onSubmit={updateSecurityPassword} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Email</label>
              <input
                type="email"
                required
                value={securityForm.email}
                onChange={(e) => setSecurityForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nova senha</label>
              <input
                type="password"
                required
                value={securityForm.newPassword}
                onChange={(e) => setSecurityForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Confirmar senha</label>
              <input
                type="password"
                required
                value={securityForm.confirmPassword}
                onChange={(e) => setSecurityForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Código de recuperação</label>
              <input
                type="password"
                required
                value={securityForm.recoveryCode}
                onChange={(e) => setSecurityForm((prev) => ({ ...prev, recoveryCode: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={savingSecurity}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {savingSecurity ? 'Atualizando...' : 'Atualizar senha'}
              </button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Sub-tabs switch */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-700/60 pb-3">
            <button
              type="button"
              onClick={() => setActiveBackupSubTab('rotina')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeBackupSubTab === 'rotina'
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-900/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>🛡️</span>
              <span>4. Rotina Automatizada (Segunda a Sexta às 17h)</span>
              <span className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full font-mono">
                Ativo
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveBackupSubTab('manual')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                activeBackupSubTab === 'manual'
                  ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/40 shadow-sm shadow-cyan-900/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span>💾</span>
              <span>Exportação / Restauração Manual (.json)</span>
            </button>
          </div>

          {activeBackupSubTab === 'rotina' && (
            <div className="space-y-6">
              {/* Card 1: Status Geral da Rotina */}
              <div className="crm-card rounded-2xl p-6 border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-cyan-950/20 shadow-xl space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🛡️</span>
                      <h2 className="text-xl font-bold text-white tracking-wide">
                        Rotina de Backup Automatizada do Banco de Dados
                      </h2>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        Cron Ativo
                      </span>
                    </div>
                    <p className="text-sm text-slate-300">
                      Cópia de segurança programada do banco PostgreSQL nativo com integridade estrutural validada e retenção de 30 dias.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={fetchRoutineStatus}
                    disabled={routineLoading}
                    className="self-start md:self-center px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    <span className={routineLoading ? 'animate-spin' : ''}>↻</span>
                    <span>{routineLoading ? 'Atualizando...' : 'Atualizar Status'}</span>
                  </button>
                </div>

                {/* 4 Blocos Informativos Principais */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                      <span>⏰</span> Agendamento
                    </div>
                    <div className="text-sm font-bold text-white">Seg a Sex às 17h00</div>
                    <div className="text-xs text-cyan-400 font-mono">0 17 * * 1-5 (BRT -03)</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                      <span>🗄️</span> Banco de Dados
                    </div>
                    <div className="text-sm font-bold text-white">crmnexointegrator_v2</div>
                    <div className="text-xs text-slate-400">PostgreSQL 16 (100 Tabelas)</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                      <span>📅</span> Política de Retenção
                    </div>
                    <div className="text-sm font-bold text-white">30 Dias de Histórico</div>
                    <div className="text-xs text-slate-400">Limpeza e rotação automática</div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60 space-y-1">
                    <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold flex items-center gap-1.5">
                      <span>✅</span> Integridade Estrutural
                    </div>
                    <div className="text-sm font-bold text-emerald-400">100% Comprovada</div>
                    <div className="text-xs text-slate-400">Validação pós-dump (pg_restore)</div>
                  </div>
                </div>

                {/* Domínio & Caminho do Script */}
                <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span className="font-semibold text-slate-400">🌐 Domínio Produção:</span>
                    <a
                      href="https://nexosv2.chorstconsult.com.br"
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 underline font-mono hover:text-cyan-300"
                    >
                      https://nexosv2.chorstconsult.com.br
                    </a>
                  </div>
                  <div className="flex items-center gap-2 text-slate-300 font-mono text-[11px]">
                    <span className="font-semibold text-slate-400">📁 Armazenamento:</span>
                    <span className="text-slate-300 bg-slate-800 px-2 py-0.5 rounded">/var/backups/crmnexointegrator_v2/</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Lista dos Backups Gerados no Servidor */}
              <div className="crm-card rounded-2xl p-6 border border-slate-800 bg-slate-900/90 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">📦</span>
                    <h3 className="text-base font-bold text-white">
                      Cópias de Segurança Disponíveis no Servidor ({routineStatus?.files?.length || 0})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">
                    Retidos em <code className="text-cyan-300">/var/backups/crmnexointegrator_v2/</code>
                  </span>
                </div>

                {routineStatus?.files && routineStatus.files.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-800">
                    <table className="w-full text-left text-xs text-slate-200">
                      <thead className="bg-slate-800/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/60">
                        <tr>
                          <th className="px-4 py-3">Arquivo do Backup</th>
                          <th className="px-4 py-3">Tamanho</th>
                          <th className="px-4 py-3">Data / Hora de Geração</th>
                          <th className="px-4 py-3">Formato</th>
                          <th className="px-4 py-3 text-right">Integridade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {routineStatus.files.map((file, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                            <td className="px-4 py-3 font-mono text-cyan-300 font-medium">
                              {file.name}
                            </td>
                            <td className="px-4 py-3 font-semibold text-slate-100">
                              {file.sizeFormatted}
                            </td>
                            <td className="px-4 py-3 text-slate-300">
                              {new Date(file.modifiedAt || file.createdAt).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">
                                PostgreSQL Custom (-Fc)
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ✓ Íntegro
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-800/30 border border-dashed border-slate-700 text-center text-xs text-slate-400">
                    {routineLoading ? 'Consultando backups no servidor...' : 'Nenhum arquivo de backup encontrado ainda ou permissão restrita.'}
                  </div>
                )}
              </div>

              {/* Card 3: Documentação e Procedimento de Restauração (Disaster Recovery) */}
              <div className="crm-card rounded-2xl p-6 border border-slate-800 bg-slate-900/90 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                  <span className="text-lg">📖</span>
                  <h3 className="text-base font-bold text-white">
                    Guia de Procedimentos Operacionais e Restauração (Disaster Recovery)
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Bloco 1: Restauração Sandbox */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>🧪</span> 1. Testar Restauração em Sandbox (Sem Risco)
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Cria uma base temporária, restaura as 100 tabelas, confere contagens de clientes e editais e depois remove a base de teste:
                    </p>
                    <pre className="p-2.5 rounded bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      /var/www/crmnexointegrator_v2/scripts/restore-crmnexointegrator_v2.sh --test &lt;caminho_do_dump&gt;
                    </pre>
                  </div>

                  {/* Bloco 2: Restauração Produção */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="font-bold text-rose-300 flex items-center gap-1.5">
                      <span>⚠️</span> 2. Restauração Direta em Produção
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Gera um snapshot de segurança prévio, para a aplicação temporariamente, restaura a base e reaplica as permissões:
                    </p>
                    <pre className="p-2.5 rounded bg-slate-900 text-cyan-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      /var/www/crmnexointegrator_v2/scripts/restore-crmnexointegrator_v2.sh --live &lt;caminho_do_dump&gt;
                    </pre>
                  </div>

                  {/* Bloco 3: Logs */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="font-bold text-cyan-300 flex items-center gap-1.5">
                      <span>📋</span> 3. Acompanhamento dos Logs da Rotina
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Para acompanhar a execução do agendamento das 17h00 em tempo real na VPS:
                    </p>
                    <pre className="p-2.5 rounded bg-slate-900 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      tail -f /var/log/crmnexointegrator_v2-backup.log
                    </pre>
                  </div>

                  {/* Bloco 4: Disparo Manual */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="font-bold text-purple-300 flex items-center gap-1.5">
                      <span>⚡</span> 4. Execução Manual Imediata
                    </div>
                    <p className="text-slate-300 leading-relaxed">
                      Para disparar um backup sob demanda pelo terminal a qualquer momento:
                    </p>
                    <pre className="p-2.5 rounded bg-slate-900 text-slate-300 font-mono text-[11px] overflow-x-auto border border-slate-800">
                      /var/www/crmnexointegrator_v2/scripts/backup-crmnexointegrator_v2.sh
                    </pre>
                  </div>
                </div>

                {/* Trecho do Log do Servidor */}
                {routineStatus?.lastLogSnippet && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <span>📟</span> Últimas Linhas do Log de Execução no Servidor:
                      </span>
                      <span className="font-mono text-[11px]">/var/log/crmnexointegrator_v2-backup.log</span>
                    </div>
                    <pre className="p-3 rounded-xl bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto border border-slate-800 leading-relaxed max-h-48 overflow-y-auto">
                      {routineStatus.lastLogSnippet}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeBackupSubTab === 'manual' && (
            <div className="crm-card rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Backup manual sob demanda (.json)</h2>
              <p className="text-sm text-gray-600 dark:text-slate-200">
                Exporte todas as tabelas do banco de dados, schema Prisma, migrations e arquivos de upload vinculados ao sistema em formato JSON para download em seu computador.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={exportBackupSnapshot}
                  disabled={backupLoading || restoreLoading}
                  className="bg-cyan-600 text-white px-4 py-2 rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
                >
                  {backupLoading ? 'Gerando backup completo...' : 'Exportar backup completo (.json)'}
                </button>
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                  className="text-sm text-gray-700 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={restoreBackupSnapshot}
                  disabled={!restoreFile || restoreLoading || backupLoading}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {restoreLoading ? 'Restaurando...' : 'Restaurar backup (.json)'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-slate-300">
                Admin e Master podem restaurar backups completos pelo arquivo exportado. A operação substitui as tabelas do banco e exige confirmação antes de iniciar.
              </p>
              {backupResult && <div className="text-sm text-emerald-600 dark:text-emerald-300">{backupResult}</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'usuarios_acessos' && (
        <ModernTable
          title="Usuários e Acessos"
          data={users}
          columns={usersColumns}
          loading={loading}
          onEdit={openEditUser}
          onDelete={deleteUser}
          emptyState={
            <div className="text-center py-16">
              <div className="text-gray-900 font-semibold">Nenhum usuário encontrado</div>
              <div className="text-gray-500 dark:text-slate-200 text-sm mt-1">Cadastre um novo usuário para começar</div>
            </div>
          }
        />
      )}

      {activeTab === 'gestao_empresas' && (
        <div className="space-y-6">
          {!isMasterSession ? (
            <div className="crm-card rounded-2xl p-6">
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔒</div>
                <div className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Acesso Restrito
                </div>
                <div className="text-gray-600 dark:text-slate-300">
                  Apenas usuários com role MASTER podem acessar a Gestão de Empresas.
                </div>
              </div>
            </div>
          ) : (
            <div className="crm-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Gestão de Empresas</h2>
                  <p className="text-sm text-gray-600 dark:text-slate-200 mt-1">
                    Empresas compradoras entram aqui para revisão. Confira plano, módulos e políticas antes de aprovar o acesso.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCompanyModal(true);
                      setCompanyForm({ ...DEFAULT_COMPANY_FORM });
                  }}
                  className="crm-btn crm-btn-primary"
                >
                  ➕ Nova Empresa
                </button>
                <button
                  onClick={loadManagementCompanies}
                  className="crm-btn crm-btn-secondary"
                >
                  🔄 Atualizar
                </button>
              </div>
            </div>

            {loadingCompanies ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-600 dark:text-slate-200">Carregando empresas...</p>
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-gray-900 dark:text-gray-100 font-semibold">Nenhuma empresa encontrada</div>
                <div className="text-gray-500 dark:text-slate-200 text-sm mt-1">
                  As empresas aparecerão aqui após compra, checkout ou cadastro manual de licenciamento.
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Empresa
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        CNPJ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Plano
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Módulos
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Usuários
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Criado em
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-900 divide-y divide-gray-200 dark:divide-slate-700">
                    {companies.map((company) => {
                      const statusMeta = getCompanyStatusMeta(company.status);
                      const canApproveCompany = String(company.status || '').toUpperCase() !== 'ACTIVE';
                      return (
                        <tr key={company.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {company.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-slate-400">
                              {company.email || '-'}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {company.cnpj || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                              {company.planName || 'Sem plano'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col items-start gap-2">
                              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}`}>
                                {statusMeta.label}
                              </span>
                              {canApproveCompany && (
                                <button
                                  type="button"
                                  onClick={() => approveCompany(company)}
                                  disabled={approvingCompanyId === company.id}
                                  title="Aprovar empresa após conferir módulos e políticas"
                                  className="inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-300/40 bg-gradient-to-r from-cyan-500/25 via-teal-500/20 to-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-50 shadow-lg shadow-cyan-500/10 transition hover:border-emerald-200/70 hover:from-cyan-500/35 hover:to-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {approvingCompanyId === company.id ? 'Aprovando...' : 'Aprovar'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex max-w-[18rem] flex-wrap gap-1.5">
                              {companyModuleBadges(company).map((module) => (
                                <span
                                  key={module}
                                  className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-100"
                                >
                                  {module}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {company.usersCount ?? '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                            {company.createdAt ? new Date(company.createdAt).toLocaleDateString('pt-BR') : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => openCompanyDetails(company)}
                                className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                              >
                                Visualizar
                              </button>
                              <button
                                onClick={() => openEditManagementCompany(company)}
                                title="Editar empresa"
                                className="text-amber-600 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200"
                              >
                                Editar
                              </button>
                              {canApproveCompany && (
                                <button
                                  onClick={() => approveCompany(company)}
                                  disabled={approvingCompanyId === company.id}
                                  title="Aprovar empresa após conferir módulos e políticas"
                                  className="text-emerald-600 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-emerald-300 dark:hover:text-emerald-200"
                                >
                                  {approvingCompanyId === company.id ? 'Aprovando...' : 'Aprovar'}
                                </button>
                              )}
                              <button
                                onClick={() => deleteCompany(company)}
                                className="text-red-600 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}
        </div>
      )}

      {activeTab === 'plano_contratado' && (
        <div className="crm-card rounded-2xl p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Plano Contratado</h2>
              <p className="text-sm text-gray-600 dark:text-slate-200">
                Consulte o plano ativo da empresa e os módulos liberados para configurar usuários.
              </p>
            </div>
            <button
              type="button"
              onClick={loadLicensingData}
              disabled={loadingLicensing}
              className="crm-btn crm-btn-secondary"
            >
              {loadingLicensing ? 'Atualizando...' : 'Atualizar plano'}
            </button>
          </div>

          {loadingLicensing ? (
            <div className="text-sm text-gray-600 dark:text-slate-200">Carregando plano contratado...</div>
          ) : !contractedCompany ? (
            <div className="rounded-xl border border-amber-300/40 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Nenhuma empresa vinculada a esta sessão. O plano contratado aparecerá aqui após a aprovação pelo MASTER.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-300">Empresa</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">{contractedCompany.name || '-'}</div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">{contractedCompany.cnpj || contractedCompany.email || '-'}</div>
                </div>
                <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-300">Plano</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {contractedCompany.license?.plan?.name || contractedCompany.planName || 'Sem plano ativo'}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                    {contractedCompany.license?.status || contractedCompany.status || '-'}
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-300">Assentos</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {contractedCompany.license?.seats ?? contractedCompany.license?.plan?.seatsIncluded ?? '-'}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                    Usuários cadastrados: {contractedCompany.users?.length ?? contractedCompany.usersCount ?? '-'}
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-300/25 bg-cyan-500/10 p-4">
                  <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-300">Vigência</div>
                  <div className="mt-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {formatDateLabel(contractedCompany.license?.startDate)} até {formatDateLabel(contractedCompany.license?.endDate)}
                  </div>
                  <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                    Pagamento: {contractedCompany.license?.paymentStatus || '-'}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Módulos contratados</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
                  {MODULE_ACCESS_ITEMS.map((item) => {
                    const enabled = Boolean(contractedCompanyAccess[item.key]);
                    return (
                      <div
                        key={item.key}
                        className={`rounded-xl border p-3 ${
                          enabled
                            ? 'border-cyan-300/35 bg-gradient-to-br from-cyan-500/15 via-teal-500/10 to-emerald-500/15'
                            : 'border-gray-200 bg-gray-50/60 opacity-60 dark:border-slate-700 dark:bg-slate-900/35'
                        }`}
                      >
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.label}</div>
                        <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">{item.description}</div>
                        <div className={`mt-3 text-xs font-semibold ${enabled ? 'text-cyan-700 dark:text-cyan-200' : 'text-gray-500 dark:text-slate-400'}`}>
                          {enabled ? 'Contratado' : 'Não contratado'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-blue-300/30 bg-blue-50/70 px-4 py-3 text-sm text-blue-900 dark:bg-cyan-500/10 dark:text-cyan-100">
                <span>Use as políticas por role para conferir o padrão de liberação e ajuste usuários em Usuários e Acessos.</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('politicas_role')}
                  className="crm-btn crm-btn-primary"
                >
                  Ver políticas
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'politicas_role' && (
        <div className="crm-card rounded-2xl p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Políticas de Acesso por Role</h2>
              <p className="text-sm text-gray-600 dark:text-slate-200">
                Defina permissões e módulos por role dentro do plano contratado pela empresa.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('usuarios_acessos')}
                className="crm-btn crm-btn-secondary"
              >
                Gerenciar usuários
              </button>
              <button
                type="button"
                onClick={saveRolePolicies}
                disabled={savingRolePolicies || !contractedCompany}
                className="crm-btn crm-btn-primary disabled:opacity-60"
              >
                {savingRolePolicies ? 'Salvando...' : 'Salvar políticas'}
              </button>
            </div>
          </div>

          {loadingLicensing ? (
            <div className="text-sm text-gray-600 dark:text-slate-200">Carregando políticas do plano...</div>
          ) : !contractedCompany ? (
            <div className="rounded-xl border border-amber-300/40 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              Nenhum plano contratado encontrado para esta empresa.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {rolePolicyVisibleRoles.map((role) => {
                const normalizedRole = normalizeRole(role);
                const editableRole = ROLE_POLICY_EDITABLE_ROLES.includes(normalizedRole);
                const rolePolicy = rolePolicyDrafts[normalizedRole] || buildRolePolicyDraft(normalizedRole, contractedCompany);
                const roleAccess = constrainAccessToCompanyModules(rolePolicy.moduleAccess, contractedCompany);
                return (
                  <div
                    key={role}
                    className="rounded-2xl border border-dashed border-blue-300/40 dark:border-cyan-400/25 bg-slate-50/70 dark:bg-slate-900/35 p-4 space-y-3"
                  >
                    <div>
                      <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{roleLabel(role)}</div>
                      <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                        Plano: {contractedCompany.license?.plan?.name || contractedCompany.planName || 'Sem plano ativo'}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">Permissões</div>
                      {ROLE_POLICY_MODULES.map((item) => {
                        const checked = Boolean(rolePolicy.permissions?.[item.key]);
                        return (
                          <label
                            key={item.key}
                            className={`block space-y-1 rounded-lg border px-3 py-2 ${editableRole ? 'border-cyan-300/25 bg-cyan-500/10' : 'border-gray-200 bg-gray-100/50 opacity-60 dark:border-slate-700 dark:bg-slate-800/40'}`}
                          >
                            <span className="flex items-start justify-between gap-3">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</span>
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={!editableRole}
                                onChange={(e) => handleRolePolicyPermissionToggle(normalizedRole, item.key, e.target.checked)}
                              />
                            </span>
                            <span className="block text-xs text-gray-600 dark:text-slate-300">{item.description}</span>
                          </label>
                        );
                      })}
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">Módulos Contratados</div>
                    {MODULE_ACCESS_ITEMS.map((item) => {
                      const contracted = Boolean(contractedCompanyAccess[item.key]);
                      const checked = Boolean(roleAccess[item.key]);
                      return (
                        <div key={item.key} className={`space-y-1 rounded-lg border px-3 py-2 ${contracted ? 'border-cyan-300/25 bg-cyan-500/10' : 'border-gray-200 bg-gray-100/50 opacity-60 dark:border-slate-700 dark:bg-slate-800/40'}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{item.label}</div>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!editableRole || !contracted}
                              onChange={(e) => handleRolePolicyModuleToggle(normalizedRole, item.key, e.target.checked)}
                            />
                          </div>
                          <div className="text-xs text-gray-600 dark:text-slate-300">
                            {contracted ? item.description : 'Não contratado neste plano'}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="rounded-xl border border-amber-300/40 bg-amber-50/80 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            A empresa só consegue liberar módulos contratados. Administração global de licenças continua exclusiva da role <strong>MASTER</strong>.
          </div>
        </div>
      )}

      {activeTab === 'integracoes_api' && (
        <div className="space-y-4">
          <div className="crm-card rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">API de Integrações Enterprise</h2>
                <p className="text-sm text-gray-600 dark:text-slate-200">
                  OAuth2 client_credentials, idempotência, rate limit por parceiro, webhooks e mapeamento extensível.
                </p>
              </div>
              <a
                href={API_ENDPOINTS.integration.openapi}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                OpenAPI / Swagger
              </a>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-3">
                <div className="font-semibold text-gray-900 dark:text-gray-100">Token OAuth2</div>
                <div className="text-gray-600 dark:text-slate-200 break-all">{`${API_BASE_URL}/integration/oauth/token`}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-3">
                <div className="font-semibold text-gray-900 dark:text-gray-100">API Pública</div>
                <div className="text-gray-600 dark:text-slate-200 break-all">{`${API_BASE_URL}/integration/v1`}</div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-3">
                <div className="font-semibold text-gray-900 dark:text-gray-100">Admin Integrações</div>
                <div className="text-gray-600 dark:text-slate-200 break-all">{API_ENDPOINTS.integration.partners}</div>
              </div>
            </div>
          </div>

          {latestCredentials && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="text-sm font-semibold text-amber-900">Credenciais geradas para {latestCredentials.partnerName}</div>
              <div className="text-xs text-amber-800 mt-1">Guarde o `client_secret` agora. Ele não é exibido novamente.</div>
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-amber-900 font-medium">client_id</div>
                  <div className="text-amber-800 break-all">{latestCredentials.client_id}</div>
                </div>
                <div>
                  <div className="text-amber-900 font-medium">client_secret</div>
                  <div className="text-amber-800 break-all">{latestCredentials.client_secret}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-amber-900 font-medium">token_url</div>
                  <div className="text-amber-800 break-all">{latestCredentials.token_url}</div>
                </div>
              </div>
            </div>
          )}

          <div className="crm-card rounded-2xl p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Parceiros OAuth2</h3>

            {loadingPartners ? (
              <div className="text-sm text-gray-600 dark:text-slate-200">Carregando parceiros...</div>
            ) : integrationPartners.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-slate-200">
                Nenhum parceiro cadastrado. Use “Novo Parceiro OAuth2” para abrir integração com TOTVS/ERPs.
              </div>
            ) : (
              <div className="space-y-3">
                {integrationPartners.map((partner) => (
                  <div
                    key={partner.id}
                    className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{partner.name}</div>
                      <div className="text-xs text-gray-600 dark:text-slate-200">
                        {partner.provider} • {partner.type} • Tier {partner.partnerTier} •{' '}
                        {partner.rateLimitPerMinute || '-'} req/min
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-200 break-all">
                        client_id: {partner.clientId || '-'}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-slate-200">
                        scopes: {(partner.scopes || []).join(', ') || '-'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => rotatePartnerSecret(partner)}
                      disabled={rotatingSecretId === partner.id}
                      className="px-3 py-2 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50 transition-colors text-sm disabled:opacity-50"
                    >
                      {rotatingSecretId === partner.id ? 'Rotacionando...' : 'Rotacionar Secret'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'licenciamento' && (
        <div className="space-y-4">
          <div className="crm-card rounded-2xl p-6 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Administração de Licenciamento</h2>
                <p className="text-sm text-gray-600 dark:text-slate-200">
                  Gestão de planos por empresa, provisionamento e perfis de acesso.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-100">
                  {licensingSummary.totalCompanies} empresas
                </span>
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-200">
                  {licensingSummary.activeLicenses} licenças ativas
                </span>
              </div>
            </div>
          </div>

          <div className="crm-card rounded-2xl p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-3">Planos</h3>
            {loadingLicensing ? (
              <div className="text-sm text-gray-600 dark:text-slate-200">Carregando planos...</div>
            ) : licensingPlans.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-slate-200">Nenhum plano cadastrado.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                {licensingPlans.map((plan) => (
                  <div
                    key={plan.id}
                    className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4 bg-white/40 dark:bg-slate-900/35"
                  >
                    <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{plan.name}</div>
                    <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {Number(plan.price || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: plan.currency || 'BRL'
                      })}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-slate-200 mt-1">{plan.description || 'Plano ativo'}</div>
                    <div className="text-xs text-gray-600 dark:text-slate-200 mt-2">
                      Assentos inclusos: {plan.seatsIncluded ?? 1}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="crm-card rounded-2xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Empresas e Licenças</h3>
              {!isMasterSession && (
                <div className="text-xs text-amber-600 dark:text-amber-300">
                  Sem privilégio MASTER: cadastro/exclusão manual de empresa desabilitado.
                </div>
              )}
            </div>

            {loadingLicensing ? (
              <div className="text-sm text-gray-600 dark:text-slate-200">Carregando empresas...</div>
            ) : licensingCompanies.length === 0 ? (
              <div className="text-sm text-gray-600 dark:text-slate-200">Nenhuma empresa de licenciamento encontrada.</div>
            ) : (
              <div className="space-y-4">
                {licensingCompanies.map((company) => {
                  const draft = licenseDrafts[company.id] || buildLicenseDraft(company);
                  const statusLabel = company?.license?.status ? String(company.license.status).toLowerCase() : 'sem licença';

                  return (
                    <div
                      key={company.id}
                      className="rounded-2xl border border-gray-200 dark:border-blue-500/20 p-4 sm:p-5 bg-white/40 dark:bg-slate-900/35 space-y-4"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{company.name}</div>
                          <div className="text-sm text-gray-600 dark:text-slate-200">
                            Licença atual:{' '}
                            {company.license?.plan?.name ? `${company.license.plan.name} - ${statusLabel}` : 'Não definida'}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                            {company.email || '-'} {company.cnpj ? `• CNPJ ${company.cnpj}` : ''}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openCreateCompanyUser(company)}
                            className="px-3 py-2 rounded-lg border border-cyan-300 text-cyan-700 hover:bg-cyan-50 transition-colors text-sm dark:border-cyan-500/40 dark:text-cyan-200 dark:hover:bg-cyan-500/10"
                          >
                            Novo usuário
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCompany(company)}
                            disabled={!isMasterSession}
                            className="px-3 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Excluir empresa
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Plano</label>
                          <select
                            value={draft.planId || ''}
                            onChange={(e) => {
                              const nextPlanId = e.target.value;
                              const nextPlan = licensingPlans.find((plan) => plan.id === nextPlanId);
                              updateLicenseDraft(company.id, {
                                planId: nextPlanId,
                                priceAtPurchase: nextPlan?.price ?? draft.priceAtPurchase,
                                seats: nextPlan?.seatsIncluded ?? draft.seats
                              });
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                          >
                            <option value="">Selecione...</option>
                            {licensingPlans.map((plan) => (
                              <option key={plan.id} value={plan.id}>
                                {plan.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Status</label>
                          <select
                            value={draft.status || 'ACTIVE'}
                            onChange={(e) => updateLicenseDraft(company.id, { status: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                          >
                            <option value="PENDING">Pendente</option>
                            <option value="ACTIVE">Ativa</option>
                            <option value="SUSPENDED">Suspensa</option>
                            <option value="EXPIRED">Expirada</option>
                            <option value="CANCELED">Cancelada</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Início</label>
                          <input
                            type="date"
                            value={draft.startDate || ''}
                            onChange={(e) => updateLicenseDraft(company.id, { startDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Vencimento</label>
                          <input
                            type="date"
                            value={draft.endDate || ''}
                            onChange={(e) => updateLicenseDraft(company.id, { endDate: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Preço (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={draft.priceAtPurchase ?? ''}
                            onChange={(e) => updateLicenseDraft(company.id, { priceAtPurchase: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Assentos</label>
                          <input
                            type="number"
                            min="1"
                            value={draft.seats ?? ''}
                            onChange={(e) => updateLicenseDraft(company.id, { seats: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Pagamento</label>
                          <select
                            value={draft.paymentStatus || 'CONFIRMED'}
                            onChange={(e) => updateLicenseDraft(company.id, { paymentStatus: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                          >
                            <option value="PENDING">Pendente</option>
                            <option value="CONFIRMED">Confirmado</option>
                            <option value="FAILED">Falhou</option>
                            <option value="REFUNDED">Estornado</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Ref. pagamento</label>
                          <input
                            type="text"
                            value={draft.paymentReference || ''}
                            onChange={(e) => updateLicenseDraft(company.id, { paymentReference: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                            placeholder="Pedido/PIX/Fatura"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 dark:text-slate-100 mb-1">Observações</label>
                        <input
                          type="text"
                          value={draft.notes || ''}
                          onChange={(e) => updateLicenseDraft(company.id, { notes: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-transparent"
                          placeholder="Observações da licença"
                        />
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => saveCompanyLicense(company)}
                          disabled={savingLicenseFor === company.id}
                          className="px-4 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 transition-colors disabled:opacity-50"
                        >
                          {savingLicenseFor === company.id ? 'Salvando...' : 'Salvar licença'}
                        </button>

                        <div className="text-xs text-gray-600 dark:text-slate-300">
                          {company.usersCount || 0} usuário(s), {company.adminsCount || 0} admin(s)
                        </div>
                      </div>

                      {Array.isArray(company.users) && company.users.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-blue-500/20">
                          <div className="text-xs font-semibold text-gray-700 dark:text-slate-100 mb-2">Usuários da empresa</div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {company.users.map((user) => (
                              <div
                                key={user.id}
                                className="rounded-lg border border-gray-200 dark:border-blue-500/20 px-3 py-2"
                              >
                                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name}</div>
                                <div className="text-xs text-gray-600 dark:text-slate-300">{user.email}</div>
                                <div className="text-xs text-gray-600 dark:text-slate-300 mt-1">
                                  {roleLabel(user.role)}
                                  {user.isCompanyOwner ? ' • dono' : ''}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      )}

      <Modal
        isOpen={showCompanyDetailsModal}
        title={selectedCompanyDetails ? `Detalhes - ${selectedCompanyDetails.name}` : 'Detalhes da Empresa'}
        onClose={() => {
          setShowCompanyDetailsModal(false);
          setSelectedCompanyDetails(null);
          setLoadingCompanyDetails(false);
        }}
      >
        {!selectedCompanyDetails ? (
          <div className="text-sm text-gray-600 dark:text-slate-200">Nenhum detalhe disponível.</div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(() => {
                const statusMeta = getCompanyStatusMeta(selectedCompanyDetails.status);
                return (
                  <>
                    <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4 space-y-3">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dados gerais</div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Nome:</strong> {selectedCompanyDetails.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Razão social:</strong> {selectedCompanyDetails.legalName || '-'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>CNPJ/Documento:</strong> {selectedCompanyDetails.cnpj || '-'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Email:</strong> {selectedCompanyDetails.email || '-'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Telefone:</strong> {selectedCompanyDetails.phone || '-'}
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4 space-y-3">
                      <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Status e origem</div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Origem:</strong> Licenciamento
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300 flex items-center gap-2">
                        <strong>Status:</strong>
                        <span className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Plano:</strong> {selectedCompanyDetails.planName || 'Sem plano'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Criado em:</strong> {formatDateLabel(selectedCompanyDetails.createdAt)}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <strong>Atualizado em:</strong> {formatDateLabel(selectedCompanyDetails.updatedAt)}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {selectedCompanyDetails.source === 'operational' && (
              <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4 space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Informações comerciais</div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Segmento:</strong> {selectedCompanyDetails.segment || '-'}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Porte:</strong> {selectedCompanyDetails.size || '-'}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Lead score:</strong> {selectedCompanyDetails.leadScore ?? '-'}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Risco de churn:</strong>{' '}
                  {selectedCompanyDetails.churnRisk !== null && selectedCompanyDetails.churnRisk !== undefined
                    ? `${selectedCompanyDetails.churnRisk}%`
                    : '-'}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Localização:</strong>{' '}
                  {[selectedCompanyDetails.city, selectedCompanyDetails.state, selectedCompanyDetails.country].filter(Boolean).join(' / ') || '-'}
                </div>
              </div>
            )}

            {selectedCompanyDetails.license && (
              <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4 space-y-2">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Licenciamento</div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Status da licença:</strong> {selectedCompanyDetails.license.status || '-'}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Status pagamento:</strong> {selectedCompanyDetails.license.paymentStatus || '-'}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Assentos:</strong> {selectedCompanyDetails.license.seats ?? '-'}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Início:</strong> {formatDateLabel(selectedCompanyDetails.license.startDate)}
                </div>
                <div className="text-sm text-gray-600 dark:text-slate-300">
                  <strong>Fim:</strong> {formatDateLabel(selectedCompanyDetails.license.endDate)}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Usuários</div>
                {loadingCompanyDetails ? (
                  <div className="text-sm text-gray-600 dark:text-slate-300">Carregando usuários...</div>
                ) : Array.isArray(selectedCompanyDetails.users) && selectedCompanyDetails.users.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCompanyDetails.users.map((user) => (
                      <div key={user.id || user.email} className="rounded-lg border border-gray-200 dark:border-blue-500/20 px-3 py-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{user.name || '-'}</div>
                        <div className="text-xs text-gray-600 dark:text-slate-300">{user.email || '-'}</div>
                        <div className="text-xs text-gray-600 dark:text-slate-300">
                          {roleLabel(user.role)}
                          {user.isCompanyOwner ? ' • dono' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-slate-300">Nenhum usuário vinculado.</div>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Contatos</div>
                {Array.isArray(selectedCompanyDetails.contacts) && selectedCompanyDetails.contacts.length > 0 ? (
                  <div className="space-y-2">
                    {selectedCompanyDetails.contacts.map((contact) => (
                      <div key={contact.id || `${contact.name}-${contact.email}`} className="rounded-lg border border-gray-200 dark:border-blue-500/20 px-3 py-2">
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{contact.name || '-'}</div>
                        <div className="text-xs text-gray-600 dark:text-slate-300">{contact.email || '-'}</div>
                        <div className="text-xs text-gray-600 dark:text-slate-300">{contact.phone || '-'}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-600 dark:text-slate-300">Nenhum contato cadastrado.</div>
                )}
              </div>
            </div>

            {selectedCompanyDetails.notes && (
              <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-4">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Observações</div>
                <div className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-wrap">{selectedCompanyDetails.notes}</div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showCompanyEditModal}
        title={editingManagementCompany ? `Editar Empresa - ${editingManagementCompany.name}` : 'Editar Empresa'}
        onClose={closeEditManagementCompany}
      >
        <form onSubmit={saveEditedManagementCompany} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nome da empresa *</label>
              <input
                type="text"
                required
                value={companyEditForm.name}
                onChange={(e) => setCompanyEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Nome da empresa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Razão social</label>
              <input
                type="text"
                value={companyEditForm.legalName}
                onChange={(e) => setCompanyEditForm((prev) => ({ ...prev, legalName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Razão social"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">CNPJ/Documento</label>
              <input
                type="text"
                value={companyEditForm.cnpj}
                onChange={(e) => setCompanyEditForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="00.000.000/0000-00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Email</label>
              <input
                type="email"
                value={companyEditForm.email}
                onChange={(e) => setCompanyEditForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="contato@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Telefone</label>
              <input
                type="tel"
                value={companyEditForm.phone}
                onChange={(e) => setCompanyEditForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="(00) 00000-0000"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Status</label>
              <select
                value={companyEditForm.status}
                onChange={(e) => setCompanyEditForm((prev) => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 bg-transparent"
              >
                <option value="ACTIVE">Ativa</option>
                <option value="LEAD">Lead</option>
                <option value="PROSPECT">Aguardando aprovação</option>
                <option value="SUSPENDED">Suspensa</option>
                <option value="CANCELED">Cancelada</option>
                <option value="INACTIVE">Inativa</option>
                <option value="CHURNED">Churned</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-2">Módulos de acesso</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  ['accessB2B', 'Módulo B2B'],
                  ['accessB2G', 'Módulo B2G'],
                  ['accessPreSales', 'Pré-vendas'],
                  ['accessManagement', 'Gestão'],
                  ['accessAutomation', 'Automações']
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm dark:border-blue-500/20">
                    <input
                      type="checkbox"
                      checked={Boolean(companyEditForm[key])}
                      onChange={(e) => handleCompanyModuleToggle(setCompanyEditForm, key, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="font-medium text-gray-800 dark:text-slate-100">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Segmento</label>
              <input
                type="text"
                value={companyEditForm.segment}
                onChange={(e) => setCompanyEditForm((prev) => ({ ...prev, segment: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Segmento da empresa"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Observações</label>
              <textarea
                value={companyEditForm.notes}
                onChange={(e) => setCompanyEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Observações internas"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-blue-500/20">
            <button
              type="button"
              onClick={closeEditManagementCompany}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:text-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-600/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingCompanyEdit}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              {savingCompanyEdit ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showUserModal}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        onClose={() => {
          setShowUserModal(false);
          setEditingUser(null);
        }}
      >
        <form onSubmit={saveUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={userForm.name}
              onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Nome completo"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Email *</label>
            <input
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="email@empresa.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">
              Senha {editingUser ? '(opcional)' : '*'}
            </label>
            <input
              type="password"
              required={!editingUser}
              value={userForm.password}
              onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder={editingUser ? 'Deixe em branco para manter' : 'Senha inicial'}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Perfil</label>
              <select
                value={userForm.role}
                onChange={(e) => handleUserRoleChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="USER">User (B2B/B2G)</option>
                <option value="PRE_SALES">Pre-Vendas</option>
                <option value="ADMIN">Administrador</option>
                {isMasterSession && <option value="MASTER">Master</option>}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Região</label>
              <select
                value={userForm.regionId || ''}
                onChange={(e) => setUserForm((f) => ({ ...f, regionId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Sem região</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Empresa vinculada</label>
              <select
                value={userForm.tenantCompanyId || ''}
                onChange={(e) => setUserForm((f) => ({ ...f, tenantCompanyId: e.target.value }))}
                disabled={!isMasterSession}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="">Sem empresa vinculada</option>
                {licensingCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name || company.legalName || 'Empresa sem nome'}
                  </option>
                ))}
              </select>
              {!isMasterSession && (
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-300">
                  Administradores criam usuários dentro da própria empresa.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Cota mensal (R$)</label>
            <input
              type="number"
              step="0.01"
              value={userForm.quota}
              onChange={(e) => setUserForm((f) => ({ ...f, quota: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="50000.00"
            />
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-3 space-y-3">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Comissões</div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Venda Pontual (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={userForm.commissionSalePercentage}
                onChange={(e) => setUserForm((f) => ({ ...f, commissionSalePercentage: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: 3.0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Projetos Mensais (% por duração)</label>
              <div className="grid grid-cols-5 gap-2">
                {[
                  { key: 'commissionProject12', label: '12m' },
                  { key: 'commissionProject24', label: '24m' },
                  { key: 'commissionProject36', label: '36m' },
                  { key: 'commissionProject48', label: '48m' },
                  { key: 'commissionProject60', label: '60m' }
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-300 mb-1">{field.label}</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={userForm[field.key]}
                      onChange={(e) => setUserForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      className="w-full px-2 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="%"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-3 space-y-2">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Acesso por módulo</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MODULE_ACCESS_ITEMS.map(({ key, label }) => {
                const contracted = isMasterSession || Boolean(contractedCompanyAccess[key]);
                return (
                  <label key={key} className={`flex items-center gap-2 text-sm ${contracted ? 'text-gray-700 dark:text-slate-100' : 'text-gray-400 dark:text-slate-500'}`}>
                    <input
                      type="checkbox"
                      checked={Boolean(userForm[key])}
                      disabled={!contracted || normalizeRole(userForm.role) === 'MASTER'}
                      onChange={(e) => handleUserModuleToggle(key, e.target.checked)}
                    />
                    {label}
                    {!contracted && <span className="text-[11px]">(não contratado)</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {normalizeRole(userForm.role) === 'ADMIN' && (
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-100">
              <input
                type="checkbox"
                checked={Boolean(userForm.isCompanyOwner)}
                onChange={(e) => setUserForm((prev) => ({ ...prev, isCompanyOwner: e.target.checked }))}
              />
              Usuário dono da empresa
            </label>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowUserModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:text-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-600/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {savingUser ? 'Salvando...' : editingUser ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showPartnerModal}
        title="Novo Parceiro OAuth2"
        onClose={() => {
          setShowPartnerModal(false);
          setPartnerForm(DEFAULT_PARTNER_FORM);
        }}
      >
        <form onSubmit={savePartner} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nome do Parceiro *</label>
            <input
              type="text"
              required
              value={partnerForm.name}
              onChange={(e) => setPartnerForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="TOTVS Protheus - Unidade SP"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Tipo</label>
              <select
                value={partnerForm.type}
                onChange={(e) => setPartnerForm((p) => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="ERP">ERP</option>
                <option value="API_EXTERNAL">API Externa</option>
                <option value="WEBHOOK">Webhook</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Provider</label>
              <select
                value={partnerForm.provider}
                onChange={(e) => setPartnerForm((p) => ({ ...p, provider: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="TOTVS">TOTVS</option>
                <option value="SAP">SAP</option>
                <option value="SENIOR">Senior</option>
                <option value="GENERIC_ERP">ERP Genérico</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Tier</label>
              <select
                value={partnerForm.partnerTier}
                onChange={(e) => setPartnerForm((p) => ({ ...p, partnerTier: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="BRONZE">Bronze</option>
                <option value="SILVER">Silver</option>
                <option value="GOLD">Gold</option>
                <option value="PLATINUM">Platinum</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Scopes OAuth2</label>
            <input
              type="text"
              value={partnerForm.scopes}
              onChange={(e) => setPartnerForm((p) => ({ ...p, scopes: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="b2b:read b2b:write b2g:read b2g:write"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Webhook URL (opcional)</label>
              <input
                type="url"
                value={partnerForm.webhookUrl}
                onChange={(e) => setPartnerForm((p) => ({ ...p, webhookUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="https://erp.exemplo.com/webhooks/crm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Rate limit (req/min)</label>
              <input
                type="number"
                min="1"
                value={partnerForm.rateLimitPerMinute}
                onChange={(e) => setPartnerForm((p) => ({ ...p, rateLimitPerMinute: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="60"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowPartnerModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:text-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-600/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingPartner}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {savingPartner ? 'Salvando...' : 'Criar Parceiro'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showCompanyModal}
        title="Nova Empresa (Cadastro Manual)"
        onClose={() => setShowCompanyModal(false)}
      >
        <form onSubmit={createCompany} className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Dados da Empresa */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 border-b pb-2">Informações da Empresa</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nome da Empresa *</label>
              <input
                type="text"
                required
                value={companyForm.companyName}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, companyName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Sua Empresa Ltda"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">CNPJ *</label>
                <input
                  type="text"
                  required
                  value={companyForm.document}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, document: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Telefone *</label>
                <input
                  type="tel"
                  required
                  value={companyForm.phone}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Email da Empresa *</label>
              <input
                type="email"
                required
                value={companyForm.email}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="contato@empresa.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-2">Módulos de acesso</label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  ['accessB2B', 'Módulo B2B'],
                  ['accessB2G', 'Módulo B2G'],
                  ['accessPreSales', 'Pré-vendas'],
                  ['accessManagement', 'Gestão'],
                  ['accessAutomation', 'Automações']
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 rounded-lg border border-gray-200 p-3 text-sm dark:border-blue-500/20">
                    <input
                      type="checkbox"
                      checked={Boolean(companyForm[key])}
                      onChange={(e) => handleCompanyModuleToggle(setCompanyForm, key, e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <span className="font-medium text-gray-800 dark:text-slate-100">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Dados do Responsável */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Responsável pela Conta</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={companyForm.responsibleName}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, responsibleName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="João Silva"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={companyForm.responsibleEmail}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, responsibleEmail: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="joao@empresa.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Telefone *</label>
                <input
                  type="tel"
                  required
                  value={companyForm.responsiblePhone}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, responsiblePhone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          {/* Usuário Administrador */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Usuário Administrador</h3>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Este usuário será criado, mas só poderá acessar após aprovação da empresa pelo MASTER.
            </p>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nome do Admin *</label>
              <input
                type="text"
                required
                value={companyForm.adminName}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, adminName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="Nome completo"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Email do Admin *</label>
              <input
                type="email"
                required
                value={companyForm.adminEmail}
                onChange={(e) => setCompanyForm((prev) => ({ ...prev, adminEmail: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                placeholder="admin@empresa.com"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Senha *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={companyForm.adminPassword}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, adminPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Confirmar Senha *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={companyForm.adminConfirmPassword}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, adminConfirmPassword: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  placeholder="Repita a senha"
                />
              </div>
            </div>
          </div>

          {/* Plano e Status */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Licenciamento</h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Plano *</label>
                <select
                  value={companyForm.planCode}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, planCode: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="MENSAL">Mensal</option>
                  <option value="TRIMESTRAL">Trimestral</option>
                  <option value="SEMESTRAL">Semestral</option>
                  <option value="ANUAL">Anual</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Status</label>
                <select
                  value={companyForm.status}
                  onChange={(e) => setCompanyForm((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                >
                  <option value="PROSPECT">Aguardando aprovação</option>
                  <option value="ACTIVE">Ativa</option>
                  <option value="SUSPENDED">Suspensa</option>
                  <option value="CANCELED">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowCompanyModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:text-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-600/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingCompany}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              {savingCompany ? 'Criando empresa...' : 'Cadastrar Empresa para Aprovação'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showCompanyUserModal}
        title={`Novo Usuário - ${targetCompanyForUser?.name || 'Empresa'}`}
        onClose={() => {
          setShowCompanyUserModal(false);
          setTargetCompanyForUser(null);
        }}
      >
        <form onSubmit={saveCompanyUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Nome *</label>
            <input
              type="text"
              required
              value={companyUserForm.name}
              onChange={(e) => setCompanyUserForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Email *</label>
            <input
              type="email"
              required
              value={companyUserForm.email}
              onChange={(e) => setCompanyUserForm((prev) => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Senha (opcional)</label>
            <input
              type="password"
              value={companyUserForm.password}
              onChange={(e) => setCompanyUserForm((prev) => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
              placeholder="Se vazio, o sistema gera senha"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-100 mb-1">Perfil</label>
            <select
              value={companyUserForm.role}
              onChange={(e) => handleCompanyUserRoleChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
            >
              <option value="USER">User (B2B/B2G)</option>
              <option value="PRE_SALES">Pre-Vendas</option>
              {isMasterSession && <option value="ADMIN">Admin</option>}
            </select>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-blue-500/20 p-3 space-y-2">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">Acesso por módulo</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MODULE_ACCESS_ITEMS.map(({ key, label }) => {
                const companyAccess = normalizeCompanyModuleAccess(targetCompanyForUser);
                return (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-100">
                    <input
                      type="checkbox"
                      checked={Boolean(companyUserForm[key])}
                      disabled={!companyAccess[key] || ['ADMIN', 'PRE_SALES', 'MASTER'].includes(normalizeRole(companyUserForm.role))}
                      onChange={(e) => handleCompanyUserModuleToggle(key, e.target.checked)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCompanyUserModal(false)}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors dark:text-slate-100 dark:bg-slate-700/60 dark:hover:bg-slate-600/70"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingCompanyUser}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50"
            >
              {savingCompanyUser ? 'Salvando...' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de Confirmação Seguro (compatível com iframes sandboxed sem allow-modals) */}
      <Modal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title || 'Confirmação'}
        onClose={closeConfirm}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-slate-200 whitespace-pre-line leading-relaxed">
            {confirmDialog.description}
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-gray-200 dark:border-slate-700">
            <button
              type="button"
              onClick={closeConfirm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              {confirmDialog.cancelText || 'Cancelar'}
            </button>
            <button
              type="button"
              onClick={() => {
                const cb = confirmDialog.onConfirm;
                closeConfirm();
                if (typeof cb === 'function') {
                  cb();
                }
              }}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                confirmDialog.isDanger
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {confirmDialog.confirmText || 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
