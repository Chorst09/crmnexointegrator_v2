import React, { useEffect, useState } from 'react';
import {
  FileText, CheckCircle2, DollarSign, ShieldAlert, Plus, Trash2, Save, FileDown,
  Calendar, AlertTriangle, ClipboardCheck, Briefcase
} from 'lucide-react';
import type { Space, Issue } from '../types';
import { buildApiUrl, getAuthHeaders } from '../../config/api';
import {
  exportProjectExecutivePdf,
  type ProjectExecutiveData
} from './projectExecutivePdfExport';

export type ExecutiveTabMode = 'executive' | 'deliverables' | 'billing' | 'governance';

interface ProjectExecutiveWorkspaceProps {
  project: Space;
  issues: Issue[];
  mode: ExecutiveTabMode;
  onProjectMetadataUpdated?: (projectId: string, newMetadata: Record<string, any>) => void;
}

function createEmptyExecutiveData(project: Space): ProjectExecutiveData {
  const today = new Date().toLocaleDateString('pt-BR');
  return {
    dataBase: today,
    emissao: today,
    proximaRevisao: '',
    situacaoGeral: 'Em acompanhamento',
    resumoExecutivo: project.description || project.scope || '',
    decisaoRequerida: '',
    contrato: {
      objeto: project.scope || project.name,
      pregaoProtocolo: project.number || '',
      prazoPrevisto: '',
      contratoOS: 'A preencher',
      gestorFiscalValor: 'A preencher',
      baseEstimada: Number(project.budget || 0),
      valorContratado: 'A confirmar',
      recebidoSaldo: 'A confirmar'
    },
    entregaveis: [],
    planoAcao: [],
    dependenciasTecnicas: [],
    atualizacoesAcoes: [],
    marcosPagamento: [
      { etapa: 1, nome: 'Reunião Inicial (kick-off)', percentual: 0, condicao: 'Sem pagamento', referenciaEstimada: 0, valorContratado: 'A preencher', trdData: 'A confirmar', nfEmissao: 'A confirmar', previsaoBaixa: 'A confirmar' }
    ],
    recebiveisMensais: [],
    riscos: [],
    decisoes: [],
    ritualAcompanhamento: 'Daily de 15 minutos; revisão gerencial semanal.',
    fontes: ''
  };
}

function formatBRL(value: number) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function ProjectExecutiveWorkspace({
  project,
  issues,
  mode,
  onProjectMetadataUpdated
}: ProjectExecutiveWorkspaceProps) {
  const existingExec = (project.metadata as any)?.executive as ProjectExecutiveData | undefined;
  const [data, setData] = useState<ProjectExecutiveData>(() => existingExec || createEmptyExecutiveData(project));
  const [saving, setSaving] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const nextExec = (project.metadata as any)?.executive as ProjectExecutiveData | undefined;
    setData(nextExec || createEmptyExecutiveData(project));
    setSavedOk(false);
    setErrorMsg(null);
  }, [project.id]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);
    setSavedOk(false);
    try {
      const mergedMetadata = {
        ...(project.metadata || {}),
        executive: data
      };
      const res = await fetch(buildApiUrl(`/projetos/${project.id}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({ metadata: mergedMetadata })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Erro HTTP ${res.status}`);
      }
      onProjectMetadataUpdated?.(project.id, mergedMetadata);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao salvar dados executivos do projeto.');
    } finally {
      setSaving(false);
    }
  };

  const pendingDeliverables = data.entregaveis.filter((e) => /pendente|confirmar/i.test(e.situacaoBase)).length;
  const unconfirmedAcceptance = data.entregaveis.filter((e) => !e.aceiteReal?.trim()).length;
  const openActions = data.planoAcao.filter((a) => !/conclu|fechad/i.test(a.status));
  const highPriorityCount = openActions.filter((a) => /alta/i.test(a.prioridade)).length;
  const lastDueDate = data.planoAcao.reduce((max, a) => (a.prazo && a.prazo > max ? a.prazo : max), '');
  const totalMarcoPct = data.marcosPagamento.reduce((sum, m) => sum + (Number(m.percentual) || 0), 0);
  const totalMarcoRef = data.marcosPagamento.reduce((sum, m) => sum + (Number(m.referenciaEstimada) || 0), 0);

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-5 text-[var(--crm-ink)]">
      {/* Barra superior comum */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--crm-muted)]">
            <span className="font-bold text-[#38bdf8]">{project.number || 'PROJETO'}</span>
            <span>•</span>
            <span>Data-base: <strong className="text-[var(--crm-ink)]">{data.dataBase || '-'}</strong></span>
            <span>•</span>
            <span>Próxima revisão: <strong className="text-[var(--crm-ink)]">{data.proximaRevisao || '-'}</strong></span>
          </div>
          <h2 className="mt-0.5 text-lg font-black">{project.name}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportProjectExecutivePdf(project.name, data)}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-400 hover:bg-cyan-500/20"
          >
            <FileDown className="h-3.5 w-3.5" /> Exportar PDF Executivo
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            <Save className="h-3.5 w-3.5" />
            {saving ? 'Salvando...' : savedOk ? 'Salvo no banco! ✓' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-400">
          {errorMsg}
        </div>
      )}

      {/* 01. PAINEL EXECUTIVO & CONTRATO */}
      {mode === 'executive' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
            {[
              { label: 'Entregas mapeadas', value: String(data.entregaveis.length), tone: 'text-[#38bdf8]' },
              { label: 'Pendentes / confirmar', value: String(pendingDeliverables), tone: 'text-amber-400' },
              { label: 'Sem aceite formal', value: String(unconfirmedAcceptance), tone: 'text-orange-400' },
              { label: 'Ações abertas', value: String(openActions.length || issues.length), tone: 'text-cyan-400' },
              { label: 'Prioridade alta', value: String(highPriorityCount), tone: 'text-red-400' },
              { label: 'Último prazo', value: lastDueDate ? lastDueDate.split('-').reverse().join('/') : '-', tone: 'text-emerald-400' }
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3.5">
                <div className={`text-2xl font-black ${kpi.tone}`}>{kpi.value}</div>
                <div className="mt-1 text-[11px] font-bold uppercase tracking-wide text-[var(--crm-muted)]">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Situação geral e Decisão requerida */}
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#2563eb]" /> Situação Geral & Decisão Requerida
                </h3>
                <select
                  value={data.situacaoGeral}
                  onChange={(e) => setData((p) => ({ ...p, situacaoGeral: e.target.value }))}
                  className="rounded border border-[var(--crm-border)] bg-[var(--crm-surface-2)] px-2.5 py-1 text-xs font-bold"
                >
                  <option value="Em acompanhamento">Em acompanhamento</option>
                  <option value="No prazo">No prazo</option>
                  <option value="Atenção / Risco">Atenção / Risco</option>
                  <option value="Crítico">Crítico</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Data-base</label>
                  <input value={data.dataBase} onChange={(e) => setData((p) => ({ ...p, dataBase: e.target.value }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Emissão</label>
                  <input value={data.emissao} onChange={(e) => setData((p) => ({ ...p, emissao: e.target.value }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1 text-xs" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Próxima revisão</label>
                  <input value={data.proximaRevisao} onChange={(e) => setData((p) => ({ ...p, proximaRevisao: e.target.value }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1 text-xs" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Resumo Executivo</label>
                <textarea rows={3} value={data.resumoExecutivo} onChange={(e) => setData((p) => ({ ...p, resumoExecutivo: e.target.value }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent p-2 text-xs leading-relaxed" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-amber-400 mb-1">Decisão Requerida</label>
                <textarea rows={2} value={data.decisaoRequerida} onChange={(e) => setData((p) => ({ ...p, decisaoRequerida: e.target.value }))} className="w-full rounded border border-amber-500/30 bg-amber-500/5 p-2 text-xs" />
              </div>
            </div>

            {/* Identificação Contratual */}
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-[#2563eb]" /> Identificação Contratual
              </h3>
              <div className="grid gap-2.5">
                {[
                  ['Objeto', 'objeto'],
                  ['Pregão / protocolo', 'pregaoProtocolo'],
                  ['Prazo previsto', 'prazoPrevisto'],
                  ['Contrato / ordem de serviço', 'contratoOS'],
                  ['Gestor / fiscal / valor contratado', 'gestorFiscalValor']
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">{label}</label>
                    <input
                      value={(data.contrato as any)[key] || ''}
                      onChange={(e) => setData((p) => ({ ...p, contrato: { ...p.contrato, [key]: e.target.value } }))}
                      className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Agenda imediata + Plano de ação */}
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Calendar className="h-4 w-4 text-cyan-400" /> Plano de Ação & Agenda Imediata ({data.planoAcao.length})
              </h3>
              <button
                type="button"
                onClick={() => setData((p) => ({
                  ...p,
                  planoAcao: [...p.planoAcao, { id: String(p.planoAcao.length + 1), prioridade: 'Alta', atividade: 'Nova ação', responsavel: 'Responsável', prazo: '2026-12-01', status: 'Aberto', dependencia: 'P01' }]
                }))}
                className="inline-flex items-center gap-1 rounded border border-[#2563eb]/40 bg-[#2563eb]/10 px-2.5 py-1 text-xs font-bold text-[#38bdf8]"
              >
                <Plus className="h-3.5 w-3.5" /> Ação
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] text-left text-[11px] uppercase text-[var(--crm-muted)]">
                    <th className="py-2 pr-2">ID</th>
                    <th className="py-2 pr-2">Prioridade</th>
                    <th className="py-2 pr-2">Atividade e critério de conclusão</th>
                    <th className="py-2 pr-2">Responsável</th>
                    <th className="py-2 pr-2">Prazo</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--crm-border)]/50">
                  {data.planoAcao.map((act, idx) => (
                    <tr key={`${act.id}-${idx}`}>
                      <td className="py-2 pr-2 w-16"><input value={act.id} onChange={(e) => setData((p) => ({ ...p, planoAcao: p.planoAcao.map((x, i) => i === idx ? { ...x, id: e.target.value } : x) }))} className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-bold focus:border-[#2563eb]" /></td>
                      <td className="py-2 pr-2 w-24">
                        <select value={act.prioridade} onChange={(e) => setData((p) => ({ ...p, planoAcao: p.planoAcao.map((x, i) => i === idx ? { ...x, prioridade: e.target.value } : x) }))} className="rounded border border-[var(--crm-border)] bg-[var(--crm-surface-2)] px-1.5 py-1 text-xs">
                          <option value="Alta">Alta</option>
                          <option value="Média">Média</option>
                          <option value="Baixa">Baixa</option>
                        </select>
                      </td>
                      <td className="py-2 pr-2"><input value={act.atividade} onChange={(e) => setData((p) => ({ ...p, planoAcao: p.planoAcao.map((x, i) => i === idx ? { ...x, atividade: e.target.value } : x) }))} className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 font-semibold focus:border-[#2563eb]" /></td>
                      <td className="py-2 pr-2 w-44"><input value={act.responsavel} onChange={(e) => setData((p) => ({ ...p, planoAcao: p.planoAcao.map((x, i) => i === idx ? { ...x, responsavel: e.target.value } : x) }))} className="w-full rounded border border-transparent bg-transparent px-1.5 py-1 focus:border-[#2563eb]" /></td>
                      <td className="py-2 pr-2 w-32"><input type="date" value={act.prazo} onChange={(e) => setData((p) => ({ ...p, planoAcao: p.planoAcao.map((x, i) => i === idx ? { ...x, prazo: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1" /></td>
                      <td className="py-2 pr-2 w-28">
                        <select value={act.status} onChange={(e) => setData((p) => ({ ...p, planoAcao: p.planoAcao.map((x, i) => i === idx ? { ...x, status: e.target.value } : x) }))} className="rounded border border-[var(--crm-border)] bg-[var(--crm-surface-2)] px-1.5 py-1 text-xs">
                          <option value="Aberto">Aberto</option>
                          <option value="Em andamento">Em andamento</option>
                          <option value="Concluído">Concluído</option>
                        </select>
                      </td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => setData((p) => ({ ...p, planoAcao: p.planoAcao.filter((_, i) => i !== idx) }))} className="p-1 text-[var(--crm-muted)] hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 02. CONTROLE DE ENTREGAS & ACEITE */}
      {mode === 'deliverables' && (
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-emerald-400" /> Controle de Entregas & Termos de Aceite ({data.entregaveis.length})
              </h3>
              <p className="text-xs text-[var(--crm-muted)]">Entregue exige evidência técnica; homologado exige aceite formal (TRD).</p>
            </div>
            <button
              type="button"
              onClick={() => setData((p) => ({
                ...p,
                entregaveis: [...p.entregaveis, { id: `E${String(p.entregaveis.length + 1).padStart(2, '0')}`, escopo: 'Novo entregável', situacaoBase: 'A confirmar', evidenciaSugerida: 'Evidência técnica', entregaReal: '', aceiteReal: '', termoEvidencia: 'A confirmar' }]
              }))}
              className="inline-flex items-center gap-1 rounded border border-[#2563eb]/40 bg-[#2563eb]/10 px-3 py-1.5 text-xs font-bold text-[#38bdf8]"
            >
              <Plus className="h-3.5 w-3.5" /> Novo Entregável
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--crm-border)] text-left text-[11px] uppercase text-[var(--crm-muted)]">
                  <th className="py-2 pr-2">ID</th>
                  <th className="py-2 pr-2">Entregável / Escopo</th>
                  <th className="py-2 pr-2">Situação na base</th>
                  <th className="py-2 pr-2">Evidência sugerida</th>
                  <th className="py-2 pr-2">Entrega real</th>
                  <th className="py-2 pr-2">Aceite real</th>
                  <th className="py-2 pr-2">Termo / Evidência</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--crm-border)]/50">
                {data.entregaveis.map((item, idx) => (
                  <tr key={`${item.id}-${idx}`}>
                    <td className="py-2 pr-2 w-14"><input value={item.id} onChange={(e) => setData((p) => ({ ...p, entregaveis: p.entregaveis.map((x, i) => i === idx ? { ...x, id: e.target.value } : x) }))} className="w-full rounded border border-transparent bg-transparent px-1 py-1 font-black text-[#38bdf8] focus:border-[#2563eb]" /></td>
                    <td className="py-2 pr-2 min-w-[220px]"><input value={item.escopo} onChange={(e) => setData((p) => ({ ...p, entregaveis: p.entregaveis.map((x, i) => i === idx ? { ...x, escopo: e.target.value } : x) }))} className="w-full rounded border border-transparent bg-transparent px-1 py-1 font-semibold focus:border-[#2563eb]" /></td>
                    <td className="py-2 pr-2 w-32"><input value={item.situacaoBase} onChange={(e) => setData((p) => ({ ...p, entregaveis: p.entregaveis.map((x, i) => i === idx ? { ...x, situacaoBase: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2 py-1" /></td>
                    <td className="py-2 pr-2 min-w-[180px]"><input value={item.evidenciaSugerida} onChange={(e) => setData((p) => ({ ...p, entregaveis: p.entregaveis.map((x, i) => i === idx ? { ...x, evidenciaSugerida: e.target.value } : x) }))} className="w-full rounded border border-transparent bg-transparent px-1 py-1 focus:border-[#2563eb]" /></td>
                    <td className="py-2 pr-2 w-28"><input type="date" value={item.entregaReal} onChange={(e) => setData((p) => ({ ...p, entregaveis: p.entregaveis.map((x, i) => i === idx ? { ...x, entregaReal: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1" /></td>
                    <td className="py-2 pr-2 w-28"><input type="date" value={item.aceiteReal} onChange={(e) => setData((p) => ({ ...p, entregaveis: p.entregaveis.map((x, i) => i === idx ? { ...x, aceiteReal: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1" /></td>
                    <td className="py-2 pr-2 w-36"><input value={item.termoEvidencia} onChange={(e) => setData((p) => ({ ...p, entregaveis: p.entregaveis.map((x, i) => i === idx ? { ...x, termoEvidencia: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2 py-1" /></td>
                    <td className="py-2 text-right">
                      <button type="button" onClick={() => setData((p) => ({ ...p, entregaveis: p.entregaveis.filter((_, i) => i !== idx) }))} className="p-1 text-[var(--crm-muted)] hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 04. RECEBÍVEIS DA IMPLANTAÇÃO & MENSAIS (TRD) */}
      {mode === 'billing' && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
              <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Base estimada do edital (R$)</label>
              <input
                type="number"
                value={data.contrato.baseEstimada}
                onChange={(e) => setData((p) => ({ ...p, contrato: { ...p.contrato, baseEstimada: Number(e.target.value) || 0 } }))}
                className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-lg font-black text-emerald-400"
              />
            </div>
            <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
              <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Valor contratado</label>
              <input
                value={data.contrato.valorContratado}
                onChange={(e) => setData((p) => ({ ...p, contrato: { ...p.contrato, valorContratado: e.target.value } }))}
                className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-lg font-black"
              />
            </div>
            <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4">
              <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Recebido / Saldo</label>
              <input
                value={data.contrato.recebidoSaldo}
                onChange={(e) => setData((p) => ({ ...p, contrato: { ...p.contrato, recebidoSaldo: e.target.value } }))}
                className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2.5 py-1.5 text-lg font-black"
              />
            </div>
          </div>

          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" /> Marcos de Pagamento da Implantação (TRD) — Total: {totalMarcoPct}% ({formatBRL(totalMarcoRef)})
              </h3>
              <button
                type="button"
                onClick={() => setData((p) => ({
                  ...p,
                  marcosPagamento: [...p.marcosPagamento, { etapa: p.marcosPagamento.length + 1, nome: 'Novo marco', percentual: 0, condicao: 'TRD', referenciaEstimada: 0, valorContratado: 'A preencher', trdData: 'A confirmar', nfEmissao: 'A confirmar', previsaoBaixa: 'A confirmar' }]
                }))}
                className="inline-flex items-center gap-1 rounded border border-[#2563eb]/40 bg-[#2563eb]/10 px-2.5 py-1 text-xs font-bold text-[#38bdf8]"
              >
                <Plus className="h-3.5 w-3.5" /> Marco
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] text-left text-[11px] uppercase text-[var(--crm-muted)]">
                    <th className="py-2 pr-2">Etapa / Marco</th>
                    <th className="py-2 pr-2">%</th>
                    <th className="py-2 pr-2">Condição</th>
                    <th className="py-2 pr-2">Ref. Estimada</th>
                    <th className="py-2 pr-2">Valor Contratado</th>
                    <th className="py-2 pr-2">TRD / Data</th>
                    <th className="py-2 pr-2">NF / Emissão</th>
                    <th className="py-2">Previsão / Baixa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--crm-border)]/50">
                  {data.marcosPagamento.map((m, idx) => (
                    <tr key={`${m.etapa}-${idx}`}>
                      <td className="py-2 pr-2 font-semibold">{m.etapa}. {m.nome}</td>
                      <td className="py-2 pr-2 w-16"><input type="number" value={m.percentual} onChange={(e) => setData((p) => ({ ...p, marcosPagamento: p.marcosPagamento.map((x, i) => i === idx ? { ...x, percentual: Number(e.target.value) || 0, referenciaEstimada: ((Number(e.target.value) || 0) / 100) * p.contrato.baseEstimada } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1 font-bold" /></td>
                      <td className="py-2 pr-2"><input value={m.condicao} onChange={(e) => setData((p) => ({ ...p, marcosPagamento: p.marcosPagamento.map((x, i) => i === idx ? { ...x, condicao: e.target.value } : x) }))} className="w-full rounded border border-transparent bg-transparent px-1 py-1 focus:border-[#2563eb]" /></td>
                      <td className="py-2 pr-2 font-bold text-emerald-400">{m.referenciaEstimada > 0 ? formatBRL(m.referenciaEstimada) : '—'}</td>
                      <td className="py-2 pr-2 w-28"><input value={m.valorContratado} onChange={(e) => setData((p) => ({ ...p, marcosPagamento: p.marcosPagamento.map((x, i) => i === idx ? { ...x, valorContratado: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1" /></td>
                      <td className="py-2 pr-2 w-28"><input value={m.trdData} onChange={(e) => setData((p) => ({ ...p, marcosPagamento: p.marcosPagamento.map((x, i) => i === idx ? { ...x, trdData: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1" /></td>
                      <td className="py-2 pr-2 w-28"><input value={m.nfEmissao} onChange={(e) => setData((p) => ({ ...p, marcosPagamento: p.marcosPagamento.map((x, i) => i === idx ? { ...x, nfEmissao: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1" /></td>
                      <td className="py-2 w-28"><input value={m.previsaoBaixa} onChange={(e) => setData((p) => ({ ...p, marcosPagamento: p.marcosPagamento.map((x, i) => i === idx ? { ...x, previsaoBaixa: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recebíveis mensais */}
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black">Recebíveis Mensais (Recorrência / IMR / Glosas)</h3>
                <p className="text-xs text-[var(--crm-muted)]">Controlado separadamente da implantação, vinculado ao TRD mensal e avaliação IMR.</p>
              </div>
              <button
                type="button"
                onClick={() => setData((p) => ({
                  ...p,
                  recebiveisMensais: [...p.recebiveisMensais, { competencia: '01/2027', brutoAjustes: 'A confirmar', trdNf: 'A confirmar', vencimento: '', recebidoSaldo: 'A confirmar' }]
                }))}
                className="inline-flex items-center gap-1 rounded border border-[#2563eb]/40 bg-[#2563eb]/10 px-2.5 py-1 text-xs font-bold text-[#38bdf8]"
              >
                <Plus className="h-3.5 w-3.5" /> Competência
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--crm-border)] text-left text-[11px] uppercase text-[var(--crm-muted)]">
                    <th className="py-2 pr-2">Competência</th>
                    <th className="py-2 pr-2">Bruto / Ajustes (IMR)</th>
                    <th className="py-2 pr-2">TRD / NF</th>
                    <th className="py-2 pr-2">Vencimento</th>
                    <th className="py-2 pr-2">Recebido / Saldo</th>
                    <th className="py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--crm-border)]/50">
                  {data.recebiveisMensais.map((rec, idx) => (
                    <tr key={idx}>
                      <td className="py-2 pr-2 w-28"><input value={rec.competencia} onChange={(e) => setData((p) => ({ ...p, recebiveisMensais: p.recebiveisMensais.map((x, i) => i === idx ? { ...x, competencia: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2 py-1 font-bold" /></td>
                      <td className="py-2 pr-2"><input value={rec.brutoAjustes} onChange={(e) => setData((p) => ({ ...p, recebiveisMensais: p.recebiveisMensais.map((x, i) => i === idx ? { ...x, brutoAjustes: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2 py-1" /></td>
                      <td className="py-2 pr-2"><input value={rec.trdNf} onChange={(e) => setData((p) => ({ ...p, recebiveisMensais: p.recebiveisMensais.map((x, i) => i === idx ? { ...x, trdNf: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2 py-1" /></td>
                      <td className="py-2 pr-2 w-32"><input type="date" value={rec.vencimento} onChange={(e) => setData((p) => ({ ...p, recebiveisMensais: p.recebiveisMensais.map((x, i) => i === idx ? { ...x, vencimento: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2 py-1" /></td>
                      <td className="py-2 pr-2"><input value={rec.recebidoSaldo} onChange={(e) => setData((p) => ({ ...p, recebiveisMensais: p.recebiveisMensais.map((x, i) => i === idx ? { ...x, recebidoSaldo: e.target.value } : x) }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent px-2 py-1" /></td>
                      <td className="py-2 text-right">
                        <button type="button" onClick={() => setData((p) => ({ ...p, recebiveisMensais: p.recebiveisMensais.filter((_, i) => i !== idx) }))} className="p-1 text-[var(--crm-muted)] hover:text-red-400">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 05. GOVERNANÇA, RISCOS & DECISÕES */}
      {mode === 'governance' && (
        <div className="space-y-5">
          {/* Dependências técnicas */}
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Dependências Técnicas
              </h3>
              <button
                type="button"
                onClick={() => setData((p) => ({
                  ...p,
                  dependenciasTecnicas: [...p.dependenciasTecnicas, { codigo: `P0${p.dependenciasTecnicas.length + 1}`, descricao: 'Nova dependência técnica' }]
                }))}
                className="inline-flex items-center gap-1 rounded border border-[#2563eb]/40 bg-[#2563eb]/10 px-2.5 py-1 text-xs font-bold text-[#38bdf8]"
              >
                <Plus className="h-3.5 w-3.5" /> Dependência
              </button>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {data.dependenciasTecnicas.map((dep, idx) => (
                <div key={idx} className="rounded-lg border border-[var(--crm-border)] p-3 space-y-1.5">
                  <input value={dep.codigo} onChange={(e) => setData((p) => ({ ...p, dependenciasTecnicas: p.dependenciasTecnicas.map((x, i) => i === idx ? { ...x, codigo: e.target.value } : x) }))} className="w-20 rounded border border-transparent bg-transparent text-xs font-black text-amber-400 focus:border-[#2563eb]" />
                  <textarea rows={2} value={dep.descricao} onChange={(e) => setData((p) => ({ ...p, dependenciasTecnicas: p.dependenciasTecnicas.map((x, i) => i === idx ? { ...x, descricao: e.target.value } : x) }))} className="w-full rounded border border-transparent bg-transparent text-xs focus:border-[#2563eb]" />
                </div>
              ))}
            </div>
          </div>

          {/* Riscos e dependências */}
          <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-red-400" /> Riscos e Controles ({data.riscos.length})
              </h3>
              <button
                type="button"
                onClick={() => setData((p) => ({
                  ...p,
                  riscos: [...p.riscos, { risco: 'Novo risco', acaoControle: 'Ação de controle', responsavel: 'Responsável', severidade: 'MEDIUM' }]
                }))}
                className="inline-flex items-center gap-1 rounded border border-[#2563eb]/40 bg-[#2563eb]/10 px-2.5 py-1 text-xs font-bold text-[#38bdf8]"
              >
                <Plus className="h-3.5 w-3.5" /> Risco
              </button>
            </div>
            <div className="space-y-2">
              {data.riscos.map((r, idx) => (
                <div key={idx} className="grid gap-2 md:grid-cols-[1.2fr_1.5fr_1fr_110px_36px] items-center rounded-lg border border-[var(--crm-border)] p-2.5 text-xs">
                  <input value={r.risco} onChange={(e) => setData((p) => ({ ...p, riscos: p.riscos.map((x, i) => i === idx ? { ...x, risco: e.target.value } : x) }))} className="rounded border border-transparent bg-transparent px-2 py-1 font-bold focus:border-[#2563eb]" />
                  <input value={r.acaoControle} onChange={(e) => setData((p) => ({ ...p, riscos: p.riscos.map((x, i) => i === idx ? { ...x, acaoControle: e.target.value } : x) }))} className="rounded border border-transparent bg-transparent px-2 py-1 focus:border-[#2563eb]" />
                  <input value={r.responsavel} onChange={(e) => setData((p) => ({ ...p, riscos: p.riscos.map((x, i) => i === idx ? { ...x, responsavel: e.target.value } : x) }))} className="rounded border border-transparent bg-transparent px-2 py-1 focus:border-[#2563eb]" />
                  <select value={r.severidade} onChange={(e) => setData((p) => ({ ...p, riscos: p.riscos.map((x, i) => i === idx ? { ...x, severidade: e.target.value } : x) }))} className="rounded border border-[var(--crm-border)] bg-[var(--crm-surface-2)] px-2 py-1">
                    <option value="HIGH">Alto</option>
                    <option value="MEDIUM">Médio</option>
                    <option value="LOW">Baixo</option>
                  </select>
                  <button type="button" onClick={() => setData((p) => ({ ...p, riscos: p.riscos.filter((_, i) => i !== idx) }))} className="p-1 text-[var(--crm-muted)] hover:text-red-400">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Registro de decisões & Ritual */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Registro de Decisões
                </h3>
                <button
                  type="button"
                  onClick={() => setData((p) => ({
                    ...p,
                    decisoes: [...p.decisoes, { data: new Date().toLocaleDateString('pt-BR'), decisao: 'Nova decisão / encaminhamento', responsavelPrazo: 'Responsável / prazo' }]
                  }))}
                  className="inline-flex items-center gap-1 rounded border border-[#2563eb]/40 bg-[#2563eb]/10 px-2.5 py-1 text-xs font-bold text-[#38bdf8]"
                >
                  <Plus className="h-3.5 w-3.5" /> Decisão
                </button>
              </div>
              {data.decisoes.length === 0 ? (
                <p className="text-xs text-[var(--crm-muted)]">Nenhuma decisão registrada ainda. Clique em "+ Decisão" para registrar encaminhamentos de reunião.</p>
              ) : (
                <div className="space-y-2">
                  {data.decisoes.map((d, idx) => (
                    <div key={idx} className="grid gap-2 sm:grid-cols-[95px_1fr_1fr_32px] items-center rounded border border-[var(--crm-border)] p-2 text-xs">
                      <input value={d.data} onChange={(e) => setData((p) => ({ ...p, decisoes: p.decisoes.map((x, i) => i === idx ? { ...x, data: e.target.value } : x) }))} className="rounded border border-[var(--crm-border)] bg-transparent px-1.5 py-1" />
                      <input value={d.decisao} onChange={(e) => setData((p) => ({ ...p, decisoes: p.decisoes.map((x, i) => i === idx ? { ...x, decisao: e.target.value } : x) }))} className="rounded border border-transparent bg-transparent px-1.5 py-1 font-semibold focus:border-[#2563eb]" />
                      <input value={d.responsavelPrazo} onChange={(e) => setData((p) => ({ ...p, decisoes: p.decisoes.map((x, i) => i === idx ? { ...x, responsavelPrazo: e.target.value } : x) }))} className="rounded border border-transparent bg-transparent px-1.5 py-1 focus:border-[#2563eb]" />
                      <button type="button" onClick={() => setData((p) => ({ ...p, decisoes: p.decisoes.filter((_, i) => i !== idx) }))} className="p-1 text-[var(--crm-muted)] hover:text-red-400">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 space-y-3">
              <h3 className="text-sm font-black">Ritual de Acompanhamento & Fontes</h3>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Ritual de acompanhamento</label>
                <textarea rows={3} value={data.ritualAcompanhamento} onChange={(e) => setData((p) => ({ ...p, ritualAcompanhamento: e.target.value }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent p-2 text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--crm-muted)] mb-1">Fontes e critérios</label>
                <textarea rows={2} value={data.fontes} onChange={(e) => setData((p) => ({ ...p, fontes: e.target.value }))} className="w-full rounded border border-[var(--crm-border)] bg-transparent p-2 text-xs" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
