import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  Send,
  Settings,
  Webhook,
  Zap,
} from 'lucide-react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

export default function N8nWorkflowsPanel({ onCountChange }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statusInfo, setStatusInfo] = useState(null);
  const [workflows, setWorkflows] = useState([]);
  const [executions, setExecutions] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [triggerResult, setTriggerResult] = useState(null);
  const [customWebhookPath, setCustomWebhookPath] = useState('');
  const [customEventName, setCustomEventName] = useState('LEAD_CREATED');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [statusRes, wfRes, execRes] = await Promise.all([
        fetch(buildApiUrl('/n8n/status'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/n8n/workflows'), { headers: getAuthHeaders() }),
        fetch(buildApiUrl('/n8n/executions?limit=15'), { headers: getAuthHeaders() }),
      ]);

      const statusData = await statusRes.json().catch(() => ({}));
      const wfData = await wfRes.json().catch(() => ({}));
      const execData = await execRes.json().catch(() => ({}));

      setStatusInfo(statusData);
      const wfList = Array.isArray(wfData?.workflows) ? wfData.workflows : [];
      setWorkflows(wfList);
      setExecutions(Array.isArray(execData?.executions) ? execData.executions : []);
      if (typeof onCountChange === 'function') onCountChange(wfList.length);

      if (wfData?.error) setError(wfData.error);
    } catch (err) {
      setError(err.message || 'Erro ao carregar dados do n8n');
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleWorkflow = async (wf) => {
    try {
      setBusyId(wf.id);
      const action = wf.active ? 'deactivate' : 'activate';
      const res = await fetch(buildApiUrl(`/n8n/workflows/${encodeURIComponent(wf.id)}/${action}`), {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Falha ao alterar status');
      await loadData();
    } catch (err) {
      setTriggerResult({ ok: false, text: err.message });
    } finally {
      setBusyId('');
    }
  };

  const triggerWebhook = async ({ webhookUrl, webhookPath, event }) => {
    try {
      setBusyId(webhookPath || webhookUrl || 'manual');
      setTriggerResult(null);
      const res = await fetch(buildApiUrl('/n8n/trigger'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          webhookUrl,
          webhookPath,
          event: event || 'CRM_MANUAL_TRIGGER',
          payload: {
            origin: 'CRM NEXOS',
            environment: 'production',
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erro ao disparar webhook');
      setTriggerResult({ ok: true, text: `Webhook disparado com sucesso (HTTP ${data.status})!` });
      setTimeout(() => loadData(), 800);
    } catch (err) {
      setTriggerResult({ ok: false, text: err.message });
    } finally {
      setBusyId('');
    }
  };

  if (loading && !statusInfo) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--crm-muted)]">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin text-cyan-400" />
        Conectando ao motor n8n...
      </div>
    );
  }

  if (!statusInfo?.configured) {
    return (
      <div className="rounded-2xl border border-dashed border-cyan-500/40 bg-cyan-500/5 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/15 text-cyan-400">
          <Webhook className="h-6 w-6" />
        </div>
        <h3 className="text-lg font-bold text-[var(--crm-ink)]">Conecte sua instância n8n</h3>
        <p className="mx-auto mt-1.5 max-w-xl text-sm text-[var(--crm-muted)]">
          Configure a URL e a API Key do n8n em <strong>Integrações → n8n</strong> para listar, ativar/pausar fluxos,
          disparar webhooks do CRM e acompanhar execuções em tempo real.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/integracoes')}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg"
          >
            <Settings className="h-4 w-4" /> Configurar n8n em Integrações
          </button>
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--crm-border)] px-4 py-2.5 text-sm font-semibold text-[var(--crm-ink)] hover:bg-white/5"
          >
            <RefreshCw className="h-4 w-4" /> Verificar novamente
          </button>
        </div>
      </div>
    );
  }

  const activeCount = workflows.filter((w) => w.active).length;

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.65)] p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
              statusInfo?.connected
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400'
                : 'border-rose-500/40 bg-rose-500/15 text-rose-400'
            }`}
          >
            {statusInfo?.connected ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-[var(--crm-ink)]">Motor n8n</h4>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  statusInfo?.connected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}
              >
                {statusInfo?.connected ? 'Online' : 'Offline / Erro'}
              </span>
            </div>
            <p className="text-xs text-[var(--crm-muted)]">
              {statusInfo?.apiBaseUrl} · {workflows.length} workflow(s) · {activeCount} ativo(s)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] px-3 py-1.5 text-xs font-semibold text-[var(--crm-ink)] hover:border-cyan-400/50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          {statusInfo?.apiBaseUrl && (
            <a
              href={statusInfo.apiBaseUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-rose-500 to-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Abrir Editor n8n
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {triggerResult && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            triggerResult.ok
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {triggerResult.text}
        </div>
      )}

      {/* Disparo Rápido Webhook */}
      <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.45)] p-4">
        <div className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
          <Send className="h-3.5 w-3.5" /> Disparar Evento CRM → Webhook n8n
        </div>
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-[1fr_220px_auto]">
          <input
            type="text"
            value={customWebhookPath}
            onChange={(e) => setCustomWebhookPath(e.target.value)}
            placeholder="Path ou URL do webhook (ex: novo-lead-crm ou https://...)"
            className="crm-input text-xs"
          />
          <select value={customEventName} onChange={(e) => setCustomEventName(e.target.value)} className="crm-input text-xs">
            <option value="LEAD_CREATED">LEAD_CREATED</option>
            <option value="OPPORTUNITY_WON">OPPORTUNITY_WON</option>
            <option value="CONTRACT_SIGNED">CONTRACT_SIGNED</option>
            <option value="CHURN_RISK">CHURN_RISK</option>
            <option value="MANUAL_TEST">MANUAL_TEST</option>
          </select>
          <button
            type="button"
            disabled={!customWebhookPath.trim() || Boolean(busyId)}
            onClick={() => {
              const isFullUrl = /^https?:\/\//i.test(customWebhookPath.trim());
              triggerWebhook({
                webhookUrl: isFullUrl ? customWebhookPath.trim() : undefined,
                webhookPath: isFullUrl ? undefined : customWebhookPath.trim(),
                event: customEventName,
              });
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-40"
          >
            <Zap className="h-3.5 w-3.5" /> Disparar
          </button>
        </div>
      </div>

      {/* Lista de Workflows n8n */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {workflows.length === 0 ? (
          <div className="col-span-full rounded-xl border border-[var(--crm-border)] p-8 text-center text-sm text-[var(--crm-muted)]">
            Nenhum workflow encontrado nesta instância n8n.
          </div>
        ) : (
          workflows.map((wf) => (
            <div
              key={wf.id}
              className="flex flex-col justify-between rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] p-4 transition-colors hover:border-cyan-500/40"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h5 className="text-sm font-bold text-[var(--crm-ink)]">{wf.name}</h5>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      wf.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'
                    }`}
                  >
                    {wf.active ? 'Ativo' : 'Pausado'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--crm-muted)]">
                  ID: {wf.id} · {wf.nodeCount} nó(s)
                  {wf.webhookPath ? ` · Webhook: /${wf.webhookPath}` : ''}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={busyId === wf.id}
                  onClick={() => toggleWorkflow(wf)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                    wf.active
                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20'
                      : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
                  }`}
                >
                  {wf.active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {wf.active ? 'Pausar' : 'Ativar'}
                </button>

                {wf.webhookUrl && (
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => triggerWebhook({ webhookUrl: wf.webhookUrl, event: 'CRM_WORKFLOW_TRIGGER' })}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
                  >
                    <Send className="h-3.5 w-3.5" /> Executar Webhook
                  </button>
                )}

                <a
                  href={wf.editorUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-300 hover:text-cyan-300"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Editar
                </a>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Últimas Execuções */}
      {executions.length > 0 && (
        <div className="rounded-xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.45)] p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
            <Activity className="h-3.5 w-3.5 text-cyan-400" /> Últimas Execuções ({executions.length})
          </div>
          <div className="space-y-1.5 max-h-56 overflow-y-auto text-xs">
            {executions.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between rounded-lg border border-[var(--crm-border)] px-3 py-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      ex.status === 'success' ? 'bg-emerald-400' : ex.status === 'error' ? 'bg-rose-400' : 'bg-amber-400'
                    }`}
                  />
                  <span className="font-semibold text-[var(--crm-ink)]">Execução #{ex.id}</span>
                  <span className="text-[var(--crm-muted)]">Workflow {ex.workflowId} · {ex.mode}</span>
                </div>
                <span className="text-[11px] text-[var(--crm-muted)]">
                  {ex.startedAt ? new Date(ex.startedAt).toLocaleString('pt-BR') : '-'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
