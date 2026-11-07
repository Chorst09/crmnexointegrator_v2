import { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildApiUrl, getAuthHeaders } from '../config/api';

export default function PreSalesReturnNotifications() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const container = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const activityDestination = () => {
    let user = {};
    try { user = JSON.parse(localStorage.getItem('user') || '{}'); } catch { /* sessão sem dados */ }
    return location.pathname.startsWith('/b2g') || (user.accessB2G && !user.accessB2B) ? '/b2g-atividades' : '/atividades';
  };
  const load = async (signal) => {
    try {
      const response = await fetch(buildApiUrl('/pre-vendas/retornos-comerciais'), { headers: getAuthHeaders(), signal });
      if (!response.ok) throw new Error('Não foi possível carregar os retornos.');
      const data = await response.json();
      if (signal?.aborted) return;
      setNotifications(data.notifications || []);
      setUnread(data.unread || 0);
      setError('');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    }
  };
  useEffect(() => {
    const controller = new AbortController();
    const refresh = () => { if (!document.hidden) load(controller.signal); };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (event) => { if (!container.current?.contains(event.target)) setOpen(false); };
    const escape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
  }, [open]);
  const acknowledge = async (notification) => {
    try {
      const response = await fetch(buildApiUrl(`/pre-vendas/retornos-comerciais/${encodeURIComponent(notification.id)}/ler`), { method: 'POST', headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Não foi possível marcar o retorno como lido.');
      await load();
    } catch (err) { setError(err.message); }
  };
  return (
    <div className="relative" ref={container}>
      <button type="button" onClick={() => { setOpen((value) => !value); load(); }} aria-expanded={open} aria-controls="pre-sales-return-notifications"
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--crm-ink)] hover:bg-[var(--crm-surface-2)]"
        aria-label={unread ? `Notificações: ${unread} retornos de pré-vendas não lidos` : 'Notificações'} title="Notificações">
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && <section id="pre-sales-return-notifications" aria-label="Retornos de pré-vendas" className="absolute right-0 top-12 z-50 max-h-[70vh] w-[min(24rem,90vw)] overflow-y-auto rounded-xl border border-[var(--crm-border)] bg-[var(--crm-surface)] p-4 text-[var(--crm-ink)] shadow-xl">
        <h3 className="mb-3 font-semibold">Retornos de pré-vendas</h3>
        {error && <p role="alert" className="mb-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
        {!error && notifications.length === 0 && <p className="text-sm text-[var(--crm-muted)]">Nenhum cancelamento ou reprovação recebido.</p>}
        <div className="space-y-3">{notifications.map((notification) => <article key={notification.id} className={`rounded-lg border border-[var(--crm-border)] p-3 ${!notification.readAt ? 'bg-red-500/10' : ''}`}>
          <p className="text-sm font-semibold">{notification.title}</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-xs">{notification.message}</p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs">
            {!notification.readAt && <button type="button" className="underline" onClick={() => acknowledge(notification)}>Marcar como lido</button>}
            <button type="button" className="underline" onClick={() => { acknowledge(notification); setOpen(false); navigate(activityDestination()); }}>Ver atividades</button>
          </div>
        </article>)}</div>
      </section>}
    </div>
  );
}
