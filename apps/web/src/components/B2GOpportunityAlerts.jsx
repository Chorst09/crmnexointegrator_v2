import { useState, useEffect } from 'react';
import { AlertTriangle, Bell, Clock, X, ChevronRight } from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

export default function B2GOpportunityAlerts({ isOpen, onClose }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dismissedIds, setDismissedIds] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchAlerts();
    }
  }, [isOpen]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(buildApiUrl('/b2g/oportunidades/alertas/abertura'), {
        headers: getAuthHeaders()
      });
      const data = await response.json();
      if (response.ok) {
        setAlerts(data.alerts || []);
      } else {
        setError(data.error || 'Erro ao buscar alertas');
      }
    } catch (err) {
      setError('Erro ao buscar alertas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = (opportunityId) => {
    setDismissedIds((prev) => new Set([...prev, opportunityId]));
  };

  const visibleAlerts = alerts.filter((alert) => !dismissedIds.has(alert.opportunityId));

  const getAlertColor = (alertType) => {
    if (alertType === 'TODAY') return 'bg-red-500/20 border-red-500/50 text-red-400';
    if (alertType === 'TOMORROW') return 'bg-orange-500/20 border-orange-500/50 text-orange-400';
    return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
  };

  const getAlertBadge = (alertType) => {
    if (alertType === 'TODAY') return { label: 'HOJE', color: 'bg-red-500/40 text-red-300' };
    if (alertType === 'TOMORROW') return { label: 'AMANHÃ', color: 'bg-orange-500/40 text-orange-300' };
    return { label: 'EM BREVE', color: 'bg-yellow-500/40 text-yellow-300' };
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end lg:items-center lg:justify-end lg:p-4">
      <div
        className="w-full lg:max-w-lg h-[80vh] lg:h-auto lg:max-h-[80vh] bg-slate-950 rounded-t-3xl lg:rounded-2xl border border-slate-700 flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-500/20 p-2">
              <Bell className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Alertas de Abertura</h2>
              <p className="text-xs text-slate-400">
                {visibleAlerts.length} oportunidade{visibleAlerts.length !== 1 ? 's' : ''} com abertura próxima
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="animate-spin">
                <Bell className="h-6 w-6" />
              </div>
            </div>
          ) : error ? (
            <div className="p-6 text-center text-red-400">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>{error}</p>
            </div>
          ) : visibleAlerts.length === 0 ? (
            <div className="p-6 text-center text-slate-400">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum alerta no momento</p>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {visibleAlerts.map((alert) => {
                const badge = getAlertBadge(alert.alertType);
                return (
                  <div
                    key={alert.opportunityId}
                    className={`rounded-xl border p-4 transition-all ${getAlertColor(alert.alertType)}`}
                  >
                    {/* Alert Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <h3 className="font-bold text-sm text-white truncate">{alert.title}</h3>
                          <p className="text-xs opacity-80 truncate">{alert.company?.name || 'Sem empresa'}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    {/* Alert Details */}
                    <div className="space-y-2 mb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          <strong>Abertura em:</strong> {alert.daysUntilOpening} dia{alert.daysUntilOpening !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="text-xs opacity-90">
                        <strong>Data:</strong> {formatDate(alert.openingDate)}
                      </div>
                      {alert.value > 0 && (
                        <div className="text-xs opacity-90">
                          <strong>Valor:</strong> R$ {(alert.value / 1000).toFixed(1)}k
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          // Navegar para edição da oportunidade
                          window.location.href = `/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(alert.opportunityId)}&mode=view`;
                        }}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 px-3 py-2 text-xs font-semibold transition-all"
                      >
                        Ver
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDismiss(alert.opportunityId)}
                        className="px-3 py-2 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 text-xs font-semibold transition-all"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {visibleAlerts.length > 0 && (
          <div className="border-t border-slate-700 px-6 py-3 shrink-0 bg-slate-900/50">
            <p className="text-xs text-slate-400 text-center">
              Atualize os prazos para não perder as oportunidades
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
