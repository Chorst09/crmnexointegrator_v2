import { getDashboardMarket } from '../utils/dashboardMarket.mjs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  BadgeDollarSign,
  BarChart3,
  Beaker,
  BookOpenCheck,
  Building2,
  Calculator,
  CalendarCheck2,
  ChartNoAxesCombined,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardCheck,
  ClipboardList,
  Coins,
  ContactRound,
  FileSignature,
  FolderKanban,
  Gavel,
  Gauge,
  GitBranch,
  Handshake,
  History,
  Landmark,
  LayoutDashboard,
  LineChart,
  Network,
  Package,
  Palette,
  PlugZap,
  Radar,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Trophy,
  Workflow,
  Users,
  UsersRound
} from 'lucide-react';

import { API_BASE_URL, API_ENDPOINTS, getAuthHeaders } from '../config/api';
import { canAccessModule, getUserAccess, normalizeRole, ROLES, isMaster } from '../utils/permissions';

const SIDEBAR_SCROLL_KEY = 'crm-sidebar-scroll-top';

const resolvePublicUrl = (maybeRelativeUrl) => {
  if (!maybeRelativeUrl) return null;
  if (/^https?:\/\//i.test(maybeRelativeUrl)) return maybeRelativeUrl;

  if (/^https?:\/\//i.test(API_BASE_URL)) {
    const base = API_BASE_URL.replace(/\/api\/?$/i, '');
    return `${base}${maybeRelativeUrl}`;
  }

  return maybeRelativeUrl;
};

export default function Sidebar({
  open = false,
  onOpenChange = () => {},
  collapsed = false,
  onToggleCollapsed = () => {}
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const market = getDashboardMarket(location.pathname);
  const navRef = useRef(null);
  const lastActiveSectionIdRef = useRef(null);
  let user = null;
  try {
    const userRaw = localStorage.getItem('user');
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }
  const role = normalizeRole(user?.role || null);
  const access = getUserAccess(user || {});

  const [branding, setBranding] = useState({ appName: 'CRM NEXOS', logoUrl: null });
  const [expandedSections, setExpandedSections] = useState({
    geral: true,
    b2g: false,
    vendas: false,
    prevendas: false,
    gestao: false,
    automacao: false,
    administracao: false,
    configuracao: false
  });

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await fetch(API_ENDPOINTS.settings, { headers: getAuthHeaders() });
        if (!res.ok) return;
        const data = await res.json();
        setBranding({
          appName: data?.appName || 'CRM NEXOS',
          logoUrl: data?.logoUrl || null
        });
      } catch {
        // Best-effort only.
      }
    };
    loadBranding();

    // Listen for branding updates
    const handleBrandingUpdate = (event) => {
      const { appName, logoUrl } = event.detail || {};
      setBranding({
        appName: appName || 'CRM NEXOS',
        logoUrl: logoUrl || null
      });
    };

    window.addEventListener('crm-branding-updated', handleBrandingUpdate);
    return () => window.removeEventListener('crm-branding-updated', handleBrandingUpdate);
  }, []);

  useEffect(() => {
    onOpenChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const menuSections = useMemo(() => ([
    {
      id: 'geral',
      title: 'VISÃO GERAL',
      icon: Gauge,
      accent: "from-cyan-300/95 via-sky-400/85 to-blue-500/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/35",
      items: [
        { path: '/dashboard-geral', label: 'Dashboard Geral', icon: ChartNoAxesCombined, accent: "from-cyan-300/95 via-sky-400/85 to-blue-500/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/35", description: 'Visão consolidada de todos os módulos' },
      ]
    },
    {
      id: 'vendas',
      title: 'B2B PRIVADO',
      icon: Radar,
      accent: "from-orange-300/95 via-amber-400/90 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30",
      items: [
        { path: '/dashboard', label: 'Dashboard B2B', icon: Gauge, accent: "from-cyan-300/95 via-sky-400/85 to-blue-500/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/35", description: 'Visao geral do negocio' },
        { path: '/empresas', label: 'Empresas', icon: Building2, accent: "from-sky-300/95 via-cyan-400/85 to-teal-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/30", description: 'Clientes e prospects' },
        { path: '/leads', label: 'Lead', icon: ContactRound, accent: "from-lime-300/95 via-emerald-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Gestao de leads' },
        { path: '/oportunidades', label: 'Oportunidades', icon: Radar, accent: "from-orange-300/95 via-amber-400/90 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30", description: 'Funil e negociacoes' },
        { path: '/atividades', label: 'Atividades', icon: CalendarCheck2, accent: "from-emerald-300/95 via-teal-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Tarefas e agenda' },
        { path: '/b2b-kickoff', label: 'Gestão de Kickoff', icon: Rocket, accent: "from-rose-300/95 via-orange-400/90 to-amber-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30", description: 'Reuniões estratégicas do projeto' },
        { path: '/simuladores', label: 'Simuladores', icon: Calculator, accent: "from-violet-300/95 via-fuchsia-400/80 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-fuchsia-500/25", description: 'Dashboard, Precificação e Propostas' },
        { path: '/propostas', label: 'Propostas', icon: FileSignature, accent: "from-amber-200/95 via-orange-400/90 to-rose-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30", description: 'Cotas e propostas' },
        { path: '/templates-propostas', label: 'Templates', icon: Palette, accent: "from-fuchsia-300/95 via-rose-400/85 to-orange-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-rose-500/25", description: 'Templates de proposta' },
      ]
    },
    {
      id: 'b2g',
      title: 'B2G GOVERNO',
      icon: Landmark,
      accent: "from-amber-200/95 via-yellow-400/90 to-sky-400/80 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-amber-500/30",
      items: [
        { path: '/b2g-dashboard', label: 'Dashboard', icon: ChartNoAxesCombined, accent: "from-cyan-300/95 via-sky-400/85 to-blue-500/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/35", description: 'Visão estratégica B2G' },
        { path: '/b2g-orgaos', label: 'Órgãos', icon: Landmark, accent: "from-amber-200/95 via-yellow-400/90 to-sky-400/80 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-amber-500/30", description: 'Cadastro de órgãos governamentais' },
        { path: '/b2g-buscar-editais', label: 'Buscar Editais', icon: Search, accent: "from-sky-300/95 via-cyan-400/85 to-emerald-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/30", description: 'Licitações Core Platform - Busca avançada e inteligência PNCP' },
        { path: '/b2g-leads', label: 'Leads', icon: UsersRound, accent: "from-lime-300/95 via-emerald-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Órgãos e contas no radar' },
        { path: '/b2g-oportunidades', label: 'Oportunidades', icon: Gavel, accent: "from-orange-300/95 via-amber-400/90 to-yellow-300/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30", description: 'Pipeline de licitações' },
        { path: '/b2g-kickoff', label: 'Gestão de Kickoff', icon: Rocket, accent: "from-rose-300/95 via-orange-400/90 to-amber-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30", description: 'Reuniões estratégicas do projeto' },
        { path: '/b2g-atas', label: 'Atas de Registro de Preços', icon: Archive, accent: "from-yellow-200/95 via-amber-400/90 to-orange-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-amber-500/30", description: 'Controle de atas RP' },
        { path: '/b2g-atividades', label: 'Atividades', icon: Workflow, accent: "from-emerald-300/95 via-teal-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Agenda operacional B2G' },
        { path: '/b2g-documentacao', label: 'Documentação', icon: BookOpenCheck, accent: "from-blue-200/95 via-cyan-400/85 to-teal-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/30", description: 'Checklist documental' },
        { path: '/b2g-relatorios', label: 'Relatórios Estratégicos', icon: LineChart, accent: "from-cyan-300/95 via-blue-400/85 to-indigo-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-blue-500/30", description: 'Indicadores e decisões' },
        { path: '/b2g-historico', label: 'Histórico', icon: History, accent: "from-[rgb(var(--crm-surface-rgb)_/_0.95)] via-sky-300/85 to-cyan-400/80 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-sky-500/25", description: 'Linha do tempo do edital' }
      ]
    },
    {
      id: 'prevendas',
      title: 'Pre-Vendas',
      icon: Rocket,
      accent: "from-rose-300/95 via-orange-400/90 to-amber-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30",
      items: [
        { path: '/pre-vendas', label: 'Dashboard', icon: LayoutDashboard, accent: "from-cyan-300/95 via-sky-400/85 to-blue-500/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/35", description: 'Visao geral pre-vendas' },
        { path: '/solicitacoes', label: 'Solicitacoes', icon: ClipboardCheck, accent: "from-emerald-300/95 via-teal-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Solicitacoes recebidas' },
        { path: '/orcamentos', label: 'Orçamentos', icon: BadgeDollarSign, accent: "from-yellow-200/95 via-amber-400/90 to-orange-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-amber-500/30", description: 'Cotações registradas no fluxo' },
        { path: '/prevendas-distribuidores', label: 'Distribuidores', icon: Network, accent: "from-sky-300/95 via-cyan-400/85 to-teal-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/30", description: 'Base de distribuidores homologados' },
        { path: '/prevendas-fornecedores', label: 'Fornecedores', icon: Package, accent: "from-indigo-300/95 via-blue-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-blue-500/30", description: 'Base de fornecedores homologados' },
        { path: '/prevendas-registro-oportunidades', label: 'Registro de Oportunidades', icon: Radar, accent: "from-orange-300/95 via-amber-400/90 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30", description: 'Registro técnico para Pré-Vendas' },
        { path: '/calculadoras', label: 'Calculadoras', icon: Calculator, accent: "from-violet-300/95 via-fuchsia-400/80 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-fuchsia-500/25", description: 'Venda, locacao e servicos' },
        { path: '/ratear-produtos', label: 'Ratear Produtos', icon: GitBranch, accent: "from-lime-300/95 via-emerald-400/85 to-sky-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Rateio de despesas por produto' },
        { path: '/rateios-salvos', label: 'Rateios Salvos', icon: History, accent: "from-[rgb(var(--crm-surface-rgb)_/_0.95)] via-sky-300/85 to-cyan-400/80 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-sky-500/25", description: 'Historico de rateios executados' },
        { path: '/gestao-pocs', label: 'Gestão de POCs', icon: Beaker, accent: "from-rose-300/95 via-fuchsia-400/85 to-violet-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-fuchsia-500/25", description: 'Planejamento e validação de provas de conceito' }
      ]
    },
    {
      id: 'gestao',
      title: 'Gestao',
      icon: FolderKanban,
      accent: "from-emerald-300/95 via-teal-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30",
      items: [
        { path: '/contratos', label: 'Contratos', icon: ShieldCheck, accent: "from-blue-300/95 via-indigo-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-blue-500/30", description: 'Vencimentos, renovações e arquivos' },
        { path: '/produtos', label: 'Produtos', icon: Package, accent: "from-indigo-300/95 via-blue-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-blue-500/30", description: 'Catalogo e itens' },
        { path: '/vendedores', label: 'Vendedores', icon: UsersRound, accent: "from-lime-300/95 via-emerald-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Equipe e cadastro' },
        { path: '/analise-financeira', label: 'Análise Financeira', icon: BarChart3, accent: "from-cyan-300/95 via-sky-400/85 to-blue-500/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/35", description: 'Dashboard financeiro e análise' },
        { path: '/comissoes', label: 'Comissoes', icon: Coins, accent: "from-yellow-200/95 via-amber-400/90 to-orange-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-amber-500/30", description: 'Pagamentos e regras' },
        { path: '/metas-performance', label: 'Metas & Performance', icon: Trophy, accent: "from-orange-300/95 via-amber-400/90 to-yellow-300/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30", description: 'Metas e indicadores' },
        { path: '/kickoff', label: 'Gestão de Kickoff', icon: Rocket, accent: "from-rose-300/95 via-orange-400/90 to-amber-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-orange-500/30", description: 'Reuniões estratégicas do projeto' },
        { path: '/projetos', label: 'Gestão de Projetos', icon: FolderKanban, accent: "from-teal-300/95 via-emerald-400/85 to-green-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Gestão de projetos e entregas' },
        { path: '/pos-venda', label: 'Pos-Venda', icon: Handshake, accent: "from-emerald-300/95 via-teal-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-emerald-500/30", description: 'Relacionamento e suporte' },
        { path: '/relatorios', label: 'Relatorios', icon: ChartNoAxesCombined, accent: "from-cyan-300/95 via-blue-400/85 to-indigo-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-blue-500/30", description: 'Analises e metricas' }
      ]
    },
    {
      id: 'automacao',
      title: 'Automação / Integrações',
      icon: PlugZap,
      accent: "from-violet-300/95 via-fuchsia-400/80 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-fuchsia-500/25",
      items: [
        { path: '/automacoes', label: 'Workflows', icon: Workflow, accent: "from-violet-300/95 via-fuchsia-400/80 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-fuchsia-500/25", description: 'Regras e automacoes' },
        { path: '/integracoes', label: 'Integracoes', icon: PlugZap, accent: "from-sky-300/95 via-cyan-400/85 to-emerald-300/90 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/30", description: 'APIs e conectores' }
      ]
    },
    {
      id: 'administracao',
      title: 'Administracao',
      icon: ShieldCheck,
      accent: "from-blue-300/95 via-indigo-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-blue-500/30",
      items: [
        {
          path: '/administracao',
          label: 'Administracao',
          icon: ShieldCheck,
          accent: "from-blue-300/95 via-indigo-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-blue-500/30",
          description: 'Gestao global de empresas, planos e licenciamento (MASTER)'
        }
      ]
    },
    {
      id: 'configuracao',
      title: 'Configuracoes',
      icon: SlidersHorizontal,
      accent: "from-[rgb(var(--crm-surface-rgb)_/_0.95)] via-sky-300/85 to-cyan-400/80 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-sky-500/25",
      items: [
        {
          path: '/configuracoes',
          label: 'Configuracoes',
          icon: SlidersHorizontal,
          accent: "from-[rgb(var(--crm-surface-rgb)_/_0.95)] via-sky-300/85 to-cyan-400/80 text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-sky-500/25",
          description: 'Gerencie suas preferências e configurações da empresa'
        },
        { path: '/funcionalidades-avancadas', label: 'Avancado', icon: Settings2, accent: "from-violet-300/95 via-blue-400/85 to-cyan-400/85 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-blue-500/30", description: 'Configuracoes avancadas' }
      ]
    }
  ]), []);

  const filteredMenuSections = useMemo(() => {
    const master = isMaster(user || {});
    // Route context changes branding, never which authorized modules are visible.
    const scopedSections = menuSections;

    // Master has access to everything. This is the simplest and most reliable check.
    if (master) {
      return scopedSections;
    }

    return scopedSections
      .map((section) => {
        // The 'administracao' section is MASTER only
        if (section.id === 'administracao') {
          return role === ROLES.MASTER ? section : null;
        }

        if (section.id === 'geral') {
          return canAccessModule(user, 'DASHBOARD_GERAL') ? section : null;
        }

        if (section.id === 'configuracao') {
          const items = section.items.filter((item) => {
            // ADMIN and MASTER can see settings
            if (item.path === '/configuracoes') return role === ROLES.ADMIN || role === ROLES.MASTER;
            if (item.path === '/funcionalidades-avancadas') return role === ROLES.ADMIN || role === ROLES.MASTER;
            return false;
          });
          return items.length > 0 ? { ...section, items } : null;
        }

        // PRE_SALES role can only see the 'prevendas' section.
        if (role === ROLES.PRE_SALES) {
          return section.id === 'prevendas' ? section : null;
        }

        // USER_B2B: somente seção B2B (vendas)
        if (role === ROLES.USER_B2B) {
          if (section.id === 'vendas') {
            return {
              ...section,
              items: section.items.filter((item) =>
                ['/dashboard', '/empresas', '/oportunidades', '/atividades', '/leads', '/propostas', '/simuladores'].includes(item.path)
              )
            };
          }
          return null;
        }

        // USER_B2G: somente seção B2G
        if (role === ROLES.USER_B2G) {
          if (section.id === 'b2g') return section;
          return null;
        }

        // Logic for USER and SELLER roles.
        if (role === ROLES.USER || role === ROLES.SELLER) {
          if (section.id === 'vendas' && access.accessB2B) {
            const allowedPaths = ['/dashboard', '/empresas', '/oportunidades', '/atividades', '/leads', '/b2b-kickoff', '/propostas'];
            // Add simuladores if user has access to simulador
            if (access.accessSimulador) {
              allowedPaths.push('/simuladores');
            }
            return {
              ...section,
              items: section.items.filter((item) => allowedPaths.includes(item.path))
            };
          }
          if (section.id === 'b2g' && access.accessB2G) return section;
          if (section.id === 'prevendas' && access.accessPreSales) return section;
          if (section.id === 'gestao' && access.accessManagement) {
            return {
              ...section,
              items: section.items.filter((item) =>
                ['/contratos', '/projetos', '/kickoff', '/pos-venda', '/relatorios'].includes(item.path)
              )
            };
          }
          if (section.id === 'automacao' && access.accessAutomation) {
            return {
              ...section,
              items: section.items.filter((item) => item.path === '/automacoes')
            };
          }
          // Deny other sections for these roles.
          return null;
        }

        // DIRECTOR role does not see 'prevendas'.
        if (role === ROLES.DIRECTOR) {
          if (section.id === 'prevendas') return null;
        }

        if (section.id === 'vendas' && !access.accessB2B) return null;
        if (section.id === 'b2g' && !access.accessB2G) return null;
        if (section.id === 'prevendas' && !access.accessPreSales) return null;
        if (section.id === 'gestao' && !access.accessManagement) return null;
        if (section.id === 'automacao' && !access.accessAutomation) return null;

        return section;
      })
      .filter(Boolean)
      .filter((section) => section.items && section.items.length > 0);
  }, [market, menuSections, role, access.accessB2B, access.accessB2G, access.accessPreSales, access.accessManagement, access.accessAutomation, user]);

  useEffect(() => {
    const activeSection = filteredMenuSections.find((section) =>
      section.items.some((item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
    );

    if (!activeSection) return;
    if (lastActiveSectionIdRef.current === activeSection.id) return;

    lastActiveSectionIdRef.current = activeSection.id;

    setExpandedSections((prev) => (
      prev[activeSection.id] ? prev : { ...prev, [activeSection.id]: true }
    ));
  }, [filteredMenuSections, location.pathname]);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return undefined;

    // Salva posição do scroll continuamente durante rolagem
    const handleScroll = () => {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop));
    };
    nav.addEventListener('scroll', handleScroll, { passive: true });
    return () => nav.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    // Restaura posição do scroll após navegação
    // Usa setTimeout para aguardar seções expandirem e DOM estabilizar
    const saved = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY));
    if (!Number.isFinite(saved) || saved <= 0) return undefined;

    const timer = setTimeout(() => {
      if (navRef.current) {
        navRef.current.scrollTop = saved;
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  const toggleSection = (e, section) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const saveSidebarScroll = () => {
    const nav = navRef.current;
    if (nav) {
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(nav.scrollTop));
    }
  };

  const renderNavItem = (item) => {
    const Icon = item.icon;
    const iconAccent = item.accent || "from-cyan-300/95 via-sky-400/85 to-blue-500/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/35";

    return (
      <NavLink
        to={item.path}
        title={collapsed ? `${item.label} - ${item.description}` : item.description}
        onClick={() => {
          saveSidebarScroll();
          onOpenChange(false);
        }}
        className={({ isActive }) => [
          'group relative flex w-full overflow-hidden rounded-xl',
          collapsed ? 'items-center justify-center gap-0 px-2 py-1.5' : 'items-center gap-2.5 px-2.5 py-1.5',
          'border transition-all duration-200 ease-out',
          isActive
            ? "border-cyan-300/45 dark:border-cyan-400/40 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[linear-gradient(115deg,rgba(14,165,233,0.34)_0%,rgba(29,78,216,0.22)_55%,rgb(var(--crm-surface-2-rgb)_/_0.5)_100%)] text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-[0_8px_20px_-14px_rgba(34,211,238,0.85)]"
            : "border-transparent dark:border-transparent bg-transparent text-[rgb(var(--crm-ink-rgb)_/_0.88)] dark:text-[rgb(var(--crm-ink-rgb)_/_0.82)] hover:border-cyan-200/20 dark:hover:border-cyan-500/25 hover:bg-[rgb(var(--crm-surface-2-rgb)_/_0.55)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
        ].join(' ')}
      >
        {({ isActive }) => (
          <>
            <span
              className={[
                'absolute inset-y-1.5 left-0 w-0.5 rounded-r-full transition-opacity duration-200',
                isActive ? "bg-cyan-300 opacity-100 shadow-[0_0_12px_rgba(103,232,249,0.9)]" : "opacity-0 group-hover:opacity-60 bg-cyan-200/70"
              ].join(' ')}
            />

            <span
              className={[
                'relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-all duration-200',
                isActive
                  ? `border-cyan-300/40 bg-gradient-to-br ${iconAccent} shadow-sm`
                  : "border-[var(--crm-border)] dark:border-[rgb(var(--crm-ink-rgb)_/_0.12)] bg-[rgb(var(--crm-surface-rgb)_/_0.06)] text-[rgb(var(--crm-ink-rgb)_/_0.9)] group-hover:bg-[rgb(var(--crm-surface-rgb)_/_0.14)]"
              ].join(' ')}
            >
              <span className={['absolute inset-0 opacity-0 transition-opacity duration-200', isActive ? 'opacity-100' : 'group-hover:opacity-90', `bg-gradient-to-br ${iconAccent}`].join(' ')} />
              <Icon
                strokeWidth={2.2}
                className={[
                  'relative z-10 h-3.5 w-3.5 transition-transform duration-200',
                  isActive ? 'scale-105' : 'group-hover:scale-105'
                ].join(' ')}
              />
            </span>

            <span className={collapsed ? 'min-w-0 flex-1 lg:hidden' : 'min-w-0 flex-1'}>
              <span className="block truncate text-[12.5px] font-medium leading-4">{item.label}</span>
            </span>
          </>
        )}
      </NavLink>
    );
  };

  const sidebarContent = (
    <div className="relative z-10 flex h-full flex-col">
      <div className={["relative overflow-hidden border-b border-[var(--crm-border)] dark:border-[var(--crm-border)] py-5 lg:pt-12", collapsed ? 'px-5 lg:px-3' : 'px-5'].join(' ')}>
        <div className="absolute inset-0 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[radial-gradient(ellipse_at_88%_0%,rgba(35,211,238,0.20)_0%,transparent_48%),linear-gradient(180deg,rgb(var(--crm-surface-2-rgb)_/_0.72)_0%,rgb(var(--crm-surface-2-rgb)_/_0.18)_100%)]" />

        <div className={["relative flex items-center justify-center overflow-hidden rounded-[22px] border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[linear-gradient(135deg,rgb(var(--crm-surface-2-rgb)_/_0.88)_0%,rgb(var(--crm-surface-2-rgb)_/_0.92)_54%,rgb(var(--crm-surface-rgb)_/_0.72)_100%)] shadow-[0_22px_48px_-34px_rgba(34,211,238,0.62)]", collapsed ? 'h-[4.6rem] lg:h-14' : 'h-[4.6rem]'].join(' ')}>
          {market ? (
            <div className="nex-sidebar-market-brand"><img src="/double-logo.svg" alt="Double"/><strong>NEXOS <span>{market}</span></strong></div>
          ) : resolvePublicUrl(branding.logoUrl) ? (
            <img
              src={resolvePublicUrl(branding.logoUrl)}
              alt="Logo"
              className={collapsed ? 'relative z-10 max-h-12 max-w-[12rem] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)] lg:max-h-8 lg:max-w-10' : 'relative z-10 max-h-12 max-w-[12rem] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.45)]'}
            />
          ) : (
            <>
              <div className={collapsed ? 'relative z-10 flex items-center gap-3 lg:hidden' : 'relative z-10 flex items-center gap-3'}>
                <div className="relative h-11 w-[4.85rem] shrink-0">
                  <div className="absolute left-0 top-0.5 h-10 w-10 rounded-full border-[8px] border-[var(--crm-border)] dark:border-[#25c6de] shadow-[0_0_24px_rgba(37,198,222,0.30)]" />
                  <div className="absolute left-[2.1rem] top-0.5 h-10 w-10 rounded-full border-[8px] border-[var(--crm-border)] dark:border-[#ff961f] shadow-[0_0_24px_rgba(255,150,31,0.22)]" />
                  <div className="absolute left-[1.42rem] top-[0.57rem] flex h-8 w-8 items-center justify-center rounded-full border border-cyan-100/18 dark:border-cyan-800/18 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[9px] font-black text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-[inset_0_0_18px_rgba(34,211,238,0.12)]">
                    AI
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-black leading-none tracking-[0.01em] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                    ChorstConsult
                  </div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.24em] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-100/62">
                    Nexos AI
                  </div>
                </div>
              </div>

              {collapsed ? (
                <div className="relative z-10 hidden h-10 w-10 items-center justify-center rounded-full border border-cyan-200/35 dark:border-cyan-800/35 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[10px] font-black text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-inner shadow-cyan-950/40 lg:flex">
                  AI
                </div>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleCollapsed}
          className="absolute right-2 top-2 z-20 hidden h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/28 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_0.95)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-100 shadow-[0_12px_28px_-18px_rgba(34,211,238,0.95)] transition hover:border-cyan-200/60 dark:hover:border-cyan-800/60 hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] lg:inline-flex"
          aria-pressed={collapsed}
          aria-label={collapsed ? 'Expandir módulos' : 'Recolher módulos'}
          title={collapsed ? 'Expandir módulos' : 'Recolher módulos'}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      <nav
        ref={navRef}
        aria-label="Menu principal"
        onScroll={saveSidebarScroll}
        className={['flex-1 min-h-0 overflow-y-auto overscroll-contain py-3 [scrollbar-gutter:stable]', collapsed ? 'px-2' : 'px-2.5'].join(' ')}
      >
        {!collapsed && (
          <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/55">
            Principal
          </div>
        )}
        {filteredMenuSections.map((section) => {
          const SectionIcon = section.icon;
          const sectionAccent = section.accent || "from-cyan-300/95 via-sky-400/85 to-blue-500/90 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] shadow-cyan-500/35";
          const isOpen = !!expandedSections[section.id];

          return (
            <div key={section.id} className="mb-1.5 motion-safe:animate-fade-in">
              <button
                type="button"
                onClick={(e) => toggleSection(e, section.id)}
                title={section.title}
                className={[
                  'w-full flex items-center rounded-xl py-1.5',
                  collapsed ? 'justify-center gap-0 px-2' : 'justify-between gap-2 px-2.5',
                  'text-left text-[11px] font-semibold tracking-[0.04em]',
                  "border border-transparent bg-[rgb(var(--crm-surface-2-rgb)_/_0.28)] text-[rgb(var(--crm-ink-rgb)_/_0.9)]",
                  "transition-all duration-200 hover:border-cyan-300/20 hover:bg-[rgb(var(--crm-surface-2-rgb)_/_0.68)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                ].join(' ')}
                aria-expanded={isOpen}
              >
                <span className={['flex items-center min-w-0', collapsed ? 'justify-center gap-0' : 'gap-2'].join(' ')}>
                  <span
                    className={[
                      'relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-all duration-200',
                      isOpen
                        ? `border-cyan-300/40 bg-gradient-to-br ${sectionAccent} shadow-sm`
                        : "border-[var(--crm-border)] dark:border-[rgb(var(--crm-ink-rgb)_/_0.12)] bg-[rgb(var(--crm-surface-rgb)_/_0.07)] text-[rgb(var(--crm-ink-rgb)_/_0.9)]"
                    ].join(' ')}
                  >
                    <span className={['absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100', `bg-gradient-to-br ${sectionAccent}`, isOpen ? 'opacity-100' : ''].join(' ')} />
                    <SectionIcon strokeWidth={2.2} className="relative z-10 h-3.5 w-3.5" />
                  </span>
                  <span className={collapsed ? 'lg:hidden truncate' : 'truncate'}>{section.title}</span>
                </span>

                <ChevronDown
                  className={[
                    "h-3.5 w-3.5 shrink-0 text-[rgb(var(--crm-ink-rgb)_/_0.65)] transition-transform duration-200",
                    collapsed ? 'lg:hidden' : '',
                    isOpen ? 'rotate-0' : '-rotate-90'
                  ].join(' ')}
                />
              </button>

              <div
                className={[
                  'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                  isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-75'
                ].join(' ')}
              >
                <ul className={['overflow-hidden space-y-0.5 pt-1', collapsed ? 'px-0' : 'pl-2 pr-0.5'].join(' ')}>
                  {section.items.map((item) => (
                    <li key={item.path}>
                      {renderNavItem(item)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}

        {!collapsed && (
          <div className="mt-4 border-t border-cyan-400/15 pt-3">
            <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200/55">
              Atalhos Rápidos
            </div>
            <div className="space-y-1.5 px-1">
              {[
                { label: '+ Nova Oportunidade', to: '/oportunidades', icon: Target },
                { label: '+ Novo Lead', to: '/leads', icon: Radar },
                { label: '+ Nova Proposta', to: '/propostas', icon: FileSignature },
                { label: 'Agenda Comercial', to: '/atividades', icon: CalendarCheck2 },
              ].map((shortcut) => {
                const SIcon = shortcut.icon;
                return (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={() => {
                      saveSidebarScroll();
                      onOpenChange(false);
                      navigate(shortcut.to);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg border border-cyan-400/15 bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-2.5 py-1.5 text-left text-[12px] font-medium text-cyan-100/90 transition hover:border-cyan-300/40 hover:bg-cyan-500/15 hover:text-white"
                  >
                    <SIcon className="h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    <span className="truncate">{shortcut.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      <div className="relative overflow-hidden border-t border-[var(--crm-border)] dark:border-[var(--crm-border)] px-3 py-2.5">
        <div className="absolute inset-0 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[linear-gradient(180deg,rgb(var(--crm-surface-2-rgb)_/_0.12)_0%,rgb(var(--crm-surface-rgb)_/_0.28)_100%)]" />
        <div className="relative rounded-xl border border-cyan-200/[0.055] bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_0.56)] px-2.5 py-1.5 text-center text-[10px] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_0.7)] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
          <div className={collapsed ? "font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-50/80 lg:text-[9px]" : "font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-50/80"}>
            <span className={collapsed ? 'lg:hidden' : ''}>{market ? `NEXOS ${market}` : (branding.appName || 'CRM NEXOS')}</span>
            <span className={collapsed ? 'hidden lg:inline' : 'hidden'}>NEXOS</span> v3
          </div>
          <div className={collapsed ? 'opacity-80 lg:hidden' : 'opacity-80'}>© 2026</div>
        </div>
      </div>
    </div>
  );

  const showOverlay = open;

  return (
    <>
      <div
        className={[
          "fixed inset-0 z-30 bg-[rgb(var(--crm-surface-2-rgb)_/_0.65)] backdrop-blur-sm transition-opacity lg:hidden",
          showOverlay ? 'opacity-100' : 'pointer-events-none opacity-0'
        ].join(' ')}
        onClick={() => onOpenChange(false)}
        aria-hidden={!showOverlay}
      />

      <aside
        className={[
          'fixed inset-y-0 left-0 z-40 w-[254px] max-w-[84vw]',
          collapsed ? 'lg:w-[76px]' : 'lg:w-[254px]',
          'transform transition-[transform,width] duration-300 will-change-transform',
          open ? 'translate-x-0' : '-translate-x-full',
          'lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:z-20 lg:max-w-none',
          "flex shrink-0 flex-col overflow-hidden text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]",
          "bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[radial-gradient(ellipse_at_92%_0%,rgba(37,196,218,0.24)_0%,transparent_42%),radial-gradient(ellipse_at_0%_18%,rgb(var(--crm-surface-2-rgb)_/_0.38)_0%,transparent_46%),linear-gradient(180deg,rgb(var(--crm-surface-2-rgb)_/_1)_0%,rgb(var(--crm-surface-2-rgb)_/_1)_48%,rgb(var(--crm-surface-2-rgb)_/_1)_100%)]",
          "border-r border-[var(--crm-border)] dark:border-[var(--crm-border)] shadow-[18px_0_52px_-36px_rgba(34,211,238,0.62)]"
        ].join(' ')}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[linear-gradient(90deg,rgba(35,211,238,0.08)_0%,transparent_42%),linear-gradient(180deg,rgb(var(--crm-surface-rgb)_/_0.025)_0%,transparent_32%)]" />
          <div className="absolute inset-0 crm-dotgrid opacity-[0.14]" />
        </div>

        {sidebarContent}
      </aside>
    </>
  );
}
