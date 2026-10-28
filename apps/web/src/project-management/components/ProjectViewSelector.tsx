import React, { useEffect, useRef, useState } from 'react';
import { Users, BarChart2, List, LayoutTemplate, Calendar, GanttChartSquare, CheckCircle2, Activity, Plus, Search, X, Check } from 'lucide-react';

const views = [
  { id: 'team', label: 'Equipe', description: 'Veja os participantes e suas responsabilidades', icon: Users, color: 'bg-cyan-600' },
  { id: 'dashboard', label: 'Painéis', description: 'Acompanhe indicadores e resultados do projeto', icon: BarChart2, color: 'bg-fuchsia-600' },
  { id: 'list', label: 'Lista', description: 'Organize e acompanhe as fases em uma lista', icon: List, color: 'bg-slate-500' },
  { id: 'board', label: 'Quadro', description: 'Mova as fases entre as colunas do Kanban', icon: LayoutTemplate, color: 'bg-blue-600' },
  { id: 'calendar', label: 'Calendário', description: 'Visualize datas e planeje as entregas', icon: Calendar, color: 'bg-orange-500' },
  { id: 'gantt', label: 'Gantt', description: 'Acompanhe o cronograma do projeto', icon: GanttChartSquare, color: 'bg-rose-500' },
  { id: 'raci', label: 'Matriz RACI', description: 'Consulte os papéis de cada participante', icon: CheckCircle2, color: 'bg-violet-600' },
  { id: 'activity', label: 'Atividade', description: 'Acompanhe as atualizações do projeto', icon: Activity, color: 'bg-emerald-600' },
  { id: 'workload', label: 'Carga de trabalho', description: 'Confira a distribuição do trabalho na equipe', icon: List, color: 'bg-amber-600' }
] as const;

type View = typeof views[number]['id'];
const storageKey = 'pm_visible_project_views_v1';
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ProjectViewSelector({ projectId, activeView, onSelect }: {
  projectId: string; activeView: string; onSelect: (view: View) => void;
}) {
  const [preferences, setPreferences] = useState<Record<string, View[]>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
  });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const saved = preferences[projectId];
  const valid = Array.isArray(saved) ? views.filter(view => saved.includes(view.id)).map(view => view.id) : [];
  const visible = valid.length ? valid : views.map(view => view.id);

  useEffect(() => {
    if (!visible.includes(activeView as View)) onSelect(visible[0]);
  }, [projectId, visible.join(','), activeView, onSelect]);

  useEffect(() => { setOpen(false); setSearch(''); }, [projectId]);

  useEffect(() => {
    if (!open) return;
    searchInput.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const toggle = (id: View) => {
    const next = visible.includes(id) ? visible.filter(view => view !== id) : [...visible, id];
    if (!next.length) return;
    const updated = { ...preferences, [projectId]: next };
    setPreferences(updated);
    try { localStorage.setItem(storageKey, JSON.stringify(updated)); } catch { /* Keep selection in memory. */ }
  };

  return (
    <div ref={container} className="relative min-w-0">
      <div className="flex items-center gap-6 overflow-x-auto text-sm font-medium hide-scrollbar">
        {views.filter(view => visible.includes(view.id)).map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onSelect(id)} aria-current={activeView === id ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-2 border-b-2 pb-3 transition-colors ${activeView === id ? 'border-orange-500 text-slate-100' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
        <button ref={trigger} type="button" aria-expanded={open} aria-controls="project-view-picker"
          onClick={() => { setSearch(''); setOpen(!open); }}
          className="flex shrink-0 items-center gap-1 pb-3 text-slate-400 hover:text-slate-100">
          <Plus className="h-4 w-4" /> Visualização
        </button>
      </div>
      {open && (
        <div id="project-view-picker" role="dialog" aria-label="Selecionar visualizações"
          className="absolute right-0 top-full z-50 mt-2 w-[min(680px,calc(100vw-3rem))] rounded-xl border border-slate-700 bg-[#111827] p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div><h3 className="font-semibold text-slate-100">Visualizações do projeto</h3><p className="mt-1 text-xs text-slate-400">Selecione as abas que deseja exibir. Mantenha pelo menos uma.</p></div>
            <button type="button" aria-label="Fechar visualizações" onClick={() => { setOpen(false); trigger.current?.focus(); }} className="rounded p-1 text-slate-400 hover:bg-slate-800"><X className="h-5 w-5" /></button>
          </div>
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2">
            <Search className="h-4 w-4 text-slate-400" />
            <input ref={searchInput} value={search} onChange={event => setSearch(event.target.value)} aria-label="Buscar visualizações" placeholder="Buscar visualizações" className="w-full bg-transparent text-sm text-slate-100 outline-none" />
          </div>
          <div className="grid max-h-[55vh] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {views.filter(view => normalize(`${view.label} ${view.description}`).includes(normalize(search))).map(({ id, label, description, icon: Icon, color }) => (
              <button key={id} type="button" aria-pressed={visible.includes(id)} disabled={visible.length === 1 && visible.includes(id)} onClick={() => toggle(id)}
                className="flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-slate-800 disabled:cursor-default disabled:opacity-70">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${color}`}><Icon className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-100">{label}</span><span className="mt-1 block text-xs text-slate-400">{description}</span></span>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${visible.includes(id) ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-600'}`}>{visible.includes(id) && <Check className="h-4 w-4" />}</span>
              </button>
            ))}
          </div>
          {!views.some(view => normalize(`${view.label} ${view.description}`).includes(normalize(search))) && <p className="py-6 text-center text-sm text-slate-400">Nenhuma visualização encontrada.</p>}
          <p className="mt-3 border-t border-slate-700 pt-3 text-xs text-slate-400">Preferências salvas neste navegador para este projeto.</p>
        </div>
      )}
    </div>
  );
}
