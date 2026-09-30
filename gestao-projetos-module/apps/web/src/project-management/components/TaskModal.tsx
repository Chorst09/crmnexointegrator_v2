import React, { useMemo, useState } from 'react';
import { Issue, IssuePriority, IssueStatus, User } from '../types';
import { mockColumns, mockUsers } from '../data';
import {
  X, CheckSquare, Maximize2, MessageSquare, Search, Bell, Filter,
  User as UserIcon, Calendar, Flag, Paperclip, ChevronRight,
  Sparkles, Smile, Image as ImageIcon, Plus, CheckCircle2, Clock,
  Target, Save
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

export default function TaskModal({
  task,
  onClose,
  onUpdate
}: {
  task: Issue;
  onClose: () => void;
  onUpdate: (task: Issue) => void;
}) {
  const [draft, setDraft] = useState<Issue>(task);
  const [followUpText, setFollowUpText] = useState('');

  const statusOptions = mockColumns.map(column => column.id);
  const priorityOptions: IssuePriority[] = ['Urgente', 'Alta', 'Normal', 'Baixa'];
  const followUps = draft.followUps || [];

  const savedAt = useMemo(() => formatTime(draft.updatedAt), [draft.updatedAt]);

  const persist = (patch: Partial<Issue>) => {
    const next = {
      ...draft,
      ...patch,
      updatedAt: new Date().toISOString()
    };
    setDraft(next);
    onUpdate(next);
  };

  const addFollowUp = () => {
    const text = followUpText.trim();
    if (!text) return;

    persist({
      followUps: [
        ...followUps,
        {
          id: `fu-${Date.now()}`,
          author: 'Carlos Horst',
          text,
          createdAt: new Date().toISOString()
        }
      ]
    });
    setFollowUpText('');
  };

  const fieldClass = "w-full rounded-md border border-[#374151] bg-[#070b16] px-3 py-2 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff7a00] focus:ring-2 focus:ring-[#ff7a00]/20";
  const labelClass = "mb-1.5 flex items-center gap-2 text-xs font-semibold text-slate-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="flex h-[90vh] w-full max-w-[1240px] overflow-hidden rounded-lg border border-[#263345] bg-[#070b16] text-slate-300 shadow-2xl">
        <div className="flex h-full w-[65%] flex-col border-r border-[#263345] bg-[#111827]">
          <div className="flex h-12 shrink-0 items-center justify-between px-6 text-xs">
            <div className="mt-2 flex items-center gap-2 text-slate-400">
              <span className="flex items-center gap-1 rounded border border-[#263345] px-2 py-1">
                <CheckSquare className="h-3.5 w-3.5" /> Fase <ChevronRight className="h-3 w-3" />
              </span>
              <Maximize2 className="h-4 w-4 text-slate-500" />
            </div>
            <div className="flex items-center gap-2 text-slate-500">
              <Save className="h-3.5 w-3.5 text-[#22c55e]" />
              Salvo {savedAt}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <input
              value={draft.title}
              onChange={(e) => persist({ title: e.target.value })}
              className="mb-6 w-full resize-none bg-transparent text-3xl font-black leading-snug text-white outline-none placeholder:text-slate-600"
              placeholder="Nome da fase"
            />

            <div className="mb-8 rounded-lg border border-[#263345] bg-[#070b16] p-3 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#18c8df]" />
                <span>Peça ao Brain uma apresentação, documento ou protótipo desta fase</span>
              </div>
            </div>

            <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-5">
              <label>
                <span className={labelClass}><CheckCircle2 className="h-4 w-4" /> Status</span>
                <select
                  className={fieldClass}
                  value={draft.status}
                  onChange={(e) => persist({ status: e.target.value as IssueStatus })}
                >
                  {statusOptions.map(status => <option key={status}>{status}</option>)}
                </select>
              </label>

              <label>
                <span className={labelClass}><UserIcon className="h-4 w-4" /> Responsável</span>
                <select
                  className={fieldClass}
                  value={draft.assignee?.id || ''}
                  onChange={(e) => {
                    const assignee = mockUsers.find(user => user.id === e.target.value);
                    persist({ assignee: assignee as User | undefined });
                  }}
                >
                  <option value="">Sem responsável</option>
                  {mockUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
              </label>

              <label>
                <span className={labelClass}><Calendar className="h-4 w-4" /> Data inicial</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={draft.startDate || ''}
                  onChange={(e) => persist({ startDate: e.target.value })}
                />
              </label>

              <label>
                <span className={labelClass}><Calendar className="h-4 w-4" /> Data final</span>
                <input
                  type="date"
                  className={fieldClass}
                  value={draft.dueDate || ''}
                  onChange={(e) => persist({ dueDate: e.target.value })}
                />
              </label>

              <label>
                <span className={labelClass}><Flag className="h-4 w-4" /> Prioridade</span>
                <select
                  className={fieldClass}
                  value={draft.priority}
                  onChange={(e) => persist({ priority: e.target.value as IssuePriority })}
                >
                  {priorityOptions.map(priority => <option key={priority}>{priority}</option>)}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className={labelClass}><Clock className="h-4 w-4" /> Estimativa</span>
                  <input
                    className={fieldClass}
                    value={draft.estimate || ''}
                    onChange={(e) => persist({ estimate: e.target.value })}
                    placeholder="Ex.: 10 dias"
                  />
                </label>
                <label>
                  <span className={labelClass}><Target className="h-4 w-4" /> Pontos</span>
                  <input
                    className={fieldClass}
                    value={draft.points || ''}
                    onChange={(e) => persist({ points: e.target.value })}
                    placeholder="0"
                  />
                </label>
              </div>
            </div>

            <label className="mb-8 block">
              <span className={labelClass}><MessageSquare className="h-4 w-4" /> Descrição da fase</span>
              <textarea
                className={`${fieldClass} min-h-[150px] resize-none leading-relaxed`}
                value={draft.description || ''}
                onChange={(e) => persist({ description: e.target.value })}
                placeholder="Descreva objetivo, atividades, dependências e critérios de aceite desta fase."
              />
            </label>

            <div className="rounded-lg border border-[#263345] bg-[#070b16] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-100">Campos adicionais</h3>
                <button
                  type="button"
                  onClick={() => persist({ customFields: [...(draft.customFields || []), { id: `cf-${Date.now()}`, name: '', value: '' }] })}
                  className="flex items-center gap-1.5 rounded-md border border-[#374151] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-[#ff7a00] hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" /> Campo
                </button>
              </div>
              <div className="space-y-3">
                {(draft.customFields || []).map(field => (
                  <div key={field.id} className="grid grid-cols-[180px_1fr_auto] gap-3">
                    <input
                      className={fieldClass}
                      value={field.name}
                      onChange={(e) => persist({ customFields: (draft.customFields || []).map(item => item.id === field.id ? { ...item, name: e.target.value } : item) })}
                      placeholder="Nome"
                    />
                    <input
                      className={fieldClass}
                      value={field.value}
                      onChange={(e) => persist({ customFields: (draft.customFields || []).map(item => item.id === field.id ? { ...item, value: e.target.value } : item) })}
                      placeholder="Valor"
                    />
                    <button
                      type="button"
                      onClick={() => persist({ customFields: (draft.customFields || []).filter(item => item.id !== field.id) })}
                      className="rounded-md border border-[#374151] px-3 text-slate-400 hover:border-red-500 hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {(!draft.customFields || draft.customFields.length === 0) && (
                  <p className="text-sm text-slate-500">Nenhum campo adicional cadastrado.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full w-[35%] flex-col bg-[#070b16]">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#263345] px-4 text-slate-400">
            <span className="font-semibold text-slate-200">Acompanhamentos</span>
            <div className="flex items-center gap-4">
              <Search className="h-4 w-4" />
              <Bell className="h-4 w-4" />
              <Filter className="h-4 w-4" />
              <div className="mx-1 h-4 w-px bg-slate-700" />
              <X className="h-5 w-5 cursor-pointer hover:text-slate-200" onClick={onClose} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 text-sm custom-scrollbar">
            <div className="mb-6 space-y-3 text-xs text-slate-500">
              <div className="flex items-center justify-between">
                <span>Fase criada</span>
                <span>{formatTime(draft.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Última atualização</span>
                <span>{savedAt}</span>
              </div>
            </div>

            <div className="space-y-5">
              {followUps.map(item => (
                <div key={item.id} className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ff7a00] text-xs font-bold text-white">
                    CH
                  </div>
                  <div className="min-w-0 flex-1 rounded-lg border border-[#263345] bg-[#111827] p-3">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{item.author}</span>
                      <span className="text-xs text-slate-500">{formatTime(item.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap break-words text-slate-300">{item.text}</p>
                  </div>
                </div>
              ))}

              {followUps.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#374151] bg-[#111827]/60 p-6 text-center text-slate-500">
                  Nenhum acompanhamento registrado nesta fase.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[#263345] bg-[#070b16] p-4">
            <div className="rounded-md border border-[#374151] bg-[#111827] p-3 transition-colors focus-within:border-[#ff7a00]">
              <textarea
                value={followUpText}
                onChange={(e) => setFollowUpText(e.target.value)}
                placeholder="Registrar acompanhamento, decisão, impedimento ou próxima ação..."
                className="mb-3 min-h-[92px] w-full resize-none bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-600"
              />
              <div className="flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-2">
                  <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#1f2937]"><Plus className="h-4 w-4" /></button>
                  <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#1f2937]"><Smile className="h-4 w-4" /></button>
                  <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#1f2937]"><ImageIcon className="h-4 w-4" /></button>
                  <button className="flex h-7 w-7 items-center justify-center rounded hover:bg-[#1f2937]"><Paperclip className="h-4 w-4" /></button>
                </div>
                <button
                  type="button"
                  onClick={addFollowUp}
                  disabled={!followUpText.trim()}
                  className="rounded-md bg-[#ff7a00] px-4 py-2 text-xs font-black text-white transition-colors hover:bg-[#f6b40b] hover:text-[#050914] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
