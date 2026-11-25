import { getDashboardMarket } from '../utils/dashboardMarket.mjs';
import { NEON_DASHBOARD_ROUTES } from '../utils/dashboardPresentation';
import { useState } from 'react';
import { LogIn, LogOut, Menu, Monitor, Moon, Sun, User, Rocket, Sparkles, Bell } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { useLocation, useNavigate } from 'react-router-dom';
import B2BTestFlowModal from '../components/B2BTestFlowModal';
import ExecutiveHeaderSearch from '../components/ExecutiveHeaderSearch';
import PreSalesReturnNotifications from '../components/PreSalesReturnNotifications';

const ROUTE_META = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visao geral e indicadores' },
  '/empresas': { title: 'Empresas', subtitle: 'Clientes, prospects e contatos' },
  '/oportunidades': { title: 'Oportunidades', subtitle: 'Kanban, negociacoes e previsao' },
  '/atividades': { title: 'Atividades', subtitle: 'Tarefas, follow-ups e agenda' },
  '/kickoff': { title: 'Gestão de Kickoff', subtitle: 'Ciclo de reuniões estratégicas do projeto' },
  '/b2b-kickoff': { title: 'Gestão de Kickoff', subtitle: 'Ciclo de reuniões estratégicas do projeto' },
  '/produtos': { title: 'Produtos', subtitle: 'Catalogo e precificacao' },
  '/propostas': { title: 'Propostas', subtitle: 'Cotas, templates e aprovacao' },
  '/contratos': { title: 'Contratos', subtitle: 'SLA, anexos e ciclo de vida' },
  '/pos-venda': { title: 'Pos-venda', subtitle: 'Onboarding e suporte' },
  '/comissoes': { title: 'Comissoes', subtitle: 'Pagamentos e metas' },
  '/vendedores': { title: 'Vendedores', subtitle: 'Equipe e performance' },
  '/relatorios': { title: 'Relatorios', subtitle: 'Analises e metricas' },
  '/integracoes': { title: 'Integracoes', subtitle: 'APIs e conectores' },
  '/configuracoes': {
    title: 'Configuracoes',
    subtitle: 'Gerencie suas preferências de conta e configurações da empresa'
  },
  '/administracao': { title: 'Administracao', subtitle: 'Usuarios, roles, empresas e licenciamento' },
  '/pre-vendas': { title: 'Pre-Vendas', subtitle: 'Painel operacional' },
  '/solicitacoes': { title: 'Solicitacoes', subtitle: 'Fila de entrada comercial' },
  '/orcamentos': { title: 'Orçamentos', subtitle: 'Cotações consolidadas do Pré-Vendas' },
  '/prevendas-distribuidores': { title: 'Distribuidores', subtitle: 'Base operacional de distribuidores do Pré-Vendas' },
  '/prevendas-fornecedores': { title: 'Fornecedores', subtitle: 'Base operacional de fornecedores do Pré-Vendas' },
  '/prevendas-registro-oportunidades': { title: 'Registro de Oportunidades', subtitle: 'Registro técnico de oportunidades do Pré-Vendas' },
  '/prevendas-cadastros': { title: 'Cadastros Pré-Vendas', subtitle: 'Distribuidores, fornecedores e registro de oportunidades' },
  '/calculadoras': { title: 'Calculadoras', subtitle: 'Simulacoes e precos' },
  '/precificacao': { title: 'Precificação', subtitle: 'DRE, rateio mensal e analytics' },
  '/ratear-produtos': { title: 'Ratear Produtos', subtitle: 'Rateio de despesas por produto' },
  '/rateios-salvos': { title: 'Rateios Salvos', subtitle: 'Historico de rateios de Pre-Vendas' },
  '/leads': { title: 'Lead', subtitle: 'Qualificacao e distribuicao' },
  '/b2g-editais': { title: 'B2G GOVERNO', subtitle: 'Operação comercial B2G' },
  '/b2g-dashboard': { title: 'B2G Dashboard', subtitle: 'Visao executiva dos editais e pipeline público' },
  '/b2g-buscar-editais': { title: 'B2G Buscar Editais', subtitle: 'Licitações Core Platform — Busca PNCP, filtros de TI e inteligência' },
  '/b2g-portal-busca': { title: 'B2G Buscar Editais', subtitle: 'Licitações Core Platform — Busca PNCP, filtros de TI e inteligência' },
  '/b2g-leads': { title: 'B2G Leads', subtitle: 'Orgaos e contas priorizadas por potencial' },
  '/b2g-oportunidades': { title: 'B2G Oportunidades', subtitle: 'Funil de licitações e previsibilidade de receita' },
  '/b2g-kickoff': { title: 'B2G Kickoff', subtitle: 'Ciclo de reuniões estratégicas do projeto' },
  '/b2g-atas': { title: 'B2G Atas RP', subtitle: 'Monitoramento de atas de registro de preços' },
  '/b2g-atividades': { title: 'B2G Atividades', subtitle: 'Acompanhamento operacional e follow-ups' },
  '/b2g-documentacao': { title: 'B2G Documentação', subtitle: 'Gestão de checklist e conformidade documental' },
  '/b2g-relatorios': { title: 'B2G Relatórios Estratégicos', subtitle: 'Indicadores para direcionamento comercial' },
  '/b2g-historico': { title: 'B2G Histórico', subtitle: 'Timeline completa dos eventos do edital' }
};

export default function Topbar({ onMenuClick }) {
  const { theme, resolvedTheme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedPath = location.pathname.replace(/\/+$/, '').toLowerCase() || '/';
  const executive = NEON_DASHBOARD_ROUTES.has(normalizedPath);
  const market = getDashboardMarket(location.pathname);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isTestFlowOpen, setIsTestFlowOpen] = useState(false);
  const meta = ROUTE_META[location.pathname] || { title: 'CRM NEXOS', subtitle: 'Conexões que impulsionam negócios' };
  let user = null;
  try {
    const userRaw = localStorage.getItem('user');
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }
  const userName = user?.name || 'Chorstconsult Admin';
  const userRole = user?.role || 'MASTER';
  const headerTitle = location.pathname.startsWith('/b2g') ? 'GovFlow B2G' : meta.title;
  const userInitials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || 'CA';
  const closeUserMenu = () => setUserMenuOpen(false);
  const handleUserAccess = () => {
    closeUserMenu();
    navigate('/configuracoes');
  };
  const handleLogin = () => {
    closeUserMenu();
    navigate('/login');
  };
  const handleLogout = () => {
    closeUserMenu();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <header className={`${executive ? 'nex-topbar' : ''} sticky top-0 z-30 border-b border-cyan-400/20 bg-[rgb(var(--crm-surface-rgb)_/_0.96)] dark:bg-[linear-gradient(90deg,rgba(4,20,42,0.96)_0%,rgba(6,27,53,0.94)_60%,rgba(8,36,68,0.96)_100%)] px-4 py-2 shadow-[0_8px_28px_-16px_rgba(34,211,238,0.45)] backdrop-blur-xl sm:px-6`}>
      <div className="mx-auto flex h-11 w-full max-w-[1920px] items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/25 bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-50"
          aria-label="Abrir menu"
          title="Menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        {executive ? null : (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="hidden sm:inline-flex items-center rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">
              {location.pathname.startsWith('/b2g') ? 'GovFlow B2G' : 'CRM NEXOS'}
            </span>
            <span className="truncate text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">{headerTitle}</span>
            <span className="hidden md:inline text-cyan-400/40">•</span>
            <span className="hidden md:inline truncate text-xs text-[rgb(var(--crm-ink-rgb)_/_0.65)]">{meta.subtitle}</span>
          </div>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-2 text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-50">
          {market ? <button type="button" className="nex-market-agenda" aria-label={`Agenda ${market}`} title={`Agenda ${market}`} onClick={()=>navigate(market==='B2G'?'/b2g-atividades':'/atividades')}><Bell size={18}/></button> : <PreSalesReturnNotifications />}

          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-transparent text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-50 transition hover:border-cyan-300/25 hover:bg-[rgb(var(--crm-surface-2-rgb)_/_0.78)]"
            title={`Tema: ${theme} (ativo: ${resolvedTheme})`}
            aria-label="Alternar tema"
          >
            {theme === 'system' ? (
              <Monitor className="h-4 w-4" />
            ) : resolvedTheme === 'dark' ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </button>

          <div className="hidden h-6 w-px bg-cyan-300/20 lg:block" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-[rgb(var(--crm-surface-2-rgb)_/_0.78)]"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              title="Menu do usuário"
            >
              <span className="hidden min-w-0 text-right lg:block">
                <span className="block max-w-[150px] truncate text-xs font-bold leading-tight text-[rgb(var(--crm-ink-rgb)_/_1)]">{userName}</span>
                <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-[rgb(var(--crm-ink-rgb)_/_0.65)] dark:text-cyan-200/65">{userRole}</span>
              </span>

              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-cyan-300/35 bg-gradient-to-br from-cyan-500/80 to-blue-700/90 text-xs font-black text-white shadow-[0_0_12px_rgba(34,211,238,0.35)]">
                {userInitials}
              </span>
            </button>

            {userMenuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-44 overflow-hidden rounded-2xl border border-cyan-200/20 dark:border-cyan-800/20 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-1.5 shadow-[0_24px_58px_-28px_rgba(0,0,0,0.98)]"
                role="menu"
              >
                <button
                  type="button"
                  onClick={handleUserAccess}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-50 transition hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)]"
                  role="menuitem"
                >
                  <User className="h-4 w-4" />
                  Usuário
                </button>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-cyan-50 transition hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)]"
                  role="menuitem"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#ffb4b4] transition hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <B2BTestFlowModal
        isOpen={isTestFlowOpen}
        onClose={() => setIsTestFlowOpen(false)}
      />
    </header>
  );
}
