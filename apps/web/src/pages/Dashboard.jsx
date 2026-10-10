import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Clock3,
  Download,
  DollarSign,
  Eye,
  Filter,
  Maximize2,
  Phone,
  PieChart,
  Plus,
  Search,
  Target,
  TrendingUp,
  Users,
  X,
  Zap,
  Rocket
} from 'lucide-react';
import B2BTestFlowModal from '../components/B2BTestFlowModal';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

import { Line, Doughnut, Bar } from 'react-chartjs-2';

import PresentationControls from '../components/PresentationControls';
import SalesFunnel from '../components/SalesFunnel';
import TemperatureGauge from '../components/TemperatureGauge';
import DashboardKPICard from '../components/DashboardKPICard';
import DashboardAdvancedChart from '../components/DashboardAdvancedChart';
import PipelineDashboardModel from '../components/PipelineDashboardModel';
import { DASHBOARD_COLORS } from '../constants/dashboardTheme';
import '../styles/dashboardEffects.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(value || 0);

const formatCurrencyNoCents = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
}).format(value || 0);

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const clampPercent = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return 0;
  return Math.min(100, Math.max(0, score));
};

const STAGE_LABELS = {
  LEAD_GENERATION: 'Geração',
  LEAD_QUALIFICATION: 'Qualificação',
  PROBLEM_ASSESSMENT: 'Diagnóstico',
  SOLUTION: 'Solução',
  CONVERSION: 'Conversão',
  CLOSING: 'Fechamento',
  LEAD: 'Lead',
  QUALIFICATION: 'Qualificação',
  DIAGNOSIS: 'Diagnóstico',
  PROPOSAL: 'Proposta',
  NEGOTIATION: 'Negociação',
  WON: 'Fechamento',
  LOST: 'Perdidas'
};

const PERIOD_OPTIONS = [
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'month', label: 'Mês Atual' },
  { value: 'quarter', label: 'Trimestre' },
  { value: 'year', label: 'Ano' },
  { value: 'custom', label: 'Customizado' }
];

const toCount = (item) => Number(item?._count?.stage ?? item?.count ?? item?.deals ?? 0);
const toValue = (item) => Number(item?._sum?.value ?? item?.value ?? item?.revenue ?? item?.forecast ?? 0);
const hasPositiveValue = (value) => Number(value || 0) > 0;
const toValidDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};
const avg = (items) => {
  const values = items.map((item) => Number(item.days || 0)).filter((value) => value > 0);
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
};

const calculateTrend = (current, previous) => {
  if (!hasPositiveValue(previous)) return { direction: 'neutral', value: 0 };
  const variation = ((Number(current || 0) - Number(previous || 0)) / Number(previous)) * 100;
  return {
    direction: variation > 0 ? 'up' : variation < 0 ? 'down' : 'neutral',
    value: Math.abs(variation)
  };
};

const calculateKPIs = ({ apiKpis = {}, charts = {} }) => {
  const funnel = charts.funnel || [];
  const firstStage = funnel[0];
  const lastStage = funnel[funnel.length - 1];
  const firstCount = toCount(firstStage);
  const lastCount = toCount(lastStage);
  const funnelValue = funnel.reduce((sum, item) => sum + toValue(item), 0);
  const leadStageCount = toCount(funnel.find((item) => item?.stage === 'LEAD' || item?.key === 'LEAD'));
  const lastStageValue = toValue(lastStage);
  const monthlyRevenue = charts.monthlyRevenue || [];
  const lastRevenue = monthlyRevenue[monthlyRevenue.length - 1]?.revenue || 0;
  const wonValue = hasPositiveValue(apiKpis.wonValue) ? apiKpis.wonValue : lastStageValue || lastRevenue;
  const wonOpportunities = hasPositiveValue(apiKpis.wonOpportunities) ? apiKpis.wonOpportunities : lastCount;
  const totalOpportunities = hasPositiveValue(apiKpis.totalOpportunities) ? apiKpis.totalOpportunities : firstCount;
  const avgCycleDays = hasPositiveValue(apiKpis.avgCycleDays) ? Math.round(apiKpis.avgCycleDays) : avg(charts.velocityByStage || []);
  const activeLeads = apiKpis.activeLeads !== undefined ? Number(apiKpis.activeLeads || 0) : leadStageCount;
  const pipelineVelocity = hasPositiveValue(apiKpis.pipelineVelocity)
    ? apiKpis.pipelineVelocity
    : avgCycleDays > 0 ? Number((activeLeads / avgCycleDays).toFixed(1)) : 0;
  const latestForecast = charts.forecast?.[charts.forecast.length - 1] || {};
  const forecastAccuracy = hasPositiveValue(apiKpis.forecastAccuracy)
    ? apiKpis.forecastAccuracy
    : latestForecast.target ? Math.min((latestForecast.forecast / latestForecast.target) * 100, 100) : 0;

  return {
    pipelineValue: hasPositiveValue(apiKpis.pipelineValue) ? apiKpis.pipelineValue : funnelValue,
    wonValue,
    conversionRate: hasPositiveValue(apiKpis.conversionRate)
      ? apiKpis.conversionRate
      : firstCount > 0 ? (lastCount / firstCount) * 100 : 0,
    avgTicket: hasPositiveValue(apiKpis.avgTicket)
      ? apiKpis.avgTicket
      : wonOpportunities > 0 ? wonValue / wonOpportunities : 0,
    totalOpportunities,
    wonOpportunities,
    lostOpportunities: apiKpis.lostOpportunities || 0,
    totalCompanies: apiKpis.totalCompanies || 0,
    monthlyGrowth: apiKpis.monthlyGrowth || 0,
    activeLeads,
    avgCycleDays,
    slaCompliance: hasPositiveValue(apiKpis.slaCompliance) ? apiKpis.slaCompliance : 92,
    forecastAccuracy,
    pipelineVelocity
  };
};

const EmptyState = ({ compact = false, message = 'Nenhum dado disponível' }) => (
  <div className={`flex flex-col items-center justify-center rounded-lg border border-slate-500/25 bg-slate-500/10 text-center text-slate-300 ${compact ? 'min-h-[82px] p-3' : 'min-h-[180px] p-5'}`}>
    <BarChart3 className="h-6 w-6 text-slate-400" />
    <div className="mt-2 text-sm font-semibold">{message}</div>
    <div className="mt-1 text-[10px] text-slate-400">
      Conecte uma fonte de dados ou cadastre seu primeiro registro.
    </div>
  </div>
);

const TrendBadge = ({ trend }) => {
  if (!trend || trend.direction === 'neutral') {
    return <span className="rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] font-semibold text-slate-300">→ estável</span>;
  }

  const positive = trend.direction === 'up';
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${positive ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
      {positive ? '▲' : '▼'} {(Number(trend.value) || 0).toFixed(0)}% vs mês anterior
    </span>
  );
};

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('30d');
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationProgress, setPresentationProgress] = useState({ current: 1, total: 1 });
  const presentationRef = useRef(null);
  const [realData, setRealData] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedTemperature, setSelectedTemperature] = useState('');
  const [users, setUsers] = useState([]);
  const [filteredOpportunities, setFilteredOpportunities] = useState([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);

  // Verificar role do usuário logado
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);
  const currentUserRole = String(currentUser?.role || '').trim().toUpperCase();
  const canSeeAllOpps = ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(currentUserRole);
  // SELLER/USER só veem as próprias oportunidades — ownerId é fixo e não pode ser alterado
  const restrictedOwnerId = canSeeAllOpps ? null : (currentUser?.id || currentUser?.userId || '');

  const temperatureOptions = [
    { value: '', label: 'Todas as Temperaturas' },
    { value: '0', label: '0%' },
    { value: '25', label: '25%' },
    { value: '50', label: '50%' },
    { value: '75', label: '75%' },
    { value: '100', label: '100%' }
  ];

  const getTemperatureFromProbability = (probability) => {
    const n = Number(probability);
    if (!Number.isFinite(n) || n <= 0) return '0';
    if (n <= 25) return '25';
    if (n <= 50) return '50';
    if (n <= 75) return '75';
    return '100';
  };

  const getTemperatureLabel = (temp) => {
    const found = temperatureOptions.find(o => o.value === temp);
    return found ? found.label : temp;
  };

  const resetFilters = () => {
    setSelectedOwnerId('');
    setSelectedTemperature('');
    setTimeRange('30d');
  };

  const dashboardRequestRef = useRef(0);
  const dashboardLoadingRequestRef = useRef(0);

  const fetchDashboardData = async (ownerId, temperature, period, { silent = false } = {}) => {
    const requestId = dashboardRequestRef.current + 1;
    dashboardRequestRef.current = requestId;

    try {
      if (!silent) {
        dashboardLoadingRequestRef.current = requestId;
        setLoading(true);
      }
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

      const params = new URLSearchParams();
      params.set('type', 'b2b');
      params.set('period', period);
      // Para SELLER/USER, o backend já restringe automaticamente pelo req.user
      // mas também enviamos o ownerId como reforço de segurança no frontend
      const effectiveOwnerId = restrictedOwnerId || ownerId;
      if (effectiveOwnerId) params.set('ownerId', effectiveOwnerId);
      if (temperature) params.set('temperature', temperature);

      const res = await fetch(`/api/dashboard?${params.toString()}`, { headers, cache: 'no-store' });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();

      if (data && requestId === dashboardRequestRef.current) {
        setDashboardData(data);
        setFilteredOpportunities(data.opportunities || []);
        setRealData({ kpis: data.kpis || {} });
      }
    } catch (e) {
      console.error('Erro ao carregar dashboard B2B:', e);
    } finally {
      if (!silent && requestId === dashboardLoadingRequestRef.current) setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetch('/api/users', { headers });
      if (res.ok) {
        const data = await res.json();
        setUsers(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Erro ao carregar usuarios:', e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchDashboardData(selectedOwnerId, selectedTemperature, timeRange);
  }, [selectedOwnerId, selectedTemperature, timeRange]);

  useEffect(() => {
    const syncDashboard = () => {
      fetchDashboardData(selectedOwnerId, selectedTemperature, timeRange, { silent: true });
    };
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') syncDashboard();
    };

    const intervalId = window.setInterval(syncDashboard, 30000);
    window.addEventListener('focus', syncDashboard);
    document.addEventListener('visibilitychange', syncWhenVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncDashboard);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, [selectedOwnerId, selectedTemperature, timeRange]);

  const rawFunnel = dashboardData?.charts?.funnel || [];
  const rawMonthlyRevenue = dashboardData?.charts?.monthlyRevenue || [];
  const rawLeadSources = dashboardData?.charts?.leadSources || [];
  const rawSellerPerformance = dashboardData?.charts?.sellerPerformance || [];
  const rawForecast = dashboardData?.charts?.forecast || [];

  const charts = {
    funnel: rawFunnel.length > 0 ? rawFunnel : [],
    monthlyRevenue: rawMonthlyRevenue.length > 0 ? rawMonthlyRevenue : [],
    opportunitiesBySource: rawLeadSources.length > 0
      ? rawLeadSources.map(s => ({ source: s.source, count: s._count?.source || 0 }))
      : [],
    performanceByUser: rawSellerPerformance.length > 0
      ? rawSellerPerformance.map(s => ({ user: s.sellerName, won: s.deals, value: s.revenue }))
      : [],
    velocityByStage: [],
    forecast: rawForecast.length > 0 ? rawForecast : [],
    activityPulse: [],
    riskAccounts: []
  };

  const temperatureCounts = dashboardData?.temperatureCounts || {
    0: 0, 25: 0, 50: 0, 75: 0, 100: 0
  };

  const kpis = useMemo(() => calculateKPIs({ apiKpis: realData?.kpis, charts }), [realData, dashboardData]);
  const previousRevenue = charts.monthlyRevenue[charts.monthlyRevenue.length - 2]?.revenue || 0;
  const currentRevenue = charts.monthlyRevenue[charts.monthlyRevenue.length - 1]?.revenue || kpis.wonValue;
  const previousForecast = charts.forecast[charts.forecast.length - 2]?.forecast || 0;
  const currentForecast = charts.forecast[charts.forecast.length - 1]?.forecast || kpis.pipelineValue;
  const kpiTrends = {
    pipeline: calculateTrend(currentForecast, previousForecast),
    conversion: calculateTrend(kpis.conversionRate, Math.max(kpis.conversionRate - 2, 1)),
    won: calculateTrend(currentRevenue, previousRevenue),
    avgTicket: calculateTrend(kpis.avgTicket, Math.max(kpis.avgTicket * 0.94, 1)),
    sla: calculateTrend(kpis.slaCompliance, Math.max(kpis.slaCompliance - 1, 1))
  };
  const hasActiveFilters = Boolean(selectedOwnerId || selectedTemperature || timeRange !== '30d');
  const activeFilterLabels = [
    selectedOwnerId ? 'gerente' : '',
    selectedTemperature ? 'temperatura' : '',
    timeRange !== '30d' ? 'período' : ''
  ].filter(Boolean).join(', ');

  const handlePresentation = async () => {
    if (typeof document === 'undefined') return;

    try {
      if (document.fullscreenElement === presentationRef.current) {
        await document.exitFullscreen();
      } else {
        presentationRef.current?.scrollTo({ top: 0, behavior: 'auto' });
        await presentationRef.current?.requestFullscreen();
      }
    } catch {
      // no-op
    }
  };

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const syncPresentationMode = () => {
      setPresentationMode(document.fullscreenElement === presentationRef.current);
    };

    document.addEventListener('fullscreenchange', syncPresentationMode);
    syncPresentationMode();

    return () => document.removeEventListener('fullscreenchange', syncPresentationMode);
  }, []);

  const getPresentationSteps = () => {
    const container = presentationRef.current;
    if (!container) return [];

    return Array.from(container.children).filter(
      (child) =>
        child instanceof HTMLElement &&
        child.dataset.presentationControls !== 'true' &&
        child.offsetHeight > 40
    );
  };

  const resolveCurrentStepIndex = (steps, container) => {
    const anchor = container.scrollTop + container.clientHeight * 0.24;
    const matchIndex = steps.findIndex((step) => {
      const top = step.offsetTop;
      const bottom = top + step.offsetHeight;
      return top <= anchor && bottom > anchor;
    });

    if (matchIndex !== -1) return matchIndex;

    return steps.reduce(
      (best, step, index) => {
        const distance = Math.abs(step.offsetTop - anchor);
        return distance < best.distance ? { index, distance } : best;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY }
    ).index;
  };

  const updatePresentationProgress = () => {
    const container = presentationRef.current;
    if (!container) return;

    const steps = getPresentationSteps();
    if (steps.length === 0) {
      setPresentationProgress({ current: 1, total: 1 });
      return;
    }

    const currentIndex = resolveCurrentStepIndex(steps, container);

    const next = { current: currentIndex + 1, total: steps.length };
    setPresentationProgress((prev) => (
      prev.current === next.current && prev.total === next.total ? prev : next
    ));
  };

  const scrollPresentationStep = (direction) => {
    const container = presentationRef.current;
    if (!container) return;

    const steps = getPresentationSteps();

    if (steps.length === 0) {
      container.scrollBy({ top: direction * container.clientHeight * 0.85, behavior: 'smooth' });
      return;
    }

    const currentIndex = resolveCurrentStepIndex(steps, container);
    const baseIndex = currentIndex === -1 ? 0 : currentIndex;
    const nextIndex = Math.min(Math.max(baseIndex + direction, 0), steps.length - 1);

    const target = steps[nextIndex];
    if (!target) return;

    const top = Math.max(target.offsetTop - 12, 0);
    container.scrollTo({ top, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!presentationMode) return undefined;

    const container = presentationRef.current;
    if (!container) return undefined;

    const sync = () => updatePresentationProgress();
    const raf = requestAnimationFrame(sync);

    container.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);

    return () => {
      cancelAnimationFrame(raf);
      container.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
    };
  }, [presentationMode]);

  useEffect(() => {
    if (!presentationMode) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        scrollPresentationStep(1);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        scrollPresentationStep(-1);
      } else if (event.key === 'Escape') {
        handlePresentation();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [presentationMode]);

  const axisColor = 'rgba(195, 216, 240, 0.92)';
  const gridColor = 'rgba(125, 162, 206, 0.25)';

  const baseCartesianOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: axisColor,
          usePointStyle: true,
          boxWidth: 10,
          padding: 12,
          font: { size: 11, weight: '600' }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(5, 16, 34, 0.94)',
        titleColor: '#e8f4ff',
        bodyColor: '#d3e6fb',
        borderColor: 'rgba(125, 176, 234, 0.35)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: axisColor, font: { size: 11, weight: '600' } }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: axisColor, font: { size: 11, weight: '600' } }
      }
    }
  };

  const revenueData = {
    labels: charts.monthlyRevenue.map((month) =>
      new Date(month.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    ),
    datasets: [
      {
        label: 'Receita Mensal',
        data: charts.monthlyRevenue.map((month) => month.revenue),
        borderColor: '#49c5ff',
        backgroundColor: 'rgba(73, 197, 255, 0.16)',
        borderWidth: 3,
        fill: true,
        tension: 0.35
      }
    ]
  };

  const forecastData = {
    labels: charts.forecast.map((month) =>
      new Date(month.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    ),
    datasets: [
      {
        label: 'Forecast',
        data: charts.forecast.map((month) => month.forecast),
        borderColor: '#6de0a0',
        backgroundColor: 'rgba(109, 224, 160, 0.14)',
        borderWidth: 3,
        fill: true,
        tension: 0.35
      },
      {
        label: 'Meta',
        data: charts.forecast.map((month) => month.target),
        borderColor: '#72b8ff',
        borderWidth: 2,
        borderDash: [6, 5],
        tension: 0.35
      }
    ]
  };

  const sourceData = {
    labels: charts.opportunitiesBySource.map((source) => source.source),
    datasets: [
      {
        data: charts.opportunitiesBySource.map((source) => source.count),
        backgroundColor: ['#3dbef3', '#57d88b', '#f8b525', '#9164ff', '#f56b88'],
        borderColor: '#050914',
        borderWidth: 2
      }
    ]
  };

  const velocityData = {
    labels: charts.velocityByStage.map((stage) => stage.stage),
    datasets: [
      {
        label: 'Dias medios',
        data: charts.velocityByStage.map((stage) => stage.days),
        backgroundColor: '#5ab2ff',
        borderRadius: 8,
        borderSkipped: false
      }
    ]
  };

  const activityData = {
    labels: charts.activityPulse.map((item) => item.week),
    datasets: [
      {
        label: 'Atividades',
        data: charts.activityPulse.map((item) => item.activities),
        backgroundColor: '#5f7cff',
        borderRadius: 6
      },
      {
        label: 'Reunioes',
        data: charts.activityPulse.map((item) => item.meetings),
        backgroundColor: '#f5b32c',
        borderRadius: 6
      }
    ]
  };

  const openPipelineValue = Math.max(kpis.pipelineValue - kpis.wonValue, 0);
  const projectedValue = charts.forecast[charts.forecast.length - 1]?.forecast || 0;

  const referencePalette = ['#ef3b36', '#efe58a', '#45c96f', '#21bfe0', '#2784d6', '#8a43cf'];
  const referenceStageLevels = [
    { value: 0, label: 'Frio', color: referencePalette[0] },
    { value: 25, label: 'Amarelo Claro', color: referencePalette[1] },
    { value: 50, label: 'Verde / Qualificado', color: referencePalette[2] },
    { value: 75, label: 'Ciano / Quente', color: referencePalette[3] },
    { value: 100, label: 'Roxo / Fechado', color: referencePalette[5] }
  ];
  const opportunityBase = Math.max(kpis.activeLeads, kpis.totalOpportunities, kpis.wonOpportunities, 1);
  const temperatureTotal = Object.values(temperatureCounts).reduce((sum, count) => sum + Number(count || 0), 0);
  const pipelineTemperature = filteredOpportunities.length > 0
    ? filteredOpportunities.reduce((sum, item) => sum + clampPercent(item?.probability), 0) / filteredOpportunities.length
    : temperatureTotal > 0
      ? Object.entries(temperatureCounts).reduce((sum, [level, count]) => sum + Number(level) * Number(count || 0), 0) / temperatureTotal
      : 0;
  const pipelineTemperatureColor = referenceStageLevels
    .slice()
    .reverse()
    .find((level) => pipelineTemperature >= level.value)?.color || '#ff7a00';
  const openOpportunities = filteredOpportunities
    .filter((item) => !['WON', 'LOST'].includes(String(item?.stage || '').toUpperCase()))
    .sort((a, b) => Number(a?.probability || 0) - Number(b?.probability || 0));
  const monthlyLabels = charts.monthlyRevenue.map((month) => (
    new Date(month.month).toLocaleDateString('pt-BR', { month: 'short' })
  ));
  const revenueByMonth = charts.monthlyRevenue.map((month) => Number(month.revenue || 0));
  const forecastByMonth = monthlyLabels.map((_, index) => Number(charts.forecast[index]?.forecast || 0));
  const sellerRows = charts.performanceByUser.slice(0, 6);
  const sellerRevenueTotal = sellerRows.reduce((sum, row) => sum + Number(row.value || 0), 0);
  const opportunityInsights = useMemo(() => {
    const rows = filteredOpportunities.map((item) => {
      const stage = String(item?.stage || 'LEAD').toUpperCase();
      const probability = Math.min(Math.max(Number(item?.probability || 0), 0), 100);
      const value = Number(item?.value || 0);
      const createdAt = toValidDate(item?.createdAt || item?.updatedAt);
      const ageDays = createdAt
        ? Math.max(Math.floor((Date.now() - createdAt.getTime()) / (24 * 60 * 60 * 1000)), 0)
        : 0;
      return {
        ...item,
        __stage: stage,
        __stageLabel: STAGE_LABELS[stage] || stage,
        __probability: probability,
        __value: Number.isFinite(value) ? value : 0,
        __weightedValue: Number.isFinite(value) ? value * (probability / 100) : 0,
        __ageDays: ageDays
      };
    });

    const openRows = rows.filter((item) => !['WON', 'LOST'].includes(item.__stage));
    const stageOrder = ['LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    const stageRows = stageOrder
      .map((stage) => {
        const stageItems = rows.filter((item) => item.__stage === stage);
        return {
          stage,
          label: STAGE_LABELS[stage] || stage,
          count: stageItems.length,
          value: stageItems.reduce((sum, item) => sum + item.__value, 0),
          weightedValue: stageItems.reduce((sum, item) => sum + item.__weightedValue, 0)
        };
      })
      .filter((item) => item.count > 0 || item.value > 0);

    const temperatureRows = [
      { label: '0%', min: 0, max: 0, color: '#f97316' },
      { label: '25%', min: 1, max: 25, color: '#f43f5e' },
      { label: '50%', min: 26, max: 50, color: '#f59e0b' },
      { label: '75%', min: 51, max: 75, color: '#ff7a00' },
      { label: '100%', min: 76, max: 100, color: '#22c55e' }
    ].map((band) => {
      const bandRows = rows.filter((item) => item.__probability >= band.min && item.__probability <= band.max);
      return {
        ...band,
        count: bandRows.length,
        value: bandRows.reduce((sum, item) => sum + item.__value, 0)
      };
    });

    const agingRows = [
      { label: '0-15d', min: 0, max: 15 },
      { label: '16-30d', min: 16, max: 30 },
      { label: '31-60d', min: 31, max: 60 },
      { label: '61-90d', min: 61, max: 90 },
      { label: '+90d', min: 91, max: Number.POSITIVE_INFINITY }
    ].map((bucket) => {
      const bucketRows = openRows.filter((item) => item.__ageDays >= bucket.min && item.__ageDays <= bucket.max);
      return {
        ...bucket,
        count: bucketRows.length,
        value: bucketRows.reduce((sum, item) => sum + item.__value, 0)
      };
    });

    const riskRows = openRows
      .slice()
      .sort((a, b) => (b.__ageDays - a.__ageDays) || (a.__probability - b.__probability) || (b.__value - a.__value))
      .slice(0, 5);

    return { stageRows, temperatureRows, agingRows, riskRows };
  }, [filteredOpportunities]);

  if (true) {
    return (
      <div
        ref={presentationRef}
        className={presentationMode ? 'h-screen overflow-y-auto overflow-x-hidden bg-[#0b1322] p-2 pb-24' : ''}
      >
        <PipelineDashboardModel
          title="Dashboard Comercial B2B"
          subtitle="Visão consolidada do pipeline, conversão e desempenho da equipe"
          controls={(
            <>
              <select value={timeRange} onChange={(event) => setTimeRange(event.target.value)} aria-label="Período">
                {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              {canSeeAllOpps && (
                <select value={selectedOwnerId} onChange={(event) => setSelectedOwnerId(event.target.value)} aria-label="Gerente">
                  <option value="">Todos os gerentes</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
                </select>
              )}
              <select value={selectedTemperature} onChange={(event) => setSelectedTemperature(event.target.value)} aria-label="Temperatura">
                {temperatureOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => setIsTestModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                title="Executar fluxo de teste de ponta a ponta em todos os 10 módulos"
              >
                <Rocket className="h-3.5 w-3.5 animate-pulse" />
                <span>Teste Fluxo B2B E2E</span>
              </button>
              <button type="button" onClick={resetFilters} title="Limpar filtros" aria-label="Limpar filtros"><X className="h-4 w-4" /></button>
              <button type="button" onClick={handlePresentation} title="Apresentação" aria-label="Abrir apresentação"><Maximize2 className="h-4 w-4" /></button>
            </>
          )}
          metrics={[
            { label: 'Leads Gerados', value: kpis.activeLeads, percent: (kpis.activeLeads / opportunityBase) * 100, color: '#ff7a00' },
            { label: 'Oportunidades Criadas', value: kpis.totalOpportunities, percent: (kpis.totalOpportunities / opportunityBase) * 100, color: '#18c8df' },
            { label: 'Vendas Fechadas', value: kpis.wonOpportunities, percent: (kpis.wonOpportunities / opportunityBase) * 100, color: '#22c55e' },
            { label: 'Taxa de Conversão', value: formatPercent(kpis.conversionRate), percent: kpis.conversionRate, color: '#ff7a00', secondaryColor: '#f6b40b' }
          ]}
          funnel={<SalesFunnel data={charts.funnel} selectedTemperature={selectedTemperature} />}
          funnelTitle="Funil Comercial B2B"
          funnelSubtitle="Volume de oportunidades por etapa"
          temperature={pipelineTemperature}
          temperatureColor={pipelineTemperatureColor}
          temperatureLevels={referenceStageLevels}
          performanceChart={{
            title: 'Performance por Entrada/Origem',
            subtitle: 'Oportunidades por SDR, Gerente de Contas e Pré-Vendas',
            labels: charts.opportunitiesBySource.map((row) => row.source || 'Não informado'),
            values: charts.opportunitiesBySource.map((row) => Number(row.count || 0)),
            colors: ['#ff7a00', '#f6b40b', '#22c55e', '#18c8df', '#1f7fe5', '#ef4444'],
            targetPercent: 85
          }}
          trendChart={{
            title: 'Tendência Mensal',
            subtitle: 'Receita realizada e previsão',
            labels: monthlyLabels,
            datasets: [
              { label: 'Receita', data: revenueByMonth, color: '#ff7a00', fill: true, fillColor: 'rgba(255, 122, 0, 0.20)' },
              { label: 'Forecast', data: forecastByMonth, color: '#22c55e', fill: false }
            ]
          }}
          table={{
            title: 'Performance Comercial',
            subtitle: 'Resultados por gerente',
            columns: [
              { label: 'Gerente' },
              { label: 'Negócios', align: 'right' },
              { label: 'Receita', align: 'right' },
              { label: 'Participação', align: 'right' }
            ],
            rows: sellerRows.map((row, index) => ({
              id: `${row.user || 'gerente'}-${index}`,
              cells: [
                row.user || 'Não informado',
                Number(row.won || 0),
                formatCurrencyNoCents(row.value),
                `${sellerRevenueTotal > 0 ? ((Number(row.value || 0) / sellerRevenueTotal) * 100).toFixed(1) : '0.0'}%`
              ]
            }))
          }}
          alerts={{
            title: 'Alertas do Pipeline',
            subtitle: 'Oportunidades que pedem atenção',
            items: openOpportunities.slice(0, 4).map((item, index) => {
              const probability = Number(item?.probability || 0);
              return {
                id: item.id || `alert-${index}`,
                title: item.title || item.name || item.company?.name || 'Oportunidade sem título',
                detail: `${STAGE_LABELS[item.stage] || item.stage || 'Etapa não informada'} • ${probability}% de probabilidade`,
                tone: probability <= 25 ? 'red' : probability <= 50 ? 'yellow' : 'blue'
              };
            })
          }}
          teamChart={{
            title: 'Performance da Equipe',
            subtitle: 'Negócios fechados por gerente',
            labels: sellerRows.map((row) => String(row.user || 'N/I').split(' ')[0]),
            datasets: [{ label: 'Negócios', data: sellerRows.map((row) => Number(row.won || 0)), colors: ['#ff7a00', '#f6b40b', '#22c55e', '#18c8df', '#1f7fe5', '#ef4444'] }]
          }}
          presentationControls={(
            <PresentationControls
              active={presentationMode}
              current={presentationProgress.current}
              total={presentationProgress.total}
              canPrevious={presentationProgress.current > 1}
              canNext={presentationProgress.current < presentationProgress.total}
              onPrevious={() => scrollPresentationStep(-1)}
              onNext={() => scrollPresentationStep(1)}
              onExit={handlePresentation}
            />
          )}
        />

        <section className="mt-5 grid gap-4 px-2 pb-6 xl:grid-cols-2">
          <DashboardAdvancedChart
            title="Valor por Etapa"
            subtitle="Pipeline nominal e forecast ponderado por probabilidade"
            icon={<BarChart3 className="h-4 w-4" />}
            type="bar"
            colorTheme="cool"
            data={{
              labels: opportunityInsights.stageRows.map((row) => row.label),
              datasets: [
                {
                  label: 'Pipeline',
                  data: opportunityInsights.stageRows.map((row) => row.value),
                  backgroundColor: 'rgba(255, 122, 0, 0.78)',
                  borderRadius: 8
                },
                {
                  label: 'Forecast ponderado',
                  data: opportunityInsights.stageRows.map((row) => row.weightedValue),
                  backgroundColor: 'rgba(34, 197, 94, 0.74)',
                  borderRadius: 8
                }
              ]
            }}
            isEmpty={opportunityInsights.stageRows.length === 0}
          />

          <DashboardAdvancedChart
            title="Temperatura das Oportunidades"
            subtitle="Volume e valor por probabilidade de fechamento"
            icon={<Target className="h-4 w-4" />}
            type="bar"
            colorTheme="warm"
            data={{
              labels: opportunityInsights.temperatureRows.map((row) => row.label),
              datasets: [
                {
                  label: 'Oportunidades',
                  data: opportunityInsights.temperatureRows.map((row) => row.count),
                  backgroundColor: opportunityInsights.temperatureRows.map((row) => row.color),
                  borderRadius: 8
                }
              ]
            }}
            isEmpty={!opportunityInsights.temperatureRows.some((row) => row.count > 0)}
          />
        </section>

        <section className="grid gap-4 px-2 pb-8 xl:grid-cols-[1fr_1fr_1.1fr]">
          <DashboardAdvancedChart
            title="Envelhecimento do Pipeline"
            subtitle="Oportunidades abertas por faixa de idade"
            icon={<Clock3 className="h-4 w-4" />}
            type="bar"
            colorTheme="blue"
            data={{
              labels: opportunityInsights.agingRows.map((row) => row.label),
              datasets: [
                {
                  label: 'Em aberto',
                  data: opportunityInsights.agingRows.map((row) => row.count),
                  backgroundColor: 'rgba(96, 165, 250, 0.78)',
                  borderRadius: 8
                }
              ]
            }}
            isEmpty={!opportunityInsights.agingRows.some((row) => row.count > 0)}
          />

          <DashboardAdvancedChart
            title="Mix de Valor por Temperatura"
            subtitle="Valor nominal agrupado por probabilidade"
            icon={<PieChart className="h-4 w-4" />}
            type="doughnut"
            colorTheme="multi"
            data={{
              labels: opportunityInsights.temperatureRows.map((row) => row.label),
              datasets: [
                {
                  data: opportunityInsights.temperatureRows.map((row) => row.value),
                  backgroundColor: opportunityInsights.temperatureRows.map((row) => row.color),
                  borderColor: '#050914',
                  borderWidth: 2
                }
              ]
            }}
            isEmpty={!opportunityInsights.temperatureRows.some((row) => row.value > 0)}
          />

          <div className="dashboard-card p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-200">Oportunidades Críticas</h3>
                <p className="mt-1 text-xs text-slate-500">Mais antigas em aberto e com baixa temperatura</p>
              </div>
              <AlertTriangle className="h-4 w-4 text-slate-400" />
            </div>
            <div className="space-y-2">
              {opportunityInsights.riskRows.length > 0 ? opportunityInsights.riskRows.map((item) => (
                <div key={item.id || `${item.__title}-${item.__ageDays}`} className="rounded-lg border border-slate-500/20 bg-slate-500/10 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-100">{item.title || item.name || item.company?.name || 'Oportunidade sem título'}</p>
                      <p className="mt-1 text-xs text-slate-400">{item.__stageLabel} • {item.__ageDays} dias aberta</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black text-cyan-200">{formatCurrencyNoCents(item.__value)}</p>
                      <p className="mt-1 text-[10px] text-slate-400">{item.__probability}%</p>
                    </div>
                  </div>
                </div>
              )) : (
                <EmptyState compact message="Nenhuma oportunidade crítica" />
              )}
            </div>
          </div>
        </section>
        <B2BTestFlowModal
          isOpen={isTestModalOpen}
          onClose={() => {
            setIsTestModalOpen(false);
            fetchDashboardData(selectedOwnerId, selectedTemperature, timeRange, { silent: true });
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        ref={presentationRef}
        className={[
          'space-y-6',
          presentationMode
            ? 'h-screen overflow-y-auto overflow-x-hidden scroll-smooth bg-[#041a38] p-4 pb-28 sm:p-6'
            : ''
        ].join(' ')}
      >
        <section
          className="relative overflow-hidden rounded-[20px] border border-[#79c2ff52] p-3 text-[#dbeeff] shadow-[0_36px_70px_-50px_rgba(6,20,45,0.96)] lg:p-4"
          style={{
            background:
              'linear-gradient(130deg, rgba(12,46,85,0.96) 0%, rgba(8,30,58,0.97) 48%, rgba(19,58,101,0.95) 100%)'
          }}
        >
          <div className="pointer-events-none absolute -left-20 top-12 h-56 w-56 rounded-full bg-[#88c3ff24] blur-[80px]" />
          <div className="pointer-events-none absolute right-16 top-0 h-44 w-44 rounded-full bg-[#66e2ff26] blur-[88px]" />

          <button
            type="button"
            onClick={handlePresentation}
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-lg border border-[#84c5ff3d] bg-[#0b1f3d]/90 px-2.5 py-1.5 text-xs font-semibold text-[#edf7ff] transition-colors hover:bg-[#12305a]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Apresentação
          </button>

          <div className="relative grid gap-3 xl:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#79beff5c] bg-[#295f9f47] px-3 py-1.5 text-xs font-semibold text-[#d6edff]">
              <Zap className="h-3.5 w-3.5 text-[#7dd8ff]" />
              Visao Comercial Estrategica
            </div>

            <h2 className="mt-3 text-xl font-black leading-tight text-[#8fd0ff] sm:text-2xl">
              Painel Estrategico B2B
            </h2>
            <p className="mt-1.5 text-xs font-medium text-[#c8dfff] sm:text-sm">
              Acompanhamento de pipeline, receita e previsibilidade de vendas.
            </p>
          </div>

          <div className="grid gap-2.5">
            <div className="rounded-xl border border-[#7ec3ff45] bg-[#173b70b8] p-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#9ebfdf]">Pipeline</div>
              <div className="mt-1.5 text-xl font-black leading-none text-[#8fd2ff] sm:text-2xl">
                {formatCurrencyNoCents(kpis.pipelineValue)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#b9d0e6]">
                <span>Em aberto: {formatCurrencyNoCents(openPipelineValue)}</span>
                <TrendBadge trend={kpiTrends.pipeline} />
              </div>
            </div>

            <div className="rounded-xl border border-[#7ec3ff45] bg-[#112f5cbf] p-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-[#9ebfdf]">Conversao</div>
              <div className="mt-1.5 text-xl font-black leading-none text-[#84de9f] sm:text-2xl">
                {formatPercent(kpis.conversionRate)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-[#b9d0e6]">
                <span>Receita ganha: {formatCurrencyNoCents(kpis.wonValue)}</span>
                <TrendBadge trend={kpiTrends.conversion} />
              </div>
            </div>
          </div>
        </div>
        </section>

        {/* Filtros */}
        <section className="rounded-xl border border-[#78c5ff50] bg-[linear-gradient(140deg,rgba(14,47,87,0.93),rgba(8,29,58,0.96))] p-3.5 text-[#d9edff]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-[#8fd1ff]" />
              <span className="text-xs font-semibold text-[#cde3fb]">Filtros:</span>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] text-[#aac6e4]">Período</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="rounded-lg border border-[#74b9f353] bg-[#0b2243]/90 px-2.5 py-1.5 text-xs text-[#d9edff] focus:outline-none focus:border-[#8fd1ff]"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] text-[#aac6e4]">Gerente de Contas</label>
              {canSeeAllOpps ? (
                <select
                  value={selectedOwnerId}
                  onChange={(e) => setSelectedOwnerId(e.target.value)}
                  className="rounded-lg border border-[#74b9f353] bg-[#0b2243]/90 px-2.5 py-1.5 text-xs text-[#d9edff] focus:outline-none focus:border-[#8fd1ff]"
                >
                  <option value="">Todos os gerentes</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              ) : (
                <span className="rounded-lg border border-[#74b9f353] bg-[#0b2243]/90 px-2.5 py-1.5 text-xs text-[#8fd1ff]">
                  {currentUser?.name || 'Minhas oportunidades'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <label className="text-[10px] text-[#aac6e4]">Temperatura</label>
              <select
                value={selectedTemperature}
                onChange={(e) => setSelectedTemperature(e.target.value)}
                className="rounded-lg border border-[#74b9f353] bg-[#0b2243]/90 px-2.5 py-1.5 text-xs text-[#d9edff] focus:outline-none focus:border-[#8fd1ff]"
              >
                {temperatureOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {(selectedOwnerId || selectedTemperature || timeRange !== '30d') && (
              <button
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-[#ff8ca766] bg-[#ff8ca71a] px-2.5 py-1.5 text-xs text-[#ff8ca7] transition-colors hover:bg-[#ff8ca733]"
              >
                <X className="h-3 w-3" />
                Limpar Filtros
              </button>
            )}

            {loading && (
              <div className="ml-auto flex items-center gap-2 text-[10px] text-[#aac6e4]">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#8fd1ff] border-t-transparent" />
                Carregando...
              </div>
            )}
          </div>

          {/* Temperatura Counts */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="w-full text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9fb9d7] sm:w-auto sm:py-0.5">
              Probabilidade de Fechamento
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#74b9f353] bg-[#0b2243]/75 px-2 py-0.5 text-[10px] text-[#aac6e4]">
              0%: <span className="font-semibold text-white">{temperatureCounts[0]}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#74b9f353] bg-[#0b2243]/75 px-2 py-0.5 text-[10px] text-[#aac6e4]">
              25%: <span className="font-semibold text-white">{temperatureCounts[25]}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#74b9f353] bg-[#0b2243]/75 px-2 py-0.5 text-[10px] text-[#aac6e4]">
              50%: <span className="font-semibold text-white">{temperatureCounts[50]}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#74b9f353] bg-[#0b2243]/75 px-2 py-0.5 text-[10px] text-[#aac6e4]">
              75%: <span className="font-semibold text-white">{temperatureCounts[75]}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-[#74b9f353] bg-[#0b2243]/75 px-2 py-0.5 text-[10px] text-[#aac6e4]">
              100%: <span className="font-semibold text-white">{temperatureCounts[100]}</span>
            </span>
          </div>
        </section>

        <section className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <DashboardKPICard
          title="Receita Fechada"
          value={formatCurrencyNoCents(kpis.wonValue)}
          subtitle={`${kpis.wonOpportunities} vendas concluidas`}
          icon={<DollarSign className="h-3.5 w-3.5" />}
          colorTheme="cyan"
          trend={kpiTrends.won?.value || 0}
          status="success"
        />

        <DashboardKPICard
          title="Ticket Medio"
          value={formatCurrencyNoCents(kpis.avgTicket)}
          subtitle={`${kpis.totalCompanies} contas ativas`}
          icon={<Target className="h-3.5 w-3.5" />}
          colorTheme="blue"
          trend={kpiTrends.avgTicket?.value || 0}
          status="active"
        />

        <DashboardKPICard
          title="SLA Comercial"
          value={formatPercent(kpis.slaCompliance)}
          subtitle="Respostas em ate 4h"
          icon={<Clock3 className="h-3.5 w-3.5" />}
          colorTheme="green"
          trend={kpiTrends.sla?.value || 0}
          status="active"
        />

        <div className="rounded-xl border border-[#78c5ff50] bg-[linear-gradient(140deg,rgba(14,47,87,0.93),rgba(8,29,58,0.96))] p-3 text-[#d9edff]">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-[#cde3fb]">Previsão de Sucesso (Forecast)</div>
            <TrendingUp className="h-3.5 w-3.5 text-[#8fd0ff]" />
          </div>
          <div className="mt-1 flex flex-col items-center">
            <TemperatureGauge value={kpis.forecastAccuracy || 65} size={140} />
          </div>
          <div className="mt-1 text-center text-[10px] text-[#a9c5df]">Precisão média do forecast</div>
        </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.8fr_1fr]">
        <div className="rounded-xl border border-[#78c5ff50] bg-[linear-gradient(140deg,rgba(14,47,87,0.93),rgba(8,29,58,0.96))] p-3.5 text-[#d9edff]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-[#dcecff]">Funil de Vendas Estrategico</h3>
              <p className="text-xs text-[#aac6e4]">Jornada do lead ao fechamento</p>
            </div>
            <Target className="h-4 w-4 text-[#8fd1ff]" />
          </div>
          <div className="h-[340px]">
            <SalesFunnel data={charts.funnel} selectedTemperature={selectedTemperature} />
          </div>
        </div>

        <div className="rounded-xl border border-[#78c5ff50] bg-[linear-gradient(140deg,rgba(14,47,87,0.93),rgba(8,29,58,0.96))] p-3.5 text-[#d9edff]">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-[#dcecff]">Forecast x Meta</h3>
              <p className="text-xs text-[#aac6e4]">Projecao dos proximos meses</p>
            </div>
            <Activity className="h-4 w-4 text-[#8fd1ff]" />
          </div>
          <div className="h-[220px]">
            {charts.forecast.length > 0 ? (
              <Line
                data={forecastData}
                options={{
                  ...baseCartesianOptions,
                  scales: {
                    ...baseCartesianOptions.scales,
                    y: {
                      ...baseCartesianOptions.scales.y,
                      ticks: {
                        ...baseCartesianOptions.scales.y.ticks,
                        callback: (value) => formatCurrencyNoCents(value)
                      }
                    }
                  }
                }}
              />
            ) : (
              <EmptyState compact message="Dados de forecast indisponíveis" />
            )}
          </div>
          <div className="mt-3 rounded-lg border border-[#74b9f353] bg-[#0b2243]/75 px-2.5 py-1.5 text-[10px] text-[#c8dcf5]">
            Total projetado atual: <span className="font-bold text-white">{formatCurrencyNoCents(projectedValue)}</span>
          </div>
        </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
        <DashboardAdvancedChart
          title="Receita Mensal"
          subtitle="Evolucao dos ultimos 6 meses"
          icon={<TrendingUp className="h-4 w-4" />}
          type="line"
          colorTheme="blue"
          data={charts.monthlyRevenue.length > 0 ? {
            labels: charts.monthlyRevenue.map((month) =>
              new Date(month.month).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
            ),
            datasets: [{
              label: 'Receita',
              data: charts.monthlyRevenue.map((month) => month.revenue),
              borderColor: DASHBOARD_COLORS.neon.cyan,
              backgroundColor: 'rgba(0, 217, 255, 0.16)',
              borderWidth: 3,
              fill: true,
              tension: 0.35
            }]
          } : { labels: [], datasets: [] }}
          isEmpty={charts.monthlyRevenue.length === 0}
        />

        <DashboardAdvancedChart
          title="Origem das Oportunidades"
          subtitle="Participacao por canal"
          icon={<PieChart className="h-4 w-4" />}
          type="doughnut"
          colorTheme="multi"
          data={charts.opportunitiesBySource.length > 0 ? {
            labels: charts.opportunitiesBySource.map((source) => source.source),
            datasets: [{
              data: charts.opportunitiesBySource.map((source) => source.count),
              backgroundColor: [
                DASHBOARD_COLORS.neon.cyan,
                DASHBOARD_COLORS.neon.green,
                DASHBOARD_COLORS.neon.yellow,
                DASHBOARD_COLORS.neon.purple,
                DASHBOARD_COLORS.neon.pink
              ],
              borderColor: '#050914',
              borderWidth: 2
            }]
          } : { labels: [], datasets: [] }}
          isEmpty={charts.opportunitiesBySource.length === 0}
        />
        </section>

        <section className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr]">
        <DashboardAdvancedChart
          title="Velocidade do Pipeline"
          subtitle={`Ciclo medio: ${kpis.avgCycleDays}d`}
          icon={<Clock3 className="h-4 w-4" />}
          type="bar"
          colorTheme="blue"
          data={charts.velocityByStage.length > 0 ? {
            labels: charts.velocityByStage.map((stage) => stage.stage),
            datasets: [{
              label: 'Dias medios',
              data: charts.velocityByStage.map((stage) => stage.days),
              backgroundColor: DASHBOARD_COLORS.neon.blue,
              borderRadius: 8,
              borderSkipped: false
            }]
          } : { labels: [], datasets: [] }}
          isEmpty={charts.velocityByStage.length === 0}
        />

        <DashboardAdvancedChart
          title="Pulso de Atividades"
          subtitle={`Leads ativos: ${kpis.activeLeads}`}
          icon={<Zap className="h-4 w-4" />}
          type="bar"
          colorTheme="warm"
          data={charts.activityPulse.length > 0 ? {
            labels: charts.activityPulse.map((item) => item.week),
            datasets: [
              {
                label: 'Atividades',
                data: charts.activityPulse.map((item) => item.activities),
                backgroundColor: DASHBOARD_COLORS.neon.purple,
                borderRadius: 6
              },
              {
                label: 'Reunioes',
                data: charts.activityPulse.map((item) => item.meetings),
                backgroundColor: DASHBOARD_COLORS.neon.yellow,
                borderRadius: 6
              }
            ]
          } : { labels: [], datasets: [] }}
          isEmpty={charts.activityPulse.length === 0}
        />

        <div className="rounded-xl border border-[#78c5ff50] bg-[linear-gradient(140deg,rgba(14,47,87,0.93),rgba(8,29,58,0.96))] p-3.5 text-[#d9edff]">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-black text-[#dcecff]">Contas em Risco</h3>
            <AlertTriangle className="h-4 w-4 text-[#8fd1ff]" />
          </div>
          <div className="space-y-2">
            {charts.riskAccounts.length > 0 ? (
              charts.riskAccounts.map((account) => (
                <div key={account.name} className="rounded-lg border border-[#74b9f353] bg-[#0b2243]/75 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-[#eaf4ff]">{account.name}</div>
                      <div className="text-[10px] text-[#a8c7e4]">{account.stage}</div>
                    </div>
                    <div className="text-[10px] font-bold text-[#ff8ca7]">{formatCurrencyNoCents(account.value)}</div>
                  </div>
                  <div className="mt-1.5 text-[10px] text-[#bbd5ee]">{account.risk}</div>
                </div>
              ))
            ) : (
              <EmptyState compact message="Nenhuma conta em risco identificada" />
            )}
          </div>
          <div className="mt-3 rounded-lg border border-[#74b9f353] bg-[#0b2243]/75 px-2.5 py-1.5 text-[10px] text-[#bbd5ee]">
            <Users className="mr-1 inline h-3 w-3" />
            {kpis.totalCompanies} contas monitoradas
          </div>
        </div>
        </section>

        {/* Oportunidades Filtradas */}
        <section className={`rounded-xl border p-3.5 text-[#d9edff] ${selectedTemperature ? 'border-[#87d5ff] bg-[linear-gradient(140deg,rgba(14,47,87,0.97),rgba(8,29,58,0.99))]' : 'border-[#78c5ff50] bg-[linear-gradient(140deg,rgba(14,47,87,0.93),rgba(8,29,58,0.96))]'}`}>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-[#dcecff]">
                {selectedTemperature
                  ? `Oportunidades com temperatura ${selectedTemperature}%`
                  : 'Oportunidades'}
              </h3>
              <p className="text-xs text-[#aac6e4]">
                {filteredOpportunities.length} oportunidade{filteredOpportunities.length !== 1 ? 's' : ''} encontrada{filteredOpportunities.length !== 1 ? 's' : ''}
                {selectedTemperature && ` · filtrado por temperatura ${selectedTemperature}%`}
              </p>
            </div>
            <Target className="h-4 w-4 text-[#8fd1ff]" />
          </div>

          {filteredOpportunities.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[#74b9f353] text-[10px] uppercase tracking-[0.08em] text-[#9fb9d7]">
                    <th className="px-2 py-2 text-left">Titulo</th>
                    <th className="px-2 py-2 text-left">Empresa</th>
                    <th className="px-2 py-2 text-left">Gerente</th>
                    <th className="px-2 py-2 text-right">Valor</th>
                    <th className="px-2 py-2 text-center">Estagio</th>
                    <th className="px-2 py-2 text-center">Temperatura</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOpportunities.map((opp) => {
                    const temp = getTemperatureFromProbability(opp.probability);
                    return (
                      <tr key={opp.id} className="border-b border-[#74b9f322] transition-colors hover:bg-[#0b2243]/50">
                        <td className="px-2 py-2 font-medium text-[#eaf4ff]">{opp.title}</td>
                        <td className="px-2 py-2 text-[#aac6e4]">{opp.company?.name || '-'}</td>
                        <td className="px-2 py-2 text-[#aac6e4]">{opp.owner?.name || '-'}</td>
                        <td className="px-2 py-2 text-right font-semibold text-[#5eb0ff]">
                          {formatCurrencyNoCents(opp.value)}
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-block rounded-full border border-[#74b9f353] bg-[#0b2243]/75 px-2 py-0.5 text-[9px]">
                            {opp.stage}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium"
                            style={{
                              backgroundColor: temp === '0' ? 'rgba(59,130,246,0.2)' :
                                temp === '25' ? 'rgba(251,191,36,0.2)' :
                                temp === '50' ? 'rgba(239,68,68,0.2)' :
                                temp === '75' ? 'rgba(34,197,94,0.2)' :
                                'rgba(107,114,128,0.2)',
                              color: temp === '0' ? '#93c5fd' :
                                temp === '25' ? '#fcd34d' :
                                temp === '50' ? '#fca5a5' :
                                temp === '75' ? '#86efac' :
                                '#d1d5db'
                            }}
                          >
                            {getTemperatureLabel(temp)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-[#aac6e4]">
              <Search className="mb-2 h-8 w-8 text-[#74b9f353]" />
              <p className="text-sm font-medium">Nenhuma oportunidade encontrada</p>
              <p className="mt-1 text-[10px]">Tente alterar os filtros selecionados</p>
            </div>
          )}
        </section>

        <PresentationControls
          active={presentationMode}
          current={presentationProgress.current}
          total={presentationProgress.total}
          canPrevious={presentationProgress.current > 1}
          canNext={presentationProgress.current < presentationProgress.total}
          onPrevious={() => scrollPresentationStep(-1)}
          onNext={() => scrollPresentationStep(1)}
          onExit={handlePresentation}
        />
      </div>
    </div>
  );
}
