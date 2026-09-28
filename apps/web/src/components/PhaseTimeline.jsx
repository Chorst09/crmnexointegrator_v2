import { ChevronDown, Check, AlertCircle, Clock } from 'lucide-react';
import { useState } from 'react';

export default function PhaseTimeline({ phases = [], onPhaseUpdate }) {
  const [expandedPhase, setExpandedPhase] = useState(null);
  const [editingPhase, setEditingPhase] = useState(null);
  const [phaseForm, setPhaseForm] = useState({ status: 'PENDING', progressPercent: 0 });

  const getStatusConfig = (status) => {
    const configs = {
      PENDING: { icon: Clock, label: 'Pendente', badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300', barClass: 'bg-slate-400', lineClass: 'from-slate-300 to-slate-300' },
      IN_PROGRESS: { icon: Clock, label: 'Em Andamento', badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', barClass: 'bg-blue-400', lineClass: 'from-blue-300 to-blue-300' },
      COMPLETED: { icon: Check, label: 'Concluída', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', barClass: 'bg-green-400', lineClass: 'from-green-300 to-green-300' },
      SKIPPED: { icon: AlertCircle, label: 'Pulada', badgeClass: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300', barClass: 'bg-gray-400', lineClass: 'from-gray-300 to-gray-300' }
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
              <div className="absolute left-6 top-16 w-1 h-12 bg-slate-300" />
            )}

            {/* Phase card */}
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg">
              {/* Status bar */}
              <div className={`h-1 w-full ${config.barClass}`} />

              {/* Main button */}
              <button
                onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
              >
                {/* Icon container */}
                <div className={`p-3 rounded-lg ${config.badgeClass} flex-shrink-0`}>
                  <Icon size={20} />
                </div>

                {/* Phase info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-slate-900 dark:text-white">{phase.name}</h4>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badgeClass}`}>
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {phase.progressPercent || 0}% completo
                  </p>
                </div>

                {/* Progress bar */}
                <div className="w-32 flex-shrink-0">
                  <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.barClass} transition-all duration-500`}
                      style={{ width: `${phase.progressPercent || 0}%` }}
                    />
                  </div>
                </div>

                {/* Chevron */}
                <ChevronDown
                  size={20}
                  className={`text-slate-400 transition-transform duration-300 flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4 space-y-4">
                  {isEditing ? (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Status
                          </label>
                          <select
                            value={phaseForm.status}
                            onChange={(e) => setPhaseForm({ ...phaseForm, status: e.target.value })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="PENDING">Pendente</option>
                            <option value="IN_PROGRESS">Em Andamento</option>
                            <option value="COMPLETED">Concluída</option>
                            <option value="SKIPPED">Pulada</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Progresso (%)
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={phaseForm.progressPercent}
                            onChange={(e) => setPhaseForm({ ...phaseForm, progressPercent: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() => setEditingPhase(null)}
                          className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
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
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Status Atual</p>
                          <p className="font-bold text-slate-900 dark:text-white mt-1">{config.label}</p>
                        </div>
                        <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                          <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Progresso</p>
                          <p className="font-bold text-slate-900 dark:text-white mt-1">{phase.progressPercent || 0}%</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setEditingPhase(phase.id);
                          setPhaseForm({ status: phase.status, progressPercent: phase.progressPercent || 0 });
                        }}
                        className="w-full px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
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
