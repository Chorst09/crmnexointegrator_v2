import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, PieChart as PieChartIcon, Filter } from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import PageHeader from '../components/PageHeader';
import GradientCard from '../components/GradientCard';
import AnimatedStats from '../components/AnimatedStats';
import ModernTable from '../components/ModernTable';

const AnaliseFinanceira = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Filtros
  const [periodo, setPeriodo] = useState('trimestre');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [vendedor, setVendedor] = useState('');
  const [origem, setOrigem] = useState('');

  // Cores do sistema
  const colors = {
    primary: '#06B6D4',
    secondary: '#0EA5E9',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    blue: '#3B82F6',
    teal: '#14B8A6',
    cyan: '#06B6D4'
  };

  const CHART_COLORS = ['#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  useEffect(() => {
    fetchDashboardData();
  }, [periodo, dataInicio, dataFim, vendedor, origem]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        periodo,
        ...(dataInicio && { dataInicio }),
        ...(dataFim && { dataFim }),
        ...(vendedor && { vendedor }),
        ...(origem && { origem })
      });

      const response = await fetch(
        `/api/gestao/analise-financeira/dashboard?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      );

      if (!response.ok) throw new Error('Erro ao carregar dashboard');
      
      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Erro:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin">
          <BarChart3 className="w-12 h-12 text-cyan-500" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-lg">
        <p className="text-red-500">Erro: {error}</p>
      </div>
    );
  }

  if (!dashboardData) {
    return <div className="p-6">Sem dados disponíveis</div>;
  }

  // Stats para o topo
  const stats = [
    {
      title: 'Receita Bruta',
      value: `R$ ${(dashboardData.receita_bruta || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      gradient: 'from-emerald-500 to-teal-500',
      trend: '+12%'
    },
    {
      title: 'Despesas',
      value: `R$ ${(dashboardData.despesas || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`,
      icon: TrendingUp,
      gradient: 'from-orange-500 to-red-500',
      trend: '-8%'
    },
    {
      title: 'Resultado Líquido',
      value: `R$ ${(dashboardData.resultado_liquido || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`,
      icon: BarChart3,
      gradient: 'from-blue-500 to-cyan-500',
      trend: '+18%'
    },
    {
      title: 'Margem',
      value: `${((dashboardData.margem || 0) * 100).toFixed(1)}%`,
      icon: PieChartIcon,
      gradient: 'from-purple-500 to-pink-500',
      trend: '+2.5%'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="p-6">
        {/* Header */}
        <PageHeader 
          title="Análise Financeira" 
          description="Dashboard financeiro com análise detalhada de receitas, despesas e fluxo de caixa"
          icon={BarChart3}
        />

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, idx) => (
            <AnimatedStats key={idx} {...stat} />
          ))}
        </div>

        {/* Filtros */}
        <GradientCard className="mb-8 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-semibold">Filtros Avançados</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Período</label>
              <select 
                value={periodo} 
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white hover:border-cyan-500 transition"
              >
                <option value="mes">Mês</option>
                <option value="trimestre">Trimestre</option>
                <option value="ano">Ano</option>
                <option value="customizado">Customizado</option>
              </select>
            </div>

            {periodo === 'customizado' && (
              <>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Data Início</label>
                  <input 
                    type="date" 
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Data Fim</label>
                  <input 
                    type="date" 
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm text-gray-400 mb-2">Vendedor</label>
              <input 
                type="text" 
                placeholder="Digite o nome..."
                value={vendedor}
                onChange={(e) => setVendedor(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-500"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">Origem</label>
              <select 
                value={origem} 
                onChange={(e) => setOrigem(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white hover:border-cyan-500 transition"
              >
                <option value="">Todas</option>
                <option value="B2B">B2B</option>
                <option value="B2G">B2G</option>
              </select>
            </div>
          </div>
        </GradientCard>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-slate-700">
          {['dashboard', 'dre', 'fluxo-caixa', 'detalhes'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition ${
                activeTab === tab
                  ? 'text-cyan-400 border-b-2 border-cyan-400'
                  : 'text-gray-400 hover:text-cyan-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>

        {/* Tab: Dashboard */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receitas vs Despesas */}
            <GradientCard className="p-6">
              <h3 className="text-lg font-semibold mb-4">Receitas vs Despesas</h3>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={dashboardData.grafico_receitas_despesas || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="mes" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569' }}
                    labelStyle={{ color: '#E2E8F0' }}
                  />
                  <Legend />
                  <Bar dataKey="receita" fill={colors.success} radius={[8, 8, 0, 0]} />
                  <Line type="monotone" dataKey="despesa" stroke={colors.warning} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </GradientCard>

            {/* Composição de Origem */}
            <GradientCard className="p-6">
              <h3 className="text-lg font-semibold mb-4">Receita por Origem</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dashboardData.grafico_origem || []}
                    dataKey="valor"
                    nameKey="origem"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {dashboardData.grafico_origem?.map((_, idx) => (
                      <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </GradientCard>

            {/* Evolução Temporal */}
            <GradientCard className="p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">Evolução Temporal</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dashboardData.grafico_evolucao || []}>
                  <defs>
                    <linearGradient id="colorReceita" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.success} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={colors.success} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="periodo" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569' }}
                    labelStyle={{ color: '#E2E8F0' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="saldo" 
                    stroke={colors.teal} 
                    fillOpacity={1} 
                    fill="url(#colorReceita)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </GradientCard>
          </div>
        )}

        {/* Tab: DRE */}
        {activeTab === 'dre' && (
          <GradientCard className="p-6">
            <h3 className="text-lg font-semibold mb-6">Demonstração de Resultado (DRE)</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-3 border-b border-slate-600">
                <span>Receita Bruta</span>
                <span className="text-lg font-semibold text-green-400">
                  R$ {(dashboardData.receita_bruta || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-400">
                <span className="ml-4">Oportunidades B2B</span>
                <span>R$ {(dashboardData.receita_b2b || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-400">
                <span className="ml-4">Oportunidades B2G</span>
                <span>R$ {(dashboardData.receita_b2g || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="flex justify-between items-center pb-3 border-b border-slate-600 pt-4">
                <span>(-) Despesas</span>
                <span className="text-lg font-semibold text-red-400">
                  R$ {(dashboardData.despesas || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-gray-400">
                <span className="ml-4">Comissões</span>
                <span>R$ {(dashboardData.comissoes || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
              </div>

              <div className="flex justify-between items-center py-3 border-t-2 border-cyan-500 bg-slate-700/50 px-3 rounded">
                <span className="font-semibold">Resultado Líquido</span>
                <span className="text-xl font-bold text-cyan-400">
                  R$ {(dashboardData.resultado_liquido || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between items-center text-sm pt-4">
                <span>Margem Operacional</span>
                <span className="text-lg font-semibold text-cyan-400">
                  {((dashboardData.margem || 0) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </GradientCard>
        )}

        {/* Tab: Fluxo de Caixa */}
        {activeTab === 'fluxo-caixa' && (
          <div className="space-y-6">
            <GradientCard className="p-6">
              <h3 className="text-lg font-semibold mb-4">Fluxo de Caixa Acumulado</h3>
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={dashboardData.grafico_fluxo_caixa || []}>
                  <defs>
                    <linearGradient id="colorFluxo" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={colors.blue} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={colors.blue} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="data" stroke="#94A3B8" />
                  <YAxis stroke="#94A3B8" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #475569' }}
                    labelStyle={{ color: '#E2E8F0' }}
                    formatter={(value) => `R$ ${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="saldo_acumulado" 
                    stroke={colors.blue} 
                    fillOpacity={1} 
                    fill="url(#colorFluxo)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </GradientCard>
          </div>
        )}

        {/* Tab: Detalhes */}
        {activeTab === 'detalhes' && (
          <div className="space-y-6">
            {/* Tabela de Oportunidades */}
            <GradientCard className="p-6">
              <h3 className="text-lg font-semibold mb-4">Oportunidades Ganhas</h3>
              <ModernTable
                columns={[
                  { key: 'nome', label: 'Nome' },
                  { key: 'vendedor', label: 'Vendedor' },
                  { key: 'origem', label: 'Origem' },
                  { key: 'valor', label: 'Valor', render: (val) => `R$ ${val.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` },
                  { key: 'data', label: 'Data' }
                ]}
                data={dashboardData.tabela_oportunidades || []}
              />
            </GradientCard>

            {/* Tabela de Comissões */}
            <GradientCard className="p-6">
              <h3 className="text-lg font-semibold mb-4">Comissões Aprovadas</h3>
              <ModernTable
                columns={[
                  { key: 'vendedor', label: 'Vendedor' },
                  { key: 'oportunidade', label: 'Oportunidade' },
                  { key: 'comissao', label: 'Comissão', render: (val) => `R$ ${val.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}` },
                  { key: 'percentual', label: 'Percentual', render: (val) => `${(val * 100).toFixed(2)}%` },
                  { key: 'data', label: 'Data' }
                ]}
                data={dashboardData.tabela_comissoes || []}
              />
            </GradientCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnaliseFinanceira;
