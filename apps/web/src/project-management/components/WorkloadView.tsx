import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Mail, UserPlus, Users } from 'lucide-react';
import { Issue, User } from '../types';

type WorkloadViewProps = {
  issues: Issue[];
  users: User[];
};

const WEEKLY_HOURS = 40;
const activeStatuses = new Set(['PENDENTE', 'PLANEJAMENTO', 'EM PROGRESSO', 'EM RISCO', 'ATUALIZAÇÃO NECESSÁRIA', 'EM ESPERA']);

function getIssueHours(issue: Issue) {
  const estimated = issue.estimatedHours ?? Number(String(issue.estimate || '').replace(',', '.'));
  return Number.isFinite(estimated) && estimated > 0 ? estimated : 0;
}

function formatHours(value: number) {
  return `${Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;
}

function getCapacity(user: User) {
  const allocation = Number(user.allocationPercent ?? 100);
  const safeAllocation = Number.isFinite(allocation) ? Math.max(0, allocation) : 100;
  return Math.round((WEEKLY_HOURS * safeAllocation) / 100);
}

export default function WorkloadView({ issues, users }: WorkloadViewProps) {
  const activeIssues = useMemo(() => issues.filter(issue => activeStatuses.has(issue.status)), [issues]);
  const unassignedIssues = activeIssues.filter(issue => !issue.assignee?.id);

  const workload = users.map(user => {
    const assignedIssues = activeIssues.filter(issue => issue.assignee?.id === user.id);
    const plannedHours = assignedIssues.reduce((sum, issue) => sum + getIssueHours(issue), 0);
    const actualHours = assignedIssues.reduce((sum, issue) => sum + (issue.actualHours || 0), 0);
    const capacity = getCapacity(user);
    const usagePercent = capacity > 0 ? Math.min(140, (plannedHours / capacity) * 100) : 0;

    return {
      ...user,
      assignedIssues,
      plannedHours,
      actualHours,
      capacity,
      usagePercent,
      overloaded: plannedHours > capacity
    };
  });

  const totalCapacity = workload.reduce((sum, user) => sum + user.capacity, 0);
  const totalPlanned = workload.reduce((sum, user) => sum + user.plannedHours, 0);
  const overloadedCount = workload.filter(user => user.overloaded).length;

  return (
    <div className="h-full bg-[#070b16] overflow-y-auto p-6 text-slate-300 custom-scrollbar">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-3 text-xl font-bold text-slate-100">
              <Users className="h-5 w-5 text-[#ff7a00]" />
              Carga de trabalho
            </h2>
            <p className="mt-1 text-sm text-slate-500">Capacidade semanal baseada na alocação da equipe do projeto.</p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-md border border-[#263345] bg-[#111827] p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Membros</p>
            <p className="mt-2 text-2xl font-black text-slate-100">{users.length}</p>
          </div>
          <div className="rounded-md border border-[#263345] bg-[#111827] p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Capacidade</p>
            <p className="mt-2 text-2xl font-black text-[#22c55e]">{formatHours(totalCapacity)}</p>
          </div>
          <div className="rounded-md border border-[#263345] bg-[#111827] p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Planejado</p>
            <p className="mt-2 text-2xl font-black text-[#ffb15c]">{formatHours(totalPlanned)}</p>
          </div>
          <div className="rounded-md border border-[#263345] bg-[#111827] p-4">
            <p className="text-xs font-semibold uppercase text-slate-500">Sobrecarga</p>
            <p className={`mt-2 text-2xl font-black ${overloadedCount ? 'text-red-400' : 'text-[#22c55e]'}`}>{overloadedCount}</p>
          </div>
        </div>

        {users.length === 0 && (
          <div className="mb-6 rounded-md border border-dashed border-[#374151] bg-[#111827] p-8 text-center">
            <UserPlus className="mx-auto mb-3 h-8 w-8 text-[#ff7a00]" />
            <p className="font-bold text-slate-200">Nenhum membro ativo na equipe deste projeto.</p>
            <p className="mt-1 text-sm text-slate-500">Adicione membros na aba Equipe para acompanhar a carga.</p>
          </div>
        )}

        <div className="grid gap-4">
          {workload.map(user => (
            <div key={user.id} className="rounded-md border border-[#263345] bg-[#111827] p-5">
              <div className="grid gap-5 lg:grid-cols-[240px_1fr_320px]">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white ${user.color}`}>
                    {user.initials}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-slate-100">{user.name}</h3>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-slate-500">
                      <Mail className="h-3 w-3" />
                      {user.email || 'Sem e-mail'}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500">Planejado / capacidade</span>
                    <span className={user.overloaded ? 'font-bold text-red-300' : 'font-semibold text-slate-300'}>
                      {formatHours(user.plannedHours)} / {formatHours(user.capacity)}
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-[#0d1423]">
                    <div
                      className={`h-full rounded-full ${user.overloaded ? 'bg-red-500' : 'bg-[#ff7a00]'}`}
                      style={{ width: `${Math.min(100, user.usagePercent)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Realizado {formatHours(user.actualHours)}</span>
                    <span>{user.allocationPercent ?? 100}% alocado</span>
                    {user.overloaded ? (
                      <span className="flex items-center gap-1 font-semibold text-red-300"><AlertTriangle className="h-3 w-3" /> Sobrecarga</span>
                    ) : (
                      <span className="flex items-center gap-1 text-[#22c55e]"><CheckCircle2 className="h-3 w-3" /> Dentro da capacidade</span>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  {user.assignedIssues.slice(0, 4).map(issue => (
                    <div key={issue.id} className="rounded-md border border-[#263345] bg-[#070b16] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 truncate text-xs font-semibold text-slate-200">{issue.title}</p>
                        <span className="shrink-0 text-[11px] font-bold text-[#ffb15c]">{formatHours(getIssueHours(issue))}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">{issue.sourceType === 'phase' ? 'Fase' : 'Tarefa'} · {issue.status}</p>
                    </div>
                  ))}
                  {user.assignedIssues.length === 0 && (
                    <div className="rounded-md border border-dashed border-[#374151] bg-[#070b16] px-3 py-5 text-center text-xs text-slate-500">
                      Nenhum item atribuido.
                    </div>
                  )}
                  {user.assignedIssues.length > 4 && (
                    <p className="text-right text-[11px] text-slate-500">+{user.assignedIssues.length - 4} itens</p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <div className="rounded-md border border-[#263345] bg-[#111827] p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-bold text-slate-100">Nao atribuidas</h3>
              <span className="rounded-full bg-[#0d1423] px-2.5 py-1 text-xs font-bold text-slate-400">{unassignedIssues.length}</span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {unassignedIssues.slice(0, 8).map(issue => (
                <div key={issue.id} className="rounded-md border border-[#263345] bg-[#070b16] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-xs font-semibold text-slate-200">{issue.title}</p>
                    <span className="shrink-0 text-[11px] text-slate-500">{formatHours(getIssueHours(issue))}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">{issue.sourceType === 'phase' ? 'Fase' : 'Tarefa'} · {issue.status}</p>
                </div>
              ))}
              {unassignedIssues.length === 0 && (
                <p className="text-sm text-slate-500">Todos os itens ativos estao atribuidos.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
