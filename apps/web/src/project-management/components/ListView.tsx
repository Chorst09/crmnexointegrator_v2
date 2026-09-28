import React from 'react';
import { Issue, IssueStatus } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CheckCircle2, CircleDashed, CircleDot, Clock, User as UserIcon, Trash2 } from 'lucide-react';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusColors: Record<IssueStatus, string> = {
  'PENDENTE': 'bg-[#111827] text-slate-300',
  'PLANEJAMENTO': 'bg-[#111827] text-slate-300',
  'EM PROGRESSO': 'bg-[#3b82f6] text-white',
  'EM RISCO': 'bg-[#ff7a00] text-white',
  'ATUALIZAÇÃO NECESSÁRIA': 'bg-[#eab308] text-slate-900',
  'EM ESPERA': 'bg-[#78716c] text-white',
  'CONCLUÍDO': 'bg-[#22c55e] text-white',
  'CANCELADO': 'bg-[#22c55e] text-white'
};

const priorityColors: Record<string, string> = {
  'Urgente': 'text-red-500',
  'Alta': 'text-yellow-500',
  'Normal': 'text-blue-500',
  'Baixa': 'text-slate-400',
};

export default function ListView({ issues, onTaskClick, onDeleteIssue }: { issues: Issue[], onTaskClick?: (issue: Issue) => void, onDeleteIssue?: (issue: Issue) => void | Promise<void> }) {
  return (
    <div className="h-full bg-[#070b16] flex flex-col text-slate-300">
      <div className="flex-1 overflow-auto p-6">
        <div className="border border-[#263345] rounded-lg shadow-sm overflow-hidden bg-[#111827]">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#111827] border-b border-[#263345] text-slate-400">
              <tr>
                <th className="px-6 py-3 font-semibold w-full">Nome da Fase</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Prioridade</th>
                <th className="px-6 py-3 font-semibold">Responsável</th>
                <th className="px-6 py-3 font-semibold">Data Final</th>
                <th className="px-6 py-3 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#0d1423]">
              {issues.map(issue => (
                <tr
                  key={issue.id}
                  className="hover:bg-[#111827] transition-colors group cursor-pointer"
                  onClick={() => onTaskClick?.(issue)}
                >
                  <td className="px-6 py-3 font-medium text-slate-200 group-hover:text-white transition-colors truncate max-w-md flex items-center gap-2">
                    <span className="text-slate-500 text-[10px] font-mono">{issue.key || `PRJ-${issue.id.slice(-3)}`}</span>
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
                        <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white", issue.assignee.color)}>
                          {issue.assignee.initials}
                        </div>
                        <span className="text-slate-300 text-xs">{issue.assignee.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-500 text-xs">
                        <div className="w-5 h-5 rounded-full border border-dashed border-slate-600 flex items-center justify-center">
                          <UserIcon className="w-3 h-3" />
                        </div>
                        <span>Vazio</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-slate-400 text-xs">
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
                      className="rounded p-1.5 text-slate-500 hover:bg-red-900/40 hover:text-red-400"
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
