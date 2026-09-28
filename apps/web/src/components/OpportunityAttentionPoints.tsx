import { useEffect, useState } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  CheckCheck,
  RotateCcw,
  X,
  Save
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

type Severity = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
type Status   = 'PENDENTE' | 'RESOLVIDO';

interface Author { id: string; name: string; email: string; }
interface AttentionPoint {
  id: string; opportunityId: string; description: string;
  severity: Severity; status: Status;
  resolvedAt: string | null; resolvedBy: { id: string; name: string } | null;
  author: Author; createdAt: string; updatedAt: string;
}
interface Props { opportunityId: string; currentUserId: string; isAdmin: boolean; }

const SEV: Record<Severity, { label: string; dot: string; badge: string; row: string }> = {
  BAIXA:   { label: 'Baixa',   dot: 'bg-emerald-400', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', row: 'border-emerald-500/25 bg-emerald-500/5'  },
  MEDIA:   { label: 'Média',   dot: 'bg-yellow-400',  badge: 'bg-yellow-500/20  text-yellow-300  border-yellow-500/40',  row: 'border-yellow-500/25  bg-yellow-500/5'   },
  ALTA:    { label: 'Alta',    dot: 'bg-orange-400',  badge: 'bg-orange-500/20  text-orange-300  border-orange-500/40',  row: 'border-orange-500/25  bg-orange-500/5'   },
  CRITICA: { label: 'Crítica', dot: 'bg-red-400',     badge: 'bg-red-500/20     text-red-300     border-red-500/40',     row: 'border-red-500/25     bg-red-500/5'      },
};

const SEVS: Severity[] = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'];

export default function OpportunityAttentionPoints({ opportunityId, currentUserId, isAdmin }: Props) {
  const [points,       setPoints]       = useState<AttentionPoint[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [filter,       setFilter]       = useState<'ALL' | Status>('ALL');
  const [showForm,     setShowForm]     = useState(false);
  const [desc,         setDesc]         = useState('');
  const [severity,     setSeverity]     = useState<Severity>('MEDIA');
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = filter !== 'ALL' ? `?status=${filter}` : '';
      const r = await fetch(buildApiUrl(`/opportunity-attention-points/${opportunityId}${q}`), { headers: getAuthHeaders() });
      if (r.ok) setPoints(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [opportunityId, filter]);

  const handleSave = async () => {
    if (!desc.trim()) { setError('Informe a descrição do ponto de atenção.'); return; }
    setSubmitting(true); setError('');
    try {
      const r = await fetch(buildApiUrl('/opportunity-attention-points'), {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ opportunityId, description: desc.trim(), severity })
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Erro ao salvar'); }
      const created = await r.json();
      setPoints(prev => [created, ...prev]);
      setDesc(''); setSeverity('MEDIA'); setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleToggle = async (p: AttentionPoint) => {
    const s: Status = p.status === 'PENDENTE' ? 'RESOLVIDO' : 'PENDENTE';
    const r = await fetch(buildApiUrl(`/opportunity-attention-points/${p.id}`), {
      method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status: s })
    });
    if (r.ok) { const u = await r.json(); setPoints(prev => prev.map(x => x.id === u.id ? u : x)); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este ponto de atenção?')) return;
    const r = await fetch(buildApiUrl(`/opportunity-attention-points/${id}`), { method: 'DELETE', headers: getAuthHeaders() });
    if (r.ok) setPoints(prev => prev.filter(x => x.id !== id));
  };

  const pending  = points.filter(p => p.status === 'PENDENTE').length;
  const visible  = filter === 'ALL' ? points : points.filter(p => p.status === filter);

  return (
    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] overflow-hidden">

      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-[color:var(--crm-border)]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-orange-500/30 bg-orange-500/15 text-orange-400 flex-shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--crm-ink)]">Pontos de Atenção</span>
              {pending > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-500/25 border border-red-500/40 text-red-300 text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] leading-none">
                  {pending}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--crm-muted)]">Riscos, pendências e alertas críticos.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setError(''); setDesc(''); setSeverity('MEDIA'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            showForm
              ? 'bg-slate-700 border-slate-600 text-slate-200'
              : 'bg-orange-500/15 border-orange-500/35 text-orange-300 hover:bg-orange-500/25'
          }`}
        >
          {showForm ? <><X className="h-3.5 w-3.5" /> Cancelar</> : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}
        </button>
      </div>

      {/* ── Formulário inline ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="p-4 border-b border-orange-500/20 bg-orange-500/5 space-y-3">

          {/* Gravidade */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)] mb-2">Gravidade</p>
            <div className="flex flex-wrap gap-2">
              {SEVS.map(s => (
                <button
                  key={s} type="button" onClick={() => setSeverity(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    severity === s ? SEV[s].badge : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className={`inline-block h-2 w-2 rounded-full ${SEV[s].dot}`} />
                  {SEV[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)] mb-2">Descrição *</p>
            <textarea
              value={desc}
              onChange={e => { setDesc(e.target.value); setError(''); }}
              placeholder="Ex: Risco de impugnação do edital, pendência técnica com o cliente, exigência contratual não resolvida..."
              rows={3}
              className="w-full rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.8)] px-3 py-2.5 text-sm text-[var(--crm-ink)] placeholder:text-[var(--crm-muted)] focus:outline-none focus:ring-1 focus:ring-orange-500/50 resize-none"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-400">{error}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || !desc.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {submitting ? 'Salvando...' : 'Salvar ponto de atenção'}
            </button>
          </div>
        </div>
      )}

      {/* ── Filtros ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 py-3 border-b border-[color:var(--crm-border)]">
        {(['ALL', 'PENDENTE', 'RESOLVIDO'] as const).map(f => (
          <button
            key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              filter === f
                ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.2)] border-[rgb(var(--crm-accent-rgb)_/_0.5)] text-[rgb(var(--crm-accent-rgb))]'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            {f === 'ALL' ? `Todos (${points.length})` : f === 'PENDENTE' ? `Pendentes (${points.filter(p => p.status === 'PENDENTE').length})` : `Resolvidos (${points.filter(p => p.status === 'RESOLVIDO').length})`}
          </button>
        ))}
      </div>

      {/* ── Lista ─────────────────────────────────────────────────────────── */}
      <div className="p-4">
        {loading ? (
          <p className="text-center text-sm text-[var(--crm-muted)] py-4">Carregando...</p>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--crm-border)] p-6 text-center">
            <ShieldAlert className="h-8 w-8 text-[var(--crm-muted)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[var(--crm-muted)]">
              {filter === 'RESOLVIDO' ? 'Nenhum ponto resolvido ainda.' :
               filter === 'PENDENTE'  ? 'Nenhum ponto de atenção pendente. ✓' :
               'Nenhum ponto de atenção registrado.'}
            </p>
            {filter === 'ALL' && !showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500/15 border border-orange-500/35 text-orange-300 hover:bg-orange-500/25 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Registrar primeiro ponto
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(point => {
              const s   = SEV[point.severity];
              const resolved = point.status === 'RESOLVIDO';
              const canAct   = isAdmin || point.author.id === currentUserId;
              return (
                <div key={point.id} className={`group relative rounded-xl border p-4 transition-opacity ${resolved ? 'opacity-55' : ''} ${s.row}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${s.badge}`}>
                          {s.label}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          resolved
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-700/50 border-slate-600/40 text-slate-400'
                        }`}>
                          {resolved ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          {resolved ? 'Resolvido' : 'Pendente'}
                        </span>
                      </div>
                      <p className={`text-sm leading-relaxed whitespace-pre-wrap ${resolved ? 'line-through text-[var(--crm-muted)]' : 'text-[var(--crm-ink)]'}`}>
                        {point.description}
                      </p>
                      <p className="mt-1.5 text-xs text-[var(--crm-muted)]">
                        {point.author.name} · {new Date(point.createdAt).toLocaleDateString('pt-BR')}
                        {resolved && point.resolvedBy && ` · Resolvido por ${point.resolvedBy.name}`}
                      </p>
                    </div>

                    {/* Ações */}
                    {canAct && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleToggle(point)}
                          title={resolved ? 'Reabrir' : 'Marcar como resolvido'}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            resolved
                              ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
                              : 'border-emerald-600/50 text-emerald-400 hover:bg-emerald-500/15'
                          }`}
                        >
                          {resolved ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(point.id)}
                          title="Excluir"
                          className="p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/15 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
