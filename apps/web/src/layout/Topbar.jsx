import { useState } from 'react';
import { Bell, LogIn, LogOut, Menu, Monitor, Moon, Sun, User, Rocket } from 'lucide-react';
import { useTheme } from '../theme/ThemeProvider';
import { useLocation, useNavigate } from 'react-router-dom';
import B2BTestFlowModal from '../components/B2BTestFlowModal';

const ROUTE_META = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Visao geral e indicadores' },
  '/empresas': { title: 'Empresas', subtitle: 'Clientes, prospects e contatos' },
  '/oportunidades': { title: 'Oportunidades', subtitle: 'Kanban, negociacoes e previsao' },
  '/atividades': { title: 'Atividades', subtitle: 'Tarefas, follow-ups e agenda' },
  '/kickoff': { title: 'Gestão de Kickoff', subtitle: 'Ciclo de reuniões estratégicas do projeto' },
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
    <header className="sticky top-0 z-30 border-b border-[#0b2a35]/70 bg-[radial-gradient(ellipse_at_76%_0%,rgba(37,196,218,0.22)_0%,transparent_44%),radial-gradient(ellipse_at_18%_0%,rgba(51,15,28,0.34)_0%,transparent_48%),linear-gradient(180deg,rgba(5,7,13,0.98)_0%,rgba(7,16,28,0.96)_100%)] px-4 py-3 shadow-[0_22px_54px_-38px_rgba(34,211,238,0.55)] backdrop-blur-2xl sm:px-6 lg:px-8">
      <div className="mx-auto flex h-[5.65rem] w-full max-w-[1920px] items-center gap-5">
        <button
          type="button"
          onClick={onMenuClick}
          className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-cyan-200/24 bg-[#061524]/92 text-cyan-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          aria-label="Abrir menu"
          title="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div
          className="relative hidden h-[5.15rem] min-w-0 flex-1 overflow-hidden rounded-[24px] border border-[#0b2a35]/70 bg-cover bg-center shadow-[0_24px_54px_-36px_rgba(34,211,238,0.58)] md:block"
          style={{ backgroundImage: "url('/b2g/govflow-header.png')" }}
        >
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,13,0.82)_0%,rgba(5,9,18,0.56)_36%,rgba(9,34,42,0.20)_70%,rgba(35,211,238,0.26)_100%)]" />
          <div className="absolute left-3 top-1/2 max-w-[min(30rem,56%)] -translate-y-1/2 rounded-[16px] bg-[#05070d]/34 px-5 py-2.5 shadow-[0_22px_44px_-26px_rgba(0,0,0,0.95)] backdrop-blur-sm">
            <div className="text-[10px] font-semibold uppercase tracking-[0.42em] text-cyan-50/78">Sistema</div>
            <div className="mt-0.5 truncate text-xl font-black leading-none text-white">{headerTitle}</div>
            <div className="mt-1 max-w-full truncate text-[11px] font-semibold text-slate-300/88">{meta.subtitle}</div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center md:hidden">
          <div>
            <div className="text-[12px] font-semibold uppercase tracking-[0.42em] text-cyan-200/82">Sistema</div>
            <div className="max-w-[13rem] truncate text-xl font-black text-white">{headerTitle}</div>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3 text-cyan-50">
          <button
            type="button"
            onClick={() => setIsTestFlowOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/25 via-blue-500/25 to-indigo-500/25 hover:from-cyan-500/40 hover:to-indigo-500/40 border border-cyan-400/40 text-cyan-200 hover:text-white shadow-sm transition-all text-xs font-semibold cursor-pointer"
            title="Executar ou Visualizar Teste de Fluxo B2B Integrado (Todos os 10 Módulos)"
          >
            <Rocket className="h-4 w-4 text-cyan-400 animate-pulse" />
            <span className="hidden md:inline">Teste Fluxo B2B (10 Módulos)</span>
            <span className="md:hidden">Teste B2B</span>
          </button>

          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-transparent text-cyan-50 transition hover:border-cyan-200/16 hover:bg-[#102033]/78 sm:inline-flex"
            aria-label="Notificações"
            title="Notificações"
          >
            <Bell className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="hidden h-10 w-10 items-center justify-center rounded-full border border-transparent text-cyan-50 transition hover:border-cyan-200/16 hover:bg-[#102033]/78 sm:inline-flex"
            title={`Tema: ${theme} (ativo: ${resolvedTheme})`}
            aria-label="Alternar tema"
          >
            {theme === 'system' ? (
              <Monitor className="h-5 w-5" />
            ) : resolvedTheme === 'dark' ? (
              <Moon className="h-5 w-5" />
            ) : (
              <Sun className="h-5 w-5" />
            )}
          </button>

          <div className="hidden h-10 w-px bg-cyan-100/18 lg:block" />

          <div className="relative">
            <button
              type="button"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              className="flex items-center gap-3 rounded-2xl px-1.5 py-1 transition hover:bg-[#102033]/78"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              title="Menu do usuário"
            >
              <span className="hidden min-w-0 text-right lg:block">
                <span className="block max-w-[170px] truncate text-xs font-black text-white">{userName}</span>
                <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-100/62">{userRole}</span>
              </span>

              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-cyan-200/30 bg-[linear-gradient(135deg,rgba(10,35,52,0.92),rgba(31,112,124,0.70))] text-sm font-black text-cyan-50 shadow-[0_12px_28px_-18px_rgba(34,211,238,0.85),inset_0_0_24px_rgba(143,209,255,0.12)]">
                {userInitials}
              </span>
            </button>

            {userMenuOpen && (
              <div
                className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-44 overflow-hidden rounded-2xl border border-cyan-200/20 bg-[#060d18] p-1.5 shadow-[0_24px_58px_-28px_rgba(0,0,0,0.98)]"
                role="menu"
              >
                <button
                  type="button"
                  onClick={handleUserAccess}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-cyan-50 transition hover:bg-[#102033]"
                  role="menuitem"
                >
                  <User className="h-4 w-4" />
                  Usuário
                </button>
                <button
                  type="button"
                  onClick={handleLogin}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-cyan-50 transition hover:bg-[#102033]"
                  role="menuitem"
                >
                  <LogIn className="h-4 w-4" />
                  Login
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-bold text-[#ffb4b4] transition hover:bg-[#4d1d2a]"
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
