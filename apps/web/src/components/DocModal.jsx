import { useState } from 'react';
import { BookOpen, X, ChevronDown, ChevronRight, Search } from 'lucide-react';

/**
 * DocModal — Modal de documentação reutilizável
 * Pode ser usado de dois modos:
 * 1. Autônomo (sem onClose): exibe botão que abre/fecha por conta própria
 * 2. Controlado (com onClose): aberto externamente, fecha via onClose
 */
export default function DocModal({ title, sections = [], triggerLabel = 'Guia de Uso', triggerClassName = '', onClose }) {
  const [selfOpen, setSelfOpen] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [search, setSearch] = useState('');

  // Modo controlado vs autônomo
  const isOpen = onClose ? true : selfOpen;
  const handleClose = onClose || (() => setSelfOpen(false));

  const toggle = (idx) => setExpanded(p => ({ ...p, [idx]: !p[idx] }));

  const filtered = search.trim()
    ? sections.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        (typeof s.content === 'string' && s.content.toLowerCase().includes(search.toLowerCase()))
      )
    : sections;

  if (!isOpen) {
    return (
      <button
        onClick={() => setSelfOpen(true)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all
          border border-white/30 bg-white/20 text-white hover:bg-white/30
          ${triggerClassName}`}
      >
        <BookOpen className="w-4 h-4" />
        {triggerLabel}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-700 bg-[#0f172a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{title}</h2>
              <p className="text-xs text-slate-400">Documentação de uso</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-slate-700/50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar na documentação..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {filtered.length === 0 && (
            <p className="text-center text-slate-500 py-8">Nenhum resultado encontrado.</p>
          )}
          {filtered.map((section, idx) => (
            <div key={idx} className="rounded-xl border border-slate-700/50 overflow-hidden">
              <button
                onClick={() => toggle(idx)}
                className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/60 hover:bg-slate-800 transition-all text-left"
              >
                <span className="font-semibold text-white text-sm">{section.title}</span>
                {expanded[idx]
                  ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              </button>
              {expanded[idx] && (
                <div className="px-4 py-4 bg-slate-900/40 text-sm text-slate-300 leading-relaxed space-y-3">
                  {typeof section.content === 'string'
                    ? section.content.split('\n').map((line, i) => (
                        line.trim() === '' ? <br key={i} /> : <p key={i}>{line}</p>
                      ))
                    : section.content}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700/50 flex justify-between items-center">
          <span className="text-xs text-slate-500">{sections.length} seções disponíveis</span>
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
