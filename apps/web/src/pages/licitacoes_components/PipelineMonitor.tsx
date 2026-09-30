import React, { useState } from 'react';
import { Activity, Server, Cpu, Database, CheckCircle2, AlertCircle, Clock, Zap, Filter, Plus, X, Settings2, Download } from 'lucide-react';
import { cn } from './utils';

const mockWorkers = [
  { id: 'worker-pncp-1', type: 'API Ingestion', target: 'PNCP API', status: 'active', throughput: '120 req/min', uptime: '14d 2h' },
  { id: 'worker-pncp-2', type: 'API Ingestion', target: 'PNCP API', status: 'active', throughput: '115 req/min', uptime: '14d 2h' },
  { id: 'worker-scrape-pr', type: 'Playwright Scraper', target: 'Portal Transparência PR', status: 'active', throughput: '45 pages/min', uptime: '2d 4h' },
  { id: 'worker-scrape-sp', type: 'Playwright Scraper', target: 'SABESP Licitações', status: 'warning', throughput: '12 pages/min', uptime: '5h 12m' },
];

const pipelineStages = [
  { name: '1. Ingestão Híbrida', desc: 'Consumo de APIs e Raspagem de SPAs', status: 'healthy', icon: Server, metrics: '3.2k editais/hora' },
  { name: '2. Extração & OCR', desc: 'pdfplumber + Tesseract (Fallback)', status: 'healthy', icon: Cpu, metrics: '1.1s / doc' },
  { name: '3. NLP & Normalização', desc: 'Regex de CNPJ e Lematização', status: 'healthy', icon: Zap, metrics: '0.2s / doc' },
  { name: '4. Indexação Elastic', desc: 'Mapeamento e Inserção Nested', status: 'healthy', icon: Database, metrics: '12ms latência' },
];

export function PipelineMonitor() {
  const defaultSources = [
    'pncp', 'comprasnet', 'transparencia_cwb', 'transparencia_fed', 
    'compras_gov_dispensas', 'lei_14133', 'atas_registro', 
    'pregoes_siasg', 'dou', 'ecompras_cwb'
  ];

  const [activeSources, setActiveSources] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pipeline_active_sources');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return defaultSources;
  });

  const sourcesList = [
    { id: 'pncp', name: 'PNCP Oficial', icon: '🏛️' },
    { id: 'comprasnet', name: 'ComprasNet', icon: '🇧🇷' },
    { id: 'transparencia_cwb', name: 'Transparência Curitiba', icon: '🏙️' },
    { id: 'transparencia_fed', name: 'Portal Transparência Fed...', icon: '🔎' },
    { id: 'compras_gov_dispensas', name: 'Compras.gov.br Dispensas', icon: '📄' },
    { id: 'lei_14133', name: 'Contratações Lei 14.133', icon: '⚖️' },
    { id: 'atas_registro', name: 'Atas de Registro de Preço', icon: '📋' },
    { id: 'pregoes_siasg', name: 'Pregões (SIASG)', icon: '📢' },
    { id: 'dou', name: 'Imprensa Nacional (DOU)', icon: '📰' },
    { id: 'ecompras_cwb', name: 'e-Compras Curitiba', icon: '🏙️' },
  ];

  const toggleSource = (sourceId: string) => {
    setActiveSources(prev => {
      const next = prev.includes(sourceId) 
        ? prev.filter(id => id !== sourceId)
        : [...prev, sourceId];
      try {
        localStorage.setItem('pipeline_active_sources', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleSelectAll = () => {
    const all = sourcesList.map(s => s.id);
    setActiveSources(all);
    try {
      localStorage.setItem('pipeline_active_sources', JSON.stringify(all));
    } catch (e) {}
  };

  const handleClearAll = () => {
    setActiveSources([]);
    try {
      localStorage.setItem('pipeline_active_sources', JSON.stringify([]));
    } catch (e) {}
  };

  const [downloading, setDownloading] = useState(false);

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      const res = await fetch('/api/download-zip');
      if (!res.ok) throw new Error('Falha ao baixar arquivo');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'licitacoes_codigo_fonte_completo.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Erro no download:', err);
      window.location.href = '/api/download-zip';
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#011116] overflow-y-auto">
      <header className="px-8 py-6 bg-[#011419] border-b border-[#07323e]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Data Pipeline Monitor</h1>
            <p className="text-sm text-slate-400 mt-1">
              Status em tempo real dos workers Python, OCR e cluster Elasticsearch.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={handleDownloadZip}
              disabled={downloading}
              className="px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {downloading ? 'Gerando download...' : 'Baixar Código Completo (.zip)'}
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-200 dark:border-emerald-800">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              Cluster Saudável
            </div>
          </div>
        </div>
      </header>

      <div className="p-8">
        {/* Fontes de Busca */}
        <div className="bg-[#011419]/90 p-5 rounded-xl border border-slate-800 shadow-sm mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-300 tracking-wider flex items-center gap-2 uppercase">
              Fontes
            </h3>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-slate-800 text-blue-400 text-xs font-bold rounded-full border border-slate-700">
                {activeSources.length} de {sourcesList.length} ativas
              </span>
              <button 
                onClick={handleSelectAll}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-full border border-slate-700 transition-colors cursor-pointer"
              >
                Selecionar Todas
              </button>
              <button 
                onClick={handleClearAll}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-full border border-slate-700 transition-colors cursor-pointer"
              >
                Limpar
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            {sourcesList.map(source => {
              const isActive = activeSources.includes(source.id);
              return (
                <button
                  key={source.id}
                  onClick={() => toggleSource(source.id)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border text-sm transition-all text-left cursor-pointer",
                    isActive 
                      ? "bg-slate-800/80 border-blue-500/50 text-white" 
                      : "bg-slate-800/30 border-slate-700/50 text-slate-400 hover:border-slate-600 hover:bg-slate-800/50"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded flex items-center justify-center border transition-colors flex-shrink-0",
                    isActive ? "bg-blue-500 border-blue-400" : "bg-slate-900 border-slate-600"
                  )}>
                    {isActive && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                  </div>
                  <span className="truncate">{source.icon} {source.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Pipeline Flow */}
        <h3 className="text-lg font-bold text-white mb-6">Fluxo de Processamento</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10">
          {pipelineStages.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div key={i} className="bg-[#011419] p-5 rounded-xl border border-[#07323e] shadow-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg text-slate-200">
                    <Icon className="w-5 h-5" />
                  </div>
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-sm mb-1">{stage.name}</h4>
                <p className="text-xs text-slate-400 mb-3 line-clamp-1">{stage.desc}</p>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-medium text-slate-300">
                  {stage.metrics}
                </div>
              </div>
            )
          })}
        </div>

        {/* Worker Nodes */}
        <h3 className="text-lg font-bold text-white mb-6">Scraper Workers (Pool)</h3>
        <div className="bg-[#011419] border border-[#07323e] rounded-xl shadow-sm overflow-hidden mb-8">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-[#07323e] text-xs uppercase tracking-wider text-slate-400 font-semibold">
                <th className="px-6 py-4">Node ID</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Alvo</th>
                <th className="px-6 py-4">Throughput</th>
                <th className="px-6 py-4">Uptime</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-slate-100 dark:divide-slate-800">
              {mockWorkers.map((worker) => (
                <tr key={worker.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="px-6 py-4 font-mono text-slate-200">{worker.id}</td>
                  <td className="px-6 py-4 text-slate-300">{worker.type}</td>
                  <td className="px-6 py-4 font-medium text-white">{worker.target}</td>
                  <td className="px-6 py-4 text-slate-300">{worker.throughput}</td>
                  <td className="px-6 py-4 text-slate-400 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5" />
                    {worker.uptime}
                  </td>
                  <td className="px-6 py-4">
                    {worker.status === 'active' ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></div>
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-medium border border-amber-200 dark:border-amber-800">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Rate Limited
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
