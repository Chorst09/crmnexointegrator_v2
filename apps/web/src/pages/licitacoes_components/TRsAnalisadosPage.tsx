import React, { useEffect, useMemo, useState } from 'react';
import {
  BookmarkCheck,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../../config/api';

export interface SavedAnaliseTRItem {
  id: string;
  titulo_objeto: string;
  orgao?: string;
  categoria_tecnologica?: string;
  percentual_atendimento: number;
  veredicto?: string;
  modo_busca_internet?: boolean;
  arquivos_tr?: string[];
  arquivos_datasheet?: string[];
  observacoes?: string;
  analise_json: {
    resumo_tr?: {
      titulo_objeto?: string;
      orgao?: string;
      categoria_tecnologica?: string;
      total_itens?: number;
      resumo_executivo?: string;
    };
    aderencia_geral?: {
      percentual_atendimento?: number;
      veredicto?: string;
      justificativa_veredicto?: string;
    };
    modelos_recomendados?: Array<{
      item_ou_lote?: string;
      fabricante: string;
      modelo: string;
      part_number?: string;
      aderencia_percentual: number;
      justificativa_tecnica: string;
      acessorios_licencas_necessarios?: string[];
      fonte_url?: string;
    }>;
    matriz_comparativa?: Array<{
      item_tr: string;
      categoria: string;
      requisito_tr: string;
      especificacao_encontrada: string;
      status: string;
      evidencia_pagina_ou_fonte?: string;
      observacao?: string;
    }>;
    alertas_desclassificacao?: string[];
    fontes_consultadas?: Array<{ title: string; url: string }>;
  };
  created_at?: string;
  updated_at?: string;
}

interface TRsAnalisadosPageProps {
  onOpenInAnaliseTR?: (item: SavedAnaliseTRItem) => void;
  onNavigateToAnaliseTR?: () => void;
}

const formatDate = (iso?: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const TRsAnalisadosPage: React.FC<TRsAnalisadosPageProps> = ({
  onOpenInAnaliseTR,
  onNavigateToAnaliseTR,
}) => {
  const [items, setItems] = useState<SavedAnaliseTRItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterAderencia, setFilterAderencia] = useState<'todos' | '100' | 'ressalvas'>('todos');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const fetchSaved = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(buildApiUrl(`/analise-tr/analises-salvas?t=${Date.now()}`), {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Falha ao carregar TRs analisados');
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao listar TRs analisados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSaved();
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter((it) => {
      if (filterAderencia === '100' && it.percentual_atendimento < 95) return false;
      if (filterAderencia === 'ressalvas' && it.percentual_atendimento >= 95) return false;
      if (!q) return true;
      const modelosTxt = (it.analise_json?.modelos_recomendados || [])
        .map((m) => `${m.fabricante} ${m.modelo} ${m.part_number || ''}`)
        .join(' ')
        .toLowerCase();
      return (
        (it.titulo_objeto || '').toLowerCase().includes(q) ||
        (it.orgao || '').toLowerCase().includes(q) ||
        (it.categoria_tecnologica || '').toLowerCase().includes(q) ||
        modelosTxt.includes(q)
      );
    });
  }, [items, searchTerm, filterAderencia]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(buildApiUrl(`/analise-tr/analises-salvas/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || 'Erro ao excluir TR analisado');
      }
      setItems((prev) => prev.filter((it) => it.id !== id));
      showNotice('TR analisado removido com sucesso.');
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Erro ao excluir');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportHtml = (item: SavedAnaliseTRItem) => {
    const a = item.analise_json || {};
    const esc = (v: unknown) =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Parecer Técnico de TR - ${esc(item.titulo_objeto)}</title>
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
    <strong>Objeto:</strong> ${esc(item.titulo_objeto)}<br/>
    <strong>Órgão:</strong> ${esc(item.orgao || 'Não informado')}<br/>
    <strong>Aderência Geral:</strong> ${item.percentual_atendimento}% (${esc(item.veredicto || '')})<br/>
    <p>${esc(a.aderencia_geral?.justificativa_veredicto || a.resumo_tr?.resumo_executivo || '')}</p>
  </div>
  <h2>Modelos Recomendados</h2>
  ${(a.modelos_recomendados || []).map((m) => `
    <div class="card">
      <strong>${esc(m.fabricante)} — ${esc(m.modelo)}</strong> (${m.aderencia_percentual}%) ${m.part_number ? `• PN: ${esc(m.part_number)}` : ''}<br/>
      <p>${esc(m.justificativa_tecnica)}</p>
    </div>`).join('')}
  <h2>Matriz Comparativa</h2>
  <table><thead><tr><th>Item</th><th>Requisito do TR</th><th>Especificação Encontrada</th><th>Status</th></tr></thead>
  <tbody>${(a.matriz_comparativa || []).map((r) => `
    <tr><td>${esc(r.item_tr)}</td><td>${esc(r.requisito_tr)}</td><td>${esc(r.especificacao_encontrada)}</td><td>${esc(r.status)}</td></tr>`).join('')}
  </tbody></table>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `parecer_tr_${item.id.slice(0, 8)}.html`;
    link.click();
  };

  const totalModelos = useMemo(
    () => items.reduce((acc, it) => acc + (it.analise_json?.modelos_recomendados?.length || 0), 0),
    [items]
  );
  const total100 = useMemo(
    () => items.filter((it) => it.percentual_atendimento >= 95).length,
    [items]
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-[rgb(var(--crm-ink-rgb)_/_1)]">
      {/* Cabeçalho */}
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-0.5 text-[11px] font-bold text-cyan-300 mb-2">
              <BookmarkCheck className="w-3.5 h-3.5" /> Repositório Técnico de Engenharia B2G
            </span>
            <h1 className="text-2xl font-black tracking-tight">TRs Analisados</h1>
            <p className="text-xs sm:text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
              Consulte pareceres técnicos salvos, modelos de equipamentos aderentes e matrizes comparativas TR × Datasheet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={fetchSaved}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] bg-black/25 hover:border-cyan-400 px-3.5 py-2 text-xs font-bold transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </button>
            {onNavigateToAnaliseTR && (
              <button
                type="button"
                onClick={onNavigateToAnaliseTR}
                className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:brightness-110 px-4 py-2 text-xs font-black text-white shadow-lg"
              >
                <Sparkles className="w-3.5 h-3.5" /> Nova Análise de TR
              </button>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] p-3.5">
            <span className="text-[10px] font-bold uppercase text-[rgb(var(--crm-muted-rgb)_/_1)]">TRs Salvos</span>
            <div className="text-2xl font-black text-cyan-300 mt-0.5">{items.length}</div>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] p-3.5">
            <span className="text-[10px] font-bold uppercase text-[rgb(var(--crm-muted-rgb)_/_1)]">Aderência Plena (≥ 95%)</span>
            <div className="text-2xl font-black text-emerald-400 mt-0.5">{total100}</div>
          </div>
          <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] p-3.5">
            <span className="text-[10px] font-bold uppercase text-[rgb(var(--crm-muted-rgb)_/_1)]">Modelos Recomendados</span>
            <div className="text-2xl font-black text-blue-300 mt-0.5">{totalModelos}</div>
          </div>
        </div>

        {/* Busca e Filtros */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-[rgb(var(--crm-muted-rgb)_/_1)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por objeto, órgão, categoria ou fabricante/modelo..."
              className="w-full rounded-lg border border-[var(--crm-border)] bg-black/25 pl-9 pr-3 py-2 text-xs outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex items-center gap-1.5">
            {[
              { id: 'todos', label: 'Todos' },
              { id: '100', label: '100% Aderentes' },
              { id: 'ressalvas', label: 'Com Ressalvas' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterAderencia(f.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  filterAderencia === f.id
                    ? 'bg-cyan-600 text-white border-cyan-500'
                    : 'bg-black/20 border-[var(--crm-border)] text-[rgb(var(--crm-muted-rgb)_/_1)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notification && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-200 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {notification}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs font-bold text-rose-200">
          {error}
        </div>
      )}

      {/* Lista de TRs Analisados */}
      {loading ? (
        <div className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
          <span className="text-xs font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)]">Carregando TRs analisados...</span>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] p-12 text-center space-y-3">
          <Cpu className="w-10 h-10 text-cyan-400/70 mx-auto" />
          <h3 className="text-base font-black">Nenhum TR analisado salvo ainda</h3>
          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] max-w-md mx-auto">
            Execute uma análise no módulo <strong>Análise de TR</strong> e clique no botão <strong>Salvar Análise</strong> para armazenar o parecer técnico e os modelos recomendados aqui.
          </p>
          {onNavigateToAnaliseTR && (
            <button
              type="button"
              onClick={onNavigateToAnaliseTR}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-black text-white"
            >
              <Sparkles className="w-4 h-4" /> Ir para Análise de TR
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((item) => {
            const isExpanded = Boolean(expandedIds[item.id]);
            const modelos = item.analise_json?.modelos_recomendados || [];
            const matriz = item.analise_json?.matriz_comparativa || [];
            const alertas = item.analise_json?.alertas_desclassificacao || [];
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 shadow-lg space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5 flex-1 min-w-[260px]">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-black ${
                          item.percentual_atendimento >= 95
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {item.percentual_atendimento}% Aderência
                      </span>
                      {item.categoria_tecnologica && (
                        <span className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold text-cyan-300">
                          {item.categoria_tecnologica}
                        </span>
                      )}
                      {item.modo_busca_internet && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-blue-500/35 bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                          <Globe className="w-3 h-3" /> Busca Internet
                        </span>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg font-black leading-snug">{item.titulo_objeto}</h2>
                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">
                      {item.orgao && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-cyan-400" /> {item.orgao}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-cyan-400" /> {formatDate(item.updated_at || item.created_at)}
                      </span>
                      {(item.arquivos_tr || []).length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5 text-cyan-400" /> TR: {item.arquivos_tr?.join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap items-center gap-2">
                    {onOpenInAnaliseTR && (
                      <button
                        type="button"
                        onClick={() => onOpenInAnaliseTR(item)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 px-3 py-1.5 text-xs font-black text-white"
                      >
                        <Sparkles className="w-3.5 h-3.5" /> Abrir na Bancada
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleExportHtml(item)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-200"
                    >
                      <Download className="w-3.5 h-3.5" /> Exportar
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedIds((p) => ({ ...p, [item.id]: !p[item.id] }))}
                      className="inline-flex items-center gap-1 rounded-lg border border-[var(--crm-border)] bg-black/25 px-3 py-1.5 text-xs font-bold"
                    >
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      {isExpanded ? 'Recolher' : 'Detalhes'}
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1.5 text-xs font-bold text-rose-300 disabled:opacity-50"
                      title="Excluir análise"
                    >
                      {deletingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Chips dos modelos recomendados */}
                {modelos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {modelos.map((m, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-200"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        {m.fabricante} — {m.modelo} ({m.aderencia_percentual}%)
                      </span>
                    ))}
                  </div>
                )}

                {/* Detalhes expansíveis */}
                {isExpanded && (
                  <div className="pt-3 border-t border-[var(--crm-border)] space-y-4">
                    {item.analise_json?.resumo_tr?.resumo_executivo && (
                      <p className="text-xs leading-relaxed text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        {item.analise_json.resumo_tr.resumo_executivo}
                      </p>
                    )}

                    {modelos.length > 0 && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {modelos.map((m, idx) => (
                          <div key={idx} className="rounded-xl border border-emerald-500/30 bg-black/20 p-3.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <strong className="text-xs font-black">
                                {m.fabricante} — {m.modelo}
                              </strong>
                              <span className="text-[11px] font-black text-emerald-300">{m.aderencia_percentual}%</span>
                            </div>
                            <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)]">{m.justificativa_tecnica}</p>
                            {m.fonte_url && (
                              <a
                                href={m.fonte_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:underline"
                              >
                                Ver fonte <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {matriz.length > 0 && (
                      <div className="text-xs flex items-center gap-2 text-cyan-300 font-bold">
                        <Layers className="w-4 h-4" /> {matriz.length} requisitos mapeados na matriz comparativa (clique em "Abrir na Bancada" para visualizar a tabela completa).
                      </div>
                    )}

                    {alertas.length > 0 && (
                      <div className="rounded-xl border border-rose-500/35 bg-rose-950/20 p-3 space-y-1">
                        <div className="text-[11px] font-black uppercase text-rose-300 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5" /> Alertas de Desclassificação
                        </div>
                        <ul className="list-disc pl-5 text-[11px] text-rose-100 space-y-0.5">
                          {alertas.map((al, i) => (
                            <li key={i}>{al}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
