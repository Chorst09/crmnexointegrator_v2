import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Beaker,
  Brain,
  Building2,
  Calculator,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Gavel,
  Layers,
  Maximize2,
  Package,
  Phone,
  RefreshCcw,
  Target,
  UserCircle2,
  Users,
  Zap
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import { getUserAccess, normalizeRole } from '../utils/permissions';
import PresentationControls from '../components/PresentationControls';
import DashboardAdvancedChart from '../components/DashboardAdvancedChart';
import { DASHBOARD_COLORS } from '../constants/dashboardTheme';
import '../styles/dashboardEffects.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler
);

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
});

const numberFormatter = new Intl.NumberFormat('pt-BR');

const formatCurrency = (value) => currencyFormatter.format(Number(value || 0));
const formatNumber = (value) => numberFormatter.format(Number(value || 0));
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatCompactCurrency = (value) => {
  const amount = Math.abs(Number(value || 0));
  if (amount >= 1_000_000_000) return `R$ ${(Number(value || 0) / 1_000_000_000).toFixed(2).replace('.', ',')} bi`;
  if (amount >= 1_000_000) return `R$ ${(Number(value || 0) / 1_000_000).toFixed(2).replace('.', ',')} mi`;
  if (amount >= 1_000) return `R$ ${(Number(value || 0) / 1_000).toFixed(1).replace('.', ',')} mil`;
  return formatCurrency(value);
};

const toArray = (value) => (Array.isArray(value) ? value : []);
const toNumber = (value) => {
  const normalized = typeof value === 'string'
    ? value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(?:\D|$))/g, '')
      .replace(',', '.')
    : value;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};

const parseJsonObject = (value) => {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const toDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
};

const parseUserFromStorage = () => {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (date) => `${monthLabels[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
const OPEN_STAGES = new Set(['LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION']);
const MONTHLY_PROJECT_TYPE = 'MONTHLY';
const B2B_STAGE_SUMMARY = [
  { key: 'LEAD', label: 'Lead', tone: 'text-sky-200', bar: 'bg-sky-400', chartColor: '#38bdf8' },
  { key: 'QUALIFICATION', label: 'Qualificação', tone: 'text-blue-200', bar: 'bg-blue-400', chartColor: '#60a5fa' },
  { key: 'DIAGNOSIS', label: 'Diagnóstico', tone: 'text-teal-200', bar: 'bg-teal-400', chartColor: '#2dd4bf' },
  { key: 'PROPOSAL', label: 'Proposta', tone: 'text-amber-200', bar: 'bg-amber-400', chartColor: '#fbbf24' },
  { key: 'NEGOTIATION', label: 'Negociação', tone: 'text-orange-200', bar: 'bg-orange-400', chartColor: '#fb923c' },
  { key: 'WON', label: 'Ganhas', tone: 'text-emerald-200', bar: 'bg-emerald-400', chartColor: '#34d399' },
  { key: 'LOST', label: 'Perdidas', tone: 'text-slate-200', bar: 'bg-slate-400', chartColor: '#94a3b8' }
];
const B2G_STAGE_SUMMARY = [
  { key: 'ANALISE', label: 'Análise', tone: 'text-cyan-200', bar: 'bg-cyan-400', chartColor: '#22d3ee' },
  { key: 'PROPOSTA_ENVIADA', label: 'Proposta enviada', tone: 'text-amber-200', bar: 'bg-amber-400', chartColor: '#fbbf24' },
  { key: 'HABILITACAO', label: 'Habilitação', tone: 'text-indigo-200', bar: 'bg-indigo-400', chartColor: '#818cf8' },
  { key: 'RECURSO', label: 'Recurso', tone: 'text-orange-200', bar: 'bg-orange-400', chartColor: '#fb923c' },
  { key: 'GANHO', label: 'Ganho', tone: 'text-emerald-200', bar: 'bg-emerald-400', chartColor: '#34d399' }
];

const normalizeB2GStageKey = (value) => {
  const key = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const aliases = {
    ANALISE: 'ANALISE',
    ANALISE_EM_ANDAMENTO: 'ANALISE',
    PROPOSTA: 'PROPOSTA_ENVIADA',
    PROPOSAL: 'PROPOSTA_ENVIADA',
    PROPOSTA_ENVIADA: 'PROPOSTA_ENVIADA',
    HABILITACAO: 'HABILITACAO',
    NEGOTIATION: 'HABILITACAO',
    RECURSO: 'RECURSO',
    GANHO: 'GANHO',
    GANHA: 'GANHO',
    WON: 'GANHO',
    PERDIDO: 'PERDIDO',
    LOST: 'PERDIDO',
    NO_GO: 'NO_GO'
  };

  return aliases[key] || key;
};

const createMonthBuckets = (count = 6) => {
  const now = new Date();
  const buckets = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ key: monthKey(date), label: monthLabel(date) });
  }
  return buckets;
};

const buildLeadStatsFromCompanies = (companies = []) => {
  const stats = { hotLeads: 0, warmLeads: 0, coldLeads: 0, lowPriority: 0, total: 0 };
  toArray(companies).forEach((company) => {
    const score = toNumber(company?.leadScore);
    if (score >= 80) stats.hotLeads += 1;
    else if (score >= 60) stats.warmLeads += 1;
    else if (score >= 40) stats.coldLeads += 1;
    else stats.lowPriority += 1;
  });
  stats.total = stats.hotLeads + stats.warmLeads + stats.coldLeads + stats.lowPriority;
  return stats;
};

const normalizeProjectType = (value) =>
  String(value || '').trim().toUpperCase() === MONTHLY_PROJECT_TYPE ? MONTHLY_PROJECT_TYPE : 'SINGLE';

const normalizeProjectMonths = (value) => {
  const months = Number(value);
  return Number.isFinite(months) && months > 0 ? months : 12;
};

const pickNumber = (...values) => {
  for (const value of values) {
    const parsed = toNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
};

const revenueBreakdownFromOpportunities = (rows = []) =>
  toArray(rows).reduce((acc, item) => {
    const b2g = parseJsonObject(item?.description);
    const hasB2GFinancialShape = Boolean(
      item?.clientType === 'B2G' ||
      item?.b2gStage ||
      b2g.processNumber ||
      b2g.numeroEdital ||
      b2g.modality ||
      b2g.modalidade ||
      b2g.contractTermMonths ||
      b2g.prazoContratual ||
      b2g.estimatedMonthlyValue !== undefined ||
      b2g.valorEstimadoMensal !== undefined ||
      b2g.estimatedOneTimeValue !== undefined ||
      b2g.valorEstimadoPontual !== undefined
    );
    const b2gMonthly = pickNumber(b2g.estimatedMonthlyValue, b2g.valorEstimadoMensal);
    const b2gOneTime = pickNumber(b2g.estimatedOneTimeValue, b2g.valorEstimadoPontual);
    const b2gContractType = String(b2g.contractType || b2g.tipoContrato || '').trim().toUpperCase();
    const b2gMonths = b2gContractType === 'PONTUAL'
      ? 1
      : normalizeProjectMonths(b2g.contractTermMonths || b2g.prazoContratual || item?.projectMonths);
    const b2gTotal = pickNumber(b2g.estimatedValue, b2g.valorEstimadoTotal, item?.value, item?.estimatedValue);

    if (hasB2GFinancialShape && (b2gMonthly > 0 || b2gTotal > 0 || b2gOneTime > 0)) {
      const calculatedTotal = (b2gMonthly * b2gMonths) + b2gOneTime;
      const total = b2gMonthly > 0 ? calculatedTotal : (b2gTotal || b2gOneTime);
      acc.monthly += b2gMonthly;
      acc.contract += b2gMonthly > 0 ? b2gMonthly * b2gMonths : 0;
      acc.single += b2gOneTime || (b2gMonthly > 0 ? 0 : total);
      acc.total += total;
      acc.monthlyCount += b2gMonthly > 0 ? 1 : 0;
      acc.singleCount += b2gMonthly > 0 ? 0 : 1;
      acc.count += 1;
      return acc;
    }

    const value = toNumber(item?.value);
    const isMonthly = normalizeProjectType(item?.projectType) === MONTHLY_PROJECT_TYPE;
    if (isMonthly) {
      const months = normalizeProjectMonths(item?.projectMonths);
      acc.monthly += value;
      acc.contract += value * months;
      acc.total += value * months;
      acc.monthlyCount += 1;
    } else {
      acc.single += value;
      acc.total += value;
      acc.singleCount += 1;
    }
    acc.count += 1;
    return acc;
  }, { monthly: 0, contract: 0, single: 0, total: 0, count: 0, monthlyCount: 0, singleCount: 0 });

const revenueBreakdownFromNotices = (rows = []) =>
  toArray(rows).reduce((acc, item) => {
    const value = toNumber(item?.estimatedValue);
    acc.single += value;
    acc.total += value;
    acc.singleCount += 1;
    acc.count += 1;
    return acc;
  }, { monthly: 0, contract: 0, single: 0, total: 0, count: 0, monthlyCount: 0, singleCount: 0 });

const mergeRevenueBreakdowns = (...items) =>
  items.reduce((acc, item) => ({
    monthly: acc.monthly + toNumber(item?.monthly),
    contract: acc.contract + toNumber(item?.contract),
    single: acc.single + toNumber(item?.single),
    total: acc.total + toNumber(item?.total),
    count: acc.count + toNumber(item?.count),
    monthlyCount: acc.monthlyCount + toNumber(item?.monthlyCount),
    singleCount: acc.singleCount + toNumber(item?.singleCount)
  }), { monthly: 0, contract: 0, single: 0, total: 0, count: 0, monthlyCount: 0, singleCount: 0 });

const buildB2BStageBreakdown = (rows = []) => {
  const base = Object.fromEntries(
    B2B_STAGE_SUMMARY.map((stage) => [
      stage.key,
      { ...stage, total: 0, monthly: 0, contract: 0, single: 0, count: 0 }
    ])
  );

  toArray(rows).forEach((item) => {
    const stage = String(item?.stage || 'LEAD').trim().toUpperCase();
    if (!base[stage]) return;
    const revenue = revenueBreakdownFromOpportunities([item]);
    base[stage].total += revenue.total;
    base[stage].monthly += revenue.monthly;
    base[stage].contract += revenue.contract;
    base[stage].single += revenue.single;
    base[stage].count += 1;
  });

  return B2B_STAGE_SUMMARY.map((stage) => base[stage.key]);
};

const resolveB2GSummaryStage = (item = {}) => {
  const b2gStage = normalizeB2GStageKey(item?.b2gStage);
  if (b2gStage) return b2gStage;

  return normalizeB2GStageKey(item?.stage) || 'ANALISE';
};

const buildB2GStageBreakdown = (rows = []) => {
  const base = Object.fromEntries(
    B2G_STAGE_SUMMARY.map((stage) => [
      stage.key,
      { ...stage, total: 0, monthly: 0, contract: 0, single: 0, count: 0 }
    ])
  );

  toArray(rows).forEach((item) => {
    const stage = resolveB2GSummaryStage(item);
    if (!base[stage]) return;
    const revenue = revenueBreakdownFromOpportunities([item]);
    base[stage].total += revenue.total;
    base[stage].monthly += revenue.monthly;
    base[stage].contract += revenue.contract;
    base[stage].single += revenue.single;
    base[stage].count += 1;
  });

  return B2G_STAGE_SUMMARY.map((stage) => base[stage.key]);
};

function StageRevenueSection({ title, subtitle, rows = [], totals = {} }) {
  const visibleRows = rows.filter((row) =>
    toNumber(row.total) > 0 || toNumber(row.monthly) > 0 || toNumber(row.count) > 0
  );
  const chartRows = visibleRows.length > 0 ? visibleRows : rows;
  const rowsMax = Math.max(...rows.map((row) => toNumber(row.total)), 1);
  const monthlyChartData = useMemo(() => ({
    labels: chartRows.map((row) => row.label),
    datasets: [{
      label: 'Mensal',
      data: chartRows.map((row) => toNumber(row.monthly)),
      backgroundColor: chartRows.map((row) => row.chartColor),
      borderRadius: 8,
      borderSkipped: false,
      barThickness: 9
    }]
  }), [chartRows]);
  const currencyTooltip = {
    callbacks: {
      label: (context) => `${context.dataset.label ? `${context.dataset.label}: ` : ''}${formatCurrency(context.parsed?.x ?? context.parsed ?? 0)}`
    }
  };

  if (!rows.length) return null;

  return (
    <div className="mt-5 border-t border-[#263345] pt-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8f9caf]">{title}</p>
          <p className="mt-1 text-[11px] font-semibold text-[#6f7f95]">{subtitle}</p>
        </div>
        <p className="shrink-0 text-[10px] font-bold text-[#8f9caf]">Mensal / Total</p>
      </div>

      <div className="rounded-lg border border-[#263345] bg-[#0b1220]/70 p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-wide text-[#8f9caf]">Mensal por fase</p>
          <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] font-black text-emerald-100">
            {formatCompactCurrency(totals.monthly)}
          </span>
        </div>
        <div className="h-[132px]">
          <Bar
            data={monthlyChartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              indexAxis: 'y',
              plugins: {
                legend: { display: false },
                tooltip: currencyTooltip
              },
              scales: {
                x: {
                  beginAtZero: true,
                  grid: { color: 'rgba(143,156,175,0.12)' },
                  ticks: {
                    color: '#8f9caf',
                    callback: (value) => formatCompactCurrency(value).replace('R$ ', '')
                  }
                },
                y: {
                  grid: { display: false },
                  ticks: {
                    color: '#c9d4e5',
                    font: { size: 10, weight: '700' }
                  }
                }
              }
            }}
          />
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => {
          const width = Math.max(row.total > 0 ? 6 : 0, Math.round((toNumber(row.total) / rowsMax) * 100));
          return (
            <div key={row.key} className="min-w-0 rounded-lg border border-[#263345] bg-[#0b1220]/55 px-3 py-2">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className={`block truncate text-[10px] font-black uppercase tracking-[0.08em] ${row.tone}`}>
                    {row.label}
                  </span>
                  <span className="text-[10px] font-semibold text-[#8f9caf]">
                    {formatNumber(row.count)} oportunidade(s)
                  </span>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-black text-white" title={formatCurrency(row.monthly)}>
                    {formatCompactCurrency(row.monthly)}
                  </div>
                  <div className="text-[10px] font-bold text-[#8f9caf]" title={formatCurrency(row.total)}>
                    {formatCompactCurrency(row.total)}
                  </div>
                </div>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#0d1423]">
                <div className={`h-full rounded-full ${row.bar}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RevenueOverview({ b2bRevenue, b2gRevenue, consolidatedRevenue, b2bStageBreakdown = [], b2gStageBreakdown = [] }) {
  const safeTotal = Math.max(toNumber(consolidatedRevenue.total), 1);
  const channels = [
    {
      id: 'b2b',
      title: 'B2B Privado',
      subtitle: 'Modelo comercial corporativo',
      icon: Building2,
      totals: b2bRevenue,
      color: 'from-orange-400 to-cyan-400',
      tint: 'text-orange-200',
      share: Math.round((toNumber(b2bRevenue.total) / safeTotal) * 100),
      stageBreakdown: b2bStageBreakdown,
      stageTitle: 'Carteira B2B por fase',
      stageSubtitle: 'Valor mensal ativo e total no funil privado'
    },
    {
      id: 'b2g',
      title: 'B2G Governo',
      subtitle: 'Editais e oportunidades públicas',
      icon: Gavel,
      totals: b2gRevenue,
      color: 'from-blue-500 to-cyan-400',
      tint: 'text-cyan-200',
      share: Math.round((toNumber(b2gRevenue.total) / safeTotal) * 100),
      stageBreakdown: b2gStageBreakdown,
      stageTitle: 'Carteira B2G por fase',
      stageSubtitle: 'Valor mensal ativo e total por fase pública'
    }
  ];

  const mix = [
    { label: 'Mensal', value: consolidatedRevenue.monthly, color: 'bg-teal-300' },
    { label: 'Contrato', value: consolidatedRevenue.contract, color: 'bg-blue-500' },
    { label: 'Pontual', value: consolidatedRevenue.single, color: 'bg-orange-500' }
  ];
  const mixTotal = Math.max(mix.reduce((sum, item) => sum + toNumber(item.value), 0), 1);

  return (
    <div className="dashboard-card overflow-hidden rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] shadow-[0_28px_76px_-56px_rgba(24,200,223,0.18)]">
      <div className="border-b border-[#263345] p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.55fr)] xl:items-center">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl border border-orange-300/30 bg-orange-400/10 p-3 text-orange-200">
              <CalendarClock className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#8f9caf]">Consolidado</p>
              <h2 className="mt-1 truncate text-[clamp(1.6rem,2.5vw,2.45rem)] font-black leading-none text-white" title={formatCurrency(consolidatedRevenue.total)}>
                {formatCompactCurrency(consolidatedRevenue.total)}
              </h2>
              <p className="mt-2 text-sm font-semibold leading-snug text-[#a9c5df]">Receita comercial no período selecionado</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {mix.map((item) => {
              const width = Math.max(4, Math.round((toNumber(item.value) / mixTotal) * 100));
              return (
                <div key={item.label} className="rounded-lg border border-[#263345] bg-[#0b1220]/65 p-3">
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                    <span className="font-bold uppercase tracking-wide text-[#8f9caf]">{item.label}</span>
                    <span className="font-black text-[#f4f7fb]">{formatCompactCurrency(item.value)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[#0d1423]">
                    <div className={`h-full rounded-full ${item.color}`} style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 divide-y divide-[#263345] xl:grid-cols-2 xl:items-start xl:divide-x xl:divide-y-0">
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <div key={channel.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-xl bg-gradient-to-br ${channel.color} p-2 text-white shadow-[0_16px_30px_-22px_rgba(24,200,223,0.65)]`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[#f4f7fb]">{channel.title}</p>
                        <p className="truncate text-xs text-[#8f9caf]">{channel.subtitle}</p>
                      </div>
                    </div>
                  </div>
                  <span className={`rounded-full border border-white/10 bg-white/[0.06] px-2 py-1 text-xs font-black ${channel.tint}`}>
                    {channel.share}%
                  </span>
                </div>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#0d1423]">
                  <div className={`h-full rounded-full bg-gradient-to-r ${channel.color}`} style={{ width: `${Math.max(channel.share, 4)}%` }} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">Total</p>
                    <p className="mt-1 truncate text-lg font-black leading-tight text-white" title={formatCurrency(channel.totals.total)}>
                      {formatCompactCurrency(channel.totals.total)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">Mensal</p>
                    <p className="mt-1 truncate text-lg font-black leading-tight text-white" title={formatCurrency(channel.totals.monthly)}>
                      {formatCompactCurrency(channel.totals.monthly)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">Contrato</p>
                    <p className="mt-1 truncate text-lg font-black leading-tight text-white" title={formatCurrency(channel.totals.contract)}>
                      {formatCompactCurrency(channel.totals.contract)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">Pontual</p>
                    <p className="mt-1 truncate text-lg font-black leading-tight text-white" title={formatCurrency(channel.totals.single)}>
                      {formatCompactCurrency(channel.totals.single)}
                    </p>
                  </div>
                </div>

                <StageRevenueSection
                  title={channel.stageTitle}
                  subtitle={channel.stageSubtitle}
                  rows={channel.stageBreakdown}
                  totals={channel.totals}
                />
              </div>
            );
          })}
      </div>
    </div>
  );
}

// KpiCard has been migrated to DashboardKPICard component - see below for mapping

function ModuleCard({ title, subtitle, icon: Icon, color, kpis, route, navigate, badge }) {
  const gradients = {
    blue: 'from-orange-500 to-cyan-500',
    indigo: 'from-blue-600 to-cyan-500',
    sky: 'from-cyan-500 to-blue-600'
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)]">
      <div className={`bg-gradient-to-r ${gradients[color]} p-5`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/20 p-2.5">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white">{title}</h3>
              <p className="text-xs text-white/70">{subtitle}</p>
            </div>
          </div>
          {badge && (
            <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-white">{badge}</span>
          )}
        </div>
      </div>
      <div className={`grid ${kpis.length > 3 ? 'grid-cols-2' : 'grid-cols-3'} border-t border-[var(--crm-border)]`}>
        {kpis.map((item) => (
          <div key={item.label} className="min-w-0 border-b border-r border-[var(--crm-border)] p-3 text-center last:border-r-0">
            <p className="truncate text-[clamp(0.95rem,1.2vw,1.125rem)] font-bold leading-tight text-[var(--crm-ink)]" title={String(item.value)}>
              {String(item.value).startsWith('R$') ? formatCompactCurrency(String(item.value).replace(/[^\d,-]/g, '').replace('.', '').replace(',', '.')) : item.value}
            </p>
            <p className="mt-1 text-[11px] leading-tight text-[var(--crm-muted)]">{item.label}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-[var(--crm-border)] px-5 py-3">
        <button
          onClick={() => navigate(route)}
          className="flex w-full items-center justify-center gap-2 text-sm font-medium text-[var(--crm-accent)] hover:underline"
        >
          Acessar módulo <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, action, children }) {
  return (
    <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[var(--crm-ink)]">{title}</h3>
          {subtitle && <p className="text-xs text-[var(--crm-muted)]">{subtitle}</p>}
        </div>
        {action || null}
      </div>
      <div className="h-[280px]">{children}</div>
    </div>
  );
}

function ExecutiveSparkCard({ title, label, value, data = [], color = '#ff7a00' }) {
  const chartData = useMemo(() => ({
    labels: data.map((_, index) => String(index + 1)),
    datasets: [{
      data,
      borderColor: color,
      backgroundColor: `${color}24`,
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.42,
      fill: true
    }]
  }), [color, data]);

  const hasData = data.some((item) => Number(item) > 0);

  return (
    <div className="dashboard-card grid min-h-[132px] grid-cols-[minmax(0,0.82fr)_minmax(120px,1fr)] gap-3 overflow-hidden rounded-lg border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.98),rgba(13,20,35,0.98))] p-4">
      <div className="min-w-0">
        <p className="text-sm font-black leading-tight text-[#f4f7fb]">{title}</p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-[#8f9caf]">{label}</p>
        <p className="mt-1 truncate text-2xl font-black leading-none text-white" title={String(value)}>{value}</p>
      </div>
      <div className="h-[88px] min-w-0 self-end">
        {hasData ? (
          <Line
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false }, tooltip: { enabled: false } },
              scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
              animation: { duration: 500 }
            }}
          />
        ) : null}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${color}, #f6b40b, #22c55e)` }} />
    </div>
  );
}

function ActivityItem({ icon: Icon, color, title, sub, time }) {
  const colors = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/20 text-amber-400',
    purple: 'bg-purple-500/20 text-purple-400'
  };
  return (
    <div className="flex items-start gap-3 border-b border-[var(--crm-border)] py-3 last:border-0">
      <div className={`mt-0.5 rounded-lg p-1.5 ${colors[color]}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--crm-ink)]">{title}</p>
        <p className="text-xs text-[var(--crm-muted)]">{sub}</p>
      </div>
      <span className="whitespace-nowrap text-xs text-[var(--crm-muted)]">{time}</span>
    </div>
  );
}

const chartOptionsBase = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#94a3b8',
        usePointStyle: true,
        boxWidth: 8,
        boxHeight: 8
      }
    },
    tooltip: {
      backgroundColor: 'rgba(15, 23, 42, 0.92)',
      titleColor: '#f8fafc',
      bodyColor: '#e2e8f0',
      borderColor: 'rgba(148, 163, 184, 0.3)',
      borderWidth: 1
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(148, 163, 184, 0.1)' },
      ticks: { color: '#94a3b8' }
    },
    y: {
      grid: { color: 'rgba(148, 163, 184, 0.1)' },
      ticks: { color: '#94a3b8' }
    }
  }
};

export default function DashboardGeral() {
  const navigate = useNavigate();
  const presentationRef = useRef(null);
  const [presentationMode, setPresentationMode] = useState(false);
  const [presentationProgress, setPresentationProgress] = useState({ current: 1, total: 1 });
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('180');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [data, setData] = useState({});
  const [moduleHealth, setModuleHealth] = useState([]);

  const user = parseUserFromStorage() || {};
  const access = getUserAccess(user);
  const role = normalizeRole(user?.role);
  const adminLike = ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(role);

  const loadData = async () => {
    setLoading(true);
    const headers = getAuthHeaders();

    try {
      const response = await fetch(buildApiUrl('/dashboard?type=general'), { headers });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json().catch(() => null);
      if (!payload?.data || !Array.isArray(payload?.moduleHealth)) {
        throw new Error('Resposta agregada inválida');
      }

      setData(payload.data);
      setModuleHealth(payload.moduleHealth);
      setUpdatedAt(new Date());
      setLoading(false);
      return;
    } catch (error) {
      console.warn('Dashboard geral agregado indisponível, usando carregamento legado:', error);
    }

    const parseRows = (payload) => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.rows)) return payload.rows;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.results)) return payload.results;
      return [];
    };
    const parsePreSales = (payload) => {
      const rows = Array.isArray(payload?.solicitacoes) ? payload.solicitacoes : [];
      return { rows, total: toNumber(payload?.total || rows.length) };
    };

    const modules = [
      { key: 'opportunitiesB2B', label: 'Oportunidades B2B', endpoint: '/opportunities?clientType=B2B', enabled: access.accessB2B, normalize: parseRows, emptyValue: [] },
      { key: 'opportunitiesB2G', label: 'Oportunidades B2G', endpoint: '/opportunities?clientType=B2G', enabled: access.accessB2G, normalize: parseRows, emptyValue: [] },
      { key: 'companiesB2B', label: 'Empresas B2B', endpoint: '/companies?clientType=B2B', enabled: access.accessB2B, normalize: parseRows, emptyValue: [] },
      { key: 'companiesB2G', label: 'Empresas B2G', endpoint: '/companies?clientType=B2G', enabled: access.accessB2G, normalize: parseRows, emptyValue: [] },
      { key: 'b2g', label: 'Editais B2G', endpoint: '/b2g/editais', enabled: access.accessB2G, normalize: parseRows, emptyValue: [] },
      { key: 'prevendasOportunidades', label: 'Registro Pré-Vendas', endpoint: '/prevendas-cadastros/oportunidades', enabled: (access.accessPreSales || adminLike), normalize: parseRows, emptyValue: [] },
      { key: 'preSales', label: 'Pré-vendas', endpoint: '/pre-vendas?limit=200', enabled: access.accessPreSales || adminLike, normalize: parsePreSales, emptyValue: { rows: [], total: 0 }, count: (payload) => payload.total },
      { key: 'preSalesPocs', label: 'POCs Pré-Vendas', endpoint: '/pre-sales-pocs', enabled: access.accessPreSales || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'activities', label: 'Atividades', endpoint: '/activities', enabled: access.accessB2B || access.accessB2G || access.accessPreSales, normalize: parseRows, emptyValue: [] },
      { key: 'products', label: 'Produtos', endpoint: '/products', enabled: access.accessB2B || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'sellers', label: 'Equipe comercial', endpoint: '/users?role=SELLER', enabled: adminLike || access.accessB2B || access.accessB2G, normalize: parseRows, emptyValue: [] },
      { key: 'proposals', label: 'Propostas', endpoint: '/proposals', enabled: access.accessB2B || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'contracts', label: 'Contratos', endpoint: '/contracts', enabled: access.accessB2B || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'commissions', label: 'Comissões', endpoint: '/commissions?limit=200', enabled: access.accessB2B || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'salesTargets', label: 'Metas comerciais', endpoint: '/sales-targets', enabled: access.accessB2B || access.accessB2G || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'leadStatsB2B', label: 'Lead scoring B2B', endpoint: '/leadScoring?action=stats&clientType=B2B', enabled: access.accessB2B, normalize: (payload) => (payload && typeof payload === 'object' ? payload : {}), emptyValue: {} },
      { key: 'leadStatsB2G', label: 'Lead scoring B2G', endpoint: '/leadScoring?action=stats&clientType=B2G', enabled: access.accessB2G, normalize: (payload) => (payload && typeof payload === 'object' ? payload : {}), emptyValue: {} },
      { key: 'workflows', label: 'Workflows', endpoint: '/workflows', enabled: adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'automationRules', label: 'Regras de automação', endpoint: '/workflows/automation-rules', enabled: adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'automationNotifications', label: 'Notificações automação', endpoint: '/workflows/notifications', enabled: adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'integrations', label: 'Integrações', endpoint: '/integrations', enabled: adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'regions', label: 'Regiões', endpoint: '/regions', enabled: adminLike, normalize: parseRows, emptyValue: [] }
    ];

    const health = await Promise.all(
      modules.map(async (module) => {
        if (!module.enabled) {
          return { ...module, status: 'skipped', count: 0, data: module.emptyValue, error: null };
        }

        try {
          const response = await fetch(buildApiUrl(module.endpoint), { headers });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const raw = await response.json().catch(() => null);
          const normalized = module.normalize(raw);
          const count = typeof module.count === 'function'
            ? module.count(normalized, raw)
            : Array.isArray(normalized) ? normalized.length : toNumber(normalized?.total || 0);

          return { ...module, status: 'ok', count, data: normalized, error: null };
        } catch (err) {
          return {
            ...module,
            status: 'error',
            count: 0,
            data: module.emptyValue,
            error: err?.message || 'Falha na requisição'
          };
        }
      })
    );

    const nextData = health.reduce((acc, item) => {
      acc[item.key] = item.data;
      return acc;
    }, {});

    setData(nextData);
    setModuleHealth(health);
    setUpdatedAt(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const computed = useMemo(() => {
    const rangeDays = toNumber(timeRange) || 180;
    const rangeStart = new Date();
    rangeStart.setHours(0, 0, 0, 0);
    rangeStart.setDate(rangeStart.getDate() - rangeDays);

    const inRange = (value) => {
      const date = toDate(value);
      if (!date) return false;
      return date >= rangeStart;
    };

    const opportunitiesB2B = toArray(data.opportunitiesB2B);
    const opportunitiesB2G = toArray(data.opportunitiesB2G);
    const companiesB2B = toArray(data.companiesB2B);
    const companiesB2G = toArray(data.companiesB2G);
    const b2gNotices = toArray(data.b2g);
    const preSales = toArray(data.preSales?.rows);
    const preSalesPocs = toArray(data.preSalesPocs);
    const prevendasOportunidades = toArray(data.prevendasOportunidades);
    const activities = toArray(data.activities);
    const products = toArray(data.products);
    const sellers = toArray(data.sellers);
    const proposals = toArray(data.proposals);
    const contracts = toArray(data.contracts);
    const commissions = toArray(data.commissions);
    const salesTargets = toArray(data.salesTargets);
    const workflows = toArray(data.workflows);
    const automationRules = toArray(data.automationRules);
    const automationNotifications = toArray(data.automationNotifications);
    const integrations = toArray(data.integrations);
    const regions = toArray(data.regions);

    const opportunitiesB2BRange = opportunitiesB2B.filter((item) => inRange(item.createdAt || item.updatedAt));
    const opportunitiesB2GRange = opportunitiesB2G.filter((item) => inRange(item.createdAt || item.updatedAt));
    const b2gNoticesRange = b2gNotices.filter((item) => inRange(item.createdAt || item.updatedAt));
    const preSalesRange = preSales.filter((item) => inRange(item.createdAt || item.updatedAt));
    const preSalesPocsRange = preSalesPocs.filter((item) => inRange(item.createdAt || item.updatedAt || item.dueDate));
    const activitiesRange = activities.filter((item) => inRange(item.createdAt || item.updatedAt || item.dueDate));
    const proposalsRange = proposals.filter((item) => inRange(item.createdAt || item.updatedAt || item.sentAt));
    const contractsRange = contracts.filter((item) => inRange(item.createdAt || item.updatedAt || item.startDate));

    const openB2B = opportunitiesB2BRange.filter((item) => OPEN_STAGES.has(String(item.stage || '').toUpperCase()));
    const wonB2B = opportunitiesB2BRange.filter((item) => String(item.stage || '').toUpperCase() === 'WON');
    const lostB2B = opportunitiesB2BRange.filter((item) => String(item.stage || '').toUpperCase() === 'LOST');

    const openB2GOpps = opportunitiesB2GRange.filter((item) => OPEN_STAGES.has(String(item.stage || '').toUpperCase()));
    const wonB2GOpps = opportunitiesB2GRange.filter((item) => String(item.stage || '').toUpperCase() === 'WON');

    const activeNoticeStatuses = new Set([
      'MONITORANDO',
      'ANALISE_EM_ANDAMENTO',
      'ANALISE_CONCLUIDA',
      'PROPOSTA_EM_PREPARACAO',
      'ENVIADA',
      'SUSPENSA'
    ]);
    const wonNoticeStatuses = new Set(['GANHO']);

    const activeB2GNotices = b2gNoticesRange.filter((item) => activeNoticeStatuses.has(String(item.status || '').toUpperCase()));
    const wonB2GNotices = b2gNoticesRange.filter((item) => wonNoticeStatuses.has(String(item.status || '').toUpperCase()));
    const inAnalysisB2G = b2gNoticesRange.filter((item) => String(item.status || '').toUpperCase() === 'ANALISE_EM_ANDAMENTO');

    const pendingPreSalesStatuses = new Set(['NOVA', 'EM_PRECIFICACAO', 'AGUARDANDO_APROVACAO']);
    const donePreSalesStatuses = new Set(['FINALIZADA']);
    const pendingPreSales = preSalesRange.filter((item) => pendingPreSalesStatuses.has(String(item.status || '').toUpperCase()));
    const donePreSales = preSalesRange.filter((item) => donePreSalesStatuses.has(String(item.status || '').toUpperCase()));
    const activePocStatuses = new Set(['PLANEJAMENTO', 'EM_ANDAMENTO', 'VALIDACAO']);
    const finalPocStatuses = new Set(['APROVADA', 'DESCARTADA']);
    const activePreSalesPocs = preSalesPocsRange.filter((item) => activePocStatuses.has(String(item.status || '').toUpperCase()));
    const approvedPreSalesPocs = preSalesPocsRange.filter((item) => String(item.status || '').toUpperCase() === 'APROVADA');
    const blockedPreSalesPocs = preSalesPocsRange.filter((item) => String(item.status || '').toUpperCase() === 'BLOQUEADA');
    const overduePreSalesPocs = preSalesPocsRange.filter((item) => {
      const dueDate = toDate(item.dueDate);
      if (!dueDate) return false;
      return dueDate < new Date() && !finalPocStatuses.has(String(item.status || '').toUpperCase());
    });

    const pendingActivities = activitiesRange.filter((item) => {
      const status = String(item.status || '').toUpperCase();
      return status === 'PENDING' || status === 'OPEN' || status === 'IN_PROGRESS';
    });

    const overdueActivities = activitiesRange.filter((item) => {
      const dueDate = toDate(item.dueDate);
      if (!dueDate) return false;
      const status = String(item.status || '').toUpperCase();
      if (status === 'COMPLETED' || status === 'DONE' || status === 'CANCELLED') return false;
      return dueDate < new Date();
    });

    const nowDash = new Date();
    const daysDash = (n) => new Date(nowDash.getTime() + n * 24 * 60 * 60 * 1000);
    const expiringOportunidades = prevendasOportunidades.filter((item) => {
      if (!item.dataValidade) return false;
      const val = toDate(item.dataValidade);
      if (!val) return false;
      return val <= daysDash(30) && val > nowDash;
    });
    const expiredOportunidades = prevendasOportunidades.filter((item) => {
      if (!item.dataValidade) return false;
      const val = toDate(item.dataValidade);
      if (!val) return false;
      return val < nowDash;
    });
    const expiring7 = expiringOportunidades.filter((item) => toDate(item.dataValidade) <= daysDash(7));
    const expiring15 = expiringOportunidades.filter((item) => {
      const v = toDate(item.dataValidade);
      return v > daysDash(7) && v <= daysDash(15);
    });
    const expiring30 = expiringOportunidades.filter((item) => {
      const v = toDate(item.dataValidade);
      return v > daysDash(15) && v <= daysDash(30);
    });

    const activeProducts = products.filter((item) => item?.active !== false);

    const b2bRevenue = revenueBreakdownFromOpportunities(openB2B);
    const b2bStageBreakdown = buildB2BStageBreakdown(opportunitiesB2BRange);
    const b2gOpportunityRevenue = revenueBreakdownFromOpportunities(openB2GOpps);
    const b2gNoticeRevenue = revenueBreakdownFromNotices(activeB2GNotices);
    const b2gStageBreakdown = buildB2GStageBreakdown(opportunitiesB2GRange);
    const b2gRevenue = b2gOpportunityRevenue;
    const consolidatedRevenue = mergeRevenueBreakdowns(b2bRevenue, b2gRevenue);
    const b2bWonRevenue = revenueBreakdownFromOpportunities(wonB2B);
    const b2gWonRevenue = revenueBreakdownFromOpportunities(wonB2GOpps);

    const b2bPipelineValue = b2bRevenue.total;
    const b2bWonValue = b2bWonRevenue.total;
    const b2gNoticePipelineValue = b2gNoticeRevenue.total;
    const b2gNoticeWonValue = revenueBreakdownFromNotices(wonB2GNotices).total;
    const b2gOpportunityPipelineValue = b2gOpportunityRevenue.total;
    const b2gOpportunityWonValue = revenueBreakdownFromOpportunities(wonB2GOpps).total;

    const totalPipeline = b2bPipelineValue + b2gOpportunityPipelineValue;
    const totalWonValue = b2bWonValue + b2gOpportunityWonValue;

    const b2bConversion = opportunitiesB2BRange.length > 0
      ? (wonB2B.length / opportunitiesB2BRange.length) * 100
      : 0;
    const b2gConversion = opportunitiesB2GRange.length > 0
      ? (wonB2GOpps.length / opportunitiesB2GRange.length) * 100
      : 0;
    const preSalesApproval = preSalesRange.length > 0
      ? (donePreSales.length / preSalesRange.length) * 100
      : 0;

    const leadStatsB2B =
      data?.leadStatsB2B && Object.keys(data.leadStatsB2B).length > 0
        ? data.leadStatsB2B
        : buildLeadStatsFromCompanies(companiesB2B);
    const leadStatsB2G =
      data?.leadStatsB2G && Object.keys(data.leadStatsB2G).length > 0
        ? data.leadStatsB2G
        : buildLeadStatsFromCompanies(companiesB2G);

    const hotLeads = toNumber(leadStatsB2B.hotLeads) + toNumber(leadStatsB2G.hotLeads);
    const warmLeads = toNumber(leadStatsB2B.warmLeads) + toNumber(leadStatsB2G.warmLeads);

    const teamMap = {};
    [...opportunitiesB2BRange, ...opportunitiesB2GRange].forEach((item) => {
      const ownerName = item?.owner?.name || 'Sem responsável';
      if (!teamMap[ownerName]) {
        teamMap[ownerName] = { name: ownerName, total: 0, won: 0, pipeline: 0 };
      }
      teamMap[ownerName].total += 1;
      if (String(item.stage || '').toUpperCase() === 'WON') {
        teamMap[ownerName].won += 1;
      }
      if (OPEN_STAGES.has(String(item.stage || '').toUpperCase())) {
        teamMap[ownerName].pipeline += revenueBreakdownFromOpportunities([item]).total;
      }
    });

    let teamPerformance = Object.values(teamMap)
      .sort((a, b) => b.pipeline - a.pipeline || b.total - a.total)
      .slice(0, 6);

    if (teamPerformance.length === 0 && sellers.length > 0) {
      teamPerformance = sellers.slice(0, 6).map((seller) => ({
        name: seller.name,
        total: toNumber(seller?._count?.opportunities),
        won: 0,
        pipeline: 0
      }));
    }

    const buckets = createMonthBuckets(6);
    const monthIndex = new Map(buckets.map((item, idx) => [item.key, idx]));

    const monthlyPotential = new Array(buckets.length).fill(0);
    const monthlyWon = new Array(buckets.length).fill(0);
    const monthlyActivities = new Array(buckets.length).fill(0);
    const monthlyB2B = {
      recurring: new Array(buckets.length).fill(0),
      contract: new Array(buckets.length).fill(0),
      single: new Array(buckets.length).fill(0)
    };
    const monthlyB2G = {
      recurring: new Array(buckets.length).fill(0),
      contract: new Array(buckets.length).fill(0),
      single: new Array(buckets.length).fill(0)
    };

    const addOpportunityRevenueToBucket = (item, bucketSet) => {
      const createdDate = toDate(item.createdAt || item.updatedAt);
      if (!createdDate) return;
      const idx = monthIndex.get(monthKey(createdDate));
      if (idx === undefined) return;
      const revenue = revenueBreakdownFromOpportunities([item]);
      bucketSet.recurring[idx] += revenue.monthly;
      bucketSet.contract[idx] += revenue.contract;
      bucketSet.single[idx] += revenue.single;
    };

    opportunitiesB2BRange.forEach((item) => addOpportunityRevenueToBucket(item, monthlyB2B));
    opportunitiesB2GRange.forEach((item) => addOpportunityRevenueToBucket(item, monthlyB2G));

    [...opportunitiesB2BRange, ...opportunitiesB2GRange].forEach((item) => {
      const createdDate = toDate(item.createdAt || item.updatedAt);
      if (!createdDate) return;
      const idx = monthIndex.get(monthKey(createdDate));
      if (idx === undefined) return;
      monthlyPotential[idx] += revenueBreakdownFromOpportunities([item]).total;
      if (String(item.stage || '').toUpperCase() === 'WON') {
        monthlyWon[idx] += revenueBreakdownFromOpportunities([item]).total;
      }
    });

    activitiesRange.forEach((item) => {
      const createdDate = toDate(item.createdAt || item.updatedAt || item.dueDate);
      if (!createdDate) return;
      const idx = monthIndex.get(monthKey(createdDate));
      if (idx === undefined) return;
      monthlyActivities[idx] += 1;
    });

    const stageOrder = ['LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    const stageLabels = {
      LEAD: 'Lead',
      QUALIFICATION: 'Qualificação',
      DIAGNOSIS: 'Diagnóstico',
      PROPOSAL: 'Proposta',
      NEGOTIATION: 'Negociação',
      WON: 'Ganhas',
      LOST: 'Perdidas'
    };

    const countByStage = (rows) => {
      const result = Object.fromEntries(stageOrder.map((stage) => [stage, 0]));
      rows.forEach((row) => {
        const stage = String(row.stage || '').toUpperCase();
        if (stage in result) result[stage] += 1;
      });
      return stageOrder.map((stage) => result[stage]);
    };

    const b2bStageCounts = countByStage(opportunitiesB2BRange);
    const b2gOppStageCounts = countByStage(opportunitiesB2GRange);

    return {
      opportunitiesB2BRange,
      opportunitiesB2GRange,
      companiesB2B,
      companiesB2G,
      b2gNoticesRange,
      preSalesRange,
      preSalesPocsRange,
      activitiesRange,
      proposalsRange,
      contractsRange,
      commissions,
      salesTargets,
      workflows,
      automationRules,
      automationNotifications,
      integrations,
      regions,
      pendingActivities,
      overdueActivities,
      activeProducts,
      activeB2GNotices,
      inAnalysisB2G,
      pendingPreSales,
      donePreSales,
      activePreSalesPocs,
      approvedPreSalesPocs,
      blockedPreSalesPocs,
      overduePreSalesPocs,
      b2bRevenue,
      b2bStageBreakdown,
      b2gRevenue,
      b2gStageBreakdown,
      consolidatedRevenue,
      b2bWonRevenue,
      b2gWonRevenue,
      totalPipeline,
      totalWonValue,
      b2bPipelineValue,
      b2bWonValue,
      b2bConversion,
      b2gConversion,
      preSalesApproval,
      hotLeads,
      warmLeads,
      leadStatsB2B,
      leadStatsB2G,
      teamPerformance,
      buckets,
      monthlyPotential,
      monthlyWon,
      monthlyActivities,
      monthlyB2B,
      monthlyB2G,
      stageOrder,
      stageLabels,
      b2bStageCounts,
      b2gOppStageCounts,
      expiringOportunidades,
      expiredOportunidades,
      expiring7,
      expiring15,
      expiring30
    };
  }, [data, timeRange]);

  const modulesEnabled = moduleHealth.filter((item) => item.status !== 'skipped').length;
  const modulesLoaded = moduleHealth.filter((item) => item.status === 'ok').length;
  const modulesWithError = moduleHealth.filter((item) => item.status === 'error').length;

  const chartData = useMemo(() => {
    const {
      buckets,
      monthlyPotential,
      monthlyWon,
      monthlyActivities,
      stageOrder,
      stageLabels,
      b2bStageCounts,
      b2gOppStageCounts,
      leadStatsB2B,
      leadStatsB2G,
      teamPerformance,
      pendingActivities,
      overdueActivities,
      pendingPreSales,
      activePreSalesPocs,
      blockedPreSalesPocs,
      inAnalysisB2G,
      activeB2GNotices,
      opportunitiesB2BRange,
      opportunitiesB2GRange,
      b2bRevenue,
      b2gRevenue,
      consolidatedRevenue,
      monthlyB2B,
      monthlyB2G,
      b2bPipelineValue,
      totalPipeline
    } = computed;

    const moduleVolumeRows = moduleHealth
      .filter((item) => item.status === 'ok')
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const monthlyTrend = {
      labels: buckets.map((item) => item.label),
      datasets: [
        {
          label: 'Potencial de receita',
          data: monthlyPotential,
          borderColor: '#18c8df',
          backgroundColor: 'rgba(24, 200, 223, 0.18)',
          tension: 0.35,
          fill: true,
          borderWidth: 2
        },
        {
          label: 'Receita ganha',
          data: monthlyWon,
          borderColor: '#34d399',
          backgroundColor: 'rgba(52, 211, 153, 0.16)',
          tension: 0.35,
          fill: true,
          borderWidth: 2
        }
      ]
    };

    const stageDistribution = {
      labels: stageOrder.map((stage) => stageLabels[stage]),
      datasets: [
        {
          label: 'B2B',
          data: b2bStageCounts,
          backgroundColor: 'rgba(24, 200, 223, 0.75)',
          borderRadius: 8
        },
        {
          label: 'B2G',
          data: b2gOppStageCounts,
          backgroundColor: 'rgba(129, 140, 248, 0.75)',
          borderRadius: 8
        }
      ]
    };

    const leadTemperature = {
      labels: ['Hot', 'Warm', 'Cold', 'Baixa'],
      datasets: [
        {
          label: 'B2B',
          data: [
            toNumber(leadStatsB2B.hotLeads),
            toNumber(leadStatsB2B.warmLeads),
            toNumber(leadStatsB2B.coldLeads),
            toNumber(leadStatsB2B.lowPriority)
          ],
          backgroundColor: 'rgba(34, 197, 94, 0.72)',
          borderRadius: 8
        },
        {
          label: 'B2G',
          data: [
            toNumber(leadStatsB2G.hotLeads),
            toNumber(leadStatsB2G.warmLeads),
            toNumber(leadStatsB2G.coldLeads),
            toNumber(leadStatsB2G.lowPriority)
          ],
          backgroundColor: 'rgba(99, 102, 241, 0.72)',
          borderRadius: 8
        }
      ]
    };

    const operationalLoadValues = [
      pendingActivities.length,
      overdueActivities.length,
      pendingPreSales.length + activePreSalesPocs.length,
      inAnalysisB2G.length,
      monthlyActivities.reduce((sum, value) => sum + value, 0) + blockedPreSalesPocs.length
    ];
    const hasOperationalData = operationalLoadValues.some((value) => value > 0);
    const operationalLoad = {
      labels: ['Pendentes', 'Atrasadas', 'Pré-vendas/POCs', 'B2G análise', 'Atividades + bloqueios'],
      datasets: [
        {
          data: hasOperationalData ? operationalLoadValues : [1, 0, 0, 0, 0],
          backgroundColor: ['#18c8df', '#f43f5e', '#f59e0b', '#818cf8', '#34d399'],
          borderWidth: 0
        }
      ]
    };

    const hasTeamData = teamPerformance.some((item) => item.total > 0 || item.pipeline > 0);
    const teamLoad = {
      labels: teamPerformance.map((item) => item.name),
      datasets: [
        {
          label: 'Oportunidades',
          data: teamPerformance.map((item) => item.total),
          backgroundColor: 'rgba(24, 200, 223, 0.7)',
          borderRadius: 8
        },
        {
          label: 'Ganhas',
          data: teamPerformance.map((item) => item.won),
          backgroundColor: 'rgba(52, 211, 153, 0.7)',
          borderRadius: 8
        }
      ]
    };

    const pipelineComposition = {
      labels: ['B2B', 'B2G editais', 'B2G oportunidades'],
      datasets: [
        {
          data: [
            b2bPipelineValue,
            activeB2GNotices.reduce((sum, item) => sum + toNumber(item.estimatedValue), 0),
            opportunitiesB2GRange
              .filter((item) => OPEN_STAGES.has(String(item.stage || '').toUpperCase()))
              .reduce((sum, item) => sum + revenueBreakdownFromOpportunities([item]).total, 0)
          ],
          backgroundColor: ['#22d3ee', '#8b5cf6', '#18c8df'],
          borderWidth: 0
        }
      ]
    };

    if (pipelineComposition.datasets[0].data.every((value) => value <= 0)) {
      pipelineComposition.datasets[0].data = [1, 0, 0];
    }

    const moduleVolume = {
      labels: moduleVolumeRows.map((item) => item.label),
      datasets: [
        {
          label: 'Registros',
          data: moduleVolumeRows.map((item) => item.count),
          backgroundColor: 'rgba(24, 200, 223, 0.7)',
          borderRadius: 8
        }
      ]
    };

    const revenueMix = {
      labels: ['B2B', 'B2G', 'Consolidado'],
      datasets: [
        {
          label: 'Mensal',
          data: [b2bRevenue.monthly, b2gRevenue.monthly, consolidatedRevenue.monthly],
          backgroundColor: 'rgba(45, 212, 191, 0.78)',
          borderColor: 'rgba(153, 246, 228, 0.95)',
          borderWidth: 1,
          borderRadius: 10
        },
        {
          label: 'Total contrato',
          data: [b2bRevenue.contract, b2gRevenue.contract, consolidatedRevenue.contract],
          backgroundColor: 'rgba(59, 130, 246, 0.78)',
          borderColor: 'rgba(147, 197, 253, 0.95)',
          borderWidth: 1,
          borderRadius: 10
        },
        {
          label: 'Pontual',
          data: [b2bRevenue.single, b2gRevenue.single, consolidatedRevenue.single],
          backgroundColor: 'rgba(168, 85, 247, 0.78)',
          borderColor: 'rgba(216, 180, 254, 0.95)',
          borderWidth: 1,
          borderRadius: 10
        }
      ]
    };

    const monthlyRevenueSplit = {
      labels: buckets.map((item) => item.label),
      datasets: [
        {
          label: 'B2B mensal',
          data: monthlyB2B.recurring,
          borderColor: '#2dd4bf',
          backgroundColor: 'rgba(45, 212, 191, 0.16)',
          tension: 0.38,
          fill: true,
          borderWidth: 2
        },
        {
          label: 'B2B contrato',
          data: monthlyB2B.contract,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.12)',
          tension: 0.38,
          fill: true,
          borderWidth: 2
        },
        {
          label: 'B2G pontual',
          data: monthlyB2G.single,
          borderColor: '#c084fc',
          backgroundColor: 'rgba(192, 132, 252, 0.12)',
          tension: 0.38,
          fill: true,
          borderWidth: 2
        }
      ]
    };

    return {
      monthlyTrend,
      monthlyRevenueSplit,
      revenueMix,
      stageDistribution,
      leadTemperature,
      operationalLoad,
      teamLoad,
      hasTeamData,
      moduleVolume,
      hasModuleVolumeData: moduleVolumeRows.some((item) => item.count > 0),
      pipelineComposition,
      hasOperationalData,
      hasPipelineData: totalPipeline > 0
    };
  }, [computed, moduleHealth]);

  const handlePresentation = async () => {
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
    const sync = () => setPresentationMode(document.fullscreenElement === presentationRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const getPresentationSteps = () =>
    Array.from(presentationRef.current?.children || []).filter(
      (element) =>
        element instanceof HTMLElement &&
        element.dataset.presentationControls !== 'true' &&
        element.offsetHeight > 40
    );

  const resolveCurrentStepIndex = (steps, container) => {
    const anchor = container.scrollTop + container.clientHeight * 0.24;
    const idx = steps.findIndex((step) => step.offsetTop <= anchor && step.offsetTop + step.offsetHeight > anchor);
    return idx !== -1 ? idx : 0;
  };

  const scrollPresentationStep = (direction) => {
    const container = presentationRef.current;
    if (!container) return;
    const steps = getPresentationSteps();
    if (!steps.length) {
      container.scrollBy({ top: direction * container.clientHeight * 0.85, behavior: 'smooth' });
      return;
    }
    const current = resolveCurrentStepIndex(steps, container);
    const next = Math.min(Math.max(current + direction, 0), steps.length - 1);
    container.scrollTo({ top: Math.max(steps[next].offsetTop - 12, 0), behavior: 'smooth' });
  };

  useEffect(() => {
    if (!presentationMode) return undefined;
    const container = presentationRef.current;
    if (!container) return undefined;

    const sync = () => {
      const steps = getPresentationSteps();
      if (!steps.length) return;
      const current = resolveCurrentStepIndex(steps, container);
      setPresentationProgress({ current: current + 1, total: steps.length });
    };

    container.addEventListener('scroll', sync, { passive: true });
    requestAnimationFrame(sync);
    return () => container.removeEventListener('scroll', sync);
  }, [presentationMode]);

  const initialLoading = loading && !updatedAt;
  if (initialLoading) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="crm-panel flex items-center gap-3 px-6 py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)] border-t-transparent" />
          <span className="text-sm font-semibold text-[var(--crm-muted)]">Carregando dados consolidados...</span>
        </div>
      </div>
    );
  }

  const {
    opportunitiesB2BRange,
    opportunitiesB2GRange,
    companiesB2B,
    companiesB2G,
    b2gNoticesRange,
    preSalesRange,
    preSalesPocsRange,
    activitiesRange,
    proposalsRange,
    contractsRange,
    commissions,
    salesTargets,
    workflows,
    automationRules,
    automationNotifications,
    integrations,
    regions,
    pendingActivities,
    overdueActivities,
    activeProducts,
    activeB2GNotices,
    inAnalysisB2G,
    pendingPreSales,
    donePreSales,
    activePreSalesPocs,
    approvedPreSalesPocs,
    blockedPreSalesPocs,
    overduePreSalesPocs,
    b2bRevenue,
    b2bStageBreakdown,
    b2gRevenue,
    b2gStageBreakdown,
    consolidatedRevenue,
    b2bWonRevenue,
    b2gWonRevenue,
    totalPipeline,
    totalWonValue,
    b2bPipelineValue,
    b2bWonValue,
    b2bConversion,
    b2gConversion,
    preSalesApproval,
    hotLeads,
    warmLeads,
    teamPerformance,
    expiringOportunidades,
    expiredOportunidades,
    expiring7,
    expiring15,
    expiring30
  } = computed;

  const alertCount = overdueActivities.length + pendingPreSales.length + blockedPreSalesPocs.length + overduePreSalesPocs.length + inAnalysisB2G.length + expiringOportunidades.length + expiredOportunidades.length;

  const moduleCardItems = [
    access.accessB2B && {
      id: 'b2b',
      title: 'B2B Privado',
      subtitle: 'Funil comercial corporativo',
      icon: Building2,
      color: 'blue',
      route: '/dashboard',
      badge: `${opportunitiesB2BRange.length} oport.`,
      kpis: [
        { label: 'Oportunidades', value: formatNumber(opportunitiesB2BRange.length) },
        { label: 'Empresas', value: formatNumber(companiesB2B.length) },
        { label: 'Pipeline', value: formatCurrency(b2bPipelineValue) },
        { label: 'Ganhos', value: formatCurrency(b2bWonValue) },
        { label: 'Conversão', value: formatPercent(b2bConversion) },
        { label: 'Leads quentes', value: formatNumber(hotLeads) }
      ]
    },
    access.accessB2G && {
      id: 'b2g',
      title: 'B2G Governo',
      subtitle: 'Editais, análise e execução',
      icon: Gavel,
      color: 'indigo',
      route: '/b2g-dashboard',
      badge: `${activeB2GNotices.length} ativos`,
      kpis: [
        { label: 'Oportunidades', value: formatNumber(opportunitiesB2GRange.length) },
        { label: 'Órgãos', value: formatNumber(companiesB2G.length) },
        { label: 'Pipeline', value: formatCurrency(b2gRevenue.total) },
        { label: 'Editais', value: formatNumber(b2gNoticesRange.length) },
        { label: 'Em análise', value: formatNumber(inAnalysisB2G.length) },
        { label: 'Taxa', value: formatPercent(b2gConversion) }
      ]
    },
    (access.accessPreSales || adminLike) && {
      id: 'presales',
      title: 'Pré-Vendas',
      subtitle: 'Precificação e suporte técnico',
      icon: Calculator,
      color: 'sky',
      route: '/pre-vendas',
      badge: `${pendingPreSales.length} pendentes`,
      kpis: [
        { label: 'Solicitações', value: formatNumber(preSalesRange.length) },
        { label: 'POCs', value: formatNumber(preSalesPocsRange.length) },
        { label: 'Aprovadas', value: formatNumber(approvedPreSalesPocs.length) }
      ]
    }
  ].filter(Boolean);

  return (
    <div
      ref={presentationRef}
      onScroll={() => {
        if (!presentationMode) return;
        const steps = getPresentationSteps();
        const current = resolveCurrentStepIndex(steps, presentationRef.current);
        setPresentationProgress({ current: current + 1, total: steps.length });
      }}
      className={`h-full space-y-6 overflow-y-auto p-6 ${presentationMode ? 'bg-[var(--crm-bg)] px-8 py-6' : ''}`}
    >
      {presentationMode && (
        <PresentationControls
          onPrev={() => scrollPresentationStep(-1)}
          onNext={() => scrollPresentationStep(1)}
          onExit={handlePresentation}
          current={presentationProgress.current}
          total={presentationProgress.total}
        />
      )}

      <div
        data-section="header"
        className="relative overflow-hidden rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-4 text-[#f4f7fb] shadow-[0_24px_60px_-44px_rgba(0,0,0,0.95)]"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_86%_18%,rgba(102,215,234,0.16),transparent_28%)]" />
        <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black leading-tight text-[#f4f7fb] md:text-2xl">Dashboard Geral</h1>
              <span className="rounded-full border border-[#374151] bg-[#1b2433]/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#18c8df]">
                Visão executiva
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm font-medium leading-snug text-[#a9c5df]">
              Consolidação B2B, B2G, Pré-Vendas, Atividades, Produtos, Equipe e Integrações.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-[#8f9caf]">
              <span className="rounded-full border border-[#374151] bg-[#0d1423]/75 px-2.5 py-1">
                Atualizado: {updatedAt ? updatedAt.toLocaleString('pt-BR') : '-'}
              </span>
              <span className="rounded-full border border-[#374151] bg-[#0d1423]/75 px-2.5 py-1">
                {moduleCardItems.length} módulos ativos
              </span>
              <span className={[
                'rounded-full border px-2.5 py-1',
                alertCount > 0
                  ? 'border-rose-300/35 bg-rose-500/12 text-rose-100'
                  : 'border-emerald-300/35 bg-emerald-500/12 text-emerald-100'
              ].join(' ')}>
                {alertCount} alertas
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center xl:justify-end">
            <div className="inline-flex rounded-2xl border border-[#374151] bg-[#050914]/78 p-1 shadow-[inset_0_0_22px_rgba(143,209,255,0.08)]">
              {[
                { value: '30', label: '30d' },
                { value: '90', label: '90d' },
                { value: '180', label: '180d' }
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTimeRange(option.value)}
                  className={[
                    'min-w-[4.8rem] rounded-xl px-3 py-2 text-xs font-black transition-all',
                    timeRange === option.value
                      ? 'bg-[#ff7a00] text-white shadow-[0_12px_28px_-18px_rgba(61,202,255,0.95)]'
                      : 'text-[#8f9caf] hover:bg-[#111827] hover:text-[#f4f7fb]'
                  ].join(' ')}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={loadData}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#374151] bg-[#0d1423]/80 px-3.5 py-2 text-xs font-bold text-[#bcd4ee] transition hover:border-[#18c8df80] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
              </button>
              <button
                onClick={handlePresentation}
                className="inline-flex items-center gap-2 rounded-2xl border border-[#374151] bg-[#0d1423]/80 px-3.5 py-2 text-xs font-bold text-[#bcd4ee] transition hover:border-[#18c8df80] hover:text-white"
              >
                <Maximize2 className="h-4 w-4" /> Apresentar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div data-section="receita-arquitetura">
        <RevenueOverview
          b2bRevenue={b2bRevenue}
          b2bStageBreakdown={b2bStageBreakdown}
          b2gRevenue={b2gRevenue}
          b2gStageBreakdown={b2gStageBreakdown}
          consolidatedRevenue={consolidatedRevenue}
        />
      </div>

      <div data-section="sinais-executivos" className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ExecutiveSparkCard
          title="Receita"
          label="Potencial"
          value={formatCompactCurrency(totalPipeline)}
          data={chartData.monthlyTrend.datasets?.[0]?.data || []}
          color="#ff7a00"
        />
        <ExecutiveSparkCard
          title="Conversões"
          label="Realizado"
          value={formatCompactCurrency(totalWonValue)}
          data={chartData.monthlyTrend.datasets?.[1]?.data || []}
          color="#22c55e"
        />
        <ExecutiveSparkCard
          title="Carga Operacional"
          label="Alertas e filas"
          value={formatNumber(alertCount)}
          data={chartData.operationalLoad.datasets?.[0]?.data || []}
          color="#f6b40b"
        />
      </div>

      <div data-section="extras" className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">Propostas</p>
          <p className="mt-1 text-lg font-bold text-[var(--crm-ink)]">{formatNumber(proposalsRange.length)}</p>
        </div>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">Contratos</p>
          <p className="mt-1 text-lg font-bold text-[var(--crm-ink)]">{formatNumber(contractsRange.length)}</p>
        </div>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">Comissões</p>
          <p className="mt-1 text-lg font-bold text-[var(--crm-ink)]">{formatNumber(commissions.length)}</p>
        </div>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">Metas</p>
          <p className="mt-1 text-lg font-bold text-[var(--crm-ink)]">{formatNumber(salesTargets.length)}</p>
        </div>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">Workflows</p>
          <p className="mt-1 text-lg font-bold text-[var(--crm-ink)]">{formatNumber(workflows.length)}</p>
        </div>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">Regras Auto</p>
          <p className="mt-1 text-lg font-bold text-[var(--crm-ink)]">{formatNumber(automationRules.length)}</p>
        </div>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">Notificações</p>
          <p className="mt-1 text-lg font-bold text-[var(--crm-ink)]">{formatNumber(automationNotifications.length)}</p>
        </div>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3">
          <p className="text-[10px] uppercase tracking-wide text-[var(--crm-muted)]">Módulos OK</p>
          <p className="mt-1 text-lg font-bold text-emerald-300">{formatNumber(modulesLoaded)}</p>
        </div>
      </div>

      <div data-section="modulos" className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {moduleCardItems.map((module) => (
          <ModuleCard
            key={module.id}
            title={module.title}
            subtitle={module.subtitle}
            icon={module.icon}
            color={module.color}
            kpis={module.kpis}
            route={module.route}
            navigate={navigate}
            badge={module.badge}
          />
        ))}
      </div>

      <div data-section="receita-graficos" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Mix de Receita B2B x B2G</h3>
              <p className="text-xs text-[#8f9caf]">Mensal, total do período do contrato e receita pontual</p>
            </div>
            <span className="metric-chip rounded-full bg-cyan-400/15 px-2 py-1 text-xs font-semibold text-cyan-200">{formatCurrency(consolidatedRevenue.total)}</span>
          </div>
          <div className="h-[280px]">
            <DashboardAdvancedChart type="bar" colorTheme="warm" data={chartData.revenueMix} />
          </div>
        </div>

        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Receita Mensal por Modelo</h3>
              <p className="text-xs text-[#8f9caf]">Separação temporal entre mensal, contrato e pontual</p>
            </div>
            <span className="metric-chip rounded-full bg-emerald-400/15 px-2 py-1 text-xs font-semibold text-emerald-200">{formatCurrency(consolidatedRevenue.monthly)}/mês</span>
          </div>
          <div className="h-[280px]">
            <DashboardAdvancedChart type="line" colorTheme="blue" data={chartData.monthlyRevenueSplit} />
          </div>
        </div>
      </div>

      <div data-section="charts-row-1" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Tendência Mensal de Receita</h3>
              <p className="text-xs text-[#8f9caf]">Potencial x realizado nos últimos 6 meses</p>
            </div>
            <span className="metric-chip rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-300">{formatCurrency(totalWonValue)}</span>
          </div>
          <div className="h-[280px]">
            <DashboardAdvancedChart type="line" colorTheme="blue" data={chartData.monthlyTrend} />
          </div>
        </div>

        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Distribuição por Estágio</h3>
              <p className="text-xs text-[#8f9caf]">Volume de oportunidades por etapa do funil</p>
            </div>
          </div>
          <div className="h-[280px]">
            <DashboardAdvancedChart type="bar" colorTheme="blue" data={chartData.stageDistribution} />
          </div>
        </div>
      </div>

      <div data-section="charts-row-2" className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Temperatura dos Leads</h3>
              <p className="text-xs text-[#8f9caf]">Classificação por score (B2B e B2G)</p>
            </div>
          </div>
          <div className="h-[280px]">
            <DashboardAdvancedChart type="bar" colorTheme="warm" data={chartData.leadTemperature} />
          </div>
        </div>

        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Carga Operacional</h3>
              <p className="text-xs text-[#8f9caf]">Fila de demandas em execução</p>
            </div>
          </div>
          <div className="h-[280px]">
            <DashboardAdvancedChart type="doughnut" colorTheme="multi" data={chartData.operationalLoad} />
          </div>
        </div>

        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Composição do Pipeline</h3>
              <p className="text-xs text-[#8f9caf]">Participação entre B2B e B2G</p>
            </div>
          </div>
          <div className="h-[280px]">
            <DashboardAdvancedChart type="doughnut" colorTheme="success" data={chartData.pipelineComposition} />
          </div>
        </div>
      </div>

      <div data-section="charts-row-3" className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Performance da Equipe</h3>
              <p className="text-xs text-[#8f9caf]">Top responsáveis por volume de oportunidades</p>
            </div>
          </div>
          {chartData.hasTeamData ? (
            <div className="h-[280px]">
              <DashboardAdvancedChart type="bar" colorTheme="cool" data={chartData.teamLoad} />
            </div>
          ) : (
            <div className="grid h-[280px] place-items-center rounded-xl border border-dashed border-[#263345]">
              <p className="text-sm text-[#8f9caf]">Sem dados de equipe no período selecionado.</p>
            </div>
          )}
        </div>

        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-[#f4f7fb]">Volume por Módulo</h3>
              <p className="text-xs text-[#8f9caf]">Top módulos por quantidade de registros carregados</p>
            </div>
          </div>
          {chartData.hasModuleVolumeData ? (
            <div className="h-[280px]">
              <DashboardAdvancedChart type="bar" colorTheme="blue" data={chartData.moduleVolume} />
            </div>
          ) : (
            <div className="grid h-[280px] place-items-center rounded-xl border border-dashed border-[#263345]">
              <p className="text-sm text-[#8f9caf]">Sem volume suficiente para comparação.</p>
            </div>
          )}
        </div>

        <div className="dashboard-card rounded-2xl border border-[#263345] bg-[linear-gradient(140deg,rgba(17,24,39,0.97),rgba(13,20,35,0.98))] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[#f4f7fb]">Cobertura de Módulos</h3>
            <span className="metric-chip rounded-full bg-[#18c8df]/20 px-2.5 py-1 text-xs font-semibold text-[#18c8df]">
              {modulesLoaded}/{modulesEnabled} carregados
            </span>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-[#263345] bg-[rgba(24,200,223,0.06)] p-2">
              <p className="text-lg font-bold text-emerald-300">{modulesLoaded}</p>
              <p className="text-[10px] uppercase tracking-wide text-[#8f9caf]">OK</p>
            </div>
            <div className="rounded-xl border border-[#263345] bg-[rgba(24,200,223,0.06)] p-2">
              <p className="text-lg font-bold text-rose-300">{modulesWithError}</p>
              <p className="text-[10px] uppercase tracking-wide text-[#8f9caf]">Falhas</p>
            </div>
            <div className="rounded-xl border border-[#263345] bg-[rgba(24,200,223,0.06)] p-2">
              <p className="text-lg font-bold text-blue-300">{moduleHealth.filter((item) => item.status === 'skipped').length}</p>
              <p className="text-[10px] uppercase tracking-wide text-[#8f9caf]">Ignorados</p>
            </div>
          </div>

          <div className="max-h-[220px] space-y-2 overflow-y-auto pr-1">
            {moduleHealth.map((item) => (
              <div
                key={item.key}
                className="flex items-start justify-between gap-3 rounded-xl border border-[#263345] bg-[rgba(24,200,223,0.04)] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#f4f7fb]">{item.label}</p>
                  {item.status === 'error' ? (
                    <p className="truncate text-xs text-rose-300">{item.error}</p>
                  ) : (
                    <p className="text-xs text-[#8f9caf]">{formatNumber(item.count)} registros</p>
                  )}
                </div>
                <span
                  className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    item.status === 'ok'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : item.status === 'error'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'bg-slate-500/20 text-slate-300'
                  ].join(' ')}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div data-section="bottom" className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--crm-ink)]">Atividades Recentes</h3>
            <button onClick={() => navigate('/atividades')} className="text-xs text-[var(--crm-accent)] hover:underline">
              Ver todas
            </button>
          </div>
          {activitiesRange.slice(0, 8).length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--crm-muted)]">Nenhuma atividade encontrada no período.</p>
          ) : (
            activitiesRange.slice(0, 8).map((item) => (
              <ActivityItem
                key={item.id}
                icon={item.type === 'CALL' ? Phone : item.type === 'MEETING' ? Users : FileText}
                color={String(item.status || '').toUpperCase() === 'COMPLETED' ? 'green' : String(item.status || '').toUpperCase() === 'IN_PROGRESS' ? 'blue' : 'amber'}
                title={item.subject || 'Atividade'}
                sub={item.company?.name || item.opportunity?.title || item.type || 'Sem contexto'}
                time={item.dueDate ? new Date(item.dueDate).toLocaleDateString('pt-BR') : '-'}
              />
            ))
          )}
        </div>

        <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-[var(--crm-ink)]">Alertas e Ações Rápidas</h3>
            <span className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-300">
              {formatNumber(alertCount)} itens
            </span>
          </div>

          <div className="space-y-3">
            {overdueActivities.length > 0 && (
              <div
                onClick={() => navigate('/atividades')}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 transition-colors hover:bg-rose-500/15"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div>
                  <p className="text-sm font-medium text-rose-200">{formatNumber(overdueActivities.length)} atividade(s) atrasada(s)</p>
                  <p className="text-xs text-rose-300/80">Priorizar tratativa da agenda operacional.</p>
                </div>
              </div>
            )}

            {pendingPreSales.length > 0 && (
              <div
                onClick={() => navigate('/pre-vendas')}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 transition-colors hover:bg-amber-500/15"
              >
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <p className="text-sm font-medium text-amber-200">{formatNumber(pendingPreSales.length)} solicitação(ões) de pré-vendas pendente(s)</p>
                  <p className="text-xs text-amber-300/80">Aguardando precificação ou aprovação técnica.</p>
                </div>
              </div>
            )}

            {inAnalysisB2G.length > 0 && (
              <div
                onClick={() => navigate('/b2g-dashboard')}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3 transition-colors hover:bg-indigo-500/15"
              >
                <Brain className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
                <div>
                  <p className="text-sm font-medium text-indigo-200">{formatNumber(inAnalysisB2G.length)} edital(is) em análise</p>
                  <p className="text-xs text-indigo-300/80">Pendência de decisão GO / NO-GO.</p>
                </div>
              </div>
            )}

            {(blockedPreSalesPocs.length > 0 || overduePreSalesPocs.length > 0) && (
              <div
                onClick={() => navigate('/gestao-pocs')}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 transition-colors hover:bg-rose-500/15"
              >
                <Beaker className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div>
                  {blockedPreSalesPocs.length > 0 && (
                    <p className="text-sm font-medium text-rose-200">{formatNumber(blockedPreSalesPocs.length)} POC(s) bloqueada(s)</p>
                  )}
                  {overduePreSalesPocs.length > 0 && (
                    <p className="text-xs text-rose-300/80">{formatNumber(overduePreSalesPocs.length)} POC(s) atrasada(s) no período</p>
                  )}
                </div>
              </div>
            )}

            {(expiredOportunidades.length > 0 || expiringOportunidades.length > 0) && (
              <div
                onClick={() => navigate('/pre-vendas')}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 transition-colors hover:bg-rose-500/15"
              >
                <Package className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
                <div>
                  {expiredOportunidades.length > 0 && (
                    <p className="text-sm font-medium text-rose-200">{formatNumber(expiredOportunidades.length)} oportunidade(s) de pré-vendas vencida(s)</p>
                  )}
                  {expiring7.length > 0 && (
                    <p className="text-xs text-rose-300/80">{formatNumber(expiring7.length)} oportunidade(s) vence(m) em até 7 dias</p>
                  )}
                  {expiring15.length > 0 && (
                    <p className="text-xs text-amber-300/80">{formatNumber(expiring15.length)} oportunidade(s) vence(m) em até 15 dias</p>
                  )}
                  {expiring30.length > 0 && (
                    <p className="text-xs text-yellow-300/80">{formatNumber(expiring30.length)} oportunidade(s) vence(m) em até 30 dias</p>
                  )}
                </div>
              </div>
            )}

            {alertCount === 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                <p className="text-sm text-emerald-200">Tudo em dia no período selecionado.</p>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-[var(--crm-border)] pt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--crm-muted)]">Atalhos estratégicos</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Nova Oportunidade', icon: Target, route: '/oportunidades', color: 'text-blue-400' },
                { label: 'Novo Edital', icon: Gavel, route: '/b2g-dashboard', color: 'text-indigo-400' },
                (access.accessPreSales || adminLike) && { label: 'Nova Solicitação', icon: ClipboardList, route: '/pre-vendas', color: 'text-amber-400' },
                (access.accessPreSales || adminLike) && { label: 'Gestão de POCs', icon: Beaker, route: '/gestao-pocs', color: 'text-sky-400' },
                { label: 'Nova Atividade', icon: Zap, route: '/atividades', color: 'text-emerald-400' },
                { label: 'Leads', icon: Layers, route: '/leads', color: 'text-cyan-400' },
                adminLike && { label: 'Integrações', icon: UserCircle2, route: '/integracoes', color: 'text-purple-400' }
              ].filter(Boolean).map((item) => (
                <button
                  key={item.label}
                  onClick={() => navigate(item.route)}
                  className="flex items-center gap-2 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-bg)] px-3 py-2.5 text-xs font-medium text-[var(--crm-muted)] transition-all hover:border-[var(--crm-accent)] hover:text-[var(--crm-ink)]"
                >
                  <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
