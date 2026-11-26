import ExecutiveStatCard from './ExecutiveStatCard';
import { upcomingActivities, activityRoute } from '../utils/dashboardFlow.mjs';
import { useEffect, useMemo, useRef } from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { useLocation, useNavigate } from 'react-router-dom';
import ExecutiveMarketCards from './ExecutiveMarketCards';
import ExecutiveModuleNavigation from './ExecutiveModuleNavigation';
import useExecutiveModules from './useExecutiveModules';
import { ArrowRight, Bell, Brain, CalendarDays, Check, MoreVertical, Coins, Handshake, Settings, Sparkles, Trophy, Target, TrendingUp, TriangleAlert } from 'lucide-react';
import { ExecutiveIcon, ExecutiveBrazilMap, getOpportunityLocations } from './ExecutiveVisuals';

import './PipelineDashboardModel.css';
import './GeneralDashboardExecutive.css';
import './GeneralDashboardExecutiveSkin.css';
import './ExecutivePipelineDashboard.css';
import { CHART_3D_PALETTE } from '../theme/chart3dGeometry.mjs';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip
);

const DEFAULT_COLORS = ['#00caff', '#008dff', '#16e8ac', '#b277ff', '#ffbd23', '#ff665c'];
const GRID_COLOR = 'rgba(75, 85, 99, 0.42)';
const TEXT_COLOR = '#8f9caf';

const clampPercent = (value) => Math.min(Math.max(Number(value) || 0, 0), 100);

const compactNumber = (value) => {
  const number = Number(value) || 0;
  return new Intl.NumberFormat('pt-BR', {
    notation: Math.abs(number) >= 1000 ? 'compact' : 'standard',
    maximumFractionDigits: 1
  }).format(number);
};

const chartValue = (value, chart) => chart?.unit === 'currency'
  ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
  : compactNumber(value);

const panelOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 550 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgb(var(--crm-surface-2-rgb) / 0.96)",
      borderColor: 'rgba(255, 122, 0, 0.34)',
      borderWidth: 1,
      titleColor: '#f4f7fb',
      bodyColor: '#8f9caf',
      padding: 11,
      cornerRadius: 8,
      usePointStyle: true,
      boxPadding: 6
    }
  }
};

function PanelHeader({ title, subtitle }) {
  return (
    <div className="pipeline-model__panel-header">
      <div className="min-w-0">
        <h3>{title}</h3>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <MoreVertical aria-hidden="true" className="pipeline-model__menu-icon" />
    </div>
  );
}

function EmptyChart({ label = 'Sem dados para o periodo selecionado' }) {
  return <div className="pipeline-model__empty">{label}</div>;
}

function KpiRing({ metric, index }) {
  const icon = [Coins, Handshake, Trophy, Target][index % 4];
  const kind = ['coins', null, 'trophy', null][index % 4];
  const tone = ['blue', 'cyan', 'amber', 'blue'][index % 4];
  return <ExecutiveStatCard title={metric.label} value={metric.value} color={tone}
    icon={<ExecutiveIcon icon={metric.icon || icon} kind={metric.kind || kind}/>}
    subtitle={metric.subtitle || 'Carteira filtrada'}/>;
}

function MiniSignalCard({ title, label, value, detail = 'período selecionado', data = [], color = DEFAULT_COLORS[0] }) {
  const hasData = data.some((item) => Number(item) > 0);
  const chartData = useMemo(() => ({
    labels: data.map((_, index) => String(index + 1)),
    datasets: [{
      data,
      borderColor: color,
      backgroundColor: `${color}26`,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.42,
      fill: true
    }]
  }), [color, data]);

  return (
    <article className={`nex-stat-surface pipeline-model__signal-card${data.length ? '' : ' is-summary'}`} style={{ '--signal-color': color }}>
      <div>
        <h4>{title}</h4>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
      <div className="pipeline-model__sparkline">
        {hasData ? (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              animation: { duration: 500 },
              plugins: { legend: { display: false }, tooltip: { enabled: false } },
              scales: {
                x: { display: false },
                y: { display: false, beginAtZero: true }
              }
            }}
          />
        ) : <EmptyChart label="" />}
      </div>
    </article>
  );
}

function ExecutiveSignals({ metrics = [], trendChart, performanceChart, temperature, signals }) {
  const trendValues = trendChart?.datasets?.[0]?.data?.map((value) => Number(value) || 0) || [];
  const forecastValues = trendChart?.datasets?.[1]?.data?.map((value) => Number(value) || 0) || [];
  const performanceValues = performanceChart?.values?.map((value) => Number(value) || 0) || [];
  const cards = signals || [
    {
      title: metrics[0]?.label || 'Pipeline',
      label: 'Total',
      value: metrics[0]?.value ?? compactNumber(performanceValues.reduce((sum, item) => sum + item, 0)),
      data: performanceValues,
      color: metrics[0]?.color || '#ff7a00'
    },
    {
      title: metrics[1]?.label || 'Mensal',
      label: 'Recorrente',
      value: metrics[1]?.value ?? compactNumber(trendValues.at(-1) || 0),
      data: trendValues,
      color: metrics[1]?.color || '#18c8df'
    },
    {
      title: metrics[2]?.label || 'Ganho',
      label: 'Realizado',
      value: metrics[2]?.value ?? `${clampPercent(temperature).toFixed(1)}%`,
      data: forecastValues.length ? forecastValues : trendValues.map((value, index) => value * ((index + 1) / Math.max(trendValues.length, 1))),
      color: metrics[2]?.color || '#22c55e'
    }
  ];

  return (
    <section className="pipeline-model__signals" aria-label="Indicadores com tendência">
      {cards.map((card) => (
        <MiniSignalCard key={card.title} {...card} />
      ))}
    </section>
  );
}

function TemperatureScale({ value = 0, levels = [], color }) {
  const score = clampPercent(value);
  const activeColor = color || levels
    .slice()
    .reverse()
    .find((level) => score >= clampPercent(level.value))?.color || '#ff7a00';
  return (
    <div className="pipeline-model__temperature">
      <div className="pipeline-model__temperature-content">
        <div
          className="pipeline-model__thermometer"
          role="img"
          aria-label={`Temperatura atual do pipeline: ${score.toFixed(1)}%`}
          style={{ '--temperature-color': activeColor, '--temperature-height': `${Math.max(score, 3)}%` }}
        >
          <div className="pipeline-model__thermometer-tube">
            <div className="pipeline-model__thermometer-liquid" />
            <div className="pipeline-model__thermometer-shine" />
          </div>
          <div className="pipeline-model__thermometer-bulb">
            <div className="pipeline-model__thermometer-bulb-liquid" />
            <div className="pipeline-model__thermometer-bulb-shine" />
          </div>
        </div>
          <div className="pipeline-model__temperature-copy">
          <div className="pipeline-model__temperature-title">
          <strong>Temperatura do Pipeline</strong>
          <span>{score.toFixed(1)}% atual</span>
          </div>
          <div className="pipeline-model__temperature-levels">
            {levels.map((level) => (
              <div key={`${level.value}-${level.label}`}>
                <i style={{ backgroundColor: level.color }} />
                <span><b>{level.value}%</b> - {level.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TemporalAreaChart({ chart }) {
  const hasData = chart?.labels?.length > 0 && (chart?.showZero || chart?.datasets?.some((dataset) => dataset.data?.some((value) => Number(value) > 0)));
  const data = useMemo(() => ({
    labels: chart?.labels || [],
    datasets: (chart?.datasets || []).map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.color || DEFAULT_COLORS[index],
      backgroundColor: dataset.fillColor || `${dataset.color || DEFAULT_COLORS[index]}26`,
      pointBackgroundColor: dataset.color || DEFAULT_COLORS[index],
      pointBorderColor: '#050914',
      pointBorderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 6,
      borderWidth: 2.5,
      tension: chart?.unit === 'count' ? 0 : 0.4,
      fill: dataset.fill ?? true
    }))
  }), [chart]);

  if (!hasData) return <EmptyChart label={chart?.emptyLabel} />;

  return (
    <Line
      data={data}
      options={{
        ...panelOptions,
        plugins: {
          ...panelOptions.plugins,
          legend: {
            display: true,
            align: 'end',
            labels: { color: "rgb(var(--crm-ink-rgb) / 1)", usePointStyle: true, pointStyle: 'circle', boxWidth: 7, padding: 12, font: { size: 10, weight: '700' } }
          }
        },
        scales: {
          x: { grid: { color: "rgb(var(--crm-muted-rgb) / 0.22)" }, border: { display: false }, ticks: { color: TEXT_COLOR, font: { size: 9, weight: '700' }, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: GRID_COLOR }, border: { display: false }, ticks: { color: TEXT_COLOR, font: { size: 9 }, precision: chart?.unit === 'count' ? 0 : undefined, callback: compactNumber } }
        }
      }}
    />
  );
}

function HealthDonut({ value = 0, label = 'Saúde' }) {
  const score = clampPercent(value);
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f6b40b' : '#ff7a00';
  const data = useMemo(() => ({
    datasets: [{
      data: [score, 100 - score],
      backgroundColor: [color, '#1f2937'],
      borderColor: "var(--crm-border)",
      borderWidth: 3,
      hoverOffset: 0
    }]
  }), [color, score]);

  return (
    <div className="pipeline-model__health">
      <Doughnut
        data={data}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          animation: { duration: 650 }
        }}
      />
      <div>
        <strong>{score.toFixed(0)}%</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function HorizontalPerformance({ chart }) {
  const hasData = chart?.labels?.length > 0 && chart?.values?.some((value) => Number(value) > 0);
  if (!hasData) return <EmptyChart label={chart?.emptyLabel} />;

  const values = chart.values.map((value) => Number(value) || 0);
  const maxValue = Math.max(...values, 1);
  const targetPercent = chart.targetPercent === undefined ? null : clampPercent(chart.targetPercent);
  const total = values.reduce((sum, value) => sum + value, 0);

  return (
    <div className="pipeline-model__performance" role="img" aria-label={`${chart.title || 'Performance'} em barras horizontais`}>
      <div className="pipeline-model__performance-legend">
        <span><i /> {chart.showShare ? 'Participação no total' : 'Resultado'}</span>
        {targetPercent !== null ? <span className="is-target"><i /> Meta {targetPercent}%</span> : null}
      </div>
      <div className="pipeline-model__performance-rows">
        {chart.labels.map((label, index) => {
          const width = Math.max((values[index] / maxValue) * 100, values[index] > 0 ? 5 : 0);
          const color = chart.colors?.[index % chart.colors.length] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          return (
            <div className="pipeline-model__performance-row" key={`${label}-${index}`}>
              <span className="pipeline-model__performance-label" title={label}>{label}</span>
              <div className="pipeline-model__performance-track">
                <div className="pipeline-model__performance-bar" style={{ width: `${width}%`, backgroundColor: color, '--bar-color': color }}>
                  {width >= 34 ? <b>{chart.showShare ? ((values[index] / total) * 100).toFixed(0) : Math.round(width)}%</b> : null}
                </div>
                {targetPercent !== null ? <i className="pipeline-model__target-marker" style={{ left: `${targetPercent}%` }} /> : null}
              </div>
              <strong className="pipeline-model__performance-value">{compactNumber(values[index])}</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TrendChart({ chart }) {
  const hasData = chart?.labels?.length > 0 && chart?.hasData !== false && chart?.datasets?.some((dataset) => dataset.data?.length > 0);
  const data = useMemo(() => ({
    labels: chart?.labels || [],
    datasets: (chart?.datasets || []).map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.color || DEFAULT_COLORS[index + 2],
      backgroundColor: dataset.fillColor || (chart?.type === 'bar' ? dataset.color : 'rgba(69, 201, 111, 0.09)'),
      borderRadius: 4,
      maxBarThickness: 22,
      pointBackgroundColor: dataset.color || DEFAULT_COLORS[index + 2],
      pointBorderColor: '#0b2243',
      pointBorderWidth: 1.5,
      pointRadius: index === 0 ? 3.5 : 3,
      pointHoverRadius: 6,
      borderWidth: 2.6,
      tension: 0.36,
      fill: Boolean(dataset.fill)
    }))
  }), [chart]);

  if (!hasData) return <EmptyChart label={chart?.emptyLabel} />;

  const Chart = chart?.type === 'bar' ? Bar : Line;

  return (
    <Chart
      data={data}
      options={{
        ...panelOptions,
        plugins: {
          ...panelOptions.plugins,
          tooltip: { ...panelOptions.plugins.tooltip, callbacks: { label: context => `${context.dataset.label}: ${chartValue(context.parsed.y, chart)}` } },
          legend: {
            display: true,
            align: 'end',
            labels: { color: '#bcd4ee', usePointStyle: true, pointStyle: 'circle', boxWidth: 7, padding: 12, font: { size: 10, weight: '600' } }
          }
        },
        scales: {
          x: {
            grid: { color: GRID_COLOR },
            border: { display: false },
            ticks: { color: TEXT_COLOR, font: { size: 9, weight: '600' }, maxRotation: 0 }
          },
          y: {
            beginAtZero: true,
            grid: { color: GRID_COLOR },
            border: { display: false },
            ticks: { color: TEXT_COLOR, font: { size: 9 }, callback: compactNumber }
          }
        }
      }}
    />
  );
}

function TeamPerformance({ chart }) {
  const hasData = chart?.labels?.length > 0 && chart?.datasets?.some((dataset) => dataset.data?.some((value) => Number(value) > 0));
  const data = useMemo(() => ({
    labels: chart?.labels || [],
    datasets: (chart?.datasets || []).map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      backgroundColor: dataset.colors || dataset.color || DEFAULT_COLORS[index + 2],
      borderColor: dataset.borderColors || dataset.colors || dataset.color || DEFAULT_COLORS[index + 2],
      borderWidth: 1,
      borderRadius: 7,
      borderSkipped: false,
      barPercentage: 0.74,
      categoryPercentage: 0.68,
      maxBarThickness: 30
    }))
  }), [chart]);

  if (!hasData) return <EmptyChart label={chart?.emptyLabel} />;

  const horizontal = chart?.horizontal;

  return (
    <Bar
      data={data}
      options={{
        ...panelOptions,
        indexAxis: horizontal ? 'y' : 'x',
        plugins: {
          ...panelOptions.plugins,
          tooltip: { ...panelOptions.plugins.tooltip, callbacks: { label: context => `${context.dataset.label}: ${chartValue(horizontal ? context.parsed.x : context.parsed.y, chart)}` } },
          legend: chart.datasets.length > 1
            ? { display: true, labels: { color: '#bcd4ee', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 12, font: { size: 10, weight: '600' } } }
            : { display: false }
        },
        scales: {
          x: { beginAtZero: true, stacked: chart?.stacked, grid: { display: Boolean(horizontal), color: GRID_COLOR }, border: { display: false }, ticks: { color: '#9fb9d7', font: { size: 9, weight: '600' }, precision: 0, maxRotation: 0, ...(horizontal ? { callback: compactNumber } : {}) } },
          y: { beginAtZero: true, stacked: chart?.stacked, grid: { display: !horizontal, color: GRID_COLOR }, border: { display: false }, ticks: { color: TEXT_COLOR, font: { size: 9 }, precision: 0, ...(!horizontal ? { callback: compactNumber } : {}) } }
        }
      }}
    />
  );
}

export default function PipelineDashboardModel({
  title,
  subtitle,
  controls,
  metrics = [],
  funnel,
  funnelTitle = 'Funil de Vendas',
  funnelSubtitle,
  temperature = 0,
  temperatureLevels = [],
  temperatureColor,
  performanceChart,
  trendChart,
  temporalChart,
  executiveSignals,
  health,
  table,
  alerts,
  teamChart,
  presentationControls,
  mapRecords,
  market = 'B2B',
  ranking = []
}) {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(()=>{
    const target=location.hash==='#mapa'?'nex-pipeline-map':location.hash==='#receitas-b2b'?'receitas-b2b':null;
    if(target) document.getElementById(target)?.scrollIntoView({behavior:'smooth',block:'center'});
  },[location.hash]);
  const modules = useExecutiveModules(market);
  const rankingDialog = useRef(null);
  const intelligenceDialog = useRef(null);
  const agendaRoute = market === 'B2G' ? '/b2g-atividades' : '/atividades';
  const upcoming = upcomingActivities(Array.isArray(modules.data.activities) ? modules.data.activities : []).filter(item=>item.clientType===market);
  useEffect(() => {
    const open = () => { if (!intelligenceDialog.current?.open) intelligenceDialog.current?.showModal(); };
    window.addEventListener('nexos-open-intelligence', open);
    return () => window.removeEventListener('nexos-open-intelligence', open);
  }, []);
  const score = clampPercent(health?.value ?? temperature);
  const mapCompanies = [...(modules.data?.companiesB2B || []), ...(modules.data?.companiesB2G || [])];
  const mapLocations = getOpportunityLocations(mapRecords || [], mapCompanies);
  let currentUser = null;
  try {
    const raw = localStorage.getItem('user');
    currentUser = raw ? JSON.parse(raw) : null;
  } catch {
    currentUser = null;
  }
  const userName = currentUser?.name || 'Carlos Horst';
  const userRole = currentUser?.role || 'MASTER';
  const userInitials = String(userName).split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'CH';
  return (
    <div data-market={market} className="pipeline-model nex-executive nex-pipeline">

      <dialog ref={intelligenceDialog} className="nex-ai-dialog" aria-labelledby="pipeline-intelligence-title">
        <h2 id="pipeline-intelligence-title">NEXOS Intelligence</h2><p>{title} · resumo dos filtros ativos.</p>
        {metrics.map(metric => <p key={metric.label}>{metric.label}: <strong>{metric.value}</strong></p>)}
        <p>{alerts?.items?.length || 0} prioridades no painel atual.</p>
        <button onClick={() => intelligenceDialog.current.close()}>Fechar</button>
      </dialog>
      <header className="nex-welcome nex-pipeline-welcome" data-section="header">
        <div className="nex-welcome-copy"><TrendingUp size={38}/><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>
        <div className="pipeline-model__controls">
          {controls}
          <button type="button" className="nex-welcome-ai-btn" onClick={() => intelligenceDialog.current?.showModal()}><Sparkles size={14} /><span>NEXOS IA</span></button>
          <div className="nex-welcome-user-group">
            <button type="button" className="nex-icon-pill" title={`Agenda ${market}`} onClick={() => navigate(agendaRoute)}><Bell size={16} />{(alerts?.items?.length || 0) > 0 && <span className="nex-icon-dot" />}</button>
            <button type="button" className="nex-icon-pill" title="Configurações" onClick={() => navigate('/configuracoes')}><Settings size={16} /></button>
            <button type="button" className="nex-user-pill" onClick={() => navigate('/configuracoes')}><span className="nex-user-avatar">{userInitials}</span><span><strong>{userName}</strong><small>{userRole}</small></span></button>
          </div>
        </div>
      </header>
      <section className="nex-kpis" aria-label="Indicadores principais" data-section="kpis">
        {metrics.slice(0,4).map((metric,index) => <KpiRing key={metric.label} metric={metric} index={index}/>)}
        <article className="nex-panel nex-health" title={health?.subtitle || 'Média de probabilidade das oportunidades filtradas'}>
          <div className="nex-ring" style={{'--progress':`${score}%`,'--ring-green':`${score*.55}%`,'--ring-yellow':`${score*.7}%`}}><strong>{Math.round(score)}%</strong></div>
          <div><h2>{health?.title || 'Probabilidade Média'}</h2><strong className="nex-positive">{health?.label || 'Pipeline filtrado'}</strong><small>{health?.subtitle || 'Probabilidades cadastradas'}</small></div>
        </article>
      </section>
      <section className="nex-three nex-charts nex-pipeline-main" data-section="charts" aria-label="Gráficos principais">
        <article className="nex-panel"><PanelHeader title={trendChart?.title || 'Evolução'} subtitle={trendChart?.subtitle}/><div className="nex-pipeline-chart"><TrendChart chart={trendChart}/></div>{trendChart?.note && <p className="nex-pipeline-note">{trendChart.note}</p>}</article>
        <article className="nex-panel"><PanelHeader title={funnelTitle} subtitle={funnelSubtitle}/><div className="nex-pipeline-funnel">{funnel}</div></article>
        {mapRecords ? <article id="nex-pipeline-map" className="nex-panel"><PanelHeader title="Mapa de Oportunidades" subtitle={`Distribuição da carteira ${market} filtrada`}/><div className="nex-pipeline-geography"><ExecutiveBrazilMap locations={mapLocations} category={market}/><div><strong>{compactNumber(mapRecords.length)}</strong><span>oportunidades</span><strong>{compactNumber(mapLocations.length)}</strong><span>com localização</span><small>{mapLocations.some(item => item.approximate) ? 'Inclui localização aproximada por UF' : mapLocations.length ? 'Coordenadas cadastradas' : 'Cadastre UF ou coordenadas para exibir pontos.'}</small></div></div></article> : <article className="nex-panel"><PanelHeader title={performanceChart?.title || 'Performance'} subtitle={performanceChart?.subtitle}/><div className="nex-pipeline-chart"><HorizontalPerformance chart={performanceChart}/></div></article>}
      </section>
      <section className="nex-three nex-lists nex-pipeline-executive-lists" data-section="lists" aria-label="Equipe, alertas e agenda">
        <article className="nex-panel"><div className="nex-panel-heading"><h2>Performance da Equipe</h2><button className="nex-link" onClick={()=>rankingDialog.current?.showModal()}>Ver ranking<ArrowRight size={13}/></button></div><div className="nex-list-body">{ranking.length ? ranking.map((item,index)=>{const rate=item.total ? item.won/item.total*100 : 0;return <div className="nex-team-row" key={item.id || item.name}><span className="nex-rank">{index === 0 ? <Trophy size={15}/> : index+1}</span><span className="nex-avatar">{String(item.name || '?').split(' ').slice(0,2).map(part=>part[0]).join('')}</span><div className="nex-team-name"><strong>{item.name}</strong><small>{compactNumber(item.total)} oportunidades</small></div><span className="nex-progress"><i style={{width:`${clampPercent(rate)}%`}}/></span><strong title="Oportunidades ganhas / total">{rate.toLocaleString('pt-BR',{maximumFractionDigits:1})}%</strong></div>;}) : <EmptyChart label="Sem dados de equipe nos filtros selecionados"/>}</div></article>
        <article className="nex-panel"><div className="nex-panel-heading"><h2>Alertas e Ações {(alerts?.items?.length || 0)>0 && <span className="nex-count">{alerts.items.length}</span>}</h2><button className="nex-link" onClick={()=>navigate(agendaRoute)}>Ver agenda<ArrowRight size={13}/></button></div><div className="nex-list-body">{(alerts?.items || []).map(item=><button type="button" key={item.id} onClick={()=>navigate(item.route || agendaRoute)} className={`pipeline-model__alert is-${item.tone || 'blue'}`}><span className={`nex-status-icon nex-alert-${item.tone || 'blue'}`}><TriangleAlert size={17}/></span><div><strong>{item.title}</strong><p>{item.detail}</p></div></button>)}{!alerts?.items?.length && <EmptyChart label="Nenhum alerta nos filtros atuais"/>}</div></article>
        <article className="nex-panel"><div className="nex-panel-heading"><h2>Próximos Compromissos</h2><button className="nex-link" onClick={()=>navigate(agendaRoute)}>Ver agenda<ArrowRight size={13}/></button></div><div className="nex-list-body">{modules.loading ? <EmptyChart label="Carregando agenda..."/> : upcoming.length ? upcoming.slice(0,3).map((item,index)=><button key={item.id || index} className="nex-action-row" onClick={()=>navigate(activityRoute(item))}><span className="nex-status-icon"><CalendarDays size={19}/></span><span className="nex-row-copy"><strong>{item.subject || 'Atividade'}</strong><small>{new Date(item.dueDate).toLocaleDateString('pt-BR')}</small></span><b>{new Date(item.dueDate).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</b></button>) : <EmptyChart label={modules.error ? 'Agenda indisponível no momento' : 'Nenhum compromisso futuro cadastrado'}/>}</div></article>
      </section>
      <dialog ref={rankingDialog} className="nex-ai-dialog" aria-labelledby="pipeline-ranking-title"><h2 id="pipeline-ranking-title">Performance da Equipe · {market}</h2><p>Carteira atual com os filtros ativos. Conversão = oportunidades ganhas / total.</p><div style={{maxHeight:'60vh',overflow:'auto'}}>{ranking.map((item,index)=><p key={item.id || item.name}>{index+1}. {item.name} · {item.total} oportunidades · {item.won} ganhas · {new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0}).format(item.pipeline || 0)} em aberto</p>)}</div><button onClick={()=>rankingDialog.current.close()}>Fechar</button></dialog>
      <div className="nex-pipeline-module-caption"><h2>Visão da Operação {market}</h2><span>Carteira atual · indicadores exclusivos {market}</span></div>
      {modules.loading ? <div className="nex-panel nex-modules-loading" role="status">Carregando os módulos...</div> : <>{modules.error && <p className="nex-warning" role="status">{modules.error}</p>}<ExecutiveMarketCards computed={modules.computed} data={modules.data} market={market}/></>}
      <ExecutiveModuleNavigation market={market} access={modules.access} adminLike={modules.adminLike} onIntelligence={()=>intelligenceDialog.current?.showModal()} insights={{metrics,alertsCount:alerts?.items?.length || 0,score}}/>
      <details className="nex-pipeline-details"><summary>Análises detalhadas da carteira {market}</summary>
      <div data-section="signals"><ExecutiveSignals metrics={metrics} trendChart={trendChart} performanceChart={performanceChart} temperature={temperature} signals={executiveSignals}/></div>
      <section className="nex-pipeline-analysis" data-section="analysis">
        {mapRecords && <article className="nex-panel"><PanelHeader title={performanceChart?.title || 'Performance'} subtitle={performanceChart?.subtitle}/><div className="nex-pipeline-chart"><HorizontalPerformance chart={performanceChart}/></div></article>}
        <article className="nex-panel"><PanelHeader title={temporalChart?.title || 'Visão Temporal'} subtitle={temporalChart?.subtitle || 'Evolução no período selecionado'}/><div className="nex-pipeline-temporal"><TemporalAreaChart chart={temporalChart || trendChart}/></div>{temporalChart?.note && <p className="nex-pipeline-note">{temporalChart.note}</p>}</article>
        <article className="nex-panel"><PanelHeader title="Temperatura do Pipeline" subtitle="Probabilidade média e faixas de qualificação"/><TemperatureScale value={temperature} levels={temperatureLevels} color={temperatureColor}/></article>
      </section>
      <section className="nex-pipeline-detailed-lists">
        <article className="nex-panel"><PanelHeader title={table?.title || 'Performance Comercial'} subtitle={table?.subtitle}/><div className="pipeline-model__table-wrap"><table><thead><tr>{(table?.columns || []).map(column=><th key={column.label} className={column.align === 'right' ? 'is-right' : ''}>{column.label}</th>)}</tr></thead><tbody>{(table?.rows || []).map(row=><tr key={row.id}>{row.cells.map((cell,index)=><td key={index} className={table?.columns?.[index]?.align === 'right' ? 'is-right' : ''}>{cell}</td>)}</tr>)}</tbody></table>{!table?.rows?.length && <EmptyChart label={table?.emptyLabel}/>}</div></article>
        <article className="nex-panel"><PanelHeader title={teamChart?.title || 'Distribuição da Carteira'} subtitle={teamChart?.subtitle}/><div className="nex-pipeline-team-chart"><TeamPerformance chart={teamChart}/></div></article>
      </section></details>
      {presentationControls}
    </div>
  );
}
