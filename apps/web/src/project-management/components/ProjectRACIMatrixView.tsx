import React, { useState } from 'react';
import { Issue, User } from '../types';
import { CheckCircle2, User as UserIcon, MessageSquare, Bell, FileDown, ShieldAlert, Check } from 'lucide-react';
import { jsPDF } from 'jspdf';

export interface RaciDeliverableItem {
  id: string;
  escopo: string;
  situacaoBase?: string;
  raci?: Record<string, 'R' | 'A' | 'C' | 'I'>;
}

interface ProjectRACIMatrixViewProps {
  issues: Issue[];
  users: User[];
  onUpdateIssue: (issue: Issue) => void | Promise<void>;
  deliverables?: RaciDeliverableItem[];
  onUpdateDeliverableRaci?: (deliverableId: string, userId: string, role: 'R' | 'A' | 'C' | 'I' | null) => void | Promise<void>;
}

const roleStyles = {
  R: {
    label: 'Responsible (Responsável)',
    color: 'bg-blue-600 text-white border-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]',
    text: 'Executa a atividade',
    short: 'R'
  },
  A: {
    label: 'Accountable (Aprovador)',
    color: 'bg-purple-600 text-white border-purple-500 shadow-[0_0_8px_rgba(147,51,234,0.3)]',
    text: 'Dono final, aprova e responde',
    short: 'A'
  },
  C: {
    label: 'Consulted (Consultado)',
    color: 'bg-emerald-600 text-white border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]',
    text: 'Consultado antes de fazer',
    short: 'C'
  },
  I: {
    label: 'Informed (Informado)',
    color: 'bg-amber-600 text-white border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]',
    text: 'Informado dos resultados',
    short: 'I'
  }
};

export default function ProjectRACIMatrixView({
  issues,
  users,
  onUpdateIssue,
  deliverables = [],
  onUpdateDeliverableRaci
}: ProjectRACIMatrixViewProps) {
  const [activeCell, setActiveCell] = useState<{ issueId: string; userId: string } | null>(null);
  const [activeDeliverableCell, setActiveDeliverableCell] = useState<{ delId: string; userId: string } | null>(null);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const getRaciRole = (issue: Issue, userId: string): 'R' | 'A' | 'C' | 'I' | null => {
    if (issue.accountableId === userId) return 'A';
    if (issue.responsibleIds?.includes(userId)) return 'R';
    if (issue.consultedIds?.includes(userId)) return 'C';
    if (issue.informedIds?.includes(userId)) return 'I';
    return null;
  };

  const handleSetRole = async (issue: Issue, userId: string, role: 'R' | 'A' | 'C' | 'I' | null) => {
    const updated = { ...issue };
    
    // 1. Remove user from all lists
    updated.responsibleIds = (updated.responsibleIds || []).filter(id => id !== userId);
    if (updated.accountableId === userId) updated.accountableId = null;
    updated.consultedIds = (updated.consultedIds || []).filter(id => id !== userId);
    updated.informedIds = (updated.informedIds || []).filter(id => id !== userId);

    // 2. Add to the new list if selected
    if (role === 'A') {
      updated.accountableId = userId;
    } else if (role === 'R') {
      updated.responsibleIds = [...(updated.responsibleIds || []), userId];
    } else if (role === 'C') {
      updated.consultedIds = [...(updated.consultedIds || []), userId];
    } else if (role === 'I') {
      updated.informedIds = [...(updated.informedIds || []), userId];
    }

    // 3. Save
    await onUpdateIssue(updated);
    setActiveCell(null);
  };

  const exportToPDF = () => {
    setIsExportingPDF(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4'); // landscape
      const margin = 15;
      
      // Clean light white background
      pdf.setFillColor(253, 254, 255);
      pdf.rect(0, 0, 297, 210, 'F');

      // Top decorative bar
      pdf.setFillColor(255, 122, 0);
      pdf.rect(0, 0, 297, 4, 'F');

      // Header Title
      pdf.setTextColor(15, 23, 42); // slate-900
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Matriz RACI do Projeto', margin, 22);

      // Subtitle
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.setFontSize(9.5);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Mapeamento de papeis e responsabilidades: [R] Responsavel, [A] Aprovador, [C] Consultado, [I] Informado.', margin, 28);

      // Divider Line
      pdf.setDrawColor(226, 232, 240); // slate-200
      pdf.setLineWidth(0.5);
      pdf.line(margin, 32, 297 - margin, 32);

      let yPos = 40;
      
      // Table Header Background (dark blue slate)
      pdf.setFillColor(15, 23, 42);
      pdf.rect(margin, yPos, 267, 12, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.text('Fase do Projeto / Entregavel', margin + 4, yPos + 7.5);

      // User column headers
      const colWidth = 26;
      const startX = margin + 110;
      
      users.slice(0, 6).forEach((user, idx) => {
        const x = startX + idx * colWidth;
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        pdf.text(user.name.split(' ')[0].substring(0, 12), x + 2, yPos + 7.5);
      });

      yPos += 12;

      // Draw Rows
      issues.forEach((issue, idx) => {
        if (yPos > 175) {
          pdf.addPage('l', 'mm', 'a4');
          pdf.setFillColor(253, 254, 255);
          pdf.rect(0, 0, 297, 210, 'F');
          
          pdf.setFillColor(255, 122, 0);
          pdf.rect(0, 0, 297, 4, 'F');
          
          // Re-draw header on new page
          yPos = 20;
          pdf.setFillColor(15, 23, 42);
          pdf.rect(margin, yPos, 267, 12, 'F');
          
          pdf.setTextColor(255, 255, 255);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9.5);
          pdf.text('Fase do Projeto / Entregavel', margin + 4, yPos + 7.5);
          
          users.slice(0, 6).forEach((user, uIdx) => {
            const x = startX + uIdx * colWidth;
            pdf.text(user.name.split(' ')[0].substring(0, 12), x + 2, yPos + 7.5);
          });
          
          yPos += 12;
        }

        // Alternating row background
        if (idx % 2 === 0) {
          pdf.setFillColor(248, 250, 252); // slate-50
        } else {
          pdf.setFillColor(255, 255, 255);
        }
        pdf.rect(margin, yPos, 267, 11, 'F');
        
        pdf.setDrawColor(226, 232, 240); // slate-200
        pdf.rect(margin, yPos, 267, 11);

        pdf.setTextColor(15, 23, 42); // slate-900
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8.5);
        
        const keyPrefix = issue.key ? `[${issue.key}] ` : '';
        const rawTitle = `${keyPrefix}${issue.title}`;
        pdf.text(rawTitle.substring(0, 48), margin + 4, yPos + 7);

        users.slice(0, 6).forEach((user, colIdx) => {
          const x = startX + colIdx * colWidth;
          const role = getRaciRole(issue, user.id);
          
          if (role) {
            // Circle color code matching styles
            // R: Blue (59, 130, 246), A: Purple (147, 51, 234), C: Green (16, 185, 129), I: Orange (245, 158, 11)
            let r = 59, g = 130, b = 246;
            if (role === 'A') { r = 147; g = 51; b = 234; }
            else if (role === 'C') { r = 16; g = 185; b = 129; }
            else if (role === 'I') { r = 245; g = 158; b = 11; }
            
            pdf.setFillColor(r, g, b);
            pdf.circle(x + colWidth / 2 - 1, yPos + 5.5, 3.2, 'F');
            
            pdf.setTextColor(255, 255, 255);
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(8);
            pdf.text(role, x + colWidth / 2 - 2, yPos + 6.5);
          } else {
            pdf.setTextColor(148, 163, 184); // slate-400
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            pdf.text('-', x + colWidth / 2 - 1.5, yPos + 6.5);
          }
        });

        yPos += 11;
      });

      // Bottom Legend Indicator Box
      yPos += 8;
      if (yPos > 190) {
        pdf.addPage('l', 'mm', 'a4');
        pdf.setFillColor(253, 254, 255);
        pdf.rect(0, 0, 297, 210, 'F');
        
        pdf.setFillColor(255, 122, 0);
        pdf.rect(0, 0, 297, 4, 'F');
        yPos = 20;
      }

      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, yPos, 267, 10, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(margin, yPos, 267, 10);
      
      pdf.setTextColor(71, 85, 105); // slate-600
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.text('LEGENDA GERAL DA MATRIZ RACI:', margin + 4, yPos + 6.5);
      
      pdf.setFont('helvetica', 'normal');
      pdf.text('R: Responsavel (Executa)    |    A: Aprovador (Dono final)    |    C: Consultado (Apoio tecnico)    |    I: Informado (Notificado)', margin + 64, yPos + 6.5);

      // Page numbers footer
      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setTextColor(148, 153, 160);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Pagina ${i} de ${totalPages}`, 260, 202);
        pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} por PMO Inteligente`, margin, 202);
      }

      pdf.save(`Matriz_RACI_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error('Erro ao gerar PDF da RACI:', error);
      alert('Ocorreu um erro ao exportar a Matriz RACI para PDF.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="h-full bg-transparent flex flex-col text-[var(--crm-ink)]">
      <div className="flex-1 overflow-auto p-6 space-y-6">
        
        {/* Top Header Card */}
        <div className="relative overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] px-6 py-5">
          <div className="absolute right-10 top-0 h-24 w-24 rounded-full bg-[#2563eb]/10 blur-2xl" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-2">
                📋 Matriz RACI do Projeto
              </h2>
              <p className="mt-1 text-xs text-[var(--crm-muted)] max-w-2xl leading-relaxed">
                Ferramenta de gestão usada para definir e esclarecer papéis e responsabilidades para cada fase e atividade do projeto. 
                Garante que não haja conflitos de liderança e que toda a equipe saiba exatamente o seu papel.
              </p>
            </div>
            <button
              onClick={exportToPDF}
              disabled={isExportingPDF || issues.length === 0}
              className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] font-black text-xs px-4 py-2 rounded-md shadow-[0_0_15px_rgba(37,99,235,0.15)] transition-colors self-start sm:self-center disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              {isExportingPDF ? 'Gerando PDF...' : 'Visualizar em PDF'}
            </button>
          </div>
        </div>

        {/* Legend Indicator */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-[rgb(var(--crm-surface-2-rgb)/0.4)] border border-[var(--crm-border)] rounded-lg p-3">
          {Object.entries(roleStyles).map(([key, style]) => (
            <div key={key} className="flex gap-2.5 items-start p-2.5 rounded border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.3)]">
              <span className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs flex-shrink-0 ${style.color}`}>
                {key}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black text-[var(--crm-ink)]">{style.label.split(' (')[0]}</p>
                <p className="text-[10px] text-[var(--crm-muted)] leading-tight truncate">{style.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Matrix Main Grid Table */}
        <div className="border border-[var(--crm-border)] rounded-xl overflow-hidden bg-[var(--crm-surface)]/90 backdrop-blur-md">
          {(issues.length > 0 || deliverables.length > 0) && users.length > 0 ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.6)]">
                    <th className="py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-[var(--crm-muted)] min-w-[280px]">
                      Entregável / Fase do Projeto
                    </th>
                    {users.map((user) => (
                      <th key={user.id} className="py-3 px-3 text-center min-w-[115px]">
                        <div className="flex flex-col items-center gap-1">
                          <span className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black text-white" style={{ backgroundColor: user.color || '#2563eb' }}>
                            {user.initials}
                          </span>
                          <span className="text-[11px] font-bold text-[var(--crm-ink)] truncate max-w-[110px]">{user.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--crm-border)]/50">
                  {deliverables.length > 0 && (
                    <tr className="bg-[#0f2744]/50">
                      <td colSpan={users.length + 1} className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-[#7db3db]">
                        Entregáveis do Escopo ({deliverables.length})
                      </td>
                    </tr>
                  )}
                  {deliverables.map((del) => (
                    <tr key={`del-${del.id}`} className="hover:bg-[var(--crm-surface-2)]/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 text-[10px] font-black text-cyan-400">
                            {del.id}
                          </span>
                          <span className="text-xs font-semibold text-[var(--crm-ink)]">{del.escopo}</span>
                        </div>
                        {del.situacaoBase && (
                          <div className="mt-0.5 text-[10px] text-[var(--crm-muted)]">{del.situacaoBase}</div>
                        )}
                      </td>
                      {users.map((user) => {
                        const role = del.raci?.[user.id] || null;
                        const isOpen = activeDeliverableCell?.delId === del.id && activeDeliverableCell?.userId === user.id;
                        return (
                          <td key={user.id} className="py-2 px-3 text-center relative">
                            <button
                              type="button"
                              onClick={() => setActiveDeliverableCell(isOpen ? null : { delId: del.id, userId: user.id })}
                              className={`w-8 h-8 rounded-md text-xs font-black border transition-all ${
                                role
                                  ? roleStyles[role].color
                                  : 'border-dashed border-[var(--crm-border)] text-[var(--crm-muted)] hover:border-[#38bdf8]'
                              }`}
                            >
                              {role || '—'}
                            </button>
                            {isOpen && onUpdateDeliverableRaci && (
                              <div className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 flex gap-1 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-1.5 shadow-xl">
                                {(['R', 'A', 'C', 'I'] as const).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => {
                                      onUpdateDeliverableRaci(del.id, user.id, r);
                                      setActiveDeliverableCell(null);
                                    }}
                                    className={`w-6 h-6 rounded text-[11px] font-black ${roleStyles[r].color}`}
                                  >
                                    {r}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    onUpdateDeliverableRaci(del.id, user.id, null);
                                    setActiveDeliverableCell(null);
                                  }}
                                  className="px-1.5 rounded text-[10px] font-bold text-[var(--crm-muted)] hover:text-red-400"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {issues.length > 0 && (
                    <tr className="bg-[#0f2744]/30">
                      <td colSpan={users.length + 1} className="px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-300">
                        Fases e Ações do Projeto ({issues.length})
                      </td>
                    </tr>
                  )}
                  {issues.map((issue) => (
                    <tr key={issue.id} className="hover:bg-[var(--crm-surface-2)]/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="text-xs font-semibold text-[var(--crm-ink)]">{issue.title}</div>
                      </td>
                      {users.map((user) => {
                        const role = getRaciRole(issue, user.id);
                        const isOpen = activeCell?.issueId === issue.id && activeCell?.userId === user.id;
                        return (
                          <td key={user.id} className="py-2 px-3 text-center relative">
                            <button
                              type="button"
                              onClick={() => setActiveCell(isOpen ? null : { issueId: issue.id, userId: user.id })}
                              className={`w-8 h-8 rounded-md text-xs font-black border transition-all ${
                                role
                                  ? roleStyles[role].color
                                  : 'border-dashed border-[var(--crm-border)] text-[var(--crm-muted)] hover:border-[#38bdf8]'
                              }`}
                            >
                              {role || '—'}
                            </button>
                            {isOpen && (
                              <div className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 flex gap-1 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-1.5 shadow-xl">
                                {(['R', 'A', 'C', 'I'] as const).map((r) => (
                                  <button
                                    key={r}
                                    type="button"
                                    onClick={() => handleSetRole(issue, user.id, r)}
                                    className={`w-6 h-6 rounded text-[11px] font-black ${roleStyles[r].color}`}
                                  >
                                    {r}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => handleSetRole(issue, user.id, null)}
                                  className="px-1.5 rounded text-[10px] font-bold text-[var(--crm-muted)] hover:text-red-400"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-[var(--crm-muted)]">
              Adicione entregáveis ou membros na equipe para visualizar a Matriz RACI.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
