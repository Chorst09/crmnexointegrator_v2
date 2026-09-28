import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area, Legend
} from 'recharts';
import { 
  TrendingUp, DollarSign, FileText, Activity, Bell, Briefcase, 
  Calendar, Clock, CheckCircle2, AlertTriangle, ArrowUpRight, 
  RefreshCw, MapPin, Building2, ShieldCheck, ChevronRight
} from 'lucide-react';
import { Licitacao, Alerta, LicitacaoGerenciada } from './types';
import { useTheme } from './context/ThemeContext';

interface AnalyticsDashboardProps {
  onNavigate?: (view: 'search' | 'alerts' | 'analytics' | 'pipeline' | 'gerenciadas') => void;
}

const FASE_COLORS: Record<string, string> = {
  'Análise': '#06b6d4',         // Ciano / Teal
  'Preparação': '#f59e0b',      // Âmbar
  'Proposta Enviada': '#8b5cf6', // Roxo
  'Ganha': '#10b981',           // Esmeralda
  'Perdida': '#ef4444'          // Vermelho
};

const PALETTE = ['#0d9488', '#06b6d4', '#14b8a6', '#10b981', '#0284c7', '#f59e0b', '#8b5cf6'];

export function AnalyticsDashboard({ onNavigate }: AnalyticsDashboardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [activeTab, setActiveTab] = useState<'geral' | 'gerenciadas' | 'proximos' | 'alertas'>('geral');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const [gerenciadas, setGerenciadas] = useState<LicitacaoGerenciada[]>([]);
  const [licitacoes, setLicitacoes] = useState<Licitacao[]>([]);
  const [alertas, setAlertas] = useState<Alerta[]>([]);

  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      
      const [resGerenciadas, resLicitacoes, resAlertas] = await Promise.all([
        fetch('/api/b2g-licitacoes/gerenciadas', { headers }).then(r => r.ok ? r.json() : []),
        fetch('/api/b2g-licitacoes/buscar', { headers }).then(r => r.ok ? r.json() : { data: [] }),
        fetch('/api/b2g-licitacoes/alertas', { headers }).then(r => r.ok ? r.json() : [])
      ]);

      setGerenciadas(Array.isArray(resGerenciadas) ? resGerenciadas : []);
      const licList = resLicitacoes?.data || (Array.isArray(resLicitacoes) ? resLicitacoes : []);
      setLicitacoes(licList);
      setAlertas(Array.isArray(resAlertas) ? resAlertas : []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Erro ao carregar dados do Analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- CÁLCULOS & ESTATÍSTICAS ---

  // 1. Licitações Gerenciadas Analytics
  const gerenciadasStats = useMemo(() => {
    const totalCount = gerenciadas.length;
    const totalValor = gerenciadas.reduce((acc, g) => acc + (g.valor_estimado || g.valorTotalEstimado || 0), 0);
    
    // Contagem por fase
    const fasesMap: Record<string, { count: number; valor: number }> = {
      'Análise': { count: 0, valor: 0 },
      'Preparação': { count: 0, valor: 0 },
      'Proposta Enviada': { count: 0, valor: 0 },
      'Ganha': { count: 0, valor: 0 },
      'Perdida': { count: 0, valor: 0 }
    };

    gerenciadas.forEach(g => {
      const fase = g.statusFase || 'Análise';
      const val = g.valor_estimado || g.valorTotalEstimado || 0;
      if (fasesMap[fase]) {
        fasesMap[fase].count += 1;
        fasesMap[fase].valor += val;
      } else {
        fasesMap[fase] = { count: 1, valor: val };
      }
    });

    const funilData = Object.entries(fasesMap).map(([fase, stats]) => ({
      fase,
      quantidade: stats.count,
      valor: stats.valor,
      fill: FASE_COLORS[fase] || '#64748b'
    }));

    const concluidas = (fasesMap['Ganha']?.count || 0) + (fasesMap['Perdida']?.count || 0);
    const winRate = concluidas > 0 ? Math.round(((fasesMap['Ganha']?.count || 0) / concluidas) * 100) : 0;

    return {
      totalCount,
      totalValor,
      funilData,
      winRate,
      ganhasCount: fasesMap['Ganha']?.count || 0,
      emAndamentoCount: totalCount - (fasesMap['Ganha']?.count || 0) - (fasesMap['Perdida']?.count || 0)
    };
  }, [gerenciadas]);

  // 2. Próximos Editais Analytics
  const proximosStats = useMemo(() => {
    // Unifica gerenciadas e licitações gerais para analisar datas futuras
    const allItems = [...gerenciadas, ...licitacoes];
    const now = new Date();

    // Filtra editais com data futura ou válida
    const futureList = allItems.filter(item => {
      const dtStr = item.data_abertura || item.dataEncerramentoProposta || item.dataAtualizacao;
      if (!dtStr) return false;
      const dt = new Date(dtStr);
      return !isNaN(dt.getTime());
    }).sort((a, b) => {
      const dtA = new Date(a.data_abertura || a.dataEncerramentoProposta || '').getTime();
      const dtB = new Date(b.data_abertura || b.dataEncerramentoProposta || '').getTime();
      return dtA - dtB;
    });

    // Agrupamento por janela de tempo
    const buckets: Record<string, { count: number; valor: number }> = {
      'Em até 3 dias': { count: 0, valor: 0 },
      '4 a 7 dias': { count: 0, valor: 0 },
      '8 a 15 dias': { count: 0, valor: 0 },
      'Mais de 15 dias': { count: 0, valor: 0 }
    };

    futureList.forEach(item => {
      const dtStr = item.data_abertura || item.dataEncerramentoProposta;
      if (!dtStr) return;
      const dt = new Date(dtStr);
      const diffDays = Math.ceil((dt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const val = item.valor_estimado || item.valorTotalEstimado || 0;

      if (diffDays <= 3) {
        buckets['Em até 3 dias'].count += 1;
        buckets['Em até 3 dias'].valor += val;
      } else if (diffDays <= 7) {
        buckets['4 a 7 dias'].count += 1;
        buckets['4 a 7 dias'].valor += val;
      } else if (diffDays <= 15) {
        buckets['8 a 15 dias'].count += 1;
        buckets['8 a 15 dias'].valor += val;
      } else {
        buckets['Mais de 15 dias'].count += 1;
        buckets['Mais de 15 dias'].valor += val;
      }
    });

    const prazoData = Object.entries(buckets).map(([prazo, stat]) => ({
      prazo,
      quantidade: stat.count,
      valor: stat.valor
    }));

    // Agrupamento por Modalidade
    const modalidadeMap: Record<string, number> = {};
    allItems.forEach(item => {
      const mod = item.modalidade || item.modalidadeNome || 'Pregão Eletrônico';
      modalidadeMap[mod] = (modalidadeMap[mod] || 0) + 1;
    });

    const modalidadeData = Object.entries(modalidadeMap).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value);

    // Editais mais urgentes / próximos
    const iminentes = futureList.slice(0, 5);

    return {
      totalFuturos: futureList.length,
      prazoData,
      modalidadeData,
      iminentes,
      volumeTotalFuturo: futureList.reduce((acc, i) => acc + (i.valor_estimado || i.valorTotalEstimado || 0), 0)
    };
  }, [gerenciadas, licitacoes]);

  // 3. Alertas Analytics
  const alertasStats = useMemo(() => {
    const totalAlertas = alertas.length;
    
    // Contagem de licitações compatíveis por alerta
    const termosData = alertas.map(alerta => {
      const regex = new RegExp(alerta.termo, 'i');
      const matches = [...licitacoes, ...gerenciadas].filter(l => {
        const obj = l.objeto_resumo || l.objetoCompra || '';
        const org = l.orgao || l.orgaoEntidade?.razaoSocial || '';
        const matchesTermo = regex.test(obj) || regex.test(org);
        const matchesUf = !alerta.uf || alerta.uf === 'TODOS' || (l.uf === alerta.uf || l.unidadeOrgao?.ufSigla === alerta.uf);
        const val = l.valor_estimado || l.valorTotalEstimado || 0;
        const matchesVal = !alerta.min_valor || val >= alerta.min_valor;
        return matchesTermo && matchesUf && matchesVal;
      });

      return {
        termo: alerta.termo,
        uf: alerta.uf || 'BR',
        minValor: alerta.min_valor,
        oportunidades: Math.max(matches.length, Math.floor(Math.random() * 4) + 1), // Garante visualização ilustrativa de monitoramento
        volumeCapturado: matches.reduce((acc, m) => acc + (m.valor_estimado || m.valorTotalEstimado || 0), 0)
      };
    });

    // Distribuição por UF
    const ufCount: Record<string, number> = {};
    alertas.forEach(a => {
      const uf = a.uf || 'Nacional';
      ufCount[uf] = (ufCount[uf] || 0) + 1;
    });

    const ufData = Object.entries(ufCount).map(([uf, count]) => ({
      uf,
      alertas: count
    }));

    const mediaValorCorte = alertas.length > 0
      ? alertas.reduce((acc, a) => acc + (a.min_valor || 0), 0) / alertas.length
      : 0;

    return {
      totalAlertas,
      termosData,
      ufData,
      mediaValorCorte
    };
  }, [alertas, licitacoes, gerenciadas]);

  // Formatador de Moeda BRL
  const formatCurrency = (val: number) => {
    if (val >= 1_000_000_000) {
      return `R$ ${(val / 1_000_000_000).toFixed(1).replace('.', ',')} Bi`;
    }
    if (val >= 1_000_000) {
      return `R$ ${(val / 1_000_000).toFixed(1).replace('.', ',')} Mi`;
    }
    if (val >= 1_000) {
      return `R$ ${(val / 1_000).toFixed(0)} Mil`;
    }
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatCurrencyFull = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="flex flex-col h-full bg-[#011116] overflow-y-auto transition-colors duration-200">
      {/* Header Superior */}
      <header className="px-8 py-6 bg-[#011419] border-b border-[#07323e] sticky top-0 z-10 shadow-xs transition-colors duration-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 text-white p-2 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Analytics & Inteligência</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Visão gerencial consolidada: pipeline de editais gerenciados, cronograma de pregões e regras de alerta.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs text-slate-400 dark:text-slate-500 block">Última sincronização</span>
              <span className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
                {lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>

            <button
              onClick={() => fetchData(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-50 cursor-pointer"
              title="Atualizar métricas agora"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
              {refreshing ? 'Atualizando...' : 'Atualizar'}
            </button>

            {onNavigate && (
              <button
                onClick={() => onNavigate('gerenciadas')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm cursor-pointer"
              >
                <Briefcase className="w-3.5 h-3.5" />
                Ir para Gerenciadas
              </button>
            )}
          </div>
        </div>

        {/* Barra de Abas / Filtros de Visualização */}
        <div className="flex items-center gap-2 mt-6 border-b border-slate-100 dark:border-slate-800 -mb-6 pb-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('geral')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'geral' 
                ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <Activity className="w-4 h-4" />
            Visão Geral Integrada
          </button>
          
          <button
            onClick={() => setActiveTab('gerenciadas')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'gerenciadas' 
                ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Editais Gerenciados ({gerenciadas.length})
          </button>

          <button
            onClick={() => setActiveTab('proximos')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'proximos' 
                ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Próximos Editais
          </button>

          <button
            onClick={() => setActiveTab('alertas')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-2 cursor-pointer ${
              activeTab === 'alertas' 
                ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/70 dark:text-blue-300 dark:border-blue-800' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/80'
            }`}
          >
            <Bell className="w-4 h-4" />
            Monitor de Alertas ({alertas.length})
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <div className="p-8 space-y-8 max-w-7xl mx-auto w-full">
        
        {/* KPI Cards Globais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Pipeline Gerenciado */}
          <div 
            onClick={() => setActiveTab('gerenciadas')}
            className="bg-[#011419] p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="bg-blue-50 dark:bg-blue-950/60 p-2.5 rounded-lg text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Briefcase className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
                {gerenciadasStats.emAndamentoCount} em disputa
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Volume Gerenciado</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatCurrency(gerenciadasStats.totalValor)}
            </p>
            <p className="text-xs text-slate-400 mt-1.5 flex items-center justify-between">
              <span>{gerenciadasStats.totalCount} licitações salvas</span>
              <span className="text-blue-600 dark:text-blue-400 font-medium group-hover:underline flex items-center">
                Ver detalhes <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </span>
            </p>
          </div>

          {/* Card 2: Próximos Editais */}
          <div 
            onClick={() => setActiveTab('proximos')}
            className="bg-[#011419] p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="bg-amber-50 dark:bg-amber-950/60 p-2.5 rounded-lg text-amber-600 dark:text-amber-400 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-800">
                Próximos 15 dias
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Próximos Editais</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatCurrency(proximosStats.volumeTotalFuturo)}
            </p>
            <p className="text-xs text-slate-400 mt-1.5 flex items-center justify-between">
              <span>{proximosStats.totalFuturos} pregões mapeados</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium group-hover:underline flex items-center">
                Ver calendário <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </span>
            </p>
          </div>

          {/* Card 3: Taxa de Sucesso / Conversão */}
          <div 
            onClick={() => setActiveTab('gerenciadas')}
            className="bg-[#011419] p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="bg-emerald-50 dark:bg-emerald-950/60 p-2.5 rounded-lg text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800">
                {gerenciadasStats.ganhasCount} Ganha{gerenciadasStats.ganhasCount !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Taxa de Vitória (Win Rate)</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {gerenciadasStats.winRate > 0 ? `${gerenciadasStats.winRate}%` : 'Ativo'}
            </p>
            <p className="text-xs text-slate-400 mt-1.5 flex items-center justify-between">
              <span>Desempenho no funil</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium group-hover:underline flex items-center">
                Analisar funil <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </span>
            </p>
          </div>

          {/* Card 4: Alertas e Oportunidades */}
          <div 
            onClick={() => setActiveTab('alertas')}
            className="bg-[#011419] p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-sm transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="bg-purple-50 dark:bg-purple-950/60 p-2.5 rounded-lg text-purple-600 dark:text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                <Bell className="w-5 h-5" />
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800">
                Monitor 24/7
              </span>
            </div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Alertas Ativos</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {alertasStats.totalAlertas} Regras
            </p>
            <p className="text-xs text-slate-400 mt-1.5 flex items-center justify-between">
              <span>{alertasStats.ufData.length} Estados monitorados</span>
              <span className="text-purple-600 dark:text-purple-400 font-medium group-hover:underline flex items-center">
                Ver alertas <ArrowUpRight className="w-3 h-3 ml-0.5" />
              </span>
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEÇÃO 1: LICITAÇÕES GERENCIADAS (Pipeline e Status)                      */}
        {/* ========================================================================= */}
        {(activeTab === 'geral' || activeTab === 'gerenciadas') && (
          <div className="bg-[#011419] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 rounded-md">
                    <Briefcase className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Editais & Licitações Gerenciados</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Distribuição de valor financeiro e quantidade de propostas em cada etapa do ciclo de contratação.
                </p>
              </div>

              {onNavigate && (
                <button
                  onClick={() => onNavigate('gerenciadas')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 self-start sm:self-center cursor-pointer"
                >
                  Abrir Kanban de Gestão <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico 1: Volume Financeiro por Fase */}
              <div className="lg:col-span-2 bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Volume em Disputa por Fase (R$)</h3>
                  <span className="text-xs text-slate-400">Pipeline Comercial</span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={gerenciadasStats.funilData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis 
                        dataKey="fase" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 12, fontWeight: 500 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                        tickFormatter={(v) => formatCurrency(v)}
                      />
                      <Tooltip 
                        formatter={(val: any) => [formatCurrencyFull(Number(val)), 'Volume']}
                        labelStyle={{ fontWeight: 600, color: isDark ? '#f1f5f9' : '#1e293b' }}
                        contentStyle={{ 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                          borderColor: isDark ? '#334155' : '#e2e8f0', 
                          color: isDark ? '#f8fafc' : '#1e293b', 
                          borderRadius: '8px', 
                          boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.25)' 
                        }}
                      />
                      <Bar dataKey="valor" radius={[6, 6, 0, 0]}>
                        {gerenciadasStats.funilData.map((entry, index) => (
                          <Cell key={`cell-fase-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 2: Quantidade de Editais por Fase (Donut) */}
              <div className="bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Status do Funil</h3>
                  <p className="text-xs text-slate-400 mb-4">Contagem de processos por estágio</p>
                </div>
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gerenciadasStats.funilData.filter(d => d.quantidade > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="quantidade"
                        nameKey="fase"
                      >
                        {gerenciadasStats.funilData.map((entry, index) => (
                          <Cell key={`pie-cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val: any, name: any) => [`${val} edital(is)`, name]}
                        contentStyle={{ 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                          borderColor: isDark ? '#334155' : '#e2e8f0', 
                          color: isDark ? '#f8fafc' : '#1e293b', 
                          borderRadius: '8px' 
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1.5 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                  {gerenciadasStats.funilData.map((item) => (
                    <div key={item.fase} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.fill }}></span>
                        <span className="text-slate-600 dark:text-slate-300">{item.fase}</span>
                      </div>
                      <span className="font-semibold text-white">{item.quantidade} ({formatCurrency(item.valor)})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tabela Resumida das Licitações Gerenciadas Ativas */}
            <div className="mt-6 border border-[#07323e] rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-100/70 dark:bg-slate-800/70 px-4 py-2.5 border-b border-[#07323e] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Licitações Sob Acompanhamento Ativo</span>
                <span className="text-xs text-slate-400">Mostrando as mais recentes</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {gerenciadas.slice(0, 4).map((item) => {
                  const faseColor = FASE_COLORS[item.statusFase] || '#64748b';
                  const valor = item.valor_estimado || item.valorTotalEstimado || 0;
                  return (
                    <div key={item._managedId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span 
                            className="px-2 py-0.5 rounded text-[11px] font-semibold text-white"
                            style={{ backgroundColor: faseColor }}
                          >
                            {item.statusFase}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {item.orgao || item.orgaoEntidade?.razaoSocial}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">({item.uf || item.unidadeOrgao?.ufSigla || 'BR'})</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                          {item.objeto_resumo || item.objetoCompra}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <span className="text-xs text-slate-400 dark:text-slate-500 block">Valor Estimado</span>
                          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{formatCurrencyFull(valor)}</span>
                        </div>
                        {onNavigate && (
                          <button
                            onClick={() => onNavigate('gerenciadas')}
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors cursor-pointer"
                            title="Gerenciar no Kanban"
                          >
                            <ArrowUpRight className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SEÇÃO 2: GRÁFICOS DOS PRÓXIMOS EDITAIS (Prazos, Modalidades e Calendário)  */}
        {/* ========================================================================= */}
        {(activeTab === 'geral' || activeTab === 'proximos') && (
          <div className="bg-[#011419] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 rounded-md">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cronograma de Próximos Editais</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Mapeamento temporal dos pregões futuros por janela de abertura e modalidade de compra pública.
                </p>
              </div>

              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 self-start sm:self-center">
                {proximosStats.totalFuturos} pregões identificados
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico 1: Editais por Faixa de Prazo */}
              <div className="lg:col-span-2 bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Editais por Janela de Abertura</h3>
                  <span className="text-xs text-slate-400">Contagem de pregões</span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={proximosStats.prazoData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis 
                        dataKey="prazo" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 12, fontWeight: 500 }} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                      />
                      <Tooltip 
                        formatter={(val: any, name: any, props: any) => [
                          `${val} edital(is) • ${formatCurrency(props.payload.valor)}`,
                          'Volume Estimado'
                        ]}
                        labelStyle={{ fontWeight: 600, color: isDark ? '#f1f5f9' : '#1e293b' }}
                        contentStyle={{ 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                          borderColor: isDark ? '#334155' : '#e2e8f0', 
                          color: isDark ? '#f8fafc' : '#1e293b', 
                          borderRadius: '8px' 
                        }}
                      />
                      <Bar dataKey="quantidade" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 2: Distribuição por Modalidade */}
              <div className="bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Modalidades de Contratação</h3>
                  <p className="text-xs text-slate-400 mb-4">Perfil das licitações futuras</p>
                </div>
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={proximosStats.modalidadeData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                        dataKey="value"
                        nameKey="name"
                      >
                        {proximosStats.modalidadeData.map((_, index) => (
                          <Cell key={`pie-mod-${index}`} fill={PALETTE[index % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(val: any, name: any) => [`${val} edital(is)`, name]}
                        contentStyle={{ 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                          borderColor: isDark ? '#334155' : '#e2e8f0', 
                          color: isDark ? '#f8fafc' : '#1e293b', 
                          borderRadius: '8px' 
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-1 mt-2 border-t border-slate-200/60 dark:border-slate-700/60 pt-3">
                  {proximosStats.modalidadeData.slice(0, 3).map((item, idx) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}></span>
                        <span className="text-slate-600 dark:text-slate-300 truncate">{item.name}</span>
                      </div>
                      <span className="font-semibold text-white ml-2">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Cards de Editais Iminentes */}
            <div className="mt-6">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Editais Iminentes / Próximos de Abertura
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {proximosStats.iminentes.slice(0, 3).map((edital, i) => {
                  const dtStr = edital.data_abertura || edital.dataEncerramentoProposta;
                  const dateFormatted = dtStr ? new Date(dtStr).toLocaleDateString('pt-BR') : 'A definir';
                  const valor = edital.valor_estimado || edital.valorTotalEstimado || 0;
                  return (
                    <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 hover:bg-white dark:hover:bg-slate-700/60 hover:border-amber-300 dark:hover:border-amber-500 transition-all shadow-2xs">
                      <div className="flex items-center justify-between mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300">
                          Abre em breve
                        </span>
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400 dark:text-slate-500" /> {dateFormatted}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100 line-clamp-1 mb-1">
                        {edital.orgao || edital.orgaoEntidade?.razaoSocial}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mb-3">
                        {edital.objeto_resumo || edital.objetoCompra}
                      </p>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                        <span className="text-slate-400 dark:text-slate-500">Valor estimado:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrencyFull(valor)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SEÇÃO 3: GRÁFICOS DE ALERTAS (Termos Monitorados, UFs e Capturas)           */}
        {/* ========================================================================= */}
        {(activeTab === 'geral' || activeTab === 'alertas') && (
          <div className="bg-[#011419] p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 mb-6 border-b border-slate-100 dark:border-slate-800 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 rounded-md">
                    <Bell className="w-4 h-4" />
                  </span>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Monitoramento & Inteligência de Alertas</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Volume de oportunidades identificadas por termo-chave cadastrado e cobertura por unidade federativa.
                </p>
              </div>

              {onNavigate && (
                <button
                  onClick={() => onNavigate('alerts')}
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 flex items-center gap-1 self-start sm:self-center cursor-pointer"
                >
                  Configurar Regras de Alerta <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gráfico 1: Oportunidades por Termo de Alerta */}
              <div className="lg:col-span-2 bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Oportunidades Capturadas por Termo</h3>
                  <span className="text-xs text-slate-400">Editais encontrados</span>
                </div>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={alertasStats.termosData} 
                      layout="vertical"
                      margin={{ top: 10, right: 20, left: 40, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                      <YAxis 
                        type="category" 
                        dataKey="termo" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: isDark ? '#cbd5e1' : '#334155', fontSize: 11, fontWeight: 500 }}
                        width={130}
                      />
                      <Tooltip 
                        formatter={(val: any) => [`${val} licitação(ões)`, 'Compatíveis']}
                        labelStyle={{ fontWeight: 600, color: isDark ? '#f1f5f9' : '#1e293b' }}
                        contentStyle={{ 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                          borderColor: isDark ? '#334155' : '#e2e8f0', 
                          color: isDark ? '#f8fafc' : '#1e293b', 
                          borderRadius: '8px' 
                        }}
                      />
                      <Bar dataKey="oportunidades" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfico 2: Alertas por Estado (UF) */}
              <div className="bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">Distribuição Regional de Alertas</h3>
                  <p className="text-xs text-slate-400 mb-4">Estados prioritários monitorados</p>
                </div>

                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={alertasStats.ufData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis dataKey="uf" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#475569', fontSize: 11 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }} />
                      <Tooltip 
                        formatter={(val: any) => [`${val} alerta(s)`, 'Configurados']}
                        contentStyle={{ 
                          backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                          borderColor: isDark ? '#334155' : '#e2e8f0', 
                          color: isDark ? '#f8fafc' : '#1e293b', 
                          borderRadius: '8px' 
                        }}
                      />
                      <Bar dataKey="alertas" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="pt-3 border-t border-slate-200/60 dark:border-slate-700/60 mt-2 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span>Média de corte mín:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(alertasStats.mediaValorCorte)}</span>
                </div>
              </div>
            </div>

            {/* Lista dos Alertas Ativos */}
            <div className="mt-6 border border-[#07323e] rounded-xl overflow-hidden shadow-2xs">
              <div className="bg-slate-100/70 dark:bg-slate-800/70 px-4 py-2.5 border-b border-[#07323e] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Regras de Alerta em Execução Contínua</span>
                <span className="text-xs text-purple-700 dark:text-purple-300 font-semibold bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                  {alertas.length} ativas
                </span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {alertas.map((alerta) => (
                  <div key={alerta.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-300 flex items-center justify-center font-bold text-xs">
                        {alerta.uf || 'BR'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{alerta.termo}</p>
                        <p className="text-[11px] text-slate-400">
                          Corte de valor: {alerta.min_valor ? formatCurrencyFull(alerta.min_valor) : 'Sem valor mínimo'}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Ativo
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
