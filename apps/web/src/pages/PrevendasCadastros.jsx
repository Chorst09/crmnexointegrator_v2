import { getOpportunityFabricante } from '../utils/registry-manufacturer.mjs';
export { getOpportunityFabricante } from '../utils/registry-manufacturer.mjs';
import { REGISTRY_OPPORTUNITY_STATUSES, getRegistryStatusLabel, normalizeRegistryStatus } from '../utils/registry-opportunity-status.mjs';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  DollarSign,
  Eye,
  ExternalLink,
  FileDown,
  FileText,
  Filter,
  Globe2,
  Image,
  Link2,
  Mail,
  Package,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  Sparkles,
  Tag,
  Target,
  Trash2,
  User,
  Users,
  Upload,
  X
} from 'lucide-react';

import { buildApiUrl, getAuthHeaders } from '../config/api';
import AnimatedStats from '../components/AnimatedStats';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import { applyPipelineOpportunity, filterPipelineOpportunities, getPipelineClient, getPipelineType } from '../utils/pipeline-opportunity.mjs';

const TAB_KEYS = {
  DISTRIBUIDORES: 'distribuidores',
  FORNECEDORES: 'fornecedores',
  OPORTUNIDADES: 'oportunidades'
};

const TABS = [
  { key: TAB_KEYS.DISTRIBUIDORES, label: 'Distribuidores', icon: Building2 },
  { key: TAB_KEYS.FORNECEDORES, label: 'Fornecedores', icon: Package },
  { key: TAB_KEYS.OPORTUNIDADES, label: 'Registro de Oportunidades', icon: Target }
];

const TAB_PAGE_META = {
  [TAB_KEYS.DISTRIBUIDORES]: {
    title: 'Distribuidores',
    subtitle: 'Gestão operacional de distribuidores para cotações B2B e B2G',
    breadcrumb: 'Distribuidores',
    createLabel: 'Novo Distribuidor'
  },
  [TAB_KEYS.FORNECEDORES]: {
    title: 'Fornecedores',
    subtitle: 'Gestão operacional de fornecedores homologados do Pré-Vendas',
    breadcrumb: 'Fornecedores',
    createLabel: 'Novo Fornecedor'
  },
  [TAB_KEYS.OPORTUNIDADES]: {
    title: 'Registro de Oportunidades',
    subtitle: 'Registro técnico de oportunidades com vínculo ao pipeline comercial',
    breadcrumb: 'Registro de Oportunidades',
    createLabel: 'Novo Registro de Oportunidade'
  }
};

const resolveTabKey = (value) => {
  const normalized = asString(value).toLowerCase();
  return Object.values(TAB_KEYS).includes(normalized) ? normalized : TAB_KEYS.DISTRIBUIDORES;
};

const defaultRegistry = {
  distribuidores: [],
  fornecedores: [],
  oportunidades: []
};

const defaultPartnerForm = {
  distribuidorIds: [],
  nome: '',
  logoUrl: '',
  razaoSocial: '',
  cnpj: '',
  contato: '',
  email: '',
  telefone: '',
  cidade: '',
  estado: '',
  site: '',
  status: 'ATIVO',
  categoriasText: '',
  marcasText: '',
  accountManager: '',
  portalUrl: '',
  portalLogin: '',
  portalSenha: '',
  ecommerceUrl: '',
  ecommerceLogin: '',
  ecommerceSenha: '',
  produtosPrincipaisText: '',
  vendedoresResponsaveis: [],
  portalPartnerUrl: '',
  portalPartnerLogin: '',
  portalPartnerSenha: '',
  treinamentoUrl: '',
  treinamentoLogin: '',
  treinamentoSenha: '',
  contatoPrincipal: '',
  emailContatoPrincipal: '',
  telefoneContatoPrincipal: '',
  contatoCotacoes: '',
  emailContatoCotacoes: '',
  telefoneContatoCotacoes: '',
  produtosServicosText: '',
  templateRoUrl: '',
  procedimentoRo: '',
  observacoes: ''
};

const defaultOpportunityForm = {
  oportunidadeId: '',
  titulo: '',
  cliente: '',
  gerenteConta: '',
  origem: 'B2B',
  modalidade: 'VENDA',
  valorEstimado: '',
  prazo: '',
  status: 'EM_ANALISE',
  prioridade: 'MEDIUM',
  distribuidorIds: [],
  fornecedorIds: [],
  fabricante: '',
  observacoes: '',
  numeroOportunidade: '',
  produto: '',
  dataAbertura: '',
  dataValidade: ''
};

export const getFabricanteBadgeStyle = (fabricanteName) => {
  const norm = String(fabricanteName || '').toUpperCase();
  if (norm.includes('DELL')) {
    return "border-blue-500/60 bg-blue-600/25 text-blue-700 dark:text-blue-300 shadow-sm shadow-blue-900/40 ring-1 ring-blue-400/30";
  }
  if (norm.includes('LENOVO')) {
    return "border-red-500/60 bg-red-600/25 text-red-700 dark:text-red-300 shadow-sm shadow-red-900/40 ring-1 ring-red-400/30";
  }
  if (norm.includes('HP') || norm.includes('HPE')) {
    return "border-cyan-500/60 bg-cyan-600/25 text-cyan-700 dark:text-cyan-300 shadow-sm shadow-cyan-900/40 ring-1 ring-cyan-400/30";
  }
  if (norm.includes('CISCO')) {
    return "border-sky-500/60 bg-sky-600/25 text-sky-700 dark:text-sky-300 shadow-sm shadow-sky-900/40 ring-1 ring-sky-400/30";
  }
  if (norm.includes('FORTINET') || norm.includes('VEEAM')) {
    return "border-emerald-500/60 bg-emerald-600/25 text-emerald-700 dark:text-emerald-300 shadow-sm shadow-emerald-900/40 ring-1 ring-emerald-400/30";
  }
  if (norm.includes('ARUBA')) {
    return "border-orange-500/60 bg-orange-600/25 text-orange-700 dark:text-orange-300 shadow-sm shadow-orange-900/40 ring-1 ring-orange-400/30";
  }
  if (norm.includes('HUAWEI')) {
    return "border-rose-500/60 bg-rose-600/25 text-rose-700 dark:text-rose-300 shadow-sm shadow-rose-900/40 ring-1 ring-rose-400/30";
  }
  if (norm.includes('MICROSOFT')) {
    return "border-teal-500/60 bg-teal-600/25 text-teal-700 dark:text-teal-300 shadow-sm shadow-teal-900/40 ring-1 ring-teal-400/30";
  }
  if (norm.includes('SOPHOS')) {
    return "border-indigo-500/60 bg-indigo-600/25 text-indigo-700 dark:text-indigo-300 shadow-sm shadow-indigo-900/40 ring-1 ring-indigo-400/30";
  }
  return "border-amber-500/60 bg-amber-500/25 text-amber-700 dark:text-amber-300 shadow-sm shadow-amber-900/40 ring-1 ring-amber-400/30";
};

const OPPORTUNITY_TERM_OPTIONS = ['12', '24', '36', '48', '60'];
const MAX_LOGO_FILE_SIZE = 1024 * 1024;

const toCurrency = (value) => `R$ ${Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const toDateBr = (value) => {
  if (!value) return '-';
  const date = parseLocalDate(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
};

const formatOpportunityTerm = (value) => {
  if (!value) return '-';
  const normalized = String(value).trim();
  if (OPPORTUNITY_TERM_OPTIONS.includes(normalized)) return `${normalized} meses`;
  return toDateBr(value);
};

const toDateTimeBr = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const asString = (value) => String(value || '').trim();

const escapeHtml = (value) => asString(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const parseLocalDate = (value) => {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const parts = raw.split('-').map(Number);
  if (parts.length === 3 && parts.every(Number.isFinite)) {
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getValidityInfo = (value) => {
  const validityDate = parseLocalDate(value);
  if (!validityDate) {
    return {
      label: 'Sem validade informada',
      detail: 'Informe a data de validade para controlar o risco de vencimento.',
      tone: 'slate',
      daysRemaining: null
    };
  }

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const validityStart = new Date(validityDate.getFullYear(), validityDate.getMonth(), validityDate.getDate());
  const daysRemaining = Math.ceil((validityStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000));

  if (daysRemaining < 0) {
    return {
      label: 'Oportunidade vencida',
      detail: `Vencida há ${Math.abs(daysRemaining)} dia(s). Renove o registro ou arquive a oportunidade.`,
      tone: 'red',
      daysRemaining
    };
  }
  if (daysRemaining === 0) {
    return {
      label: 'Vence hoje',
      detail: 'A validade termina hoje. Priorize a renovação ou conclusão do atendimento.',
      tone: 'red',
      daysRemaining
    };
  }
  if (daysRemaining <= 7) {
    return {
      label: `Vence em ${daysRemaining} dia(s)`,
      detail: 'Alerta crítico: oportunidade próxima do vencimento em até 7 dias.',
      tone: 'rose',
      daysRemaining
    };
  }
  if (daysRemaining <= 15) {
    return {
      label: `Vence em ${daysRemaining} dia(s)`,
      detail: 'Alerta de atenção: acompanhe a renovação antes do prazo final.',
      tone: 'amber',
      daysRemaining
    };
  }
  if (daysRemaining <= 30) {
    return {
      label: `Vence em ${daysRemaining} dia(s)`,
      detail: 'Monitoramento preventivo: validade dentro dos próximos 30 dias.',
      tone: 'yellow',
      daysRemaining
    };
  }

  return {
    label: `Válida por ${daysRemaining} dia(s)`,
    detail: 'Validade vigente, sem alerta de vencimento imediato.',
    tone: 'emerald',
    daysRemaining
  };
};

const validityBadgeClass = (tone) => {
  if (tone === 'red') return "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30";
  if (tone === 'rose') return "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30";
  if (tone === 'amber') return "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30";
  if (tone === 'yellow') return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30";
  if (tone === 'emerald') return "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  return "bg-[rgb(var(--crm-surface-rgb)_/_0.2)] text-[rgb(var(--crm-ink-rgb)_/_1)] border-[var(--crm-border)]";
};

const normalizeRegistryPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return defaultRegistry;

  return {
    distribuidores: Array.isArray(payload.distribuidores) ? payload.distribuidores : [],
    fornecedores: Array.isArray(payload.fornecedores) ? payload.fornecedores : [],
    oportunidades: Array.isArray(payload.oportunidades) ? payload.oportunidades : []
  };
};

const badgeClassForStatus = (status) => {
  const key = asString(status).toUpperCase();
  if (['ATIVO', 'ABERTA', 'GANHA', 'PRECIFICADA', 'APROVADO'].includes(key)) {
    return "border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-100";
  }
  if (['EM_ANALISE', 'EM_COTACAO', 'AGUARDANDO_APROVACAO'].includes(key)) {
    return "border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-100";
  }
  if (['INATIVO', 'PERDIDA', 'BLOQUEADO', 'NEGADO'].includes(key)) {
    return "border-rose-500/40 bg-rose-500/20 text-rose-700 dark:text-rose-100";
  }
  return "border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.2)] text-[rgb(var(--crm-ink-rgb)_/_1)]";
};

const badgeClassForPriority = (priority) => {
  const key = asString(priority).toUpperCase();
  if (key === 'URGENT' || key === 'URGENTE') return "border-rose-500/40 bg-rose-500/20 text-rose-700 dark:text-rose-100";
  if (key === 'HIGH' || key === 'ALTA') return "border-amber-500/40 bg-amber-500/20 text-amber-700 dark:text-amber-100";
  if (key === 'LOW' || key === 'BAIXA') return "border-emerald-500/40 bg-emerald-500/20 text-emerald-700 dark:text-emerald-100";
  return "border-sky-500/40 bg-sky-500/20 text-sky-700 dark:text-sky-100";
};

const priorityLabel = (value) => {
  const key = asString(value).toUpperCase();
  if (key === 'LOW') return 'Baixa';
  if (key === 'HIGH') return 'Alta';
  if (key === 'URGENT') return 'Urgente';
  return 'Média';
};

const pdfValidityColors = {
  red: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b' },
  rose: { bg: '#ffe4e6', border: '#f43f5e', text: '#9f1239' },
  amber: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  yellow: { bg: '#fef9c3', border: '#eab308', text: '#854d0e' },
  emerald: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  slate: { bg: '#f1f5f9', border: "var(--crm-border)", text: '#334155' }
};

export default function PrevendasCadastros({ forcedTab = null }) {
  const navigate = useNavigate();
  const location = useLocation();
  const fromPreVendasDashboard = Boolean(location.state?.fromPreVendasDashboard);
  const returnToPreVendasDashboard = () => navigate(location.state?.returnTo || '/pre-vendas');
  const forcedTabKey = forcedTab ? resolveTabKey(forcedTab) : null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState(forcedTabKey || TAB_KEYS.DISTRIBUIDORES);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFabricanteFilter, setSelectedFabricanteFilter] = useState('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('ALL');
  const [selectedOrigemFilter, setSelectedOrigemFilter] = useState('ALL');

  const [registry, setRegistry] = useState(defaultRegistry);
  const [pipelineOpportunities, setPipelineOpportunities] = useState([]);
  const [pipelineType, setPipelineType] = useState('B2B');
  const [pipelineSearch, setPipelineSearch] = useState('');
  const matchingPipelineOpportunities = useMemo(
    () => filterPipelineOpportunities(pipelineOpportunities, pipelineType, pipelineSearch),
    [pipelineOpportunities, pipelineType, pipelineSearch]
  );
  const [users, setUsers] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState(forcedTabKey || TAB_KEYS.DISTRIBUIDORES);
  const [editingItem, setEditingItem] = useState(null);
  const [viewingDistributor, setViewingDistributor] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);

  const [partnerForm, setPartnerForm] = useState(defaultPartnerForm);
  const [opportunityForm, setOpportunityForm] = useState(defaultOpportunityForm);

  const distMap = useMemo(() => {
    return new Map((registry.distribuidores || []).map((item) => [item.id, item.nome]));
  }, [registry.distribuidores]);

  const fornMap = useMemo(() => {
    return new Map((registry.fornecedores || []).map((item) => [item.id, item.nome]));
  }, [registry.fornecedores]);

  const loadData = async () => {
    try {
      setLoading(true);

      const [registryRes, opportunitiesRes, usersRes] = await Promise.all([
        fetch(buildApiUrl('/prevendas-cadastros'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/opportunities'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/users'), { headers: getAuthHeaders() })
      ]);

      const registryPayload = registryRes.ok
        ? normalizeRegistryPayload(await registryRes.json().catch(() => ({})))
        : defaultRegistry;

      const opportunitiesPayload = opportunitiesRes.ok
        ? await opportunitiesRes.json().catch(() => [])
        : [];

      const usersPayload = usersRes.ok
        ? await usersRes.json().catch(() => [])
        : [];

      setRegistry(registryPayload);
      setPipelineOpportunities(Array.isArray(opportunitiesPayload) ? opportunitiesPayload : []);
      setUsers(Array.isArray(usersPayload) ? usersPayload.filter(u => u && u.id && u.name) : []);
    } catch (error) {
      console.error('Erro ao carregar cadastros de pré-vendas:', error);
      setRegistry(defaultRegistry);
      setPipelineOpportunities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (forcedTabKey) setActiveTab(forcedTabKey);
  }, [forcedTabKey]);

  const currentTab = forcedTabKey || activeTab;

  const stats = useMemo(() => {
    const oportunidadesVinculadas = (registry.oportunidades || []).filter((item) => asString(item.oportunidadeId)).length;

    return [
      {
        title: 'Distribuidores',
        value: registry.distribuidores.length,
        subtitle: 'Base ativa para cotações',
        icon: Building2,
        color: 'blue'
      },
      {
        title: 'Fornecedores',
        value: registry.fornecedores.length,
        subtitle: 'Parceiros homologados',
        icon: Package,
        color: 'purple'
      },
      {
        title: 'Oportunidades Registradas',
        value: registry.oportunidades.length,
        subtitle: 'Registro operacional pré-vendas',
        icon: Target,
        color: 'green'
      },
      {
        title: 'Vinculadas ao Pipeline',
        value: oportunidadesVinculadas,
        subtitle: 'Com ID da oportunidade comercial',
        icon: Link2,
        color: 'yellow'
      }
    ];
  }, [registry]);

  const availableFabricantes = useMemo(() => {
    const counts = new Map();
    const addFab = (raw) => {
      if (!raw) return;
      const clean = String(raw).trim().toUpperCase();
      if (!clean) return;
      counts.set(clean, (counts.get(clean) || 0) + 1);
    };

    (registry.oportunidades || []).forEach((item) => {
      const fab = getOpportunityFabricante(item, fornMap);
      if (fab) {
        fab.split(',').forEach((f) => addFab(f));
      }
    });

    ['DELL', 'LENOVO', 'HP', 'CISCO', 'FORTINET', 'ARUBA', 'HUAWEI'].forEach((b) => {
      if (!counts.has(b)) counts.set(b, 0);
    });

    (registry.fornecedores || []).forEach((f) => {
      if (f.nome && !counts.has(f.nome.trim().toUpperCase())) {
        counts.set(f.nome.trim().toUpperCase(), 0);
      }
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [registry.oportunidades, registry.fornecedores, fornMap]);

  const activeRows = useMemo(() => {
    const source = registry[currentTab] || [];
    const term = asString(searchTerm).toLowerCase();

    let filtered = source;

    if (currentTab === TAB_KEYS.OPORTUNIDADES) {
      if (selectedFabricanteFilter !== 'ALL') {
        const target = selectedFabricanteFilter.toUpperCase();
        filtered = filtered.filter((item) => {
          const fab = getOpportunityFabricante(item, fornMap).toUpperCase();
          const directFab = String(item.fabricante || '').toUpperCase();
          const linkedSuppliers = (item.fornecedorIds || [])
            .map((id) => String(fornMap.get(id) || '').toUpperCase())
            .filter(Boolean);
          const num = String(item.numeroOportunidade || '').toUpperCase();

          return (
            fab.includes(target) ||
            directFab.includes(target) ||
            linkedSuppliers.some((s) => s.includes(target)) ||
            num.startsWith(target) ||
            num.includes(`RO ${target}`) ||
            num.includes(`RO-${target}`) ||
            num.includes(`RO_${target}`)
          );
        });
      }

      if (selectedStatusFilter !== 'ALL') {
        filtered = filtered.filter((item) => normalizeRegistryStatus(item.status) === selectedStatusFilter);
      }

      if (selectedOrigemFilter !== 'ALL') {
        filtered = filtered.filter((item) => String(item.origem || 'B2B').toUpperCase() === selectedOrigemFilter);
      }
    }

    if (!term) return filtered;

    return filtered.filter((item) => {
      if (currentTab === TAB_KEYS.OPORTUNIDADES) {
        const fab = getOpportunityFabricante(item, fornMap);
        return [
          item.titulo,
          item.cliente,
          item.oportunidadeId,
          item.status,
          item.modalidade,
          item.origem,
          item.observacoes,
          item.numeroOportunidade,
          item.produto,
          item.fabricante,
          fab,
          `RO ${fab}`,
          `RO ${item.fabricante}`
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term);
      }

      return [
        item.nome,
        item.logoUrl,
        item.razaoSocial,
        item.cnpj,
        item.contato,
        item.email,
        item.telefone,
        item.accountManager,
        item.portalUrl,
        item.portalLogin,
        item.ecommerceUrl,
        item.ecommerceLogin,
        item.portalPartnerUrl,
        item.portalPartnerLogin,
        item.treinamentoUrl,
        item.treinamentoLogin,
        item.contatoPrincipal,
        item.emailContatoPrincipal,
        item.telefoneContatoPrincipal,
        item.contatoCotacoes,
        item.emailContatoCotacoes,
        item.telefoneContatoCotacoes,
        item.templateRoUrl,
        item.procedimentoRo,
        item.cidade,
        item.estado,
        item.status,
        Array.isArray(item.categorias) ? item.categorias.join(' ') : '',
        Array.isArray(item.marcas) ? item.marcas.join(' ') : '',
        Array.isArray(item.produtosPrincipais) ? item.produtosPrincipais.join(' ') : '',
        Array.isArray(item.produtosServicos) ? item.produtosServicos.join(' ') : '',
        item.observacoes
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [currentTab, registry, searchTerm, selectedFabricanteFilter, selectedStatusFilter, selectedOrigemFilter, fornMap]);

  const closeModal = () => {
    setPipelineSearch('');
    setPipelineType('B2B');
    setModalOpen(false);
    setEditingItem(null);
    setPartnerForm(defaultPartnerForm);
    setOpportunityForm(defaultOpportunityForm);
  };

  const openCreateModal = (type) => {
    setPipelineSearch('');
    setPipelineType('B2B');
    setModalType(type);
    setEditingItem(null);
    setPartnerForm(defaultPartnerForm);
    setOpportunityForm(defaultOpportunityForm);
    setModalOpen(true);
  };

  const openEditModal = (type, item) => {
    setPipelineSearch('');
    const linkedOpportunity = pipelineOpportunities.find((entry) => entry.id === item.oportunidadeId);
    setPipelineType(linkedOpportunity ? getPipelineType(linkedOpportunity) : item.origem === 'B2G' ? 'B2G' : 'B2B');
    setModalType(type);
    setEditingItem(item);

    if (type === TAB_KEYS.OPORTUNIDADES) {
      setOpportunityForm({
        oportunidadeId: item.oportunidadeId || '',
        titulo: item.titulo || '',
        cliente: item.cliente || '',
        gerenteConta: item.gerenteConta || '',
        origem: item.origem || 'B2B',
        modalidade: item.modalidade || 'VENDA',
        valorEstimado: item.valorEstimado ?? '',
        prazo: OPPORTUNITY_TERM_OPTIONS.includes(String(item.prazo || '').trim()) ? String(item.prazo).trim() : '',
        status: normalizeRegistryStatus(item.status),
        prioridade: item.prioridade || 'MEDIUM',
        distribuidorIds: Array.isArray(item.distribuidorIds) ? item.distribuidorIds : [],
        fornecedorIds: Array.isArray(item.fornecedorIds) ? item.fornecedorIds : [],
        fabricante: getOpportunityFabricante(item, fornMap),
        observacoes: item.observacoes || '',
        numeroOportunidade: item.numeroOportunidade || '',
        produto: item.produto || '',
        dataAbertura: item.dataAbertura ? String(item.dataAbertura).slice(0, 10) : '',
        dataValidade: item.dataValidade ? String(item.dataValidade).slice(0, 10) : ''
      });
    } else {
      setPartnerForm({
        distribuidorIds: Array.isArray(item.distribuidorIds) ? item.distribuidorIds : [],
        nome: item.nome || '',
        logoUrl: item.logoUrl || item.logo || '',
        razaoSocial: item.razaoSocial || '',
        cnpj: item.cnpj || '',
        contato: item.contato || '',
        email: item.email || '',
        telefone: item.telefone || '',
        cidade: item.cidade || '',
        estado: item.estado || '',
        site: item.site || '',
        status: item.status || 'ATIVO',
        categoriasText: Array.isArray(item.categorias) ? item.categorias.join(', ') : '',
        marcasText: Array.isArray(item.marcas) ? item.marcas.join(', ') : '',
        accountManager: item.accountManager || '',
        portalUrl: item.portalUrl || '',
        portalLogin: item.portalLogin || '',
        portalSenha: item.portalSenha || '',
        ecommerceUrl: item.ecommerceUrl || '',
        ecommerceLogin: item.ecommerceLogin || '',
        ecommerceSenha: item.ecommerceSenha || '',
        produtosPrincipaisText: Array.isArray(item.produtosPrincipais) ? item.produtosPrincipais.join(', ') : '',
        vendedoresResponsaveis: Array.isArray(item.vendedoresResponsaveis) ? item.vendedoresResponsaveis : [],
        portalPartnerUrl: item.portalPartnerUrl || '',
        portalPartnerLogin: item.portalPartnerLogin || '',
        portalPartnerSenha: item.portalPartnerSenha || '',
        treinamentoUrl: item.treinamentoUrl || '',
        treinamentoLogin: item.treinamentoLogin || '',
        treinamentoSenha: item.treinamentoSenha || '',
        contatoPrincipal: item.contatoPrincipal || item.contato || '',
        emailContatoPrincipal: item.emailContatoPrincipal || item.email || '',
        telefoneContatoPrincipal: item.telefoneContatoPrincipal || item.telefone || '',
        contatoCotacoes: item.contatoCotacoes || '',
        emailContatoCotacoes: item.emailContatoCotacoes || '',
        telefoneContatoCotacoes: item.telefoneContatoCotacoes || '',
        produtosServicosText: Array.isArray(item.produtosServicos)
          ? item.produtosServicos.join(', ')
          : Array.isArray(item.categorias)
            ? item.categorias.join(', ')
            : '',
        templateRoUrl: item.templateRoUrl || '',
        procedimentoRo: item.procedimentoRo || '',
        observacoes: item.observacoes || ''
      });
    }

    setModalOpen(true);
  };

  const closeDistributorView = () => {
    setViewingDistributor(null);
  };

  const closeSupplierView = () => {
    setViewingSupplier(null);
  };

  const submitPartner = async () => {
    const nome = asString(partnerForm.nome);
    if (!nome) {
      alert('Informe o nome antes de salvar.');
      return;
    }

    const payload = {
      ...partnerForm,
      nome,
      categorias: asString(partnerForm.categoriasText)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      marcas: asString(partnerForm.marcasText)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      produtosPrincipais: asString(partnerForm.produtosPrincipaisText)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      produtosServicos: asString(partnerForm.produtosServicosText)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean),
      vendedoresResponsaveis: Array.isArray(partnerForm.vendedoresResponsaveis)
        ? partnerForm.vendedoresResponsaveis
          .map((seller) => ({
            nome: asString(seller.nome),
            email: asString(seller.email),
            telefone: asString(seller.telefone),
            marca: asString(seller.marca)
          }))
          .filter((seller) => seller.nome || seller.email || seller.telefone || seller.marca)
        : []
    };

    if (modalType === TAB_KEYS.FORNECEDORES) {
      payload.contato = asString(partnerForm.contatoPrincipal);
      payload.email = asString(partnerForm.emailContatoPrincipal);
      payload.telefone = asString(partnerForm.telefoneContatoPrincipal);
      payload.categorias = payload.produtosServicos;
    }

    try {
      setSaving(true);
      const url = editingItem
        ? buildApiUrl(`/prevendas-cadastros/${modalType}/${editingItem.id}`)
        : buildApiUrl(`/prevendas-cadastros/${modalType}`);

      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Falha ao salvar cadastro');
      }

      closeModal();
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar parceiro:', error);
      alert(error.message || 'Erro ao salvar cadastro');
    } finally {
      setSaving(false);
    }
  };

  const submitOpportunityRegistry = async () => {
    const titulo = asString(opportunityForm.titulo);
    if (!titulo) {
      alert('Informe o título da oportunidade antes de salvar.');
      return;
    }

    const fabricante = getOpportunityFabricante(opportunityForm, fornMap);
    if (!fabricante) {
      alert('Informe o fabricante / fornecedor do RO antes de salvar.');
      return;
    }

    const payload = {
      ...opportunityForm,
      titulo,
      cliente: asString(opportunityForm.cliente),
      valorEstimado: opportunityForm.valorEstimado === '' ? null : Number(opportunityForm.valorEstimado),
      prazo: opportunityForm.prazo || null,
      fabricante,
      dataAbertura: opportunityForm.dataAbertura || null,
      dataValidade: opportunityForm.dataValidade || null,
      distribuidorIds: Array.isArray(opportunityForm.distribuidorIds) ? opportunityForm.distribuidorIds : [],
      fornecedorIds: Array.isArray(opportunityForm.fornecedorIds) ? opportunityForm.fornecedorIds : []
    };

    try {
      setSaving(true);
      const url = editingItem
        ? buildApiUrl(`/prevendas-cadastros/oportunidades/${editingItem.id}`)
        : buildApiUrl('/prevendas-cadastros/oportunidades');

      const response = await fetch(url, {
        method: editingItem ? 'PUT' : 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Falha ao salvar registro de oportunidade');
      }

      closeModal();
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar registro de oportunidade:', error);
      alert(error.message || 'Erro ao salvar registro');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (type, item) => {
    const nome = type === TAB_KEYS.OPORTUNIDADES ? item.titulo : item.nome;
    if (!window.confirm(`Deseja excluir "${nome}"?`)) return;

    try {
      setSaving(true);
      const response = await fetch(buildApiUrl(`/prevendas-cadastros/${type}/${item.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Falha ao excluir registro');
      }

      await loadData();
    } catch (error) {
      console.error('Erro ao excluir registro:', error);
      alert(error.message || 'Erro ao excluir registro');
    } finally {
      setSaving(false);
    }
  };

  const handlePickPipelineOpportunity = (opportunityId) => {
    const selected = pipelineOpportunities.find((entry) => entry.id === opportunityId);
    if (!selected) {
      setOpportunityForm((prev) => ({ ...prev, oportunidadeId: '' }));
      return;
    }

    setOpportunityForm((prev) => applyPipelineOpportunity(prev, selected));
    setPipelineSearch('');
  };

  const handlePipelineTypeChange = (type) => {
    setPipelineType(type);
    setPipelineSearch('');
    setOpportunityForm((prev) => ({
      ...prev, origem: type, oportunidadeId: '',
      cliente: prev.oportunidadeId ? '' : prev.cliente
    }));
  };

  const handleViewOpportunityPdf = (item) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Não foi possível abrir a visualização em PDF. Libere pop-ups e tente novamente.');
      return;
    }

    const linkedDistributors = (item.distribuidorIds || []).map((id) => distMap.get(id)).filter(Boolean);
    const linkedSuppliers = (item.fornecedorIds || []).map((id) => fornMap.get(id)).filter(Boolean);
    const oppFabricante = getOpportunityFabricante(item, fornMap);
    const validity = getValidityInfo(item.dataValidade);
    const validityColors = pdfValidityColors[validity.tone] || pdfValidityColors.slate;
    const generatedAt = new Date().toLocaleString('pt-BR');

    const renderRows = (rows) => rows
      .map(([label, value]) => `
        <div class="row">
          <span class="label">${escapeHtml(label)}</span>
          <span class="value">${escapeHtml(value || '-')}</span>
        </div>
      `)
      .join('');

    const renderList = (values, emptyText) => {
      const list = Array.isArray(values) ? values.filter(Boolean) : [];
      if (list.length === 0) return `<p class="empty-text">${escapeHtml(emptyText)}</p>`;
      return `<div class="pills">${list.map((value) => `<span>${escapeHtml(value)}</span>`).join('')}</div>`;
    };

    const html = `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Registro de Oportunidade - ${escapeHtml(item.titulo || item.numeroOportunidade || item.id || '')}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 24px;
            color: #0f172a;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .page {
            max-width: 960px;
            margin: 0 auto;
          }
          .toolbar {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 14px;
          }
          button {
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            background: #0284c7;
            color: #ffffff;
            cursor: pointer;
            font-size: 13px;
            font-weight: 700;
            padding: 9px 14px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            gap: 18px;
            border-bottom: 4px solid #0f172a;
            padding-bottom: 18px;
            margin-bottom: 18px;
          }
          .eyebrow {
            color: #0369a1;
            font-size: 12px;
            font-weight: 800;
            letter-spacing: .08em;
            text-transform: uppercase;
          }
          h1 {
            margin: 5px 0 8px;
            color: #0f172a;
            font-size: 30px;
            line-height: 1.15;
          }
          h2 {
            margin: 0 0 12px;
            color: #075985;
            font-size: 17px;
          }
          .muted {
            color: #64748b;
            font-size: 12px;
            line-height: 1.45;
          }
          .badge {
            display: inline-block;
            border: 1px solid #bae6fd;
            border-radius: 999px;
            background: #e0f2fe;
            color: #075985;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 800;
            white-space: nowrap;
          }
          .validity-alert {
            border: 2px solid ${validityColors.border};
            border-left-width: 10px;
            border-radius: 12px;
            background: ${validityColors.bg};
            color: ${validityColors.text};
            padding: 16px 18px;
            margin: 18px 0;
          }
          .validity-title {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            font-size: 20px;
            font-weight: 900;
          }
          .validity-date {
            white-space: nowrap;
          }
          .validity-detail {
            margin-top: 8px;
            font-size: 13px;
            font-weight: 700;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 14px;
            margin-top: 14px;
          }
          .card {
            border: 1px solid #cbd5e1;
            border-radius: 12px;
            background: #ffffff;
            padding: 14px;
          }
          .card.accent {
            border-color: #7dd3fc;
            background: #f0f9ff;
          }
          .row {
            display: flex;
            justify-content: space-between;
            gap: 14px;
            border-bottom: 1px solid #e2e8f0;
            padding: 7px 0;
            font-size: 13px;
          }
          .row:last-child { border-bottom: 0; }
          .label { color: #475569; }
          .value {
            color: #0f172a;
            font-weight: 800;
            text-align: right;
            overflow-wrap: anywhere;
          }
          .section {
            margin-top: 18px;
          }
          .pills {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .pills span {
            border: 1px solid #bae6fd;
            border-radius: 999px;
            background: #e0f2fe;
            color: #075985;
            font-size: 12px;
            font-weight: 800;
            padding: 6px 10px;
          }
          .notes {
            min-height: 80px;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            background: #f8fafc;
            color: #334155;
            font-size: 13px;
            line-height: 1.55;
            padding: 13px;
            white-space: pre-wrap;
          }
          .empty-text {
            margin: 0;
            color: #64748b;
            font-size: 13px;
          }
          .footer {
            margin-top: 22px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 11px;
            padding-top: 10px;
          }
          @media print {
            body { margin: 12mm; }
            .toolbar { display: none; }
            .page { max-width: none; }
          }
        </style>
        <script>
          window.addEventListener('load', function () {
            setTimeout(function () {
              window.focus();
              window.print();
            }, 450);
          }, { once: true });
        </script>
      </head>
      <body>
        <main class="page">
          <div class="toolbar">
            <button type="button" onclick="window.print()">Imprimir / Salvar PDF</button>
          </div>

          <section class="header">
            <div>
              <div class="eyebrow">Pré-Vendas · Registro de Oportunidade</div>
              <h1>${escapeHtml(item.titulo || 'Oportunidade sem título')}</h1>
              <div class="muted">Documento gerado em ${escapeHtml(generatedAt)}</div>
            </div>
            <div>
              <span class="badge">${escapeHtml(getRegistryStatusLabel(item.status || 'ABERTA'))}</span>
            </div>
          </section>

          <section class="validity-alert">
            <div class="validity-title">
              <span>${escapeHtml(validity.label)}</span>
              <span class="validity-date">Validade: ${escapeHtml(toDateBr(item.dataValidade))}</span>
            </div>
            <div class="validity-detail">${escapeHtml(validity.detail)}</div>
          </section>

          <section class="grid">
            <article class="card accent">
              <h2>Resumo Comercial</h2>
              ${renderRows([
                ['Cliente', item.cliente],
                ['Gerente de Contas', item.gerenteConta],
                ['Origem', item.origem],
                ['Modalidade', item.modalidade],
                ['Valor estimado', toCurrency(item.valorEstimado)],
                ['Prazo comercial', formatOpportunityTerm(item.prazo)],
                ['Prioridade', priorityLabel(item.prioridade)]
              ])}
            </article>

            <article class="card">
              <h2>Registro no Fornecedor</h2>
              ${renderRows([
                ['Fabricante / Fornecedor (RO)', oppFabricante ? `RO ${oppFabricante}` : '-'],
                ['Número da oportunidade', item.numeroOportunidade],
                ['Produto', item.produto],
                ['Data de abertura', toDateBr(item.dataAbertura)],
                ['Data de validade', toDateBr(item.dataValidade)],
                ['Dias até vencimento', validity.daysRemaining === null ? '-' : String(validity.daysRemaining)]
              ])}
            </article>
          </section>

          <section class="grid">
            <article class="card">
              <h2>Vínculo com Pipeline</h2>
              ${renderRows([
                ['ID da oportunidade', item.oportunidadeId],
                ['Status do registro', item.status],
                ['Criado em', toDateTimeBr(item.createdAt)],
                ['Atualizado em', toDateTimeBr(item.updatedAt)]
              ])}
            </article>

            <article class="card">
              <h2>Controle Operacional</h2>
              ${renderRows([
                ['Distribuidores vinculados', linkedDistributors.length],
                ['Fornecedores vinculados', linkedSuppliers.length],
                ['Alerta de validade', validity.label],
                ['ID do registro', item.id]
              ])}
            </article>
          </section>

          <section class="section card">
            <h2>Distribuidores Vinculados</h2>
            ${renderList(linkedDistributors, 'Nenhum distribuidor vinculado.')}
          </section>

          <section class="section card">
            <h2>Fornecedores Vinculados</h2>
            ${renderList(linkedSuppliers, 'Nenhum fornecedor vinculado.')}
          </section>

          <section class="section">
            <h2>Observações e Próximos Passos</h2>
            <div class="notes">${escapeHtml(item.observacoes || 'Sem observações registradas.')}</div>
          </section>

          <section class="footer">
            Documento gerado pelo Nexos Integrator · Pré-Vendas. Revise a validade antes de enviar, renovar ou arquivar a oportunidade.
          </section>
        </main>
      </body>
      </html>
    `;

    const htmlBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(htmlBlob);
    printWindow.location.href = blobUrl;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };

  const addSeller = () => {
    setPartnerForm((prev) => ({
      ...prev,
      vendedoresResponsaveis: [
        ...(Array.isArray(prev.vendedoresResponsaveis) ? prev.vendedoresResponsaveis : []),
        { marca: '', nome: '', email: '', telefone: '' }
      ]
    }));
  };

  const updateSeller = (index, field, value) => {
    setPartnerForm((prev) => ({
      ...prev,
      vendedoresResponsaveis: (Array.isArray(prev.vendedoresResponsaveis) ? prev.vendedoresResponsaveis : []).map((seller, sellerIndex) => (
        sellerIndex === index ? { ...seller, [field]: value } : seller
      ))
    }));
  };

  const removeSeller = (index) => {
    setPartnerForm((prev) => ({
      ...prev,
      vendedoresResponsaveis: (Array.isArray(prev.vendedoresResponsaveis) ? prev.vendedoresResponsaveis : []).filter((_, sellerIndex) => sellerIndex !== index)
    }));
  };

  const inputClassName = "w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)] placeholder-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50";

  const handleLogoFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Selecione uma imagem para o logo.');
      return;
    }

    if (file.size > MAX_LOGO_FILE_SIZE) {
      alert('O logo deve ter no máximo 1 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPartnerForm((prev) => ({ ...prev, logoUrl: String(reader.result || '') }));
    };
    reader.onerror = () => {
      alert('Não foi possível carregar o logo selecionado.');
    };
    reader.readAsDataURL(file);
  };

  const renderLogoUploader = (label = 'Logo') => (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.35)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-24 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.7)]">
          {partnerForm.logoUrl ? (
            <img
              src={partnerForm.logoUrl}
              alt={`Logo ${partnerForm.nome || label}`}
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <Image className="h-9 w-9 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">{label}</p>
          <p className="mt-1 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">PNG, JPG, SVG ou WebP até 1 MB.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-100 hover:bg-cyan-500/30">
              <Upload className="h-4 w-4" />
              Inserir logo
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoFileChange}
                className="sr-only"
              />
            </label>
            {partnerForm.logoUrl && (
              <button
                type="button"
                onClick={() => setPartnerForm((prev) => ({ ...prev, logoUrl: '' }))}
                className="rounded-lg border border-rose-500/40 px-4 py-2 text-sm font-medium text-rose-700 dark:text-rose-100 hover:bg-rose-500/20"
              >
                Remover
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPartnerLogo = (item, sizeClassName = 'h-14 w-20') => (
    item.logoUrl || item.logo ? (
      <div className={`${sizeClassName} flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.95)]`}>
        <img
          src={item.logoUrl || item.logo}
          alt={`Logo ${item.nome || 'parceiro'}`}
          className="h-full w-full object-contain p-1.5"
        />
      </div>
    ) : (
      <div className={`${sizeClassName} flex shrink-0 items-center justify-center rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)]`}>
        <Image className="h-6 w-6 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
      </div>
    )
  );

  const renderDistributorForm = () => (
    <div className="relative space-y-5">
      <button
        type="button"
        onClick={closeModal}
        className="absolute -right-2 -top-2 rounded-lg p-2 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
        aria-label="Fechar modal"
      >
        <X className="h-5 w-5" />
      </button>

      <div>
        <h2 className="text-3xl font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{editingItem ? 'Editar Distribuidor' : 'Novo Distribuidor'}</h2>
        <p className="mt-1 text-[rgb(var(--crm-muted-rgb)_/_1)]">Cadastre dados de contato, acessos e marcas atendidas.</p>
      </div>

      {renderLogoUploader('Logo do distribuidor')}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Nome</span>
          <input
            type="text"
            value={partnerForm.nome}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, nome: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Marcas (separe por vírgula)</span>
          <input
            type="text"
            value={partnerForm.marcasText}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, marcasText: event.target.value }))}
            className={inputClassName}
            placeholder="Dell, Lenovo, HP"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Account Manager</span>
          <input
            type="text"
            value={partnerForm.accountManager}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, accountManager: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">E-mail</span>
          <input
            type="email"
            value={partnerForm.email}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, email: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Telefone</span>
          <input
            type="text"
            value={partnerForm.telefone}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, telefone: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Status</span>
          <select
            value={partnerForm.status}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, status: event.target.value }))}
            className={inputClassName}
          >
            <option value="ATIVO">Ativo</option>
            <option value="EM_HOMOLOGACAO">Em homologação</option>
            <option value="INATIVO">Inativo</option>
            <option value="BLOQUEADO">Bloqueado</option>
          </select>
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Portal (URL)</span>
          <input
            type="text"
            value={partnerForm.portalUrl}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, portalUrl: event.target.value }))}
            className={inputClassName}
            placeholder="https://portal.distribuidor.com"
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Login Portal</span>
          <input
            type="text"
            value={partnerForm.portalLogin}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, portalLogin: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Senha Portal</span>
          <input
            type="text"
            value={partnerForm.portalSenha}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, portalSenha: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">E-commerce (URL)</span>
          <input
            type="text"
            value={partnerForm.ecommerceUrl}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, ecommerceUrl: event.target.value }))}
            className={inputClassName}
            placeholder="https://ecommerce..."
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Login E-commerce</span>
          <input
            type="text"
            value={partnerForm.ecommerceLogin}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, ecommerceLogin: event.target.value }))}
            className={inputClassName}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Senha E-commerce</span>
          <input
            type="text"
            value={partnerForm.ecommerceSenha}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, ecommerceSenha: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Produtos Principais (vírgula)</span>
          <input
            type="text"
            value={partnerForm.produtosPrincipaisText}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, produtosPrincipaisText: event.target.value }))}
            className={inputClassName}
            placeholder="Lenovo, Dell"
          />
        </label>
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Vendedores Responsáveis</h3>
          <button
            type="button"
            onClick={addSeller}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] px-4 py-2 text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
          >
            <Plus className="h-4 w-4" /> Adicionar Vendedor
          </button>
        </div>

        {partnerForm.vendedoresResponsaveis.length === 0 ? (
          <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhum vendedor adicionado.</p>
        ) : (
          <div className="space-y-3">
            {partnerForm.vendedoresResponsaveis.map((seller, index) => (
              <div key={`seller-${index}`} className="grid grid-cols-1 gap-3 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.3)] p-3 lg:grid-cols-[0.8fr_1fr_1fr_1fr_auto]">
                <input
                  type="text"
                  value={seller.marca || ''}
                  onChange={(event) => updateSeller(index, 'marca', event.target.value)}
                  className={inputClassName}
                  placeholder="Marca/linha"
                />
                <input
                  type="text"
                  value={seller.nome || ''}
                  onChange={(event) => updateSeller(index, 'nome', event.target.value)}
                  className={inputClassName}
                  placeholder="Nome"
                />
                <input
                  type="email"
                  value={seller.email || ''}
                  onChange={(event) => updateSeller(index, 'email', event.target.value)}
                  className={inputClassName}
                  placeholder="E-mail"
                />
                <input
                  type="text"
                  value={seller.telefone || ''}
                  onChange={(event) => updateSeller(index, 'telefone', event.target.value)}
                  className={inputClassName}
                  placeholder="Telefone"
                />
                <button
                  type="button"
                  onClick={() => removeSeller(index)}
                  className="inline-flex items-center justify-center rounded-lg border border-rose-500/40 px-3 py-2 text-rose-700 dark:text-rose-100 hover:bg-rose-500/20"
                  aria-label="Remover vendedor"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Notas</span>
        <textarea
          value={partnerForm.observacoes}
          onChange={(event) => setPartnerForm((prev) => ({ ...prev, observacoes: event.target.value }))}
          className="min-h-[120px] w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)] placeholder-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        />
      </label>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={closeModal}
          className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submitPartner}
          disabled={saving}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-700 dark:text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar cadastro'}
        </button>
      </div>
    </div>
  );

  const renderSupplierForm = () => (
    <div className="relative space-y-6">
      <button
        type="button"
        onClick={closeModal}
        className="absolute -right-2 -top-2 rounded-lg p-2 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
        aria-label="Fechar modal"
      >
        <X className="h-5 w-5" />
      </button>

      <div>
        <h2 className="text-3xl font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{editingItem ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
        <p className="mt-1 text-[rgb(var(--crm-muted-rgb)_/_1)]">Cadastre os dados principais, informações de portal e procedimentos de RO.</p>
      </div>

      {renderLogoUploader('Logo do fornecedor')}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Nome</span>
          <input
            type="text"
            value={partnerForm.nome}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, nome: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Status</span>
          <select
            value={partnerForm.status}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, status: event.target.value }))}
            className={inputClassName}
          >
            <option value="ATIVO">Ativo</option>
            <option value="EM_HOMOLOGACAO">Em homologação</option>
            <option value="INATIVO">Inativo</option>
            <option value="BLOQUEADO">Bloqueado</option>
          </select>
        </label>
      </div>

      <fieldset className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.3)] p-4">
        <legend className="px-1 text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Distribuidores que fornecem esta marca</legend>
        <p className="mb-3 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Selecione um ou mais distribuidores cadastrados.</p>
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {registry.distribuidores.length === 0 ? (
            <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhum distribuidor cadastrado. Cadastre na aba Distribuidores para selecionar aqui.</p>
          ) : registry.distribuidores.map((distribuidor) => (
            <label key={distribuidor.id} className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
              <input
                type="checkbox"
                checked={partnerForm.distribuidorIds.includes(distribuidor.id)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setPartnerForm((prev) => ({
                    ...prev,
                    distribuidorIds: checked
                      ? [...new Set([...prev.distribuidorIds, distribuidor.id])]
                      : prev.distribuidorIds.filter((id) => id !== distribuidor.id)
                  }));
                }}
              />
              {distribuidor.nome}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Portal / Partner</span>
          <input
            type="text"
            value={partnerForm.portalPartnerUrl}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, portalPartnerUrl: event.target.value }))}
            className={inputClassName}
            placeholder="https://partner..."
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Login Portal / Partner</span>
          <input
            type="text"
            value={partnerForm.portalPartnerLogin}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, portalPartnerLogin: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Senha Portal / Partner</span>
          <input
            type="text"
            value={partnerForm.portalPartnerSenha}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, portalPartnerSenha: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Portal de Treinamentos</span>
          <input
            type="text"
            value={partnerForm.treinamentoUrl}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, treinamentoUrl: event.target.value }))}
            className={inputClassName}
            placeholder="https://academy..."
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Login Portal de Treinamentos</span>
          <input
            type="text"
            value={partnerForm.treinamentoLogin}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, treinamentoLogin: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Senha Portal de Treinamentos</span>
          <input
            type="text"
            value={partnerForm.treinamentoSenha}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, treinamentoSenha: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Contato Principal</span>
          <input
            type="text"
            value={partnerForm.contatoPrincipal}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, contatoPrincipal: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">E-mail Contato Principal</span>
          <input
            type="email"
            value={partnerForm.emailContatoPrincipal}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, emailContatoPrincipal: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Telefone Contato Principal</span>
          <input
            type="text"
            value={partnerForm.telefoneContatoPrincipal}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, telefoneContatoPrincipal: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Contato Cotações</span>
          <input
            type="text"
            value={partnerForm.contatoCotacoes}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, contatoCotacoes: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">E-mail Contato Cotações</span>
          <input
            type="email"
            value={partnerForm.emailContatoCotacoes}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, emailContatoCotacoes: event.target.value }))}
            className={inputClassName}
          />
        </label>

        <label className="space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Telefone Contato Cotações</span>
          <input
            type="text"
            value={partnerForm.telefoneContatoCotacoes}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, telefoneContatoCotacoes: event.target.value }))}
            className={inputClassName}
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Produtos/Serviços Oferecidos (vírgula)</span>
        <input
          type="text"
          value={partnerForm.produtosServicosText}
          onChange={(event) => setPartnerForm((prev) => ({ ...prev, produtosServicosText: event.target.value }))}
          className={inputClassName}
          placeholder="Servidores, Storages, Workstation..."
        />
      </label>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Documentos e Procedimentos</h3>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Template RO (URL)</span>
          <input
            type="text"
            value={partnerForm.templateRoUrl}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, templateRoUrl: event.target.value }))}
            className={inputClassName}
            placeholder="https://..."
          />
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Procedimento para RO</span>
          <textarea
            value={partnerForm.procedimentoRo}
            onChange={(event) => setPartnerForm((prev) => ({ ...prev, procedimentoRo: event.target.value }))}
            className="min-h-[150px] w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)] placeholder-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
            placeholder="Descreva o passo a passo..."
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Notas</span>
        <textarea
          value={partnerForm.observacoes}
          onChange={(event) => setPartnerForm((prev) => ({ ...prev, observacoes: event.target.value }))}
          className="min-h-[120px] w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)] placeholder-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={submitPartner}
          disabled={saving}
          className="rounded-lg bg-sky-400 px-8 py-3 text-base font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-sky-300 disabled:opacity-60"
        >
          {saving ? 'Salvando...' : 'Salvar Fornecedor'}
        </button>
      </div>
    </div>
  );

  const renderPillList = (items, emptyText, className = 'from-orange-500/45 via-cyan-400/35 to-emerald-400/30') => {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    if (values.length === 0) {
      return <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">{emptyText}</p>;
    }

    return (
      <div className="flex flex-wrap gap-2">
        {values.map((item) => (
          <span
            key={item}
            className={`rounded-full border border-[rgb(var(--crm-ink-rgb)_/_0.1)] bg-gradient-to-r ${className} px-2.5 py-1 text-xs font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] backdrop-blur-md`}
          >
            {item}
          </span>
        ))}
      </div>
    );
  };

  const renderPortalCard = ({ title, url, login, icon: Icon }) => (
    <div className="crm-gradient-glass group min-h-0 rounded-lg p-4 text-[rgb(var(--crm-ink-rgb)_/_1)]">
      <div className="relative z-10">
        <div className="mb-3 flex items-center gap-3 text-lg font-bold text-cyan-700 dark:text-cyan-50">
          <span className="crm-gradient-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[rgb(var(--crm-ink-rgb)_/_1)]">
            <Icon className="h-4 w-4" />
          </span>
          <span>{title}</span>
        </div>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 break-all text-sm font-bold text-cyan-700 dark:text-cyan-100 hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
        >
          {url}
          <ExternalLink className="h-4 w-4 shrink-0" />
        </a>
      ) : (
        <p className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">URL não informada.</p>
      )}
        <p className="mt-3 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
          <span className="font-bold">Usuário:</span> {login || '-'}
        </p>
      </div>
    </div>
  );

  const renderDistributorView = () => {
    const item = viewingDistributor;
    if (!item) return null;

    const statusLabel = item.status === 'ATIVO' ? 'Ativo' : item.status || 'Ativo';
    const contactName = item.accountManager || item.contato || '-';
    const brands = Array.isArray(item.marcas) && item.marcas.length > 0 ? item.marcas : item.categorias;
    const sellers = Array.isArray(item.vendedoresResponsaveis) ? item.vendedoresResponsaveis : [];

    return (
      <div className="relative space-y-4 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
        <button
          type="button"
          onClick={closeDistributorView}
          className="absolute right-0 top-0 rounded-lg p-2 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
          aria-label="Fechar modal"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-sky-700 dark:text-sky-400" />
            <h2 className="text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Visualizar Distribuidor: {item.nome || '-'}</h2>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-3 rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.7)]"
          >
            <FileDown className="h-5 w-5" /> Imprimir PDF
          </button>
        </div>

        <section className="crm-gradient-hero rounded-2xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {renderPartnerLogo(item, 'h-12 w-20')}
              <div className="min-w-0">
                <h3 className="break-words text-2xl font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.nome || '-'}</h3>
                <p className="mt-1 text-lg text-cyan-700 dark:text-cyan-50">Distribuidor</p>
              </div>
            </div>
            <span className="w-fit rounded-full border border-emerald-200/25 dark:border-emerald-800/25 bg-emerald-400/24 px-4 py-1 text-lg font-semibold text-white shadow-[0_18px_44px_-24px_rgba(16,185,129,0.75)] backdrop-blur-md">
              {statusLabel}
            </span>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Card Informações de Contato - Estilo B2G Dashboard */}
          <section className="crm-gradient-section group rounded-2xl p-4">
            {/* Gradiente decorativo de fundo */}
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-400/20 to-teal-400/10 blur-3xl"></div>
            
            <div className="relative">
              <div className="mb-3 flex items-center gap-3">
                {/* Ícone circular com gradiente */}
                <div className="relative flex h-9 w-9 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 opacity-20 blur-md"></div>
                  <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                    <User className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Informações de Contato</h3>
              </div>
              
              <div className="space-y-2">
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">Contato Principal</p>
                  <p className="mt-1 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{contactName}</p>
                </div>
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    <Mail className="h-4 w-4" /> Email
                  </p>
                  <p className="mt-1 break-all text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.email || '-'}</p>
                </div>
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    <Phone className="h-4 w-4" /> Telefone
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.telefone || '-'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Card Produtos/Serviços - Estilo B2G Dashboard */}
          <section className="crm-gradient-section group rounded-2xl p-4">
            {/* Gradiente decorativo de fundo */}
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-teal-400/20 to-emerald-400/10 blur-3xl"></div>
            
            <div className="relative">
              <div className="mb-3 flex items-center gap-3">
                {/* Ícone circular com gradiente */}
                <div className="relative flex h-9 w-9 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 opacity-20 blur-md"></div>
                  <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                    <Package className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Produtos/Serviços</h3>
              </div>
              
              <div className="space-y-2">
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="mb-2 text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">Marcas</p>
                  {renderPillList(brands, 'Sem marcas informadas.')}
                </div>
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="mb-2 text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">Produtos Principais</p>
                  {renderPillList(item.produtosPrincipais, 'Sem produtos principais informados.')}
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="crm-gradient-section rounded-2xl p-4">
          {/* Gradiente decorativo */}
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-400/15 to-teal-400/10 blur-3xl"></div>
          
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-teal-500 opacity-20 blur-md"></div>
                <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                  <Globe2 className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Informações do Portal</h3>
            </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {renderPortalCard({
              title: 'Portal Principal',
              url: item.portalUrl,
              login: item.portalLogin,
              icon: Link2,
              accentClass: "text-cyan-700 dark:text-cyan-50"
            })}
            {renderPortalCard({
              title: 'E-commerce',
              url: item.ecommerceUrl,
              login: item.ecommerceLogin,
              icon: ShoppingCart,
              accentClass: "text-teal-700 dark:text-teal-50"
            })}
          </div>
          </div>
        </section>

        <section className="crm-gradient-section group rounded-2xl p-4">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-teal-400/15 to-emerald-400/10 blur-3xl"></div>
          
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 opacity-20 blur-md"></div>
                <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                  <Users className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Vendedores Responsáveis</h3>
            </div>

          {sellers.length === 0 ? (
            <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhum vendedor adicionado.</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sellers.map((seller, index) => {
                const sellerTag = seller.marca || seller.area || seller.produto || seller.tipo || '';
                return (
                  <div key={`${seller.nome || 'seller'}-${index}`} className="crm-gradient-field rounded-xl border-l-4 border-cyan-300/45 p-4">
                    {sellerTag && (
                      <span className="mb-2 inline-flex rounded-full border border-cyan-200/20 dark:border-cyan-800/20 bg-cyan-300/18 px-3 py-2 text-sm font-semibold text-cyan-700 dark:text-cyan-50 backdrop-blur-md">
                        {sellerTag}
                      </span>
                    )}
                    <h4 className="text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{seller.nome || '-'}</h4>
                    <p className="mt-2 flex items-center gap-3 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <Phone className="h-5 w-5 text-emerald-500" /> {seller.telefone || '-'}
                    </p>
                    <p className="mt-2 flex items-center gap-3 break-all text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <Mail className="h-5 w-5 shrink-0 text-violet-500" /> {seller.email || '-'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </section>

        <section className="crm-gradient-section rounded-2xl p-4">
          <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Observações</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">{item.observacoes || 'Sem observações.'}</p>
        </section>
      </div>
    );
  };

  const renderSupplierView = () => {
    const item = viewingSupplier;
    if (!item) return null;

    const statusLabel = item.status === 'ATIVO' ? 'Ativo' : item.status || 'Ativo';
    const products = Array.isArray(item.produtosServicos) && item.produtosServicos.length > 0
      ? item.produtosServicos
      : item.categorias;

    return (
      <div className="relative space-y-4 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]">
        <button
          type="button"
          onClick={closeSupplierView}
          className="absolute right-0 top-0 rounded-lg p-2 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.05)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
          aria-label="Fechar modal"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="flex flex-col gap-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-sky-700 dark:text-sky-400" />
            <h2 className="text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Visualizar Fornecedor: {item.nome || '-'}</h2>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-3 rounded-lg border border-[var(--crm-border)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.7)]"
          >
            <FileDown className="h-5 w-5" /> Imprimir PDF
          </button>
        </div>

        <section className="crm-gradient-hero rounded-2xl px-4 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {renderPartnerLogo(item, 'h-12 w-20')}
              <div className="min-w-0">
                <h3 className="break-words text-2xl font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.nome || '-'}</h3>
                <p className="mt-1 text-lg text-cyan-700 dark:text-cyan-100">Fornecedor</p>
              </div>
            </div>
            <span className="w-fit rounded-full border border-emerald-200/25 dark:border-emerald-800/25 bg-emerald-400/24 px-4 py-1 text-lg font-semibold text-white shadow-[0_18px_44px_-24px_rgba(16,185,129,0.75)] backdrop-blur-md">
              {statusLabel}
            </span>
          </div>
        </section>

        <section className="crm-gradient-section rounded-2xl p-4">
          <h3 className="mb-2 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Distribuidores que fornecem esta marca</h3>
          <div className="flex flex-wrap gap-2">
            {(item.distribuidorIds || []).some((id) => distMap.has(id)) ? (
              (item.distribuidorIds || []).filter((id) => distMap.has(id)).map((id) => (
                <span key={id} className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-sm text-cyan-700 dark:text-cyan-100">{distMap.get(id)}</span>
              ))
            ) : <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhum distribuidor vinculado.</p>}
          </div>
        </section>

        <section className="crm-gradient-section rounded-2xl p-4">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-500/15 to-teal-500/10 blur-3xl"></div>
          
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 opacity-20 blur-md"></div>
                <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                  <Globe2 className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Informações de Portal</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {renderPortalCard({
                title: 'Portal / Partner',
                url: item.portalPartnerUrl,
                login: item.portalPartnerLogin,
                icon: Link2,
                accentClass: "text-blue-800 dark:text-blue-300"
              })}
              {renderPortalCard({
                title: 'Portal de Treinamentos',
                url: item.treinamentoUrl,
                login: item.treinamentoLogin,
                icon: Globe2,
                accentClass: "text-cyan-800 dark:text-cyan-300"
              })}
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Card Contato Principal - Estilo B2G Dashboard */}
          <section className="crm-gradient-section group rounded-2xl p-4">
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-500/20 to-teal-500/10 blur-3xl"></div>
            
            <div className="relative">
              <div className="mb-3 flex items-center gap-3">
                <div className="relative flex h-9 w-9 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 opacity-20 blur-md"></div>
                  <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                    <User className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Contato Principal</h3>
              </div>
              
              <div className="space-y-2">
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">Nome</p>
                  <p className="mt-1 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.contatoPrincipal || item.contato || '-'}</p>
                </div>
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    <Mail className="h-4 w-4" /> Email
                  </p>
                  <p className="mt-1 break-all text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.emailContatoPrincipal || item.email || '-'}</p>
                </div>
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    <Phone className="h-4 w-4" /> Telefone
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.telefoneContatoPrincipal || item.telefone || '-'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Card Contato Cotações - Estilo B2G Dashboard */}
          <section className="crm-gradient-section group rounded-2xl p-4">
            <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/10 blur-3xl"></div>
            
            <div className="relative">
              <div className="mb-3 flex items-center gap-3">
                <div className="relative flex h-9 w-9 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 opacity-20 blur-md"></div>
                  <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                    <Users className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                  </div>
                </div>
                <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Contato Cotações</h3>
              </div>
              
              <div className="space-y-2">
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">Nome</p>
                  <p className="mt-1 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.contatoCotacoes || '-'}</p>
                </div>
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    <Mail className="h-4 w-4" /> Email
                  </p>
                  <p className="mt-1 break-all text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.emailContatoCotacoes || '-'}</p>
                </div>
                <div className="crm-gradient-field rounded-lg p-3">
                  <p className="flex items-center gap-2 text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    <Phone className="h-4 w-4" /> Telefone
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.telefoneContatoCotacoes || '-'}</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="crm-gradient-section rounded-2xl p-4">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-cyan-500/15 to-teal-500/10 blur-3xl"></div>
          
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-500 to-teal-600 opacity-20 blur-md"></div>
                <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                  <Package className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Produtos/Serviços Oferecidos</h3>
            </div>
            <div className="crm-gradient-field rounded-lg p-3">
              {renderPillList(products, 'Sem produtos/serviços informados.', 'from-orange-500/45 via-cyan-400/35 to-emerald-400/30')}
            </div>
          </div>
        </section>

        <section className="crm-gradient-section rounded-2xl p-4">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gradient-to-br from-teal-500/15 to-emerald-500/10 blur-3xl"></div>
          
          <div className="relative">
            <div className="mb-3 flex items-center gap-3">
              <div className="relative flex h-9 w-9 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 opacity-20 blur-md"></div>
                <div className="crm-gradient-icon relative flex h-8 w-8 items-center justify-center rounded-full">
                  <ClipboardList className="h-4 w-4 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                </div>
              </div>
              <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Documentos e Procedimentos</h3>
            </div>

          <div className="space-y-3">
            <div>
              <p className="mb-2 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Template RO</p>
              {item.templateRoUrl ? (
                <a
                  href={item.templateRoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 break-all text-sm font-bold text-sky-700 dark:text-sky-300 hover:text-sky-700 dark:hover:text-sky-200"
                >
                  {item.templateRoUrl}
                  <ExternalLink className="h-4 w-4 shrink-0" />
                </a>
              ) : (
                <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Template RO não informado.</p>
              )}
            </div>

            <div>
              <p className="mb-2 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Procedimento para RO</p>
              <p className="whitespace-pre-wrap text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.procedimentoRo || 'Procedimento não informado.'}</p>
            </div>
          </div>
          </div>
        </section>

        <section className="crm-gradient-section rounded-2xl p-4">
          <h3 className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Observações</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">{item.observacoes || 'Sem observações.'}</p>
        </section>
      </div>
    );
  };

  const renderPartnerCards = (type) => {
    if (activeRows.length === 0) {
      return <div className="py-12 text-center text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhum cadastro encontrado.</div>;
    }

    return (
      <div className="space-y-3">
        {activeRows.map((item) => (
          <div key={item.id} className="crm-gradient-glass rounded-xl p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 flex-1 gap-3">
                {renderPartnerLogo(item)}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.nome}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClassForStatus(item.status)}`}>
                      {item.status || 'ATIVO'}
                    </span>
                  </div>

                  <p className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    {item.razaoSocial || 'Razão social não informada'}
                    {item.cnpj ? ` • CNPJ ${item.cnpj}` : ''}
                  </p>

                  <p className="mt-1 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    Contato: {item.contato || '-'} • {item.email || '-'} • {item.telefone || '-'}
                  </p>

                  <p className="mt-1 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                    {item.cidade || '-'} / {item.estado || '-'}
                    {item.site ? ` • ${item.site}` : ''}
                  </p>

                  {Array.isArray(item.categorias) && item.categorias.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.categorias.map((categoria) => (
                        <span
                          key={`${item.id}-${categoria}`}
                          className="rounded-full border border-cyan-300/25 bg-cyan-300/12 px-2 py-0.5 text-[11px] text-cyan-700 dark:text-cyan-100"
                        >
                          {categoria}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {type === TAB_KEYS.DISTRIBUIDORES && (
                  <button
                    type="button"
                    onClick={() => setViewingDistributor(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/50 px-3 py-2 text-xs text-sky-700 dark:text-sky-100 hover:bg-sky-500/20"
                  >
                    <Eye className="h-3.5 w-3.5" /> Visualizar
                  </button>
                )}
                {type === TAB_KEYS.FORNECEDORES && (
                  <button
                    type="button"
                    onClick={() => setViewingSupplier(item)}
                    className="inline-flex items-center gap-1 rounded-lg border border-sky-500/50 px-3 py-2 text-xs text-sky-700 dark:text-sky-100 hover:bg-sky-500/20"
                  >
                    <Eye className="h-3.5 w-3.5" /> Visualizar
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => openEditModal(type, item)}
                  className="rounded-lg border border-[var(--crm-border)] px-3 py-2 text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)]"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => deleteItem(type, item)}
                  className="inline-flex items-center gap-1 rounded-lg border border-rose-500/50 px-3 py-2 text-xs text-rose-700 dark:text-rose-100 hover:bg-rose-500/20"
                  disabled={saving}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderOpportunityCards = () => {
    if (activeRows.length === 0) {
      return (
        <div className="py-16 text-center text-[rgb(var(--crm-muted-rgb)_/_1)]">
          <Tag className="mx-auto h-12 w-12 text-[rgb(var(--crm-muted-rgb)_/_1)] mb-3" />
          <p className="text-base font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Nenhum registro de oportunidade encontrado.</p>
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">Tente ajustar a busca ou os filtros de Fabricante e Status acima.</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {activeRows.map((item) => {
          const linkedDistributors = (item.distribuidorIds || []).map((id) => distMap.get(id)).filter(Boolean);
          const linkedSuppliers = (item.fornecedorIds || []).map((id) => fornMap.get(id)).filter(Boolean);
          const validity = getValidityInfo(item.dataValidade);
          const oppFabricante = getOpportunityFabricante(item, fornMap);

          return (
            <div key={item.id} className="crm-gradient-glass rounded-xl p-4 border border-[var(--crm-border)] transition-all duration-200 hover:border-[var(--crm-border)] shadow-lg">
              {/* DESTAQUE PRINCIPAL DO FABRICANTE / FORNECEDOR / RO */}
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--crm-border)] pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  {/* BADGE DESTAQUE DO FABRICANTE */}
                  <div
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-black tracking-wider uppercase ${getFabricanteBadgeStyle(oppFabricante)}`}
                  >
                    <Tag className="h-3.5 w-3.5" />
                    <span>{oppFabricante ? `RO ${oppFabricante}` : 'RO (FABRICANTE NÃO DEFINIDO)'}</span>
                  </div>

                  {item.numeroOportunidade && (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] px-3 py-1 text-xs font-mono text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] font-sans text-[11px] font-semibold">Nº RO:</span>
                      <span className="font-bold text-sky-700 dark:text-sky-400">{item.numeroOportunidade}</span>
                    </div>
                  )}

                  {item.produto && (
                    <div className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.6)] px-2.5 py-1 text-xs text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <Package className="h-3.5 w-3.5 text-cyan-700 dark:text-cyan-400" />
                      <span className="font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.produto}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase ${badgeClassForStatus(normalizeRegistryStatus(item.status))}`}>
                    {getRegistryStatusLabel(item.status || 'ABERTA')}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badgeClassForPriority(item.prioridade)}`}>
                    {priorityLabel(item.prioridade)}
                  </span>
                </div>
              </div>

              <div className="w-full">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h4 className="min-w-0 break-words text-base font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] tracking-tight">{item.titulo || 'Sem título'}</h4>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => handleViewOpportunityPdf(item)}
                        title="Visualizar registro em PDF"
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/50 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-100 hover:bg-emerald-500/25 transition-colors"
                      >
                        <FileText className="h-3.5 w-3.5" /> PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(TAB_KEYS.OPORTUNIDADES, item)}
                        className="rounded-lg border border-[var(--crm-border)] px-3 py-2 text-xs font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)] transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(TAB_KEYS.OPORTUNIDADES, item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-500/50 px-3 py-2 text-xs font-medium text-rose-700 dark:text-rose-100 hover:bg-rose-500/20 transition-colors"
                        disabled={saving}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 text-xs">
                    <div className={`rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_0.5)] border border-[var(--crm-border)] p-2.5 ${!item.gerenteConta ? 'sm:col-span-2' : ''}`}>
                      <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] block text-[11px] font-medium">Cliente / Solicitante</span>
                      <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm block break-words">{item.cliente || '-'}</span>
                      <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] block mt-0.5">
                        Origem: {item.origem || 'B2B'} • Modalidade: {item.modalidade || 'VENDA'}
                      </span>
                    </div>

                    {item.gerenteConta && (
                      <div className="rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_0.5)] border border-[var(--crm-border)] p-2.5">
                        <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] block text-[11px] font-medium">Gerente de Contas</span>
                        <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm block break-words">{item.gerenteConta}</span>
                      </div>
                    )}

                    <div className="rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_0.5)] border border-[var(--crm-border)] p-2.5">
                      <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] block text-[11px] font-medium">Valor Estimado / Prazo</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm block">{toCurrency(item.valorEstimado)}</span>
                      <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] block mt-0.5">
                        Prazo: {formatOpportunityTerm(item.prazo)}
                      </span>
                    </div>

                    <div className="rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_0.5)] border border-[var(--crm-border)] p-2.5">
                      <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] block text-[11px] font-medium">Validade do Registro (RO)</span>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${validityBadgeClass(validity.tone)}`}>
                          {validity.label}
                        </span>
                        <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] font-mono text-xs">{toDateBr(item.dataValidade)}</span>
                      </div>
                      {item.dataAbertura && (
                        <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] block mt-0.5">
                          Abertura: {toDateBr(item.dataAbertura)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-3 text-xs">
                    {linkedDistributors.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        <Building2 className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                        <span>Distribuidores:</span>
                        <div className="flex flex-wrap gap-1">
                          {linkedDistributors.map((d) => (
                            <span key={d} className="rounded bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] px-1.5 py-0.5 text-[rgb(var(--crm-ink-rgb)_/_1)] font-medium">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {linkedSuppliers.length > 0 && (
                      <div className="flex items-center gap-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        <Package className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                        <span>Fornecedores:</span>
                        <div className="flex flex-wrap gap-1">
                          {linkedSuppliers.map((s) => (
                            <span key={s} className="rounded bg-sky-50/60 dark:bg-sky-950/60 border border-sky-200/50 dark:border-sky-800/50 px-1.5 py-0.5 text-sky-700 dark:text-sky-300 font-medium">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {item.observacoes && (
                    <div className="mt-2.5 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.5)] p-2.5 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                      <strong className="text-[rgb(var(--crm-ink-rgb)_/_1)]">Obs:</strong> {item.observacoes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const activeTabMeta = TABS.find((entry) => entry.key === currentTab) || TABS[0];
  const pageMeta = TAB_PAGE_META[currentTab] || TAB_PAGE_META[TAB_KEYS.DISTRIBUIDORES];
  const showTabSelector = !forcedTabKey;
  const ActiveTabIcon = activeTabMeta.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageMeta.title}
        subtitle={pageMeta.subtitle}
        icon={ActiveTabIcon}
        gradient="blue"
        breadcrumbs={['Home', 'Pré-Vendas', pageMeta.breadcrumb]}
        actions={[
          ...(fromPreVendasDashboard ? [{
            label: 'Voltar ao Dashboard',
            icon: ArrowLeft,
            onClick: returnToPreVendasDashboard,
            variant: 'secondary'
          }] : []),
          {
            label: 'Atualizar',
            icon: RefreshCcw,
            onClick: loadData,
            variant: 'secondary'
          },
          {
            label: 'Abrir Solicitações',
            icon: ClipboardList,
            onClick: () => navigate('/solicitacoes'),
            variant: 'primary'
          }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((item) => (
          <AnimatedStats key={item.title} {...item} />
        ))}
      </div>

      <div className="crm-card rounded-xl p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {showTabSelector ? (
              TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = tab.key === currentTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={[
                      'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                      isActive
                        ? "border-sky-400/50 bg-sky-500/20 text-sky-700 dark:text-sky-100"
                        : "border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.5)]"
                    ].join(' ')}
                  >
                    <Icon className="h-4 w-4" /> {tab.label}
                  </button>
                );
              })
            ) : (
              <div className="inline-flex items-center gap-2 rounded-lg border border-sky-400/50 bg-sky-500/20 px-3 py-2 text-sm text-sky-700 dark:text-sky-100">
                <ActiveTabIcon className="h-4 w-4" /> {activeTabMeta.label}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => openCreateModal(currentTab)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-100 hover:bg-cyan-500/30"
          >
            <Plus className="h-4 w-4" /> {pageMeta.createLabel}
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder={
                  currentTab === TAB_KEYS.OPORTUNIDADES
                    ? 'Buscar por título, cliente, fabricante (ex: DELL, LENOVO), RO, produto ou status...'
                    : 'Buscar por nome, CNPJ, contato, cidade, status ou categoria...'
                }
                className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] py-2.5 pl-10 pr-3 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] placeholder-[rgb(var(--crm-muted-rgb)_/_1)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              />
            </div>

            {currentTab === TAB_KEYS.OPORTUNIDADES && (
              <div className="flex flex-wrap items-center gap-2">
                {/* SELECT FILTRO POR FABRICANTE */}
                <div className="flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-amber-700 dark:text-amber-400 shrink-0" />
                  <select
                    value={selectedFabricanteFilter}
                    onChange={(e) => setSelectedFabricanteFilter(e.target.value)}
                    className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] px-3 py-2 text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  >
                    <option value="ALL">Todos os Fabricantes (RO)</option>
                    {availableFabricantes.map((f) => (
                      <option key={f.name} value={f.name}>
                        RO {f.name} {f.count > 0 ? `(${f.count})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SELECT STATUS */}
                <select
                  aria-label="Filtrar por status do registro"
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] px-3 py-2 text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                >
                  <option value="ALL">Todos os Status</option>
                  {REGISTRY_OPPORTUNITY_STATUSES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>

                {/* SELECT ORIGEM B2B / B2G */}
                <select
                  value={selectedOrigemFilter}
                  onChange={(e) => setSelectedOrigemFilter(e.target.value)}
                  className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] px-3 py-2 text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  <option value="ALL">Todas as Origens</option>
                  <option value="B2B">B2B Privado</option>
                  <option value="B2G">B2G Governo</option>
                  <option value="COMERCIAL">Comercial</option>
                  <option value="PRE_VENDAS">Pré-Vendas</option>
                </select>

                {(selectedFabricanteFilter !== 'ALL' || selectedStatusFilter !== 'ALL' || selectedOrigemFilter !== 'ALL' || searchTerm) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFabricanteFilter('ALL');
                      setSelectedStatusFilter('ALL');
                      setSelectedOrigemFilter('ALL');
                      setSearchTerm('');
                    }}
                    className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-700 dark:text-rose-200 hover:bg-rose-500/20 transition-colors"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>

          {/* CHIPS RÁPIDOS DE FILTRO POR FABRICANTE (DELL, LENOVO, HP, CISCO, ETC) */}
          {currentTab === TAB_KEYS.OPORTUNIDADES && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--crm-border)]">
              <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] flex items-center gap-1 mr-1">
                <Filter className="h-3 w-3 text-sky-700 dark:text-sky-400" /> Filtrar por Fabricante:
              </span>
              <button
                type="button"
                onClick={() => setSelectedFabricanteFilter('ALL')}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                  selectedFabricanteFilter === 'ALL'
                    ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/40 font-bold'
                    : "bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                }`}
              >
                Todos ({(registry.oportunidades || []).length})
              </button>
              {availableFabricantes.slice(0, 10).map((f) => {
                const isSelected = selectedFabricanteFilter === f.name;
                return (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => setSelectedFabricanteFilter(isSelected ? 'ALL' : f.name)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? `${getFabricanteBadgeStyle(f.name)} ring-2 ring-white/60 font-black scale-105`
                        : "bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:border-[var(--crm-border)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                    }`}
                  >
                    <span>RO {f.name}</span>
                    {f.count > 0 && (
                      <span className="rounded-full bg-[rgb(var(--crm-surface-rgb)_/_0.9)] px-1.5 py-0.2 text-[10px] text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        {f.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* CHIPS RÁPIDOS DE FILTRO POR ORIGEM (B2B / B2G) */}
          {currentTab === TAB_KEYS.OPORTUNIDADES && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[var(--crm-border)]">
              <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] flex items-center gap-1 mr-1">
                <Filter className="h-3 w-3 text-emerald-700 dark:text-emerald-400" /> Filtrar por Origem:
              </span>
              {[
                { value: 'ALL', label: 'Todas', count: (registry.oportunidades || []).length },
                { value: 'B2B', label: 'B2B Privado', color: 'orange' },
                { value: 'B2G', label: 'B2G Governo', color: 'green' },
                { value: 'COMERCIAL', label: 'Comercial', color: 'sky' },
                { value: 'PRE_VENDAS', label: 'Pré-Vendas', color: 'purple' }
              ].map((opt) => {
                const isSelected = selectedOrigemFilter === opt.value;
                const count = opt.count !== undefined
                  ? opt.count
                  : (registry.oportunidades || []).filter((item) => String(item.origem || 'B2B').toUpperCase() === opt.value).length;
                const colorMap = {
                  orange: isSelected ? 'bg-orange-500 text-white shadow-orange-500/40' : "bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:border-orange-500/50 hover:text-orange-700 dark:hover:text-orange-300 dark:hover:text-orange-700 dark:hover:text-orange-200",
                  green: isSelected ? 'bg-emerald-500 text-white shadow-emerald-500/40' : "bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:border-emerald-500/50 hover:text-emerald-700 dark:hover:text-emerald-300 dark:hover:text-emerald-700 dark:hover:text-emerald-200",
                  sky: isSelected ? 'bg-sky-500 text-white shadow-sky-500/40' : "bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:border-sky-500/50 hover:text-sky-700 dark:hover:text-sky-300 dark:hover:text-sky-700 dark:hover:text-sky-200",
                  purple: isSelected ? 'bg-purple-500 text-white shadow-purple-500/40' : "bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:border-purple-500/50 hover:text-purple-700 dark:hover:text-purple-300 dark:hover:text-purple-700 dark:hover:text-purple-200"
                };
                const cls = opt.value === 'ALL'
                  ? (isSelected ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/40 font-bold' : "bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]")
                  : colorMap[opt.color];
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSelectedOrigemFilter(isSelected && opt.value !== 'ALL' ? 'ALL' : opt.value)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all flex items-center gap-1.5 ${cls}`}
                  >
                    <span>{opt.label}</span>
                    <span className="rounded-full bg-[rgb(var(--crm-surface-rgb)_/_0.9)] px-1.5 py-0.5 text-[10px] text-[rgb(var(--crm-ink-rgb)_/_1)]">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="crm-card rounded-xl p-4">
        {loading
          ? (
            <div className="py-12 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
              <p className="mt-3 text-sm text-[rgb(var(--crm-muted-rgb)_/_1)]">Carregando dados...</p>
            </div>
          )
          : currentTab === TAB_KEYS.OPORTUNIDADES
            ? renderOpportunityCards()
            : renderPartnerCards(currentTab)}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={[TAB_KEYS.DISTRIBUIDORES, TAB_KEYS.FORNECEDORES].includes(modalType) ? '' : `${editingItem ? 'Editar' : 'Novo'} ${
          'Registro de Oportunidade'
        }`}
        showCloseButton={![TAB_KEYS.DISTRIBUIDORES, TAB_KEYS.FORNECEDORES].includes(modalType)}
        size="large"
        panelClassName={[TAB_KEYS.DISTRIBUIDORES, TAB_KEYS.FORNECEDORES].includes(modalType) ? 'max-w-[calc(100vw-2rem)] xl:max-w-7xl' : ''}
        contentClassName={[TAB_KEYS.DISTRIBUIDORES, TAB_KEYS.FORNECEDORES].includes(modalType) ? 'p-6 sm:p-8' : ''}
      >
        {modalType === TAB_KEYS.DISTRIBUIDORES ? renderDistributorForm() : modalType === TAB_KEYS.FORNECEDORES ? renderSupplierForm() : modalType !== TAB_KEYS.OPORTUNIDADES ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Nome *</span>
                <input
                  type="text"
                  value={partnerForm.nome}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, nome: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="Nome do parceiro"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Razão social</span>
                <input
                  type="text"
                  value={partnerForm.razaoSocial}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, razaoSocial: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="Razão social"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">CNPJ</span>
                <input
                  type="text"
                  value={partnerForm.cnpj}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, cnpj: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="00.000.000/0000-00"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Status</span>
                <select
                  value={partnerForm.status}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="EM_HOMOLOGACAO">Em homologação</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="BLOQUEADO">Bloqueado</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Contato principal</span>
                <input
                  type="text"
                  value={partnerForm.contato}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, contato: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="Nome do contato"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">E-mail</span>
                <input
                  type="email"
                  value={partnerForm.email}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, email: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="contato@empresa.com"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Telefone</span>
                <input
                  type="text"
                  value={partnerForm.telefone}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, telefone: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="(11) 99999-9999"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Site</span>
                <input
                  type="text"
                  value={partnerForm.site}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, site: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="https://..."
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Cidade</span>
                <input
                  type="text"
                  value={partnerForm.cidade}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, cidade: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="Cidade"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Estado</span>
                <input
                  type="text"
                  value={partnerForm.estado}
                  onChange={(event) => setPartnerForm((prev) => ({ ...prev, estado: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="UF"
                />
              </label>
            </div>

            <label className="block space-y-1">
              <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Categorias (separe por vírgula)</span>
              <input
                type="text"
                value={partnerForm.categoriasText}
                onChange={(event) => setPartnerForm((prev) => ({ ...prev, categoriasText: event.target.value }))}
                className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                placeholder="Hardware, Software, Serviços"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Observações</span>
              <textarea
                value={partnerForm.observacoes}
                onChange={(event) => setPartnerForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                className="min-h-[110px] w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                placeholder="Dados comerciais, condições e observações"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitPartner}
                disabled={saving}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-700 dark:text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar cadastro'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-3 md:col-span-2">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Oportunidade do Pipeline (opcional)</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="space-y-1">
                    <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Tipo de oportunidade</span>
                    <select value={pipelineType} onChange={(event) => handlePipelineTypeChange(event.target.value)} className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <option value="B2B">B2B · Empresas</option>
                      <option value="B2G">B2G · Governo</option>
                    </select>
                  </label>
                  <label className="space-y-1 md:col-span-2">
                    <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Buscar oportunidade</span>
                    <div className="relative">
                      <Search aria-hidden="true" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--crm-muted-rgb)_/_1)] pointer-events-none" />
                      <input type="search" value={pipelineSearch} onChange={(event) => setPipelineSearch(event.target.value)} placeholder="Digite o número, título ou cliente" className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] pl-10 pr-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                    </div>
                  </label>
                </div>
                <label className="block space-y-1">
                  <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Selecionar oportunidade {pipelineType}</span>
                <select
                  value={opportunityForm.oportunidadeId}
                  onChange={(event) => handlePickPipelineOpportunity(event.target.value)}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <option value="">{matchingPipelineOpportunities.length ? 'Selecionar oportunidade existente' : 'Nenhuma oportunidade encontrada'}</option>
                  {opportunityForm.oportunidadeId && !matchingPipelineOpportunities.some((entry) => entry.id === opportunityForm.oportunidadeId) && <option value={opportunityForm.oportunidadeId}>{opportunityForm.titulo} • {opportunityForm.cliente || 'Sem cliente'}</option>}
                  {matchingPipelineOpportunities.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.number ? `${entry.number} • ` : ''}{entry.title} • {getPipelineClient(entry) || 'Sem cliente'}
                    </option>
                  ))}
                </select>
                </label>
                <p role="status" className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">{matchingPipelineOpportunities.length} oportunidade(s) encontrada(s). Ao selecionar, o cliente será preenchido automaticamente.</p>
              </div>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Título *</span>
                <input
                  type="text"
                  value={opportunityForm.titulo}
                  onChange={(event) => setOpportunityForm((prev) => ({ ...prev, titulo: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="Título da oportunidade"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Cliente</span>
                <input
                  type="text"
                  value={opportunityForm.cliente}
                  onChange={(event) => setOpportunityForm((prev) => ({ ...prev, cliente: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  placeholder="Nome do cliente"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Gerente de Contas</span>
                <select
                  value={opportunityForm.gerenteConta}
                  onChange={(event) => setOpportunityForm((prev) => ({ ...prev, gerenteConta: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <option value="">Selecionar gerente de contas</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Origem</span>
                <select
                  value={opportunityForm.origem}
                  onChange={(event) => ['B2B', 'B2G'].includes(event.target.value) ? handlePipelineTypeChange(event.target.value) : setOpportunityForm((prev) => ({ ...prev, origem: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <option value="B2B">B2B</option>
                  <option value="B2G">B2G</option>
                  <option value="COMERCIAL">Comercial</option>
                  <option value="PRE_VENDAS">Pré-vendas</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Modalidade</span>
                <select
                  value={opportunityForm.modalidade}
                  onChange={(event) => setOpportunityForm((prev) => ({ ...prev, modalidade: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <option value="VENDA">Venda</option>
                  <option value="LOCACAO">Locação</option>
                  <option value="SERVICOS">Serviços</option>
                  <option value="PROJETO">Projeto</option>
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Valor estimado (R$)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={opportunityForm.valorEstimado}
                  onChange={(event) => setOpportunityForm((prev) => ({ ...prev, valorEstimado: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Prazo</span>
                <select
                  value={opportunityForm.prazo}
                  onChange={(event) => setOpportunityForm((prev) => ({ ...prev, prazo: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <option value="">Selecionar prazo</option>
                  {OPPORTUNITY_TERM_OPTIONS.map((months) => (
                    <option key={months} value={months}>{months} meses</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Status</span>
                <select
                  aria-label="Status do registro"
                  value={opportunityForm.status}
                  onChange={(event) => setOpportunityForm((prev) => ({ ...prev, status: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  {REGISTRY_OPPORTUNITY_STATUSES.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              <label className="space-y-1">
                <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Prioridade</span>
                <select
                  value={opportunityForm.prioridade}
                  onChange={(event) => setOpportunityForm((prev) => ({ ...prev, prioridade: event.target.value }))}
                  className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <option value="LOW">Baixa</option>
                  <option value="MEDIUM">Média</option>
                  <option value="HIGH">Alta</option>
                  <option value="URGENT">Urgente</option>
                </select>
              </label>
            </div>

            <div className="mt-2 rounded-lg border border-sky-600/30 bg-sky-50/20 dark:bg-sky-900/20 p-3">
              <p className="mb-3 text-sm font-semibold text-sky-700 dark:text-sky-200 flex items-center gap-1.5">
                <Tag className="w-4 h-4 text-amber-700 dark:text-amber-400" /> Registro no Fornecedor (RO)
              </p>

              {/* CAMPO FABRICANTE / FORNECEDOR EM DESTAQUE */}
              <div className="mb-3.5 rounded-lg border border-amber-500/40 bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] p-3 shadow-inner">
                <label className="space-y-1 block">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5" /> Fabricante / Fornecedor (Ex.: DELL, LENOVO, FORTINET, CISCO, HP)
                    </span>
                    {opportunityForm.fabricante && (
                      <span className="text-xs text-amber-700 dark:text-amber-400 font-extrabold uppercase tracking-wide">
                        RO {opportunityForm.fabricante}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={opportunityForm.fabricante}
                    onChange={(event) => setOpportunityForm((prev) => ({ ...prev, fabricante: event.target.value.toUpperCase() }))}
                    className="w-full rounded-lg border border-amber-500/60 bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] px-3 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] placeholder-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 font-bold uppercase tracking-wide"
                    placeholder="Ex.: DELL, LENOVO, CISCO, HP, FORTINET"
                  />
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">Marcas rápidas:</span>
                  {[...new Set([
                    'DELL', 'LENOVO', 'HP', 'CISCO', 'FORTINET', 'ARUBA', 'HUAWEI', 'MICROSOFT', 'VEEAM',
                    ...availableFabricantes.map(({ name }) => name)
                  ])].map((brand) => (
                    <button
                      key={brand}
                      type="button"
                      onClick={() => setOpportunityForm((prev) => ({ ...prev, fabricante: brand }))}
                      className={`rounded px-2.5 py-0.5 text-xs font-bold transition-all ${
                        opportunityForm.fabricante === brand
                          ? "bg-amber-500 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-sm scale-105"
                          : "bg-[rgb(var(--crm-surface-rgb)_/_0.9)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)]"
                      }`}
                    >
                      {brand}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Número da oportunidade / RO</span>
                  <input
                    type="text"
                    value={opportunityForm.numeroOportunidade}
                    onChange={(event) => setOpportunityForm((prev) => ({ ...prev, numeroOportunidade: event.target.value }))}
                    className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                    placeholder="Ex.: DELL-2026-001234"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Produto</span>
                  <input
                    type="text"
                    value={opportunityForm.produto}
                    onChange={(event) => setOpportunityForm((prev) => ({ ...prev, produto: event.target.value }))}
                    className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                    placeholder="Ex.: PowerEdge R750"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Data de abertura</span>
                  <input
                    type="date"
                    value={opportunityForm.dataAbertura}
                    onChange={(event) => setOpportunityForm((prev) => ({ ...prev, dataAbertura: event.target.value }))}
                    className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Data de validade</span>
                  <input
                    type="date"
                    value={opportunityForm.dataValidade}
                    onChange={(event) => setOpportunityForm((prev) => ({ ...prev, dataValidade: event.target.value }))}
                    className="w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.3)] p-3">
                <p className="mb-2 text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Distribuidores vinculados</p>
                <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {registry.distribuidores.length === 0 ? (
                    <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhum distribuidor cadastrado.</p>
                  ) : (
                    registry.distribuidores.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        <input
                          type="checkbox"
                          checked={opportunityForm.distribuidorIds.includes(item.id)}
                          onChange={(event) => {
                            setOpportunityForm((prev) => {
                              const current = new Set(prev.distribuidorIds);
                              if (event.target.checked) current.add(item.id);
                              else current.delete(item.id);
                              return { ...prev, distribuidorIds: Array.from(current) };
                            });
                          }}
                        />
                        {item.nome}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.3)] p-3">
                <p className="mb-2 text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Fornecedores vinculados</p>
                <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
                  {registry.fornecedores.length === 0 ? (
                    <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Nenhum fornecedor cadastrado.</p>
                  ) : (
                    registry.fornecedores.map((item) => (
                      <label key={item.id} className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        <input
                          type="checkbox"
                          checked={opportunityForm.fornecedorIds.includes(item.id)}
                          onChange={(event) => {
                            setOpportunityForm((prev) => {
                              const current = new Set(prev.fornecedorIds);
                              let nextFabricante = prev.fabricante;
                              if (event.target.checked) {
                                current.add(item.id);
                                if (!nextFabricante) {
                                  nextFabricante = item.nome ? item.nome.toUpperCase() : '';
                                }
                              } else {
                                current.delete(item.id);
                              }
                              return { ...prev, fornecedorIds: Array.from(current), fabricante: nextFabricante };
                            });
                          }}
                        />
                        {item.nome}
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">Observações</span>
              <textarea
                value={opportunityForm.observacoes}
                onChange={(event) => setOpportunityForm((prev) => ({ ...prev, observacoes: event.target.value }))}
                className="min-h-[110px] w-full rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                placeholder="Detalhes de escopo, pendências e próximos passos"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-[var(--crm-border)] px-4 py-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.4)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={submitOpportunityRegistry}
                disabled={saving}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-4 py-2 text-sm text-cyan-700 dark:text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-60"
              >
                {saving ? 'Salvando...' : 'Salvar registro'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={!!viewingDistributor}
        onClose={closeDistributorView}
        title=""
        showCloseButton={false}
        size="large"
        panelClassName="max-w-[calc(100vw-1rem)] xl:max-w-7xl bg-[rgb(var(--crm-surface-2-rgb)_/_1)]"
        contentClassName="p-4 sm:p-6"
      >
        {renderDistributorView()}
      </Modal>

      <Modal
        isOpen={!!viewingSupplier}
        onClose={closeSupplierView}
        title=""
        showCloseButton={false}
        size="large"
        panelClassName="max-w-[calc(100vw-1rem)] xl:max-w-7xl bg-[rgb(var(--crm-surface-2-rgb)_/_1)]"
        contentClassName="p-4 sm:p-6"
      >
        {renderSupplierView()}
      </Modal>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="crm-card rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
            <CalendarDays className="h-4 w-4" /> Última atualização
          </div>
          <p className="mt-2 text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
            {loading ? '-' : `${toDateBr(new Date().toISOString())}`}
          </p>
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Dados centralizados para equipe de Pré-Vendas.</p>
        </div>

        <div className="crm-card rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
            <DollarSign className="h-4 w-4" /> Valor potencial registrado
          </div>
          <p className="mt-2 text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
            {toCurrency((registry.oportunidades || []).reduce((acc, item) => acc + Number(item.valorEstimado || 0), 0))}
          </p>
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Somatório de oportunidades no registro de Pré-Vendas.</p>
        </div>

        <div className="crm-card rounded-xl p-4">
          <div className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
            <Target className="h-4 w-4" /> Oportunidades no pipeline
          </div>
          <p className="mt-2 text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{pipelineOpportunities.length}</p>
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Base comercial disponível para vincular ao Pré-Vendas.</p>
        </div>
      </div>
    </div>
  );
}
