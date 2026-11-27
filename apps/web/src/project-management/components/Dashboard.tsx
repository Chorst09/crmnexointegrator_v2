import { buildProjectEntrySeries } from '../dashboardMetrics.mjs';
import ExecutiveStatCard from '../../components/ExecutiveStatCard';
import { Bar3DShape, Pie3DShape } from '../../components/charts/Chart3DShapes';
import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, Briefcase, CheckCircle2, Clock3, Filter, Flag,
  Layers3, Plus, Target, TrendingUp, Zap
} from 'lucide-react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { Issue, IssueStatus, Space } from '../types';

type StatusFilter = 'TODOS' | IssueStatus;

interface DashboardProps {
  projects?: Space[];
  issues?: Issue[];
  activeProjectId?: string;
  onProjectChange?: (projectId: string) => void;
  onBack?: () => void;
  onCreateProject?: () => void;
}

const STATUS_OPTIONS: StatusFilter[] = [
  'TODOS',
  'PENDENTE',
  'PLANEJAMENTO',
  'EM PROGRESSO',
  'EM RISCO',
  'ATUALIZAÇÃO NECESSÁRIA',
  'EM ESPERA',
  'CONCLUÍDO',
  'CANCELADO'
];

const STATUS_COLORS: Record<IssueStatus, string> = {
  PENDENTE: '#94a3b8',
  PLANEJAMENTO: '#f6b40b',
  'EM PROGRESSO': '#18c8df',
  'EM RISCO': '#ff7a00',
  'ATUALIZAÇÃO NECESSÁRIA': '#f59e0b',
  'EM ESPERA': '#64748b',
  CONCLUÍDO: '#22c55e',
  CANCELADO: '#ef4444'
};

const fallbackProject: Space = {
  id: 'all',
  name: 'Todos os projetos',
  initial: 'P',
  color: 'bg-[#2563eb]',
  status: 'PLANEJADO',
  objective: 'Acompanhar projetos, fases, riscos e entregas em uma visão executiva.',
  scope: 'Painel consolidado para leitura rápida do portfólio.'
};

const emptyIssues: Issue[] = [];
const emptyProjects: Space[] = [fallbackProject];

export default function Dashboard({
  projects = emptyProjects,
  issues = emptyIssues,
  activeProjectId,
  onProjectChange,
  onBack,
  onCreateProject
}: DashboardProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('TODOS');
  const [scopeMode, setScopeMode] = useState<'all' | 'selected'>('all');

  const selectedProject = useMemo(() => {
    if (scopeMode === 'all') return fallbackProject;
    return projects.find(project => project.id === activeProjectId) || projects[0] || fallbackProject;
  }, [activeProjectId, projects, scopeMode]);

  const projectIssues = useMemo(() => {
    if (!selectedProject || selectedProject.id === 'all') return issues;

    return issues.filter(issue => issue.projectId === selectedProject.id);
  }, [issues, projects, selectedProject]);

  const filteredIssues = useMemo(() => {
    if (statusFilter === 'TODOS') return projectIssues;
    return projectIssues.filter(issue => issue.status === statusFilter);
  }, [projectIssues, statusFilter]);

  const statusRows = useMemo(() => {
    return STATUS_OPTIONS
      .filter((status): status is IssueStatus => status !== 'TODOS')
      .map(status => {
        const total = filteredIssues.filter(issue => issue.status === status).length;
        return {
          status,
          total,
          percent: filteredIssues.length ? Math.round((total / filteredIssues.length) * 100) : 0,
          color: STATUS_COLORS[status]
        };
      });
  }, [filteredIssues]);

  const doneCount = filteredIssues.filter(issue => issue.status === 'CONCLUÍDO').length;
  const riskCount = filteredIssues.filter(issue => ['EM RISCO', 'ATUALIZAÇÃO NECESSÁRIA'].includes(issue.status)).length;
  const activeCount = filteredIssues.filter(issue => ['PLANEJAMENTO', 'EM PROGRESSO', 'EM ESPERA'].includes(issue.status)).length;
  const completionRate = filteredIssues.length ? Math.round((doneCount / filteredIssues.length) * 100) : 0;

  const trendData = useMemo(() => buildProjectEntrySeries(filteredIssues), [filteredIssues]);

  const priorityRows = useMemo(() => {
    return ['Urgente', 'Alta', 'Normal', 'Baixa'].map(priority => ({
      priority,
      fases: filteredIssues.filter(issue => issue.priority === priority).length
    }));
  }, [filteredIssues]);

  const distributionRows = statusRows.filter(row => row.total > 0);

  return (
    <section className="h-full overflow-y-auto bg-[radial-gradient(circle_at_12%_0%,rgba(37,99,235,0.2),transparent_24%),radial-gradient(circle_at_88%_8%,rgba(34,197,94,0.16),transparent_28%),linear-gradient(135deg,rgb(var(--crm-surface-2-rgb)_/_1),rgb(var(--crm-surface-2-rgb)_/_1)_42%,rgb(var(--crm-surface-2-rgb)_/_1))] px-5 py-5 text-[var(--crm-ink)] lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.86)] p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-xs font-bold text-[var(--crm-ink)] transition hover:border-[#2563eb] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                )}
                <span className="rounded-full border border-[#2563eb]/45 bg-[#2563eb]/12 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[var(--pm-accent-text)]">
                  Painel executivo
                </span>
                <span className="rounded-full border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#5ee2a0]">
                  {completionRate}% concluido
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[rgb(var(--crm-ink-rgb)_/_1)] lg:text-4xl">Painel de Projetos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--crm-ink)]">
                Controle status, fases, riscos e entregas por projeto com leitura executiva e filtros diretos.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[520px]">
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--crm-muted)]">
                  <Briefcase className="h-3.5 w-3.5 text-[#2563eb]" />
                  Projeto
                </span>
                <select
                  value={scopeMode === 'all' ? 'all' : selectedProject.id}
                  onChange={(event) => {
                    const v = event.target.value;
                    if (v === 'all') {
                      setScopeMode('all');
                    } else {
                      setScopeMode('selected');
                      onProjectChange?.(v);
                    }
                  }}
                  className="h-11 rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.95)] px-3 text-sm font-semibold text-[var(--crm-ink)] outline-none transition focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/20"
                >
                  <option value="all">Todos os projetos ({projects.length} — Portfólio Consolidado)</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--crm-muted)]">
                  <Filter className="h-3.5 w-3.5 text-[#22c55e]" />
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="h-11 rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.95)] px-3 text-sm font-semibold text-[var(--crm-ink)] outline-none transition focus:border-[#22c55e] focus:ring-2 focus:ring-[#22c55e]/20"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.1fr_1fr_.9fr]">
            <InfoPanel title="Escopo" value={selectedProject.scope || 'Visão consolidada de todo o portfólio de projetos, fases, riscos e prazos.'} accent="orange" />
            <InfoPanel title="Objetivo" value={selectedProject.objective || 'Monitorar entregas, gargalos e taxa de conclusão em tempo real.'} accent="green" />
            <div className="rounded-xl border border-cyan-500/30 bg-[linear-gradient(135deg,rgba(6,182,212,0.16),rgba(37,99,235,0.14),rgb(var(--crm-surface-rgb)/0.96))] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-wide text-cyan-300">
                  {scopeMode === 'all' ? 'Portfólio Consolidado' : 'Projeto Ativo'}
                </p>
                <span className="text-xs font-mono font-black text-emerald-300">{completionRate}%</span>
              </div>
              <p className="mt-1.5 truncate text-base font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">
                {scopeMode === 'all' ? `${projects.length} Projeto(s) • ${filteredIssues.length} Fases` : selectedProject.name}
              </p>
              <div className="mt-2.5 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>

          {/* Saúde por Projeto (Portfólio) */}
          {projects.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[var(--crm-border)] grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {projects.slice(0, 4).map((proj) => {
                const pIssues = issues.filter((i) => i.projectId === proj.id);
                const pDone = pIssues.filter((i) => i.status === 'CONCLUÍDO').length;
                const pRisk = pIssues.filter((i) => ['EM RISCO', 'ATUALIZAÇÃO NECESSÁRIA'].includes(i.status)).length;
                const pPct = pIssues.length ? Math.round((pDone / pIssues.length) * 100) : 0;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      setScopeMode('selected');
                      onProjectChange?.(proj.id);
                    }}
                    className="text-left rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.7)] hover:border-cyan-500/50 p-3 transition-all"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[var(--crm-ink)] truncate">{proj.name}</span>
                      <span className="text-[11px] font-mono font-bold text-emerald-400">{pPct}%</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400" style={{ width: `${pPct}%` }} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[10px] text-[var(--crm-muted)]">
                      <span>{pIssues.length} fases</span>
                      {pRisk > 0 ? <span className="text-amber-400 font-bold">{pRisk} em risco</span> : <span className="text-emerald-400">No prazo</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Layers3} label="Fases e tarefas" value={filteredIssues.length.toString()} tone="cyan" delta="Itens do filtro atual" />
          <KpiCard icon={CheckCircle2} label="Concluidas" value={doneCount.toString()} tone="green" delta={`${completionRate}%`} />
          <KpiCard icon={Flag} label="Em risco" value={riskCount.toString()} tone="orange" delta="atenção" />
          <KpiCard icon={Zap} label="Em andamento" value={activeCount.toString()} tone="yellow" delta="Situação atual" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
          <ChartPanel title="Entradas por semana" action="Últimas 6 semanas · situação atual">
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={trendData} margin={{ left: -18, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="orangeArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.04} />
                  </linearGradient>
                  <linearGradient id="greenArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#263345" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip content={<DashboardTooltip />} />
                <Area type="monotone" dataKey="planejado" stroke="#2563eb" fill="url(#orangeArea)" strokeWidth={3} />
                <Area type="monotone" dataKey="concluido" stroke="#22c55e" fill="url(#greenArea)" strokeWidth={3} />
                <Line type="monotone" dataKey="progresso" stroke="#18c8df" strokeWidth={3} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Distribuição por status" action={`${filteredIssues.length} filtradas`}>
            <ResponsiveContainer width="100%" height={310}>
              <PieChart>
                <Pie activeIndex={-1} inactiveShape={<Pie3DShape />} activeShape={<Pie3DShape />}
                  data={distributionRows.length ? distributionRows : [{ status: 'Sem fases', total: 1, color: '#374151' }]}
                  innerRadius={78}
                  outerRadius={118}
                  paddingAngle={4}
                  dataKey="total"
                  nameKey="status"
                >
                  {(distributionRows.length ? distributionRows : [{ color: "rgb(var(--crm-ink-rgb) / 1)" }]).map((row, index) => (
                    <Cell key={`cell-${index}`} fill={row.color} />
                  ))}
                </Pie>
                <Tooltip content={<DashboardTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid gap-2">
              {statusRows.slice(0, 5).map(row => (
                <button
                  key={row.status}
                  type="button"
                  onClick={() => setStatusFilter(row.status)}
                  className="grid grid-cols-[1fr_48px] items-center gap-3 rounded-md border border-[var(--crm-border)] bg-transparent px-3 py-2 text-left transition hover:border-[#2563eb]/50"
                >
                  <span className="truncate text-xs font-bold text-[var(--crm-ink)]">{row.status}</span>
                  <span className="text-right text-xs font-black" style={{ color: row.color }}>{row.total}</span>
                </button>
              ))}
            </div>
          </ChartPanel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[.95fr_1.05fr]">
          <ChartPanel title="Prioridade das fases" action="Carga atual">
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={priorityRows} margin={{ left: -18, right: 10, top: 16, bottom: 0 }}>
                <CartesianGrid stroke="#263345" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="priority" stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis allowDecimals={false} stroke="#64748b" tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip content={<DashboardTooltip />} />
                <Bar shape={<Bar3DShape />} activeBar={<Bar3DShape />} dataKey="fases" radius={[6, 6, 0, 0]}>
                  {priorityRows.map((_, index) => (
                    <Cell key={index} fill={['#ef4444', '#ff7a00', '#f6b40b', '#22c55e'][index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.86)] p-4 shadow-xl shadow-black/20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">Fases filtradas</h2>
                <p className="mt-1 text-xs text-[var(--crm-muted)]">Clique no status acima ou use o filtro para auditar o projeto.</p>
              </div>
              {onCreateProject && (
                <button
                  type="button"
                  onClick={onCreateProject}
                  className="flex items-center gap-2 rounded-md bg-[#2563eb] px-3 py-2 text-xs font-black text-[rgb(var(--crm-ink-rgb)_/_1)] transition hover:bg-[#1d4ed8] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <Plus className="h-4 w-4" />
                  Novo projeto
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-[var(--crm-border)]">
              {filteredIssues.length === 0 ? (
                <div className="flex min-h-[170px] flex-col items-center justify-center bg-transparent px-6 text-center">
                  <Target className="mb-3 h-8 w-8 text-[#2563eb]" />
                  <p className="font-bold text-[var(--crm-ink)]">Nenhuma fase encontrada</p>
                  <p className="mt-1 text-sm text-[var(--crm-muted)]">Troque o projeto ou status para ampliar a leitura.</p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--crm-border)]">
                  {filteredIssues.slice(0, 7).map(issue => (
                    <div key={issue.id} className="grid gap-3 bg-transparent px-4 py-3 transition hover:bg-[var(--crm-surface)] md:grid-cols-[1fr_150px_110px] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--crm-ink)]">{issue.title}</p>
                        <p className="mt-1 text-xs text-[var(--crm-muted)]">{issue.assignee?.name || 'Sem responsavel'} {issue.dueDate ? `· ${issue.dueDate}` : ''}</p>
                      </div>
                      <span className="w-fit rounded-full border px-2.5 py-1 text-[11px] font-black uppercase" style={{ borderColor: `${STATUS_COLORS[issue.status]}66`, color: STATUS_COLORS[issue.status], background: `${STATUS_COLORS[issue.status]}14` }}>
                        {issue.status}
                      </span>
                      <span className="text-xs font-bold text-[var(--crm-muted)]">{issue.priority}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function InfoPanel({ title, value, accent }: { title: string; value: string; accent: 'orange' | 'green' }) {
  const color = accent === 'orange' ? '#2563eb' : '#22c55e';
  return (
    <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.8)] p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">{title}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-[var(--crm-ink)]">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--crm-border)]">
        <div className="h-full w-2/3 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, #f6b40b)` }} />
      </div>
    </div>
  );
}

function KpiCard({icon,label,value,tone,delta}: {icon:any;label:string;value:string;tone:'cyan'|'green'|'orange'|'yellow';delta:string}) {return <ExecutiveStatCard title={label} value={value} icon={icon} color={tone} subtitle={delta}/>;}

function ChartPanel({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.86)] p-4 shadow-xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">{title}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs font-bold text-[#5ee2a0]">
            <TrendingUp className="h-3.5 w-3.5" />
            {action}
          </p>
        </div>
        <Clock3 className="h-5 w-5 text-[#f6b40b]" />
      </div>
      {children}
    </div>
  );
}

function DashboardTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-[var(--crm-border)] bg-transparent px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-black text-[var(--crm-ink)]">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs font-semibold" style={{ color: entry.color || entry.payload?.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}
