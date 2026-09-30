import React, { useMemo, useState } from 'react';
import { Issue, IssuePriority, IssueStatus, User } from '../types';
import { mockColumns, mockUsers } from '../data';
import {
  X, CheckSquare, Maximize2, MessageSquare, Search, Bell, Filter,
  User as UserIcon, Calendar, Flag, Paperclip, ChevronRight,
  Sparkles, Smile, Image as ImageIcon, Plus, CheckCircle2, Clock,
  Target, Save, FileDown
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import RACIMatrix from './RACIMatrix';
import { jsPDF } from 'jspdf';

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
  onUpdate,
  users = []
}: {
  task: Issue;
  onClose: () => void;
  onUpdate: (task: Issue) => void;
  users?: User[];
}) {
  const [draft, setDraft] = useState<Issue>(task);
  const [followUpText, setFollowUpText] = useState('');
  const assignableUsers = users.length > 0 ? users : mockUsers;

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

  const exportToPDF = () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let yPos = margin;

    // Cabeçalho
    pdf.setFillColor(7, 11, 22);
    pdf.rect(0, 0, pageWidth, 35, 'F');
    
    pdf.setFontSize(18);
    pdf.setTextColor(255, 255, 255);
    pdf.text('Fase do Projeto', margin, 15);
    
    pdf.setFontSize(10);
    pdf.setTextColor(143, 156, 175);
    pdf.text(draft.title, margin, 25);

    // Logo/Marca
    pdf.setFontSize(14);
    pdf.setTextColor(255, 122, 0);
    pdf.text('NEXOS', pageWidth - margin - 20, 15);

    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    const dataGeracao = new Date().toLocaleDateString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
    pdf.text(`Gerado em: ${dataGeracao}`, pageWidth - margin - 45, 25);

    yPos = 45;

    // Informações da Fase
    pdf.setFontSize(12);
    pdf.setTextColor(255, 122, 0);
    pdf.text('Informações da Fase', margin, yPos);
    yPos += 8;

    pdf.setFontSize(9);
    pdf.setTextColor(51, 65, 85);

    const info = [
      ['Status:', draft.status],
      ['Prioridade:', draft.priority],
      ['Responsável:', draft.assignee?.name || 'Não atribuído'],
      ['Data Inicial:', draft.startDate || '-'],
      ['Data Final:', draft.dueDate || '-'],
      ['Estimativa:', draft.estimatedHours ? `${draft.estimatedHours}h` : '-'],
      ['Realizado:', draft.actualHours ? `${draft.actualHours}h` : '-']
    ];

    info.forEach(([label, value]) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(label, margin, yPos);
      pdf.setFont('helvetica', 'normal');
      pdf.text(String(value), margin + 35, yPos);
      yPos += 6;
    });

    yPos += 5;

    // Descrição
    if (draft.description) {
      pdf.setFontSize(12);
      pdf.setTextColor(255, 122, 0);
      pdf.text('Descrição', margin, yPos);
      yPos += 8;

      pdf.setFontSize(9);
      pdf.setTextColor(51, 65, 85);
      const lines = pdf.splitTextToSize(draft.description, pageWidth - 2 * margin);
      lines.forEach((line: string) => {
        if (yPos > pageHeight - 30) {
          pdf.addPage();
          yPos = margin;
        }
        pdf.text(line, margin, yPos);
        yPos += 5;
      });
      yPos += 5;
    }

    // Matriz RACI
    pdf.setFontSize(12);
    pdf.setTextColor(255, 122, 0);
    pdf.text('Matriz RACI', margin, yPos);
    yPos += 8;

    const raciRoles = [
      { 
        label: 'Responsável (R)', 
        ids: draft.responsibleIds || [], 
        color: [59, 130, 246] 
      },
      { 
        label: 'Aprovador (A)', 
        ids: draft.accountableId ? [draft.accountableId] : [], 
        color: [168, 85, 247] 
      },
      { 
        label: 'Consultado (C)', 
        ids: draft.consultedIds || [], 
        color: [34, 197, 94] 
      },
      { 
        label: 'Informado (I)', 
        ids: draft.informedIds || [], 
        color: [249, 115, 22] 
      }
    ];

    raciRoles.forEach(role => {
      if (yPos > pageHeight - 30) {
        pdf.addPage();
        yPos = margin;
      }

      pdf.setFontSize(10);
      pdf.setTextColor(role.color[0], role.color[1], role.color[2]);
      pdf.text(role.label, margin, yPos);
      yPos += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(51, 65, 85);

      if (role.ids.length > 0) {
        const users = role.ids.map(id => assignableUsers.find(u => u.id === id)?.name).filter(Boolean);
        users.forEach((name) => {
          pdf.text(`• ${name}`, margin + 5, yPos);
          yPos += 5;
        });
      } else {
        pdf.setTextColor(148, 163, 184);
        pdf.text('Nenhum usuário atribuído', margin + 5, yPos);
        yPos += 5;
      }
      yPos += 3;
    });

    // Rodapé
    pdf.setFontSize(8);
    pdf.setTextColor(100, 116, 139);
    pdf.text('Fase do Projeto - Gestão de Projetos Nexos', margin, pageHeight - 10);
    pdf.text('Página 1', pageWidth - margin - 15, pageHeight - 10);

    // Salvar
    const fileName = `Fase_${draft.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
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
            <div className="flex items-center gap-4 text-slate-500">
              <button
                type="button"
                onClick={exportToPDF}
                className="flex items-center gap-1.5 rounded-md border border-[#263345] bg-[#070b16] px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-[#ff7a00] hover:text-white"
                title="Exportar fase para PDF"
              >
                <FileDown className="h-3.5 w-3.5" />
                Exportar PDF
              </button>
              <div className="flex items-center gap-2">
                <Save className="h-3.5 w-3.5 text-[#22c55e]" />
                Salvo {savedAt}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Nome da fase
            </label>
            <input
              value={draft.title}
              onChange={(e) => persist({ title: e.target.value })}
              className="mb-6 w-full rounded-md border border-[#263345] bg-[#070b16] px-3 py-2 text-2xl font-black leading-snug text-white outline-none transition-colors placeholder:text-slate-600 hover:border-[#374151] focus:border-[#ff7a00] focus:ring-2 focus:ring-[#ff7a00]/20"
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
                    const assignee = assignableUsers.find(user => user.id === e.target.value);
                    persist({ assignee: assignee as User | undefined });
                  }}
                >
                  <option value="">Sem responsável</option>
                  {assignableUsers.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
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
                    type="number"
                    min="0"
                    step="0.5"
                    className={fieldClass}
                    value={draft.estimatedHours ?? draft.estimate ?? ''}
                    onChange={(e) => persist({ estimate: e.target.value, estimatedHours: Number(e.target.value) || 0 })}
                    placeholder="Horas"
                  />
                </label>
                <label>
                  <span className={labelClass}><Target className="h-4 w-4" /> Realizado</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className={fieldClass}
                    value={draft.actualHours ?? ''}
                    onChange={(e) => persist({ actualHours: Number(e.target.value) || 0 })}
                    placeholder="Horas"
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

            {/* Matriz RACI */}
            <div className="mb-8 rounded-lg border border-[#263345] bg-[#070b16] p-5">
              <RACIMatrix
                users={assignableUsers}
                value={{
                  responsibleIds: draft.responsibleIds || [],
                  accountableId: draft.accountableId || null,
                  consultedIds: draft.consultedIds || [],
                  informedIds: draft.informedIds || []
                }}
                onChange={(raciData) => persist(raciData)}
              />
            </div>

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

            {/* Matriz RACI - Resumo Visual */}
            <div className="mb-6 rounded-lg border border-[#263345] bg-[#111827] p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Matriz RACI</h4>
              
              {/* Responsible */}
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md border border-blue-500/30 bg-blue-500/10">
                    <span className="text-[10px] font-bold text-blue-400">R</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Responsável</span>
                </div>
                {(draft.responsibleIds && draft.responsibleIds.length > 0) ? (
                  <div className="flex flex-wrap gap-1.5 pl-7">
                    {draft.responsibleIds.map(userId => {
                      const user = assignableUsers.find(u => u.id === userId);
                      return user ? (
                        <div key={userId} className="flex items-center gap-1 rounded-md bg-[#070b16] border border-[#263345] px-2 py-0.5">
                          <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${user.color || 'bg-slate-600'}`}>
                            {user.initials}
                          </div>
                          <span className="text-[11px] text-slate-300">{user.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <p className="pl-7 text-[11px] italic text-slate-600">Nenhum responsável</p>
                )}
              </div>

              {/* Accountable */}
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md border border-purple-500/30 bg-purple-500/10">
                    <span className="text-[10px] font-bold text-purple-400">A</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Aprovador</span>
                </div>
                {draft.accountableId ? (
                  <div className="pl-7">
                    {(() => {
                      const user = assignableUsers.find(u => u.id === draft.accountableId);
                      return user ? (
                        <div className="inline-flex items-center gap-1 rounded-md bg-[#070b16] border border-[#263345] px-2 py-0.5">
                          <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${user.color || 'bg-slate-600'}`}>
                            {user.initials}
                          </div>
                          <span className="text-[11px] text-slate-300">{user.name}</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <p className="pl-7 text-[11px] italic text-slate-600">Nenhum aprovador</p>
                )}
              </div>

              {/* Consulted */}
              <div className="mb-3">
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md border border-green-500/30 bg-green-500/10">
                    <span className="text-[10px] font-bold text-green-400">C</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Consultado</span>
                </div>
                {(draft.consultedIds && draft.consultedIds.length > 0) ? (
                  <div className="flex flex-wrap gap-1.5 pl-7">
                    {draft.consultedIds.map(userId => {
                      const user = assignableUsers.find(u => u.id === userId);
                      return user ? (
                        <div key={userId} className="flex items-center gap-1 rounded-md bg-[#070b16] border border-[#263345] px-2 py-0.5">
                          <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${user.color || 'bg-slate-600'}`}>
                            {user.initials}
                          </div>
                          <span className="text-[11px] text-slate-300">{user.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <p className="pl-7 text-[11px] italic text-slate-600">Nenhum consultado</p>
                )}
              </div>

              {/* Informed */}
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md border border-orange-500/30 bg-orange-500/10">
                    <span className="text-[10px] font-bold text-orange-400">I</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-300">Informado</span>
                </div>
                {(draft.informedIds && draft.informedIds.length > 0) ? (
                  <div className="flex flex-wrap gap-1.5 pl-7">
                    {draft.informedIds.map(userId => {
                      const user = assignableUsers.find(u => u.id === userId);
                      return user ? (
                        <div key={userId} className="flex items-center gap-1 rounded-md bg-[#070b16] border border-[#263345] px-2 py-0.5">
                          <div className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${user.color || 'bg-slate-600'}`}>
                            {user.initials}
                          </div>
                          <span className="text-[11px] text-slate-300">{user.name}</span>
                        </div>
                      ) : null;
                    })}
                  </div>
                ) : (
                  <p className="pl-7 text-[11px] italic text-slate-600">Nenhum informado</p>
                )}
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
