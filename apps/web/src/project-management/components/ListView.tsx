import React from 'react';
import { Issue, IssueStatus } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CheckCircle2, CircleDashed, CircleDot, Clock, User as UserIcon, Trash2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusColors: Record<IssueStatus, string> = {
  'PENDENTE': "bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]",
  'PLANEJAMENTO': "bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]",
  'EM PROGRESSO': "bg-[#3b82f6] text-[rgb(var(--crm-ink-rgb)_/_1)]",
  'EM RISCO': "bg-[#ff7a00] text-[rgb(var(--crm-ink-rgb)_/_1)]",
  'ATUALIZAÇÃO NECESSÁRIA': "bg-[#eab308] text-[rgb(var(--crm-ink-rgb)_/_1)]",
  'EM ESPERA': "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]",
  'CONCLUÍDO': "bg-[#22c55e] text-[rgb(var(--crm-ink-rgb)_/_1)]",
  'CANCELADO': "bg-[#22c55e] text-[rgb(var(--crm-ink-rgb)_/_1)]"
};

const priorityColors: Record<string, string> = {
  'Urgente': 'text-red-500',
  'Alta': 'text-yellow-500',
  'Normal': 'text-blue-500',
  'Baixa': "text-[rgb(var(--crm-muted-rgb)_/_1)]",
};

export default function ListView({ issues, onTaskClick, onDeleteIssue }: { issues: Issue[], onTaskClick?: (issue: Issue) => void, onDeleteIssue?: (issue: Issue) => void | Promise<void> }) {
  return (
    <div className="h-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] flex flex-col text-[rgb(var(--crm-ink-rgb)_/_1)]">
      <div className="flex-1 overflow-auto p-6">
        <div className="border border-[var(--crm-border)] rounded-lg shadow-sm overflow-hidden bg-[rgb(var(--crm-surface-2-rgb)_/_1)]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border-b border-[var(--crm-border)] text-[rgb(var(--crm-muted-rgb)_/_1)]">
              <tr>
                <th className="px-6 py-3 font-semibold w-full">Nome da Fase</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Prioridade</th>
                <th className="px-6 py-3 font-semibold">Responsável</th>
                <th className="px-6 py-3 font-semibold">Data Final</th>
                <th className="px-6 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--crm-border)]">
              {issues.map(issue => (
                <tr
                  key={issue.id}
                  className="hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] transition-colors group cursor-pointer"
                  onClick={() => onTaskClick?.(issue)}
                >
                  <td className="px-6 py-3 font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] group-hover:text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors truncate max-w-md flex items-center gap-2">
                    <span className="text-[rgb(var(--crm-muted-rgb)_/_1)] text-[10px] font-mono">{issue.key || `PRJ-${issue.id.slice(-3)}`}</span>
                    {issue.title}
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold tracking-wider", statusColors[issue.status])}>
                      {issue.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <span className={cn("flex items-center gap-1 font-medium", priorityColors[issue.priority])}>
                      {issue.priority}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {issue.assignee ? (
                      <div className="flex items-center gap-2">
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]", issue.assignee.color)}>
                          {issue.assignee.initials}
                        </div>
                        <span className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs">{issue.assignee.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-[rgb(var(--crm-muted-rgb)_/_1)] text-xs">
                        <div className="w-5 h-5 rounded-full border border-dashed border-[var(--crm-border)] flex items-center justify-center">
                          <UserIcon className="w-3 h-3" />
                        </div>
                        <span>Vazio</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-[rgb(var(--crm-muted-rgb)_/_1)] text-xs">
                    {issue.dueDate ? issue.dueDate : '-'}
                  </td>
                  <td className="px-6 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Tem certeza que deseja excluir "${issue.title}"?`)) {
                          onDeleteIssue?.(issue);
                        }
                      }}
                      className="rounded p-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:bg-red-50/40 dark:hover:bg-red-900/40 hover:text-red-700 dark:hover:text-red-400"
                      title="Excluir fase"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
