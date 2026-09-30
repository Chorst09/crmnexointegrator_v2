import { useMemo } from 'react';
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
import { MoreVertical } from 'lucide-react';

import './PipelineDashboardModel.css';

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

const DEFAULT_COLORS = ['#ff7a00', '#18c8df', '#f6b40b', '#22c55e', '#1f7fe5', '#ef4444'];
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

const panelOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 550 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(5, 9, 20, 0.96)',
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
  const percent = clampPercent(metric.percent);
  const primary = metric.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
  const secondary = metric.secondaryColor;
  const chartData = secondary
    ? {
        datasets: [{
          data: [percent * 0.62, percent * 0.38, 100 - percent],
          backgroundColor: [primary, secondary, '#1f2937'],
          borderWidth: 0,
          hoverOffset: 0
        }]
      }
    : {
        datasets: [{
          data: [percent, 100 - percent],
          backgroundColor: [primary, '#1f2937'],
          borderWidth: 0,
          hoverOffset: 0
        }]
      };

  return (
    <article className="pipeline-model__kpi" style={{ '--metric-color': primary }}>
      <div className="pipeline-model__ring">
        <Doughnut
          data={chartData}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            cutout: '71%',
            rotation: -90,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { duration: 650 }
          }}
        />
        <span>{Math.round(percent)}%</span>
      </div>
      <div className="pipeline-model__kpi-copy">
        <strong>{metric.value}</strong>
        <span>{metric.label}</span>
      </div>
      <MoreVertical aria-hidden="true" className="pipeline-model__kpi-menu" />
    </article>
  );
}

function MiniSignalCard({ title, label, value, data = [], color = DEFAULT_COLORS[0] }) {
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
    <article className="pipeline-model__signal-card" style={{ '--signal-color': color }}>
      <div>
        <h4>{title}</h4>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>período selecionado</p>
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

function ExecutiveSignals({ metrics = [], trendChart, performanceChart, temperature }) {
  const trendValues = trendChart?.datasets?.[0]?.data?.map((value) => Number(value) || 0) || [];
  const forecastValues = trendChart?.datasets?.[1]?.data?.map((value) => Number(value) || 0) || [];
  const performanceValues = performanceChart?.values?.map((value) => Number(value) || 0) || [];
  const cards = [
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
  const hasData = chart?.labels?.length > 0 && chart?.datasets?.some((dataset) => dataset.data?.some((value) => Number(value) > 0));
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
      tension: 0.4,
      fill: true
    }))
  }), [chart]);

  if (!hasData) return <EmptyChart />;

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
            labels: { color: '#cbd5e1', usePointStyle: true, pointStyle: 'circle', boxWidth: 7, padding: 12, font: { size: 10, weight: '700' } }
          }
        },
        scales: {
          x: { grid: { color: 'rgba(75,85,99,0.22)' }, border: { display: false }, ticks: { color: TEXT_COLOR, font: { size: 9, weight: '700' }, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: GRID_COLOR }, border: { display: false }, ticks: { color: TEXT_COLOR, font: { size: 9 }, callback: compactNumber } }
        }
      }}
    />
  );
}

function HealthDonut({ value = 0 }) {
  const score = clampPercent(value);
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#f6b40b' : '#ff7a00';
  const data = useMemo(() => ({
    datasets: [{
      data: [score, 100 - score],
      backgroundColor: [color, '#1f2937'],
      borderColor: '#050914',
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
        <span>Saúde</span>
      </div>
    </div>
  );
}

function HorizontalPerformance({ chart }) {
  const hasData = chart?.labels?.length > 0 && chart?.values?.some((value) => Number(value) > 0);
  if (!hasData) return <EmptyChart />;

  const values = chart.values.map((value) => Number(value) || 0);
  const maxValue = Math.max(...values, 1);
  const targetPercent = clampPercent(chart.targetPercent ?? 85);

  return (
    <div className="pipeline-model__performance" role="img" aria-label={`${chart.title || 'Performance'} em barras horizontais`}>
      <div className="pipeline-model__performance-legend">
        <span><i /> Resultado</span>
        <span className="is-target"><i /> Meta {targetPercent}%</span>
      </div>
      <div className="pipeline-model__performance-rows">
        {chart.labels.map((label, index) => {
          const width = Math.max((values[index] / maxValue) * 100, values[index] > 0 ? 5 : 0);
          const color = chart.colors?.[index % chart.colors.length] || DEFAULT_COLORS[index % DEFAULT_COLORS.length];
          return (
            <div className="pipeline-model__performance-row" key={`${label}-${index}`}>
              <span className="pipeline-model__performance-label" title={label}>{label}</span>
              <div className="pipeline-model__performance-track">
                <div className="pipeline-model__performance-bar" style={{ width: `${width}%`, backgroundColor: color }}>
                  {width >= 34 ? <b>{Math.round(width)}%</b> : null}
                </div>
                <i className="pipeline-model__target-marker" style={{ left: `${targetPercent}%` }} />
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
  const hasData = chart?.labels?.length > 0 && chart?.datasets?.some((dataset) => dataset.data?.length > 0);
  const data = useMemo(() => ({
    labels: chart?.labels || [],
    datasets: (chart?.datasets || []).map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.color || DEFAULT_COLORS[index + 2],
      backgroundColor: dataset.fillColor || 'rgba(69, 201, 111, 0.09)',
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

  if (!hasData) return <EmptyChart />;

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

  if (!hasData) return <EmptyChart />;

  return (
    <Bar
      data={data}
      options={{
        ...panelOptions,
        plugins: {
          ...panelOptions.plugins,
          legend: chart.datasets.length > 1
            ? { display: true, labels: { color: '#bcd4ee', usePointStyle: true, pointStyle: 'circle', boxWidth: 8, padding: 12, font: { size: 10, weight: '600' } } }
            : { display: false }
        },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#9fb9d7', font: { size: 9, weight: '600' }, maxRotation: 0 } },
          y: { beginAtZero: true, grid: { color: GRID_COLOR }, border: { display: false }, ticks: { color: TEXT_COLOR, font: { size: 9 }, precision: 0, callback: compactNumber } }
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
  table,
  alerts,
  teamChart,
  presentationControls
}) {
  return (
    <div className="pipeline-model">
      <header className="pipeline-model__toolbar">
        <div>
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="pipeline-model__controls">{controls}</div>
      </header>

      <section className="pipeline-model__kpis" aria-label="Indicadores principais">
        {metrics.slice(0, 4).map((metric, index) => (
          <KpiRing key={metric.label} metric={metric} index={index} />
        ))}
      </section>

      <ExecutiveSignals metrics={metrics} trendChart={trendChart} performanceChart={performanceChart} temperature={temperature} />

      <section className="pipeline-model__main-grid">
        <article className="pipeline-model__panel pipeline-model__funnel-panel">
          <PanelHeader title={funnelTitle} subtitle={funnelSubtitle} />
          <div className="pipeline-model__funnel-layout">
            <div className="pipeline-model__funnel">{funnel}</div>
            <TemperatureScale value={temperature} levels={temperatureLevels} color={temperatureColor} />
          </div>
        </article>

        <div className="pipeline-model__side-stack">
          <article className="pipeline-model__panel pipeline-model__chart-panel">
            <PanelHeader title={performanceChart?.title || 'Performance'} subtitle={performanceChart?.subtitle} />
            <div className="pipeline-model__chart"><HorizontalPerformance chart={performanceChart} /></div>
          </article>
          <article className="pipeline-model__panel pipeline-model__chart-panel">
            <PanelHeader title={trendChart?.title || 'Tendencia Mensal'} subtitle={trendChart?.subtitle} />
            <div className="pipeline-model__chart"><TrendChart chart={trendChart} /></div>
          </article>
        </div>
      </section>

      <section className="pipeline-model__insight-grid">
        <article className="pipeline-model__panel pipeline-model__temporal-panel">
          <PanelHeader title="Visão Temporal" subtitle="Evolução comparada do período selecionado" />
          <div className="pipeline-model__temporal-chart"><TemporalAreaChart chart={trendChart} /></div>
        </article>

        <article className="pipeline-model__panel pipeline-model__health-panel">
          <PanelHeader title="Saúde do Pipeline" subtitle="Score ponderado por conversão e temperatura" />
          <HealthDonut value={temperature} />
        </article>
      </section>

      <section className="pipeline-model__bottom-grid">
        <article className="pipeline-model__panel pipeline-model__table-panel">
          <PanelHeader title={table?.title || 'Performance Comercial'} subtitle={table?.subtitle} />
          <div className="pipeline-model__table-wrap">
            <table>
              <thead>
                <tr>
                  {(table?.columns || []).map((column) => (
                    <th key={column.label} className={column.align === 'right' ? 'is-right' : ''}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(table?.rows || []).map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => (
                      <td key={`${row.id}-${index}`} className={table?.columns?.[index]?.align === 'right' ? 'is-right' : ''}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!table?.rows?.length ? <EmptyChart label="Sem registros para exibir" /> : null}
          </div>
        </article>

        <article className="pipeline-model__panel pipeline-model__alerts-panel">
          <PanelHeader title={alerts?.title || 'Alertas do Pipeline'} subtitle={alerts?.subtitle} />
          <div className="pipeline-model__alerts">
            {(alerts?.items || []).map((item) => (
              <div key={item.id} className={`pipeline-model__alert is-${item.tone || 'blue'}`}>
                <span className="pipeline-model__alert-dot" />
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </div>
            ))}
            {!alerts?.items?.length ? <EmptyChart label="Nenhum alerta no momento" /> : null}
          </div>
        </article>

        <article className="pipeline-model__panel pipeline-model__team-panel">
          <PanelHeader title={teamChart?.title || 'Performance da Equipe'} subtitle={teamChart?.subtitle} />
          <div className="pipeline-model__team-chart"><TeamPerformance chart={teamChart} /></div>
        </article>
      </section>

      {presentationControls}
    </div>
  );
}
