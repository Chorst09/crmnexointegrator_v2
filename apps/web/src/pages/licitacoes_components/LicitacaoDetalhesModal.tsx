import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  FileText, 
  Download, 
  ExternalLink, 
  MapPin, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Building2,
  Briefcase 
} from 'lucide-react';
import { Licitacao } from './types';
import { cn } from './utils';
import { EditalArquivo, getPncpIdentifiers, normalizeArquivo, getInitialArquivos, getArquivoDownloadEndpoint, getDownloadFilename } from './pncp-documents';

export interface LicitacaoDetalhesModalProps {
  licitacao: Licitacao | null;
  onClose: () => void;
  onAddToManaged?: (lic: Licitacao) => void;
  isManaged?: boolean;
  addingToManaged?: boolean;
  addSuccess?: boolean;
  customFooterAction?: React.ReactNode;
}

// Helper para headers de autenticação
const getAuthHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export function LicitacaoDetalhesModal({
  licitacao,
  onClose,
  onAddToManaged,
  isManaged = false,
  addingToManaged = false,
  addSuccess = false,
  customFooterAction
}: LicitacaoDetalhesModalProps) {
  const [arquivos, setArquivos] = useState<EditalArquivo[]>([]);
  const [searchingPncp, setSearchingPncp] = useState(false);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const downloadController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setDocumentsError(null);
    setDownloadError(null);
    setDownloadingUrl(null);
    downloadController.current?.abort();
    const initial = licitacao ? getInitialArquivos(licitacao) : [];
    setArquivos(initial);
    const identifiers = licitacao ? getPncpIdentifiers(licitacao) : null;
    setSearchingPncp(Boolean(identifiers));

    if (identifiers) {
      const { cnpj, ano, seq } = identifiers;
      fetch(`/api/b2g-licitacoes/arquivos/${cnpj}/${ano}/${seq}`, {
        headers: getAuthHeaders(), signal: controller.signal
      })
        .then(async response => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          if (!Array.isArray(data)) throw new Error('Resposta de anexos inválida');
          return data.map(normalizeArquivo).filter((doc): doc is EditalArquivo => Boolean(doc));
        })
        .then(docs => {
          if (!active) return;
          const merged = new Map([...docs, ...initial].map(doc => [doc.url, doc]));
          // Metadados oficiais têm prioridade sobre os documentos da busca.
          docs.forEach(doc => merged.set(doc.url, doc));
          setArquivos([...merged.values()]);
        })
        .catch(error => {
          if (!active || controller.signal.aborted) return;
          console.warn('Erro ao consultar anexos do edital:', error);
          setDocumentsError('Não foi possível consultar os anexos no PNCP. Tente novamente.');
        })
        .finally(() => { if (active) setSearchingPncp(false); });
    }

    return () => {
      active = false;
      controller.abort();
      downloadController.current?.abort();
    };
  }, [licitacao, reloadCount]);

  if (!licitacao) return null;

  const getOrgaoName = (lic: Licitacao) => lic.orgao || lic.orgaoEntidade?.razaoSocial || 'Órgão não especificado';
  const getUf = (lic: Licitacao) => lic.uf || lic.unidadeOrgao?.ufSigla || 'BR';
  const getCidade = (lic: Licitacao) => lic.cidade || (lic as any).municipio || lic.unidadeOrgao?.municipioNome || '';
  const getObjeto = (lic: Licitacao) => (lic as any).titulo || lic.objeto_resumo || lic.objetoCompra || 'Sem descrição';
  const getData = (lic: Licitacao) => lic.data_abertura || (lic as any).dataEncerramento || lic.dataEncerramentoProposta || lic.dataHoraAberturaSessaoPublica || lic.dataAtualizacao || new Date().toISOString();
  const getValor = (lic: Licitacao) => (lic as any).valor || lic.valor_estimado || lic.valorTotalEstimado || 0;
  const getSituacao = (lic: Licitacao) => lic.situacao || (lic as any).status || lic.situacaoCompraNome || 'Divulgada no PNCP';

  const getPrazoLimiteDate = (lic: Licitacao): Date | null => {
    const dtStr = lic.dataEncerramentoProposta || 
                  (lic as any).dataEncerramento ||       // formato do /search
                  (lic as any).data_encerramento || 
                  lic.dataHoraAberturaSessaoPublica;
    if (dtStr) {
      const d = new Date(dtStr);
      if (!isNaN(d.getTime())) return d;
    }
    const dtFall = lic.dataHoraAberturaSessaoPublica || lic.data_abertura || lic.dataAberturaProposta;
    if (dtFall) {
      const d = new Date(dtFall);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  };

  const getInicioPropostaDate = (lic: Licitacao): Date | null => {
    const dtStr = lic.dataAberturaProposta || lic.data_abertura;
    if (!dtStr) return null;
    const d = new Date(dtStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const formatPrazoLimite = (lic: Licitacao) => {
    const d = getPrazoLimiteDate(lic);
    if (!d) return 'A definir';
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatInicioPropostas = (lic: Licitacao) => {
    const d = getInicioPropostaDate(lic);
    if (!d) return null;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPrazoStatus = (lic: Licitacao) => {
    const d = getPrazoLimiteDate(lic);
    if (!d) return { label: 'Prazo a confirmar', type: 'neutral' };
    
    const now = Date.now();
    const diffMs = d.getTime() - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMs < 0) {
      return { label: 'Prazo expirado', type: 'expired' };
    } else if (diffHours <= 12) {
      return { label: 'Encerra hoje!', type: 'imminent' };
    } else if (diffDays === 1) {
      return { label: 'Encerra amanhã', type: 'soon' };
    } else {
      return { label: `Encerra em ${diffDays} dias`, type: 'upcoming' };
    }
  };

  const isAtivo = (lic: Licitacao) => {
    const sit = (lic.situacao || lic.situacaoCompraNome || '').toLowerCase();
    return !/(encerrad|cancelad|revogad|suspens|anulad|fracassad|desert|homologad|adjudicad)/i.test(sit);
  };

  const handleRealDownload = async (arq: EditalArquivo) => {
    const controller = new AbortController();
    downloadController.current?.abort();
    downloadController.current = controller;
    setDownloadingUrl(arq.url);
    setDownloadError(null);
    try {
      const response = await fetch(getArquivoDownloadEndpoint(licitacao, arq), {
        headers: getAuthHeaders(), signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentType = response.headers.get('content-type') || '';
      if (/text\/html|application\/json/i.test(contentType)) throw new Error('O servidor não retornou um arquivo');
      const blob = await response.blob();
      if (!blob.size) throw new Error('O arquivo está vazio');
      if (controller.signal.aborted) return;
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = getDownloadFilename(response.headers.get('content-disposition'), arq.titulo);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      if (controller.signal.aborted) return;
      console.error('Erro no download do anexo:', error);
      setDownloadError(`Não foi possível baixar “${arq.titulo}”. Tente novamente ou use Abrir para acessar o arquivo original.`);
    } finally {
      if (downloadController.current === controller && !controller.signal.aborted) setDownloadingUrl(null);
    }
  };

  const status = getPrazoStatus(licitacao);
  const numControle = licitacao.numeroControlePNCP || (licitacao as any).numero_controle_pncp || (licitacao as any).numeroCompra || licitacao.id;
  const isManagedNow = isManaged || addSuccess;

  const identifiers = getPncpIdentifiers(licitacao);
  const pncpPageLink = identifiers
    ? `https://pncp.gov.br/app/editais/${identifiers.cnpj}/${identifiers.ano}/${identifiers.seq}`
    : licitacao.pncpPageLink || null;
  const origemLink = licitacao.linkSistemaOrigem || licitacao.linkProcessoEletronico ||
    (licitacao.link !== pncpPageLink ? licitacao.link : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgb(var(--crm-surface-2-rgb)_/_0.7)] backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[var(--crm-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)]">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider",
                isAtivo(licitacao) ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300" : "bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300"
              )}>
                {getSituacao(licitacao)}
              </span>
              
              <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1",
                status.type === 'expired' ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300" : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
              )}>
                <Clock className="w-3 h-3" />
                {status.label}
              </span>

              <span className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">{numControle || 'Sem código PNCP'}</span>
            </div>
            <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] mt-2">Detalhes e Anexos do Edital</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-lg transition-colors cursor-pointer"
            title="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Objeto */}
          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider mb-2">Objeto da Contratação</h3>
            <p className="text-[rgb(var(--crm-ink-rgb)_/_1)] leading-relaxed text-sm bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] p-4 rounded-xl border border-[var(--crm-border)]">
              {getObjeto(licitacao)}
            </p>
          </div>

          {/* Quadros de Informações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.5)] p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
              <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider mb-3">Informações Gerais</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Órgão / Ente Público</span>
                  <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-cyan-700 dark:text-cyan-400 flex-shrink-0" />
                    {getOrgaoName(licitacao)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Modalidade</span>
                  <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)]">{licitacao.modalidade || licitacao.modalidadeNome || 'Não informada'}</span>
                </div>
                <div>
                  <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Localidade</span>
                  <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)] flex-shrink-0" />
                    {getCidade(licitacao) ? `${getCidade(licitacao)} - ${getUf(licitacao)}` : getUf(licitacao)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_0.5)] p-4 rounded-xl border border-[var(--crm-border)] dark:border-[var(--crm-border)]">
              <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider mb-3">Valores e Prazos</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Valor Estimado</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getValor(licitacao))}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Prazo Limite para Envio de Propostas</span>
                  <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-cyan-700 dark:text-cyan-400 flex-shrink-0" />
                    {formatPrazoLimite(licitacao)}
                  </span>
                </div>
                {formatInicioPropostas(licitacao) && (
                  <div>
                    <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Início do Recebimento de Propostas</span>
                    <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)] flex-shrink-0" />
                      {formatInicioPropostas(licitacao)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Data de Publicação / Divulgação</span>
                  <span className="text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)] flex-shrink-0" />
                    {new Date(getData(licitacao)).toLocaleString('pt-BR')}
                  </span>
                </div>
                {origemLink && (
                  <div>
                    <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] block mb-1">Sistema de Origem</span>
                    <a 
                      href={origemLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-cyan-700 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:underline flex items-center gap-1"
                    >
                      Acessar Processo Eletrônico <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Anexos e Documentos Oficiais */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] dark:text-[rgb(var(--crm-ink-rgb)_/_1)] uppercase tracking-wider flex items-center">
                <FileText className="w-4 h-4 mr-2 text-cyan-700 dark:text-cyan-400" /> Documentos e Anexos Oficiais
              </h3>
              <div className="flex items-center gap-2">
                {searchingPncp && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-50/60 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
                    <div className="w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                    Sincronizando PNCP...
                  </span>
                )}
                {arquivos.length > 0 && (
                  <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">{arquivos.length} arquivo(s) disponível(is)</span>
                )}
              </div>
            </div>
            
            {documentsError && (
              <div role="alert" className="mb-3 rounded-lg border border-amber-200/60 dark:border-amber-800/60 bg-amber-50/30 dark:bg-amber-950/30 p-3 text-sm text-amber-700 dark:text-amber-200 flex items-center justify-between gap-3">
                <span>{documentsError}</span>
                <button onClick={() => setReloadCount(count => count + 1)} disabled={searchingPncp} className="font-semibold underline whitespace-nowrap disabled:opacity-50">Tentar novamente</button>
              </div>
            )}
            {downloadError && (
              <p role="alert" className="mb-3 rounded-lg border border-rose-200/60 dark:border-rose-800/60 bg-rose-50/30 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-200">{downloadError}</p>
            )}
            {searchingPncp && arquivos.length === 0 ? (
              <div className="border border-[var(--crm-border)] rounded-xl p-8 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-center">
                <div className="w-7 h-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto mb-3"></div>
                <p className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Buscando documentos e anexos oficiais no PNCP...</p>
                <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">Localizando arquivos originais de edital, termos de referência e minutas contratuais.</p>
              </div>
            ) : arquivos.length > 0 ? (
              <div className="border border-[var(--crm-border)] rounded-xl overflow-hidden shadow-sm divide-y divide-[var(--crm-border)]">
                {arquivos.map((arq, idx) => {
                  const fileUrl = arq.url || arq.uri;
                  const isDownloadingThis = downloadingUrl === fileUrl;
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-2-rgb)_/_0.6)] transition-colors">
                      <div className="flex items-center min-w-0 pr-4">
                        <div className="bg-cyan-50/50 dark:bg-cyan-950/50 p-2.5 rounded-lg mr-4 border border-cyan-200/60 dark:border-cyan-900/60 flex-shrink-0">
                          <FileText className="w-5 h-5 text-cyan-700 dark:text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] truncate" title={arq.titulo}>{arq.titulo}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-medium">{arq.tipoDocumentoNome || 'Documento Oficial'}</span>
                            <span className="text-[rgb(var(--crm-muted-rgb)_/_1)]">•</span>
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded font-mono border border-emerald-200 dark:border-emerald-800">
                              {arq.origem === 'PNCP_OFICIAL' ? 'Anexo Oficial PNCP' : arq.origem === 'SISTEMA_ORIGEM' ? 'Sistema Oficial de Origem' : 'Documento disponível'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {fileUrl && (
                          <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center px-3 py-2 text-xs font-medium text-[rgb(var(--crm-ink-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-lg transition-colors cursor-pointer"
                            title="Abrir documento original em nova aba"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir
                          </a>
                        )}
                        <button 
                          onClick={() => handleRealDownload(arq)}
                          disabled={Boolean(downloadingUrl)}
                          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 rounded-lg transition-all shadow-sm shadow-[#00171d] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isDownloadingThis ? (
                            <>
                              <div className="w-4 h-4 mr-2 rounded-full border-2 border-[var(--crm-border)] border-t-transparent animate-spin"></div>
                              Baixando...
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4 mr-2" /> Baixar
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="border border-[var(--crm-border)] rounded-xl p-6 bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] text-center">
                <FileText className="w-8 h-8 text-cyan-700 dark:text-cyan-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                  {documentsError ? 'Consulta de anexos indisponível' : 'Nenhum arquivo disponível para download'}
                </p>
                <p className="text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] mt-1 max-w-lg mx-auto">
                  {documentsError
                    ? 'A consulta falhou. Você pode tentar novamente ou acessar os canais oficiais abaixo.'
                    : identifiers
                      ? 'O PNCP não retornou anexos para este edital. Consulte também o sistema de origem do órgão.'
                      : 'A fonte não forneceu arquivos nem um identificador PNCP válido para consultar os anexos. Acesse o processo no portal de origem.'
                  }
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
                  {origemLink && (
                    <a 
                      href={origemLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Consultar Sistema de Origem
                    </a>
                  )}
                  {pncpPageLink && (
                    <a 
                      href={pncpPageLink}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-cyan-700 dark:text-cyan-300 rounded-lg text-xs font-medium border border-[var(--crm-border)] transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Consultar Certame no PNCP
                    </a>
                  )}

                </div>
              </div>
            )}
            
            <div className="mt-3 flex items-center justify-between text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.4)] px-3 py-2 rounded-lg border border-[var(--crm-border)]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                Arquivos originais disponibilizados pelo PNCP ou pelo órgão licitante.
              </span>
              {pncpPageLink && (
                <a
                  href={pncpPageLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-700 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 font-medium ml-2 flex-shrink-0"
                >
                  Página da Licitação no PNCP <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-5 border-t border-[var(--crm-border)] dark:border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_1)] flex justify-between items-center gap-3">
          <div>
            {onAddToManaged && (
              <button
                type="button"
                onClick={() => onAddToManaged(licitacao)}
                disabled={addingToManaged || isManagedNow}
                className={cn(
                  "px-6 py-2.5 font-medium rounded-lg transition-all shadow-sm flex items-center gap-2",
                  isManagedNow 
                    ? "bg-emerald-50/70 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 cursor-default"
                    : "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-[#00171d] cursor-pointer"
                )}
              >
                {addingToManaged ? (
                  <div className="w-5 h-5 rounded-full border-2 border-[var(--crm-border)] border-t-transparent animate-spin"></div>
                ) : isManagedNow ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                ) : (
                  <Briefcase className="w-5 h-5" />
                )}
                {isManagedNow ? 'Adicionada às Gerenciadas' : 'Adicionar às Gerenciadas'}
              </button>
            )}

            {customFooterAction}
          </div>

          <button 
            onClick={onClose}
            className="px-6 py-2.5 bg-[rgb(var(--crm-surface-2-rgb)_/_1)] dark:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] font-medium rounded-lg hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] dark:hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
