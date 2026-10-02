import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  Filter,
  Building2,
  Landmark,
  Calculator,
  Layers,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  Flame,
  Search,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Briefcase
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import PageHeader from '../components/PageHeader';
import GradientCard from '../components/GradientCard';
import ModernTable from '../components/ModernTable';

const AnaliseFinanceira = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Segmento Ativo: 'geral' | 'b2b' | 'b2g' | 'simulador'
  const [segmentoAtivo, setSegmentoAtivo] = useState('geral');

  // Sub-aba dentro da Visão Geral
  const [tabGeral, setTabGeral] = useState('resumo');

  // Filtros Globais
  const [periodo, setPeriodo] = useState('todos');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [vendedor, setVendedor] = useState('');

  // Filtros internos da tabela do Simulador
  const [simSearch, setSimSearch] = useState('');
  const [simTipoFiltro, setSimTipoFiltro] = useState('TODOS');
  const [simTempFiltro, setSimTempFiltro] = useState('TODOS');

  // Paleta de Cores
  const colors = {
    primary: '#06B6D4',
    secondary: '#0EA5E9',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    purple: '#8B5CF6',
    blue: '#3B82F6',
    amber: '#D97706',
    emerald: '#059669',
    indigo: '#6366F1'
  };

  const PIE_COLORS = ['#10B981', '#06B6D4', '#8B5CF6', '#F59E0B', '#EC4899', '#3B82F6'];

  const formatBRL = (val) => {
    return (Number(val) || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      maximumFractionDigits: 2
    });
  };

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        periodo,
        ...(dataInicio && { dataInicio }),
        ...(dataFim && { dataFim }),
        ...(vendedor && { vendedor })
      });

      const response = await fetch(
        `/api/gestao/analise-financeira/dashboard?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Erro ao consultar dados (${response.status})`);
      }

      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      console.error('Erro ao carregar análise financeira:', err);
      setError(err.message || 'Falha ao sincronizar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFinancialData();
  }, [periodo, dataInicio, dataFim, vendedor]);

  // Propostas do Simulador filtradas para a tabela
  const filteredSimProposals = useMemo(() => {
    if (!data?.simulador?.propostas) return [];
    return data.simulador.propostas.filter(p => {
      const matchSearch =
        !simSearch ||
        p.title.toLowerCase().includes(simSearch.toLowerCase()) ||
        p.client.toLowerCase().includes(simSearch.toLowerCase()) ||
        p.accountManager.toLowerCase().includes(simSearch.toLowerCase());

      const matchTipo = simTipoFiltro === 'TODOS' || p.type === simTipoFiltro;

      let matchTemp = true;
      if (simTempFiltro === 'FRIO') matchTemp = p.forecastTemperature <= 25;
      else if (simTempFiltro === 'MORNO') matchTemp = p.forecastTemperature > 25 && p.forecastTemperature <= 50;
      else if (simTempFiltro === 'QUENTE') matchTemp = p.forecastTemperature > 50 && p.forecastTemperature <= 75;
      else if (simTempFiltro === 'FECHAMENTO') matchTemp = p.forecastTemperature > 75;

      return matchSearch && matchTipo && matchTemp;
    });
  }, [data?.simulador?.propostas, simSearch, simTipoFiltro, simTempFiltro]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-cyan-400 gap-4">
        <RefreshCw className="w-10 h-10 animate-spin" />
        <p className="text-slate-300 font-medium tracking-wide">Carregando inteligência financeira...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 max-w-2xl mx-auto my-12 bg-red-950/40 border border-red-500/30 rounded-xl text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-white mb-2">Falha na Análise Financeira</h3>
        <p className="text-red-300 text-sm mb-6">{error}</p>
        <button
          onClick={fetchFinancialData}
          className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
        >
          Tentar Novamente
        </button>
      </div>
    );
  }

  const geral = data?.geral || {};
  const b2b = data?.b2b || {};
  const b2g = data?.b2g || {};
  const simulador = data?.simulador || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <PageHeader
          title="Gestão & Análise Financeira"
          description="Acompanhamento executivo de faturamento realizado, segmentação B2B / B2G e projeções do Simulador"
          icon={BarChart3}
        />
        <div className="flex items-center gap-3">
          <button
            onClick={fetchFinancialData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded-lg text-sm font-medium transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition shadow-sm shadow-cyan-900/40"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Imprimir Relatório
          </button>
        </div>
      </div>

      {/* SELETOR PRINCIPAL DE ANÁLISE (Tabs de Topo com destaque) */}
      <div className="bg-slate-900/90 border border-slate-800 p-2 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* Aba Geral */}
          <button
            onClick={() => setSegmentoAtivo('geral')}
            className={`flex items-center justify-center gap-3 p-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
              segmentoAtivo === 'geral'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-950/60 scale-[1.01]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-5 h-5" />
            <div className="text-left">
              <div className="leading-tight">Visão Geral</div>
              <div className="text-[11px] opacity-75 font-normal">Consolidado Real + Pipeline</div>
            </div>
          </button>

          {/* Aba B2B */}
          <button
            onClick={() => setSegmentoAtivo('b2b')}
            className={`flex items-center justify-center gap-3 p-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
              segmentoAtivo === 'b2b'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-950/60 scale-[1.01]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Building2 className="w-5 h-5" />
            <div className="text-left">
              <div className="leading-tight">Análise B2B Privado</div>
              <div className="text-[11px] opacity-75 font-normal">Mercado Corporativo</div>
            </div>
          </button>

          {/* Aba B2G */}
          <button
            onClick={() => setSegmentoAtivo('b2g')}
            className={`flex items-center justify-center gap-3 p-3.5 rounded-xl font-semibold text-sm transition-all duration-200 ${
              segmentoAtivo === 'b2g'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-950/60 scale-[1.01]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Landmark className="w-5 h-5" />
            <div className="text-left">
              <div className="leading-tight">Análise B2G Público</div>
              <div className="text-[11px] opacity-75 font-normal">Licitações & Editais</div>
            </div>
          </button>

          {/* Aba Simulador (ESTIMATIVAS DE VENDAS) */}
          <button
            onClick={() => setSegmentoAtivo('simulador')}
            className={`flex items-center justify-center gap-3 p-3.5 rounded-xl font-semibold text-sm transition-all duration-200 relative overflow-hidden ${
              segmentoAtivo === 'simulador'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-lg shadow-amber-950/60 scale-[1.01]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Calculator className="w-5 h-5 text-amber-300" />
            <div className="text-left">
              <div className="leading-tight flex items-center gap-1.5">
                Estimativas Simulador
                <span className="bg-amber-400/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-bold">Projeção</span>
              </div>
              <div className="text-[11px] opacity-75 font-normal">Estimativas Comerciais</div>
            </div>
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS GLOBAIS */}
      <GradientCard className="p-4 bg-slate-900/60 border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-cyan-400 text-sm font-semibold pr-2 border-r border-slate-800">
            <Filter className="w-4 h-4" />
            <span>Filtros:</span>
          </div>

          {/* Período */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Período:</label>
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:ring-1 focus:ring-cyan-500 outline-none"
            >
              <option value="todos">Todo o Histórico</option>
              <option value="mes">Mês Atual</option>
              <option value="trimestre">Trimestre Atual</option>
              <option value="ano">Ano Vigente</option>
              <option value="customizado">Personalizado</option>
            </select>
          </div>

          {periodo === 'customizado' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none"
              />
              <span className="text-slate-500 text-xs">até</span>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 outline-none"
              />
            </div>
          )}

          {/* Vendedor */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-400">Responsável:</label>
            <input
              type="text"
              placeholder="Filtrar por nome..."
              value={vendedor}
              onChange={(e) => setVendedor(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500 outline-none w-44"
            />
          </div>

          {(vendedor || periodo !== 'todos') && (
            <button
              onClick={() => {
                setPeriodo('todos');
                setVendedor('');
                setDataInicio('');
                setDataFim('');
              }}
              className="text-xs text-slate-400 hover:text-rose-400 underline ml-auto transition"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </GradientCard>

      {/* ========================================================================= */}
      {/* 1. VISÃO GERAL CONSOLIDADA */}
      {/* ========================================================================= */}
      {segmentoAtivo === 'geral' && (
        <div className="space-y-6">
          {/* Banner Comparativo de Alta Transparência */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white">Receita Financeira Realizada (Fechado Ganho)</h4>
                <p className="text-xs text-slate-400">Total faturado e homologado de contratos efetivamente ganhos (B2B + B2G).</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black text-emerald-400">{formatBRL(geral.receita_realizada)}</div>
              <div className="text-[11px] text-slate-400">{geral.total_ganhas || 0} negócios homologados</div>
            </div>
          </div>

          {/* Cards de KPIs Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Realizado B2B */}
            <div className="bg-slate-900/80 border border-emerald-900/40 p-5 rounded-2xl relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Realizado B2B (Privado)</span>
                <Building2 className="w-5 h-5 opacity-80" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{formatBRL(geral.receita_b2b_realizada)}</div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>{b2b.total_ganhas || 0} contratos ganhos</span>
                <span className="text-emerald-400 font-medium">Margem: {((b2b.margem || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500">Pipeline ativo: {formatBRL(geral.pipeline_b2b_em_aberto)}</div>
            </div>

            {/* Realizado B2G */}
            <div className="bg-slate-900/80 border border-blue-900/40 p-5 rounded-2xl relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between text-blue-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Realizado B2G (Público)</span>
                <Landmark className="w-5 h-5 opacity-80" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{formatBRL(geral.receita_b2g_realizada)}</div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>{b2g.total_ganhas || 0} licitações ganhas</span>
                <span className="text-blue-400 font-medium">Margem: {((b2g.margem || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500">Pipeline ativo: {formatBRL(geral.pipeline_b2g_em_aberto)}</div>
            </div>

            {/* Estimativas do Simulador (SEPARADO - ESTIMATIVA) */}
            <div className="bg-slate-900/80 border border-amber-900/40 p-5 rounded-2xl relative overflow-hidden shadow-lg group hover:border-amber-700/60 transition">
              <div className="flex items-center justify-between text-amber-400 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wider">Estimativas Simulador</span>
                  <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.2 rounded font-bold">Projeção</span>
                </div>
                <Calculator className="w-5 h-5 opacity-80" />
              </div>
              <div className="text-2xl font-bold text-amber-300 mb-1">{formatBRL(simulador.valor_ponderado_estimado)}</div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Ponderado por Probabilidade</span>
                <span className="text-amber-400 font-semibold">{simulador.total_propostas || 0} propostas</span>
              </div>
              <div className="mt-3 text-[11px] text-amber-400/80 flex items-center gap-1">
                <span>Nominal: {formatBRL(simulador.valor_total_estimado)}</span>
                <HelpCircle className="w-3 h-3 cursor-help inline" title="Valor nominal total cadastrado no módulo Simulador antes da ponderação probabilística" />
              </div>
            </div>

            {/* Resultado Líquido Geral */}
            <div className="bg-slate-900/80 border border-cyan-900/40 p-5 rounded-2xl relative overflow-hidden shadow-lg">
              <div className="flex items-center justify-between text-cyan-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Resultado Líquido Real</span>
                <TrendingUp className="w-5 h-5 opacity-80" />
              </div>
              <div className="text-2xl font-bold text-white mb-1">{formatBRL(geral.resultado_liquido)}</div>
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Comissões: {formatBRL(geral.despesas)}</span>
                <span className="text-cyan-400 font-semibold">Margem: {((geral.margem || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="mt-3 text-[11px] text-slate-500">Lucro operacional sobre contratos fechados</div>
            </div>
          </div>

          {/* Sub-Aba da Visão Geral */}
          <div className="flex gap-2 border-b border-slate-800 pt-2">
            {[
              { id: 'resumo', label: 'Painel Geral Comparativo' },
              { id: 'dre', label: 'DRE Consolidada' },
              { id: 'tabelas', label: 'Oportunidades & Comissões' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setTabGeral(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
                  tabGeral === tab.id
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sub-Aba: Resumo Geral */}
          {tabGeral === 'resumo' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico 1: Comparativo por Segmento */}
              <GradientCard className="p-6 bg-slate-900/70 border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">Comparativo Realizado vs. Pipeline vs. Simulador</h3>
                    <p className="text-xs text-slate-400">Valores em R$ comparando faturamento realizado, oportunidades em aberto e projeções</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={geral.grafico_comparativo || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="categoria" stroke="#94A3B8" />
                    <YAxis
                      stroke="#94A3B8"
                      tickFormatter={(val) => `R$ ${(val / 1000000).toFixed(1)}M`}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '8px' }}
                      formatter={(val) => [formatBRL(val), 'Valor']}
                    />
                    <Legend />
                    <Bar dataKey="realizado" name="Realizado (Fechado Ganho)" fill="#10B981" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="pipeline" name="Pipeline Ativo (Em Aberto)" fill="#3B82F6" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="estimativa_simulador" name="Simulador (Estimativa Ponderada)" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </GradientCard>

              {/* Gráfico 2: Composição de Receita Realizada */}
              <GradientCard className="p-6 bg-slate-900/70 border-slate-800">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-white text-base">Composição de Receita Realizada</h3>
                    <p className="text-xs text-slate-400">Divisão percentual e nominal entre contratos corporativos (B2B) e licitações (B2G)</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={geral.grafico_origem || []}
                        dataKey="valor"
                        nameKey="origem"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={5}
                      >
                        {(geral.grafico_origem || []).map((_, idx) => (
                          <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '8px' }}
                        formatter={(val) => [formatBRL(val), 'Receita']}
                      />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="space-y-4">
                    <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                          B2B Privado
                        </span>
                        <span>{formatBRL(geral.receita_b2b_realizada)}</span>
                      </div>
                      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{
                            width: `${geral.receita_realizada > 0 ? (geral.receita_b2b_realizada / geral.receita_realizada) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <div className="text-right text-[11px] text-emerald-400 font-semibold mt-1">
                        {geral.receita_realizada > 0 ? ((geral.receita_b2b_realizada / geral.receita_realizada) * 100).toFixed(2) : 0}%
                      </div>
                    </div>

                    <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/60">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                          B2G Público
                        </span>
                        <span>{formatBRL(geral.receita_b2g_realizada)}</span>
                      </div>
                      <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-cyan-500 h-full rounded-full"
                          style={{
                            width: `${geral.receita_realizada > 0 ? (geral.receita_b2g_realizada / geral.receita_realizada) * 100 : 0}%`
                          }}
                        />
                      </div>
                      <div className="text-right text-[11px] text-cyan-400 font-semibold mt-1">
                        {geral.receita_realizada > 0 ? ((geral.receita_b2g_realizada / geral.receita_realizada) * 100).toFixed(2) : 0}%
                      </div>
                    </div>
                  </div>
                </div>
              </GradientCard>
            </div>
          )}

          {/* Sub-Aba: DRE Consolidada */}
          {tabGeral === 'dre' && (
            <GradientCard className="p-6 bg-slate-900/80 border-slate-800 max-w-4xl mx-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-white">Demonstração do Resultado do Exercício (DRE)</h3>
                  <p className="text-xs text-slate-400">Contabilização do faturamento real e deduções operacionais aprovadas</p>
                </div>
                <div className="text-xs font-semibold px-3 py-1 bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                  Consolidado Real
                </div>
              </div>

              <div className="space-y-4 font-mono text-sm">
                {/* 1. Receita Bruta Realizada */}
                <div className="flex justify-between items-center py-2.5 px-3 bg-emerald-950/30 border border-emerald-800/40 rounded-lg">
                  <span className="font-bold text-emerald-400">(+) RECEITA BRUTA REALIZADA</span>
                  <span className="font-bold text-emerald-300 text-base">{formatBRL(geral.receita_realizada)}</span>
                </div>
                <div className="pl-6 space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>• Contratos B2B Homologados</span>
                    <span className="text-slate-300">{formatBRL(geral.receita_b2b_realizada)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Licitações e Contratos B2G Ganhos</span>
                    <span className="text-slate-300">{formatBRL(geral.receita_b2g_realizada)}</span>
                  </div>
                </div>

                {/* 2. Deduções e Despesas */}
                <div className="flex justify-between items-center py-2.5 px-3 bg-rose-950/30 border border-rose-800/40 rounded-lg mt-4">
                  <span className="font-bold text-rose-400">(-) DESPESAS OPERACIONAIS COMERCIAIS</span>
                  <span className="font-bold text-rose-300 text-base">{formatBRL(geral.despesas)}</span>
                </div>
                <div className="pl-6 space-y-1.5 text-xs text-slate-400">
                  <div className="flex justify-between">
                    <span>• Comissões B2B Aprovadas</span>
                    <span className="text-slate-300">{formatBRL(b2b.despesas || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• Comissões B2G Aprovadas</span>
                    <span className="text-slate-300">{formatBRL(b2g.despesas || 0)}</span>
                  </div>
                </div>

                {/* 3. Resultado Líquido */}
                <div className="flex justify-between items-center py-3.5 px-4 bg-gradient-to-r from-cyan-950/70 to-blue-950/70 border-2 border-cyan-500/60 rounded-xl mt-6">
                  <div>
                    <div className="font-bold text-cyan-300 text-base">(=) RESULTADO LÍQUIDO OPERACIONAL</div>
                    <div className="text-xs text-cyan-400/80 font-sans">Margem Operacional Efetiva: {((geral.margem || 0) * 100).toFixed(2)}%</div>
                  </div>
                  <span className="font-black text-cyan-200 text-xl">{formatBRL(geral.resultado_liquido)}</span>
                </div>

                {/* Nota de Auditoria sobre o Simulador */}
                <div className="mt-8 p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-start gap-3 font-sans">
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Observação Contábil / Comercial:</span> As propostas cadastradas no módulo <strong>Simulador</strong> (atualmente totalizando {formatBRL(simulador.valor_total_estimado)} nominais / {formatBRL(simulador.valor_ponderado_estimado)} ponderados) não integram a DRE acima, pois representam estimativas de vendas e orçamentos em aberto, antes de fechamento de contrato formal.
                  </div>
                </div>
              </div>
            </GradientCard>
          )}

          {/* Sub-Aba: Tabelas */}
          {tabGeral === 'tabelas' && (
            <div className="space-y-6">
              <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
                <h3 className="font-bold text-white text-base mb-4">Oportunidades Cadastradas</h3>
                <ModernTable
                  columns={[
                    { key: 'nome', label: 'Oportunidade / Projeto' },
                    { key: 'cliente', label: 'Cliente / Órgão' },
                    { key: 'origem', label: 'Segmento', render: (val) => (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${val === 'B2B' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-blue-500/20 text-blue-300'}`}>
                        {val}
                      </span>
                    )},
                    { key: 'estagio', label: 'Estágio', render: (val) => (
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${val === 'WON' ? 'bg-green-500/20 text-green-300' : val === 'LOST' ? 'bg-red-500/20 text-red-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                        {val}
                      </span>
                    )},
                    { key: 'vendedor', label: 'Responsável' },
                    { key: 'valor', label: 'Valor', render: (val) => formatBRL(val) },
                    { key: 'data', label: 'Data Fechamento' }
                  ]}
                  data={geral.tabela_oportunidades || []}
                />
              </GradientCard>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. ANÁLISE B2B (MERCADO PRIVADO / CORPORATIVO) */}
      {/* ========================================================================= */}
      {segmentoAtivo === 'b2b' && (
        <div className="space-y-6">
          <div className="bg-emerald-950/20 border border-emerald-500/30 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-emerald-400" />
              <div>
                <h3 className="font-bold text-white">Segmento B2B - Empresas Privadas</h3>
                <p className="text-xs text-slate-400">Contratos de telecom, conectividade corporativa, SD-WAN e TI empresarial</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold border border-emerald-500/30">
              B2B Corporativo
            </span>
          </div>

          {/* KPIs B2B */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-emerald-800/40 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-emerald-400 mb-1">Receita Realizada B2B</div>
              <div className="text-2xl font-bold text-white">{formatBRL(b2b.receita_realizada)}</div>
              <div className="text-xs text-slate-400 mt-2">{b2b.total_ganhas || 0} contratos ganhos</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Pipeline B2B em Aberto</div>
              <div className="text-2xl font-bold text-cyan-400">{formatBRL(b2b.pipeline_em_aberto)}</div>
              <div className="text-xs text-slate-400 mt-2">{b2b.total_em_aberto || 0} negociações ativas</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Ticket Médio B2B Ganho</div>
              <div className="text-2xl font-bold text-white">{formatBRL(b2b.ticket_medio)}</div>
              <div className="text-xs text-slate-400 mt-2">Média por oportunidade</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-emerald-400 mb-1">Resultado Líquido B2B</div>
              <div className="text-2xl font-bold text-emerald-300">{formatBRL(b2b.resultado_liquido)}</div>
              <div className="text-xs text-slate-400 mt-2">Margem: {((b2b.margem || 0) * 100).toFixed(1)}%</div>
            </div>
          </div>

          {/* Gráfico do Funil de Estágios B2B */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
              <h3 className="font-bold text-white text-base mb-4">Pipeline B2B por Estágio</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={b2b.estagios || []} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" stroke="#94A3B8" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(val) => [formatBRL(val), 'Valor']}
                  />
                  <Bar dataKey="valor" fill="#10B981" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GradientCard>

            {/* Resumo de Estágios B2B */}
            <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
              <h3 className="font-bold text-white text-base mb-4">Distribuição de Oportunidades B2B</h3>
              <div className="space-y-3">
                {(b2b.estagios || []).map((st, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div>
                      <div className="font-semibold text-sm text-slate-200">{st.label}</div>
                      <div className="text-xs text-slate-400">{st.count} oportunidade(s)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-emerald-400">{formatBRL(st.valor)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GradientCard>
          </div>

          {/* Tabela de Oportunidades B2B */}
          <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
            <h3 className="font-bold text-white text-base mb-4">Carteira de Oportunidades B2B</h3>
            <ModernTable
              columns={[
                { key: 'nome', label: 'Nome da Oportunidade' },
                { key: 'cliente', label: 'Cliente' },
                { key: 'vendedor', label: 'Vendedor' },
                { key: 'estagio', label: 'Estágio', render: (val) => (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${val === 'WON' ? 'bg-green-500/20 text-green-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                    {val}
                  </span>
                )},
                { key: 'valor', label: 'Valor', render: (val) => formatBRL(val) },
                { key: 'data', label: 'Data' }
              ]}
              data={b2b.tabela_oportunidades || []}
            />
          </GradientCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ANÁLISE B2G (GOVERNO / LICITAÇÕES / PÚBLICO) */}
      {/* ========================================================================= */}
      {segmentoAtivo === 'b2g' && (
        <div className="space-y-6">
          <div className="bg-blue-950/20 border border-blue-500/30 p-4 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Landmark className="w-6 h-6 text-blue-400" />
              <div>
                <h3 className="font-bold text-white">Segmento B2G - Setor Público & Licitações</h3>
                <p className="text-xs text-slate-400">Pregões eletrônicos, editais governamentais, câmeras, SD-WAN público e enlaces de fibra</p>
              </div>
            </div>
            <span className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold border border-blue-500/30">
              B2G Governamental
            </span>
          </div>

          {/* KPIs B2G */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-blue-800/40 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-blue-400 mb-1">Receita Homologada B2G</div>
              <div className="text-2xl font-bold text-white">{formatBRL(b2g.receita_realizada)}</div>
              <div className="text-xs text-slate-400 mt-2">{b2g.total_ganhas || 0} pregão(ões) ganho(s)</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Pipeline B2G em Disputa</div>
              <div className="text-2xl font-bold text-cyan-400">{formatBRL(b2g.pipeline_em_aberto)}</div>
              <div className="text-xs text-slate-400 mt-2">{b2g.total_em_aberto || 0} editais em andamento</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Ticket Médio Homologado</div>
              <div className="text-2xl font-bold text-white">{formatBRL(b2g.ticket_medio)}</div>
              <div className="text-xs text-slate-400 mt-2">Média por licitação</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-blue-400 mb-1">Resultado Líquido B2G</div>
              <div className="text-2xl font-bold text-blue-300">{formatBRL(b2g.resultado_liquido)}</div>
              <div className="text-xs text-slate-400 mt-2">Margem: {((b2g.margem || 0) * 100).toFixed(1)}%</div>
            </div>
          </div>

          {/* Gráfico do Funil de Estágios B2G */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
              <h3 className="font-bold text-white text-base mb-4">Pipeline B2G por Fase Licitatória</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={b2g.estagios || []} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => `R$ ${(v / 1000000).toFixed(1)}M`} />
                  <YAxis type="category" dataKey="label" stroke="#94A3B8" width={140} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(val) => [formatBRL(val), 'Valor']}
                  />
                  <Bar dataKey="valor" fill="#3B82F6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GradientCard>

            {/* Resumo de Estágios B2G */}
            <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
              <h3 className="font-bold text-white text-base mb-4">Editais e Fases Licitatórias</h3>
              <div className="space-y-3">
                {(b2g.estagios || []).map((st, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                    <div>
                      <div className="font-semibold text-sm text-slate-200">{st.label}</div>
                      <div className="text-xs text-slate-400">{st.count} processo(s)</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-blue-400">{formatBRL(st.valor)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </GradientCard>
          </div>

          {/* Tabela de Oportunidades B2G */}
          <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
            <h3 className="font-bold text-white text-base mb-4">Editais e Processos Licitatórios B2G</h3>
            <ModernTable
              columns={[
                { key: 'nome', label: 'Processo / Objeto' },
                { key: 'cliente', label: 'Órgão / Ente Público' },
                { key: 'vendedor', label: 'Responsável Técnico' },
                { key: 'estagio', label: 'Fase', render: (val) => (
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${val === 'WON' ? 'bg-green-500/20 text-green-300' : val === 'LOST' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'}`}>
                    {val}
                  </span>
                )},
                { key: 'valor', label: 'Valor Estimado / Fechado', render: (val) => formatBRL(val) },
                { key: 'data', label: 'Data Homologação' }
              ]}
              data={b2g.tabela_oportunidades || []}
            />
          </GradientCard>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MÓDULO SIMULADOR (ESTIMATIVAS DE VENDAS - SEPARADO) */}
      {/* ========================================================================= */}
      {segmentoAtivo === 'simulador' && (
        <div className="space-y-6">
          {/* ALERTA DE SEPARAÇÃO METODOLÓGICA CLARA */}
          <div className="bg-amber-950/30 border-2 border-amber-500/50 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500/20 rounded-xl text-amber-400 border border-amber-500/30">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">Módulo Simulador - Estimativas de Vendas</h3>
                  <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">
                    Não Faturado
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 mt-1 max-w-2xl leading-relaxed">
                  As propostas abaixo são <strong>projeções e cotações comerciais</strong> elaboradas no Simulador.
                  Elas não representam receita realizada ou definitiva, sendo calculadas com <strong>ponderação probabilística</strong> baseada na temperatura do funil.
                </p>
              </div>
            </div>

            <div className="text-right bg-slate-900/80 px-4 py-3 rounded-xl border border-amber-500/30">
              <div className="text-xs text-slate-400">Previsão Ponderada Total</div>
              <div className="text-2xl font-black text-amber-400">{formatBRL(simulador.valor_ponderado_estimado)}</div>
              <div className="text-[11px] text-slate-400">Nominal: {formatBRL(simulador.valor_total_estimado)}</div>
            </div>
          </div>

          {/* Cards de Métricas do Simulador */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Total de Propostas</div>
              <div className="text-2xl font-bold text-white">{simulador.total_propostas || 0}</div>
              <div className="text-xs text-slate-400 mt-2">Cotações ativas no simulador</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-amber-400 mb-1">Previsão Ponderada (Probab.)</div>
              <div className="text-2xl font-bold text-amber-300">{formatBRL(simulador.valor_ponderado_estimado)}</div>
              <div className="text-xs text-slate-400 mt-2">Ajustada pela temperatura do funil</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Valor Nominal Total</div>
              <div className="text-2xl font-bold text-white">{formatBRL(simulador.valor_total_estimado)}</div>
              <div className="text-xs text-slate-400 mt-2">Soma de todas as cotações</div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl shadow-lg">
              <div className="text-xs font-semibold uppercase text-cyan-400 mb-1">Probabilidade Média</div>
              <div className="text-2xl font-bold text-cyan-300">{(simulador.taxa_media_probabilidade || 0).toFixed(1)}%</div>
              <div className="text-xs text-slate-400 mt-2">Índice ponderado de conversão</div>
            </div>
          </div>

          {/* Gráficos de Projeção do Simulador */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfico 1: Termômetro do Funil (Temperatura) */}
            <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-base flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    Projeção por Temperatura do Negócio
                  </h3>
                  <p className="text-xs text-slate-400">Classificação probabilística das propostas do simulador</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={simulador.por_temperatura || []} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="faixa" stroke="#94A3B8" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#94A3B8" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(val) => [formatBRL(val), 'Valor']}
                  />
                  <Legend />
                  <Bar dataKey="valor_total" name="Valor Nominal" fill="#64748B" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="valor_ponderado" name="Valor Ponderado (Probab.)" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GradientCard>

            {/* Gráfico 2: Distribuição por Tipo de Produto no Simulador */}
            <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-base">Distribuição por Solução / Produto</h3>
                  <p className="text-xs text-slate-400">Volume estimado em cada módulo técnico do simulador</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={simulador.por_tipo || []} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis type="number" stroke="#94A3B8" tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="label" stroke="#94A3B8" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(val) => [formatBRL(val), 'Valor']}
                  />
                  <Bar dataKey="valor_total" name="Valor Total" fill="#0EA5E9" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </GradientCard>
          </div>

          {/* TABELA DE PROPOSTAS DO SIMULADOR (Com Busca e Filtros Dedicados) */}
          <GradientCard className="p-6 bg-slate-900/80 border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="font-bold text-white text-base">Cotações e Propostas do Simulador</h3>
                <p className="text-xs text-slate-400">Lista completa das estimativas comerciais registradas no sistema</p>
              </div>

              {/* Filtros da Tabela */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar cliente, título..."
                    value={simSearch}
                    onChange={(e) => setSimSearch(e.target.value)}
                    className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-9 pr-3 py-2 placeholder:text-slate-500 focus:ring-1 focus:ring-amber-500 outline-none w-56"
                  />
                </div>

                <select
                  value={simTipoFiltro}
                  onChange={(e) => setSimTipoFiltro(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
                >
                  <option value="TODOS">Todos os Produtos</option>
                  {(simulador.por_tipo || []).map((t, idx) => (
                    <option key={idx} value={t.tipo}>{t.label}</option>
                  ))}
                </select>

                <select
                  value={simTempFiltro}
                  onChange={(e) => setSimTempFiltro(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none"
                >
                  <option value="TODOS">Todas as Temperaturas</option>
                  <option value="FRIO">Frio (0% - 25%)</option>
                  <option value="MORNO">Morno (26% - 50%)</option>
                  <option value="QUENTE">Quente (51% - 75%)</option>
                  <option value="FECHAMENTO">Fechamento (76% - 100%)</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-400 mb-3 flex items-center justify-between">
              <span>Exibindo <strong>{filteredSimProposals.length}</strong> de <strong>{simulador.total_propostas || 0}</strong> propostas</span>
              <span className="text-amber-400 font-medium">Estimativa ponderada filtrada: {formatBRL(filteredSimProposals.reduce((s, p) => s + p.valor_ponderado, 0))}</span>
            </div>

            <ModernTable
              columns={[
                { key: 'title', label: 'Proposta / Identificador' },
                { key: 'client', label: 'Cliente' },
                { key: 'typeLabel', label: 'Produto / Solução', render: (val) => (
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {val}
                  </span>
                )},
                { key: 'status', label: 'Status' },
                { key: 'forecastTemperature', label: 'Temperatura', render: (val) => {
                  let badgeColor = 'bg-blue-500/20 text-blue-300 border-blue-500/30';
                  if (val > 75) badgeColor = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                  else if (val > 50) badgeColor = 'bg-orange-500/20 text-orange-300 border-orange-500/30';
                  else if (val > 25) badgeColor = 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';

                  return (
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold border ${badgeColor}`}>
                        {val}%
                      </span>
                    </div>
                  );
                }},
                { key: 'value', label: 'Valor Nominal', render: (val) => formatBRL(val) },
                { key: 'valor_ponderado', label: 'Previsão Ponderada', render: (val) => (
                  <span className="font-semibold text-amber-300">{formatBRL(val)}</span>
                )},
                { key: 'accountManager', label: 'Vendedor' }
              ]}
              data={filteredSimProposals.slice(0, 100)}
            />
          </GradientCard>
        </div>
      )}
    </div>
  );
};

export default AnaliseFinanceira;
