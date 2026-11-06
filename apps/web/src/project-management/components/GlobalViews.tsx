import React, { useEffect, useState } from 'react';
import {
  Home, CheckCircle2, FileText, LayoutTemplate, Clock, Calendar,
  Search, Plus, Filter, List, Sparkles, ArrowLeft,
  BarChart2, Briefcase, Users, ArrowUpRight, Target, GitBranch, AlertTriangle,
  ClipboardCheck, Lightbulb, Gauge, Layers3, TimerReset, Route, Wand2, Trash2, RotateCcw, Save,
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
    'PENDENTE': '#94a3b8', 'PLANEJAMENTO': '#18c8df', 'EM PROGRESSO': '#2563eb',
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
          <span><i style="background:#2563eb"></i> Em andamento</span>
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
    .primary { background: #2563eb; color: #fff; }
    .secondary { background: #263345; color: #fff; }
    .page { width: 210mm; min-height: 297mm; margin: 18px auto; padding: 18mm; background: #fff; box-shadow: 0 20px 45px rgba(15,23,42,.2); }
    .hero { border-bottom: 4px solid #2563eb; padding-bottom: 18px; margin-bottom: 18px; }
    .eyebrow { color: #2563eb; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
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
    .gantt-header .icon { color: #2563eb; }
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
    <div className="h-full bg-transparent overflow-y-auto p-8 text-[var(--crm-ink)] custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[var(--crm-ink)] flex items-center gap-3">
            <Home className="w-6 h-6 text-[#2563eb]" />
            Início
          </h1>
          <div className="hidden items-center gap-2 rounded-full border border-[var(--crm-border)] bg-[var(--crm-surface)] px-4 py-2 text-xs font-semibold text-[var(--crm-muted)] md:flex">
            <Sparkles className="h-4 w-4 text-[#18c8df]" />
            Central executiva de projetos
          </div>
        </div>

        <section className="relative min-h-[300px] overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)]">
          <img
            src="https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80"
            alt="Equipe em sala de planejamento de projetos"
            className="absolute inset-0 h-full w-full object-cover opacity-35"
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(var(--crm-surface-2-rgb)_/_1)_0%,rgb(var(--crm-surface-2-rgb)_/_0.92)_34%,rgb(var(--crm-surface-2-rgb)_/_0.58)_100%)]" />
          <div className="relative z-10 grid min-h-[300px] gap-6 p-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="flex max-w-3xl flex-col justify-center">
              <span className="mb-4 flex w-fit items-center gap-2 rounded-full border border-[#2563eb]/35 bg-[#2563eb]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[var(--pm-accent-text)]">
                <Briefcase className="h-3.5 w-3.5" />
                Gestão de Projetos
              </span>
              <h2 className="text-4xl font-black leading-tight text-[rgb(var(--crm-ink-rgb)_/_1)]">
                Todos os projetos existentes em uma visão única.
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--crm-ink)]">
                Visualize, edite ou exclua projetos sem misturar fases entre iniciativas.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onCreateProject}
                  className="flex items-center gap-2 rounded-md bg-[#2563eb] px-5 py-2.5 text-sm font-black text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[#1d4ed8] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                >
                  <Plus className="h-4 w-4" />
                  Novo projeto
                </button>
                <button
                  type="button"
                  onClick={onOpenDashboard}
                  className="flex items-center gap-2 rounded-md border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)/0.8)] px-5 py-2.5 text-sm font-bold text-[var(--crm-ink)] transition-colors hover:border-[#2563eb] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
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
                  <div key={label} className="rounded-lg border border-[var(--crm-border)] bg-transparent p-4 backdrop-blur">
                    <p className="text-2xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]" style={{ color }}>{value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase text-[var(--crm-muted)]">{label}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-[var(--crm-border)] bg-transparent p-5 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-[var(--crm-ink)]">Projeto em destaque</p>
                    <p className="text-xs text-[var(--crm-muted)]">{projects[0]?.client || projects[0]?.name || 'Nenhum projeto cadastrado'}</p>
                  </div>
                  <span className="rounded-full bg-[#22c55e]/10 px-3 py-1 text-xs font-bold text-[#22c55e]">{projects[0]?.status || 'Novo'}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--crm-surface-2)]">
                  <div className="h-full w-[68%] rounded-full bg-[linear-gradient(90deg,#2563eb,#f6b40b,#22c55e)]" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="font-black text-[var(--crm-ink)]">{projects[0]?.type || '-'}</p>
                    <p className="text-[var(--crm-muted)]">Tipo</p>
                  </div>
                  <div>
                    <p className="font-black text-[var(--crm-ink)]">{projects[0] ? getPhaseCount?.(projects[0].id) || 0 : 0}</p>
                    <p className="text-[var(--crm-muted)]">Fases</p>
                  </div>
                  <div>
                    <p className="font-black text-[var(--crm-ink)]">{projects[0]?.manager || '-'}</p>
                    <p className="text-[var(--crm-muted)]">Gestor</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)]">
          <div className="flex flex-col gap-3 border-b border-[var(--crm-border)] p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-black text-[var(--crm-ink)]">Relação de projetos</h2>
              <p className="mt-1 text-sm text-[var(--crm-muted)]">{projects.length} projeto{projects.length !== 1 ? 's' : ''} encontrado{projects.length !== 1 ? 's' : ''}.</p>
            </div>
            <button
              type="button"
              onClick={onCreateProject}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-black text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[#1d4ed8] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
            >
              <Plus className="h-4 w-4" />
              Novo projeto
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="p-10 text-center">
              <Briefcase className="mx-auto mb-3 h-10 w-10 text-[#2563eb]" />
              <h3 className="text-base font-black text-[var(--crm-ink)]">Nenhum projeto cadastrado</h3>
              <p className="mt-2 text-sm text-[var(--crm-muted)]">Crie o primeiro projeto para iniciar o planejamento.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-[var(--crm-border)] text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">
                  <tr>
                    <th className="px-5 py-3">Projeto</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Fases</th>
                    <th className="px-5 py-3">Gestor</th>
                    <th className="px-5 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--crm-border)]">
                  {projects.map((project) => (
                    <tr key={project.id} className="transition-colors hover:bg-[var(--crm-surface-2)]">
                      <td className="px-5 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-black text-[rgb(var(--crm-ink-rgb)_/_1)] ${project.color}`}>
                            {project.initial}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-black text-[var(--crm-ink)]">{project.name}</p>
                            <p className="mt-0.5 truncate text-xs text-[var(--crm-muted)]">{project.number || project.type || 'Projeto'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-[var(--crm-ink)]">{project.client || 'Nao informado'}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-[#2563eb]/35 bg-[#2563eb]/10 px-2.5 py-1 text-[11px] font-black text-[var(--pm-accent-text)]">
                          {project.status || 'PLANEJADO'}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-black text-[#22c55e]">{getPhaseCount?.(project.id) || 0}</td>
                      <td className="px-5 py-4 text-[var(--crm-ink)]">{project.manager || 'Nao definido'}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              openProjectPdfPreview(project);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--crm-border)] bg-transparent px-3 py-1.5 text-xs font-bold text-[var(--crm-ink)] transition-colors hover:border-[#18c8df] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                          >
                            <Eye className="h-3.5 w-3.5 text-[#18c8df]" />
                            Visualizar
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditProject?.(project.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--crm-border)] bg-transparent px-3 py-1.5 text-xs font-bold text-[var(--crm-ink)] transition-colors hover:border-[#f6b40b] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                          >
                            <Pencil className="h-3.5 w-3.5 text-[#f6b40b]" />
                            Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteProject?.(project.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--crm-border)] bg-transparent px-3 py-1.5 text-xs font-bold text-[var(--crm-ink)] transition-colors hover:border-red-500 hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-700 dark:text-red-400" />
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
            { icon: Target, title: 'Escopo claro', text: 'Cada projeto começa com objetivo, escopo, entregáveis, critérios de sucesso e responsáveis.', color: 'text-[#2563eb]' },
            { icon: Users, title: 'Equipe conectada', text: 'Convites por e-mail, papéis definidos e acompanhamento das pessoas envolvidas.', color: 'text-[#22c55e]' },
            { icon: ArrowUpRight, title: 'Visão executiva', text: 'Indicadores, fases e decisões ficam em evidência para acelerar a tomada de decisão.', color: 'text-[#18c8df]' }
          ].map(item => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
                <Icon className={`mb-4 h-6 w-6 ${item.color}`} />
                <h3 className="text-base font-black text-[var(--crm-ink)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--crm-muted)]">{item.text}</p>
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
    <div className="h-full bg-transparent overflow-y-auto p-8 text-[var(--crm-ink)]">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[var(--crm-ink)] flex items-center gap-3">
            <Calendar className="w-6 h-6 text-[#22c55e]" />
            Planejado
          </h1>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 text-sm text-[var(--crm-muted)] hover:text-[var(--crm-ink)] bg-[var(--crm-surface)] border border-[var(--crm-border)] px-3 py-1.5 rounded-md transition-colors">
              <Calendar className="w-4 h-4" /> Hoje
            </button>
            <button
              type="button"
              onClick={onCreateProject}
              className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[#2563eb] hover:bg-[#1d4ed8] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] px-3 py-1.5 rounded-md transition-colors font-medium"
            >
              <Plus className="w-4 h-4" /> Novo Projeto
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="text-sm font-semibold text-[var(--crm-muted)] uppercase tracking-wider">Projetos planejados</h2>
                <p className="mt-1 text-xs text-[var(--crm-muted)]">{plannedProjects.length} projeto{plannedProjects.length !== 1 ? 's' : ''} aguardando inicio.</p>
              </div>
              <span className="rounded-full border border-[#22c55e]/30 bg-[#22c55e]/10 px-3 py-1 text-xs font-black text-[#22c55e]">
                PLANEJADO
              </span>
            </div>

            {plannedProjects.length === 0 ? (
              <div className="bg-[var(--crm-surface)] border border-[var(--crm-border)] rounded-md p-8 flex flex-col items-center justify-center min-h-[250px] text-center">
                <div className="w-16 h-16 bg-[#22c55e]/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#22c55e]" />
                </div>
                <h2 className="text-lg font-semibold text-[var(--crm-ink)] mb-2">Nenhum projeto planejado</h2>
                <p className="text-[var(--crm-muted)] max-w-sm">Crie um projeto novo ou converta uma oportunidade ganha para iniciar o planejamento.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {plannedProjects.map((project) => (
                  <article key={project.id} className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {project.number && (
                            <span className="rounded-full border border-[#18c8df]/35 bg-[#18c8df]/10 px-2.5 py-1 text-[11px] font-black text-[#18c8df]">
                              {project.number}
                            </span>
                          )}
                          <span className="rounded-full border border-[#2563eb]/35 bg-[#2563eb]/10 px-2.5 py-1 text-[11px] font-black text-[var(--pm-accent-text)]">
                            {project.type || 'Projeto'}
                          </span>
                        </div>
                        <h3 className="truncate text-lg font-black text-[var(--crm-ink)]">{project.name}</h3>
                        <p className="mt-1 text-sm text-[var(--crm-muted)]">{project.client || 'Cliente nao informado'}</p>
                        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-[var(--crm-ink)]">{project.scope || project.objective || 'Escopo ainda nao informado.'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenProject?.(project.id)}
                        className="flex shrink-0 items-center justify-center gap-2 rounded-md border border-[var(--crm-border)] bg-transparent px-3 py-2 text-sm font-bold text-[var(--crm-ink)] transition-colors hover:border-[#2563eb] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
                      >
                        Abrir <ArrowUpRight className="h-4 w-4 text-[#2563eb]" />
                      </button>
                    </div>
                    <div className="mt-5 grid gap-3 text-xs md:grid-cols-3">
                      <div className="rounded-md border border-[var(--crm-border)] bg-transparent p-3">
                        <p className="font-bold uppercase text-[var(--crm-muted)]">Inicio previsto</p>
                        <p className="mt-1 font-black text-[var(--crm-ink)]">{plannedDateLabel(project.startDate)}</p>
                      </div>
                      <div className="rounded-md border border-[var(--crm-border)] bg-transparent p-3">
                        <p className="font-bold uppercase text-[var(--crm-muted)]">Fim previsto</p>
                        <p className="mt-1 font-black text-[var(--crm-ink)]">{plannedDateLabel(project.endDate)}</p>
                      </div>
                      <div className="rounded-md border border-[var(--crm-border)] bg-transparent p-3">
                        <p className="font-bold uppercase text-[var(--crm-muted)]">Gestor</p>
                        <p className="mt-1 truncate font-black text-[var(--crm-ink)]">{project.manager || 'Nao definido'}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-[var(--crm-muted)] uppercase tracking-wider">Para Hoje</h2>
            <div className="bg-[var(--crm-surface)] border border-[var(--crm-border)] rounded-md p-4 flex flex-col gap-3">
              {todayIssues.length === 0 ? (
                <p className="text-sm text-[var(--crm-muted)]">Nenhuma fase planejada para hoje.</p>
              ) : todayIssues.map((issue) => (
                <div key={issue.id} className="flex gap-3 rounded-md border border-[var(--crm-border)] bg-transparent p-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[#22c55e]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--crm-ink)]">{issue.title}</p>
                    <p className="text-xs text-[var(--crm-muted)]">{issue.assignee?.name || 'Sem responsavel'}</p>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-sm font-semibold text-[var(--crm-muted)] uppercase tracking-wider">Atrasadas</h2>
            <div className="bg-[var(--crm-surface)] border border-[var(--crm-border)] rounded-md p-6 text-center text-[var(--crm-muted)] text-sm">
              {overdueIssues.length === 0 ? 'Nenhuma tarefa em atraso.' : `${overdueIssues.length} tarefa${overdueIssues.length !== 1 ? 's' : ''} em atraso.`}
            </div>

            <h2 className="text-sm font-semibold text-[var(--crm-muted)] uppercase tracking-wider mt-4">Próximos 7 dias</h2>
            <div className="bg-[var(--crm-surface)] border border-[var(--crm-border)] rounded-md p-4 flex flex-col gap-3">
              {nextIssues.length === 0 ? (
                <p className="text-sm text-[var(--crm-muted)]">Nenhuma fase prevista nos próximos dias.</p>
              ) : nextIssues.map((issue) => (
                <div key={issue.id} className="flex gap-3 p-2 rounded-lg border border-transparent transition-colors hover:border-[var(--crm-border)] hover:bg-transparent">
                  <div className="w-8 h-8 rounded bg-[#2563eb]/10 text-[#2563eb] flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-[var(--crm-ink)] truncate">{issue.title}</p>
                    <p className="text-xs text-[var(--crm-muted)]">{plannedDateLabel(issue.dueDate)}</p>
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
    <div className="h-full bg-transparent overflow-y-auto p-8 text-[var(--crm-ink)]">
      <div className="max-w-7xl mx-auto flex flex-col h-full">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[var(--crm-ink)] flex items-center gap-3">
            <FileText className="w-6 h-6 text-[#2563eb]" />
            Documentos
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={(event) => onProjectChange?.(event.target.value)}
              className="bg-[var(--crm-surface)] border border-[var(--crm-border)] text-sm font-semibold text-[var(--crm-ink)] rounded-md px-3 py-1.5 focus:outline-none focus:border-[#2563eb] min-w-[240px]"
            >
              {projects.length === 0 ? (
                <option value="">Nenhum projeto</option>
              ) : projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
            <div className="relative">
              <Search className="w-4 h-4 text-[var(--crm-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar documentos..."
                className="bg-[var(--crm-surface)] border border-[var(--crm-border)] text-sm text-[var(--crm-ink)] rounded-md pl-9 pr-4 py-1.5 focus:outline-none focus:border-[#2563eb] w-64"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-md border border-[#2563eb]/40 bg-[#2563eb]/10 px-4 py-3 text-sm font-semibold text-[var(--pm-accent-text)]">
            {error}
          </div>
        )}

        {!selectedProjectId ? (
          <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-10 text-center">
            <FileText className="mx-auto mb-4 h-12 w-12 text-[#2563eb]" />
            <h2 className="text-lg font-black text-[var(--crm-ink)]">Nenhum projeto disponível</h2>
            <p className="mt-2 text-sm text-[var(--crm-muted)]">Crie um projeto para organizar contratos, atas, entregáveis e evidências.</p>
            {onCreateProject && (
              <button
                type="button"
                onClick={onCreateProject}
                className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#2563eb] px-4 py-2 text-sm font-black text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[#1d4ed8] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
              >
                <Plus className="h-4 w-4" />
                Novo Projeto
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6 rounded-lg border border-[var(--crm-border)] bg-[linear-gradient(140deg,rgba(37,99,235,0.14),rgb(var(--crm-surface-rgb)/0.98))] p-5">
              <div className="grid gap-4 lg:grid-cols-[220px_1fr_auto] lg:items-end">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">Tipo do documento</span>
                  <select
                    value={uploadCategory}
                    onChange={(event) => setUploadCategory(event.target.value)}
                    className="h-11 rounded-md border border-[var(--crm-border)] bg-transparent px-3 text-sm font-semibold text-[var(--crm-ink)] outline-none transition-colors focus:border-[#22c55e]"
                  >
                    {DOCUMENT_CATEGORIES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">Do que se trata</span>
                  <input
                    type="text"
                    value={documentDescription}
                    onChange={(event) => setDocumentDescription(event.target.value)}
                    placeholder="Ex.: Ata do kickoff externo, proposta aprovada, aceite da fase 1..."
                    className="h-11 rounded-md border border-[var(--crm-border)] bg-transparent px-3 text-sm font-semibold text-[var(--crm-ink)] outline-none transition-colors placeholder:text-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-[#2563eb]"
                  />
                </label>
                <label className={`flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-black text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors ${selectedProjectId && !saving ? "bg-[#2563eb] hover:bg-[#1d4ed8] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] cursor-pointer" : "bg-[rgb(var(--crm-surface-rgb)_/_1)] cursor-not-allowed opacity-70"}`}>
                  <Upload className="w-4 h-4" />
                  {saving ? 'Enviando...' : 'Enviar documento'}
                  <input type="file" className="hidden" disabled={!selectedProjectId || saving} onChange={handleUpload} />
                </label>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-[var(--crm-border)] bg-[linear-gradient(140deg,rgba(37,99,235,0.18),rgb(var(--crm-surface-rgb)/0.98))] p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">Projeto</p>
                <p className="mt-2 truncate text-base font-black text-[var(--crm-ink)]">{selectedProject?.name || 'Projeto'}</p>
                <p className="mt-1 text-xs text-[var(--pm-accent-text)]">{selectedProject?.number || selectedProject?.status || 'Documento'}</p>
              </div>
              <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">Total</p>
                <p className="mt-2 text-2xl font-black text-[var(--crm-ink)]">{documents.length}</p>
              </div>
              <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">Contratos/Aceites</p>
                <p className="mt-2 text-2xl font-black text-[#22c55e]">{documents.filter((item) => ['CONTRACT', 'ACCEPTANCE'].includes(item.category)).length}</p>
              </div>
              <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
                <p className="text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">Entregaveis</p>
                <p className="mt-2 text-2xl font-black text-[#18c8df]">{documents.filter((item) => item.category === 'DELIVERABLE').length}</p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-8 text-center text-sm font-semibold text-[var(--crm-muted)]">
                Carregando documentos...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--crm-border)] bg-[var(--crm-surface)] p-10 text-center">
                <Upload className="mx-auto mb-4 h-12 w-12 text-[#2563eb]" />
                <h2 className="text-lg font-black text-[var(--crm-ink)]">Nenhum documento encontrado</h2>
                <p className="mt-2 text-sm text-[var(--crm-muted)]">Envie contratos, atas, entregáveis, evidências e aceites do projeto selecionado.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {groupedDocuments.map((group) => (
                  <section key={group.value} className="overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)]">
                    <div className="flex items-center justify-between border-b border-[var(--crm-border)] bg-[var(--crm-surface-2)] px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#18c8df]/10 text-[#18c8df]">
                          <FileText className="h-4 w-4" />
                        </span>
                        <div>
                          <h3 className="text-sm font-black uppercase tracking-wide text-[var(--crm-ink)]">{group.label}</h3>
                          <p className="text-xs text-[var(--crm-muted)]">{group.documents.length} documento{group.documents.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <div className="grid min-w-[900px] grid-cols-[1.15fr_1.1fr_.35fr_.45fr_.3fr] gap-4 border-b border-[var(--crm-border)] px-5 py-3 text-[11px] font-black uppercase tracking-wide text-[var(--crm-muted)]">
                        <span>Arquivo</span>
                        <span>Do que se trata</span>
                        <span>Tamanho</span>
                        <span>Enviado em</span>
                        <span className="text-right">Acoes</span>
                      </div>
                      <div className="divide-y divide-[var(--crm-border)]">
                        {group.documents.map((document) => (
                          <div key={document.id} className="grid min-w-[900px] grid-cols-[1.15fr_1.1fr_.35fr_.45fr_.3fr] items-center gap-4 px-5 py-4 text-sm">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#2563eb]/10 text-[#2563eb]">
                                <FileText className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-black text-[var(--crm-ink)]">{document.originalName}</p>
                                <p className="truncate text-xs text-[var(--crm-muted)]">{document.mimeType || 'Arquivo'}</p>
                              </div>
                            </div>
                            <p className="line-clamp-2 text-sm leading-relaxed text-[var(--crm-ink)]">
                              {document.description || 'Sem descrição informada.'}
                            </p>
                            <span className="text-[var(--crm-muted)]">{formatFileSize(document.size)}</span>
                            <span className="text-[var(--crm-muted)]">{new Date(document.createdAt).toLocaleDateString('pt-BR')}</span>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleDownload(document)}
                                className="rounded-md border border-[var(--crm-border)] bg-transparent p-2 text-[var(--crm-muted)] transition-colors hover:border-[#22c55e] hover:text-[#22c55e]"
                                title="Baixar"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(document)}
                                className="rounded-md border border-[var(--crm-border)] bg-transparent p-2 text-[var(--crm-muted)] transition-colors hover:border-[#ef4444] hover:text-[#ef4444]"
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

  if (activeBoard === 'Mapeamento de Processo' || activeBoard === 'Mapeamento de Processos' || activeBoard?.startsWith('Mapeamento de Processo') || activeBoard?.startsWith('Mapeamento de Processos')) {
    return <ProcessMappingBoard activeProject={activeProject} onBack={() => setActiveBoard(null)} />;
  }

  if (activeBoard === 'Brainstorming de Produto') {
    return <ProductBrainstormBoard onBack={() => setActiveBoard(null)} />;
  }

  if (activeBoard) {
    return (
      <div className="h-full flex flex-col bg-transparent overflow-hidden">
        <div className="h-14 border-b border-[var(--crm-border)] bg-[var(--crm-surface)] flex items-center px-4 flex-shrink-0 gap-4">
          <button
            onClick={() => setActiveBoard(null)}
            className="flex items-center gap-2 text-[var(--crm-muted)] hover:text-[var(--crm-ink)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar
          </button>
          <div className="w-px h-6 bg-[var(--crm-border)]"></div>
          <h2 className="text-[var(--crm-ink)] font-semibold">{activeBoard}</h2>
        </div>
        <div className="flex-1 relative">
          <Tldraw />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-transparent overflow-y-auto p-8 text-[var(--crm-ink)]">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-[var(--crm-ink)] flex items-center gap-3">
            <LayoutTemplate className="w-6 h-6 text-[#2563eb]" />
            Quadros Mágicos
          </h1>
          <button
            onClick={() => setActiveBoard('Novo Quadro em Branco')}
            className="flex items-center gap-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[#2563eb] hover:bg-[#1d4ed8] px-4 py-2 rounded-md transition-colors font-medium"
          >
            <Plus className="w-4 h-4" /> Novo Quadro
          </button>
        </div>

        {/* Hero Section */}
        <div className="relative bg-gradient-to-br from-[rgb(var(--crm-surface-2-rgb)_/_1)] to-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded-lg p-10 mb-8 overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10 flex flex-col items-start max-w-lg">
            <div className="bg-[#2563eb]/20 text-[#2563eb] text-xs font-bold px-3 py-1 rounded-full mb-4 border border-[#2563eb]/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> NOVO
            </div>
            <h2 className="text-3xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-3">Colabore de forma visual</h2>
            <p className="text-[var(--crm-muted)] mb-6 text-sm leading-relaxed">
              Use Quadros Mágicos para desenhar fluxos de projeto, arquiteturas de sistema, ou fazer brainstorming em tempo real com toda a sua equipe.
            </p>
            <button
              onClick={() => setActiveBoard('Playground Visual')}
              className="bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] px-5 py-2.5 rounded-lg text-sm font-bold shadow-lg hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors"
            >
              Experimentar Agora
            </button>
          </div>

          <div className="absolute -right-20 -bottom-20 opacity-40 pointer-events-none">
            <LayoutTemplate className="w-96 h-96 text-[#2563eb]" />
          </div>
        </div>

        {/* Templates */}
        <h2 className="text-sm font-semibold text-[var(--crm-muted)] uppercase tracking-wider mb-4">Templates Populares</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Mapeamento de Processos',
              subtitle: 'Fluxo, gargalos e responsáveis',
              icon: GitBranch,
              color: '#2563eb',
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
              className="group cursor-pointer overflow-hidden rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] transition-colors hover:border-[#2563eb]"
            >
              <div className="relative h-32 border-b border-[var(--crm-border)] bg-transparent p-4">
                <div className="absolute inset-0 opacity-80" style={{ background: `radial-gradient(circle at 20% 10%, ${template.color}22, transparent 34%)` }} />
                <div className="relative grid h-full grid-cols-4 items-center gap-2">
                  {template.preview.map((label, index) => (
                    <div key={label} className="min-w-0">
                      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg border" style={{ borderColor: `${template.color}55`, backgroundColor: `${template.color}18`, color: template.color }}>
                        {index === 0 ? <Icon className="h-4 w-4" /> : <span className="text-xs font-black">{index + 1}</span>}
                      </div>
                      <div className="h-1 rounded-full bg-[var(--crm-border)]">
                        <div className="h-full rounded-full" style={{ width: `${72 - index * 10}%`, backgroundColor: template.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-4">
                <h3 className="text-sm font-black text-[var(--crm-ink)] transition-colors group-hover:text-[var(--pm-accent-text)]">{template.title}</h3>
                <p className="mt-1 text-xs text-[var(--crm-muted)]">{template.subtitle}</p>
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

const editableInputClass = "w-full rounded-md border border-[var(--crm-border)] bg-transparent px-2.5 py-2 text-sm font-semibold text-[var(--crm-ink)] outline-none transition-colors placeholder:text-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-[#2563eb]";
const editableSmallInputClass = "w-full rounded-md border border-[var(--crm-border)] bg-transparent px-2 py-1.5 text-xs font-semibold text-[var(--crm-ink)] outline-none transition-colors placeholder:text-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-[#2563eb]";
const editableTextAreaClass = "w-full resize-none rounded-md border border-[var(--crm-border)] bg-transparent px-2.5 py-2 text-sm font-semibold leading-relaxed text-[var(--crm-ink)] outline-none transition-colors placeholder:text-[rgb(var(--crm-muted-rgb)_/_1)] focus:border-[#2563eb]";
const boardActionButtonClass = "flex items-center gap-2 rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface)] px-3 py-2 text-xs font-black text-[var(--crm-ink)] transition-colors hover:border-[#2563eb] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]";
const dangerIconButtonClass = 'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-muted)] transition-colors hover:border-[#ef4444] hover:text-[#ef4444]';

const PROCESS_DEFAULT_BOARD: { steps: ProcessStep[]; swimlanes: Swimlane[]; actions: string[] } = {
  steps: [
    { title: 'Entrada', owner: 'Comercial', time: '1 dia', status: 'OK', color: '#18c8df', items: ['Pedido recebido', 'Dados mínimos', 'Prioridade inicial'] },
    { title: 'Triagem', owner: 'PMO', time: '2 dias', status: 'Atenção', color: '#f6b40b', items: ['Escopo validado', 'Dependências', 'Critérios de aceite'] },
    { title: 'Execução', owner: 'Operações', time: '5 dias', status: 'Em curso', color: '#2563eb', items: ['Tarefas abertas', 'Bloqueios visíveis', 'Evidências'] },
    { title: 'Validação', owner: 'Cliente', time: '2 dias', status: 'Risco', color: '#ef4444', items: ['Homologação', 'Correções', 'Aceite formal'] },
    { title: 'Encerramento', owner: 'CS', time: '1 dia', status: 'Pronto', color: '#22c55e', items: ['Ata final', 'Documentação', 'Próximo ciclo'] }
  ],
  swimlanes: [
    { area: 'Cliente', entries: ['Enviar requisitos', 'Validar solução', 'Aprovar aceite'], color: '#22c55e' },
    { area: 'Comercial', entries: ['Registrar oportunidade', 'Confirmar contrato', 'Comunicar mudança'], color: '#2563eb' },
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
    { title: 'Resumo automático de reuniões', cluster: 'Produtividade', score: 81, color: '#2563eb' }
  ],
  matrix: [
    { quadrant: 'Apostar agora', hint: 'Alto impacto · baixo esforço', ideas: ['Ata automática', 'Templates por fase'], color: '#22c55e' },
    { quadrant: 'Planejar', hint: 'Alto impacto · alto esforço', ideas: ['Portal do cliente', 'Integração BI'], color: '#f6b40b' },
    { quadrant: 'Quick wins', hint: 'Baixo impacto · baixo esforço', ideas: ['Tags inteligentes', 'Favoritos'], color: '#18c8df' },
    { quadrant: 'Evitar agora', hint: 'Baixo impacto · alto esforço', ideas: ['Customização extrema'], color: '#2563eb' }
  ],
  roadmap: [
    { wave: 'Onda 1', title: 'Validar valor', text: 'Protótipos rápidos, entrevistas e métricas de adoção.', color: '#22c55e' },
    { wave: 'Onda 2', title: 'Construir MVP', text: 'Fluxos essenciais, integrações mínimas e telemetria.', color: '#f6b40b' },
    { wave: 'Onda 3', title: 'Escalar produto', text: 'Automação, governança, permissões e expansão comercial.', color: '#2563eb' }
  ]
};

function cloneBoard<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function loadBoard<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return cloneBoard(fallback);
  const stored = window.localStorage.getItem(key);
  if (!stored) return cloneBoard(fallback);
  try {
    return JSON.parse(stored) as T;
  } catch {
    return cloneBoard(fallback);
  }
}

function BoardShell({
  title,
  subtitle,
  icon: Icon,
  onBack,
  actions,
  children
}: {
  title: string;
  subtitle: string;
  icon: any;
  onBack: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full overflow-y-auto bg-transparent p-6 text-[var(--crm-ink)] custom-scrollbar">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-5 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <button
              onClick={onBack}
              className="mt-1 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] text-[var(--crm-muted)] transition-colors hover:border-[#2563eb] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
              title="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#2563eb]/14 text-[#2563eb] ring-1 ring-[#2563eb]/35">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-1 text-[11px] font-black uppercase tracking-wide text-[#5ee2a0]">
                  Quadro inteligente
                </span>
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[rgb(var(--crm-ink-rgb)_/_1)]">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--crm-muted)]">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-2 rounded-md border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-2 text-xs font-black text-[#5ee2a0]">
              <Save className="h-4 w-4" />
              Autosalvo
            </span>
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
        const hexColor = step.color || '#2563eb';
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
      title="Mapeamento de Processos"
      subtitle="Visualize etapas, donos, tempos, gargalos e ações para transformar um processo solto em um fluxo governado."
      icon={GitBranch}
      onBack={onBack}
      actions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="flex items-center gap-2 rounded-md border border-cyan-200/40 dark:border-cyan-800/40 bg-cyan-50/20 dark:bg-cyan-950/20 hover:bg-cyan-50/30 dark:hover:bg-cyan-900/30 px-3 py-2 text-xs font-black text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 transition-colors"
          >
            <FileDown className="h-4 w-4" />
            {isExportingPDF ? 'Gerando PDF...' : 'Visualizar em PDF'}
          </button>
          <button
            type="button"
            onClick={handleSaveProcess}
            className="flex items-center gap-2 rounded-md border border-emerald-200/40 dark:border-emerald-800/40 bg-emerald-50/20 dark:bg-emerald-950/20 hover:bg-emerald-50/30 dark:hover:bg-emerald-900/30 px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            <Save className="h-4 w-4" />
            {saveStatus === 'saving' ? 'Salvando...' : saveStatus === 'saved' ? 'Processo Salvo! ✓' : 'Salvar Processo'}
          </button>
          <button type="button" onClick={addStep} className={boardActionButtonClass}>
            <Plus className="h-4 w-4" />
            Etapa
          </button>
          <button type="button" onClick={handleCreateNewProcess} className="flex items-center gap-2 rounded-md border border-[#2563eb]/40 bg-[#2563eb]/10 hover:bg-[#2563eb]/20 px-3 py-2 text-xs font-black text-[var(--pm-accent-text)] transition-colors">
            <Plus className="h-4 w-4" />
            Novo Processo
          </button>
        </div>
      }
    >
      {/* Active Process Selector and Rename bar */}
      <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <span className="text-xs font-bold text-[var(--crm-muted)] whitespace-nowrap">Processo Ativo:</span>
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
                className="flex-1 rounded-md border border-[#2563eb] bg-transparent px-2.5 py-1.5 text-sm font-semibold text-[var(--crm-ink)] outline-none"
              />
              <button
                type="button"
                onClick={handleRenameProcess}
                className="rounded-md bg-[#2563eb] text-[rgb(var(--crm-ink-rgb)_/_1)] font-bold px-3 py-1.5 text-xs hover:bg-[#1d4ed8]"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setIsEditingName(false)}
                className="rounded-md bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[var(--crm-ink)] px-3 py-1.5 text-xs hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
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
                className="bg-transparent border border-[var(--crm-border)] rounded-md text-sm px-3 py-1.5 font-bold text-[var(--crm-ink)] outline-none max-w-[280px]"
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
                className="p-2 rounded hover:bg-[var(--crm-surface)] text-[var(--crm-muted)] hover:text-[var(--crm-ink)] transition-colors"
                title="Editar nome do processo"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteProcess(activeProcessId)}
                className="p-2 rounded hover:bg-[#ef4444]/15 text-[var(--crm-muted)] hover:text-red-700 dark:hover:text-red-400 transition-colors"
                title="Excluir mapeamento de processo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="text-xs text-[var(--crm-muted)] leading-tight">
          Sempre clique em <span className="text-emerald-700 dark:text-emerald-400 font-bold">Salvar Processo</span> para manter suas modificações persistentes.
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Route, label: 'Etapas', value: String(board.steps.length), tone: '#18c8df' },
          { icon: AlertTriangle, label: 'Gargalos', value: String(bottlenecks), tone: '#2563eb' },
          { icon: TimerReset, label: 'Lead time', value: `${leadTime || 0}d`, tone: '#f6b40b' },
          { icon: ClipboardCheck, label: 'Controles', value: String(controls), tone: '#22c55e' }
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-4">
              <Icon className="mb-4 h-5 w-5" style={{ color: item.tone }} />
              <p className="text-3xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--crm-muted)]">{item.label}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">Fluxo ponta a ponta</h2>
            <p className="mt-1 text-sm text-[var(--crm-muted)]">Sequência recomendada com dono, SLA e pontos de controle.</p>
          </div>
          <span className="rounded-full border border-[#2563eb]/35 bg-[#2563eb]/10 px-3 py-1 text-xs font-black text-[var(--pm-accent-text)]">AS-IS para TO-BE</span>
        </div>

        <div className="grid gap-3 xl:grid-cols-5">
          {board.steps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="relative rounded-lg border border-[var(--crm-border)] bg-transparent p-4">
              {index < board.steps.length - 1 && <div className="absolute -right-3 top-1/2 hidden h-0.5 w-3 bg-[var(--crm-border)] xl:block" />}
              <div className="mb-4 flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black text-[rgb(var(--crm-ink-rgb)_/_1)]" style={{ backgroundColor: `${step.color}22`, color: step.color, border: `1px solid ${step.color}55` }}>
                  {index + 1}
                </span>
                <input value={step.status} onChange={event => updateStep(index, { status: event.target.value })} className="w-24 rounded-full border border-transparent bg-transparent px-2 py-1 text-right text-[10px] font-black uppercase outline-none focus:border-[#2563eb]" style={{ backgroundColor: `${step.color}16`, color: step.color }} />
              </div>
              <input value={step.title} onChange={event => updateStep(index, { title: event.target.value })} className={editableInputClass} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input value={step.owner} onChange={event => updateStep(index, { owner: event.target.value })} className={editableSmallInputClass} />
                <input value={step.time} onChange={event => updateStep(index, { time: event.target.value })} className={editableSmallInputClass} />
              </div>
              <div className="mt-4 space-y-2">
                {step.items.map((item, itemIndex) => (
                  <div key={`${item}-${itemIndex}`} className="flex items-center gap-2 text-xs text-[var(--crm-muted)]">
                    <CheckCircle2 className="h-3.5 w-3.5" style={{ color: step.color }} />
                    <input value={item} onChange={event => updateStepItem(index, itemIndex, event.target.value)} className="min-w-0 flex-1 bg-transparent font-semibold text-[var(--crm-ink)] outline-none focus:text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                    <button type="button" onClick={() => updateStep(index, { items: step.items.filter((_, currentIndex) => currentIndex !== itemIndex) })} className="text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[#ef4444]" title="Remover item">
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
              }} className="mt-4 text-xs font-black text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[#ef4444]">
                Remover etapa
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-5">
          <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">Raias de responsabilidade</h2>
          <div className="mt-4 space-y-3">
            {board.swimlanes.map((lane, laneIndex) => (
              <div key={`${lane.area}-${laneIndex}`} className="grid gap-3 rounded-lg border border-[var(--crm-border)] bg-transparent p-3 md:grid-cols-[170px_1fr_36px]">
                <div className="flex items-center gap-2 text-sm font-black text-[var(--crm-ink)]">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: lane.color }} />
                  <input value={lane.area} onChange={event => updateLane(laneIndex, { area: event.target.value })} className="min-w-0 flex-1 bg-transparent outline-none focus:text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                </div>
                <div className="grid gap-2 md:grid-cols-3">
                  {lane.entries.map((entry, entryIndex) => (
                    <input key={`${entry}-${entryIndex}`} value={entry} onChange={event => updateLane(laneIndex, { entries: lane.entries.map((current, index) => index === entryIndex ? event.target.value : current) })} className={editableSmallInputClass} />
                  ))}
                  <button type="button" onClick={() => updateLane(laneIndex, { entries: [...lane.entries, 'Nova ação'] })} className="rounded-md border border-dashed border-[var(--crm-border)] px-3 py-2 text-xs font-black text-[#18c8df] hover:border-[#18c8df]">
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

        <div className="rounded-lg border border-[var(--crm-border)] bg-[linear-gradient(135deg,rgba(37,99,235,0.14),rgb(var(--crm-surface-rgb)/0.96))] p-5">
          <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">Ações de melhoria</h2>
          <div className="mt-4 space-y-3">
            {board.actions.map((action, index) => (
              <div key={`${action}-${index}`} className="flex gap-3 rounded-lg border border-[var(--crm-border)] bg-transparent p-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#2563eb]/15 text-xs font-black text-[var(--pm-accent-text)]">{index + 1}</span>
                <input value={action} onChange={event => {
                  const updated = processes.map(p => {
                    if (p.id !== activeProcessId) return p;
                    return {
                      ...p,
                      actions: p.actions.map((item, actionIndex) => actionIndex === index ? event.target.value : item)
                    };
                  });
                  persistProcesses(updated);
                }} className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--crm-ink)] outline-none focus:text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                <button type="button" onClick={() => {
                  const updated = processes.map(p => {
                    if (p.id !== activeProcessId) return p;
                    return {
                      ...p,
                      actions: p.actions.filter((_, actionIndex) => actionIndex !== index)
                    };
                  });
                  persistProcesses(updated);
                }} className="text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[#ef4444]" title="Remover ação">
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

function ProductBrainstormBoard({ onBack }: { onBack: () => void }) {
  const [board, setBoard] = useState(() => loadBoard('pm-product-brainstorm-board', PRODUCT_DEFAULT_BOARD));
  const averageScore = board.ideas.length ? Math.round(board.ideas.reduce((sum, idea) => sum + Number(idea.score || 0), 0) / board.ideas.length) : 0;
  const personas = new Set(board.ideas.map(idea => idea.cluster).filter(Boolean)).size;

  useEffect(() => {
    window.localStorage.setItem('pm-product-brainstorm-board', JSON.stringify(board));
  }, [board]);

  const updateIdea = (index: number, patch: Partial<ProductIdea>) => {
    setBoard(current => ({
      ...current,
      ideas: current.ideas.map((idea, ideaIndex) => ideaIndex === index ? { ...idea, ...patch } : idea)
    }));
  };

  const updateMatrix = (index: number, patch: Partial<MatrixQuadrant>) => {
    setBoard(current => ({
      ...current,
      matrix: current.matrix.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    }));
  };

  const updateRoadmap = (index: number, patch: Partial<RoadmapWave>) => {
    setBoard(current => ({
      ...current,
      roadmap: current.roadmap.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)
    }));
  };

  return (
    <BoardShell
      title="Brainstorming de Produto"
      subtitle="Organize hipóteses, ideias, dores, oportunidades e priorização para transformar colaboração em roadmap."
      icon={Lightbulb}
      onBack={onBack}
      actions={
        <>
          <button type="button" onClick={() => setBoard(current => ({ ...current, ideas: [...current.ideas, { title: 'Nova ideia', cluster: 'Oportunidade', score: 70, color: '#22c55e' }] }))} className={boardActionButtonClass}>
            <Plus className="h-4 w-4" />
            Ideia
          </button>
          <button type="button" onClick={() => setBoard(cloneBoard(PRODUCT_DEFAULT_BOARD))} className={boardActionButtonClass}>
            <RotateCcw className="h-4 w-4" />
            Restaurar
          </button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-4">
        {[
          { icon: Lightbulb, label: 'Ideias', value: String(board.ideas.length), tone: '#f6b40b' },
          { icon: Users, label: 'Clusters', value: String(personas), tone: '#18c8df' },
          { icon: Gauge, label: 'Score médio', value: String(averageScore), tone: '#22c55e' },
          { icon: Layers3, label: 'Roadmap', value: `${board.roadmap.length} ondas`, tone: '#2563eb' }
        ].map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-4">
              <Icon className="mb-4 h-5 w-5" style={{ color: item.tone }} />
              <p className="text-3xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">{item.value}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-[var(--crm-muted)]">{item.label}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[.95fr_1.05fr]">
        <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">Banco de ideias</h2>
            <span className="rounded-full border border-[#22c55e]/35 bg-[#22c55e]/10 px-3 py-1 text-xs font-black text-[#5ee2a0]">Priorizado</span>
          </div>
          <div className="space-y-3">
            {board.ideas.map((idea, index) => (
              <div key={`${idea.title}-${index}`} className="rounded-lg border border-[var(--crm-border)] bg-transparent p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input value={idea.title} onChange={event => updateIdea(index, { title: event.target.value })} className={editableInputClass} />
                    <input value={idea.cluster} onChange={event => updateIdea(index, { cluster: event.target.value })} className={editableSmallInputClass} />
                  </div>
                  <input type="number" min="0" max="100" value={idea.score} onChange={event => updateIdea(index, { score: Number(event.target.value) })} className="w-16 rounded-full border border-transparent px-2.5 py-1 text-center text-xs font-black outline-none focus:border-[#2563eb]" style={{ color: idea.color, backgroundColor: `${idea.color}16` }} />
                  <button type="button" onClick={() => setBoard(current => ({ ...current, ideas: current.ideas.filter((_, ideaIndex) => ideaIndex !== index) }))} className={dangerIconButtonClass} title="Remover ideia">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--crm-border)]">
                  <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, Number(idea.score || 0)))}%`, background: `linear-gradient(90deg, ${idea.color}, #f6b40b)` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-5">
          <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">Matriz impacto x esforço</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {board.matrix.map((item, index) => (
              <div key={`${item.quadrant}-${index}`} className="min-h-[150px] rounded-lg border border-[var(--crm-border)] bg-transparent p-4">
                <div className="mb-3 flex items-center justify-between">
                  <input value={item.quadrant} onChange={event => updateMatrix(index, { quadrant: event.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-black text-[var(--crm-ink)] outline-none focus:text-[rgb(var(--crm-ink-rgb)_/_1)]" />
                  <Wand2 className="h-4 w-4" style={{ color: item.color }} />
                </div>
                <input value={item.hint} onChange={event => updateMatrix(index, { hint: event.target.value })} className="mb-4 w-full bg-transparent text-xs font-semibold text-[var(--crm-muted)] outline-none focus:text-[var(--crm-ink)]" />
                <div className="space-y-2">
                  {item.ideas.map((idea, ideaIndex) => (
                    <input key={`${idea}-${ideaIndex}`} value={idea} onChange={event => updateMatrix(index, { ideas: item.ideas.map((current, currentIndex) => currentIndex === ideaIndex ? event.target.value : current) })} className="w-full rounded-md border px-3 py-2 text-xs font-bold text-[var(--crm-ink)] outline-none focus:border-[#2563eb]" style={{ borderColor: `${item.color}33`, backgroundColor: `${item.color}10` }} />
                  ))}
                  <button type="button" onClick={() => updateMatrix(index, { ideas: [...item.ideas, 'Nova hipótese'] })} className="text-xs font-black text-[#18c8df] hover:text-[#5ee2a0]">
                    + Hipótese
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)/0.88)] p-5">
        <h2 className="text-xl font-black text-[rgb(var(--crm-ink-rgb)_/_1)]">Roadmap sugerido</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {board.roadmap.map((item, index) => (
            <div key={`${item.wave}-${index}`} className="rounded-lg border border-[var(--crm-border)] bg-transparent p-4">
              <input value={item.wave} onChange={event => updateRoadmap(index, { wave: event.target.value })} className="w-28 rounded-full border border-transparent px-3 py-1 text-[11px] font-black uppercase tracking-wide outline-none focus:border-[#2563eb]" style={{ color: item.color, backgroundColor: `${item.color}14` }} />
              <input value={item.title} onChange={event => updateRoadmap(index, { title: event.target.value })} className="mt-4 w-full bg-transparent text-base font-black text-[var(--crm-ink)] outline-none focus:text-[rgb(var(--crm-ink-rgb)_/_1)]" />
              <textarea value={item.text} onChange={event => updateRoadmap(index, { text: event.target.value })} rows={3} className={`${editableTextAreaClass} mt-2`} />
              <button type="button" onClick={() => setBoard(current => ({ ...current, roadmap: current.roadmap.filter((_, roadmapIndex) => roadmapIndex !== index) }))} className="mt-3 text-xs font-black text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[#ef4444]">
                Remover onda
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setBoard(current => ({ ...current, roadmap: [...current.roadmap, { wave: 'Nova onda', title: 'Nova entrega', text: 'Descreva a próxima entrega do roadmap.', color: '#18c8df' }] }))} className="min-h-[170px] rounded-lg border border-dashed border-[var(--crm-border)] bg-transparent p-4 text-sm font-black text-[#18c8df] transition-colors hover:border-[#18c8df] hover:text-[#5ee2a0]">
            + Nova onda
          </button>
        </div>
      </section>
    </BoardShell>
  );
}
