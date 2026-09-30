/**
 * BuscarEditais.jsx
 * Módulo completo de Licitações B2G - 100% baseado em licitacoes_codigo
 * Com tema dark/teal customizado
 */
import { useState, useEffect } from 'react';
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

const cn = (...classes) => classes.filter(Boolean).join(' ');

export default function BuscarEditais() {
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState('search');
  const [fichaParaBancada, setFichaParaBancada] = useState(null);

  // Forçar tema dark ao montar
  useEffect(() => {
    try {
      localStorage.setItem('licitacoes_app_theme', 'dark');
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } catch (e) {
      console.warn('Erro ao forçar tema dark:', e);
    }
  }, []);

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
      name: 'Configurações (Pipeline)', 
      subtitle: 'Status dos workers e sincronização',
      icon: Settings 
    },
  ];

  return (
    <ThemeProvider>
      <div className="flex h-full bg-[#011116] text-slate-100 overflow-hidden dark">
        {/* Sidebar com tema escuro/teal */}
        <aside className="w-72 flex flex-col h-full flex-shrink-0 bg-[#011015] border-r border-[#07323e] shadow-xl">
          {/* Brand */}
          <div className="p-4 border-b border-[#07323e]">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-[#02181f] border border-[#083d4a]">
              <div className="relative flex items-center justify-center w-9 h-6">
                <div className="absolute left-0 w-5 h-5 rounded-full border-2 border-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.4)]" />
                <div className="absolute right-0 w-5 h-5 rounded-full border-2 border-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
                <div className="relative z-10 w-3.5 h-3.5 rounded-full bg-[#011116] border border-cyan-300/60 flex items-center justify-center text-[6px] font-black text-white">
                  AI
                </div>
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs tracking-tight text-white leading-tight">
                  ChorstConsult
                </span>
                <span className="text-[9px] font-extrabold tracking-[0.2em] text-cyan-400 uppercase leading-none mt-0.5">
                  NEXOS AI
                </span>
              </div>
            </div>
          </div>
          
          {/* Botão de Voltar ao CRM */}
          <div className="px-3 pt-3">
            <button
              onClick={() => navigate('/b2g-dashboard')}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#02171d] hover:bg-[#03242c] border border-[#073541] hover:border-cyan-400 text-cyan-400 hover:text-white transition-all text-xs font-black tracking-wider uppercase cursor-pointer group shadow-md"
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
                      ? "bg-[#03242c] border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.15)] text-white font-semibold" 
                      : "bg-[#02171d] hover:bg-[#03222a] border border-[#073541] hover:border-[#0c4e5e] text-slate-200 hover:text-white"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-2 bottom-2 w-1 bg-cyan-400 rounded-r-full shadow-[0_0_6px_#22d3ee]" />
                  )}

                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                    isActive
                      ? "bg-[#01161d] border border-cyan-400 text-cyan-300"
                      : "bg-[#011419] text-cyan-400 border border-[#083540] group-hover:border-[#0c4a59] group-hover:text-cyan-300"
                  )}>
                    <Icon className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "text-xs font-bold leading-tight truncate",
                      isActive ? "text-white" : "text-white"
                    )}>
                      {item.name}
                    </div>
                    <div className={cn(
                      "text-[10px] leading-tight mt-0.5 truncate",
                      isActive ? "text-cyan-200" : "text-[#7bb0bc] group-hover:text-cyan-100"
                    )}>
                      {item.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-[#07323e] bg-[#011217]">
            <div className="flex items-center justify-between px-1 text-[9px] text-slate-500 font-medium">
              <span>DOUBLE TI & TELECOM</span>
              <span>v2 • © 2026</span>
            </div>
          </div>
        </aside>

        {/* Main Content com fundo escuro */}
        <main className="flex-1 overflow-hidden bg-gradient-to-br from-[#042027]/90 via-[#031a22]/90 to-[#011116]/95">
          {currentView === 'analytics' && (
            <AnalyticsDashboard onNavigate={(view) => setCurrentView(view)} />
          )}
          {currentView === 'search' && <SearchPage onNavigateToGerenciadas={() => setCurrentView('gerenciadas')} />}
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
          {currentView === 'gerenciadas' && <GerenciadasPage />}
          {currentView === 'alerts' && <AlertsPage />}
          {currentView === 'pipeline' && <PipelineMonitor />}
        </main>
      </div>
    </ThemeProvider>
  );
}
