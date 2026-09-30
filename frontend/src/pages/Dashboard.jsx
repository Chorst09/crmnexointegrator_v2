import { useState } from "react";
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Target,
  BarChart3,
  PieChart,
  Activity,
  Award,
  Zap,
  ArrowUp
} from 'lucide-react';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

import { Line, Doughnut } from 'react-chartjs-2';

import PageHeader from '../components/PageHeader';
import AnimatedStats from '../components/AnimatedStats';
import GradientCard from '../components/GradientCard';
import SalesFunnel from '../components/SalesFunnel';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('30d');

  // Dados mock para demonstração
  const kpis = {
    pipelineValue: 3200000,
    wonValue: 890000,
    conversionRate: 8.4, // 38 fechadas de 450 leads = 8.4%
    avgTicket: 23421, // 890000 / 38 = 23.421
    totalOpportunities: 450,
    wonOpportunities: 38,
    lostOpportunities: 85,
    totalCompanies: 89,
    monthlyGrowth: 12.5,
    activeLeads: 450
  };

  const charts = {
    funnel: [
      { stage: 'LEAD_GENERATION', _count: { stage: 450 }, _sum: { value: 3200000 } },
      { stage: 'LEAD_QUALIFICATION', _count: { stage: 280 }, _sum: { value: 2800000 } },
      { stage: 'PROBLEM_ASSESSMENT', _count: { stage: 180 }, _sum: { value: 2450000 } },
      { stage: 'SOLUTION', _count: { stage: 120 }, _sum: { value: 1890000 } },
      { stage: 'CONVERSION', _count: { stage: 65 }, _sum: { value: 1340000 } },
      { stage: 'CLOSING', _count: { stage: 38 }, _sum: { value: 890000 } }
    ],
    monthlyRevenue: [
      { month: '2024-07-01', revenue: 650000 },
      { month: '2024-08-01', revenue: 720000 },
      { month: '2024-09-01', revenue: 580000 },
      { month: '2024-10-01', revenue: 890000 },
      { month: '2024-11-01', revenue: 760000 },
      { month: '2024-12-01', revenue: 920000 }
    ],
    opportunitiesBySource: [
      { source: 'Website', count: 45 },
      { source: 'Indicação', count: 32 },
      { source: 'LinkedIn', count: 28 },
      { source: 'Google Ads', count: 25 },
      { source: 'Outros', count: 26 }
    ],
    performanceByUser: [
      { user: 'João Silva', won: 12, value: 340000 },
      { user: 'Maria Santos', won: 8, value: 280000 },
      { user: 'Pedro Costa', won: 10, value: 320000 },
      { user: 'Ana Oliveira', won: 6, value: 180000 },
      { user: 'Carlos Lima', won: 9, value: 250000 }
    ]
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value || 0);
  };

  const formatPercent = (value) => {
    return `${(value || 0).toFixed(1)}%`;
  };

  // Configurações dos gráficos
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        displayColors: true
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          font: {
            size: 11
          }
        }
      },
      y: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)'
        },
        ticks: {
          font: {
            size: 11
          },
          callback: function(value) {
            return formatCurrency(value);
          }
        }
      }
    }
  };



  // Dados da receita mensal
  const revenueData = {
    labels: charts.monthlyRevenue.map(month => 
      new Date(month.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    ),
    datasets: [
      {
        label: 'Receita Mensal',
        data: charts.monthlyRevenue.map(month => month.revenue),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: 'white',
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ]
  };

  // Dados das oportunidades por fonte
  const sourceData = {
    labels: charts.opportunitiesBySource.map(source => source.source),
    datasets: [
      {
        data: charts.opportunitiesBySource.map(source => source.count),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(251, 191, 36, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(248, 113, 113, 0.8)'
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(16, 185, 129)',
          'rgb(251, 191, 36)',
          'rgb(139, 92, 246)',
          'rgb(248, 113, 113)'
        ],
        borderWidth: 2
      }
    ]
  };



  return (
    <div className="space-y-8">
      {/* Header */}
      <PageHeader
        title="Dashboard Executivo"
        subtitle="Visão geral completa do desempenho de vendas e métricas estratégicas"
        icon={BarChart3}
        gradient="blue"
        breadcrumbs={['Dashboard']}
        actions={[
          {
            label: '7 dias',
            onClick: () => setTimeRange('7d'),
            variant: timeRange === '7d' ? 'primary' : 'secondary'
          },
          {
            label: '30 dias',
            onClick: () => setTimeRange('30d'),
            variant: timeRange === '30d' ? 'primary' : 'secondary'
          },
          {
            label: '90 dias',
            onClick: () => setTimeRange('90d'),
            variant: timeRange === '90d' ? 'primary' : 'secondary'
          }
        ]}
      />

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <AnimatedStats
          title="Pipeline Total"
          value={formatCurrency(kpis.pipelineValue)}
          subtitle={`${kpis.totalOpportunities} leads no funil`}
          icon={Target}
          color="blue"
          trend={{ direction: 'up', value: `+${kpis.monthlyGrowth}% este mês` }}
        />
        
        <AnimatedStats
          title="Receita Fechada"
          value={formatCurrency(kpis.wonValue)}
          subtitle={`${kpis.wonOpportunities} vendas concluídas`}
          icon={DollarSign}
          color="green"
          trend={{ direction: 'up', value: '+18% vs mês anterior' }}
        />
        
        <AnimatedStats
          title="Taxa de Conversão"
          value={formatPercent(kpis.conversionRate)}
          subtitle="Do lead até o fechamento"
          icon={TrendingUp}
          color="yellow"
          trend={{ direction: 'up', value: '+1.2% este mês' }}
        />
        
        <AnimatedStats
          title="Ticket Médio"
          value={formatCurrency(kpis.avgTicket)}
          subtitle={`${kpis.totalCompanies} empresas ativas`}
          icon={Award}
          color="purple"
          trend={{ direction: 'up', value: '+8.5% vs média' }}
        />
      </div>

      {/* Gráficos Principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Funil de Vendas */}
        <GradientCard gradient="blue" className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Funil de Vendas Estratégico</h3>
              <p className="text-gray-600">Jornada completa do lead até o fechamento</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="h-96">
            <SalesFunnel data={charts.funnel} />
          </div>
        </GradientCard>

        {/* Receita Mensal */}
        <GradientCard gradient="green" className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Receita Mensal</h3>
              <p className="text-gray-600">Evolução da receita nos últimos 6 meses</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="h-80">
            <Line data={revenueData} options={chartOptions} />
          </div>
        </GradientCard>
      </div>

      {/* Gráficos Secundários */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Oportunidades por Fonte */}
        <GradientCard gradient="purple" className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Oportunidades por Fonte</h3>
              <p className="text-gray-600">Origem dos leads e oportunidades</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <PieChart className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="h-80">
            <Doughnut data={sourceData} options={{
              ...chartOptions,
              scales: undefined,
              plugins: {
                ...chartOptions.plugins,
                legend: {
                  position: 'bottom',
                  labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                      size: 12
                    }
                  }
                }
              }
            }} />
          </div>
        </GradientCard>

        {/* Performance por Vendedor */}
        <GradientCard gradient="orange" className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-gray-900">Performance por Vendedor</h3>
              <p className="text-gray-600">Vendas fechadas e valor por vendedor</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <Users className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="space-y-4">
            {charts.performanceByUser.map((user, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-white rounded-lg border border-orange-100">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold">
                    {user.user.split(' ')[0].charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{user.user.split(' ')[0]}</div>
                    <div className="text-sm text-gray-600">{user.won} vendas</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-orange-600">{formatCurrency(user.value)}</div>
                  <div className="text-sm text-gray-500">Faturamento</div>
                </div>
              </div>
            ))}
          </div>
        </GradientCard>
      </div>

      {/* Métricas Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GradientCard gradient="gray" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Leads Gerados</h4>
              <div className="text-3xl font-bold text-blue-600 mt-2">{kpis.activeLeads}</div>
              <p className="text-sm text-gray-600 mt-1">No topo do funil</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <Zap className="w-8 h-8 text-blue-600" />
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient="gray" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Crescimento Mensal</h4>
              <div className="text-3xl font-bold text-green-600 mt-2 flex items-center">
                +{kpis.monthlyGrowth}%
                <ArrowUp className="w-6 h-6 ml-2" />
              </div>
              <p className="text-sm text-gray-600 mt-1">Comparado ao mês anterior</p>
            </div>
            <div className="p-3 bg-green-100 rounded-xl">
              <TrendingUp className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </GradientCard>

        <GradientCard gradient="gray" className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">Meta do Mês</h4>
              <div className="text-3xl font-bold text-purple-600 mt-2">87%</div>
              <p className="text-sm text-gray-600 mt-1">R$ 870k de R$ 1M</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Target className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </GradientCard>
      </div>
    </div>
  );
}


