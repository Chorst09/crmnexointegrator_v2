import { useEffect, useState } from 'react';
import {
  BookOpen, Plus, Trash2, X, Save,
  Lightbulb, Swords, FileText, Code2,
  TrendingDown, Users, Tag, Puzzle
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

type LearningCategory =
  | 'NEGOCIACAO' | 'CONCORRENCIA' | 'EDITAL_JURIDICO' | 'ESCOPO_TECNICO'
  | 'PERDA_DE_DEAL' | 'RELACIONAMENTO' | 'PRECIFICACAO' | 'OUTRO';

interface Author { id: string; name: string; email: string; }
interface Learning {
  id: string; opportunityId: string; category: LearningCategory;
  description: string; author: Author; createdAt: string; updatedAt: string;
}
interface Props { opportunityId: string; currentUserId: string; isAdmin: boolean; }

const CATS: Record<LearningCategory, { label: string; icon: typeof BookOpen; badge: string; row: string }> = {
  NEGOCIACAO:      { label: 'Negociação',      icon: Lightbulb,    badge: 'bg-cyan-500/20    text-cyan-300    border-cyan-500/40',    row: 'border-cyan-500/20    bg-cyan-500/5'    },
  CONCORRENCIA:    { label: 'Concorrência',    icon: Swords,        badge: 'bg-purple-500/20  text-purple-300  border-purple-500/40',  row: 'border-purple-500/20  bg-purple-500/5'  },
  EDITAL_JURIDICO: { label: 'Edital/Jurídico', icon: FileText,      badge: 'bg-amber-500/20   text-amber-300   border-amber-500/40',   row: 'border-amber-500/20   bg-amber-500/5'   },
  ESCOPO_TECNICO:  { label: 'Escopo Técnico',  icon: Code2,         badge: 'bg-blue-500/20    text-blue-300    border-blue-500/40',    row: 'border-blue-500/20    bg-blue-500/5'    },
  PERDA_DE_DEAL:   { label: 'Perda de Deal',   icon: TrendingDown,  badge: 'bg-red-500/20     text-red-300     border-red-500/40',     row: 'border-red-500/20     bg-red-500/5'     },
  RELACIONAMENTO:  { label: 'Relacionamento',  icon: Users,         badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', row: 'border-emerald-500/20 bg-emerald-500/5' },
  PRECIFICACAO:    { label: 'Precificação',    icon: Tag,           badge: 'bg-yellow-500/20  text-yellow-300  border-yellow-500/40',  row: 'border-yellow-500/20  bg-yellow-500/5'  },
  OUTRO:           { label: 'Outro',           icon: Puzzle,        badge: 'bg-slate-500/20   text-slate-300   border-slate-500/40',   row: 'border-slate-500/20   bg-slate-500/5'   },
};

const CAT_KEYS = Object.keys(CATS) as LearningCategory[];

export default function OpportunityLearnings({ opportunityId, currentUserId, isAdmin }: Props) {
  const [learnings,  setLearnings]  = useState<Learning[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [filter,     setFilter]     = useState<LearningCategory | 'ALL'>('ALL');
  const [showForm,   setShowForm]   = useState(false);
  const [desc,       setDesc]       = useState('');
  const [category,   setCategory]   = useState<LearningCategory>('NEGOCIACAO');
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const q = filter !== 'ALL' ? `?category=${filter}` : '';
      const r = await fetch(buildApiUrl(`/opportunity-learnings/${opportunityId}${q}`), { headers: getAuthHeaders() });
      if (r.ok) setLearnings(await r.json());
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [opportunityId, filter]);

  const handleSave = async () => {
    if (!desc.trim()) { setError('Informe a lição aprendida.'); return; }
    setSubmitting(true); setError('');
    try {
      const r = await fetch(buildApiUrl('/opportunity-learnings'), {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ opportunityId, description: desc.trim(), category })
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Erro ao salvar'); }
      const created = await r.json();
      setLearnings(prev => [created, ...prev]);
      setDesc(''); setCategory('NEGOCIACAO'); setShowForm(false);
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este aprendizado?')) return;
    const r = await fetch(buildApiUrl(`/opportunity-learnings/${id}`), { method: 'DELETE', headers: getAuthHeaders() });
    if (r.ok) setLearnings(prev => prev.filter(l => l.id !== id));
  };

  const visible = filter === 'ALL' ? learnings : learnings.filter(l => l.category === filter);

  return (
    <div className="rounded-xl border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.65)] overflow-hidden">

      {/* ── Cabeçalho ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 p-4 border-b border-[color:var(--crm-border)]">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/15 text-cyan-400 flex-shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[var(--crm-ink)]">Aprendizados</span>
              {learnings.length > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-cyan-500/20 border border-cyan-500/35 text-cyan-400 text-[10px] font-bold px-1.5 py-0.5 min-w-[18px] leading-none">
                  {learnings.length}
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--crm-muted)]">Lições para aprimorar futuras negociações.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(v => !v); setError(''); setDesc(''); setCategory('NEGOCIACAO'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
            showForm
              ? 'bg-slate-700 border-slate-600 text-slate-200'
              : 'bg-cyan-500/15 border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/25'
          }`}
        >
          {showForm ? <><X className="h-3.5 w-3.5" /> Cancelar</> : <><Plus className="h-3.5 w-3.5" /> Adicionar</>}
        </button>
      </div>

      {/* ── Formulário inline ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="p-4 border-b border-cyan-500/20 bg-cyan-500/5 space-y-3">

          {/* Categoria */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)] mb-2">Categoria *</p>
            <div className="flex flex-wrap gap-2">
              {CAT_KEYS.map(c => {
                const Icon = CATS[c].icon;
                return (
                  <button
                    key={c} type="button" onClick={() => setCategory(c)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      category === c ? CATS[c].badge : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Icon className="h-3 w-3" />
                    {CATS[c].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)] mb-2">Lição aprendida *</p>
            <textarea
              value={desc}
              onChange={e => { setDesc(e.target.value); setError(''); }}
              placeholder="Ex: Envolver o gestor de TI desde a fase de diagnóstico acelera aprovação. Evitar comprometer prazos antes de validar o escopo técnico..."
              rows={3}
              className="w-full rounded-lg border border-[color:var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_0.8)] px-3 py-2.5 text-sm text-[var(--crm-ink)] placeholder:text-[var(--crm-muted)] focus:outline-none focus:ring-1 focus:ring-cyan-500/50 resize-none"
            />
          </div>

          {error && <p className="text-xs font-medium text-red-400">{error}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || !desc.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="h-4 w-4" />
              {submitting ? 'Salvando...' : 'Salvar aprendizado'}
            </button>
          </div>
        </div>
      )}

      {/* ── Filtros por categoria ─────────────────────────────────────────── */}
      {learnings.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-[color:var(--crm-border)]">
          <button
            type="button" onClick={() => setFilter('ALL')}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
              filter === 'ALL'
                ? 'bg-[rgb(var(--crm-accent-rgb)_/_0.2)] border-[rgb(var(--crm-accent-rgb)_/_0.5)] text-[rgb(var(--crm-accent-rgb))]'
                : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            Todos ({learnings.length})
          </button>
          {CAT_KEYS.filter(c => learnings.some(l => l.category === c)).map(c => (
            <button
              key={c} type="button" onClick={() => setFilter(c)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                filter === c ? CATS[c].badge : 'border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {CATS[c].label} ({learnings.filter(l => l.category === c).length})
            </button>
          ))}
        </div>
      )}

      {/* ── Lista ─────────────────────────────────────────────────────────── */}
      <div className="p-4">
        {loading ? (
          <p className="text-center text-sm text-[var(--crm-muted)] py-4">Carregando...</p>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--crm-border)] p-6 text-center">
            <BookOpen className="h-8 w-8 text-[var(--crm-muted)] mx-auto mb-2 opacity-40" />
            <p className="text-sm text-[var(--crm-muted)]">
              Nenhum aprendizado registrado ainda.
            </p>
            {!showForm && (
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 border border-cyan-500/35 text-cyan-300 hover:bg-cyan-500/25 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Registrar primeiro aprendizado
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(l => {
              const c    = CATS[l.category];
              const Icon = c.icon;
              const canDel = isAdmin || l.author.id === currentUserId;
              return (
                <div key={l.id} className={`group relative rounded-xl border p-4 ${c.row}`}>
                  <div className="flex items-start gap-3">
                    <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${c.badge.split(' ')[1]}`} />
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${c.badge}`}>
                          {c.label}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-[var(--crm-ink)] whitespace-pre-wrap">{l.description}</p>
                      <p className="mt-1.5 text-xs text-[var(--crm-muted)]">
                        {l.author.name} · {new Date(l.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    {canDel && (
                      <button
                        type="button"
                        onClick={() => handleDelete(l.id)}
                        title="Excluir"
                        className="flex-shrink-0 p-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/15 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
