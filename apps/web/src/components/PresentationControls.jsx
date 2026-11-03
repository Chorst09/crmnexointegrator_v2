import { ChevronDown, ChevronUp, X } from 'lucide-react';

export default function PresentationControls({
  active = false,
  current = 1,
  total = 1,
  canPrevious = true,
  canNext = true,
  onPrevious = () => {},
  onNext = () => {},
  onExit = () => {}
}) {
  if (!active) return null;

  return (
    <div
      data-presentation-controls="true"
      className="fixed bottom-4 left-1/2 z-[90] flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-[#7abfff66] bg-[rgb(var(--crm-surface-2-rgb)_/_0.9)] p-2 shadow-[0_16px_40px_-20px_rgba(2,9,20,0.95)] backdrop-blur-xl sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canPrevious}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#79c2ff4d] bg-[rgb(var(--crm-surface-rgb)_/_0.95)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.95)]"
        aria-label="Tela anterior"
        title="Tela anterior"
      >
        <ChevronUp className="h-5 w-5" />
      </button>

      <div className="inline-flex h-10 min-w-[64px] items-center justify-center rounded-xl border border-[#79c2ff4d] bg-[rgb(var(--crm-surface-rgb)_/_0.95)] px-3 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
        {Math.max(1, current)}/{Math.max(1, total)}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#79c2ff4d] bg-[rgb(var(--crm-surface-rgb)_/_0.95)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-[rgb(var(--crm-surface-rgb)_/_0.95)]"
        aria-label="Próxima tela"
        title="Próxima tela"
      >
        <ChevronDown className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={onExit}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#85b9e266] bg-[rgb(var(--crm-surface-rgb)_/_0.95)] px-3 text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] transition-colors hover:bg-[rgb(var(--crm-surface-rgb)_/_1)]"
      >
        <X className="h-4 w-4" />
        Sair
      </button>
    </div>
  );
}
