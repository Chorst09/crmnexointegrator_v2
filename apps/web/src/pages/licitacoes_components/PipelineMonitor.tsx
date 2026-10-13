import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Server, Cpu, Database, CheckCircle2, AlertCircle,
  Clock, Zap, Download, RefreshCw, Settings2, Play, Pause,
  Globe, FileSearch, Layers
} from 'lucide-react';
import { cn } from './utils';

// ─── Chave de storage compartilhada com SearchPage ───────────────────────────
export const ACTIVE_SOURCES_KEY = 'pipeline_active_sources_v2';

// ─── Catálogo canônico das 10 fontes ─────────────────────────────────────────
export const SOURCES_CATALOG = [
  {
    id: 'pncp',
    name: 'PNCP Oficial',
    shortName: 'PNCP',
    tipo: 'API Ingestion',
    icon: '🏛️',
    color: 'sky',
    descricao: 'Portal Nacional de Contratações Públicas — pregões, concorrências e dispensas oficiais',
    endpoint: 'https://pncp.gov.br/api/consulta/v1',
  },
  {
    id: 'comprasnet',
    name: 'ComprasNet / Compras.gov.br',
    shortName: 'ComprasNet',
    tipo: 'API / Crawler',
    icon: '🇧🇷',
    color: 'emerald',
    descricao: 'Portal de Compras do Governo Federal — SIASG legado e dados abertos',
    endpoint: 'https://dadosabertos.compras.gov.br',
  },
  {
    id: 'transparencia-curitiba',
    name: 'Transparência Curitiba',
    shortName: 'Transp. Curitiba',
    tipo: 'Playwright / Crawler',
    icon: '🏢',
    color: 'cyan',
    descricao: 'Portal de Transparência da Prefeitura de Curitiba — licitações municipais',
    endpoint: 'https://www.curitiba.pr.gov.br',
  },
  {
    id: 'transparencia-federal',
    name: 'Portal Transparência PR / Federal',
    shortName: 'Transp. Federal',
    tipo: 'Playwright / API',
    icon: '🔎',
    color: 'teal',
    descricao: 'Contratos e licitações do Portal da Transparência do Governo Federal',
    endpoint: 'https://portaldatransparencia.gov.br',
  },
  {
    id: 'comprasgov-disputas',
    name: 'Compras.gov.br Disputas',
    shortName: 'Compras.gov Disputas',
    tipo: 'API Ingestion',
    icon: '⚡',
    color: 'yellow',
    descricao: 'Licitações com disputa aberta ou em andamento no Compras.gov.br',
    endpoint: 'https://pncp.gov.br/api/consulta/v1/contratacoes/proposta',
  },
  {
    id: 'contratacoes-14133',
    name: 'Contratações Lei 14.133',
    shortName: 'Contr. 14.133',
    tipo: 'API / Crawler',
    icon: '⚖️',
    color: 'purple',
    descricao: 'Dispensas eletrônicas e contratações diretas sob a Nova Lei de Licitações',
    endpoint: 'https://pncp.gov.br/api/consulta/v1',
  },
  {
    id: 'atas-srp',
    name: 'Atas de Registro de Preços',
    shortName: 'Atas SRP',
    tipo: 'API / Crawler',
    icon: '📋',
    color: 'blue',
    descricao: 'Atas SRP publicadas no PNCP — Sistema de Registro de Preços',
    endpoint: 'https://pncp.gov.br/api/consulta/v1',
  },
  {
    id: 'pregoes-siasg',
    name: 'Pregões SIASG',
    shortName: 'Pregões SIASG',
    tipo: 'API / Crawler',
    icon: '🔧',
    color: 'orange',
    descricao: 'Pregões eletrônicos publicados no SIASG via dados abertos do Compras.gov.br',
    endpoint: 'https://dadosabertos.compras.gov.br',
  },
  {
    id: 'dou',
    name: 'Imprensa Nacional (DOU)',
    shortName: 'DOU',
    tipo: 'Crawler / RSS / API',
    icon: '📰',
    color: 'slate',
    descricao: 'Avisos, editais e contratações da Seção 3 do Diário Oficial da União',
    endpoint: 'https://www.in.gov.br',
  },
  {
    id: 'curitiba-ecompras',
    name: 'e-Compras Curitiba',
    shortName: 'e-Compras CWB',
    tipo: 'Playwright Scraper',
    icon: '🏙️',
    color: 'indigo',
    descricao: 'Portal de Compras Eletrônicas do Município de Curitiba — scraping via Playwright',
    endpoint: 'https://e-compras.curitiba.pr.gov.br',
  },
];

const ALL_SOURCE_IDS = SOURCES_CATALOG.map(s => s.id);

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
};

const COLOR_MAP: Record<string, { badge: string; ring: string; dot: string; card: string }> = {
  sky:     { badge: 'bg-sky-950/80 border-sky-700/60 text-sky-200',     ring: 'ring-sky-400',     dot: 'bg-sky-400',     card: 'border-sky-700/40' },
  emerald: { badge: 'bg-emerald-950/80 border-emerald-700/60 text-emerald-200', ring: 'ring-emerald-400', dot: 'bg-emerald-400', card: 'border-emerald-700/40' },
  cyan:    { badge: 'bg-cyan-950/80 border-cyan-700/60 text-cyan-200',   ring: 'ring-cyan-400',    dot: 'bg-cyan-400',    card: 'border-cyan-700/40' },
  teal:    { badge: 'bg-teal-950/80 border-teal-700/60 text-teal-200',   ring: 'ring-teal-400',    dot: 'bg-teal-400',    card: 'border-teal-700/40' },
  yellow:  { badge: 'bg-yellow-950/80 border-yellow-700/60 text-yellow-200', ring: 'ring-yellow-400', dot: 'bg-yellow-400', card: 'border-yellow-700/40' },
  purple:  { badge: 'bg-purple-950/80 border-purple-700/60 text-purple-200', ring: 'ring-purple-400', dot: 'bg-purple-400', card: 'border-purple-700/40' },
  blue:    { badge: 'bg-blue-950/80 border-blue-700/60 text-blue-200',   ring: 'ring-blue-400',    dot: 'bg-blue-400',    card: 'border-blue-700/40' },
  orange:  { badge: 'bg-orange-950/80 border-orange-700/60 text-orange-200', ring: 'ring-orange-400', dot: 'bg-orange-400', card: 'border-orange-700/40' },
  slate:   { badge: 'bg-slate-800/80 border-slate-600/60 text-slate-200', ring: 'ring-slate-400',  dot: 'bg-slate-400',   card: 'border-slate-600/40' },
  indigo:  { badge: 'bg-indigo-950/80 border-indigo-700/60 text-indigo-200', ring: 'ring-indigo-400', dot: 'bg-indigo-400', card: 'border-indigo-700/40' },
};

const STATUS_CONFIG = {
  ok:      { label: 'Ativo',        icon: CheckCircle2, cls: 'bg-emerald-950/60 text-emerald-300 border-emerald-800', dot: 'bg-emerald-400 animate-pulse' },
  running: { label: 'Executando',   icon: Activity,     cls: 'bg-cyan-950/60 text-cyan-300 border-cyan-800',          dot: 'bg-cyan-400 animate-ping' },
  partial: { label: 'Parcial',      icon: AlertCircle,  cls: 'bg-amber-950/60 text-amber-300 border-amber-800',       dot: 'bg-amber-400' },
  error:   { label: 'Erro',         icon: AlertCircle,  cls: 'bg-red-950/60 text-red-300 border-red-800',             dot: 'bg-red-400' },
  idle:    { label: 'Inativo',      icon: Clock,        cls: 'bg-slate-800/60 text-slate-400 border-slate-700',       dot: 'bg-slate-500' },
  paused:  { label: 'Pausado',      icon: Pause,        cls: 'bg-slate-800/60 text-slate-400 border-slate-700',       dot: 'bg-slate-600' },
};

const pipelineStages = [
  { name: '1. Ingestão Híbrida',   desc: 'APIs públicas + Playwright SPA', icon: Server,      metrics: '10 fontes ativas' },
  { name: '2. Extração & OCR',     desc: 'pdfplumber + Tesseract fallback', icon: Cpu,         metrics: '~1.1s / doc' },
  { name: '3. NLP & Normalização', desc: 'Regex CNPJ + Lematização PT',     icon: Zap,         metrics: '~0.2s / doc' },
  { name: '4. Indexação',          desc: 'Elasticsearch nested mapping',     icon: Database,    metrics: '~12ms latência' },
];

interface WorkerStatus {
  id: string;
  status: string;
  lastRunAt: string | null;
  lastError: string | null;
  totalResults: number;
  updatedAt?: string;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function PipelineMonitor() {
  // Estado de fontes ativas — sincronizado com SearchPage via localStorage
  const [activeSources, setActiveSources] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_SOURCES_KEY);
      if (saved) {
        const arr = JSON.parse(saved);
        return new Set(Array.isArray(arr) ? arr : ALL_SOURCE_IDS);
      }
    } catch (_) {}
    // Por padrão, todas as fontes ativas
    return new Set(ALL_SOURCE_IDS);
  });

  // Garantir que todas as fontes estejam ativas na inicialização (fix automático)
  useEffect(() => {
    const ensureAllSourcesActive = () => {
      try {
        const saved = localStorage.getItem(ACTIVE_SOURCES_KEY);
        if (!saved) {
          // Se não existe, cria com todas ativas
          localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(ALL_SOURCE_IDS));
          setActiveSources(new Set(ALL_SOURCE_IDS));
          console.log('[PipelineMonitor] ✅ Todas as 10 fontes ativadas automaticamente');
        } else {
          const arr = JSON.parse(saved);
          const current = new Set(Array.isArray(arr) ? arr : []);
          // Verifica se alguma fonte está faltando
          const missing = ALL_SOURCE_IDS.filter(id => !current.has(id));
          if (missing.length > 0) {
            const updated = new Set([...Array.from(current), ...missing]);
            localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(Array.from(updated)));
            setActiveSources(updated);
            console.log(`[PipelineMonitor] ✅ ${missing.length} fontes faltantes foram ativadas: ${missing.join(', ')}`);
          }
        }
      } catch (e) {
        console.warn('[PipelineMonitor] Erro ao garantir fontes ativas:', e);
      }
    };
    ensureAllSourcesActive();
  }, []);

  // Status dos workers vindos do backend
  const [workerStatuses, setWorkerStatuses] = useState<Map<string, WorkerStatus>>(new Map());
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [downloading, setDownloading] = useState(false);

  // ── Persistir fontes ativas no localStorage quando mudar ──────────────────
  const persistSources = (next: Set<string>) => {
    try {
      localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(Array.from(next)));
    } catch (_) {}
  };

  const toggleSource = (sourceId: string) => {
    setActiveSources(prev => {
      const next = new Set(prev);
      next.has(sourceId) ? next.delete(sourceId) : next.add(sourceId);
      persistSources(next);
      return next;
    });
  };

  const selectAll = () => {
    const next = new Set(ALL_SOURCE_IDS);
    setActiveSources(next);
    persistSources(next);
  };

  const clearAll = () => {
    const next = new Set<string>();
    setActiveSources(next);
    persistSources(next);
  };

  // ── Busca status dos workers no backend ───────────────────────────────────
  const fetchWorkerStatuses = useCallback(async () => {
    setLoadingStatuses(true);
    try {
      const res = await fetch('/api/b2g-search/workers', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const map = new Map<string, WorkerStatus>();
        (data.workers || []).forEach((w: WorkerStatus) => map.set(w.id, w));
        setWorkerStatuses(map);
        setLastRefresh(new Date());
      }
    } catch (_) {
      // Backend pode não estar rodando localmente — usa statuses mock
    } finally {
      setLoadingStatuses(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkerStatuses();
    const interval = setInterval(fetchWorkerStatuses, 30000); // refresh a cada 30s
    return () => clearInterval(interval);
  }, [fetchWorkerStatuses]);

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/download-zip');
      if (!res.ok) throw new Error('Falha');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'licitacoes_pipeline_source.zip';
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (_) {
      window.location.href = '/api/download-zip';
    } finally {
      setDownloading(false);
    }
  };

  const activeCount = activeSources.size;
  const okCount = Array.from(workerStatuses.values()).filter(w => w.status === 'ok' || w.status === 'running').length;

  return (
    <div className="flex flex-col h-full bg-[#011116] overflow-y-auto">
      {/* ── Header ── */}
      <header className="px-8 py-6 bg-[#011419] border-b border-[#07323e] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              <Settings2 className="w-6 h-6 text-cyan-400" />
              Configurações do Pipeline
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Gerencie as fontes ativas, monitore os workers de ingestão e acompanhe o status em tempo real.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchWorkerStatuses}
              disabled={loadingStatuses}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#02171d] border border-[#073541] hover:border-cyan-500 text-cyan-400 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loadingStatuses && 'animate-spin')} />
              Atualizar Status
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Gerando...' : 'Baixar Código (.zip)'}
            </button>
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border',
              okCount > 0
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                : 'bg-slate-800/60 text-slate-400 border-slate-700'
            )}>
              <div className={cn('w-2 h-2 rounded-full', okCount > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
              {okCount > 0 ? `${okCount} worker${okCount > 1 ? 's' : ''} ativos` : 'Aguardando execução'}
            </div>
          </div>
        </div>
        {lastRefresh && (
          <p className="text-[11px] text-slate-500 mt-2">
            Último refresh: {lastRefresh.toLocaleTimeString('pt-BR')}
          </p>
        )}
      </header>

      <div className="p-8 space-y-10">

        {/* ── Seção 1: Fontes de Busca (Configuração) ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Fontes Governamentais Monitoradas
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 text-xs font-bold">
                {activeCount} de {SOURCES_CATALOG.length} ativas
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-[11px] px-3 py-1 rounded-lg bg-cyan-900/60 text-cyan-300 border border-cyan-700/60 hover:bg-cyan-800/80 transition-colors cursor-pointer">
                Todas
              </button>
              <button onClick={clearAll} className="text-[11px] px-3 py-1 rounded-lg bg-slate-800/60 text-slate-400 border border-slate-700/60 hover:bg-slate-700/80 transition-colors cursor-pointer">
                Nenhuma
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            As fontes marcadas aqui são usadas automaticamente em todas as buscas de editais do módulo.
            Desmarque uma fonte para pausá-la — nenhum worker será disparado para ela.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {SOURCES_CATALOG.map(source => {
              const isOn = activeSources.has(source.id);
              const colors = COLOR_MAP[source.color] || COLOR_MAP.slate;
              const ws = workerStatuses.get(source.id);
              const statusCfg = STATUS_CONFIG[ws?.status as keyof typeof STATUS_CONFIG || 'idle'] || STATUS_CONFIG.idle;

              return (
                <button
                  key={source.id}
                  onClick={() => toggleSource(source.id)}
                  title={`${isOn ? 'Desativar' : 'Ativar'} ${source.name}`}
                  className={cn(
                    'relative flex flex-col gap-2 p-3.5 rounded-xl border text-left transition-all cursor-pointer group',
                    isOn
                      ? `bg-[#011d26] ${colors.card} ring-1 ${colors.ring}`
                      : 'bg-[#011419]/60 border-slate-800/50 opacity-45 hover:opacity-70',
                  )}
                >
                  {/* Status dot */}
                  {isOn && ws && (
                    <div className={cn('absolute top-2.5 right-2.5 w-2 h-2 rounded-full', statusCfg.dot)} />
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">{source.icon}</span>
                    <div className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                      isOn ? `bg-cyan-500 border-cyan-400` : 'bg-slate-900 border-slate-600'
                    )}>
                      {isOn && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white leading-tight truncate">{source.shortName}</p>
                    <p className={cn('text-[10px] mt-0.5 font-medium', isOn ? 'text-slate-400' : 'text-slate-600')}>
                      {source.tipo}
                    </p>
                  </div>

                  {isOn && ws && (
                    <div className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold inline-flex items-center gap-1 w-fit', statusCfg.cls)}>
                      <div className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
                      {statusCfg.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Seção 2: Pool de Workers ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Server className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Scraper Workers (Pool)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-bold">
              {SOURCES_CATALOG.length} workers registrados
            </span>
          </div>

          <div className="bg-[#011419] border border-[#07323e] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/60 border-b border-[#07323e] text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  <th className="px-5 py-3.5">Worker</th>
                  <th className="px-5 py-3.5">Tipo</th>
                  <th className="px-5 py-3.5">Endpoint</th>
                  <th className="px-5 py-3.5">Últ. Execução</th>
                  <th className="px-5 py-3.5">Resultados</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Fonte Ativa</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-slate-800/60">
                {SOURCES_CATALOG.map((source) => {
                  const ws = workerStatuses.get(source.id);
                  const statusKey = (ws?.status || 'idle') as keyof typeof STATUS_CONFIG;
                  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.idle;
                  const StatusIcon = statusCfg.icon;
                  const isOn = activeSources.has(source.id);
                  const colors = COLOR_MAP[source.color] || COLOR_MAP.slate;

                  const lastRun = ws?.lastRunAt
                    ? new Date(ws.lastRunAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '—';

                  return (
                    <tr key={source.id} className={cn(
                      'transition-colors',
                      isOn ? 'hover:bg-slate-800/30' : 'opacity-40'
                    )}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{source.icon}</span>
                          <div>
                            <p className="text-xs font-bold text-white leading-tight">{source.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{source.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-md border font-semibold', colors.badge)}>
                          {source.tipo}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-slate-400 font-mono truncate max-w-[180px] block" title={source.endpoint}>
                          {source.endpoint.replace('https://', '')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-slate-400 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          {lastRun}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold text-white">
                          {ws?.totalResults != null ? ws.totalResults.toLocaleString('pt-BR') : '—'}
                        </span>
                        {ws?.lastError && (
                          <p className="text-[10px] text-red-400 mt-0.5 truncate max-w-[120px]" title={ws.lastError}>
                            {ws.lastError.slice(0, 40)}...
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border',
                          statusCfg.cls
                        )}>
                          <div className={cn('w-1.5 h-1.5 rounded-full', statusCfg.dot)} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => toggleSource(source.id)}
                          className={cn(
                            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer',
                            isOn ? 'bg-cyan-600' : 'bg-slate-700'
                          )}
                          aria-label={isOn ? `Desativar ${source.name}` : `Ativar ${source.name}`}
                        >
                          <span className={cn(
                            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform',
                            isOn ? 'translate-x-4' : 'translate-x-1'
                          )} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Seção 3: Fluxo de Processamento ── */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">
              Fluxo de Processamento
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {pipelineStages.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <div key={i} className="bg-[#011419] p-5 rounded-xl border border-[#07323e] relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-slate-800 p-2.5 rounded-lg text-slate-300">
                      <Icon className="w-5 h-5" />
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h4 className="font-bold text-white text-sm mb-1">{stage.name}</h4>
                  <p className="text-xs text-slate-400 mb-3">{stage.desc}</p>
                  <div className="pt-3 border-t border-slate-800 text-xs font-mono text-cyan-400">
                    {stage.metrics}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Seção 4: Resumo ── */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Fontes Ativas', value: `${activeCount} / ${SOURCES_CATALOG.length}`, icon: Globe, color: 'text-cyan-400' },
              { label: 'Workers Registrados', value: String(SOURCES_CATALOG.length), icon: Server, color: 'text-emerald-400' },
              { label: 'Workers Online', value: String(okCount), icon: Activity, color: okCount > 0 ? 'text-emerald-400' : 'text-slate-400' },
              { label: 'Workers com Erro', value: String(Array.from(workerStatuses.values()).filter(w => w.status === 'error').length), icon: AlertCircle, color: 'text-red-400' },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="bg-[#011419] border border-[#07323e] rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-slate-800/80 p-2.5 rounded-lg">
                    <Icon className={cn('w-5 h-5', kpi.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-white">{kpi.value}</p>
                    <p className="text-[11px] text-slate-400 font-medium">{kpi.label}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
