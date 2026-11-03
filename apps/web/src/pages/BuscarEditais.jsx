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
  ArrowLeft
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

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function BuscarEditais() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('search');
  const [fichaParaBancada, setFichaParaBancada] = useState(null);

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
      <div className="flex h-full bg-[var(--crm-bg-base)] text-[var(--crm-ink)] overflow-hidden">
        {/* Sidebar com tema escuro/teal */}
        <aside className="w-72 flex flex-col h-full flex-shrink-0 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border-r border-[var(--crm-border)] dark:border-[var(--crm-border)] shadow-xl">
          {/* Brand */}
          <div className="p-4 border-b border-[var(--crm-border)] dark:border-[var(--crm-border)]">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
              <div className="relative flex items-center justify-center w-9 h-6">
                <div className="absolute left-0 w-5 h-5 rounded-full border-2 border-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]" />
                <div className="absolute right-0 w-5 h-5 rounded-full border-2 border-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                <div className="relative z-10 w-3.5 h-3.5 rounded-full bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-cyan-300/60 flex items-center justify-center text-[6px] font-black text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  AI
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs tracking-tight text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] leading-tight">
                  ChorstConsult
                </span>
                <span className="text-[9px] font-extrabold tracking-[0.2em] text-cyan-700 dark:text-cyan-400 uppercase leading-none mt-0.5">
                  NEXOS AI
                </span>
              </div>
            </div>
          </div>
          
          {/* Botão de Voltar ao CRM */}
          <div className="px-3 pt-3">
            <button
              onClick={() => navigate('/b2g-dashboard')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] dark:border-[var(--crm-border)] hover:border-cyan-400 text-cyan-700 dark:text-cyan-400 hover:text-[rgb(var(--crm-ink-rgb)_/_1)] transition-all text-xs font-black tracking-wider uppercase cursor-pointer group shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
              <span>Voltar ao CRM</span>
            </button>
          </div>
          
          {/* Navigation Cards */}
          <div className="flex-1 py-3 px-3 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = currentView === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={cn(
                    "relative w-full rounded-xl py-3 px-3 flex items-center gap-3 text-left transition-all cursor-pointer group",
                    isActive 
                      ? "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] font-semibold"
                      : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] dark:border-[var(--crm-border)] hover:border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-cyan-400 rounded-r-full shadow-[0_0_6px_#22d3ee]" />
                  )}

                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                    isActive
                      ? "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-cyan-400 text-cyan-700 dark:text-cyan-300"
                      : "bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-cyan-700 dark:text-cyan-400 border border-[var(--crm-border)] dark:border-[var(--crm-border)] group-hover:border-[var(--crm-border)] group-hover:text-cyan-700 dark:group-hover:text-cyan-300"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-xs font-bold leading-tight truncate",
                      isActive ? "text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]" : "text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                    )}>
                      {item.name}
                    </div>
                    <div className={cn(
                      "text-[10px] leading-tight mt-0.5 truncate",
                      isActive ? "text-cyan-700 dark:text-cyan-200" : "text-[#7bb0bc] group-hover:text-cyan-700 dark:group-hover:text-cyan-100"
                    )}>
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)]">
            <ThemeToggle className="mb-3 w-full" />
            <div className="flex items-center justify-between px-1 text-[9px] text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">
              <span>DOUBLE TI & TELECOM</span>
              <span>v2 • © 2026</span>
            </div>
          </div>
        </aside>

        {/* Main Content com fundo escuro */}
        <main className="flex-1 overflow-hidden bg-gradient-to-br from-[rgb(var(--crm-surface-2-rgb)_/_0.9)] via-[rgb(var(--crm-surface-2-rgb)_/_0.9)] to-[rgb(var(--crm-surface-2-rgb)_/_0.95)]">
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
        </main>
      </div>
    </ThemeProvider>
  );
}
