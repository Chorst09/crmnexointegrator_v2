/**
 * BuscarEditais.jsx
 * Módulo completo de Licitações B2G - 100% baseado em licitacoes_codigo
 * Com tema dark/teal customizado
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search,
  Bell,
  BarChart,
  Briefcase,
  FileText,
  FileCheck,
  Settings,
  ArrowLeft,
  Menu,
  X
} from 'lucide-react';
import { SearchPage } from './licitacoes_components/SearchPage';
import { AlertsPage } from './licitacoes_components/AlertsPage';
import { AnalyticsDashboard } from './licitacoes_components/AnalyticsDashboard';
import { GerenciadasPage } from './licitacoes_components/GerenciadasPage';
import { AnaliseEditaisPage } from './licitacoes_components/AnaliseEditaisPage';
import { EditaisAnalisadosPage } from './licitacoes_components/EditaisAnalisadosPage';
import { PipelineMonitor } from './licitacoes_components/PipelineMonitor';
import { ThemeProvider } from './licitacoes_components/context/ThemeContext';
import { ThemeToggle } from './licitacoes_components/ThemeToggle';
import './licitacoes_components/BuscarEditaisExecutive.css';

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function BuscarEditais() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('search');
  const [fichaParaBancada, setFichaParaBancada] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { 
      id: 'analytics', 
      name: 'Dashboard Geral', 
      subtitle: 'Visão consolidada de indicadores',
      icon: BarChart 
    },
    { 
      id: 'search', 
      name: 'Buscar Editais', 
      subtitle: 'Busca avançada PNCP + filtros',
      icon: Search 
    },
    { 
      id: 'analise', 
      name: 'Análise de Editais/TR', 
      subtitle: 'Extração automatizada e inteligência',
      icon: FileText 
    },
    { 
      id: 'analisados', 
      name: 'Editais Analisados', 
      subtitle: 'Fichas técnicas e matrizes de risco',
      icon: FileCheck 
    },
    { 
      id: 'gerenciadas', 
      name: 'Licitações Gerenciadas', 
      subtitle: 'Kanban, propostas e histórico',
      icon: Briefcase 
    },
    { 
      id: 'alerts', 
      name: 'Meus Alertas', 
      subtitle: 'Monitoramento contínuo em tempo real',
      icon: Bell 
    },
    { 
      id: 'pipeline', 
      name: 'Configurações',
      subtitle: 'Produtos de TI e fontes de busca',
      icon: Settings 
    },
  ];

  return (
    <ThemeProvider>
      <div className="nex-b2g-shell relative flex h-full text-[var(--crm-ink)] overflow-hidden">
        {/* Backdrop escurecido no mobile */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Executiva B2G (padrão NEXOS v3) */}
        <aside
          className={cn(
            "nex-b2g-sidebar fixed inset-y-0 left-0 z-50 w-[248px] flex flex-col h-full transition-transform duration-300 ease-in-out",
            "lg:static lg:translate-x-0 lg:flex-shrink-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Brand */}
          <div className="p-3.5 border-b border-cyan-500/15 flex items-center justify-between">
            <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-900/70 border border-cyan-500/25 flex-1 mr-2 shadow-[0_0_16px_rgba(6,182,212,0.12)]">
              <div className="relative flex items-center justify-center w-8 h-5 shrink-0">
                <div className="absolute left-0 w-4.5 h-4.5 rounded-full border-2 border-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                <div className="absolute right-0 w-4.5 h-4.5 rounded-full border-2 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <div className="relative z-10 w-3 h-3 rounded-full bg-slate-950 border border-cyan-300/70 flex items-center justify-center text-[5.5px] font-black text-white">
                  AI
                </div>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-xs tracking-tight text-white leading-tight truncate">
                  ChorstConsult
                </span>
                <span className="text-[9px] font-extrabold tracking-[0.2em] text-cyan-400 uppercase leading-none mt-0.5">
                  GOVFLOW B2G
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700"
              aria-label="Fechar menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          
          {/* Botão de Voltar ao CRM */}
          <div className="px-3 pt-3">
            <button
              onClick={() => navigate('/b2g-dashboard')}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500/15 to-blue-600/15 hover:from-cyan-500/25 hover:to-blue-600/25 border border-cyan-400/35 hover:border-cyan-300/70 text-cyan-200 hover:text-white transition-all text-[11px] font-extrabold tracking-wider uppercase cursor-pointer group shadow-[0_0_16px_rgba(6,182,212,0.12)]"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Voltar ao CRM</span>
            </button>
          </div>
          
          {/* Navigation Cards */}
          <div className="flex-1 py-3 px-2.5 space-y-1.5 overflow-y-auto custom-scrollbar">
            <div className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.18em] text-cyan-400/75">
              Módulos de Editais
            </div>
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentView(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "nex-b2g-nav-item w-full rounded-xl py-2.5 px-2.5 flex items-center gap-2.5 text-left cursor-pointer group",
                    isActive && "is-active"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-gradient-to-b from-cyan-400 to-blue-500 rounded-r-full shadow-[0_0_8px_#22d3ee]" />
                  )}

                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                    isActive
                      ? "bg-cyan-500/20 border border-cyan-400/60 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.28)]"
                      : "bg-slate-900/80 text-cyan-400/80 border border-slate-700/70 group-hover:border-cyan-500/40 group-hover:text-cyan-300"
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-xs font-bold leading-tight truncate",
                      isActive ? "text-white" : "text-slate-200 group-hover:text-white"
                    )}>
                      {item.name}
                    </div>
                    <div className={cn(
                      "text-[10px] leading-tight mt-0.5 truncate",
                      isActive ? "text-cyan-200/90" : "text-slate-400 group-hover:text-cyan-200/75"
                    )}>
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-cyan-500/15 bg-slate-950/60">
            <ThemeToggle className="mb-2.5 w-full" />
            <div className="flex items-center justify-between px-1 text-[9.5px] text-slate-400 font-semibold">
              <span>DOUBLE TI &amp; TELECOM</span>
              <span className="text-cyan-400">v3 • © 2026</span>
            </div>
          </div>
        </aside>

        {/* Main Content com fundo temático de governo */}
        <main className="relative z-10 flex-1 min-w-0 flex flex-col overflow-hidden bg-transparent">
          {/* Header Mobile com Hamburger */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[rgb(var(--crm-surface-rgb)_/_0.95)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_0.95)] border-b border-[var(--crm-border)] shrink-0 z-20 shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-xl bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:border-cyan-400"
                aria-label="Abrir menu de módulos"
              >
                <Menu className="w-5 h-5 text-cyan-700 dark:text-cyan-400" />
              </button>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">Licitações B2G</div>
                <div className="text-sm font-black truncate text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  {navigation.find(n => n.id === currentView)?.name || 'Buscar Editais'}
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate('/b2g-dashboard')}
              className="text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1 shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar
            </button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto">
            {currentView === 'analytics' && (
              <AnalyticsDashboard onNavigate={(view) => setCurrentView(view)} />
            )}
            {currentView === 'search' && <SearchPage onNavigateToPipeline={() => setCurrentView('pipeline')} />}
            {currentView === 'analise' && (
              <AnaliseEditaisPage 
                onNavigateToSearch={() => setCurrentView('search')} 
                onNavigateToAnalisados={() => setCurrentView('analisados')}
                initialFicha={fichaParaBancada}
                onClearInitialFicha={() => setFichaParaBancada(null)}
              />
            )}
            {currentView === 'analisados' && (
              <EditaisAnalisadosPage 
                onOpenInWorkbench={(ficha) => {
                  setFichaParaBancada(ficha);
                  setCurrentView('analise');
                }}
                onNavigateToAnalise={(ficha) => {
                  if (ficha) {
                    setFichaParaBancada(ficha);
                  }
                  setCurrentView('analise');
                }}
                onNavigateToSearch={() => setCurrentView('search')}
              />
            )}
            {currentView === 'gerenciadas' && <GerenciadasPage onNavigateToSearch={() => setCurrentView('search')} />}
            {currentView === 'alerts' && <AlertsPage />}
            {currentView === 'pipeline' && <PipelineMonitor />}
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
