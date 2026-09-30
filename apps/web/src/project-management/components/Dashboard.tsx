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
  color: 'bg-[#ff7a00]',
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

  const selectedProject = useMemo(() => {
    return projects.find(project => project.id === activeProjectId) || projects[0] || fallbackProject;
  }, [activeProjectId, projects]);

  const projectIssues = useMemo(() => {
    if (!selectedProject || selectedProject.id === 'all') return issues;

    const firstProjectId = projects[0]?.id;
    return issues.filter(issue => {
      if (issue.projectId === selectedProject.id) return true;
      return !issue.projectId && selectedProject.id === firstProjectId;
    });
  }, [issues, projects, selectedProject]);

  const filteredIssues = useMemo(() => {
    if (statusFilter === 'TODOS') return projectIssues;
    return projectIssues.filter(issue => issue.status === statusFilter);
  }, [projectIssues, statusFilter]);

  const statusRows = useMemo(() => {
    return STATUS_OPTIONS
      .filter((status): status is IssueStatus => status !== 'TODOS')
      .map(status => {
        const total = projectIssues.filter(issue => issue.status === status).length;
        return {
          status,
          total,
          percent: projectIssues.length ? Math.round((total / projectIssues.length) * 100) : 0,
          color: STATUS_COLORS[status]
        };
      });
  }, [projectIssues]);

  const doneCount = projectIssues.filter(issue => issue.status === 'CONCLUÍDO').length;
  const riskCount = projectIssues.filter(issue => ['EM RISCO', 'ATUALIZAÇÃO NECESSÁRIA'].includes(issue.status)).length;
  const activeCount = projectIssues.filter(issue => ['PLANEJAMENTO', 'EM PROGRESSO', 'EM ESPERA'].includes(issue.status)).length;
  const completionRate = projectIssues.length ? Math.round((doneCount / projectIssues.length) * 100) : 0;

  const trendData = useMemo(() => {
    const total = Math.max(projectIssues.length, 3);
    return ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4', 'Sem 5', 'Sem 6'].map((label, index) => ({
      label,
      planejado: Math.max(1, Math.round(total * (0.45 + index * 0.12))),
      progresso: Math.max(0, Math.round(activeCount * (0.35 + index * 0.1))),
      concluido: Math.max(0, Math.round(doneCount * (0.25 + index * 0.16))),
      risco: Math.max(0, Math.round(riskCount * (0.3 + index * 0.08)))
    }));
  }, [activeCount, doneCount, projectIssues.length, riskCount]);

  const priorityRows = useMemo(() => {
    return ['Urgente', 'Alta', 'Normal', 'Baixa'].map(priority => ({
      priority,
      fases: projectIssues.filter(issue => issue.priority === priority).length
    }));
  }, [projectIssues]);

  const distributionRows = statusRows.filter(row => row.total > 0);

  return (
    <section className="h-full overflow-y-auto bg-[radial-gradient(circle_at_12%_0%,rgba(255,122,0,0.2),transparent_24%),radial-gradient(circle_at_88%_8%,rgba(34,197,94,0.16),transparent_28%),linear-gradient(135deg,#050914,#0b1020_42%,#111827)] px-5 py-5 text-slate-100 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="rounded-lg border border-[#263345] bg-[#0b1020]/86 p-5 shadow-2xl shadow-black/20 backdrop-blur">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-2 rounded-md border border-[#374151] bg-[#111827] px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-[#ff7a00] hover:text-white"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Voltar
                  </button>
                )}
                <span className="rounded-full border border-[#ff7a00]/45 bg-[#ff7a00]/12 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#ffb15c]">
                  Painel executivo
                </span>
                <span className="rounded-full border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#5ee2a0]">
                  {completionRate}% concluido
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white lg:text-4xl">Painel de Projetos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Controle status, fases, riscos e entregas por projeto com leitura executiva e filtros diretos.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:w-[520px]">
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8f9caf]">
                  <Briefcase className="h-3.5 w-3.5 text-[#ff7a00]" />
                  Projeto
                </span>
                <select
                  value={selectedProject.id}
                  onChange={(event) => onProjectChange?.(event.target.value)}
                  className="h-11 rounded-md border border-[#374151] bg-[#070b16] px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-[#ff7a00] focus:ring-2 focus:ring-[#ff7a00]/20"
                >
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>{project.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#8f9caf]">
                  <Filter className="h-3.5 w-3.5 text-[#22c55e]" />
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="h-11 rounded-md border border-[#374151] bg-[#070b16] px-3 text-sm font-semibold text-slate-100 outline-none transition focus:border-[#22c55e] focus:ring-2 focus:ring-[#22c55e]/20"
                >
                  {STATUS_OPTIONS.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_1fr_.8fr]">
            <InfoPanel title="Escopo" value={selectedProject.scope || 'Escopo ainda nao informado.'} accent="orange" />
            <InfoPanel title="Objetivo" value={selectedProject.objective || 'Objetivo ainda nao informado.'} accent="green" />
            <div className="rounded-lg border border-[#374151] bg-[linear-gradient(135deg,rgba(255,122,0,0.16),rgba(246,180,11,0.08),rgba(17,24,39,0.96))] p-4">
              <p className="text-[11px] font-black uppercase tracking-wide text-[#8f9caf]">Projeto ativo</p>
              <p className="mt-2 truncate text-lg font-black text-white">{selectedProject.name}</p>
              <p className="mt-1 text-xs font-bold text-[#ffb15c]">{selectedProject.status || 'PLANEJADO'}</p>
            </div>
          </div>
        </header>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard icon={Layers3} label="Fases totais" value={projectIssues.length.toString()} tone="cyan" delta="+14" />
          <KpiCard icon={CheckCircle2} label="Concluidas" value={doneCount.toString()} tone="green" delta={`${completionRate}%`} />
          <KpiCard icon={Flag} label="Em risco" value={riskCount.toString()} tone="orange" delta="atenção" />
          <KpiCard icon={Zap} label="Em andamento" value={activeCount.toString()} tone="yellow" delta="+8%" />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.35fr_.85fr]">
          <ChartPanel title="Evolução das fases" action="Últimas 6 semanas">
            <ResponsiveContainer width="100%" height={310}>
              <AreaChart data={trendData} margin={{ left: -18, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="orangeArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff7a00" stopOpacity={0.55} />
                    <stop offset="95%" stopColor="#ff7a00" stopOpacity={0.04} />
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
                <Area type="monotone" dataKey="planejado" stroke="#ff7a00" fill="url(#orangeArea)" strokeWidth={3} />
                <Area type="monotone" dataKey="concluido" stroke="#22c55e" fill="url(#greenArea)" strokeWidth={3} />
                <Line type="monotone" dataKey="progresso" stroke="#18c8df" strokeWidth={3} dot={{ r: 3 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartPanel>

          <ChartPanel title="Distribuição por status" action={`${filteredIssues.length} filtradas`}>
            <ResponsiveContainer width="100%" height={310}>
              <PieChart>
                <Pie
                  data={distributionRows.length ? distributionRows : [{ status: 'Sem fases', total: 1, color: '#374151' }]}
                  innerRadius={78}
                  outerRadius={118}
                  paddingAngle={4}
                  dataKey="total"
                  nameKey="status"
                >
                  {(distributionRows.length ? distributionRows : [{ color: '#374151' }]).map((row, index) => (
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
                  className="grid grid-cols-[1fr_48px] items-center gap-3 rounded-md border border-[#263345] bg-[#070b16]/70 px-3 py-2 text-left transition hover:border-[#ff7a00]/50"
                >
                  <span className="truncate text-xs font-bold text-slate-300">{row.status}</span>
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
                <Bar dataKey="fases" radius={[6, 6, 0, 0]}>
                  {priorityRows.map((_, index) => (
                    <Cell key={index} fill={['#ef4444', '#ff7a00', '#f6b40b', '#22c55e'][index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartPanel>

          <div className="rounded-lg border border-[#263345] bg-[#0b1020]/86 p-4 shadow-xl shadow-black/20">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">Fases filtradas</h2>
                <p className="mt-1 text-xs text-slate-400">Clique no status acima ou use o filtro para auditar o projeto.</p>
              </div>
              {onCreateProject && (
                <button
                  type="button"
                  onClick={onCreateProject}
                  className="flex items-center gap-2 rounded-md bg-[#ff7a00] px-3 py-2 text-xs font-black text-white transition hover:bg-[#f6b40b] hover:text-[#050914]"
                >
                  <Plus className="h-4 w-4" />
                  Novo projeto
                </button>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-[#263345]">
              {filteredIssues.length === 0 ? (
                <div className="flex min-h-[170px] flex-col items-center justify-center bg-[#070b16]/70 px-6 text-center">
                  <Target className="mb-3 h-8 w-8 text-[#ff7a00]" />
                  <p className="font-bold text-slate-100">Nenhuma fase encontrada</p>
                  <p className="mt-1 text-sm text-slate-500">Troque o projeto ou status para ampliar a leitura.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#263345]">
                  {filteredIssues.slice(0, 7).map(issue => (
                    <div key={issue.id} className="grid gap-3 bg-[#070b16]/70 px-4 py-3 transition hover:bg-[#111827] md:grid-cols-[1fr_150px_110px] md:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-100">{issue.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{issue.assignee?.name || 'Sem responsavel'} {issue.dueDate ? `· ${issue.dueDate}` : ''}</p>
                      </div>
                      <span className="w-fit rounded-full border px-2.5 py-1 text-[11px] font-black uppercase" style={{ borderColor: `${STATUS_COLORS[issue.status]}66`, color: STATUS_COLORS[issue.status], background: `${STATUS_COLORS[issue.status]}14` }}>
                        {issue.status}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{issue.priority}</span>
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
  const color = accent === 'orange' ? '#ff7a00' : '#22c55e';
  return (
    <div className="rounded-lg border border-[#374151] bg-[#111827]/80 p-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#8f9caf]">{title}</p>
      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-200">{value}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#263345]">
        <div className="h-full w-2/3 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, #f6b40b)` }} />
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone, delta }: { icon: any; label: string; value: string; tone: 'cyan' | 'green' | 'orange' | 'yellow'; delta: string }) {
  const tones = {
    cyan: ['#18c8df', 'rgba(24,200,223,0.16)'],
    green: ['#22c55e', 'rgba(34,197,94,0.16)'],
    orange: ['#ff7a00', 'rgba(255,122,0,0.18)'],
    yellow: ['#f6b40b', 'rgba(246,180,11,0.16)']
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-lg border border-[#263345] bg-[#0b1020]/88 p-5 shadow-xl shadow-black/20">
      <div className="absolute inset-y-0 right-0 w-32 opacity-80" style={{ background: `linear-gradient(135deg, transparent, ${tones[1]})` }} />
      <div className="relative flex items-start justify-between gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg border" style={{ borderColor: `${tones[0]}55`, color: tones[0], background: tones[1] }}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="rounded-full px-2.5 py-1 text-xs font-black" style={{ color: tones[0], background: tones[1] }}>{delta}</span>
      </div>
      <div className="relative mt-7">
        <p className="text-4xl font-black text-white">{value}</p>
        <p className="mt-2 text-sm font-semibold text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function ChartPanel({ title, action, children }: { title: string; action: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#263345] bg-[#0b1020]/86 p-4 shadow-xl shadow-black/20">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-white">{title}</h2>
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
    <div className="rounded-md border border-[#374151] bg-[#070b16] px-3 py-2 shadow-xl">
      <p className="mb-1 text-xs font-black text-slate-100">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs font-semibold" style={{ color: entry.color || entry.payload?.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}
