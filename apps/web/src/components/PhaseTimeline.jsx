import { ChevronDown, Check, AlertCircle, Clock } from 'lucide-react';
import { useState } from 'react';

export default function PhaseTimeline({ phases = [], onPhaseUpdate }) {
  const [expandedPhase, setExpandedPhase] = useState(null);
  const [editingPhase, setEditingPhase] = useState(null);
  const [phaseForm, setPhaseForm] = useState({ status: 'PENDING', progressPercent: 0 });

  const getStatusConfig = (status) => {
    const configs = {
      PENDING: { icon: Clock, label: 'Pendente', badgeClass: "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_0.3)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]", barClass: "bg-[rgb(var(--crm-surface-rgb)_/_1)]", lineClass: "from-[rgb(var(--crm-surface-rgb)_/_1)] to-[rgb(var(--crm-surface-rgb)_/_1)]" },
      IN_PROGRESS: { icon: Clock, label: 'Em Andamento', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', barClass: 'bg-blue-400', lineClass: 'from-blue-300 to-blue-300' },
      COMPLETED: { icon: Check, label: 'Concluída', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', barClass: 'bg-green-400', lineClass: 'from-green-300 to-green-300' },
      SKIPPED: { icon: AlertCircle, label: 'Pulada', badgeClass: "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_0.3)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]", barClass: "bg-[rgb(var(--crm-surface-rgb)_/_1)]", lineClass: "from-[rgb(var(--crm-surface-rgb)_/_1)] to-[rgb(var(--crm-surface-rgb)_/_1)]" }
    };
    return configs[status] || configs.PENDING;
  };

  const handleUpdate = async (phaseId) => {
    if (onPhaseUpdate) {
      await onPhaseUpdate(phaseId, phaseForm);
      setEditingPhase(null);
    }
  };

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-0">
      {sortedPhases.map((phase, idx) => {
        const config = getStatusConfig(phase.status);
        const Icon = config.icon;
        const isExpanded = expandedPhase === phase.id;
        const isEditing = editingPhase === phase.id;

        return (
          <div key={phase.id} className="relative">
            {/* Timeline connector */}
            {idx < sortedPhases.length - 1 && (
              <div className="absolute left-6 top-16 w-1 h-12 bg-[rgb(var(--crm-surface-rgb)_/_1)]" />
            )}

            {/* Phase card */}
            <div className="relative bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] dark:border-[var(--crm-border)] rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg">
              {/* Status bar */}
              <div className={`h-1 w-full ${config.barClass}`} />

              {/* Main button */}
              <button
                onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors text-left"
              >
                {/* Icon container */}
                <div className={`p-3 rounded-lg ${config.badgeClass} flex-shrink-0`}>
                  <Icon size={20} />
                </div>

                {/* Phase info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{phase.name}</h4>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
                    {phase.progressPercent || 0}% completo
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-32 flex-shrink-0">
                  <div className="h-2 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.barClass} transition-all duration-500`}
                      style={{ width: `${phase.progressPercent || 0}%` }}
                    />
                  </div>
                </div>

                {/* Chevron */}
                <ChevronDown
                  size={20}
                  className={`text-[rgb(var(--crm-muted-rgb)_/_1)] transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.5)] p-4 space-y-4">
                  {isEditing ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">
                            Status
                          </label>
                          <select
                            value={phaseForm.status}
                            onChange={(e) => setPhaseForm({ ...phaseForm, status: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="PENDING">Pendente</option>
                            <option value="IN_PROGRESS">Em Andamento</option>
                            <option value="COMPLETED">Concluída</option>
                            <option value="SKIPPED">Pulada</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">
                            Progresso (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={phaseForm.progressPercent}
                            onChange={(e) => setPhaseForm({ ...phaseForm, progressPercent: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setEditingPhase(null)}
                          className="flex-1 px-4 py-2 rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] font-medium hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => handleUpdate(phase.id)}
                          className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                        >
                          Salvar
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="p-3 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                          <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-xs font-medium">Status Atual</p>
                          <p className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">{config.label}</p>
                        </div>
                        <div className="p-3 bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] rounded-lg border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
                          <p className="text-[rgb(var(--crm-muted-rgb)_/_1)] dark:text-[rgb(var(--crm-muted-rgb)_/_1)] text-xs font-medium">Progresso</p>
                          <p className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1">{phase.progressPercent || 0}%</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingPhase(phase.id);
                          setPhaseForm({ status: phase.status, progressPercent: phase.progressPercent || 0 });
                        }}
                        className="w-full px-4 py-2 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] font-medium hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors"
                      >
                        Editar Fase
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
