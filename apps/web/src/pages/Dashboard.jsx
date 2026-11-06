import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, Clock3, Maximize2, PieChart, RefreshCw, Rocket, Target, X } from 'lucide-react';
import B2BTestFlowModal from '../components/B2BTestFlowModal';
import Chart3D from '../components/Chart3D';
import PresentationControls from '../components/PresentationControls';
import SalesFunnel from '../components/SalesFunnel';
import B2BRevenueCards from '../components/B2BRevenueCards';
import DashboardAdvancedChart from '../components/DashboardAdvancedChart';
import PipelineDashboardModel from '../components/PipelineDashboardModel';
import '../styles/dashboardEffects.css';

const formatCurrency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(value) || 0);
const formatPercent = value => `${(Number(value) || 0).toFixed(1)}%`;
const displayDate = value => value ? value.split('-').reverse().join('/') : '';
const PERIOD_OPTIONS = [
  { value: '30d', label: 'Últimos 30 dias' }, { value: 'month', label: 'Mês atual' },
  { value: 'quarter', label: 'Trimestre atual' }, { value: '6', label: 'Últimos 6 meses' },
  { value: 'year', label: 'Ano atual' }, { value: 'all', label: 'Todo o histórico' }
];
const TEMPERATURE_OPTIONS = [
  { value: '', label: 'Todas as probabilidades' }, { value: '0', label: '0%' },
  { value: '25', label: '1–25%' }, { value: '50', label: '26–50%' },
  { value: '75', label: '51–75%' }, { value: '100', label: '76–100%' }
];
const LEVELS = [
  { value: 0, label: 'Baixa probabilidade', color: '#ef4444' },
  { value: 25, label: 'Em qualificação', color: '#f6b40b' },
  { value: 50, label: 'Em desenvolvimento', color: '#22c55e' },
  { value: 75, label: 'Alta probabilidade', color: '#18c8df' },
  { value: 100, label: 'Probabilidade máxima', color: '#8a43cf' }
];
const EMPTY_INSIGHTS = { stageRows: [], temperatureRows: [], agingRows: [], riskRows: [], towerRows: [], clientTypeRows: [] };
// Preserve the full total when a chart has too many categories to read comfortably.
const topCategories = (rows, limit = 6, fields = ['count', 'value']) => rows.length <= limit ? rows : [
  ...rows.slice(0, limit - 1),
  rows.slice(limit - 1).reduce((total, row) => {
    fields.forEach(field => { total[field] = (total[field] || 0) + (Number(row[field]) || 0); });
    return total;
  }, { label: 'Outros', sellerName: 'Outros' })
];
const countOptions = {
  scales: {
    x: { ticks: { color: '#bcd4ee', font: { size: 10 }, autoSkip: false, maxRotation: 30, minRotation: 20 }, grid: { display: false } },
    y: { beginAtZero: true, ticks: { color: '#bcd4ee', precision: 0 }, grid: { color: 'rgba(125,162,206,0.18)' } }
  }
};
const currencyOptions = {
  scales: { x: { ticks: { color: '#bcd4ee', autoSkip: false, maxRotation: 30, minRotation: 20, font: { size: 10 } }, grid: { display: false } }, y: { beginAtZero: true, title: { display: true, text: 'Valor (R$)', color: '#bcd4ee' }, ticks: { color: '#bcd4ee', callback: value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value) }, grid: { color: 'rgba(125,162,206,0.18)' } } },
  plugins: { legend: { labels: { color: '#bcd4ee', usePointStyle: true } }, tooltip: { callbacks: { label: context => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}` } } }
};

export default function Dashboard() {
  const [timeRange, setTimeRange] = useState('year');
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationProgress, setPresentationProgress] = useState({ current: 1, total: 1 });
  const presentationRef = useRef(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedTemperature, setSelectedTemperature] = useState('');
  const [users, setUsers] = useState([]);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const dashboardRequestRef = useRef(0);
  const currentUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}'); } catch { return {}; }
  }, []);
  const canSeeAllOpps = ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(String(currentUser.actualRole || currentUser.role || '').trim().toUpperCase());
  const restrictedOwnerId = canSeeAllOpps ? null : (currentUser.id || currentUser.userId || '');
  const resetFilters = () => { setSelectedOwnerId(''); setSelectedTemperature(''); setTimeRange('year'); };

  const fetchDashboardData = async (ownerId, temperature, period, { silent = false } = {}) => {
    const requestId = ++dashboardRequestRef.current;
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams({ type: 'b2b', period });
      const effectiveOwnerId = restrictedOwnerId || ownerId;
      if (effectiveOwnerId) params.set('ownerId', effectiveOwnerId);
      if (temperature) params.set('temperature', temperature);
      const res = await fetch(`/api/dashboard?${params}`, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (requestId === dashboardRequestRef.current) { setDashboardData(data); setError(''); }
    } catch (failure) {
      if (requestId === dashboardRequestRef.current) setError('Não foi possível atualizar o dashboard. Tente novamente.');
      console.error('Erro ao carregar dashboard B2B:', failure);
    } finally {
      if (requestId === dashboardRequestRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (!canSeeAllOpps) return;
    const controller = new AbortController();
    fetch('/api/users', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }, signal: controller.signal })
      .then(res => res.ok ? res.json() : [])
      .then(data => setUsers(Array.isArray(data) ? data : []))
      .catch(() => {});
    return () => controller.abort();
  }, [canSeeAllOpps]);

  useEffect(() => {
    fetchDashboardData(selectedOwnerId, selectedTemperature, timeRange);
    const sync = () => {
      if (document.visibilityState === 'visible') fetchDashboardData(selectedOwnerId, selectedTemperature, timeRange, { silent: true });
    };
    const intervalId = window.setInterval(sync, 30000);
    window.addEventListener('focus', sync);
    document.addEventListener('visibilitychange', sync);
    return () => { window.clearInterval(intervalId); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', sync); };
  }, [selectedOwnerId, selectedTemperature, timeRange]);

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

  const kpis = dashboardData?.kpis || {};
  const charts = dashboardData?.charts || {};
  const opportunityInsights = dashboardData?.insights || EMPTY_INSIGHTS;
  const sellerRows = charts.sellerPerformance || [];
  const teamRows = topCategories(sellerRows, 7, ['open', 'won', 'lost']);
  const sources = topCategories((charts.leadSources || []).map(row => ({ label: row.source, count: row._count?.source || 0 })));
  const towers = topCategories(opportunityInsights.towerRows, 7);
  const timeline = charts.timeline || [];
  const revenue = dashboardData?.revenue || {};
  const revenueTimeline = charts.revenueTimeline || [];
  const forecast = charts.forecast || [];
  const forecastDeals = forecast.reduce((total, row) => total + row.deals, 0);
  const probabilityMean = Number(kpis.pipelineTemperature || 0);
  const temperatureColor = LEVELS.slice().reverse().find(level => probabilityMean >= level.value)?.color;
  const opportunityBase = Math.max(kpis.totalOpportunities || 0, 1);
  const hasOpen = Number(kpis.openOpportunities || 0) > 0;
  const hasValue = opportunityInsights.temperatureRows.some(row => row.value > 0);
  const historyLabel = dashboardData?.period ? `${displayDate(dashboardData.period.start)} a ${displayDate(dashboardData.period.end)}` : '';
  const temporalNote = [
    `${kpis.newOpportunities || 0} entradas e ${kpis.periodWon || 0} vendas ganhas no período`,
    kpis.undatedClosures ? `${kpis.undatedClosures} encerramentos sem data não entram no histórico` : '',
    kpis.missingEntryDates ? `${kpis.missingEntryDates} entradas sem data válida` : ''
  ].filter(Boolean).join(' • ');

  return (
    <div ref={presentationRef} className={`b2b-dashboard${presentationMode ? ' h-screen overflow-y-auto overflow-x-hidden bg-[var(--crm-bg-base)] p-2 pb-24' : ''}`}>
      {error ? <div role="alert" className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-50/40 dark:bg-rose-950/40 p-3 text-sm text-rose-700 dark:text-rose-100">{error}<button type="button" onClick={() => fetchDashboardData(selectedOwnerId, selectedTemperature, timeRange)} className="underline">Tentar novamente</button></div> : null}
      {!dashboardData ? <div role="status" className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 text-center text-[var(--crm-muted)]">{loading ? 'Carregando indicadores B2B…' : 'Os indicadores serão exibidos quando os dados estiverem disponíveis.'}</div> : <>
        <PipelineDashboardModel
          title="Dashboard Comercial B2B"
          subtitle={`Carteira atual completa • Histórico de entradas e resultados: ${historyLabel}`}
          controls={<>
            <select value={timeRange} onChange={event => setTimeRange(event.target.value)} aria-label="Período">
              {PERIOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            {canSeeAllOpps && <select value={selectedOwnerId} onChange={event => setSelectedOwnerId(event.target.value)} aria-label="Gerente">
              <option value="">Todos os gerentes</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.name || user.email}</option>)}
            </select>}
            <select value={selectedTemperature} onChange={event => setSelectedTemperature(event.target.value)} aria-label="Temperatura">
              {TEMPERATURE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button type="button" onClick={() => fetchDashboardData(selectedOwnerId, selectedTemperature, timeRange)} disabled={loading} title="Atualizar dados" aria-label="Atualizar dados"><RefreshCw className={`h-4 w-4${loading ? ' animate-spin' : ''}`} /></button>
            <button type="button" onClick={() => setIsTestModalOpen(true)} title="Executar fluxo de teste B2B"><Rocket className="h-3.5 w-3.5" /> Teste B2B</button>
            <button type="button" onClick={resetFilters} title="Limpar filtros" aria-label="Limpar filtros"><X className="h-4 w-4" /></button>
            <button type="button" onClick={handlePresentation} title="Apresentação" aria-label="Abrir apresentação"><Maximize2 className="h-4 w-4" /></button>
          </>}
          metrics={[
            { label: 'Leads em Aberto', value: kpis.activeLeads || 0, percent: (Number(kpis.activeLeads || 0) / opportunityBase) * 100, color: '#2563eb' },
            { label: 'Total de Oportunidades', value: kpis.totalOpportunities || 0, percent: kpis.totalOpportunities ? 100 : 0, color: '#18c8df' },
            { label: 'Vendas Ganhas', value: kpis.wonOpportunities || 0, percent: (Number(kpis.wonOpportunities || 0) / opportunityBase) * 100, color: '#22c55e' },
            { label: 'Taxa de Vitória', value: formatPercent(kpis.conversionRate), percent: kpis.conversionRate, color: '#f6b40b' }
          ]}
          executiveSignals={[
            { title: 'Pipeline em Aberto', label: `${kpis.openOpportunities || 0} oportunidades`, value: formatCurrency(kpis.pipelineValue), detail: `${kpis.unpricedOpportunities || 0} oportunidades sem valor comercial`, color: '#2563eb' },
            { title: 'Pipeline Ponderado', label: 'Valor × probabilidade de cada oportunidade', value: formatCurrency(kpis.weightedPipelineValue), detail: 'Potencial estimado da carteira em aberto', color: '#18c8df' },
            { title: 'Prazos de Fechamento', label: 'Oportunidades com previsão vencida', value: kpis.overdueOpportunities || 0, detail: `${kpis.unscheduledOpportunities || 0} oportunidades sem previsão de fechamento`, color: '#f6b40b' }
          ]}
          funnel={<SalesFunnel data={charts.funnel || []} selectedTemperature={selectedTemperature} />}
          funnelTitle="Funil Comercial B2B"
          funnelSubtitle="Situação atual de todas as oportunidades filtradas"
          temperature={probabilityMean}
          temperatureColor={temperatureColor}
          temperatureLevels={LEVELS}
          health={{ title: 'Probabilidade Média', subtitle: 'Média das probabilidades cadastradas nas oportunidades abertas', value: probabilityMean, label: hasOpen ? 'Em aberto' : 'Sem carteira aberta' }}
          performanceChart={{ title: 'Origem das Oportunidades', subtitle: 'Volume da carteira por entrada/origem', labels: sources.map(row => row.label), values: sources.map(row => row.count), showShare: true, emptyLabel: 'Nenhuma oportunidade nos filtros selecionados' }}
          trendChart={{
            title: 'Previsão de Fechamento', subtitle: 'Próximos 6 meses • valores previstos por data de fechamento', type: 'bar', unit: 'currency',
            labels: forecast.map(row => new Date(`${row.month}T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })),
            hasData: forecastDeals > 0,
            datasets: [{ label: 'Nominal', data: forecast.map(row => row.nominal), color: '#2563eb' }, { label: 'Ponderado', data: forecast.map(row => row.forecast), color: '#18c8df' }],
            emptyLabel: 'Nenhum fechamento previsto nos próximos 6 meses. Revise as datas das oportunidades.',
            note: `${forecastDeals} oportunidades previstas • ${kpis.overdueOpportunities || 0} atrasadas • ${kpis.unscheduledOpportunities || 0} sem data`
          }}
          temporalChart={{
            title: 'Movimentação das Oportunidades', subtitle: `Entradas, ganhos e perdas por ${dashboardData?.period?.daily ? 'dia' : 'mês'} • ${historyLabel}`, unit: 'count',
            labels: timeline.map(row => row.label), showZero: Number(kpis.totalOpportunities || 0) > 0,
            datasets: [{ label: 'Entradas', data: timeline.map(row => row.entries), color: '#18c8df', fill: true }, { label: 'Ganhas', data: timeline.map(row => row.won), color: '#22c55e', fill: false }, { label: 'Perdidas', data: timeline.map(row => row.lost), color: '#ef4444', fill: false }],
            emptyLabel: 'Nenhuma oportunidade nos filtros selecionados', note: temporalNote
          }}
          table={{
            title: 'Carteira por Gerente', subtitle: 'Pipeline atual e vendas ganhas no período selecionado',
            columns: [{ label: 'Gerente' }, { label: 'Abertas', align: 'right' }, { label: 'Pipeline', align: 'right' }, { label: 'Ponderado', align: 'right' }, { label: 'Ganhas no período', align: 'right' }],
            rows: sellerRows.map(row => ({ id: row.sellerId, cells: [row.sellerName, row.open, formatCurrency(row.pipelineValue), formatCurrency(row.weightedValue), row.periodDeals] })),
            emptyLabel: 'Nenhum gerente com oportunidades nos filtros selecionados'
          }}
          alerts={{ title: 'Prioridades do Pipeline', subtitle: 'Prazos vencidos, falta de atualização ou dados comerciais', items: opportunityInsights.riskRows.slice(0, 4).map(row => ({ id: row.id, title: row.title || row.company?.name || 'Oportunidade', detail: row.__riskReason, tone: row.__riskPriority >= 4 ? 'red' : row.__riskPriority >= 3 ? 'yellow' : 'blue' })) }}
          teamChart={{
            title: 'Distribuição da Carteira', subtitle: 'Situação atual das oportunidades por gerente', horizontal: true, stacked: true, unit: 'count', labels: teamRows.map(row => row.sellerName),
            datasets: [{ label: 'Abertas', data: teamRows.map(row => row.open), color: '#18c8df' }, { label: 'Ganhas', data: teamRows.map(row => row.won), color: '#22c55e' }, { label: 'Perdidas', data: teamRows.map(row => row.lost), color: '#ef4444' }],
            emptyLabel: 'Nenhuma oportunidade nos filtros selecionados'
          }}
          presentationControls={<PresentationControls active={presentationMode} current={presentationProgress.current} total={presentationProgress.total} canPrevious={presentationProgress.current > 1} canNext={presentationProgress.current < presentationProgress.total} onPrevious={() => scrollPresentationStep(-1)} onNext={() => scrollPresentationStep(1)} onExit={handlePresentation} />}
        />
        <section className="mt-5 grid gap-4 px-2 pb-8 md:grid-cols-2 xl:grid-cols-3" aria-label="Análises da carteira em aberto">
          <DashboardAdvancedChart title="Valor por Etapa" subtitle="Carteira aberta • nominal e ponderado (R$)" icon={<BarChart3 className="h-4 w-4" />} type="bar" height={240}
            data={{ labels: opportunityInsights.stageRows.map(row => row.label), datasets: [{ label: 'Nominal', data: opportunityInsights.stageRows.map(row => row.value), backgroundColor: '#2563eb', borderRadius: 6 }, { label: 'Ponderado', data: opportunityInsights.stageRows.map(row => row.weightedValue), backgroundColor: '#18c8df', borderRadius: 6 }] }}
            customOptions={currencyOptions} isEmpty={!opportunityInsights.stageRows.some(row => row.value > 0)} emptyMessage={hasOpen ? 'Informe o valor das oportunidades para analisar o potencial por etapa.' : 'Nenhuma oportunidade em aberto nos filtros selecionados.'} />
          <DashboardAdvancedChart title="Probabilidade de Fechamento" subtitle="Volume de oportunidades em aberto por faixa" icon={<Target className="h-4 w-4" />} type="bar" height={240} showLegend={false}
            data={{ labels: opportunityInsights.temperatureRows.map(row => row.label), datasets: [{ label: 'Oportunidades', data: opportunityInsights.temperatureRows.map(row => row.count), backgroundColor: opportunityInsights.temperatureRows.map(row => row.color), borderRadius: 6 }] }} customOptions={countOptions} isEmpty={!hasOpen} emptyMessage="Nenhuma oportunidade em aberto nos filtros selecionados." />
          <DashboardAdvancedChart title="Envelhecimento do Pipeline" subtitle="Dias desde a entrada da oportunidade • carteira aberta" icon={<Clock3 className="h-4 w-4" />} type="bar" height={240} showLegend={false}
            data={{ labels: opportunityInsights.agingRows.map(row => row.label), datasets: [{ label: 'Oportunidades', data: opportunityInsights.agingRows.map(row => row.count), backgroundColor: ['#22c55e', '#18c8df', '#1f7fe5', '#f6b40b', '#ef4444', '#64748b'], borderRadius: 6 }] }} customOptions={countOptions} isEmpty={!hasOpen} emptyMessage="Nenhuma oportunidade em aberto nos filtros selecionados." />
          <DashboardAdvancedChart title="Perfil da Carteira" subtitle="Oportunidades abertas: novos clientes, base e renovação" icon={<PieChart className="h-4 w-4" />} type="doughnut" height={240} legendPosition="bottom"
            data={{ labels: opportunityInsights.clientTypeRows.map(row => row.label), datasets: [{ data: opportunityInsights.clientTypeRows.map(row => row.count), backgroundColor: ['#18c8df', '#2563eb', '#22c55e', '#64748b'] }] }} isEmpty={!hasOpen} emptyMessage="Nenhuma oportunidade em aberto nos filtros selecionados." />
          <DashboardAdvancedChart title="Torres de Projeto" subtitle="Volume de oportunidades abertas por solução" icon={<BarChart3 className="h-4 w-4" />} type="bar" height={240} showLegend={false}
            data={{ labels: towers.map(row => row.label), datasets: [{ label: 'Oportunidades', data: towers.map(row => row.count), backgroundColor: '#18c8df', borderRadius: 6 }] }}
            customOptions={{ indexAxis: 'y', scales: { x: { beginAtZero: true, ticks: { color: '#bcd4ee', precision: 0 }, grid: { color: 'rgba(125,162,206,0.18)' } }, y: { ticks: { color: '#bcd4ee', font: { size: 10 } }, grid: { display: false } } } }} isEmpty={!hasOpen} emptyMessage="Nenhuma oportunidade em aberto nos filtros selecionados." />
          <DashboardAdvancedChart title={hasValue ? 'Valor por Probabilidade' : 'Mix por Probabilidade'} subtitle={hasValue ? 'Valor nominal da carteira aberta por faixa (R$)' : 'Volume da carteira aberta • valores ainda não informados'} icon={<PieChart className="h-4 w-4" />} type="doughnut" height={240} legendPosition="bottom"
            data={{ labels: opportunityInsights.temperatureRows.map(row => row.label), datasets: [{ data: opportunityInsights.temperatureRows.map(row => hasValue ? row.value : row.count), backgroundColor: opportunityInsights.temperatureRows.map(row => row.color) }] }}
            customOptions={hasValue ? { plugins: { tooltip: { callbacks: { label: context => `${context.label}: ${formatCurrency(context.parsed)}` } } } } : {}} isEmpty={!hasOpen} emptyMessage="Nenhuma oportunidade em aberto nos filtros selecionados." />
        </section>

        <section className="mt-5 px-2" aria-label="Receitas recorrentes e pontuais">
          <B2BRevenueCards revenue={revenue} historyLabel={historyLabel} />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DashboardAdvancedChart title="Evolução das Receitas" subtitle={`Vendas ganhas • ${historyLabel}`} type="bar" height={260}
              data={{ labels: revenueTimeline.map(row => row.label), datasets: [
                { label: 'Recorrente', data: revenueTimeline.map(row => row.recurring), backgroundColor: '#18c8df', borderRadius: 6 },
                { label: 'Pontual + setup', data: revenueTimeline.map(row => row.oneTime), backgroundColor: '#2563eb', borderRadius: 6 }
              ] }} customOptions={currencyOptions} isEmpty={!revenueTimeline.some(row => row.recurring > 0 || row.oneTime > 0)} emptyMessage="Nenhuma receita projetada para o período selecionado." />
            <DashboardAdvancedChart title="Composição da Receita" subtitle="Vendas ganhas • valores projetados no período" type="doughnut" height={260} legendPosition="bottom"
              data={{ labels: ['Recorrente', 'Pontual + setup'], datasets: [{ data: [revenue.periodRecurring || 0, revenue.periodOneTime || 0], backgroundColor: ['#18c8df', '#2563eb'] }] }}
              customOptions={{ plugins: { tooltip: { callbacks: { label: context => `${context.label}: ${formatCurrency(context.parsed)}` } } } }}
              isEmpty={!revenue.periodRecurring && !revenue.periodOneTime} emptyMessage="Nenhuma receita projetada para o período selecionado." />
          </div>
        </section>

        {/* Gráficos 3D Interativos */}
        <section className="mt-5 px-2 pb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-slate-100">📊 Análise 3D Interativa</h2>
            <p className="text-sm text-slate-400">Explore seus dados em três dimensões</p>
          </div>
          
          <div className="grid gap-4 xl:grid-cols-2">
            <div className="dashboard-card p-6">
              <Chart3D
                type="bar3d"
                title="Pipeline por Etapa (3D)"
                subtitle="Volume e valor em três dimensões"
                data={{
                  x: funnel.map(item => item.stage),
                  y: funnel.map(item => item.count || 0),
                  z: funnel.map(item => item.value || 0)
                }}
                height={450}
                colorScale="Viridis"
              />
            </div>

            <div className="dashboard-card p-6">
              <Chart3D
                type="scatter3d"
                title="Oportunidades - Valor × Probabilidade × Idade"
                subtitle="Análise tridimensional do pipeline"
                data={{
                  x: opportunities.map(opp => opp.probability || 0),
                  y: opportunities.map(opp => Number(opp.value || 0)),
                  z: opportunities.map(opp => {
                    const created = new Date(opp.createdAt);
                    const now = new Date();
                    return Math.floor((now - created) / (1000 * 60 * 60 * 24));
                  }),
                  text: opportunities.map(opp => opp.title || 'Sem título')
                }}
                height={450}
                colorScale="Portland"
              />
            </div>

            <div className="dashboard-card p-6">
              <Chart3D
                type="bubble3d"
                title="Temperatura × Valor × Quantidade"
                subtitle="Bolhas 3D representam clusters de oportunidades"
                data={{
                  x: temperature.map(t => `${t.probability}%`),
                  y: temperature.map(t => t.value || 0),
                  z: temperature.map(t => t.count || 0),
                  size: temperature.map(t => (t.value || 0) / 1000)
                }}
                height={450}
                colorScale="Jet"
              />
            </div>

            <div className="dashboard-card p-6">
              <Chart3D
                type="surface"
                title="Superfície de Performance"
                subtitle="Mapa de calor 3D do desempenho"
                data={{
                  z: [
                    funnel.map(item => item.value || 0),
                    funnel.map(item => (item.count || 0) * 1000)
                  ]
                }}
                height={450}
                colorScale="RdBu"
              />
            </div>
          </div>
        </section>
      </>}
      <B2BTestFlowModal isOpen={isTestModalOpen} onClose={() => { setIsTestModalOpen(false); fetchDashboardData(selectedOwnerId, selectedTemperature, timeRange, { silent: true }); }} />
    </div>
  );
}
