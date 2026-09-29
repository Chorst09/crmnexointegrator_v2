import React, { useEffect, useState } from 'react';
import {
  Home, CheckCircle2, FileText, LayoutTemplate, Clock, Calendar,
  Search, Plus, Filter, List, Sparkles, ArrowLeft,
  BarChart2, Briefcase, Users, ArrowUpRight, Target, GitBranch, AlertTriangle,
  ClipboardCheck, Lightbulb, Gauge, TimerReset, Route, Wand2, Trash2, Save,
  Upload, Download, Eye, Pencil, FileDown
} from 'lucide-react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';
import { jsPDF } from 'jspdf';
import ArchitectureDiagram from './ArchitectureDiagram';
import type { Issue, ProjectTeamMember, Space } from '../types';
import { buildApiUrl, getAuthHeaders } from '../../config/api';

const projectStatusLabel: Record<string, string> = {
  PLANEJADO: 'Planejado',
  EM_ANDAMENTO: 'Em andamento',
  PAUSADO: 'Pausado',
  CONCLUIDO: 'Concluido',
  CANCELADO: 'Cancelado'
};

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toNumber(value: unknown) {
  const parsed = typeof value === 'number'
    ? value
    : Number(String(value || '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatProjectDate(value?: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
}

function formatCurrency(value?: string) {
  const amount = toNumber(value);
  if (!amount) return '-';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function slugify(value: string) {
  return String(value || 'projeto')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'projeto';
}

function paragraph(value?: string) {
  const text = String(value || '').trim();
  if (!text) return '<p class="muted">Nao informado.</p>';
  return `<p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`;
}

function tableRows(rows: string[], emptyLabel: string) {
  if (rows.length === 0) {
    return `<tr><td colspan="6" class="muted center">${escapeHtml(emptyLabel)}</td></tr>`;
  }
  return rows.join('');
}

function buildProjectPdfHtml({
  project,
  issues,
  teamMembers,
  totalEstimated,
  completedCount,
  progress,
  fileName
}: {
  project: Space;
  issues: Issue[];
  teamMembers: ProjectTeamMember[];
  totalEstimated: number;
  completedCount: number;
  progress: number;
  fileName: string;
}) {
  const generatedAt = new Date().toLocaleString('pt-BR');
  const activeIssues = issues.filter(issue => issue.status !== 'CANCELADO');
  const riskIssues = issues.filter(issue => issue.status === 'EM RISCO' || issue.priority === 'Urgente');
  const unassignedIssues = issues.filter(issue => !issue.assignee?.id);
  const projectLabel = projectStatusLabel[project.status || ''] || project.status || 'Planejado';

  const teamRows = tableRows(teamMembers.map(member => `
    <tr>
      <td>${escapeHtml(member.user?.name || 'Usuario sem nome')}</td>
      <td>${escapeHtml(member.user?.email || '-')}</td>
      <td>${escapeHtml(member.role || 'Membro')}</td>
      <td>${escapeHtml(`${member.allocationPercent ?? 100}%`)}</td>
      <td>${formatProjectDate(member.startDate || member.createdAt)}</td>
      <td>${member.isActive === false ? 'Inativo' : 'Ativo'}</td>
    </tr>
  `), 'Nenhum membro ativo informado.');

  const issueRows = tableRows(issues.map((issue, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <strong>${escapeHtml(issue.title)}</strong>
        ${issue.description ? `<div class="small">${escapeHtml(issue.description)}</div>` : ''}
      </td>
      <td>${escapeHtml(issue.sourceType === 'task' ? 'Tarefa' : 'Fase')}</td>
      <td>${escapeHtml(issue.status)}</td>
      <td>${escapeHtml(issue.assignee?.name || 'Nao atribuido')}</td>
      <td>${escapeHtml(`${toNumber(issue.estimatedHours || issue.estimate)}h`)}</td>
    </tr>
  `), 'Nenhuma fase ou tarefa encontrada.');

  const riskRows = tableRows(riskIssues.map(issue => `
    <tr>
      <td>${escapeHtml(issue.title)}</td>
      <td>${escapeHtml(issue.status)}</td>
      <td>${escapeHtml(issue.priority)}</td>
      <td>${escapeHtml(issue.assignee?.name || 'Nao atribuido')}</td>
      <td>${formatProjectDate(issue.dueDate)}</td>
      <td>${escapeHtml(issue.description || '-')}</td>
    </tr>
  `), 'Nenhum risco ou item urgente identificado.');

  const GANTT_STATUS_COLORS: Record<string, string> = {
    'PENDENTE': '#94a3b8', 'PLANEJAMENTO': '#18c8df', 'EM PROGRESSO': '#ff7a00',
    'EM RISCO': '#f59e0b', 'ATUALIZAÇÃO NECESSÁRIA': '#facc15', 'EM ESPERA': '#a78bfa',
    'CONCLUÍDO': '#22c55e', 'CANCELADO': '#f87171',
  };
  const GANTT_STATUS_PROGRESS: Record<string, number> = {
    'PENDENTE': 8, 'PLANEJAMENTO': 18, 'EM PROGRESSO': 58, 'EM RISCO': 42,
    'ATUALIZAÇÃO NECESSÁRIA': 34, 'EM ESPERA': 28, 'CONCLUÍDO': 100, 'CANCELADO': 100,
  };
  const ganttIssues = activeIssues.filter(i => i.startDate || i.dueDate);
  let ganttMonthHeaders = '';
  let ganttRowsHtml = '';
  let ganttHtml = '';

  if (ganttIssues.length > 0) {
    const parseD = (v?: string | null) => { if (!v) return null; const d = new Date(v); return isNaN(d.getTime()) ? null : d; };
    const allStarts = ganttIssues.map(i => parseD(i.startDate)).filter(Boolean) as Date[];
    const allEnds = ganttIssues.map(i => parseD(i.dueDate)).filter(Boolean) as Date[];
    const minDate = new Date(Math.min(...allStarts.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allEnds.map(d => d.getTime())));
    minDate.setDate(minDate.getDate() - 3);
    maxDate.setDate(maxDate.getDate() + 3);
    const totalMs = maxDate.getTime() - minDate.getTime() || 1;

    const months: { label: string; startMs: number; endMs: number }[] = [];
    const cursor = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    while (cursor <= maxDate) {
      const mStart = new Date(Math.max(cursor.getTime(), minDate.getTime()));
      const mEndMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const mEnd = new Date(Math.min(mEndMonth.getTime(), maxDate.getTime()));
      if (mEnd > mStart) {
        months.push({
          label: cursor.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
          startMs: mStart.getTime() - minDate.getTime(),
          endMs: mEnd.getTime() - minDate.getTime(),
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    ganttMonthHeaders = months.map(m => {
      const leftPct = ((m.startMs / totalMs) * 100).toFixed(2);
      const widthPct = (((m.endMs - m.startMs) / totalMs) * 100).toFixed(2);
      return `<div style="position:absolute;top:0;bottom:0;left:${leftPct}%;width:${widthPct}%;padding:4px 6px;border-right:1px solid #dbe3ee;font-size:9px;font-weight:700;color:#64748b;text-transform:capitalize;white-space:nowrap;overflow:hidden;">${escapeHtml(m.label)}</div>`;
    }).join('');

    ganttRowsHtml = ganttIssues.map(issue => {
      const s = parseD(issue.startDate) || parseD(issue.dueDate) || minDate;
      const e = parseD(issue.dueDate) || parseD(issue.startDate) || minDate;
      const leftPct = Math.max(((s.getTime() - minDate.getTime()) / totalMs) * 100, 0);
      const widthPct = Math.max(((e.getTime() - s.getTime()) / totalMs) * 100, 1.5);
      const color = GANTT_STATUS_COLORS[issue.status] || '#94a3b8';
      const pct = GANTT_STATUS_PROGRESS[issue.status] ?? 0;
      return `<div class="gantt-row">
        <div class="gantt-label" title="${escapeHtml(issue.title)}">${escapeHtml(issue.title)}</div>
        <div class="gantt-bar-wrap">
          <div class="gantt-bar" style="left:${leftPct.toFixed(2)}%;width:${widthPct.toFixed(2)}%;background:${color}40;border:1.5px solid ${color};">
            <span class="bar-label">${escapeHtml(issue.title)}</span>
            <span class="bar-pct">${pct}%</span>
          </div>
        </div>
      </div>`;
    }).join('');

    ganttHtml = `
    <section>
      <h2>Cronograma do projeto (Gantt)</h2>
      <div class="gantt-container">
        <div class="gantt-header"><span class="icon">&#9654;</span> Cronograma</div>
        <div style="position:relative;height:22px;border-bottom:1px solid #dbe3ee;background:#f8fafc;">
          <div style="position:absolute;left:160px;top:0;bottom:0;right:0;">${ganttMonthHeaders}</div>
        </div>
        <div>${ganttRowsHtml}</div>
        <div class="gantt-legend">
          <span><i style="background:#18c8df"></i> Planejamento</span>
          <span><i style="background:#ff7a00"></i> Em andamento</span>
          <span><i style="background:#22c55e"></i> Concluido</span>
          <span><i style="background:#f59e0b"></i> Em risco</span>
          <span><i style="background:#a78bfa"></i> Em espera</span>
          <span><i style="background:#94a3b8"></i> Pendente</span>
        </div>
      </div>
    </section>`;
  }

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(fileName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #e5e7eb; color: #111827; font-family: Arial, Helvetica, sans-serif; }
    .toolbar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 12px 18px; background: #111827; color: #f8fafc; box-shadow: 0 4px 18px rgba(15,23,42,.18); }
    .toolbar strong { font-size: 14px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    button { border: 0; border-radius: 6px; padding: 9px 12px; font-weight: 800; cursor: pointer; }
    .primary { background: #ff7a00; color: #fff; }
    .secondary { background: #263345; color: #fff; }
    .page { width: 210mm; min-height: 297mm; margin: 18px auto; padding: 18mm; background: #fff; box-shadow: 0 20px 45px rgba(15,23,42,.2); }
    .hero { border-bottom: 4px solid #ff7a00; padding-bottom: 18px; margin-bottom: 18px; }
    .eyebrow { color: #ff7a00; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 6px 0 4px; font-size: 30px; line-height: 1.1; color: #0f172a; }
    h2 { margin: 22px 0 10px; font-size: 17px; color: #0f172a; border-bottom: 1px solid #dbe3ee; padding-bottom: 7px; }
    p { margin: 0; line-height: 1.55; }
    .muted { color: #64748b; }
    .small { margin-top: 4px; color: #64748b; font-size: 11px; line-height: 1.4; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 16px 0; }
    .metric { border: 1px solid #dbe3ee; border-radius: 8px; padding: 10px; background: #f8fafc; }
    .metric span { display: block; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    .metric strong { display: block; margin-top: 5px; color: #0f172a; font-size: 18px; }
    .info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 18px; margin-top: 14px; font-size: 12px; }
    .info div { border-bottom: 1px solid #eef2f7; padding-bottom: 7px; }
    .info span { display: block; color: #64748b; font-size: 10px; font-weight: 800; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
    th { background: #111827; color: #f8fafc; text-align: left; padding: 8px; font-size: 10px; text-transform: uppercase; }
    td { border: 1px solid #dbe3ee; padding: 8px; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .center { text-align: center; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #dbe3ee; display: flex; justify-content: space-between; color: #64748b; font-size: 10px; }
    .gantt-container { margin-top: 16px; border: 1px solid #dbe3ee; border-radius: 8px; overflow: hidden; }
    .gantt-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #111827; color: #f8fafc; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
    .gantt-header .icon { color: #ff7a00; }
    .gantt-months { display: flex; border-bottom: 1px solid #dbe3ee; background: #f8fafc; }
    .gantt-months div { padding: 4px 6px; font-size: 9px; font-weight: 700; color: #64748b; text-transform: capitalize; border-right: 1px solid #dbe3ee; white-space: nowrap; overflow: hidden; }
    .gantt-row { display: flex; align-items: center; border-bottom: 1px solid #f1f5f9; height: 34px; }
    .gantt-row:nth-child(even) { background: #f8fafc; }
    .gantt-label { width: 160px; min-width: 160px; padding: 0 8px; font-size: 10px; font-weight: 600; color: #334155; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border-right: 1px solid #dbe3ee; }
    .gantt-bar-wrap { flex: 1; position: relative; height: 100%; }
    .gantt-bar { position: absolute; top: 8px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: space-between; padding: 0 6px; font-size: 8px; font-weight: 700; color: #fff; overflow: hidden; white-space: nowrap; }
    .gantt-bar .bar-label { overflow: hidden; text-overflow: ellipsis; }
    .gantt-bar .bar-pct { opacity: .85; flex-shrink: 0; margin-left: 4px; }
    .gantt-empty { padding: 18px; text-align: center; color: #94a3b8; font-size: 11px; }
    .gantt-legend { display: flex; gap: 12px; padding: 6px 12px; background: #f8fafc; border-top: 1px solid #dbe3ee; font-size: 9px; color: #64748b; }
    .gantt-legend span { display: flex; align-items: center; gap: 4px; }
    .gantt-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; }
    @page { size: A4 landscape; margin: 10mm; }
    @media print {
      body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .toolbar { display: none; }
      .page { width: auto; min-height: auto; margin: 0; padding: 0; box-shadow: none; }
      h2 { break-after: avoid; }
      table, .metric, .info div { break-inside: avoid; }
      .gantt-container { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <strong>Visualizacao PDF - ${escapeHtml(project.name)}</strong>
    <div class="actions">
      <button class="secondary" onclick="window.close()">Fechar</button>
      <button class="primary" onclick="window.print()">Imprimir / Salvar PDF</button>
    </div>
  </div>

  <main class="page">
    <section class="hero">
      <div class="eyebrow">Relatorio completo do projeto</div>
      <h1>${escapeHtml(project.name)}</h1>
      <p class="muted">${escapeHtml(project.client || 'Cliente nao informado')}</p>
      <div class="info">
        <div><span>Numero</span>${escapeHtml(project.number || '-')}</div>
        <div><span>Status</span>${escapeHtml(projectLabel)}</div>
        <div><span>Tipo</span>${escapeHtml(project.type || '-')}</div>
        <div><span>Gestor</span>${escapeHtml(project.manager || '-')}</div>
        <div><span>Patrocinador</span>${escapeHtml(project.sponsor || '-')}</div>
        <div><span>Periodo</span>${formatProjectDate(project.startDate)} a ${formatProjectDate(project.endDate)}</div>
        <div><span>Orcamento</span>${formatCurrency(project.budget)}</div>
        <div><span>Gerado em</span>${escapeHtml(generatedAt)}</div>
      </div>
    </section>

    <section class="grid">
      <div class="metric"><span>Progresso</span><strong>${progress}%</strong></div>
      <div class="metric"><span>Fases/Tarefas</span><strong>${issues.length}</strong></div>
      <div class="metric"><span>Concluidos</span><strong>${completedCount}</strong></div>
      <div class="metric"><span>Horas estimadas</span><strong>${totalEstimated}h</strong></div>
      <div class="metric"><span>Itens ativos</span><strong>${activeIssues.length}</strong></div>
      <div class="metric"><span>Nao atribuidos</span><strong>${unassignedIssues.length}</strong></div>
      <div class="metric"><span>Riscos/Urgentes</span><strong>${riskIssues.length}</strong></div>
      <div class="metric"><span>Equipe</span><strong>${teamMembers.length}</strong></div>
    </section>

    <section>
      <h2>Objetivo</h2>
      ${paragraph(project.objective)}
    </section>

    <section>
      <h2>Escopo</h2>
      ${paragraph(project.scope)}
    </section>

    <section class="two-col">
      <div>
        <h2>Entregaveis</h2>
        ${paragraph(project.deliverables)}
      </div>
      <div>
        <h2>Criterios de sucesso</h2>
        ${paragraph(project.successCriteria)}
      </div>
    </section>

    <section class="two-col">
      <div>
        <h2>Riscos informados</h2>
        ${paragraph(project.risks)}
      </div>
      <div>
        <h2>Observacoes</h2>
        ${paragraph(project.notes)}
      </div>
    </section>

    <section>
      <h2>Equipe do projeto</h2>
      <table>
        <thead>
          <tr><th>Membro</th><th>E-mail</th><th>Funcao</th><th>Alocacao</th><th>Entrada</th><th>Status</th></tr>
        </thead>
        <tbody>${teamRows}</tbody>
      </table>
    </section>

    <section>
      <h2>Fases e tarefas vinculadas</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Item</th><th>Tipo</th><th>Status</th><th>Responsavel</th><th>Horas</th></tr>
        </thead>
        <tbody>${issueRows}</tbody>
      </table>
    </section>

    ${ganttHtml}

    <section>
      <h2>Riscos e urgencias</h2>
      <table>
        <thead>
          <tr><th>Item</th><th>Status</th><th>Prioridade</th><th>Responsavel</th><th>Prazo</th><th>Descricao</th></tr>
        </thead>
        <tbody>${riskRows}</tbody>
      </table>
    </section>

    <div class="footer">
      <span>Nexos Integrator - Gestao de Projetos</span>
      <span>${escapeHtml(fileName)}</span>
    </div>
  </main>
</body>
</html>`;
}

export function HomeView({
  projects = [],
  issues = [],
  getPhaseCount,
  onCreateProject,
  onOpenDashboard,
  onEditProject,
  onDeleteProject
}: {
  projects?: Space[];
  issues?: Issue[];
  getPhaseCount?: (projectId: string) => number;
  onCreateProject?: () => void;
  onOpenDashboard?: () => void;
  onEditProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
}) {
  const openProjectPdfPreview = (project: Space) => {
    const projectIssues = issues
      .filter((issue) => issue.projectId === project.id)
      .sort((a, b) => {
        const dateA = new Date(a.startDate || a.createdAt || 0).getTime();
        const dateB = new Date(b.startDate || b.createdAt || 0).getTime();
        return dateA - dateB;
      });

    const teamMembers = (project.teamMembers || []).filter((member) => member.isActive !== false);
    const totalEstimated = projectIssues.reduce((total, issue) => total + toNumber(issue.estimatedHours || issue.estimate), 0);
    const completedCount = projectIssues.filter((issue) => issue.status === 'CONCLUÍDO').length;
    const progress = projectIssues.length > 0 ? Math.round((completedCount / projectIssues.length) * 100) : 0;
    const fileName = `${slugify(project.name || 'projeto')}-relatorio.pdf`;
    const preview = window.open('', '_blank');

    if (!preview) {
      alert('Não foi possível abrir a visualização em PDF. Libere pop-ups e tente novamente.');
      return;
    }

    preview.document.write(buildProjectPdfHtml({
      project,
      issues: projectIssues,
      teamMembers,
      totalEstimated,
      completedCount,
      progress,
      fileName
    }));
    preview.document.close();
    preview.focus();
  };

  return (
    <div className="h-full bg-[#070b16] overflow-y-auto p-8 text-slate-300 custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Home className="w-6 h-6 text-[#ff7a00]" />
            Início
          </h1>
          <div className="hidden items-center gap-2 rounded-full border border-[#263345] bg-[#111827] px-4 py-2 text-xs font-semibold text-slate-400 md:flex">
            <Sparkles className="h-4 w-4 text-[#18c8df]" />
            Central executiva de projetos
          </div>
        </div>

        <section className="relative min-h-[300px] overflow-hidden rounded-lg border border-[#263345] bg-[#111827]">
          <img
            src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80"
            alt="Equipe em sala de planejamento de projetos"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,#070b16_0%,rgba(7,11,22,0.92)_34%,rgba(7,11,22,0.58)_100%)]" />
          <div className="relative z-10 grid min-h-[300px] gap-6 p-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex max-w-3xl flex-col justify-center">
              <span className="mb-4 flex w-fit items-center gap-2 rounded-full border border-[#ff7a00]/35 bg-[#ff7a00]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#ffb15c]">
                <Briefcase className="h-3.5 w-3.5" />
                Gestão de Projetos
              </span>
              <h2 className="text-4xl font-black leading-tight text-white">
                Todos os projetos existentes em uma visão única.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
                Visualize, edite ou exclua projetos sem misturar fases entre iniciativas.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onCreateProject}
                  className="flex items-center gap-2 rounded-md bg-[#ff7a00] px-5 py-2.5 text-sm font-black text-white transition-colors hover:bg-[#f6b40b] hover:text-[#050914]"
                >
                  <Plus className="h-4 w-4" />
                  Novo projeto
                </button>
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="flex items-center gap-2 rounded-md border border-[#374151] bg-[#111827]/80 px-5 py-2.5 text-sm font-bold text-slate-200 transition-colors hover:border-[#ff7a00] hover:text-white"
                >
                  <BarChart2 className="h-4 w-4 text-[#22c55e]" />
                  Ver painel
                </button>
              </div>
            </div>

            <div className="grid content-center gap-3">
              <div className="grid grid-cols-3 gap-3">
                {[
                  [String(projects.length), 'Projetos', '#22c55e'],
                  [String(projects.reduce((total, project) => total + (getPhaseCount?.(project.id) || 0), 0)), 'Fases', '#f6b40b'],
                  [String(projects.filter(project => project.status === 'EM_ANDAMENTO').length), 'Em andamento', '#18c8df']
                ].map(([value, label, color]) => (
                  <div key={label} className="rounded-lg border border-[#263345] bg-[#070b16]/80 p-4 backdrop-blur">
                    <p className="text-2xl font-black text-white" style={{ color }}>{value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[#263345] bg-[#070b16]/85 p-5 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-slate-100">Projeto em destaque</p>
                    <p className="text-xs text-slate-500">{projects[0]?.client || projects[0]?.name || 'Nenhum projeto cadastrado'}</p>
                  </div>
                  <span className="rounded-full bg-[#22c55e]/10 px-3 py-1 text-xs font-bold text-[#22c55e]">{projects[0]?.status || 'Novo'}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#1f2937]">
                  <div className="h-full w-[68%] rounded-full bg-[linear-gradient(90deg,#ff7a00,#f6b40b,#22c55e)]" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="font-black text-slate-100">{projects[0]?.type || '-'}</p>
                    <p className="text-slate-500">Tipo</p>
                  </div>
                  <div>
                    <p className="font-black text-slate-100">{projects[0] ? getPhaseCount?.(projects[0].id) || 0 : 0}</p>
                    <p className="text-slate-500">Fases</p>
                  </div>
                  <div>
                    <p className="font-black text-slate-100">{projects[0]?.manager || '-'}</p>
                    <p className="text-slate-500">Gestor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[#263345] bg-[#111827]">
          <div className="flex flex-col gap-3 border-b border-[#263345] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-100">Relação de projetos</h2>
              <p className="mt-1 text-sm text-slate-500">{projects.length} projeto{projects.length !== 1 ? 's' : ''} encontrado{projects.length !== 1 ? 's' : ''}.</p>
            </div>
            <button
              type="button"
              onClick={onCreateProject}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff7a00] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#f6b40b] hover:text-[#050914]"
            >
              <Plus className="h-4 w-4" />
              Novo projeto
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="p-10 text-center">
              <Briefcase className="mx-auto mb-3 h-10 w-10 text-[#ff7a00]" />
              <h3 className="text-base font-black text-slate-100">Nenhum projeto cadastrado</h3>
              <p className="mt-2 text-sm text-slate-500">Crie o primeiro projeto para iniciar o planejamento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-[#263345] text-[11px] font-black uppercase tracking-wide text-[#8f9caf]">
                  <tr>
                    <th className="px-5 py-3">Projeto</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Fases</th>
                    <th className="px-5 py-3">Gestor</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#263345]">
                  {projects.map((project) => (
                    <tr key={project.id} className="transition-colors hover:bg-[#0d1423]">
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-black text-white ${project.color}`}>
                            {project.initial}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-black text-slate-100">{project.name}</p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">{project.number || project.type || 'Projeto'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-300">{project.client || 'Nao informado'}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-[#ff7a00]/35 bg-[#ff7a00]/10 px-2.5 py-1 text-[11px] font-black text-[#ffb15c]">
                          {project.status || 'PLANEJADO'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-[#22c55e]">{getPhaseCount?.(project.id) || 0}</td>
                      <td className="px-5 py-4 text-slate-300">{project.manager || 'Nao definido'}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              openProjectPdfPreview(project);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[#374151] bg-[#070b16] px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:border-[#18c8df] hover:text-white"
                          >
                            <Eye className="h-3.5 w-3.5 text-[#18c8df]" />
                            Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditProject?.(project.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[#374151] bg-[#070b16] px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:border-[#f6b40b] hover:text-white"
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#f6b40b]" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject?.(project.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[#374151] bg-[#070b16] px-3 py-1.5 text-xs font-bold text-slate-200 transition-colors hover:border-red-500 hover:text-white"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-400" />
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          {[
            { icon: Target, title: 'Escopo claro', text: 'Cada projeto começa com objetivo, escopo, entregáveis, critérios de sucesso e responsáveis.', color: 'text-[#ff7a00]' },
            { icon: Users, title: 'Equipe conectada', text: 'Convites por e-mail, papéis definidos e acompanhamento das pessoas envolvidas.', color: 'text-[#22c55e]' },
            { icon: ArrowUpRight, title: 'Visão executiva', text: 'Indicadores, fases e decisões ficam em evidência para acelerar a tomada de decisão.', color: 'text-[#18c8df]' }
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-[#263345] bg-[#111827] p-5">
                <Icon className={`mb-4 h-6 w-6 ${item.color}`} />
                <h3 className="text-base font-black text-slate-100">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.text}</p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}

const plannedDateLabel = (value?: string) => {
  if (!value) return 'Sem data';
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return 'Sem data';
  return parsed.toLocaleDateString('pt-BR');
};

const plannedTime = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? Number.POSITIVE_INFINITY : parsed.getTime();
};

export function PlannedView({
  projects = [],
  issues = [],
  onCreateProject,
  onOpenProject
}: {
  projects?: Space[];
  issues?: Issue[];
  onCreateProject?: () => void;
  onOpenProject?: (projectId: string) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTime = today.getTime();
  const nextWeekTime = todayTime + 7 * 24 * 60 * 60 * 1000;
  const plannedProjects = projects
    .filter((project) => project.status === 'PLANEJADO')
    .sort((a, b) => plannedTime(a.startDate || a.createdAt) - plannedTime(b.startDate || b.createdAt));
  const plannedIssues = issues.filter((issue) => ['PENDENTE', 'PLANEJAMENTO'].includes(issue.status));
  const todayIssues = plannedIssues.filter((issue) => plannedTime(issue.dueDate) === todayTime);
  const overdueIssues = plannedIssues.filter((issue) => plannedTime(issue.dueDate) < todayTime);
  const nextIssues = plannedIssues
    .filter((issue) => {
      const time = plannedTime(issue.dueDate);
      return time > todayTime && time <= nextWeekTime;
    })
    .sort((a, b) => plannedTime(a.dueDate) - plannedTime(b.dueDate))
    .slice(0, 6);

  return (
    <div className="h-full bg-[#070b16] overflow-y-auto p-8 text-slate-300">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <Calendar className="w-6 h-6 text-[#22c55e]" />
            Planejado
          </h1>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 bg-[#111827] border border-[#263345] px-3 py-1.5 rounded-md transition-colors">
              <Calendar className="w-4 h-4" /> Hoje
            </button>
            <button
              type="button"
              onClick={onCreateProject}
              className="flex items-center gap-2 text-sm text-white bg-[#ff7a00] hover:bg-[#f6b40b] hover:text-[#050914] px-3 py-1.5 rounded-md transition-colors font-medium"
            >
              <Plus className="w-4 h-4" /> Novo Projeto
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Projetos planejados</h2>
                <p className="mt-1 text-xs text-slate-500">{plannedProjects.length} projeto{plannedProjects.length !== 1 ? 's' : ''} aguardando inicio.</p>
              </div>
              <span className="rounded-full border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-1 text-xs font-black text-[#22c55e]">
                PLANEJADO
              </span>
            </div>

            {plannedProjects.length === 0 ? (
              <div className="bg-[#111827] border border-[#263345] rounded-md p-8 flex flex-col items-center justify-center min-h-[250px] text-center">
                <div className="w-16 h-16 bg-[#22c55e]/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#22c55e]" />
                </div>
                <h2 className="text-lg font-semibold text-slate-200 mb-2">Nenhum projeto planejado</h2>
                <p className="text-slate-500 max-w-sm">Crie um projeto novo ou converta uma oportunidade ganha para iniciar o planejamento.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {plannedProjects.map((project) => (
                  <article key={project.id} className="rounded-lg border border-[#263345] bg-[#111827] p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {project.number && (
                            <span className="rounded-full border border-[#18c8df]/35 bg-[#18c8df]/10 px-2.5 py-1 text-[11px] font-black text-[#18c8df]">
                              {project.number}
                            </span>
                          )}
                          <span className="rounded-full border border-[#ff7a00]/35 bg-[#ff7a00]/10 px-2.5 py-1 text-[11px] font-black text-[#ffb15c]">
                            {project.type || 'Projeto'}
                          </span>
                        </div>
                        <h3 className="truncate text-lg font-black text-slate-100">{project.name}</h3>
                        <p className="mt-1 text-sm text-slate-400">{project.client || 'Cliente nao informado'}</p>
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-300">{project.scope || project.objective || 'Escopo ainda nao informado.'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenProject?.(project.id)}
                        className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-[#374151] bg-[#070b16] px-3 py-2 text-sm font-bold text-slate-200 transition-colors hover:border-[#ff7a00] hover:text-white"
                      >
                        Abrir <ArrowUpRight className="h-4 w-4 text-[#ff7a00]" />
                      </button>
                    </div>
                    <div className="mt-5 grid gap-3 text-xs md:grid-cols-3">
                      <div className="rounded-md border border-[#263345] bg-[#070b16] p-3">
                        <p className="font-bold uppercase text-slate-500">Inicio previsto</p>
                        <p className="mt-1 font-black text-slate-100">{plannedDateLabel(project.startDate)}</p>
                      </div>
                      <div className="rounded-md border border-[#263345] bg-[#070b16] p-3">
                        <p className="font-bold uppercase text-slate-500">Fim previsto</p>
                        <p className="mt-1 font-black text-slate-100">{plannedDateLabel(project.endDate)}</p>
                      </div>
                      <div className="rounded-md border border-[#263345] bg-[#070b16] p-3">
                        <p className="font-bold uppercase text-slate-500">Gestor</p>
                        <p className="mt-1 truncate font-black text-slate-100">{project.manager || 'Nao definido'}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Para Hoje</h2>
            <div className="bg-[#111827] border border-[#263345] rounded-md p-4 flex flex-col gap-3">
              {todayIssues.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma fase planejada para hoje.</p>
              ) : todayIssues.map((issue) => (
                <div key={issue.id} className="flex gap-3 rounded-md border border-[#263345] bg-[#070b16] p-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#22c55e]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-200">{issue.title}</p>
                    <p className="text-xs text-slate-500">{issue.assignee?.name || 'Sem responsavel'}</p>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Atrasadas</h2>
            <div className="bg-[#111827] border border-[#263345] rounded-md p-6 text-center text-slate-500 text-sm">
              {overdueIssues.length === 0 ? 'Nenhuma tarefa em atraso.' : `${overdueIssues.length} tarefa${overdueIssues.length !== 1 ? 's' : ''} em atraso.`}
            </div>

            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mt-4">Próximos 7 dias</h2>
            <div className="bg-[#111827] border border-[#263345] rounded-md p-4 flex flex-col gap-3">
              {nextIssues.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma fase prevista nos próximos dias.</p>
              ) : nextIssues.map((issue) => (
                <div key={issue.id} className="flex gap-3 p-2 rounded-lg border border-transparent transition-colors hover:border-[#263345] hover:bg-[#070b16]">
                  <div className="w-8 h-8 rounded bg-[#ff7a00]/10 text-[#ff7a00] flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-slate-200 truncate">{issue.title}</p>
                    <p className="text-xs text-slate-500">{plannedDateLabel(issue.dueDate)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ProjectDocument = {
  id: string;
  projectId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  description?: string | null;
  uploadedBy?: string;
  createdAt: string;
};

const DOCUMENT_CATEGORIES = [
  { value: 'OTHER', label: 'Geral' },
  { value: 'CONTRACT', label: 'Contrato' },
  { value: 'DELIVERABLE', label: 'Entregavel' },
  { value: 'MINUTES', label: 'Ata' },
  { value: 'CHANGE_REQUEST', label: 'Mudanca' },
  { value: 'ACCEPTANCE', label: 'Aceite' }
];

const categoryLabel = (value?: string) =>
  DOCUMENT_CATEGORIES.find((item) => item.value === value)?.label || 'Geral';

const formatFileSize = (size = 0) => {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${(size / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
};

const authUploadHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export function DocsView({
  projects = [],
  activeProjectId,
  onProjectChange,
  onCreateProject
}: {
  projects?: Space[];
  activeProjectId?: string;
  onProjectChange?: (projectId: string) => void;
  onCreateProject?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [uploadCategory, setUploadCategory] = useState('OTHER');
  const [documentDescription, setDocumentDescription] = useState('');
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const selectedProjectId = activeProjectId || projects[0]?.id || '';
  const selectedProject = projects.find((project) => project.id === selectedProjectId);

  const loadDocuments = async () => {
    if (!selectedProjectId) {
      setDocuments([]);
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch(buildApiUrl(`/projetos/${selectedProjectId}/attachments`), {
        headers: getAuthHeaders()
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(payload.error || `Erro ${response.status} ao carregar documentos`);
      }
      setDocuments(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('Erro ao carregar documentos do projeto:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeProjectId && projects[0]?.id) {
      onProjectChange?.(projects[0].id);
    }
  }, [activeProjectId, onProjectChange, projects]);

  useEffect(() => {
    loadDocuments();
  }, [selectedProjectId]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !selectedProjectId) return;

    setSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory);
      formData.append('description', documentDescription.trim());

      const response = await fetch(buildApiUrl(`/projetos/${selectedProjectId}/attachments`), {
        method: 'POST',
        headers: authUploadHeaders(),
        body: formData
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Erro ${response.status} ao enviar documento`);
      }
      setDocuments((prev) => [payload, ...prev]);
      setDocumentDescription('');
    } catch (err) {
      console.error('Erro ao enviar documento:', err);
      setError(err instanceof Error ? err.message : 'Erro ao enviar documento');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (document: ProjectDocument) => {
    if (!selectedProjectId) return;
    try {
      const response = await fetch(buildApiUrl(`/projetos/${selectedProjectId}/attachments/${document.id}/download`), {
        headers: getAuthHeaders()
      });
      if (!response.ok) throw new Error(`Erro ${response.status} ao baixar documento`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.originalName || document.filename;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar documento:', err);
      setError(err instanceof Error ? err.message : 'Erro ao baixar documento');
    }
  };

  const handleDelete = async (document: ProjectDocument) => {
    if (!selectedProjectId) return;
    if (!window.confirm(`Excluir o documento "${document.originalName}"?`)) return;

    try {
      const response = await fetch(buildApiUrl(`/projetos/${selectedProjectId}/attachments/${document.id}`), {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || `Erro ${response.status} ao excluir documento`);
      }
      setDocuments((prev) => prev.filter((item) => item.id !== document.id));
    } catch (err) {
      console.error('Erro ao excluir documento:', err);
      setError(err instanceof Error ? err.message : 'Erro ao excluir documento');
    }
  };

  const filteredDocuments = documents.filter((document) => {
    const text = `${document.originalName} ${document.category} ${document.description || ''}`.toLowerCase();
    return !search || text.includes(search.toLowerCase());
  });
  const groupedDocuments = DOCUMENT_CATEGORIES
    .map((item) => ({
      ...item,
      documents: filteredDocuments.filter((document) => document.category === item.value)
    }))
    .filter((item) => item.documents.length > 0);

  return (
    <div className="h-full bg-[#070b16] overflow-y-auto p-8 text-slate-300">
      <div className="max-w-7xl mx-auto flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <FileText className="w-6 h-6 text-[#ff7a00]" />
            Documentos
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={(event) => onProjectChange?.(event.target.value)}
              className="bg-[#111827] border border-[#263345] text-sm font-semibold text-slate-200 rounded-md px-3 py-1.5 focus:outline-none focus:border-[#ff7a00] min-w-[240px]"
            >
              {projects.length === 0 ? (
                <option value="">Nenhum projeto</option>
              ) : projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar documentos..."
                className="bg-[#111827] border border-[#263345] text-sm text-slate-200 rounded-md pl-9 pr-4 py-1.5 focus:outline-none focus:border-[#ff7a00] w-64"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-[#ff7a00]/40 bg-[#ff7a00]/10 px-4 py-3 text-sm font-semibold text-[#ffb15c]">
            {error}
          </div>
        )}

        {!selectedProjectId ? (
          <div className="rounded-lg border border-[#263345] bg-[#111827] p-10 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-[#ff7a00]" />
            <h2 className="text-lg font-black text-slate-100">Nenhum projeto disponível</h2>
            <p className="mt-2 text-sm text-slate-500">Crie um projeto para organizar contratos, atas, entregáveis e evidências.</p>
            {onCreateProject && (
              <button
                type="button"
                onClick={onCreateProject}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#ff7a00] px-4 py-2 text-sm font-black text-white transition-colors hover:bg-[#f6b40b] hover:text-[#050914]"
              >
                <Plus className="h-4 w-4" />
                Novo Projeto
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-lg border border-[#263345] bg-[linear-gradient(140deg,rgba(255,122,0,0.14),rgba(17,24,39,0.98))] p-5">
              <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto] lg:items-end">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Tipo do documento</span>
                  <select
                    value={uploadCategory}
                    onChange={(event) => setUploadCategory(event.target.value)}
                    className="h-11 rounded-md border border-[#374151] bg-[#070b16] px-3 text-sm font-semibold text-slate-100 outline-none transition-colors focus:border-[#22c55e]"
                  >
                    {DOCUMENT_CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Do que se trata</span>
                  <input
                    type="text"
                    value={documentDescription}
                    onChange={(event) => setDocumentDescription(event.target.value)}
                    placeholder="Ex.: Ata do kickoff externo, proposta aprovada, aceite da fase 1..."
                    className="h-11 rounded-md border border-[#374151] bg-[#070b16] px-3 text-sm font-semibold text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff7a00]"
                  />
                </label>
                <label className={`flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-black text-white transition-colors ${selectedProjectId && !saving ? 'bg-[#ff7a00] hover:bg-[#f6b40b] hover:text-[#050914] cursor-pointer' : 'bg-slate-700 cursor-not-allowed opacity-70'}`}>
                  <Upload className="w-4 h-4" />
                  {saving ? 'Enviando...' : 'Enviar documento'}
                  <input type="file" className="hidden" disabled={!selectedProjectId || saving} onChange={handleUpload} />
                </label>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-[#263345] bg-[linear-gradient(140deg,rgba(255,122,0,0.18),rgba(17,24,39,0.98))] p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Projeto</p>
                <p className="mt-2 truncate text-base font-black text-slate-100">{selectedProject?.name || 'Projeto'}</p>
                <p className="mt-1 text-xs text-[#ffb15c]">{selectedProject?.number || selectedProject?.status || 'Documento'}</p>
              </div>
              <div className="rounded-lg border border-[#263345] bg-[#111827] p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Total</p>
                <p className="mt-2 text-2xl font-black text-slate-100">{documents.length}</p>
              </div>
              <div className="rounded-lg border border-[#263345] bg-[#111827] p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Contratos/Aceites</p>
                <p className="mt-2 text-2xl font-black text-[#22c55e]">{documents.filter((item) => ['CONTRACT', 'ACCEPTANCE'].includes(item.category)).length}</p>
              </div>
              <div className="rounded-lg border border-[#263345] bg-[#111827] p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">Entregaveis</p>
                <p className="mt-2 text-2xl font-black text-[#18c8df]">{documents.filter((item) => item.category === 'DELIVERABLE').length}</p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-lg border border-[#263345] bg-[#111827] p-8 text-center text-sm font-semibold text-slate-500">
                Carregando documentos...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#263345] bg-[#111827] p-10 text-center">
                <Upload className="mx-auto mb-4 h-12 w-12 text-[#ff7a00]" />
                <h2 className="text-lg font-black text-slate-100">Nenhum documento encontrado</h2>
                <p className="mt-2 text-sm text-slate-500">Envie contratos, atas, entregáveis, evidências e aceites do projeto selecionado.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedDocuments.map((group) => (
                  <section key={group.value} className="overflow-hidden rounded-lg border border-[#263345] bg-[#111827]">
                    <div className="flex items-center justify-between border-b border-[#263345] bg-[#0b1020] px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#18c8df]/10 text-[#18c8df]">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-wide text-slate-100">{group.label}</h3>
                          <p className="text-xs text-slate-500">{group.documents.length} documento{group.documents.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[900px] grid-cols-[1.15fr_1.1fr_.35fr_.45fr_.3fr] gap-4 border-b border-[#263345] px-5 py-3 text-[11px] font-black uppercase tracking-wide text-slate-500">
                        <span>Arquivo</span>
                        <span>Do que se trata</span>
                        <span>Tamanho</span>
                        <span>Enviado em</span>
                        <span className="text-right">Acoes</span>
                      </div>
                      <div className="divide-y divide-[#263345]">
                        {group.documents.map((document) => (
                          <div key={document.id} className="grid min-w-[900px] grid-cols-[1.15fr_1.1fr_.35fr_.45fr_.3fr] items-center gap-4 px-5 py-4 text-sm">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#ff7a00]/10 text-[#ff7a00]">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-black text-slate-100">{document.originalName}</p>
                                <p className="truncate text-xs text-slate-500">{document.mimeType || 'Arquivo'}</p>
                              </div>
                            </div>
                            <p className="line-clamp-2 text-sm leading-relaxed text-slate-300">
                              {document.description || 'Sem descrição informada.'}
                            </p>
                            <span className="text-slate-400">{formatFileSize(document.size)}</span>
                            <span className="text-slate-400">{new Date(document.createdAt).toLocaleDateString('pt-BR')}</span>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleDownload(document)}
                                className="rounded-md border border-[#374151] bg-[#070b16] p-2 text-slate-400 transition-colors hover:border-[#22c55e] hover:text-[#22c55e]"
                                title="Baixar"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(document)}
                                className="rounded-md border border-[#374151] bg-[#070b16] p-2 text-slate-400 transition-colors hover:border-[#ef4444] hover:text-[#ef4444]"
                                title="Excluir"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

export function WhiteboardsView({ activeProject = null }: { activeProject?: Space | null }) {
  const [activeBoard, setActiveBoard] = useState<string | null>(null);

  if (activeBoard === 'Diagrama de Arquitetura') {
    return <ArchitectureDiagram activeProject={activeProject} onBack={() => setActiveBoard(null)} />;
  }

  if (activeBoard === 'Mapeamento de Processo' || activeBoard === 'Mapeamento de Processos' || activeBoard?.startsWith('Mapeamento de Processo')) {
    return <ProcessMappingBoard activeProject={activeProject} onBack={() => setActiveBoard(null)} />;
  }

  if (activeBoard === 'Brainstorming de Produto') {
    return <ProductBrainstormBoard onBack={() => setActiveBoard(null)} />;
  }

  if (activeBoard) {
    return (
      <div className="h-full flex flex-col bg-[#070b16] overflow-hidden">
        <div className="h-14 border-b border-[#263345] bg-[#111827] flex items-center px-4 flex-shrink-0 gap-4">
          <button
            onClick={() => setActiveBoard(null)}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="w-px h-6 bg-[#263345]"></div>
          <h2 className="text-slate-200 font-semibold">{activeBoard}</h2>
        </div>
        <div className="flex-1 relative">
          <Tldraw />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#070b16] overflow-y-auto p-8 text-slate-300">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-3">
            <LayoutTemplate className="w-6 h-6 text-[#ff7a00]" />
            Quadros Mágicos
          </h1>
          <button
            onClick={() => setActiveBoard('Novo Quadro em Branco')}
            className="flex items-center gap-2 text-sm text-white bg-[#ff7a00] hover:bg-[#f6b40b] px-4 py-2 rounded-md transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> Novo Quadro
          </button>
        </div>

        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-[#111827] to-[#070b16] border border-[#263345] rounded-lg p-10 mb-8 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10 flex flex-col items-start max-w-lg">
            <div className="bg-[#ff7a00]/20 text-[#ff7a00] text-xs font-bold px-3 py-1 rounded-full mb-4 border border-[#ff7a00]/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> NOVO
            </div>
            <h2 className="text-3xl font-bold text-white mb-3">Colabore de forma visual</h2>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Use Quadros Mágicos para desenhar fluxos de projeto, arquiteturas de sistema, ou fazer brainstorming em tempo real com toda a sua equipe.
            </p>
            <button
              onClick={() => setActiveBoard('Playground Visual')}
              className="bg-white text-slate-900 px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:bg-slate-100 transition-colors"
            >
              Experimentar Agora
            </button>
          </div>

          <div className="absolute -right-20 -bottom-20 opacity-40 pointer-events-none">
            <LayoutTemplate className="w-96 h-96 text-[#ff7a00]" />
          </div>
        </div>

        {/* Templates */}
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Templates Populares</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Mapeamento de Processo',
              subtitle: 'Fluxo, gargalos e responsáveis',
              icon: GitBranch,
              color: '#ff7a00',
              preview: ['Entrada', 'Triagem', 'Execução', 'Validação']
            },
            {
              title: 'Brainstorming de Produto',
              subtitle: 'Ideias, impacto e priorização',
              icon: Lightbulb,
              color: '#22c55e',
              preview: ['Descobrir', 'Idear', 'Priorizar', 'Roadmap']
            },
            {
              title: 'Diagrama de Arquitetura',
              subtitle: 'Componentes, integrações e camadas',
              icon: LayoutTemplate,
              color: '#18c8df',
              preview: ['App', 'API', 'Dados', 'Integrações']
            }
          ].map((template) => {
            const Icon = template.icon;
            return (
            <div
              key={template.title}
              onClick={() => setActiveBoard(template.title)}
              className="group cursor-pointer overflow-hidden rounded-lg border border-[#263345] bg-[#111827] transition-colors hover:border-[#ff7a00]"
            >
              <div className="relative h-32 border-b border-[#263345] bg-[#070b16] p-4">
                <div className="absolute inset-0 opacity-80" style={{ background: `radial-gradient(circle at 20% 10%, ${template.color}22, transparent 34%)` }} />
                <div className="relative grid h-full grid-cols-4 items-center gap-2">
                  {template.preview.map((label, index) => (
                    <div key={label} className="min-w-0">
                      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: `${template.color}55`, backgroundColor: `${template.color}18`, color: template.color }}>
                        {index === 0 ? <Icon className="h-4 w-4" /> : <span className="text-xs font-black">{index + 1}</span>}
                      </div>
                      <div className="h-1 rounded-full bg-[#263345]">
                        <div className="h-full rounded-full" style={{ width: `${72 - index * 10}%`, backgroundColor: template.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-black text-slate-100 transition-colors group-hover:text-[#ffb15c]">{template.title}</h3>
                <p className="mt-1 text-xs text-slate-500">{template.subtitle}</p>
              </div>
            </div>
          )})}
        </div>
      </div>
    </div>
  );
}

type ProcessStep = {
  title: string;
  owner: string;
  time: string;
  status: string;
  color: string;
  items: string[];
};

type Swimlane = {
  area: string;
  entries: string[];
  color: string;
};

type ProductIdea = {
  title: string;
  cluster: string;
  score: number;
  color: string;
};

type MatrixQuadrant = {
  quadrant: string;
  hint: string;
  ideas: string[];
  color: string;
};

type RoadmapWave = {
  wave: string;
  title: string;
  text: string;
  color: string;
};

const editableInputClass = 'w-full rounded-md border border-[#263345] bg-[#070b16] px-2.5 py-2 text-sm font-semibold text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff7a00]';
const editableSmallInputClass = 'w-full rounded-md border border-[#263345] bg-[#070b16] px-2 py-1.5 text-xs font-semibold text-slate-200 outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff7a00]';
const editableTextAreaClass = 'w-full resize-none rounded-md border border-[#263345] bg-[#070b16] px-2.5 py-2 text-sm font-semibold leading-relaxed text-slate-100 outline-none transition-colors placeholder:text-slate-600 focus:border-[#ff7a00]';
const boardActionButtonClass = 'flex items-center gap-2 rounded-md border border-[#374151] bg-[#111827] px-3 py-2 text-xs font-black text-slate-200 transition-colors hover:border-[#ff7a00] hover:text-white';
const dangerIconButtonClass = 'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#374151] bg-[#111827] text-slate-500 transition-colors hover:border-[#ef4444] hover:text-[#ef4444]';

const PROCESS_DEFAULT_BOARD: { steps: ProcessStep[]; swimlanes: Swimlane[]; actions: string[] } = {
  steps: [
    { title: 'Entrada', owner: 'Comercial', time: '1 dia', status: 'OK', color: '#18c8df', items: ['Pedido recebido', 'Dados mínimos', 'Prioridade inicial'] },
    { title: 'Triagem', owner: 'PMO', time: '2 dias', status: 'Atenção', color: '#f6b40b', items: ['Escopo validado', 'Dependências', 'Critérios de aceite'] },
    { title: 'Execução', owner: 'Operações', time: '5 dias', status: 'Em curso', color: '#ff7a00', items: ['Tarefas abertas', 'Bloqueios visíveis', 'Evidências'] },
    { title: 'Validação', owner: 'Cliente', time: '2 dias', status: 'Risco', color: '#ef4444', items: ['Homologação', 'Correções', 'Aceite formal'] },
    { title: 'Encerramento', owner: 'CS', time: '1 dia', status: 'Pronto', color: '#22c55e', items: ['Ata final', 'Documentação', 'Próximo ciclo'] }
  ],
  swimlanes: [
    { area: 'Cliente', entries: ['Enviar requisitos', 'Validar solução', 'Aprovar aceite'], color: '#22c55e' },
    { area: 'Comercial', entries: ['Registrar oportunidade', 'Confirmar contrato', 'Comunicar mudança'], color: '#ff7a00' },
    { area: 'Operações', entries: ['Planejar execução', 'Executar entregas', 'Documentar evidências'], color: '#18c8df' },
    { area: 'Gestão', entries: ['Acompanhar SLA', 'Remover bloqueios', 'Report executivo'], color: '#f6b40b' }
  ],
  actions: ['Criar checklist de entrada obrigatório', 'Definir SLA por etapa e responsável', 'Automatizar aviso de bloqueio', 'Padronizar evidências de aceite']
};

const PRODUCT_DEFAULT_BOARD: { ideas: ProductIdea[]; matrix: MatrixQuadrant[]; roadmap: RoadmapWave[] } = {
  ideas: [
    { title: 'Assistente de escopo com IA', cluster: 'Eficiência', score: 92, color: '#22c55e' },
    { title: 'Painel de saúde do cliente', cluster: 'Retenção', score: 86, color: '#18c8df' },
    { title: 'Portal de aprovações externas', cluster: 'Governança', score: 78, color: '#f6b40b' },
    { title: 'Resumo automático de reuniões', cluster: 'Produtividade', score: 81, color: '#ff7a00' }
  ],
  matrix: [
    { quadrant: 'Apostar agora', hint: 'Alto impacto · baixo esforço', ideas: ['Ata automática', 'Templates por fase'], color: '#22c55e' },
    { quadrant: 'Planejar', hint: 'Alto impacto · alto esforço', ideas: ['Portal do cliente', 'Integração BI'], color: '#f6b40b' },
    { quadrant: 'Quick wins', hint: 'Baixo impacto · baixo esforço', ideas: ['Tags inteligentes', 'Favoritos'], color: '#18c8df' },
    { quadrant: 'Evitar agora', hint: 'Baixo impacto · alto esforço', ideas: ['Customização extrema'], color: '#ff7a00' }
  ],
  roadmap: [
    { wave: 'Onda 1', title: 'Validar valor', text: 'Protótipos rápidos, entrevistas e métricas de adoção.', color: '#22c55e' },
    { wave: 'Onda 2', title: 'Construir MVP', text: 'Fluxos essenciais, integrações mínimas e telemetria.', color: '#f6b40b' },
    { wave: 'Onda 3', title: 'Escalar produto', text: 'Automação, governança, permissões e expansão comercial.', color: '#ff7a00' }
  ]
};

function cloneBoard<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function BoardShell({
  title,
  subtitle,
  icon: Icon,
  onBack,
  actions,
  saveBadge,
  children
}: {
  title: string;
  subtitle: string;
  icon: any;
  onBack: () => void;
  actions?: React.ReactNode;
  saveBadge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-[radial-gradient(circle_at_16%_0%,rgba(255,122,0,0.18),transparent_26%),radial-gradient(circle_at_86%_8%,rgba(34,197,94,0.14),transparent_30%),linear-gradient(135deg,#050914,#070b16_46%,#111827)] p-6 text-slate-300 custom-scrollbar">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[#263345] bg-[#0b1020]/88 p-5 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <button
              onClick={onBack}
              className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[#374151] bg-[#111827] text-slate-400 transition-colors hover:border-[#ff7a00] hover:text-white"
              title="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ff7a00]/14 text-[#ff7a00] ring-1 ring-[#ff7a00]/35">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#5ee2a0]">
                  Quadro inteligente
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-white">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {saveBadge ?? (
              <span className="flex items-center gap-2 rounded-md border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-xs font-black text-[#5ee2a0]">
                <Save className="h-4 w-4" />
                Autosalvo
              </span>
            )}
            {actions}
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

export function ProcessMappingBoard({ activeProject = null, onBack }: { activeProject?: Space | null; onBack: () => void }) {
  interface ProcessMapping {
    id: string;
    name: string;
    steps: ProcessStep[];
    swimlanes: Swimlane[];
    actions: string[];
  }

  const projectId = activeProject?.id || 'global';
  const localStorageKey = `pm-process-mappings-list-${projectId}`;

  const [processes, setProcesses] = useState<ProcessMapping[]>(() => {
    if (typeof window === 'undefined') return [{ id: 'default', name: 'Processo de Implantação Padrão', ...cloneBoard(PROCESS_DEFAULT_BOARD) }];
    const saved = window.localStorage.getItem(localStorageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Erro ao ler mappings', e);
      }
    }
    // Fallback: migrate from single board if exists
    const single = window.localStorage.getItem(`pm-process-map-board-${projectId}`);
    if (single) {
      try {
        const parsedSingle = JSON.parse(single);
        if (parsedSingle && parsedSingle.steps) {
          return [{ id: 'default', name: 'Processo de Implantação Padrão', ...parsedSingle }];
        }
      } catch(e) {}
    }
    return [{ id: 'default', name: 'Processo de Implantação Padrão', ...cloneBoard(PROCESS_DEFAULT_BOARD) }];
  });

  const [activeProcessId, setActiveProcessId] = useState<string>(processes[0]?.id || 'default');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const board = processes.find(p => p.id === activeProcessId) || processes[0];

  const leadTime = board.steps.reduce((sum, step) => sum + (Number.parseInt(step.time, 10) || 0), 0);
  const bottlenecks = board.steps.filter(step => /risco|aten|bloq/i.test(step.status)).length;
  const controls = board.steps.reduce((sum, step) => sum + step.items.length, 0);

  const persistProcesses = (list: ProcessMapping[]) => {
    setProcesses(list);
    window.localStorage.setItem(localStorageKey, JSON.stringify(list));
  };

  const handleSaveProcess = () => {
    setSaveStatus('saving');
    persistProcesses(processes);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 500);
  };

  const handleCreateNewProcess = () => {
    const newId = `process-${Date.now()}`;
    const newProcess: ProcessMapping = {
      id: newId,
      name: `Mapeamento de Processo ${processes.length + 1}`,
      steps: [
        { title: 'Entrada e Triagem', owner: 'Responsável', time: '1 dia', status: 'OK', color: '#18c8df', items: ['Passo preliminar', 'Revisar requisitos'] },
        { title: 'Entrega Final', owner: 'Responsável', time: '2 dias', status: 'Novo', color: '#22c55e', items: ['Validação', 'Entrega finalizada'] }
      ],
      swimlanes: [
        { area: 'Área Padrão', entries: ['Ação Padrão'], color: '#18c8df' }
      ],
      actions: ['Revisão periódica do fluxo']
    };
    const newList = [...processes, newProcess];
    persistProcesses(newList);
    setActiveProcessId(newId);
  };

  const handleDeleteProcess = (id: string) => {
    if (processes.length <= 1) {
      alert('Não é possível excluir o único processo mapeado.');
      return;
    }
    if (!confirm('Deseja realmente excluir este mapeamento de processo?')) return;
    const newList = processes.filter(p => p.id !== id);
    persistProcesses(newList);
    if (activeProcessId === id) {
      setActiveProcessId(newList[0].id);
    }
  };

  const handleRenameProcess = () => {
    if (!editedName.trim()) return;
    const newList = processes.map(p => p.id === activeProcessId ? { ...p, name: editedName.trim() } : p);
    persistProcesses(newList);
    setIsEditingName(false);
  };

  const updateStep = (index: number, patch: Partial<ProcessStep>) => {
    const updated = processes.map(p => {
      if (p.id !== activeProcessId) return p;
      return {
        ...p,
        steps: p.steps.map((step, stepIndex) => stepIndex === index ? { ...step, ...patch } : step)
      };
    });
    persistProcesses(updated);
  };

  const updateStepItem = (stepIndex: number, itemIndex: number, value: string) => {
    const updated = processes.map(p => {
      if (p.id !== activeProcessId) return p;
      return {
        ...p,
        steps: p.steps.map((step, index) => index === stepIndex
          ? { ...step, items: step.items.map((item, currentItemIndex) => currentItemIndex === itemIndex ? value : item) }
          : step)
      };
    });
    persistProcesses(updated);
  };

  const addStep = () => {
    const updated = processes.map(p => {
      if (p.id !== activeProcessId) return p;
      return {
        ...p,
        steps: [...p.steps, { title: 'Nova etapa', owner: 'Responsável', time: '1 dia', status: 'Novo', color: '#22c55e', items: ['Novo controle'] }]
      };
    });
    persistProcesses(updated);
  };

  const updateLane = (index: number, patch: Partial<Swimlane>) => {
    const updated = processes.map(p => {
      if (p.id !== activeProcessId) return p;
      return {
        ...p,
        swimlanes: p.swimlanes.map((lane, laneIndex) => laneIndex === index ? { ...lane, ...patch } : lane)
      };
    });
    persistProcesses(updated);
  };

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 15;
      
      // Canvas is light white
      pdf.setFillColor(253, 254, 255);
      pdf.rect(0, 0, 210, 297, 'F');

      // Top decorative bar
      pdf.setFillColor(255, 122, 0);
      pdf.rect(0, 0, 210, 4, 'F');

      // Header Title
      pdf.setTextColor(15, 23, 42); // slate-900
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(board.name || 'Mapeamento de Processo', margin, 22);

      // Subtitle
      pdf.setTextColor(100, 116, 139); // slate-500
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Relatorio estruturado de fluxo de processos, SLA, responsabilidades e controles.', margin, 28);

      // Horizontal separator line
      pdf.setDrawColor(226, 232, 240); // slate-200
      pdf.setLineWidth(0.5);
      pdf.line(margin, 32, 210 - margin, 32);

      // Highlight stats grid (Light grey card)
      pdf.setFillColor(248, 250, 252); // slate-50
      pdf.rect(margin, 36, 180, 16, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(margin, 36, 180, 16);

      pdf.setTextColor(15, 23, 42); // slate-900
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text(`LEAD TIME TOTAL:`, margin + 6, 46);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${leadTime} dias`, margin + 42, 46);

      pdf.setFont('helvetica', 'bold');
      pdf.text(`GARGALOS ATIVOS:`, margin + 65, 46);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(bottlenecks > 0 ? 239 : 15, bottlenecks > 0 ? 68 : 23, bottlenecks > 0 ? 68 : 42); // Red if > 0
      pdf.text(`${bottlenecks}`, margin + 102, 46);

      pdf.setTextColor(15, 23, 42);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`TOTAL CONTROLES:`, margin + 118, 46);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${controls}`, margin + 155, 46);

      let yPos = 60;

      // Title Section 1
      pdf.setTextColor(255, 122, 0); // Orange
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text('FLUXO DE ETAPAS (PONTA A PONTA)', margin, yPos);
      
      // Underline title
      pdf.setDrawColor(255, 122, 0);
      pdf.setLineWidth(0.3);
      pdf.line(margin, yPos + 2, margin + 80, yPos + 2);
      
      yPos += 8;

      board.steps.forEach((step, idx) => {
        if (yPos > 245) {
          pdf.addPage();
          pdf.setFillColor(253, 254, 255);
          pdf.rect(0, 0, 210, 297, 'F');
          
          pdf.setFillColor(255, 122, 0);
          pdf.rect(0, 0, 210, 4, 'F');
          
          yPos = 20;
        }

        // Card background (light slate grey)
        pdf.setFillColor(248, 250, 252); // slate-50
        pdf.rect(margin, yPos, 180, 24, 'F');
        
        pdf.setDrawColor(226, 232, 240); // slate-200
        pdf.rect(margin, yPos, 180, 24);

        // Status-colored left indicator strip
        const hexColor = step.color || '#ff7a00';
        let r = 255, g = 122, b = 0;
        if (hexColor.startsWith('#')) {
          const num = parseInt(hexColor.slice(1), 16);
          r = (num >> 16) & 255;
          g = (num >> 8) & 255;
          b = num & 255;
        }
        pdf.setFillColor(r, g, b);
        pdf.rect(margin, yPos, 3, 24, 'F');

        // Step number and title
        pdf.setTextColor(15, 23, 42); // slate-900
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${idx + 1}. ${step.title}`, margin + 8, yPos + 6);

        // Status badge styled text on the right
        pdf.setTextColor(r, g, b);
        pdf.setFontSize(8);
        pdf.text(`[ STATUS: ${step.status.toUpperCase()} ]`, margin + 132, yPos + 6);

        // Step details
        pdf.setTextColor(71, 85, 105); // slate-600
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Area/Dono: ${step.owner}`, margin + 8, yPos + 12);
        pdf.text(`SLA / Tempo: ${step.time}`, margin + 70, yPos + 12);

        // Controls list
        const itemsStr = step.items.length > 0 ? `Controles / Entregas: ${step.items.join(', ')}` : 'Sem controles adicionais informados.';
        pdf.setTextColor(15, 23, 42);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text(itemsStr, margin + 8, yPos + 18, { maxWidth: 165 });

        yPos += 29;
      });

      if (board.swimlanes && board.swimlanes.length > 0) {
        if (yPos > 210) {
          pdf.addPage();
          pdf.setFillColor(253, 254, 255);
          pdf.rect(0, 0, 210, 297, 'F');
          
          pdf.setFillColor(255, 122, 0);
          pdf.rect(0, 0, 210, 4, 'F');
          
          yPos = 20;
        }
        
        pdf.setTextColor(255, 122, 0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('RESPONSABILIDADES POR AREA (RAIAS)', margin, yPos);
        
        pdf.setDrawColor(255, 122, 0);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos + 2, margin + 80, yPos + 2);
        
        yPos += 8;

        board.swimlanes.forEach((lane) => {
          if (yPos > 255) {
            pdf.addPage();
            pdf.setFillColor(253, 254, 255);
            pdf.rect(0, 0, 210, 297, 'F');
            
            pdf.setFillColor(255, 122, 0);
            pdf.rect(0, 0, 210, 4, 'F');
            
            yPos = 20;
          }

          // Lane header background (dark blue slate)
          pdf.setFillColor(15, 23, 42);
          pdf.rect(margin, yPos, 180, 8, 'F');
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          pdf.text(lane.area.toUpperCase(), margin + 4, yPos + 5.5);

          // Lane actions body (light gray)
          pdf.setFillColor(248, 250, 252);
          pdf.rect(margin, yPos + 8, 180, 11, 'F');
          pdf.setDrawColor(226, 232, 240);
          pdf.rect(margin, yPos + 8, 180, 11);
          
          pdf.setTextColor(51, 65, 85); // slate-700
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.text(`Atribuicoes / Acoes:  ${lane.entries.join('   |   ')}`, margin + 4, yPos + 15, { maxWidth: 172 });

          yPos += 24;
        });
      }

      if (board.actions && board.actions.length > 0) {
        if (yPos > 225) {
          pdf.addPage();
          pdf.setFillColor(253, 254, 255);
          pdf.rect(0, 0, 210, 297, 'F');
          
          pdf.setFillColor(255, 122, 0);
          pdf.rect(0, 0, 210, 4, 'F');
          
          yPos = 20;
        }

        pdf.setTextColor(255, 122, 0);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('ACOES DE MELHORIA E BACKLOG', margin, yPos);
        
        pdf.setDrawColor(255, 122, 0);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos + 2, margin + 80, yPos + 2);
        
        yPos += 8;

        pdf.setTextColor(51, 65, 85); // slate-700
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        board.actions.forEach((act, idx) => {
          pdf.text(`[ ]  ${idx + 1}. ${act}`, margin + 2, yPos);
          yPos += 6.5;
        });
      }

      // Add footer page count
      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setTextColor(148, 153, 160);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Pagina ${i} de ${totalPages}`, 170, 290);
        pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} por PMO Inteligente`, margin, 290);
      }

      pdf.save(`Mapeamento_${board.name.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Erro ao gerar o PDF do mapeamento de processo.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <BoardShell
      title="Mapeamento de Processo"
      subtitle="Visualize etapas, donos, tempos, gargalos e ações para transformar um processo solto em um fluxo governado."
      icon={GitBranch}
      onBack={onBack}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 rounded-md border border-cyan-800/40 bg-cyan-950/20 hover:bg-cyan-900/30 px-3 py-2 text-xs font-black text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            {isExportingPDF ? 'Gerando PDF...' : 'Visualizar em PDF'}
          </button>
          <button
            type="button"
            onClick={handleSaveProcess}
            className="flex items-center gap-2 rounded-md border border-emerald-800/40 bg-emerald-950/20 hover:bg-emerald-900/30 px-3 py-2 text-xs font-black text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <Save className="h-4 w-4" />
            {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Processo Salvo! ✓' : 'Salvar Processo'}
          </button>
          <button type="button" onClick={addStep} className={boardActionButtonClass}>
            <Plus className="h-4 w-4" />
            Etapa
          </button>
          <button type="button" onClick={handleCreateNewProcess} className="flex items-center gap-2 rounded-md border border-[#ff7a00]/40 bg-[#ff7a00]/10 hover:bg-[#ff7a00]/20 px-3 py-2 text-xs font-black text-[#ffb15c] transition-colors">
            <Plus className="h-4 w-4" />
            Novo Processo
          </button>
        </div>
      }
    >
      {/* Active Process Selector and Rename bar */}
      <div className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <span className="text-xs font-bold text-slate-400 whitespace-nowrap">Processo Ativo:</span>
          {isEditingName ? (
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <input
                autoFocus
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameProcess();
                  if (e.key === 'Escape') setIsEditingName(false);
                }}
                className="flex-1 rounded-md border border-[#ff7a00] bg-[#070b16] px-2.5 py-1.5 text-sm font-semibold text-slate-100 outline-none"
              />
              <button
                type="button"
                onClick={handleRenameProcess}
                className="rounded-md bg-[#ff7a00] text-slate-950 font-bold px-3 py-1.5 text-xs hover:bg-[#f6b40b]"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="rounded-md bg-slate-800 text-slate-300 px-3 py-1.5 text-xs hover:bg-slate-700"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <select
                value={activeProcessId}
                onChange={(e) => {
                  setActiveProcessId(e.target.value);
                  setIsEditingName(false);
                }}
                className="bg-[#070b16] border border-[#263345] rounded-md text-sm px-3 py-1.5 font-bold text-slate-200 outline-none max-w-[280px]"
              >
                {processes.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setIsEditingName(true);
                  setEditedName(board.name);
                }}
                className="p-2 rounded hover:bg-[#111827] text-slate-400 hover:text-slate-200 transition-colors"
                title="Editar nome do processo"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProcess(activeProcessId)}
                className="p-2 rounded hover:bg-[#ef4444]/15 text-slate-500 hover:text-red-400 transition-colors"
                title="Excluir mapeamento de processo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="text-xs text-slate-500 leading-tight">
          Sempre clique em <span className="text-emerald-400 font-bold">Salvar Processo</span> para manter suas modificações persistentes.
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Route, label: 'Etapas', value: String(board.steps.length), tone: '#18c8df' },
          { icon: AlertTriangle, label: 'Gargalos', value: String(bottlenecks), tone: '#ff7a00' },
          { icon: TimerReset, label: 'Lead time', value: `${leadTime || 0}d`, tone: '#f6b40b' },
          { icon: ClipboardCheck, label: 'Controles', value: String(controls), tone: '#22c55e' }
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-4">
              <Icon className="mb-4 h-5 w-5" style={{ color: item.tone }} />
              <p className="text-3xl font-black text-white">{item.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white">Fluxo ponta a ponta</h2>
            <p className="mt-1 text-sm text-slate-500">Sequência recomendada com dono, SLA e pontos de controle.</p>
          </div>
          <span className="rounded-full border border-[#ff7a00]/35 bg-[#ff7a00]/10 px-3 py-1 text-xs font-black text-[#ffb15c]">AS-IS para TO-BE</span>
        </div>

        <div className="grid gap-3 xl:grid-cols-5">
          {board.steps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="relative rounded-lg border border-[#263345] bg-[#070b16] p-4">
              {index < board.steps.length - 1 && <div className="absolute -right-3 top-1/2 hidden h-0.5 w-3 bg-[#374151] xl:block" />}
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black text-white" style={{ backgroundColor: `${step.color}22`, color: step.color, border: `1px solid ${step.color}55` }}>
                  {index + 1}
                </span>
                <input value={step.status} onChange={event => updateStep(index, { status: event.target.value })} className="w-24 rounded-full border border-transparent bg-transparent px-2 py-1 text-right text-[10px] font-black uppercase outline-none focus:border-[#ff7a00]" style={{ backgroundColor: `${step.color}16`, color: step.color }} />
              </div>
              <input value={step.title} onChange={event => updateStep(index, { title: event.target.value })} className={editableInputClass} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input value={step.owner} onChange={event => updateStep(index, { owner: event.target.value })} className={editableSmallInputClass} />
                <input value={step.time} onChange={event => updateStep(index, { time: event.target.value })} className={editableSmallInputClass} />
              </div>
              <div className="mt-4 space-y-2">
                {step.items.map((item, itemIndex) => (
                  <div key={`${item}-${itemIndex}`} className="flex items-center gap-2 text-xs text-slate-400">
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: step.color }} />
                    <input value={item} onChange={event => updateStepItem(index, itemIndex, event.target.value)} className="min-w-0 flex-1 bg-transparent font-semibold text-slate-300 outline-none focus:text-white" />
                    <button type="button" onClick={() => updateStep(index, { items: step.items.filter((_, currentIndex) => currentIndex !== itemIndex) })} className="text-slate-600 hover:text-[#ef4444]" title="Remover item">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => updateStep(index, { items: [...step.items, 'Novo controle'] })} className="mt-2 flex items-center gap-1 text-xs font-black text-[#18c8df] hover:text-[#5ee2a0]">
                  <Plus className="h-3.5 w-3.5" />
                  Controle
                </button>
              </div>
              <button type="button" onClick={() => {
                const updated = processes.map(p => {
                  if (p.id !== activeProcessId) return p;
                  return {
                    ...p,
                    steps: p.steps.filter((_, stepIndex) => stepIndex !== index)
                  };
                });
                persistProcesses(updated);
              }} className="mt-4 text-xs font-black text-slate-600 hover:text-[#ef4444]">
                Remover etapa
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-5">
          <h2 className="text-xl font-black text-white">Raias de responsabilidade</h2>
          <div className="mt-4 space-y-3">
            {board.swimlanes.map((lane, laneIndex) => (
              <div key={`${lane.area}-${laneIndex}`} className="grid gap-3 rounded-lg border border-[#263345] bg-[#070b16] p-3 md:grid-cols-[170px_1fr_36px]">
                <div className="flex items-center gap-2 text-sm font-black text-slate-100">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: lane.color }} />
                  <input value={lane.area} onChange={event => updateLane(laneIndex, { area: event.target.value })} className="min-w-0 flex-1 bg-transparent outline-none focus:text-white" />
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {lane.entries.map((entry, entryIndex) => (
                    <input key={`${entry}-${entryIndex}`} value={entry} onChange={event => updateLane(laneIndex, { entries: lane.entries.map((current, index) => index === entryIndex ? event.target.value : current) })} className={editableSmallInputClass} />
                  ))}
                  <button type="button" onClick={() => updateLane(laneIndex, { entries: [...lane.entries, 'Nova ação'] })} className="rounded-md border border-dashed border-[#374151] px-3 py-2 text-xs font-black text-[#18c8df] hover:border-[#18c8df]">
                    + Ação
                  </button>
                </div>
                <button type="button" onClick={() => {
                  const updated = processes.map(p => {
                    if (p.id !== activeProcessId) return p;
                    return {
                      ...p,
                      swimlanes: p.swimlanes.filter((_, index) => index !== laneIndex)
                    };
                  });
                  persistProcesses(updated);
                }} className={dangerIconButtonClass} title="Remover raia">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => {
              const updated = processes.map(p => {
                if (p.id !== activeProcessId) return p;
                return {
                  ...p,
                  swimlanes: [...p.swimlanes, { area: 'Nova raia', entries: ['Nova ação'], color: '#22c55e' }]
                };
              });
              persistProcesses(updated);
            }} className={boardActionButtonClass}>
              <Plus className="h-4 w-4" />
              Nova raia
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-[#263345] bg-[linear-gradient(135deg,rgba(255,122,0,0.14),rgba(17,24,39,0.96))] p-5">
          <h2 className="text-xl font-black text-white">Ações de melhoria</h2>
          <div className="mt-4 space-y-3">
            {board.actions.map((action, index) => (
              <div key={`${action}-${index}`} className="flex gap-3 rounded-lg border border-[#374151] bg-[#070b16]/70 p-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#ff7a00]/15 text-xs font-black text-[#ffb15c]">{index + 1}</span>
                <input value={action} onChange={event => {
                  const updated = processes.map(p => {
                    if (p.id !== activeProcessId) return p;
                    return {
                      ...p,
                      actions: p.actions.map((item, actionIndex) => actionIndex === index ? event.target.value : item)
                    };
                  });
                  persistProcesses(updated);
                }} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-300 outline-none focus:text-white" />
                <button type="button" onClick={() => {
                  const updated = processes.map(p => {
                    if (p.id !== activeProcessId) return p;
                    return {
                      ...p,
                      actions: p.actions.filter((_, actionIndex) => actionIndex !== index)
                    };
                  });
                  persistProcesses(updated);
                }} className="text-slate-600 hover:text-[#ef4444]" title="Remover ação">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => {
              const updated = processes.map(p => {
                if (p.id !== activeProcessId) return p;
                return {
                  ...p,
                  actions: [...p.actions, 'Nova ação de melhoria']
                };
              });
              persistProcesses(updated);
            }} className={boardActionButtonClass}>
              <Plus className="h-4 w-4" />
              Nova ação
            </button>
          </div>
        </div>
      </section>
    </BoardShell>
  );
}

type ProductBrainstorm = {
  id: string;
  name: string;
  context: string;
  ideas: ProductIdea[];
  matrix: MatrixQuadrant[];
  roadmap: RoadmapWave[];
};

const PRODUCT_BRAINSTORMS_KEY = 'pm-product-brainstormings-list';
const LEGACY_PRODUCT_BOARD_KEY = 'pm-product-brainstorm-board';

function readProductBrainstorms(): ProductBrainstorm[] {
  const fallback: ProductBrainstorm[] = [
    { id: 'default', name: 'Brainstorming de Produto', context: '', ...cloneBoard(PRODUCT_DEFAULT_BOARD) }
  ];

  if (typeof window === 'undefined') return fallback;

  const stored = window.localStorage.getItem(PRODUCT_BRAINSTORMS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (error) {
      console.error('Erro ao ler brainstormings de produto', error);
    }
  }

  const legacy = window.localStorage.getItem(LEGACY_PRODUCT_BOARD_KEY);
  if (legacy) {
    try {
      const parsedLegacy = JSON.parse(legacy);
      if (parsedLegacy && Array.isArray(parsedLegacy.ideas)) {
        return [{ id: 'default', name: 'Brainstorming de Produto', context: '', ...parsedLegacy }];
      }
    } catch (error) {
      console.error('Erro ao migrar brainstorming de produto', error);
    }
  }

  return fallback;
}

function ProductBrainstormBoard({ onBack }: { onBack: () => void }) {
  const [brainstorms, setBrainstorms] = useState<ProductBrainstorm[]>(readProductBrainstorms);
  const [activeId, setActiveId] = useState<string>(() => readProductBrainstorms()[0]?.id || 'default');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const board = brainstorms.find(entry => entry.id === activeId) || brainstorms[0];

  const averageScore = board?.ideas.length
    ? Math.round(board.ideas.reduce((sum, idea) => sum + Number(idea.score || 0), 0) / board.ideas.length)
    : 0;
  const clusters = new Set(board?.ideas.map(idea => idea.cluster).filter(Boolean)).size;
  const hypotheses = (board?.matrix || []).reduce((sum, item) => sum + (item.ideas?.length || 0), 0);

  const persistBrainstorms = (list: ProductBrainstorm[]) => {
    setBrainstorms(list);
    window.localStorage.setItem(PRODUCT_BRAINSTORMS_KEY, JSON.stringify(list));
    setIsDirty(false);
  };

  const mutateActive = (mutate: (current: ProductBrainstorm) => ProductBrainstorm) => {
    setBrainstorms(current => current.map(entry => (entry.id === activeId ? mutate(entry) : entry)));
    setIsDirty(true);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    window.localStorage.setItem(PRODUCT_BRAINSTORMS_KEY, JSON.stringify(brainstorms));
    setIsDirty(false);
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 400);
  };

  const handleCreateNew = () => {
    const newId = `brainstorm-${Date.now()}`;
    const newBoard: ProductBrainstorm = {
      id: newId,
      name: `Brainstorming de Produto ${brainstorms.length + 1}`,
      context: '',
      ideas: [{ title: 'Nova ideia', cluster: 'Oportunidade', score: 70, color: '#22c55e' }],
      matrix: cloneBoard(PRODUCT_DEFAULT_BOARD.matrix)
        .slice(0, 1)
        .map(item => ({ ...item, ideas: ['Nova hipótese'] })),
      roadmap: [{ wave: 'Onda 1', title: 'Validar valor', text: 'Descreva o objetivo desta onda.', color: '#22c55e' }]
    };
    persistBrainstorms([...brainstorms, newBoard]);
    setActiveId(newId);
    setIsEditing(true);
    setIsEditingName(false);
    setEditedName(newBoard.name);
  };

  const handleDelete = (id: string) => {
    if (brainstorms.length <= 1) {
      alert('Não é possível excluir o único brainstorming de produto.');
      return;
    }
    if (!confirm('Deseja realmente excluir este brainstorming de produto?')) return;
    const nextList = brainstorms.filter(entry => entry.id !== id);
    persistBrainstorms(nextList);
    if (activeId === id) {
      setActiveId(nextList[0].id);
      setIsDirty(false);
    }
  };

  const handleRename = () => {
    const name = editedName.trim();
    if (!name) return;
    persistBrainstorms(brainstorms.map(entry => (entry.id === activeId ? { ...entry, name } : entry)));
    setIsEditingName(false);
  };

  const handleExportPDF = () => {
    setIsExportingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const margin = 15;

      const newPage = () => {
        pdf.setFillColor(253, 254, 255);
        pdf.rect(0, 0, 210, 297, 'F');
        pdf.setFillColor(34, 197, 94);
        pdf.rect(0, 0, 210, 4, 'F');
      };

      newPage();

      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(board.name || 'Brainstorming de Produto', margin, 22);

      pdf.setTextColor(100, 116, 139);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text('Relatorio de ideias, clusters, priorizacao e roadmap sugerido.', margin, 28);

      let yPos = 34;

      if (board.context) {
        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(9.5);
        const contextLines = pdf.splitTextToSize(board.context, 180) as string[];
        pdf.text(contextLines, margin, yPos);
        yPos += contextLines.length * 5 + 4;
      }

      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.5);
      pdf.line(margin, yPos, 210 - margin, yPos);
      yPos += 8;

      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, yPos, 180, 16, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(margin, yPos, 180, 16);

      pdf.setTextColor(15, 23, 42);
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      pdf.text('IDEIAS:', margin + 6, yPos + 10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${board.ideas.length}`, margin + 40, yPos + 10);

      pdf.setFont('helvetica', 'bold');
      pdf.text('CLUSTERS:', margin + 65, yPos + 10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${clusters}`, margin + 100, yPos + 10);

      pdf.setFont('helvetica', 'bold');
      pdf.text('SCORE MEDIO:', margin + 118, yPos + 10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${averageScore}`, margin + 155, yPos + 10);

      yPos += 26;

      const ensureSpace = (needed: number) => {
        if (yPos + needed <= 275) return;
        pdf.addPage();
        newPage();
        yPos = 20;
      };

      const sectionTitle = (title: string, tone: [number, number, number]) => {
        ensureSpace(20);
        pdf.setTextColor(tone[0], tone[1], tone[2]);
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text(title, margin, yPos);
        pdf.setDrawColor(tone[0], tone[1], tone[2]);
        pdf.setLineWidth(0.3);
        pdf.line(margin, yPos + 2, margin + 95, yPos + 2);
        yPos += 8;
      };

      sectionTitle('BANCO DE IDEIAS', [34, 197, 94]);

      if (board.ideas.length === 0) {
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Nenhuma ideia registrada.', margin, yPos);
        yPos += 8;
      }

      board.ideas.forEach((idea, index) => {
        ensureSpace(25);
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, yPos, 180, 20, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(margin, yPos, 180, 20);

        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${index + 1}. ${idea.title}`, margin + 6, yPos + 7);

        pdf.setTextColor(100, 116, 139);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Cluster: ${idea.cluster || '-'}`, margin + 6, yPos + 13);

        pdf.setTextColor(34, 197, 94);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`SCORE: ${Number(idea.score || 0)}`, margin + 150, yPos + 13);

        yPos += 25;
      });

      sectionTitle('MATRIZ IMPACTO X ESFORCO', [24, 200, 223]);

      if (board.matrix.length === 0) {
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Nenhum quadrante registrado.', margin, yPos);
        yPos += 8;
      }

      board.matrix.forEach(item => {
        const ideasText = item.ideas?.length ? item.ideas.join(', ') : 'Sem hipoteses registradas.';
        const lines = pdf.splitTextToSize(`${item.quadrant} - ${item.hint}: ${ideasText}`, 170) as string[];
        const boxHeight = 11 + lines.length * 5;

        ensureSpace(boxHeight + 5);
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, yPos, 180, boxHeight, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(margin, yPos, 180, boxHeight);

        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(9);
        pdf.text(lines, margin + 6, yPos + 7);

        yPos += boxHeight + 5;
      });

      sectionTitle('ROADMAP SUGERIDO', [255, 122, 0]);

      if (board.roadmap.length === 0) {
        pdf.setTextColor(148, 163, 184);
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Nenhuma onda registrada.', margin, yPos);
        yPos += 8;
      }

      board.roadmap.forEach(item => {
        const bodyLines = pdf.splitTextToSize(item.text || '', 165) as string[];
        const boxHeight = 18 + bodyLines.length * 5;

        ensureSpace(boxHeight + 5);
        pdf.setFillColor(248, 250, 252);
        pdf.rect(margin, yPos, 180, boxHeight, 'F');
        pdf.setDrawColor(226, 232, 240);
        pdf.rect(margin, yPos, 180, boxHeight);

        pdf.setTextColor(255, 122, 0);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'bold');
        pdf.text(String(item.wave || '').toUpperCase(), margin + 6, yPos + 7);

        pdf.setTextColor(15, 23, 42);
        pdf.setFontSize(10);
        pdf.text(item.title, margin + 6, yPos + 13);

        pdf.setTextColor(71, 85, 105);
        pdf.setFontSize(8.5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(bodyLines, margin + 6, yPos + 19);

        yPos += boxHeight + 5;
      });

      const totalPages = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setTextColor(148, 153, 160);
        pdf.setFontSize(7.5);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`Pagina ${i} de ${totalPages}`, 170, 290);
        pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} por PMO Inteligente`, margin, 290);
      }

      pdf.save(`Brainstorming_${board.name.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error(error);
      alert('Erro ao gerar o PDF do brainstorming de produto.');
    } finally {
      setIsExportingPDF(false);
    }
  };

  useEffect(() => {
    const warnUnsaved = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => window.removeEventListener('beforeunload', warnUnsaved);
  }, [isDirty]);

  const updateIdea = (index: number, patch: Partial<ProductIdea>) => {
    mutateActive(current => ({
      ...current,
      ideas: current.ideas.map((idea, ideaIndex) => (ideaIndex === index ? { ...idea, ...patch } : idea))
    }));
  };

  const updateMatrix = (index: number, patch: Partial<MatrixQuadrant>) => {
    mutateActive(current => ({
      ...current,
      matrix: current.matrix.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    }));
  };

  const updateRoadmap = (index: number, patch: Partial<RoadmapWave>) => {
    mutateActive(current => ({
      ...current,
      roadmap: current.roadmap.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    }));
  };

  return (
    <BoardShell
      title="Brainstorming de Produto"
      subtitle="Organize hipóteses, ideias, dores, oportunidades e priorização para transformar colaboração em roadmap."
      icon={Lightbulb}
      onBack={onBack}
      saveBadge={
        <span
          className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-black ${
            isDirty
              ? 'border-[#f6b40b]/40 bg-[#f6b40b]/10 text-[#f6b40b]'
              : 'border-[#22c55e]/35 bg-[#22c55e]/10 text-[#5ee2a0]'
          }`}
        >
          <Save className="h-4 w-4" />
          {isDirty ? 'Alterações não salvas' : 'Salvo'}
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 rounded-md border border-cyan-800/40 bg-cyan-950/20 px-3 py-2 text-xs font-black text-cyan-400 transition-colors hover:bg-cyan-900/30 hover:text-cyan-300 disabled:opacity-50"
          >
            <FileDown className="h-4 w-4" />
            {isExportingPDF ? 'Gerando PDF...' : 'Visualizar em PDF'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty}
            className="flex items-center gap-2 rounded-md border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-xs font-black text-emerald-400 transition-colors hover:bg-emerald-900/30 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Salvo! ✓' : 'Salvar'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(current => !current)}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-black transition-colors ${
              isEditing
                ? 'border border-[#18c8df]/40 bg-[#18c8df]/15 text-[#5ee2a0]'
                : 'border border-[#374151] bg-[#111827] text-slate-200 hover:border-[#18c8df] hover:text-white'
            }`}
          >
            {isEditing ? <Eye className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {isEditing ? 'Concluir edição' : 'Editar'}
          </button>
          <button
            type="button"
            onClick={handleCreateNew}
            className="flex items-center gap-2 rounded-md border border-[#ff7a00]/40 bg-[#ff7a00]/10 px-3 py-2 text-xs font-black text-[#ffb15c] transition-colors hover:bg-[#ff7a00]/20"
          >
            <Plus className="h-4 w-4" />
            Novo Brainstorming de Produto
          </button>
        </div>
      }
    >
      <div className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="whitespace-nowrap text-xs font-bold text-slate-400">Brainstorming Ativo:</span>
            {isEditingName ? (
              <div className="flex max-w-md flex-1 items-center gap-2">
                <input
                  autoFocus
                  value={editedName}
                  onChange={event => setEditedName(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') handleRename();
                    if (event.key === 'Escape') setIsEditingName(false);
                  }}
                  className="flex-1 rounded-md border border-[#ff7a00] bg-[#070b16] px-2.5 py-1.5 text-sm font-semibold text-slate-100 outline-none"
                />
                <button
                  type="button"
                  onClick={handleRename}
                  className="rounded-md bg-[#ff7a00] px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-[#f6b40b]"
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 items-center gap-2">
                <select
                  value={board?.id || ''}
                  onChange={event => {
                    if (isDirty && !confirm('Há alterações não salvas neste brainstorming. Deseja trocar mesmo assim?')) return;
                    setActiveId(event.target.value);
                    setIsDirty(false);
                    setIsEditingName(false);
                  }}
                  className="max-w-[320px] rounded-md border border-[#263345] bg-[#070b16] px-3 py-1.5 text-sm font-bold text-slate-200 outline-none"
                >
                  {brainstorms.map(entry => (
                    <option key={entry.id} value={entry.id}>{entry.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(true);
                    setEditedName(board.name);
                  }}
                  className="rounded p-2 text-slate-400 transition-colors hover:bg-[#111827] hover:text-slate-200"
                  title="Editar nome do brainstorming"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(board.id)}
                  className="rounded p-2 text-slate-500 transition-colors hover:bg-[#ef4444]/15 hover:text-red-400"
                  title="Excluir brainstorming de produto"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <div className="text-xs leading-tight text-slate-500">
            Clique em <span className="font-bold text-emerald-400">Salvar</span> para persistir as alterações.
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-bold text-slate-400" htmlFor="product-brainstorm-context">
            Contexto / Problema a resolver
          </label>
          {isEditing ? (
            <textarea
              id="product-brainstorm-context"
              value={board.context}
              onChange={event => mutateActive(current => ({ ...current, context: event.target.value }))}
              rows={2}
              placeholder="Descreva o contexto, dores ou objetivos que esta sessão de brainstorm deve tratar."
              className={`${editableTextAreaClass} mt-2`}
            />
          ) : (
            <p className="mt-2 rounded-md border border-[#263345] bg-[#070b16] px-2.5 py-2 text-sm font-semibold text-slate-300">
              {board.context || 'Sem contexto registrado.'}
            </p>
          )}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Lightbulb, label: 'Ideias', value: String(board.ideas.length), tone: '#f6b40b' },
          { icon: Users, label: 'Clusters', value: String(clusters), tone: '#18c8df' },
          { icon: Gauge, label: 'Score médio', value: String(averageScore), tone: '#22c55e' },
          { icon: Wand2, label: 'Hipóteses', value: String(hypotheses), tone: '#ff7a00' }
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-4">
              <Icon className="mb-4 h-5 w-5" style={{ color: item.tone }} />
              <p className="text-3xl font-black text-white">{item.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[.95fr_1.05fr]">
        <div className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-white">Banco de ideias</h2>
            <span className="rounded-full border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-1 text-xs font-black text-[#5ee2a0]">Priorizado</span>
          </div>
          <div className="space-y-3">
            {board.ideas.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhuma ideia registrada.</p>}
            {board.ideas.map((idea, index) => (
              <div key={`${idea.title}-${index}`} className="rounded-lg border border-[#263345] bg-[#070b16] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    {isEditing ? (
                      <>
                        <input value={idea.title} onChange={event => updateIdea(index, { title: event.target.value })} className={editableInputClass} />
                        <input value={idea.cluster} onChange={event => updateIdea(index, { cluster: event.target.value })} className={editableSmallInputClass} />
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-slate-100">{idea.title || 'Sem título'}</p>
                        <p className="text-xs font-semibold text-slate-500">{idea.cluster || 'Sem cluster'}</p>
                      </>
                    )}
                  </div>
                  {isEditing ? (
                    <>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={idea.score}
                        onChange={event => updateIdea(index, { score: Number(event.target.value) })}
                        className="w-16 rounded-full border border-transparent px-2.5 py-1 text-center text-xs font-black outline-none focus:border-[#ff7a00]"
                        style={{ color: idea.color, backgroundColor: `${idea.color}16` }}
                      />
                      <button
                        type="button"
                        onClick={() => mutateActive(current => ({ ...current, ideas: current.ideas.filter((_, ideaIndex) => ideaIndex !== index) }))}
                        className={dangerIconButtonClass}
                        title="Remover ideia"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <span
                      className="rounded-full border border-transparent px-2.5 py-1 text-center text-xs font-black"
                      style={{ color: idea.color, backgroundColor: `${idea.color}16` }}
                    >
                      {Number(idea.score || 0)}
                    </span>
                  )}
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#263345]">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(0, Math.min(100, Number(idea.score || 0)))}%`,
                      background: `linear-gradient(90deg, ${idea.color}, #f6b40b)`
                    }}
                  />
                </div>
              </div>
            ))}
            {isEditing && (
              <button
                type="button"
                onClick={() => mutateActive(current => ({ ...current, ideas: [...current.ideas, { title: 'Nova ideia', cluster: 'Oportunidade', score: 70, color: '#22c55e' }] }))}
                className="w-full rounded-lg border border-dashed border-[#374151] bg-[#070b16]/60 p-3 text-sm font-black text-[#18c8df] transition-colors hover:border-[#18c8df] hover:text-[#5ee2a0]"
              >
                + Nova ideia
              </button>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-5">
          <h2 className="text-xl font-black text-white">Matriz impacto x esforço</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {board.matrix.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhum quadrante registrado.</p>}
            {board.matrix.map((item, index) => (
              <div key={`${item.quadrant}-${index}`} className="min-h-[150px] rounded-lg border border-[#263345] bg-[#070b16] p-4">
                <div className="mb-3 flex items-center justify-between">
                  {isEditing ? (
                    <input
                      value={item.quadrant}
                      onChange={event => updateMatrix(index, { quadrant: event.target.value })}
                      className="min-w-0 flex-1 bg-transparent text-sm font-black text-slate-100 outline-none focus:text-white"
                    />
                  ) : (
                    <p className="min-w-0 flex-1 text-sm font-black text-slate-100">{item.quadrant}</p>
                  )}
                  <Wand2 className="h-4 w-4" style={{ color: item.color }} />
                </div>
                {isEditing ? (
                  <input
                    value={item.hint}
                    onChange={event => updateMatrix(index, { hint: event.target.value })}
                    className="mb-4 w-full bg-transparent text-xs font-semibold text-slate-500 outline-none focus:text-slate-300"
                  />
                ) : (
                  <p className="mb-4 text-xs font-semibold text-slate-500">{item.hint}</p>
                )}
                <div className="space-y-2">
                  {(item.ideas || []).map((idea, ideaIndex) => (
                    isEditing ? (
                      <div key={`${idea}-${ideaIndex}`} className="flex items-center gap-1.5">
                        <input
                          value={idea}
                          onChange={event => updateMatrix(index, { ideas: item.ideas.map((current, currentIndex) => (currentIndex === ideaIndex ? event.target.value : current)) })}
                          className="w-full rounded-md border px-3 py-2 text-xs font-bold text-slate-300 outline-none focus:border-[#ff7a00]"
                          style={{ borderColor: `${item.color}33`, backgroundColor: `${item.color}10` }}
                        />
                        <button
                          type="button"
                          onClick={() => updateMatrix(index, { ideas: item.ideas.filter((_, currentIndex) => currentIndex !== ideaIndex) })}
                          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md border border-[#374151] bg-[#111827] text-slate-500 transition-colors hover:border-[#ef4444] hover:text-[#ef4444]"
                          title="Remover hipótese"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <p
                        key={`${idea}-${ideaIndex}`}
                        className="rounded-md border px-3 py-2 text-xs font-bold text-slate-300"
                        style={{ borderColor: `${item.color}33`, backgroundColor: `${item.color}10` }}
                      >
                        {idea}
                      </p>
                    )
                  ))}
                  {isEditing && (
                    <button
                      type="button"
                      onClick={() => updateMatrix(index, { ideas: [...(item.ideas || []), 'Nova hipótese'] })}
                      className="text-xs font-black text-[#18c8df] hover:text-[#5ee2a0]"
                    >
                      + Hipótese
                    </button>
                  )}
                </div>
                {isEditing && board.matrix.length > 1 && (
                  <button
                    type="button"
                    onClick={() => mutateActive(current => ({ ...current, matrix: current.matrix.filter((_, matrixIndex) => matrixIndex !== index) }))}
                    className="mt-3 text-xs font-black text-slate-600 hover:text-[#ef4444]"
                  >
                    Remover quadrante
                  </button>
                )}
              </div>
            ))}
            {isEditing && (
              <button
                type="button"
                onClick={() => mutateActive(current => ({ ...current, matrix: [...current.matrix, { quadrant: 'Novo quadrante', hint: 'Descreva o critério', ideas: ['Nova hipótese'], color: '#18c8df' }] }))}
                className="min-h-[150px] rounded-lg border border-dashed border-[#374151] bg-[#070b16]/60 p-4 text-sm font-black text-[#18c8df] transition-colors hover:border-[#18c8df] hover:text-[#5ee2a0]"
              >
                + Novo quadrante
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[#263345] bg-[#0b1020]/88 p-5">
        <h2 className="text-xl font-black text-white">Roadmap sugerido</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {board.roadmap.length === 0 && <p className="py-6 text-center text-sm text-slate-500">Nenhuma onda registrada.</p>}
          {board.roadmap.map((item, index) => (
            <div key={`${item.wave}-${index}`} className="rounded-lg border border-[#263345] bg-[#070b16] p-4">
              {isEditing ? (
                <input
                  value={item.wave}
                  onChange={event => updateRoadmap(index, { wave: event.target.value })}
                  className="w-28 rounded-full border border-transparent px-3 py-1 text-[11px] font-black uppercase tracking-wide outline-none focus:border-[#ff7a00]"
                  style={{ color: item.color, backgroundColor: `${item.color}14` }}
                />
              ) : (
                <span
                  className="inline-block w-28 rounded-full border border-transparent px-3 py-1 text-[11px] font-black uppercase tracking-wide"
                  style={{ color: item.color, backgroundColor: `${item.color}14` }}
                >
                  {item.wave}
                </span>
              )}
              {isEditing ? (
                <>
                  <input
                    value={item.title}
                    onChange={event => updateRoadmap(index, { title: event.target.value })}
                    className="mt-4 w-full bg-transparent text-base font-black text-slate-100 outline-none focus:text-white"
                  />
                  <textarea
                    value={item.text}
                    onChange={event => updateRoadmap(index, { text: event.target.value })}
                    rows={3}
                    className={`${editableTextAreaClass} mt-2`}
                  />
                </>
              ) : (
                <>
                  <p className="mt-4 text-base font-black text-slate-100">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{item.text}</p>
                </>
              )}
              {isEditing && (
                <button
                  type="button"
                  onClick={() => mutateActive(current => ({ ...current, roadmap: current.roadmap.filter((_, roadmapIndex) => roadmapIndex !== index) }))}
                  className="mt-3 text-xs font-black text-slate-600 hover:text-[#ef4444]"
                >
                  Remover onda
                </button>
              )}
            </div>
          ))}
          {isEditing && (
            <button
              type="button"
              onClick={() => mutateActive(current => ({ ...current, roadmap: [...current.roadmap, { wave: 'Nova onda', title: 'Nova entrega', text: 'Descreva a próxima entrega do roadmap.', color: '#18c8df' }] }))}
              className="min-h-[170px] rounded-lg border border-dashed border-[#374151] bg-[#070b16]/60 p-4 text-sm font-black text-[#18c8df] transition-colors hover:border-[#18c8df] hover:text-[#5ee2a0]"
            >
              + Nova onda
            </button>
          )}
        </div>
      </section>
    </BoardShell>
  );
}
