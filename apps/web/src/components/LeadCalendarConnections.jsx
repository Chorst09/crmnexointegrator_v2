import { useEffect, useState } from 'react';
import { buildApiUrl, getAuthHeaders } from '../config/api';

export default function LeadCalendarConnections() {
  const [providers, setProviders] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    try {
      const response = await fetch(buildApiUrl('/lead-calendar/status'), { headers: getAuthHeaders() });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Agenda indisponível');
      setProviders(result.providers);
      setError('');
    } catch (err) { setError(err.message); }
  }
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);
  async function connect(provider) {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      const response = await fetch(buildApiUrl(`/lead-calendar/${provider}/connect`), {
        method: 'POST', headers: getAuthHeaders(), credentials: 'include'
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Não foi possível conectar');
      if (popup) popup.location.href = result.url;
      else window.location.assign(result.url);
    } catch (err) { popup?.close(); setError(err.message); }
    finally { setBusy(false); }
  }
  async function disconnect(provider) {
    if (!window.confirm('Desconectar e remover os compromissos de leads e contratos criados pelo CRM nesta agenda?')) return;
    setBusy(true);
    try {
      const response = await fetch(buildApiUrl(`/lead-calendar/${provider}/disconnect`), { method: 'DELETE', headers: getAuthHeaders() });
      const result = await response.json();
      if (!response.ok) {
        if (!window.confirm(`${result.error || 'Não foi possível desconectar'}. Deseja remover apenas a conexão do CRM? Os compromissos existentes precisarão ser excluídos manualmente na agenda.`)) return;
        const forced = await fetch(buildApiUrl(`/lead-calendar/${provider}/disconnect?force=true`), { method: 'DELETE', headers: getAuthHeaders() });
        if (!forced.ok) throw new Error('Não foi possível desconectar. Tente novamente em um minuto.');
      }
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  return <section className="crm-panel p-4 space-y-3">
    <h3 className="font-bold text-[var(--crm-ink)]">Minha agenda — leads e contratos</h3>
    <p className="text-sm text-[var(--crm-muted)]">Conecte sua própria conta Google ou Microsoft. As próximas ações de leads e os avisos de vencimento de contratos sob sua responsabilidade serão sincronizados em até um minuto.</p>
    <div className="flex flex-wrap gap-2">
      {providers.map(({ provider, configured, connected }) => <button key={provider} type="button"
        className="crm-btn crm-btn-secondary" disabled={busy || (!configured && !connected)}
        onClick={() => connected ? disconnect(provider) : connect(provider)}>
        {connected ? 'Desconectar' : 'Conectar'} {provider === 'google' ? 'Google Calendar' : 'Microsoft Outlook'}
        {!configured ? ' (configuração pendente)' : connected ? ' (conectado)' : ''}
      </button>)}
    </div>
    <p className="text-xs text-[var(--crm-muted)]">Use a conta em que deseja receber os alertas. Google: e-mail pela agenda conectada. Microsoft: e-mail para seu endereço cadastrado no CRM. Ao conectar ambas, você poderá receber dois alertas.</p>
    {providers.filter((item) => item.connected).map((item) => <p key={item.provider} className="text-xs text-[var(--crm-muted)]" role="status">
      {item.provider === 'google' ? 'Google' : 'Microsoft'}: {item.lastError || (item.lastSyncedAt ? `Última sincronização: ${new Date(item.lastSyncedAt).toLocaleString('pt-BR')}` : 'Aguardando primeira sincronização.')}
    </p>)}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
  </section>;
}
