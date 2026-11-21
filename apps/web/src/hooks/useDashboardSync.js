import { useEffect, useRef } from 'react';

/** Refresh persisted dashboard data while visible, without overlapping timer requests. */
export default function useDashboardSync(refresh, { enabled = true, intervalMs = 30000 } = {}) {
  const callback = useRef(refresh);
  callback.current = refresh;
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    let pending = false;
    const sync = async () => {
      if (!active || pending || document.visibilityState === 'hidden') return;
      pending = true;
      try { await callback.current(); }
      catch (error) { console.warn('Não foi possível sincronizar o dashboard:', error); }
      finally { pending = false; }
    };
    const interval = window.setInterval(sync, intervalMs);
    window.addEventListener('focus', sync);
    window.addEventListener('nexos-data-changed', sync);
    document.addEventListener('visibilitychange', sync);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', sync);
      window.removeEventListener('nexos-data-changed', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [enabled, intervalMs]);
}
