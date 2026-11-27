import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../../config/api';

interface EncodedFile {
  name: string;
  size: number;
  base64: string;
}

interface ModeloRecomendado {
  item_ou_lote?: string;
  fabricante: string;
  modelo: string;
  part_number?: string;
  aderencia_percentual: number;
  atende_100_porcento: boolean;
  justificativa_tecnica: string;
  acessorios_licencas_necessarios?: string[];
  pontos_atencao?: string[];
  fonte_url?: string;
}

interface RequisitoComparativo {
  item_tr: string;
  categoria: string;
  requisito_tr: string;
  especificacao_encontrada: string;
  status: 'ATENDE_100' | 'ATENDE_RESSALVA' | 'NAO_ATENDE' | 'NAO_INFORMADO';
  evidencia_pagina_ou_fonte?: string;
  observacao?: string;
}

interface AnaliseTRResult {
  resumo_tr: {
    titulo_objeto: string;
    orgao?: string;
    categoria_tecnologica?: string;
    total_itens?: number;
    resumo_executivo: string;
    normas_certificacoes_exigidas?: string[];
    garantia_sla_exigidos?: string;
  };
  aderencia_geral: {
    percentual_atendimento: number;
    veredicto: string;
    justificativa_veredicto: string;
  };
  modelos_recomendados: ModeloRecomendado[];
  matriz_comparativa: RequisitoComparativo[];
  alertas_desclassificacao?: string[];
  fontes_consultadas?: Array<{ title: string; url: string }>;
  modo_busca_internet?: boolean;
}

const fileToBase64 = (file: File): Promise<EncodedFile> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const res = String(reader.result || '');
      const base64 = res.includes(',') ? res.split(',')[1] : res;
      resolve({ name: file.name, size: file.size, base64 });
    };
    reader.onerror = () => reject(new Error(`Falha ao ler o arquivo ${file.name}`));
    reader.readAsDataURL(file);
  });

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  ATENDE_100: {
    label: 'Atende 100%',
    cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  },
  ATENDE_RESSALVA: {
    label: 'Atende c/ Ressalva',
    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  },
  NAO_ATENDE: {
    label: 'Não Atende',
    cls: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  },
  NAO_INFORMADO: {
    label: 'Não Consta',
    cls: 'bg-slate-500/15 text-slate-300 border-slate-500/40',
  },
};

export const AnaliseTRPage: React.FC = () => {
  const [trFiles, setTrFiles] = useState<File[]>([]);
  const [datasheetFiles, setDatasheetFiles] = useState<File[]>([]);
  const [searchWeb, setSearchWeb] = useState<boolean>(true);
  const [customNotes, setCustomNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnaliseTRResult | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [iaConfigured, setIaConfigured] = useState<boolean>(true);
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState<string>('');
  const [savingKey, setSavingKey] = useState<boolean>(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(buildApiUrl('/analise-tr/ia-status'), { headers: getAuthHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.configured === 'boolean') {
          setIaConfigured(d.configured);
          if (!d.configured) setShowKeyConfig(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveGeminiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!geminiKeyInput.trim()) return;
    setSavingKey(true);
    setKeyMsg(null);
    try {
      const res = await fetch(buildApiUrl('/analise-tr/configurar-ia'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ geminiApiKey: geminiKeyInput.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d?.error || 'Erro ao salvar chave');
      setIaConfigured(true);
      setShowKeyConfig(false);
      setGeminiKeyInput('');
      setKeyMsg('Chave Gemini API ativada com sucesso!');
    } catch (err) {
      setKeyMsg(err instanceof Error ? err.message : 'Erro ao salvar chave.');
    } finally {
      setSavingKey(false);
    }
  };

  const filteredMatrix = useMemo(() => {
    const list = result?.matriz_comparativa || [];
    if (statusFilter === 'TODOS') return list;
    return list.filter((r) => r.status === statusFilter);
  }, [result, statusFilter]);

  const handleAnalyze = async () => {
    if (trFiles.length === 0) {
      setError('Anexe o Termo de Referência (TR) em PDF ou DOCX.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const encodedTR = await Promise.all(trFiles.map(fileToBase64));
      const encodedDS = await Promise.all(datasheetFiles.map(fileToBase64));
      const response = await fetch(buildApiUrl('/analise-tr/analisar-equipamentos'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          trFiles: encodedTR,
          datasheetFiles: encodedDS,
          searchWeb: searchWeb || encodedDS.length === 0,
          customNotes,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Erro HTTP ${response.status}`);
      }
      setResult(data.analise);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar análise técnica do TR.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportReport = () => {
    if (!result) return;
    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Parecer Técnico de TR - ${esc(result.resumo_tr.titulo_objeto)}</title>
<style>
  body { font-family: Arial, sans-serif; color: #0f172a; max-width: 960px; margin: 20px auto; padding: 16px; font-size: 12px; }
  h1 { color: #0369a1; border-bottom: 2px solid #0284c7; padding-bottom: 8px; }
  .card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
  th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
  th { background: #f1f5f9; }
</style></head><body>
  <h1>Parecer Técnico de Análise de TR</h1>
  <div class="card">
    <strong>Objeto:</strong> ${esc(result.resumo_tr.titulo_objeto)}<br/>
    <strong>Órgão:</strong> ${esc(result.resumo_tr.orgao || 'Não informado')}<br/>
    <strong>Aderência Geral:</strong> ${result.aderencia_geral.percentual_atendimento}% (${esc(result.aderencia_geral.veredicto)})<br/>
    <p>${esc(result.aderencia_geral.justificativa_veredicto)}</p>
  </div>
  <h2>Modelos Recomendados (100% Aderentes)</h2>
  ${(result.modelos_recomendados || []).map((m) => `
    <div class="card">
      <strong>${esc(m.fabricante)} — ${esc(m.modelo)}</strong> (${m.aderencia_percentual}%) ${m.part_number ? `• PN: ${esc(m.part_number)}` : ''}<br/>
      <p>${esc(m.justificativa_tecnica)}</p>
    </div>`).join('')}
  <h2>Matriz Comparativa de Requisitos</h2>
  <table><thead><tr><th>Item</th><th>Requisito do TR</th><th>Especificação Encontrada</th><th>Status</th></tr></thead>
  <tbody>${(result.matriz_comparativa || []).map((r) => `
    <tr><td>${esc(r.item_tr)}</td><td>${esc(r.requisito_tr)}</td><td>${esc(r.especificacao_encontrada)}</td><td>${esc(r.status)}</td></tr>`).join('')}
  </tbody></table>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'parecer_tecnico_tr.html';
    a.click();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-[rgb(var(--crm-ink-rgb)_/_1)]">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-0.5 text-[11px] font-bold text-cyan-300">
                <Cpu className="w-3.5 h-3.5" /> Engenharia & Pré-Vendas IA
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-0.5 text-[11px] font-bold text-emerald-300">
                <Globe className="w-3.5 h-3.5" /> Busca de Modelos na Internet + Match de Datasheet
              </span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">Análise de TR</h1>
            <p className="text-xs sm:text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
              Anexe o Termo de Referência (TR) e o Datasheet do equipamento para auditoria técnica 100%, ou anexe somente o TR para buscar na internet modelos que atendam integralmente.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowKeyConfig((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                iaConfigured
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'border-amber-500/50 bg-amber-500/20 text-amber-200 animate-pulse'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              {iaConfigured ? 'IA Gemini Ativa' : 'Configurar Chave Gemini'}
            </button>
            {result && (
              <button
                type="button"
                onClick={handleExportReport}
                className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/15 hover:bg-cyan-500/25 px-4 py-2 text-xs font-bold text-cyan-200 transition-colors"
              >
                <Download className="w-4 h-4" /> Exportar Parecer Técnico
              </button>
            )}
          </div>
        </div>

        {(showKeyConfig || keyMsg) && (
          <form
            onSubmit={handleSaveGeminiKey}
            className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-wrap items-center gap-3"
          >
            <KeyRound className="w-4 h-4 text-amber-300 flex-shrink-0" />
            <input
              type="password"
              value={geminiKeyInput}
              onChange={(e) => setGeminiKeyInput(e.target.value)}
              placeholder="Cole sua GEMINI_API_KEY (AIza...) para ativar busca na internet e auditoria TR × Datasheet"
              className="flex-1 min-w-[240px] rounded-lg border border-[var(--crm-border)] bg-black/30 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-400"
            />
            <button
              type="submit"
              disabled={savingKey || !geminiKeyInput.trim()}
              className="rounded-lg bg-amber-500 hover:bg-amber-400 px-3.5 py-1.5 text-xs font-black text-slate-950 disabled:opacity-60"
            >
              {savingKey ? 'Salvando...' : 'Ativar IA'}
            </button>
            {keyMsg && <span className="text-xs font-semibold text-emerald-300">{keyMsg}</span>}
          </form>
        )}

        {/* Upload Duplo: TR + Datasheet */}
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {/* Campo 1: Termo de Referência (TR) */}
          <div className="rounded-xl border border-dashed border-cyan-500/50 bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-5 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> 1. Termo de Referência (TR) *
                </span>
                <span className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)]">PDF ou DOCX</span>
              </div>
              <label className="mt-2 flex flex-col items-center justify-center rounded-lg border border-[var(--crm-border)] bg-black/20 hover:border-cyan-400 p-5 cursor-pointer transition-colors text-center">
                <Upload className="w-6 h-6 text-cyan-400 mb-2" />
                <span className="text-xs font-bold">Clique para anexar o Termo de Referência</span>
                <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">Aceita múltiplos anexos técnicos do TR</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) setTrFiles((prev) => [...prev, ...files]);
                  }}
                />
              </label>
            </div>
            {trFiles.length > 0 && (
              <div className="space-y-1.5">
                {trFiles.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-3 py-1.5 text-xs">
                    <span className="truncate font-semibold text-cyan-200">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setTrFiles((p) => p.filter((_, i) => i !== idx))}
                      className="text-rose-400 hover:text-rose-300 ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Campo 2: Datasheet do Equipamento */}
          <div className="rounded-xl border border-dashed border-emerald-500/50 bg-[rgb(var(--crm-surface-rgb)_/_0.6)] p-5 flex flex-col justify-between gap-3">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4" /> 2. Datasheet do Equipamento (Opcional)
                </span>
                <span className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)]">PDF ou DOCX</span>
              </div>
              <label className="mt-2 flex flex-col items-center justify-center rounded-lg border border-[var(--crm-border)] bg-black/20 hover:border-emerald-400 p-5 cursor-pointer transition-colors text-center">
                <Upload className="w-6 h-6 text-emerald-400 mb-2" />
                <span className="text-xs font-bold">Clique para anexar o Datasheet do equipamento</span>
                <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">Deixe vazio para apenas buscar modelos na internet</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) setDatasheetFiles((prev) => [...prev, ...files]);
                  }}
                />
              </label>
            </div>
            {datasheetFiles.length > 0 && (
              <div className="space-y-1.5">
                {datasheetFiles.map((f, idx) => (
                  <div key={`${f.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs">
                    <span className="truncate font-semibold text-emerald-200">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setDatasheetFiles((p) => p.filter((_, i) => i !== idx))}
                      className="text-rose-400 hover:text-rose-300 ml-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Opção Busca na Internet + Observações + Botão Analisar */}
        <div className="mt-4 rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.75)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={searchWeb}
                onChange={(e) => setSearchWeb(e.target.checked)}
                className="w-4 h-4 accent-cyan-500 rounded"
              />
              <span className="text-xs sm:text-sm font-bold flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-cyan-400" />
                Buscar na internet modelos de equipamentos que atendam 100% do TR
              </span>
            </label>

            <button
              type="button"
              disabled={loading || trFiles.length === 0}
              onClick={handleAnalyze}
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 px-5 py-2.5 text-xs sm:text-sm font-black text-white shadow-lg disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading
                ? 'Analisando TR e consultando modelos...'
                : datasheetFiles.length > 0
                  ? 'Analisar TR × Datasheet'
                  : 'Analisar TR e Buscar Modelos'}
            </button>
          </div>

          <input
            type="text"
            value={customNotes}
            onChange={(e) => setCustomNotes(e.target.value)}
            placeholder="Opcional: informe fabricante preferencial, restrições de orçamento ou foco da análise (ex: priorizar Fortinet/Dell/Epson)..."
            className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 px-3.5 py-2 text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] outline-none focus:border-cyan-400"
          />
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/15 p-3.5 text-xs font-semibold text-rose-200 flex items-center gap-2">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
      </div>

      {/* RESULTADO DA ANÁLISE TÉCNICA */}
      {result && (
        <div className="space-y-6">
          {/* 1. KPIs e Veredicto */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-cyan-500/40 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-4">
              <span className="text-[11px] font-bold uppercase text-cyan-300">Aderência Técnica</span>
              <div className="mt-1 text-3xl font-black text-emerald-400">
                {result.aderencia_geral?.percentual_atendimento ?? 100}%
              </div>
              <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">{result.aderencia_geral?.veredicto}</p>
            </div>
            <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-4">
              <span className="text-[11px] font-bold uppercase text-[rgb(var(--crm-muted-rgb)_/_1)]">Categoria</span>
              <div className="mt-1 text-base font-black">{result.resumo_tr?.categoria_tecnologica || 'TI / Infraestrutura'}</div>
              <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">{result.resumo_tr?.total_itens || 1} item(ns) no TR</p>
            </div>
            <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-4">
              <span className="text-[11px] font-bold uppercase text-[rgb(var(--crm-muted-rgb)_/_1)]">Requisitos Mapeados</span>
              <div className="mt-1 text-2xl font-black">{result.matriz_comparativa?.length || 0}</div>
              <p className="text-[11px] text-emerald-300 mt-1">
                {(result.matriz_comparativa || []).filter((r) => r.status === 'ATENDE_100').length} atendem 100%
              </p>
            </div>
            <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-4">
              <span className="text-[11px] font-bold uppercase text-[rgb(var(--crm-muted-rgb)_/_1)]">Modelos Sugeridos</span>
              <div className="mt-1 text-2xl font-black text-cyan-300">{result.modelos_recomendados?.length || 0}</div>
              <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
                {result.modo_busca_internet ? 'Com busca na internet' : 'Baseado em datasheet'}
              </p>
            </div>
          </div>

          {/* Resumo Executivo do TR */}
          <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 space-y-2">
            <h2 className="text-sm font-black uppercase tracking-wider text-cyan-300">
              Resumo Técnico do TR — {result.resumo_tr?.titulo_objeto}
            </h2>
            <p className="text-xs sm:text-sm leading-relaxed">{result.resumo_tr?.resumo_executivo}</p>
            <p className="text-xs text-emerald-300 pt-1">
              <strong>Veredicto:</strong> {result.aderencia_geral?.justificativa_veredicto}
            </p>
          </div>

          {/* 2. Modelos de Equipamentos Recomendados */}
          <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 space-y-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> Modelos de Equipamentos Recomendados (Aderentes ao TR)
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(result.modelos_recomendados || []).map((mod, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-emerald-500/35 bg-[rgb(var(--crm-surface-rgb)_/_0.8)] p-4 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-cyan-300">{mod.item_ou_lote || 'Geral'}</span>
                      <h3 className="text-sm sm:text-base font-black">
                        {mod.fabricante} — {mod.modelo}
                      </h3>
                      {mod.part_number && (
                        <span className="text-[11px] font-mono text-[rgb(var(--crm-muted-rgb)_/_1)]">PN: {mod.part_number}</span>
                      )}
                    </div>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-xs font-black text-emerald-300">
                      {mod.aderencia_percentual}%
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-[rgb(var(--crm-muted-rgb)_/_1)]">{mod.justificativa_tecnica}</p>
                  {(mod.acessorios_licencas_necessarios || []).length > 0 && (
                    <div className="text-[11px]">
                      <strong className="text-cyan-300">Acessórios / Licenças:</strong>{' '}
                      {mod.acessorios_licencas_necessarios?.join(', ')}
                    </div>
                  )}
                  {mod.fonte_url && (
                    <a
                      href={mod.fonte_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:underline"
                    >
                      Ver especificação / fonte <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 3. Matriz Comparativa de Requisitos */}
          <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] overflow-hidden">
            <div className="p-4 border-b border-[var(--crm-border)] flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" /> Matriz Técnica Comparativa (TR × Equipamento)
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {['TODOS', 'ATENDE_100', 'ATENDE_RESSALVA', 'NAO_ATENDE'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold ${
                      statusFilter === st
                        ? 'bg-cyan-600 text-white'
                        : 'bg-black/25 text-[rgb(var(--crm-muted-rgb)_/_1)] border border-[var(--crm-border)]'
                    }`}
                  >
                    {st === 'TODOS' ? 'Todos' : STATUS_BADGE[st]?.label || st}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border-b border-[var(--crm-border)] text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase">
                    <th className="py-2.5 px-3">Item / Cat.</th>
                    <th className="py-2.5 px-3">Requisito do TR</th>
                    <th className="py-2.5 px-3">Especificação Encontrada</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3">Evidência / Obs.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--crm-border)]">
                  {filteredMatrix.map((row, idx) => {
                    const badge = STATUS_BADGE[row.status] || STATUS_BADGE.NAO_INFORMADO;
                    return (
                      <tr key={idx} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          <div>{row.item_tr}</div>
                          <div className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)]">{row.categoria}</div>
                        </td>
                        <td className="py-2.5 px-3 max-w-xs">{row.requisito_tr}</td>
                        <td className="py-2.5 px-3 max-w-xs text-cyan-200">{row.especificacao_encontrada}</td>
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-black ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                          {row.evidencia_pagina_ou_fonte && <div className="font-semibold">{row.evidencia_pagina_ou_fonte}</div>}
                          {row.observacao && <div>{row.observacao}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Alertas de Desclassificação & Fontes Web */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-5 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-rose-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" /> Alertas Críticos de Desclassificação
              </h3>
              <ul className="list-disc pl-5 space-y-1 text-xs text-rose-100">
                {(result.alertas_desclassificacao || []).length > 0 ? (
                  result.alertas_desclassificacao?.map((a, i) => <li key={i}>{a}</li>)
                ) : (
                  <li>Nenhum ponto crítico adicional sinalizado.</li>
                )}
              </ul>
            </div>

            <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 space-y-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                <Search className="w-4 h-4" /> Fontes Consultadas na Internet
              </h3>
              {(result.fontes_consultadas || []).length > 0 ? (
                <ul className="space-y-1.5 text-xs">
                  {result.fontes_consultadas?.slice(0, 8).map((f, i) => (
                    <li key={i}>
                      <a href={f.url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline inline-flex items-center gap-1">
                        {f.title} <ExternalLink className="w-3 h-3" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                  Análise baseada nos documentos anexados e conhecimento técnico estruturado.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
