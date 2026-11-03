import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Server, Cpu, Database, CheckCircle2, AlertCircle,
  Clock, Zap, Download, RefreshCw, Settings2, Play, Pause,
  Globe, FileSearch, Layers
} from 'lucide-react';
import { cn } from './utils';
import { ITProductFilterSettings } from './ITProductFilterSettings';

// ─── Chave de storage compartilhada com SearchPage ───────────────────────────
export const ACTIVE_SOURCES_KEY = 'pipeline_active_sources_v2';
export const ACTIVE_SOURCES_EVENT = 'pipeline-active-sources-changed';

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
    tipo: 'HTTP / HTML',
    icon: '🏢',
    color: 'cyan',
    descricao: 'Portal de Transparência da Prefeitura de Curitiba — licitações municipais',
    endpoint: 'https://www.transparencia.curitiba.pr.gov.br/sgp/licitacoes.aspx',
  },
  {
    id: 'transparencia-federal',
    name: 'Portal Transparência Federal',
    shortName: 'Transp. Federal',
    tipo: 'API / Fallback',
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
    endpoint: 'https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133',
  },
  {
    id: 'contratacoes-14133',
    name: 'Contratações Lei 14.133',
    shortName: 'Contr. 14.133',
    tipo: 'API / Crawler',
    icon: '⚖️',
    color: 'purple',
    descricao: 'Dispensas eletrônicas e contratações diretas sob a Nova Lei de Licitações',
    endpoint: 'https://dadosabertos.compras.gov.br/modulo-contratacoes/1_consultarContratacoes_PNCP_14133',
  },
  {
    id: 'atas-srp',
    name: 'Atas de Registro de Preços',
    shortName: 'Atas SRP',
    tipo: 'API / Crawler',
    icon: '📋',
    color: 'blue',
    descricao: 'Atas SRP publicadas no PNCP — Sistema de Registro de Preços',
    endpoint: 'https://dadosabertos.compras.gov.br/modulo-arp/1_consultarARP',
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
    tipo: 'HTTP / HTML',
    icon: '📰',
    color: 'slate',
    descricao: 'Avisos, editais e contratações da Seção 3 do Diário Oficial da União',
    endpoint: 'https://www.in.gov.br',
  },
  {
    id: 'curitiba-ecompras',
    name: 'e-Compras Curitiba',
    shortName: 'e-Compras CWB',
    tipo: 'HTTP / HTML',
    icon: '🏙️',
    color: 'indigo',
    descricao: 'Portal de Compras Eletrônicas do Município de Curitiba — consulta HTTP com fontes alternativas',
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
  sky:     { badge: "bg-sky-50/80 dark:bg-sky-950/80 border-sky-200/60 dark:border-sky-700/60 text-sky-700 dark:text-sky-200",     ring: 'ring-sky-400',     dot: 'bg-sky-400',     card: "border-sky-200/40 dark:border-sky-700/40" },
  emerald: { badge: "bg-emerald-50/80 dark:bg-emerald-950/80 border-emerald-200/60 dark:border-emerald-700/60 text-emerald-700 dark:text-emerald-200", ring: 'ring-emerald-400', dot: 'bg-emerald-400', card: "border-emerald-200/40 dark:border-emerald-700/40" },
  cyan:    { badge: "bg-cyan-50/80 dark:bg-cyan-950/80 border-cyan-200/60 dark:border-cyan-700/60 text-cyan-700 dark:text-cyan-200",   ring: 'ring-cyan-400',    dot: 'bg-cyan-400',    card: "border-cyan-200/40 dark:border-cyan-700/40" },
  teal:    { badge: "bg-teal-50/80 dark:bg-teal-950/80 border-teal-200/60 dark:border-teal-700/60 text-teal-700 dark:text-teal-200",   ring: 'ring-teal-400',    dot: 'bg-teal-400',    card: "border-teal-200/40 dark:border-teal-700/40" },
  yellow:  { badge: "bg-yellow-50/80 dark:bg-yellow-950/80 border-yellow-200/60 dark:border-yellow-700/60 text-yellow-700 dark:text-yellow-200", ring: 'ring-yellow-400', dot: 'bg-yellow-400', card: "border-yellow-200/40 dark:border-yellow-700/40" },
  purple:  { badge: "bg-purple-50/80 dark:bg-purple-950/80 border-purple-200/60 dark:border-purple-700/60 text-purple-700 dark:text-purple-200", ring: 'ring-purple-400', dot: 'bg-purple-400', card: "border-purple-200/40 dark:border-purple-700/40" },
  blue:    { badge: "bg-blue-50/80 dark:bg-blue-950/80 border-blue-200/60 dark:border-blue-700/60 text-blue-700 dark:text-blue-200",   ring: 'ring-blue-400',    dot: 'bg-blue-400',    card: "border-blue-200/40 dark:border-blue-700/40" },
  orange:  { badge: "bg-orange-50/80 dark:bg-orange-950/80 border-orange-200/60 dark:border-orange-700/60 text-orange-700 dark:text-orange-200", ring: 'ring-orange-400', dot: 'bg-orange-400', card: "border-orange-200/40 dark:border-orange-700/40" },
  slate:   { badge: "bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border-[var(--crm-border)] text-[rgb(var(--crm-ink-rgb)_/_1)]", ring: 'ring-slate-400',  dot: "bg-[rgb(var(--crm-surface-rgb)_/_1)]",   card: "border-[var(--crm-border)]" },
  indigo:  { badge: "bg-indigo-50/80 dark:bg-indigo-950/80 border-indigo-200/60 dark:border-indigo-700/60 text-indigo-700 dark:text-indigo-200", ring: 'ring-indigo-400', dot: 'bg-indigo-400', card: "border-indigo-200/40 dark:border-indigo-700/40" },
};

const STATUS_CONFIG = {
  ok:      { label: 'Concluído',    icon: CheckCircle2, cls: "bg-emerald-50/60 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800", dot: 'bg-emerald-400' },
  fallback: { label: 'Fonte alternativa', icon: CheckCircle2, cls: "bg-sky-50/60 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800", dot: 'bg-sky-400' },
  running: { label: 'Executando',   icon: Activity,     cls: "bg-cyan-50/60 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800",          dot: 'bg-cyan-400 animate-ping' },
  partial: { label: 'Parcial',      icon: AlertCircle,  cls: "bg-amber-50/60 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800",       dot: 'bg-amber-400' },
  error:   { label: 'Erro',         icon: AlertCircle,  cls: "bg-red-50/60 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800",             dot: 'bg-red-400' },
  idle:    { label: 'Aguardando busca',      icon: Clock,        cls: "bg-[rgb(var(--crm-surface-rgb)_/_0.6)] text-[rgb(var(--crm-muted-rgb)_/_1)] border-[var(--crm-border)]",       dot: "bg-[rgb(var(--crm-surface-rgb)_/_1)]" },
  paused:  { label: 'Pausado',      icon: Pause,        cls: "bg-[rgb(var(--crm-surface-rgb)_/_0.6)] text-[rgb(var(--crm-muted-rgb)_/_1)] border-[var(--crm-border)]",       dot: "bg-[rgb(var(--crm-surface-rgb)_/_1)]" },
};

const pipelineStages = [
  { name: '1. Consulta', desc: 'APIs e portais públicos selecionados', icon: Server, metrics: 'Execução a cada busca' },
  { name: '2. Normalização', desc: 'Leitura de datas, valores e localização', icon: Cpu, metrics: 'Campos ausentes sinalizados' },
  { name: '3. Deduplicação', desc: 'União de editais e suas fontes de origem', icon: Layers, metrics: 'Origens preservadas' },
  { name: '4. Filtros', desc: 'UF, cidade, publicação e validade', icon: FileSearch, metrics: 'Contagem dos resultados exibidos' },
];

interface WorkerStatus {
  id: string;
  status: string;
  lastRunAt: string | null;
  lastError: string | null;
  totalResults: number;
  returnedResults?: number;
  fallback?: string | null;
  warnings?: string[];
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

  // Initialize once; opening settings must preserve deliberately paused sources.
  useEffect(() => {
    try {
      if (!localStorage.getItem(ACTIVE_SOURCES_KEY)) {
        localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(ALL_SOURCE_IDS));
        window.dispatchEvent(new Event(ACTIVE_SOURCES_EVENT));
      }
    } catch { /* A busca mantém o padrão em memória quando o storage não está disponível. */ }
  }, []);

  // Status dos workers vindos do backend
  const [workerStatuses, setWorkerStatuses] = useState<Map<string, WorkerStatus>>(new Map());
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [statusError, setStatusError] = useState('');

  const [downloading, setDownloading] = useState(false);

  // ── Persistir fontes ativas no localStorage quando mudar ──────────────────
  const persistSources = (next: Set<string>) => {
    try {
      localStorage.setItem(ACTIVE_SOURCES_KEY, JSON.stringify(Array.from(next)));
      window.dispatchEvent(new Event(ACTIVE_SOURCES_EVENT));
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
    setStatusError('');
    try {
      const res = await fetch('/api/b2g-search/workers', { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao consultar o status dos workers.');
      if (res.ok) {
        const map = new Map<string, WorkerStatus>();
        (data.workers || []).forEach((w: WorkerStatus) => map.set(w.id, w));
        setWorkerStatuses(map);
        setLastRefresh(new Date());
      }
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Não foi possível atualizar o status dos workers.');
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
    <div className="flex flex-col h-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] overflow-y-auto">
      {/* ── Header ── */}
      <header className="px-8 py-6 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border-b border-[var(--crm-border)] flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] tracking-tight flex items-center gap-3">
              <Settings2 className="w-6 h-6 text-cyan-700 dark:text-cyan-400" />
              Configurações da Busca de Editais
            </h1>
            <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">
              Gerencie produtos de TI, fontes de busca e acompanhe as consultas.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchWorkerStatuses}
              disabled={loadingStatuses}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] hover:border-cyan-500 text-cyan-700 dark:text-cyan-400 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loadingStatuses && 'animate-spin')} />
              Atualizar Status
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={downloading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs font-semibold border border-[var(--crm-border)] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Gerando...' : 'Baixar Código (.zip)'}
            </button>
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border',
              okCount > 0
                ? "bg-emerald-50/60 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                : "bg-[rgb(var(--crm-surface-rgb)_/_0.6)] text-[rgb(var(--crm-muted-rgb)_/_1)] border-[var(--crm-border)]"
            )}>
              <div className={cn('w-2 h-2 rounded-full', okCount > 0 ? 'bg-emerald-400 animate-pulse' : "bg-[rgb(var(--crm-surface-rgb)_/_1)]")} />
              {statusError ? 'Status indisponível' : okCount > 0 ? `${okCount} consulta(s) concluída(s) ou em execução` : 'Aguardando execução'}
            </div>
          </div>
        </div>
        {lastRefresh && (
          <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] mt-2">
            Último refresh: {lastRefresh.toLocaleTimeString('pt-BR')}
          </p>
        )}
      </header>

      <div className="p-8 space-y-10">
        {statusError && <p role="alert" className="rounded-xl border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-700 dark:text-amber-200">{statusError} Os dados da última atualização podem estar desatualizados.</p>}
        <ITProductFilterSettings />

        {/* ── Seção 1: Fontes de Busca (Configuração) ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-700 dark:text-cyan-400" />
              <h2 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
                Fontes Governamentais Monitoradas
              </h2>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-50/60 dark:bg-cyan-900/60 border border-cyan-200/60 dark:border-cyan-700/60 text-cyan-700 dark:text-cyan-300 text-xs font-bold">
                {activeCount} de {SOURCES_CATALOG.length} ativas
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-[11px] px-3 py-1 rounded-lg bg-cyan-50/60 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-700/60 hover:bg-cyan-50/80 dark:hover:bg-cyan-800/80 transition-colors cursor-pointer">
                Todas
              </button>
              <button onClick={clearAll} className="text-[11px] px-3 py-1 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_0.6)] text-[rgb(var(--crm-muted-rgb)_/_1)] border border-[var(--crm-border)] hover:bg-[rgb(var(--crm-surface-rgb)_/_0.8)] transition-colors cursor-pointer">
                Nenhuma
              </button>
            </div>
          </div>

          <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mb-4">
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
                      ? `bg-[rgb(var(--crm-surface-2-rgb)_/_1)] ${colors.card} ring-1 ${colors.ring}`
                      : "bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] border-[var(--crm-border)] opacity-45 hover:opacity-70",
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
                      isOn ? `bg-cyan-500 border-cyan-400` : "bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border-[var(--crm-border)]"
                    )}>
                      {isOn && <CheckCircle2 className="w-3 h-3 text-[rgb(var(--crm-ink-rgb)_/_1)]" />}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] leading-tight truncate">{source.shortName}</p>
                    <p className={cn('text-[10px] mt-0.5 font-medium', isOn ? "text-[rgb(var(--crm-muted-rgb)_/_1)]" : "text-[rgb(var(--crm-muted-rgb)_/_1)]")}>
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
            <Server className="w-5 h-5 text-cyan-700 dark:text-cyan-400" />
            <h2 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
              Scraper Workers (Pool)
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] text-[rgb(var(--crm-muted-rgb)_/_1)] text-xs font-bold">
              {SOURCES_CATALOG.length} workers registrados
            </span>
          </div>

          <p className="mb-4 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Os workers executam quando uma busca é solicitada. O status representa a última execução neste processo da API e é reiniciado quando o servidor reinicia.</p>
          <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[rgb(var(--crm-surface-rgb)_/_0.6)] border-b border-[var(--crm-border)] text-[11px] uppercase tracking-wider text-[rgb(var(--crm-muted-rgb)_/_1)] font-semibold">
                  <th className="px-5 py-3.5">Worker</th>
                  <th className="px-5 py-3.5">Tipo</th>
                  <th className="px-5 py-3.5">Endpoint</th>
                  <th className="px-5 py-3.5">Últ. Execução</th>
                  <th className="px-5 py-3.5">Resultados</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Fonte Ativa</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-[var(--crm-border)]">
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
                      isOn ? "hover:bg-[rgb(var(--crm-surface-rgb)_/_0.3)]" : 'opacity-40'
                    )}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{source.icon}</span>
                          <div>
                            <p className="text-xs font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] leading-tight">{source.name}</p>
                            <p className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)] font-mono">{source.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={cn('text-[11px] px-2 py-0.5 rounded-md border font-semibold', colors.badge)}>
                          {source.tipo}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] font-mono truncate max-w-[180px] block" title={source.endpoint}>
                          {source.endpoint.replace('https://', '')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)]" />
                          {lastRun}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          {ws?.totalResults != null ? (ws.returnedResults ?? ws.totalResults).toLocaleString('pt-BR') : '—'}
                        </span>
                        {ws?.returnedResults != null && ws.returnedResults !== ws.totalResults && (
                          <p className="text-[10px] text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">{ws.totalResults} coletados antes dos filtros</p>
                        )}
                        {(ws?.lastError || ws?.warnings?.length) && (
                          <details className="text-[10px] mt-0.5 max-w-[260px]">
                            <summary className={cn('cursor-pointer', ws.lastError ? "text-red-700 dark:text-red-400" : "text-sky-700 dark:text-sky-300")}>Ver diagnóstico{ws.fallback ? ` · ${ws.fallback}` : ''}</summary>
                            <div className="text-[rgb(var(--crm-ink-rgb)_/_1)] whitespace-normal break-words mt-1 space-y-1">
                              {ws.lastError && <p>{ws.lastError}</p>}
                              {ws.warnings?.map((warning, index) => <p key={index}>{warning}</p>)}
                            </div>
                          </details>
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
                            isOn ? 'bg-cyan-600' : "bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                          )}
                          aria-label={isOn ? `Desativar ${source.name}` : `Ativar ${source.name}`}
                        >
                          <span className={cn(
                            "inline-block h-3.5 w-3.5 transform rounded-full bg-[rgb(var(--crm-surface-rgb)_/_1)] shadow-sm transition-transform",
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
            <Activity className="w-5 h-5 text-cyan-700 dark:text-cyan-400" />
            <h2 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider">
              Fluxo de Processamento
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {pipelineStages.map((stage, i) => {
              const Icon = stage.icon;
              return (
                <div key={i} className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] p-5 rounded-xl border border-[var(--crm-border)] relative">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] p-2.5 rounded-lg text-[rgb(var(--crm-ink-rgb)_/_1)]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  </div>
                  <h4 className="font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] text-sm mb-1">{stage.name}</h4>
                  <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mb-3">{stage.desc}</p>
                  <div className="pt-3 border-t border-[var(--crm-border)] text-xs font-mono text-cyan-700 dark:text-cyan-400">
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
              { label: 'Fontes Ativas', value: `${activeCount} / ${SOURCES_CATALOG.length}`, icon: Globe, color: "text-cyan-700 dark:text-cyan-400" },
              { label: 'Workers Registrados', value: String(SOURCES_CATALOG.length), icon: Server, color: "text-emerald-700 dark:text-emerald-400" },
              { label: 'Concluídos / Executando', value: String(okCount), icon: Activity, color: okCount > 0 ? "text-emerald-700 dark:text-emerald-400" : "text-[rgb(var(--crm-muted-rgb)_/_1)]" },
              { label: 'Workers com Erro', value: String(Array.from(workerStatuses.values()).filter(w => w.status === 'error').length), icon: AlertCircle, color: "text-red-700 dark:text-red-400" },
            ].map((kpi, i) => {
              const Icon = kpi.icon;
              return (
                <div key={i} className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded-xl p-4 flex items-center gap-4">
                  <div className="bg-[rgb(var(--crm-surface-rgb)_/_0.8)] p-2.5 rounded-lg">
                    <Icon className={cn('w-5 h-5', kpi.color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-[rgb(var(--crm-ink-rgb)_/_1)]">{kpi.value}</p>
                    <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">{kpi.label}</p>
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
