import { buildApiUrl } from '../config/api';

const LOCAL_AUDIT_STORAGE_KEY = 'audit_logs_local_trail_v1';

/**
 * Registra um evento de auditoria corporativa na tabela audit_logs
 * Disparado sempre que um usuário com perfil técnico ou administrativo consultar relatórios de custos e margens de distribuidores.
 */
export async function logCostAccessAudit({
  action = 'CONSULTA_CUSTOS_MARGENS',
  resource = 'ORCAMENTO_PREVENDAS',
  resourceId = null,
  details = {}
} = {}) {
  try {
    const token = localStorage.getItem('token');
    let currentUser = null;
    try {
      currentUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      currentUser = null;
    }

    const payload = {
      action,
      resource,
      resourceId: resourceId || details?.numeroOrcamento || null,
      details: {
        ...details,
        timestamp: new Date().toISOString(),
        urlConsultada: typeof window !== 'undefined' ? window.location.pathname : '',
        ambiente: 'PRODUCAO_CORPORATIVA'
      }
    };

    // Salvar localmente como redundância corporativa imediata
    try {
      const existing = JSON.parse(localStorage.getItem(LOCAL_AUDIT_STORAGE_KEY) || '[]');
      const localEntry = {
        id: `local-audit-${Date.now()}`,
        userId: currentUser?.id || 'usr-local',
        userName: currentUser?.name || 'Usuário Atual',
        userEmail: currentUser?.email || 'usuario@crm.com',
        userRole: currentUser?.role || 'TECNICO',
        ...payload,
        createdAt: new Date().toISOString()
      };
      existing.unshift(localEntry);
      localStorage.setItem(LOCAL_AUDIT_STORAGE_KEY, JSON.stringify(existing.slice(0, 100)));
    } catch {
      // Ignora falha em localstorage
    }

    if (!token) return;

    const response = await fetch(buildApiUrl('/audit-logs'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      const data = await response.json();
      return data?.log;
    }
  } catch (error) {
    console.warn('[AuditLogger] Aviso ao registrar log de auditoria:', error?.message || error);
  }
}

/**
 * Consulta a lista de logs de auditoria corporativa
 */
export async function fetchCorporateAuditLogs(filters = {}) {
  try {
    const token = localStorage.getItem('token');
    const query = new URLSearchParams();
    if (filters.action) query.set('action', filters.action);
    if (filters.resource) query.set('resource', filters.resource);
    if (filters.userRole) query.set('userRole', filters.userRole);
    if (filters.search) query.set('search', filters.search);
    if (filters.limit) query.set('limit', String(filters.limit));

    const response = await fetch(buildApiUrl(`/audit-logs?${query.toString()}`), {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });

    if (!response.ok) {
      throw new Error(`Erro ${response.status} ao carregar logs de auditoria`);
    }

    const data = await response.json();
    return Array.isArray(data?.logs) ? data.logs : [];
  } catch (err) {
    console.warn('[AuditLogger] Fallback para logs locais:', err?.message || err);
    try {
      return JSON.parse(localStorage.getItem(LOCAL_AUDIT_STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }
}
