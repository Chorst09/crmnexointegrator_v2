import { normalizeFicha as normalizeDocumentFicha, hasSampleRequirement } from './ficha-normalizer.mjs';
import React, { useState, useEffect } from 'react';
import { 
  FileCheck, 
  Search, 
  Filter, 
  ArrowUpDown, 
  Calendar, 
  DollarSign, 
  FileText, 
  ExternalLink, 
  Download, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Clock, 
  Layers, 
  Building2, 
  RefreshCw, 
  Eye, 
  FileSearch,
  Sparkles,
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Tag,
  Target
} from 'lucide-react';
import { FichaTecnicaEditalTR, MatrizItemAnalise } from './types';
import { formatarMoeda, gerarPdfFichaTecnica } from './utils/pdfGenerator';
import { PdfViewerModal } from './PdfViewerModal';
import { buildApiUrl, getAuthHeaders } from '../../config/api';

interface EditaisAnalisadosPageProps {
  onOpenInWorkbench?: (ficha: FichaTecnicaEditalTR) => void;
  onNavigateToAnalise?: (ficha?: FichaTecnicaEditalTR) => void;
  onNavigateToSearch?: () => void;
}

export const EditaisAnalisadosPage: React.FC<EditaisAnalisadosPageProps> = ({
  onOpenInWorkbench,
  onNavigateToAnalise,
  onNavigateToSearch
}) => {
  const [fichas, setFichas] = useState<FichaTecnicaEditalTR[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterRisco, setFilterRisco] = useState<'todos' | 'amostra' | 'vistoria' | 'milhao' | 'pregao'>('todos');
  const [sortBy, setSortBy] = useState<'recente' | 'maior_valor' | 'menor_valor' | 'orgao'>('recente');
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [activeTabByCard, setActiveTabByCard] = useState<Record<string, 'resumo' | 'itens' | 'habilitacao' | 'riscos'>>({});

  // PDF Preview Modal State
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [selectedFichaForPdf, setSelectedFichaForPdf] = useState<FichaTecnicaEditalTR | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  // Copy & Action feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const normalizeFicha = (f: any): FichaTecnicaEditalTR => normalizeDocumentFicha(f);

  const carregarFichas = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/analise-tr/fichas?t=${Date.now()}`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const rawData = await res.json();
        const list = Array.isArray(rawData) ? rawData : [];
        const normalized = list.map(item => normalizeFicha(item));
        setFichas(normalized);
        // Atualiza backup local
        try {
          localStorage.setItem('fichas_analisadas_backup', JSON.stringify(normalized));
        } catch (e) {}
      } else {
        throw new Error('Falha ao obter do servidor');
      }
    } catch (err) {
      console.warn('Carregando editais analisados do backup local:', err);
      try {
        const backupRaw = localStorage.getItem('fichas_analisadas_backup');
        if (backupRaw) {
          const list = JSON.parse(backupRaw);
          if (Array.isArray(list)) {
            setFichas(list.map(normalizeFicha));
          }
        }
      } catch (e) {}
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarFichas();

    const handleSalvo = () => {
      carregarFichas();
    };

    window.addEventListener('edital-analisado-salvo', handleSalvo);
    return () => {
      window.removeEventListener('edital-analisado-salvo', handleSalvo);
    };
  }, []);

  const handleToggleExpand = (id: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
    if (!activeTabByCard[id]) {
      setActiveTabByCard(prev => ({ ...prev, [id]: 'itens' }));
    }
  };

  const handleVisualizarPdf = (ficha: FichaTecnicaEditalTR) => {
    try {
      setSelectedFichaForPdf(ficha);
      const url = gerarPdfFichaTecnica(ficha, 'bloburl') as string;
      setPdfBlobUrl(url);
      setPdfModalOpen(true);
    } catch (e) {
      console.error('Erro ao gerar PDF:', e);
      showNotification('Não foi possível gerar a pré-visualização do PDF.');
    }
  };

  const handleDownloadPdf = (ficha: FichaTecnicaEditalTR) => {
    try {
      gerarPdfFichaTecnica(ficha, 'download');
      showNotification(`Download do PDF da Ficha Técnica iniciado com sucesso.`);
    } catch (e) {
      console.error('Erro ao baixar PDF:', e);
    }
  };

  const handleConverterOportunidadeB2G = async (ficha: FichaTecnicaEditalTR) => {
    if (ficha.analysisStatus === 'requires_reanalysis') { showNotification('Reanexe o documento original na bancada antes de converter esta ficha.'); return; }
    const fichaKey = ficha.id_licitacao;
    try {
      setConvertingId(fichaKey);

      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        throw new Error('Sessão expirada. Faça login novamente para converter em oportunidade B2G.');
      }

      const res = await fetch(buildApiUrl(`/analise-tr/ficha/${encodeURIComponent(ficha.id || ficha.id_licitacao)}/converter-oportunidade`), {
        method: 'POST',
        headers,
        body: JSON.stringify({ ficha })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || `Erro ${res.status} ao converter em oportunidade B2G.`);
      }

      const opportunityId = data?.opportunityId || data?.oportunidadeId || data?.id || data?.opportunity?.id;
      setFichas(prev => prev.map(item => item.id_licitacao === fichaKey
        ? { ...item, convertido_oportunidade: true, oportunidade_id: opportunityId }
        : item
      ));
      showNotification('Oportunidade B2G criada com sucesso. Abrindo pipeline...');
      setTimeout(() => {
        window.location.href = `/b2g-oportunidades?clientType=B2G${opportunityId ? `&opportunityId=${encodeURIComponent(opportunityId)}&mode=view` : ''}`;
      }, 700);
    } catch (e) {
      console.error('Erro ao converter edital analisado em oportunidade B2G:', e);
      showNotification(e instanceof Error ? e.message : 'Erro ao converter edital em oportunidade B2G.');
    } finally {
      setConvertingId(null);
    }
  };

  const handleCopiarJson = (ficha: FichaTecnicaEditalTR) => {
    navigator.clipboard.writeText(JSON.stringify(ficha, null, 2));
    setCopiedId(ficha.id_licitacao);
    showNotification('Dados completos da Ficha Técnica copiados no formato JSON!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleExcluir = async (id: string) => {
    try {
      const res = await fetch(`/api/analise-tr/ficha/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setFichas(prev => prev.filter(f => f.id_licitacao !== id));
        // Remove do backup
        try {
          const backupRaw = localStorage.getItem('fichas_analisadas_backup');
          if (backupRaw) {
            const list = JSON.parse(backupRaw).filter((f: any) => f.id_licitacao !== id);
            localStorage.setItem('fichas_analisadas_backup', JSON.stringify(list));
          }
          localStorage.removeItem(`ficha_tecnica_${id}`);
        } catch (e) {}
        showNotification('Edital analisado excluído do repositório.');
        setDeleteConfirmId(null);
      } else {
        throw new Error('Erro ao excluir');
      }
    } catch (e) {
      console.error('Erro ao excluir:', e);
      showNotification('Erro ao excluir edital do servidor.');
    }
  };

  // Métricas Consolidadas
  const totalEditais = fichas.length;
  const valorTotalMapeado = fichas.reduce((acc, f) => acc + (f.valor_estimado_total || 0), 0);
  const totalItensExtraidos = fichas.reduce((acc, f) => acc + (f.matriz_itens?.length || 0), 0);
  const totalComAmostraOuRisco = fichas.filter(f => 
    hasSampleRequirement(f) ||
    f.pontos_de_atencao_risco?.regras_vistoria?.obrigatoria
  ).length;

  // Filtragem e Ordenação
  const fichasFiltradas = fichas.filter(f => {
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      const matchId = f.id_licitacao?.toLowerCase().includes(term);
      const matchOrgao = f.orgao_comprador?.toLowerCase().includes(term);
      const matchResumo = f.resumo_executivo?.toLowerCase().includes(term);
      const matchMod = f.modalidade_contratacao?.toLowerCase().includes(term);
      const matchTags = f.tags_classificacao?.some(t => t.toLowerCase().includes(term));
      const matchItens = f.matriz_itens?.some(it => it.especificacao_sucinta?.toLowerCase().includes(term) || it.codigo_catalogo?.toLowerCase().includes(term));
      if (!matchId && !matchOrgao && !matchResumo && !matchMod && !matchTags && !matchItens) {
        return false;
      }
    }

    if (filterRisco === 'amostra') {
      return hasSampleRequirement(f);
    }
    if (filterRisco === 'vistoria') {
      return Boolean(f.pontos_de_atencao_risco?.regras_vistoria?.obrigatoria);
    }
    if (filterRisco === 'milhao') {
      return (f.valor_estimado_total || 0) >= 1000000;
    }
    if (filterRisco === 'pregao') {
      return f.modalidade_contratacao?.toLowerCase().includes('pregão');
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === 'maior_valor') {
      return (b.valor_estimado_total || 0) - (a.valor_estimado_total || 0);
    }
    if (sortBy === 'menor_valor') {
      return (a.valor_estimado_total || 0) - (b.valor_estimado_total || 0);
    }
    if (sortBy === 'orgao') {
      return (a.orgao_comprador || '').localeCompare(b.orgao_comprador || '');
    }
    // recente
    const da = new Date(a.data_processamento || 0).getTime();
    const db = new Date(b.data_processamento || 0).getTime();
    return db - da;
  });

  const formatarDataAmigavel = (iso?: string) => {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso;
      return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#011116] overflow-y-auto" id="editais-analisados-container">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 dark:bg-slate-800 text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 dark:border-slate-600 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-[#011419] border-b border-[#07323e] px-8 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/50">
                <FileCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> Repositório de Editais Analisados
              </span>
              <span className="text-slate-400 text-xs">•</span>
              <span className="text-xs text-slate-400 font-medium">Persistência Permanente</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1.5 flex items-center gap-2">
              Editais Analisados
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                {totalEditais} {totalEditais === 1 ? 'edital' : 'editais'}
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Consulta, gestão e exportação das Fichas Técnicas Executivas e Matrizes de Itens processadas pelo motor documental.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={carregarFichas}
              disabled={loading}
              className="px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-lg transition-colors flex items-center gap-2 shadow-sm"
              title="Recarregar lista de editais salvos"
            >
              <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </button>

            <button
              onClick={() => onNavigateToAnalise?.()}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 rounded-lg transition-all flex items-center gap-2 shadow-sm shadow-[#00171d] cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Nova Análise de TR/Edital
            </button>
          </div>
        </div>

        {/* Dashboard de Métricas Chave */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Editais Salvos</span>
              <div className="p-2 bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 rounded-lg">
                <FileCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalEditais}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Fichas técnicas registradas</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Volume Total Estimado</span>
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1 truncate" title={formatarMoeda(fichas.some(f => f.valor_estimado_total !== null && f.valor_estimado_total !== undefined) ? valorTotalMapeado : null)}>
              {formatarMoeda(fichas.some(f => f.valor_estimado_total !== null && f.valor_estimado_total !== undefined) ? valorTotalMapeado : null)}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Soma dos orçamentos de referência</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Itens Catalografados</span>
              <div className="p-2 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 rounded-lg">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalItensExtraidos}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Itens mapeados nas matrizes do TR</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Alertas de Risco Crítico</span>
              <div className="p-2 bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 rounded-lg">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">{totalComAmostraOuRisco}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Exigem Amostra/PoC ou Vistoria</p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="px-8 py-5 border-b border-[#07323e] bg-[#011419] sticky top-0 z-10 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por órgão, ID, objeto, tags ou itens..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Limpar
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {/* Filter Pills */}
            <button
              onClick={() => setFilterRisco('todos')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterRisco === 'todos'
                  ? 'bg-slate-900 dark:bg-blue-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Todos ({fichas.length})
            </button>
            <button
              onClick={() => setFilterRisco('amostra')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                filterRisco === 'amostra'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Com Amostra/PoC
            </button>
            <button
              onClick={() => setFilterRisco('milhao')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                filterRisco === 'milhao'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              &gt; R$ 1 Milhão
            </button>
            <button
              onClick={() => setFilterRisco('pregao')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                filterRisco === 'pregao'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50'
              }`}
            >
              Pregão Eletrônico
            </button>

            {/* Sort Selector */}
            <div className="flex items-center gap-1 ml-auto md:ml-2 pl-2 border-l border-[#07323e]">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
              >
                <option value="recente">Mais recentes</option>
                <option value="maior_valor">Maior valor estimado</option>
                <option value="menor_valor">Menor valor estimado</option>
                <option value="orgao">Órgão (A-Z)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de Fichas Técnicas Analisadas */}
      <div className="flex-1 p-8 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#011419] rounded-2xl border border-[#07323e] shadow-sm">
            <RefreshCw className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Carregando editais analisados...</p>
            <p className="text-xs text-slate-400 mt-1">Sincronizando com a base local e repositório</p>
          </div>
        ) : fichasFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-[#011419] rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center px-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/60 rounded-2xl text-blue-600 dark:text-blue-400 mb-4">
              <FileCheck className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Nenhum edital analisado encontrado</h3>
            <p className="text-sm text-slate-400 max-w-md mt-1.5">
              {searchTerm || filterRisco !== 'todos'
                ? 'Nenhum edital salvo corresponde aos critérios de busca ou filtros selecionados.'
                : 'Você ainda não analisou nenhum edital ou termo de referência. Faça o processamento para registrar a Ficha Técnica aqui.'}
            </p>
            <div className="flex items-center gap-3 mt-6">
              {(searchTerm || filterRisco !== 'todos') && (
                <button
                  onClick={() => { setSearchTerm(''); setFilterRisco('todos'); }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Limpar Filtros
                </button>
              )}
              <button
                onClick={() => onNavigateToAnalise?.()}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm flex items-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                Iniciar Análise de Edital
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            {fichasFiltradas.map((ficha) => {
              const isExpanded = !!expandedCards[ficha.id_licitacao];
              const activeTab = activeTabByCard[ficha.id_licitacao] || 'itens';
              const temAmostra = hasSampleRequirement(ficha);
              const vistoriaObrigatoria = ficha.pontos_de_atencao_risco?.regras_vistoria?.obrigatoria;
              const isDeletingThis = deleteConfirmId === ficha.id_licitacao;
              const isConvertingThis = convertingId === ficha.id_licitacao;
              const convertedOpportunityId = ficha.oportunidade_id;

              return (
                <div
                  key={ficha.id_licitacao}
                  className="bg-[#011419] rounded-2xl border border-[#07323e] shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  id={`card-analisado-${ficha.id_licitacao}`}
                >
                  {/* Top Bar do Card */}
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 font-mono">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                            {ficha.id_licitacao}
                          </span>
                          <span className="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-blue-100 dark:border-blue-900/60">
                            {ficha.modalidade_contratacao || 'Não identificado'}
                          </span>
                          {temAmostra && (
                            <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Amostra / PoC no documento
                            </span>
                          )}
                          {vistoriaObrigatoria && (
                            <span className="bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-semibold px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-800 flex items-center gap-1">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Vistoria Técnica Obrigatória
                            </span>
                          )}
                          <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Analisado em: {formatarDataAmigavel(ficha.data_processamento)}
                          </span>
                        </div>

                        {ficha.analysisStatus === 'requires_reanalysis' && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-500">Análise antiga inválida. Abra na bancada e anexe novamente o PDF original para reanalisar. Valores e exigências padronizados foram desconsiderados.</div>}
                        {ficha.analysisStatus !== 'requires_reanalysis' && ficha.analysisWarnings?.length > 0 && <p className="text-xs text-amber-500">{ficha.analysisWarnings.join(' ')}</p>}
                        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-snug">
                          {ficha.orgao_comprador}
                        </h2>

                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                          {ficha.resumo_executivo}
                        </p>

                        {/* Tags de Classificação */}
                        {ficha.tags_classificacao && ficha.tags_classificacao.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1">
                            {ficha.tags_classificacao.map((tg, idx) => (
                              <span key={idx} className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[11px] px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5 text-slate-400" /> {tg}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Resumo Financeiro no Topo do Card */}
                      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-4 lg:w-72 flex-shrink-0 flex flex-col justify-between">
                        <div>
                          <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 dark:text-slate-500">
                            Valor Estimado Total
                          </span>
                          <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-0.5">
                            {formatarMoeda(ficha.valor_estimado_total)}
                          </p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-200/60 dark:border-slate-750 space-y-1 text-xs text-slate-400">
                          <div className="flex justify-between">
                            <span>Itens na Matriz:</span>
                            <strong className="text-white">{ficha.matriz_itens?.length || 0} itens</strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Critério:</span>
                            <span className="text-white truncate max-w-[130px]" title={ficha.criterio_julgamento}>
                              {ficha.criterio_julgamento || 'Menor Preço'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Grid de Prazos e Datas */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                      <div className="bg-slate-50/60 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 dark:text-slate-500 block font-medium">Data de Abertura:</span>
                        <strong className="text-white text-xs mt-0.5 block truncate">
                          {ficha.data_abertura || '-'}
                        </strong>
                      </div>
                      <div className="bg-slate-50/60 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 dark:text-slate-500 block font-medium">Limite para Propostas:</span>
                        <strong className="text-white text-xs mt-0.5 block truncate">
                          {ficha.data_limite_proposta || '-'}
                        </strong>
                      </div>
                      <div className="bg-slate-50/60 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 dark:text-slate-500 block font-medium">Impugnação / Esclarecimento:</span>
                        <strong className="text-white text-xs mt-0.5 block truncate" title={ficha.data_fim_impugnacao}>
                          {ficha.data_fim_impugnacao || 'Até 3 dias úteis'}
                        </strong>
                      </div>
                      <div className="bg-slate-50/60 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
                        <span className="text-slate-400 dark:text-slate-500 block font-medium">Vigência Contratual:</span>
                        <strong className="text-white text-xs mt-0.5 block truncate" title={ficha.prazos_e_locais?.vigencia_contrato}>
                          {ficha.prazos_e_locais?.vigencia_contrato || 'Não identificado'}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Seção Expansível com Detalhes: Matriz, Habilitação e Riscos */}
                  {isExpanded && (
                    <div className="p-6 bg-slate-50/50 dark:bg-slate-900/60 border-b border-[#07323e]">
                      {/* Sub-Tabs de navegação interna */}
                      <div className="flex items-center gap-2 border-b border-[#07323e] pb-3 mb-4 flex-wrap">
                        <button
                          onClick={() => setActiveTabByCard(prev => ({ ...prev, [ficha.id_licitacao]: 'itens' }))}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                            activeTab === 'itens'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <Layers className="w-3.5 h-3.5" /> Matriz de Itens do TR ({ficha.matriz_itens?.length || 0})
                        </button>
                        <button
                          onClick={() => setActiveTabByCard(prev => ({ ...prev, [ficha.id_licitacao]: 'habilitacao' }))}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                            activeTab === 'habilitacao'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <FileText className="w-3.5 h-3.5" /> Requisitos de Habilitação
                        </button>
                        <button
                          onClick={() => setActiveTabByCard(prev => ({ ...prev, [ficha.id_licitacao]: 'riscos' }))}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                            activeTab === 'riscos'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" /> Frentes de Risco & Penalidades
                        </button>
                        <button
                          onClick={() => setActiveTabByCard(prev => ({ ...prev, [ficha.id_licitacao]: 'resumo' }))}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                            activeTab === 'resumo'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <FileSearch className="w-3.5 h-3.5" /> Resumo Executivo Integral
                        </button>
                      </div>

                      {/* Tab Content: Matriz de Itens */}
                      {activeTab === 'itens' && (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/80 overflow-hidden shadow-xs">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 font-semibold">
                                  <th className="py-2.5 px-3 w-12 text-center">Item</th>
                                  <th className="py-2.5 px-3 w-32">Código</th>
                                  <th className="py-2.5 px-4">Especificação Sucinta</th>
                                  <th className="py-2.5 px-3 w-20 text-center">Unidade</th>
                                  <th className="py-2.5 px-3 w-20 text-right">Qtd</th>
                                  <th className="py-2.5 px-4 w-28 text-right">Vlr. Unit.</th>
                                  <th className="py-2.5 px-4 w-32 text-right">Vlr. Total</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {ficha.matriz_itens && ficha.matriz_itens.length > 0 ? (
                                  ficha.matriz_itens.map((it, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                      <td className="py-2.5 px-3 text-center font-bold text-slate-700 dark:text-slate-200 bg-[#02181f]">
                                        {it.item_numero || idx + 1}
                                      </td>
                                      <td className="py-2.5 px-3 font-mono text-[11px] text-blue-700 dark:text-blue-400">
                                        {it.codigo_catalogo || '-'}
                                      </td>
                                      <td className="py-2.5 px-4 text-white font-medium leading-snug">
                                        {it.especificacao_sucinta}
                                      </td>
                                      <td className="py-2.5 px-3 text-center font-medium text-slate-600 dark:text-slate-300">
                                        {it.unidade}
                                      </td>
                                      <td className="py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100">
                                        {it.quantitativo}
                                      </td>
                                      <td className="py-2.5 px-4 text-right text-slate-600 dark:text-slate-300 font-mono">
                                        {formatarMoeda(it.valor_estimado_unitario)}
                                      </td>
                                      <td className="py-2.5 px-4 text-right font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                                        {formatarMoeda(it.valor_estimado_total)}
                                      </td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td colSpan={7} className="text-center py-6 text-slate-400">
                                      Nenhum item discriminado na matriz.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Tab Content: Requisitos de Habilitação */}
                      {activeTab === 'habilitacao' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Qualificação Técnica & Atestados
                            </h4>
                            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                              {ficha.requisitos_habilitacao?.atestados_capacidade_tecnica?.map((at, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-blue-500 font-bold">•</span>
                                  <span>{at}</span>
                                </li>
                              )) || <li className="text-slate-400">Nenhum atestado específico listado.</li>}
                            </ul>
                          </div>

                          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Qualificação Econômico-Financeira
                            </h4>
                            <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                              {ficha.requisitos_habilitacao?.exigencias_contabeis?.map((idxC, i) => (
                                <div key={i} className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800 last:border-none">
                                  <span className="font-medium text-slate-200">{idxC.nome_indice}:</span>
                                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">{idxC.regra}</span>
                                </div>
                              )) || <p className="text-slate-400">Sem índices contábeis fixados.</p>}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab Content: Frentes de Risco & Penalidades */}
                      {activeTab === 'riscos' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
                            <h4 className="text-xs font-bold text-rose-800 dark:text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" /> Cláusulas Punitivas & Multas
                            </h4>
                            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                              {ficha.pontos_de_atencao_risco?.clausulas_punitivas_multas?.map((cl, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-rose-500 font-bold">•</span>
                                  <span>{cl}</span>
                                </li>
                              )) || <li className="text-slate-400">Regras padrão da Lei 14.133/2021.</li>}
                            </ul>
                          </div>

                          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
                            <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Amostra / PoC & Garantias
                            </h4>
                            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 block">Exigência de Amostra/PoC:</span>
                                <p className="mt-0.5">{ficha.pontos_de_atencao_risco?.exigencia_amostra_poc || 'Não identificado.'}</p>
                              </div>
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <span className="font-semibold text-slate-700 dark:text-slate-200 block">Garantia Contratual:</span>
                                <p className="mt-0.5">{ficha.pontos_de_atencao_risco?.garantia_contratual || 'Não identificado.'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80">
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /> Prazos & Locais de Entrega
                            </h4>
                            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-200 block">Prazo de Início/Entrega:</span>
                                <p className="mt-0.5">{ficha.prazos_e_locais?.prazo_inicio_entrega || '-'}</p>
                              </div>
                              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                                <span className="font-semibold text-slate-700 dark:text-slate-200 block">Locais de Prestação:</span>
                                <p className="mt-0.5">{ficha.prazos_e_locais?.locais_prestacao_entrega?.join(', ') || '-'}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tab Content: Resumo Executivo Integral */}
                      {activeTab === 'resumo' && (
                        <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700/80 text-xs leading-relaxed text-slate-200 space-y-3">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Resumo do Objeto e Condições Gerais</h4>
                          <p>{ficha.resumo_executivo}</p>
                          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/40 rounded-lg border border-blue-100 dark:border-blue-900/60 text-blue-900 dark:text-blue-300 flex items-center gap-2 mt-2">
                            <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <span>Extração estruturada em conformidade com as diretrizes do Termo de Referência da Lei nº 14.133/2021.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Barra de Ações Inferior do Card */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-slate-100 dark:border-slate-700">
                    {/* Botão de Toggle Expandir */}
                    <button
                      onClick={() => handleToggleExpand(ficha.id_licitacao)}
                      className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 font-medium flex items-center gap-1 transition-colors"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="w-4 h-4 text-slate-400" /> Ocultar Matriz & Detalhes
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-4 h-4 text-slate-400" /> Ver Matriz de Itens ({ficha.matriz_itens?.length || 0}) & Riscos
                        </>
                      )}
                    </button>

                    {/* Ações Primárias e Secundárias */}
                    <div className="flex items-center gap-2 ml-auto flex-wrap">
                      {isDeletingThis ? (
                        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-3 py-1.5 rounded-lg">
                          <span className="text-rose-800 dark:text-rose-200 font-semibold">Excluir edital analisado?</span>
                          <button
                            onClick={() => handleExcluir(ficha.id_licitacao)}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-2.5 py-1 rounded font-bold transition-colors"
                          >
                            Sim, excluir
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="text-slate-300 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1 transition-colors"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleCopiarJson(ficha)}
                            className="px-3 py-1.5 text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
                            title="Copiar estrutura JSON completa"
                          >
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            {copiedId === ficha.id_licitacao ? 'Copiado!' : 'JSON'}
                          </button>

                          <button
                            onClick={() => handleVisualizarPdf(ficha)}
                            className="px-3 py-1.5 text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
                            title="Visualizar relatório em PDF"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-300" />
                            Visualizar PDF
                          </button>

                          <button
                            onClick={() => handleDownloadPdf(ficha)}
                            className="px-3 py-1.5 text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
                            title="Baixar PDF da Ficha Técnica"
                          >
                            <Download className="w-3.5 h-3.5 text-slate-300" />
                            Baixar PDF
                          </button>

                          <button
                            onClick={() => {
                              if (onOpenInWorkbench) {
                                onOpenInWorkbench(ficha);
                              } else if (onNavigateToAnalise) {
                                onNavigateToAnalise(ficha);
                              }
                            }}
                            className="px-3.5 py-1.5 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-xs"
                            title="Abrir edital na bancada de análise para editar quantitativos, recalcular valores e gerar pareceres"
                          >
                            <FileSearch className="w-3.5 h-3.5" />
                            Abrir na Bancada
                          </button>

                          <button
                            onClick={() => convertedOpportunityId
                              ? window.location.href = `/b2g-oportunidades?clientType=B2G&opportunityId=${encodeURIComponent(convertedOpportunityId)}&mode=view`
                              : handleConverterOportunidadeB2G(ficha)
                            }
                            disabled={isConvertingThis}
                            className={`px-3.5 py-1.5 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-70 disabled:cursor-wait ${
                              convertedOpportunityId
                                ? 'bg-emerald-600 hover:bg-emerald-700'
                                : 'bg-cyan-600 hover:bg-cyan-700'
                            }`}
                            title={convertedOpportunityId ? 'Abrir oportunidade B2G criada a partir deste edital' : 'Criar uma oportunidade no pipeline B2G a partir desta ficha técnica'}
                          >
                            {isConvertingThis ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : convertedOpportunityId ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Target className="w-3.5 h-3.5" />
                            )}
                            {isConvertingThis ? 'Convertendo...' : convertedOpportunityId ? 'Oportunidade B2G' : 'Converter em Oportunidade B2G'}
                          </button>

                          <button
                            onClick={() => setDeleteConfirmId(ficha.id_licitacao)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors ml-1"
                            title="Remover este edital dos analisados"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de Pré-Visualização do PDF da Ficha Técnica */}
      <PdfViewerModal
        isOpen={pdfModalOpen}
        onClose={() => setPdfModalOpen(false)}
        pdfBlobUrl={pdfBlobUrl}
        ficha={selectedFichaForPdf}
        onDownload={() => selectedFichaForPdf && handleDownloadPdf(selectedFichaForPdf)}
        documentTitle={selectedFichaForPdf ? `Ficha Técnica - ${selectedFichaForPdf.orgao_comprador}` : 'Ficha Técnica'}
      />
    </div>
  );
};
