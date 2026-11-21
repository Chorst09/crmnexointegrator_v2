import { loadPreSalesDashboardRows } from '../utils/preSalesDashboardData.mjs';
import useDashboardSync from '../hooks/useDashboardSync';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildApiUrl, getAuthHeaders } from '../config/api';
import { getUserAccess, normalizeRole } from '../utils/permissions';
import { buildGeneralDashboardMetrics, toNumber, parseUserFromStorage } from '../components/generalDashboardMetrics.mjs';
import GeneralDashboardExecutive from '../components/GeneralDashboardExecutive';

export default function DashboardGeral() {
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  const [updatedAt, setUpdatedAt] = useState(null);
  const [data, setData] = useState({});
  const [moduleHealth, setModuleHealth] = useState([]);
  const requestRef = useRef(0);
  const abortRef = useRef(null);

  const user = parseUserFromStorage() || {};
  const access = getUserAccess(user);
  const role = normalizeRole(user?.role);
  const adminLike = ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR'].includes(role);

  const loadData = async () => {
    const requestId=++requestRef.current;
    abortRef.current?.abort();
    const controller=new AbortController();abortRef.current=controller;
    window.dispatchEvent(new Event('nexos-refresh-modules'));
    setLoading(true);
    const headers = getAuthHeaders();

    try {
      const response = await fetch(buildApiUrl('/dashboard?type=general'), { headers, signal:controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json().catch(() => null);
      if (!payload?.data || !Array.isArray(payload?.moduleHealth)) {
        throw new Error('Resposta agregada inválida');
      }

      if(requestId!==requestRef.current)return;
      setData(payload.data);
      setModuleHealth(payload.moduleHealth);
      setUpdatedAt(new Date());
      setLoading(false);
      return;
    } catch (error) {
      if(error.name==='AbortError' || requestId!==requestRef.current)return;
      console.warn('Dashboard geral agregado indisponível, usando carregamento legado:', error);
    }

    const parseRows = (payload) => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.rows)) return payload.rows;
      if (Array.isArray(payload?.items)) return payload.items;
      if (Array.isArray(payload?.data)) return payload.data;
      if (Array.isArray(payload?.results)) return payload.results;
      return [];
    };
    const parsePreSales = (payload) => {
      const rows = Array.isArray(payload?.solicitacoes) ? payload.solicitacoes : [];
      return { rows, total: toNumber(payload?.total || rows.length) };
    };

    const modules = [
      { key: 'opportunitiesB2B', label: 'Oportunidades B2B', endpoint: '/opportunities?clientType=B2B', enabled: access.accessB2B, normalize: parseRows, emptyValue: [] },
      { key: 'opportunitiesB2G', label: 'Oportunidades B2G', endpoint: '/opportunities?clientType=B2G', enabled: access.accessB2G, normalize: parseRows, emptyValue: [] },
      { key: 'companiesB2B', label: 'Empresas B2B', endpoint: '/companies?clientType=B2B', enabled: access.accessB2B, normalize: parseRows, emptyValue: [] },
      { key: 'companiesB2G', label: 'Empresas B2G', endpoint: '/companies?clientType=B2G', enabled: access.accessB2G, normalize: parseRows, emptyValue: [] },
      { key: 'b2g', label: 'Editais B2G', endpoint: '/b2g/editais', enabled: access.accessB2G, normalize: parseRows, emptyValue: [] },
      { key: 'prevendasOportunidades', label: 'Registro Pré-Vendas', endpoint: '/prevendas-cadastros/oportunidades', enabled: (access.accessPreSales || adminLike), normalize: parseRows, emptyValue: [] },
      { key: 'preSales', label: 'Pré-vendas', endpoint: '/pre-vendas?limit=200', enabled: access.accessPreSales || adminLike, normalize: parsePreSales, emptyValue: { rows: [], total: 0 }, count: (payload) => payload.total },
      { key: 'preSalesPocs', label: 'POCs Pré-Vendas', endpoint: '/pre-sales-pocs', enabled: access.accessPreSales || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'activities', label: 'Atividades', endpoint: '/activities', enabled: access.accessB2B || access.accessB2G || access.accessPreSales, normalize: parseRows, emptyValue: [] },
      { key: 'products', label: 'Produtos', endpoint: '/products', enabled: access.accessB2B || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'sellers', label: 'Equipe comercial', endpoint: '/users?role=SELLER', enabled: adminLike || access.accessB2B || access.accessB2G, normalize: parseRows, emptyValue: [] },
      { key: 'proposals', label: 'Propostas', endpoint: '/proposals', enabled: access.accessB2B || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'contracts', label: 'Contratos', endpoint: '/contracts', enabled: access.accessB2B || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'commissions', label: 'Comissões', endpoint: '/commissions?limit=200', enabled: access.accessB2B || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'salesTargets', label: 'Metas comerciais', endpoint: '/sales-targets', enabled: access.accessB2B || access.accessB2G || adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'leadStatsB2B', label: 'Lead scoring B2B', endpoint: '/leadScoring?action=stats&clientType=B2B', enabled: access.accessB2B, normalize: (payload) => (payload && typeof payload === 'object' ? payload : {}), emptyValue: {} },
      { key: 'leadStatsB2G', label: 'Lead scoring B2G', endpoint: '/leadScoring?action=stats&clientType=B2G', enabled: access.accessB2G, normalize: (payload) => (payload && typeof payload === 'object' ? payload : {}), emptyValue: {} },
      { key: 'workflows', label: 'Workflows', endpoint: '/workflows', enabled: adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'automationRules', label: 'Regras de automação', endpoint: '/workflows/automation-rules', enabled: adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'automationNotifications', label: 'Notificações automação', endpoint: '/workflows/notifications', enabled: adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'integrations', label: 'Integrações', endpoint: '/integrations', enabled: adminLike, normalize: parseRows, emptyValue: [] },
      { key: 'regions', label: 'Regiões', endpoint: '/regions', enabled: adminLike, normalize: parseRows, emptyValue: [] }
    ];

    const health = await Promise.all(
      modules.map(async (module) => {
        if (!module.enabled) {
          return { ...module, status: 'skipped', count: 0, data: module.emptyValue, error: null };
        }

        try {
          if (module.key === 'preSales') {
            const rows = await loadPreSalesDashboardRows(async (page, limit) => {
              const response = await fetch(buildApiUrl(`/pre-vendas?limit=${limit}&page=${page}`), {headers,signal:controller.signal});
              if (!response.ok) throw new Error(`HTTP ${response.status}`);
              return response.json();
            });
            return {...module,status:'ok',count:rows.length,data:{rows,total:rows.length},error:null};
          }
          const response = await fetch(buildApiUrl(module.endpoint), { headers, signal:controller.signal });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const raw = await response.json().catch(() => null);
          if (raw?.available === false) throw new Error(raw.error || 'Fonte indisponível');
          const normalized = module.normalize(raw);
          const count = typeof module.count === 'function'
            ? module.count(normalized, raw)
            : Array.isArray(normalized) ? normalized.length : toNumber(normalized?.total || 0);

          return { ...module, status: 'ok', count, data: normalized, error: null };
        } catch (err) {
          return {
            ...module,
            status: 'error',
            count: 0,
            data: module.emptyValue,
            error: err?.message || 'Falha na requisição'
          };
        }
      })
    );

    const nextData = health.reduce((acc, item) => {
      acc[item.key] = item.data;
      return acc;
    }, {});

    if(requestId!==requestRef.current)return;
    setData(nextData);
    setModuleHealth(health);
    setUpdatedAt(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    return ()=>{requestRef.current+=1;abortRef.current?.abort();};
  }, []);

  useDashboardSync(loadData);

  const computed = useMemo(() => buildGeneralDashboardMetrics(data, timeRange), [data, timeRange]);

  const initialLoading = loading && !updatedAt;
  if (initialLoading) {
    return (
      <div className="grid h-full place-items-center p-6">
        <div className="crm-panel flex items-center gap-3 px-6 py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--crm-accent-rgb)_/_0.85)] border-t-transparent" />
          <span className="text-sm font-semibold text-[var(--crm-muted)]">Carregando dados consolidados...</span>
        </div>
      </div>
    );
  }

  return <GeneralDashboardExecutive computed={computed} data={data} user={user} access={access}
    adminLike={adminLike} moduleHealth={moduleHealth} timeRange={timeRange} setTimeRange={setTimeRange}
    loading={loading} updatedAt={updatedAt} onRefresh={loadData} />;
}
