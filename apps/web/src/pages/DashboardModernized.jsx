/**
 * Dashboard Modernizado - Arquitetura Senior
 * Integra todos os componentes avançados com design system consistente
 */

import React, { useEffect, useState } from 'react';
import {
  Download,
  Filter,
  RefreshCw,
  Settings,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  BarChart3,
  Zap,
  Clock
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import DashboardKPICard from '../components/DashboardKPICard';
import DashboardAdvancedChart from '../components/DashboardAdvancedChart';
import SalesFunnel from '../components/SalesFunnel';
import TemperatureGauge from '../components/TemperatureGauge';
import { DASHBOARD_COLORS, TRANSITIONS } from '../constants/dashboardTheme';
import '../styles/dashboardEffects.css';

const DashboardModernized = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [timeRange, setTimeRange] = useState('quarter');
  const [selectedManager, setSelectedManager] = useState('');
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Carregar dados
  useEffect(() => {
    loadDashboardData();
    loadUsers();
  }, [timeRange, selectedManager]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const params = {
        period: timeRange,
        ...(selectedManager && { managerId: selectedManager })
      };

      const queryString = new URLSearchParams(params).toString();
      const response = await fetch(
        buildApiUrl(`/dashboard?${queryString}`),
        { headers: getAuthHeaders() }
      );

      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch(buildApiUrl('/users'), {
        headers: getAuthHeaders()
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleExport = () => {
    const csv = generateCSVFromData(dashboardData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin mb-4">
            <Zap size={48} className="text-cyan-400" />
          </div>
          <p className="text-slate-300">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const kpis = dashboardData?.kpis || {};
  const charts = dashboardData?.charts || {};

  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <style>
        {`
          @import url('/src/styles/dashboardEffects.css');
        `}
      </style>

      {/* Header */}
      <div className="mb-8 animate-slide-in-right">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Dashboards de Negócios
            </h1>
            <p className="text-slate-400">
              Visão consolidada de vendas, pipeline e performance
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`p-2 rounded-lg border border-slate-700 hover:border-cyan-500 transition-all ${refreshing ? 'opacity-50' : ''}`}
            >
              <RefreshCw
                size={20}
                className={`text-slate-300 ${refreshing ? 'animate-rotate' : ''}`}
              />
            </button>

            <button
              onClick={handleExport}
              className="p-2 rounded-lg border border-slate-700 hover:border-cyan-500 transition-all"
            >
              <Download size={20} className="text-slate-300" />
            </button>

            <button className="p-2 rounded-lg border border-slate-700 hover:border-cyan-500 transition-all">
              <Settings size={20} className="text-slate-300" />
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              Período
            </label>
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm hover:border-cyan-500 transition-colors"
            >
              <option value="30d">Últimos 30 dias</option>
              <option value="month">Mês atual</option>
              <option value="quarter">Trimestre</option>
              <option value="year">Ano</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-2">
              Gerente de Vendas
            </label>
            <select
              value={selectedManager}
              onChange={(e) => setSelectedManager(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm hover:border-cyan-500 transition-colors"
            >
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPIs Row 1 */}
      <div className="dashboard-grid mb-8">
        <DashboardKPICard
          title="Pipeline de Vendas"
          value={kpis.pipelineValue || 0}
          unit="R$"
          trend={5.2}
          trendLabel="vs último mês"
          status="positive"
          icon={DollarSign}
          colorTheme="cyan"
          subtitle="Oportunidades abertas"
        />

        <DashboardKPICard
          title="Receita Faturada"
          value={kpis.wonValue || 0}
          unit="R$"
          trend={8.7}
          trendLabel="crescimento"
          status="positive"
          icon={TrendingUp}
          colorTheme="green"
          subtitle="Neste período"
        />

        <DashboardKPICard
          title="Ticket Médio"
          value={kpis.avgTicket || 0}
          unit="R$"
          trend={-2.1}
          trendLabel="vs período anterior"
          status="negative"
          icon={Target}
          colorTheme="purple"
          subtitle="Por oportunidade"
        />

        <DashboardKPICard
          title="Taxa de Conversão"
          value={kpis.conversionRate || 0}
          unit="%"
          trend={3.5}
          trendLabel="melhora"
          status="positive"
          icon={BarChart3}
          colorTheme="pink"
          subtitle="Leads para fechamentos"
        />
      </div>

      {/* KPIs Row 2 */}
      <div className="dashboard-grid mb-8">
        <DashboardKPICard
          title="Oportunidades Ganhas"
          value={kpis.wonOpportunities || 0}
          trend={12.3}
          trendLabel="vs mês passado"
          status="success"
          icon={CheckCircle}
          colorTheme="green"
        />

        <DashboardKPICard
          title="Leads Ativos"
          value={kpis.activeLeads || 0}
          trend={6.8}
          trendLabel="aumento"
          status="positive"
          icon={Users}
          colorTheme="blue"
        />

        <DashboardKPICard
          title="Ciclo de Vendas"
          value={kpis.avgCycleDays || 0}
          unit="dias"
          trend={-4.2}
          trendLabel="redução"
          status="positive"
          icon={Clock}
          colorTheme="yellow"
        />

        <DashboardKPICard
          title="Acurácia de Forecast"
          value={kpis.forecastAccuracy || 0}
          unit="%"
          trend={2.1}
          trendLabel="melhora"
          status="success"
          icon={Zap}
          colorTheme="orange"
        />
      </div>

      {/* Gráficos - Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Receita por Produto */}
        <DashboardAdvancedChart
          type="bar"
          title="Receita por Produto"
          subtitle="Análise de faturamento por categoria"
          height={350}
          colorTheme="warm"
          data={{
            labels: ['Produto A', 'Produto B', 'Produto C', 'Produto D'],
            datasets: [
              {
                label: 'Receita',
                data: [45000, 38000, 52000, 41000],
                borderRadius: 8
              }
            ]
          }}
        />

        {/* Oportunidades por Estágio */}
        <DashboardAdvancedChart
          type="line"
          title="Evolução de Oportunidades"
          subtitle="Últimos 30 dias"
          height={350}
          colorTheme="cool"
          data={{
            labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
            datasets: [
              {
                label: 'Geração',
                data: [120, 135, 145, 155]
              },
              {
                label: 'Qualificação',
                data: [95, 105, 115, 125]
              },
              {
                label: 'Proposta',
                data: [68, 75, 82, 90]
              },
              {
                label: 'Fechamento',
                data: [45, 52, 58, 68]
              }
            ]
          }}
        />
      </div>

      {/* Gráficos - Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Funil de Vendas */}
        <div className="lg:col-span-2">
          <div className="dashboard-card">
            <div className="p-6 border-b border-slate-500/20">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Funil de Vendas
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Distribuição de oportunidades por estágio
              </p>
            </div>
            <SalesFunnel data={charts.funnel || []} />
          </div>
        </div>

        {/* Termômetro de Temperatura */}
        <div>
          <div className="dashboard-card p-6">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider mb-6">
              Temperatura do Pipeline
            </h3>
            <div className="flex justify-center">
              <TemperatureGauge
                temperature={kpis.businessTemperature || 65}
                size={200}
              />
            </div>
            <p className="text-xs text-slate-500 text-center mt-4">
              {kpis.businessTemperature || 65}% - {getTemperatureLabel(kpis.businessTemperature || 65)}
            </p>
          </div>
        </div>
      </div>

      {/* Gráficos - Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição Regional */}
        <DashboardAdvancedChart
          type="doughnut"
          title="Distribuição Regional de Vendas"
          subtitle="Por região geográfica"
          height={320}
          colorTheme="multi"
          data={{
            labels: ['Sul', 'Sudeste', 'Nordeste', 'Norte', 'Centro-Oeste'],
            datasets: [
              {
                label: 'Vendas',
                data: [35, 45, 20, 15, 10]
              }
            ]
          }}
        />

        {/* Taxa de Conversão por Estágio */}
        <DashboardAdvancedChart
          type="radar"
          title="Performance por Estágio"
          subtitle="Taxa de conversão em cada fase"
          height={320}
          colorTheme="success"
          data={{
            labels: [
              'Geração',
              'Qualificação',
              'Diagnóstico',
              'Proposta',
              'Negociação',
              'Fechamento'
            ],
            datasets: [
              {
                label: 'Taxa de Conversão %',
                data: [100, 85, 70, 60, 50, 35]
              }
            ]
          }}
        />
      </div>
    </div>
  );
};

const generateCSVFromData = (data) => {
  if (!data) return '';
  const kpis = data.kpis || {};
  let csv = 'KPI,Valor\n';
  Object.entries(kpis).forEach(([key, value]) => {
    csv += `${key},${value}\n`;
  });
  return csv;
};

const getTemperatureLabel = (temp) => {
  if (temp >= 80) return 'Muito quente - Ótimas oportunidades';
  if (temp >= 60) return 'Quente - Boas oportunidades';
  if (temp >= 40) return 'Morno - Oportunidades moderadas';
  if (temp >= 20) return 'Frio - Poucas oportunidades';
  return 'Muito frio - Pouca atividade';
};

export default DashboardModernized;
