import { useState, lazy, Suspense, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthProvider } from '@/hooks/use-auth';
import {
  Calculator, BarChart3, ChevronDown, ChevronRight,
  Phone, Server, Wifi, Radio, Network, Calendar,
  ArrowLeft, FileText
} from 'lucide-react';

// Importar componentes REAIS do SimuladoresDoublev2
const DashboardView        = lazy(() => import('@/components/dashboard/DashboardView'));
const CalculatorsMenuView  = lazy(() => import('@/components/dashboard/CalculatorsMenuView'));
const ProposalsView        = lazy(() => import('@/components/proposals/ProposalsView'));
const CommercialProposalView = lazy(() => import('@/components/commercial-proposal/CommercialProposalView'));

// Calculadoras — todas aceitam initialProposalId para abrir em modo edição
const PABXSIPCalculator          = lazy(() => import('@/components/calculators/PABXSIPCalculator'));
const MaquinasVirtuaisCalculator = lazy(() => import('@/components/calculators/MaquinasVirtuaisCalculator'));
const InternetFibraCalculator    = lazy(() => import('@/components/calculators/InternetFibraCalculator'));
const InternetRadioCalculator    = lazy(() => import('@/components/calculators/InternetRadioCalculator'));
const DoubleFibraRadioCalculator = lazy(() => import('@/components/calculators/DoubleFibraRadioCalculator'));
const InternetManCalculator      = lazy(() => import('@/components/calculators/InternetManCalculator'));
const InternetManRadioCalculator = lazy(() => import('@/components/calculators/InternetManRadioCalculator'));
const SDWanCalculator            = lazy(() => import('@/components/calculators/SDWanCalculator'));
const EventosTICalculator        = lazy(() => import('@/components/calculators/EventosTICalculator'));

const LOADING = (
  <div className="flex items-center justify-center h-full min-h-[400px] text-white">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500 mx-auto mb-4" />
      <p className="text-slate-400">Carregando...</p>
    </div>
  </div>
);

// Mapa tab → id da view
const TAB_TO_VIEW = {
  'calculator-pabx-sip':          'calculator-pabx-sip',
  'calculator-maquinas-virtuais':  'calculator-maquinas-virtuais',
  'calculator-internet-fibra':     'calculator-internet-fibra',
  'calculator-internet-radio':     'calculator-internet-radio',
  'calculator-internet-ok-v2':     'calculator-internet-ok-v2',
  'calculator-internet-man':       'calculator-internet-man',
  'calculator-internet-man-radio': 'calculator-internet-man-radio',
  'calculator-sd-wan':             'calculator-sd-wan',
  'calculator-eventos-ti':         'calculator-eventos-ti',
};

export default function Simuladores() {
  const navigate      = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [currentView, setCurrentView]             = useState('dashboard');
  const [proposalId,  setProposalId]              = useState(null);
  const [isPrecificacaoOpen, setIsPrecificacaoOpen] = useState(false);

  // Ao montar, verificar se há ?tab= e ?proposalId= na URL
  useEffect(() => {
    const tab  = searchParams.get('tab');
    const pid  = searchParams.get('proposalId');
    if (tab && TAB_TO_VIEW[tab]) {
      setCurrentView(TAB_TO_VIEW[tab]);
      setIsPrecificacaoOpen(true);
      if (pid) setProposalId(pid);
      // Limpar query string sem causar reload
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const userRole = useMemo(() => {
    try {
      const u = localStorage.getItem('user');
      return ((u ? JSON.parse(u) : null)?.role || '').toUpperCase();
    } catch { return 'USER'; }
  }, []);

  const calculadoras = [
    { id: 'calculator-pabx-sip',          nome: 'PABX/SIP',              icon: Phone },
    { id: 'calculator-maquinas-virtuais',  nome: 'Máquinas Virtuais',     icon: Server },
    { id: 'calculator-internet-fibra',     nome: 'Internet Fibra',        icon: Wifi },
    { id: 'calculator-internet-radio',     nome: 'Internet Radio',        icon: Radio },
    { id: 'calculator-internet-ok-v2',     nome: 'Double-Fibra/Radio',    icon: Wifi },
    { id: 'calculator-internet-man',       nome: 'Rede Man/MPLS Fibra',   icon: Wifi },
    { id: 'calculator-internet-man-radio', nome: 'Rede Man/MPLS Radio',   icon: Wifi },
    { id: 'calculator-sd-wan',             nome: 'Rede SD-WAN',           icon: Network },
    { id: 'calculator-eventos-ti',         nome: 'Eventos TI (Link & Wi-Fi)', icon: Calendar },
  ];

  // Ao navegar para uma calculadora a partir de uma proposta, guardar o proposalId
  const goToCalculator = (viewId, pid = null) => {
    setCurrentView(viewId);
    setProposalId(pid);
    setIsPrecificacaoOpen(true);
  };

  const renderContent = () => {
    // Props comuns para todas as calculadoras
    const calcProps = (backView = 'calculadoras') => ({
      onBack:            () => { setCurrentView(backView); setProposalId(null); },
      initialProposalId: proposalId || null,
    });

    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'calculadoras':
        return <CalculatorsMenuView onNavigateToCalculator={(id) => goToCalculator(id)} />;
      case 'propostas':
        return <ProposalsView proposals={[]} partners={[]} onSave={() => {}} onDelete={() => {}} />;
      case 'proposta-comercial':
        return (
          <div className="min-h-screen bg-slate-900">
            <CommercialProposalView
              initialProposalId={proposalId}
              onBack={() => { setCurrentView('dashboard'); setProposalId(null); }}
            />
          </div>
        );
      case 'calculator-pabx-sip':
        return <PABXSIPCalculator {...calcProps()} />;
      case 'calculator-maquinas-virtuais':
        return <MaquinasVirtuaisCalculator {...calcProps()} />;
      case 'calculator-internet-fibra':
        return <InternetFibraCalculator {...calcProps()} />;
      case 'calculator-internet-radio':
        return <InternetRadioCalculator {...calcProps()} />;
      case 'calculator-internet-ok-v2':
        return <DoubleFibraRadioCalculator {...calcProps()} />;
      case 'calculator-internet-man':
        return <InternetManCalculator {...calcProps()} />;
      case 'calculator-internet-man-radio':
        return <InternetManRadioCalculator {...calcProps()} />;
      case 'calculator-sd-wan':
        return <SDWanCalculator {...calcProps()} />;
      case 'calculator-eventos-ti':
        return <EventosTICalculator {...calcProps()} />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

        {/* ── Menu Lateral ── */}
        <aside className="w-72 bg-slate-900/95 border-r border-slate-700/50 flex flex-col shrink-0">

          <div className="p-5 border-b border-slate-700/50">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 transition-colors mb-4 group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-sm font-medium">Voltar para CRM</span>
            </button>
            <h1 className="text-xl font-bold text-white">Simuladores</h1>
            <p className="text-slate-400 text-xs mt-0.5">Dashboard, Precificação e Propostas</p>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">

            {/* Dashboard */}
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                currentView === 'dashboard'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">Dashboard</span>
            </button>

            {/* Calculadoras dropdown */}
            <div>
              <button
                onClick={() => setIsPrecificacaoOpen(o => !o)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                  currentView === 'calculadoras' || currentView.startsWith('calculator-')
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-300 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Calculator className="w-5 h-5 flex-shrink-0" />
                  <span className="font-medium">Calculadoras</span>
                </div>
                {isPrecificacaoOpen
                  ? <ChevronDown className="w-4 h-4" />
                  : <ChevronRight className="w-4 h-4" />}
              </button>

              {isPrecificacaoOpen && (
                <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-slate-700/50 pl-2">
                  {calculadoras.map(({ id, nome, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => goToCalculator(id)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                        currentView === id
                          ? 'bg-cyan-500/20 text-cyan-300'
                          : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{nome}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Proposta Comercial */}
            <button
              onClick={() => setCurrentView('proposta-comercial')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                currentView === 'proposta-comercial'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              <FileText className="w-5 h-5 flex-shrink-0" />
              <span className="font-medium">Proposta Comercial</span>
            </button>

          </nav>
        </aside>

        {/* ── Conteúdo Principal ── */}
        <main className="precificacao-module flex-1 overflow-auto">
          <Suspense fallback={LOADING}>
            {renderContent()}
          </Suspense>
        </main>

      </div>
    </AuthProvider>
  );
}
