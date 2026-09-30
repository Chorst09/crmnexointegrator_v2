import React, { useMemo, useState, useEffect } from 'react';
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  Filter,
  ListChecks,
  PlusCircle,
  UserPlus,
  MessageSquare,
  AlertTriangle,
  FileText,
  Users,
  GitBranch,
  X
} from 'lucide-react';
import { Issue, Space, User } from '../types';

type ActivityKind = 'all' | 'items' | 'team' | 'risk' | 'done' | 'manual';

type ManualActivityType = 'note' | 'meeting' | 'decision' | 'impediment' | 'change';

type ManualActivity = {
  id: string;
  type: ManualActivityType;
  title: string;
  description: string;
  createdAt: string;
  createdBy: string;
  projectId: string;
};

type ActivityEvent = {
  id: string;
  kind: Exclude<ActivityKind, 'all'>;
  date: Date;
  actor?: User;
  title: string;
  action: string;
  target: string;
  detail?: string;
  issue?: Issue;
  isManual?: boolean;
  manualType?: ManualActivityType;
};

type ActivityViewProps = {
  project?: Space;
  issues: Issue[];
  users: User[];
  onTaskClick?: (issue: Issue) => void;
};

const filterOptions: Array<{ id: ActivityKind; label: string }> = [
  { id: 'all', label: 'Tudo' },
  { id: 'items', label: 'Itens' },
  { id: 'team', label: 'Equipe' },
  { id: 'risk', label: 'Risco' },
  { id: 'done', label: 'Concluídos' },
  { id: 'manual', label: 'Registros' }
];

const manualActivityTypes: Array<{ id: ManualActivityType; label: string; icon: any; color: string }> = [
  { id: 'note', label: 'Nota', icon: FileText, color: 'text-blue-400 bg-blue-500/12 border-blue-500/35' },
  { id: 'meeting', label: 'Reunião', icon: Users, color: 'text-purple-400 bg-purple-500/12 border-purple-500/35' },
  { id: 'decision', label: 'Decisão', icon: CheckCircle2, color: 'text-green-400 bg-green-500/12 border-green-500/35' },
  { id: 'impediment', label: 'Impedimento', icon: AlertTriangle, color: 'text-red-400 bg-red-500/12 border-red-500/35' },
  { id: 'change', label: 'Mudança', icon: GitBranch, color: 'text-orange-400 bg-orange-500/12 border-orange-500/35' }
];

function toValidDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatRelativeDate(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);
  const isFuture = diffMinutes < 0;
  const absMinutes = Math.abs(diffMinutes);

  if (absMinutes < 1) return 'Agora';
  if (isFuture && absMinutes < 60) return `Em ${absMinutes} min`;
  if (isFuture) {
    const absHours = Math.round(absMinutes / 60);
    if (absHours < 24) return `Em ${absHours} h`;
    const absDays = Math.round(absHours / 24);
    if (absDays < 8) return `Em ${absDays} dia${absDays > 1 ? 's' : ''}`;
  }

  if (diffMinutes < 60) return `Ha ${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Ha ${diffHours} h`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 8) return `Ha ${diffDays} dia${diffDays > 1 ? 's' : ''}`;

  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAbsoluteDate(date: Date) {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getEventIcon(kind: ActivityEvent['kind'], issue?: Issue, manualType?: ManualActivityType) {
  if (kind === 'manual' && manualType) {
    const typeConfig = manualActivityTypes.find(t => t.id === manualType);
    return typeConfig?.icon || MessageSquare;
  }
  if (kind === 'team') return UserPlus;
  if (kind === 'risk') return AlertCircle;
  if (kind === 'done' || issue?.status === 'CONCLUÍDO') return CheckCircle2;
  if (issue?.sourceType === 'task') return ListChecks;
  return PlusCircle;
}

function getEventTone(kind: ActivityEvent['kind'], manualType?: ManualActivityType) {
  if (kind === 'manual' && manualType) {
    const typeConfig = manualActivityTypes.find(t => t.id === manualType);
    return typeConfig?.color || 'text-slate-300 bg-slate-500/12 border-slate-500/35';
  }
  if (kind === 'team') return 'text-[#18c8df] bg-[#18c8df]/12 border-[#18c8df]/35';
  if (kind === 'risk') return 'text-red-300 bg-red-500/12 border-red-500/35';
  if (kind === 'done') return 'text-[#22c55e] bg-[#22c55e]/12 border-[#22c55e]/35';
  return 'text-[#ffb15c] bg-[#ff7a00]/12 border-[#ff7a00]/35';
}

function sortByDateDesc(a: ActivityEvent, b: ActivityEvent) {
  return b.date.getTime() - a.date.getTime();
}

export default function ActivityView({ project, issues, users, onTaskClick }: ActivityViewProps) {
  const [activeFilter, setActiveFilter] = useState<ActivityKind>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [manualActivities, setManualActivities] = useState<ManualActivity[]>([]);
  const [newActivity, setNewActivity] = useState({
    type: 'note' as ManualActivityType,
    title: '',
    description: ''
  });

  const STORAGE_KEY = `pm_manual_activities_${project?.id || 'default'}`;

  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setManualActivities(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Erro ao carregar atividades manuais', error);
    }
  }, [project?.id]);

  const saveManualActivity = () => {
    if (!newActivity.title.trim() || !project?.id) return;

    const activity: ManualActivity = {
      id: `manual-${Date.now()}`,
      type: newActivity.type,
      title: newActivity.title.trim(),
      description: newActivity.description.trim(),
      createdAt: new Date().toISOString(),
      createdBy: users[0]?.id || 'current-user',
      projectId: project.id
    };

    const updated = [activity, ...manualActivities];
    setManualActivities(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    setNewActivity({ type: 'note', title: '', description: '' });
    setShowCreateModal(false);
  };

  const events = useMemo(() => {
    const timeline: ActivityEvent[] = [];
    const fallbackActor = users[0];

    // Adicionar atividades manuais
    for (const activity of manualActivities) {
      const creator = users.find(u => u.id === activity.createdBy) || fallbackActor;
      const typeConfig = manualActivityTypes.find(t => t.id === activity.type);
      
      timeline.push({
        id: activity.id,
        kind: 'manual',
        date: new Date(activity.createdAt),
        actor: creator,
        title: typeConfig?.label || 'Registro',
        action: 'registrou',
        target: activity.title,
        detail: activity.description || undefined,
        isManual: true,
        manualType: activity.type
      });
    }

    const projectCreatedAt = toValidDate(project?.createdAt);
    if (project && projectCreatedAt) {
      timeline.push({
        id: `project-created-${project.id}`,
        kind: 'items',
        date: projectCreatedAt,
        actor: fallbackActor,
        title: 'Projeto criado',
        action: 'criou o projeto',
        target: project.name,
        detail: project.client ? `Cliente: ${project.client}` : undefined
      });
    }

    for (const member of project?.teamMembers || []) {
      const user = users.find(item => item.id === member.userId || item.memberId === member.id);
      const joinedAt = toValidDate(member.startDate) || toValidDate(member.createdAt);
      if (joinedAt && user) {
        timeline.push({
          id: `team-joined-${member.id}`,
          kind: 'team',
          date: joinedAt,
          actor: user,
          title: 'Membro adicionado',
          action: 'entrou na equipe do projeto',
          target: user.name,
          detail: `${member.role || 'Membro'} · ${member.allocationPercent ?? 100}% alocado`
        });
      }
    }

    for (const issue of issues) {
      const createdAt = toValidDate(issue.createdAt);
      const updatedAt = toValidDate(issue.updatedAt);
      const actor = issue.assignee || fallbackActor;
      const label = issue.sourceType === 'phase' ? 'fase' : 'tarefa';

      if (createdAt) {
        timeline.push({
          id: `${issue.id}-created`,
          kind: 'items',
          date: createdAt,
          actor,
          title: `${label === 'fase' ? 'Fase' : 'Tarefa'} criada`,
          action: `criou a ${label}`,
          target: issue.title,
          detail: issue.assignee?.name ? `Responsavel: ${issue.assignee.name}` : 'Sem responsavel',
          issue
        });
      }

      if (updatedAt && (!createdAt || Math.abs(updatedAt.getTime() - createdAt.getTime()) > 60000)) {
        timeline.push({
          id: `${issue.id}-updated`,
          kind: issue.status === 'CONCLUÍDO' ? 'done' : issue.status === 'EM RISCO' ? 'risk' : 'items',
          date: updatedAt,
          actor,
          title: issue.status === 'CONCLUÍDO' ? 'Item concluido' : 'Item atualizado',
          action: issue.status === 'CONCLUÍDO' ? `concluiu a ${label}` : `atualizou a ${label}`,
          target: issue.title,
          detail: `${issue.status}${issue.estimatedHours ? ` · ${issue.estimatedHours}h estimadas` : ''}`,
          issue
        });
      }

      const dueDate = toValidDate(issue.dueDate);
      if (dueDate && issue.status !== 'CONCLUÍDO' && issue.status !== 'CANCELADO') {
        const now = new Date();
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / 86400000);
        if (daysUntilDue <= 7) {
          timeline.push({
            id: `${issue.id}-due`,
            kind: daysUntilDue < 0 ? 'risk' : 'items',
            date: dueDate,
            actor,
            title: daysUntilDue < 0 ? 'Prazo vencido' : 'Prazo proximo',
            action: daysUntilDue < 0 ? 'tem prazo vencido em' : 'tem prazo programado para',
            target: issue.title,
            detail: dueDate.toLocaleDateString('pt-BR'),
            issue
          });
        }
      }
    }

    return timeline.sort(sortByDateDesc);
  }, [issues, project, users, manualActivities]);

  const filteredEvents = activeFilter === 'all'
    ? events
    : events.filter(event => event.kind === activeFilter);

  const itemEvents = events.filter(event => event.kind === 'items').length;
  const riskEvents = events.filter(event => event.kind === 'risk').length;
  const teamEvents = events.filter(event => event.kind === 'team').length;

  return (
    <div className="h-full overflow-y-auto bg-[#070b16] p-6 text-slate-300 custom-scrollbar">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-3 text-xl font-bold text-slate-100">
              <Clock className="h-5 w-5 text-[#ff7a00]" />
              Atividade
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Linha do tempo real de fases, tarefas, prazos e equipe deste projeto.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-md bg-[#ff7a00] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#f6b40b] hover:text-[#050914]"
            >
              <PlusCircle className="h-4 w-4" /> Nova Atividade
            </button>
            
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              {filterOptions.map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setActiveFilter(option.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-bold transition-colors ${
                    activeFilter === option.id
                      ? 'border-[#ff7a00] bg-[#ff7a00] text-white'
                      : 'border-[#263345] bg-[#111827] text-slate-400 hover:border-[#374151] hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border border-[#263345] bg-[#111827] p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Eventos</p>
            <p className="mt-2 text-2xl font-black text-slate-100">{events.length}</p>
          </div>
          <div className="rounded-md border border-[#263345] bg-[#111827] p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Itens</p>
            <p className="mt-2 text-2xl font-black text-[#ffb15c]">{itemEvents}</p>
          </div>
          <div className="rounded-md border border-[#263345] bg-[#111827] p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Equipe</p>
            <p className="mt-2 text-2xl font-black text-[#18c8df]">{teamEvents}</p>
          </div>
          <div className="rounded-md border border-[#263345] bg-[#111827] p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Riscos</p>
            <p className={`mt-2 text-2xl font-black ${riskEvents ? 'text-red-300' : 'text-[#22c55e]'}`}>{riskEvents}</p>
          </div>
        </div>

        {filteredEvents.length === 0 ? (
          <div className="rounded-md border border-dashed border-[#374151] bg-[#111827] p-10 text-center">
            <CalendarClock className="mx-auto mb-3 h-9 w-9 text-[#ff7a00]" />
            <p className="font-bold text-slate-200">Nenhuma atividade encontrada.</p>
            <p className="mt-1 text-sm text-slate-500">Crie fases, tarefas ou adicione membros para preencher a linha do tempo.</p>
          </div>
        ) : (
          <div className="relative ml-4 space-y-5 border-l border-[#263345] pb-12">
            {filteredEvents.map(event => {
              const Icon = getEventIcon(event.kind, event.issue, event.manualType);
              const tone = getEventTone(event.kind, event.manualType);
              const actorInitials = event.actor?.initials || 'PM';
              const actorColor = event.actor?.color || 'bg-[#ff7a00]';

              return (
                <article key={event.id} className="relative pl-8">
                  <div className="absolute -left-[17px] top-1">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white ring-4 ring-[#070b16] ${actorColor}`}>
                      {actorInitials}
                    </div>
                  </div>

                  <div className="rounded-md border border-[#263345] bg-[#111827] p-4 transition-colors hover:border-[#374151]">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md border ${tone}`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          <p className="text-xs font-bold uppercase text-slate-500">{event.title}</p>
                        </div>
                        <p className="text-sm text-slate-300">
                          <span className="font-semibold text-slate-100">{event.actor?.name || 'Sistema'}</span>{' '}
                          <span>{event.action}</span>{' '}
                          {event.issue ? (
                            <button
                              type="button"
                              onClick={() => onTaskClick?.(event.issue as Issue)}
                              className="font-semibold text-[#ffb15c] hover:text-[#ff7a00] hover:underline"
                            >
                              {event.target}
                            </button>
                          ) : (
                            <span className="font-semibold text-[#ffb15c]">{event.target}</span>
                          )}
                        </p>
                        {event.detail && (
                          <p className="mt-2 text-xs text-slate-500">{event.detail}</p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                        <Edit3 className="h-3.5 w-3.5" />
                        <span title={formatAbsoluteDate(event.date)}>{formatRelativeDate(event.date)}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Nova Atividade */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-[#263345] bg-[#111827] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#263345] p-5">
              <div>
                <h3 className="text-lg font-bold text-slate-100">Nova Atividade</h3>
                <p className="mt-1 text-sm text-slate-500">Registre reuniões, decisões, notas e impedimentos</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md p-2 text-slate-400 transition-colors hover:bg-[#263345] hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Tipo de Registro
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {manualActivityTypes.map(type => {
                    const TypeIcon = type.icon;
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewActivity(prev => ({ ...prev, type: type.id }))}
                        className={`flex flex-col items-center gap-2 rounded-lg border p-3 transition-all ${
                          newActivity.type === type.id
                            ? 'border-[#ff7a00] bg-[#ff7a00]/10 ring-2 ring-[#ff7a00]/20'
                            : 'border-[#263345] bg-[#070b16] hover:border-[#374151]'
                        }`}
                      >
                        <TypeIcon className={`h-5 w-5 ${newActivity.type === type.id ? 'text-[#ff7a00]' : 'text-slate-400'}`} />
                        <span className={`text-xs font-semibold ${newActivity.type === type.id ? 'text-slate-100' : 'text-slate-500'}`}>
                          {type.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Título *
                </label>
                <input
                  type="text"
                  value={newActivity.title}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Reunião de kickoff, Decisão sobre arquitetura..."
                  className="w-full rounded-md border border-[#263345] bg-[#070b16] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-[#ff7a00]"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-300">
                  Descrição
                </label>
                <textarea
                  value={newActivity.description}
                  onChange={(e) => setNewActivity(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Detalhes, participantes, ações tomadas, próximos passos..."
                  className="w-full rounded-md border border-[#263345] bg-[#070b16] px-3 py-2 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-[#ff7a00] resize-none"
                  rows={4}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-[#263345] p-5">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-md border border-[#263345] bg-[#070b16] px-4 py-2 text-sm font-semibold text-slate-300 transition-colors hover:border-[#374151] hover:text-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveManualActivity}
                disabled={!newActivity.title.trim()}
                className="rounded-md bg-[#ff7a00] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#f6b40b] hover:text-[#050914] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar Atividade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
