import React, { useState, useEffect } from 'react';
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
import { resolvePncpCompra } from './pncpDocuments';
import { buildApiUrl } from '../../config/api';
import { prepareDocumentDownload } from './documentDownload.mjs';
import { formatNoticeValue, getNoticeDeadline } from './noticeData.mjs';

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
  licitacao: aviso,
  onClose,
  onAddToManaged,
  isManaged = false,
  addingToManaged = false,
  addSuccess = false,
  customFooterAction
}: LicitacaoDetalhesModalProps) {
  const [arquivos, setArquivos] = useState<any[]>([]);
  const [searchingPncp, setSearchingPncp] = useState(false);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [arquivosError, setArquivosError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [documentDiagnostics, setDocumentDiagnostics] = useState<any[]>([]);
  const [originLinks, setOriginLinks] = useState<string[]>([]);
  const [documentSources, setDocumentSources] = useState<string[]>([]);
  const [dadosComplementares, setDadosComplementares] = useState<Partial<Licitacao>>({});
  const licitacao = aviso ? { ...aviso, ...dadosComplementares } : null;

  useEffect(() => {
    const controller = new AbortController();
    setArquivos([]);
    setArquivosError('');
    setDocumentDiagnostics([]);
    setOriginLinks([]);
    setDocumentSources([]);
    setSearchingPncp(false);
    setDadosComplementares({});
    if (!aviso) return;
    setSearchingPncp(true);
    const load = async () => {
      try {
        const response = await fetch(buildApiUrl('/b2g-licitacoes/documentos/resolver'), {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(aviso),
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Não foi possível consultar os documentos nas fontes oficiais.');
        if (!Array.isArray(data.documentos)) throw new Error('Resposta inválida ao consultar documentos do edital.');
        if (!controller.signal.aborted) {
          setArquivos(data.documentos);
          setDocumentDiagnostics(data.diagnosticos || []);
          setOriginLinks(data.linksOrigem || []);
          setDocumentSources(data.fontesConsultadas || []);
          setDadosComplementares(data.dadosComplementares || {});
        }
      } catch (error: any) {
        if (!controller.signal.aborted) setArquivosError(error.message || 'Falha na consulta às fontes oficiais. Tente novamente.');
      } finally {
        if (!controller.signal.aborted) setSearchingPncp(false);
      }
    };
    load();
    return () => controller.abort();
  }, [aviso, retryCount]);

  if (!licitacao) return null;

  const getOrgaoName = (lic: Licitacao) => lic.orgao || lic.orgaoEntidade?.razaoSocial || 'Órgão não especificado';
  const getUf = (lic: Licitacao) => lic.uf || lic.unidadeOrgao?.ufSigla || 'BR';
  const getCidade = (lic: Licitacao) => lic.cidade || (lic as any).municipio || lic.unidadeOrgao?.municipioNome || '';
  const getObjeto = (lic: Licitacao) => (lic as any).titulo || lic.objeto_resumo || lic.objetoCompra || 'Sem descrição';
  const getData = (lic: Licitacao) => (lic as any).dataPublicacao || lic.dataAtualizacao || lic.data_abertura || (lic as any).dataEncerramento || lic.dataEncerramentoProposta || lic.dataHoraAberturaSessaoPublica || lic.dataAtualizacao || new Date().toISOString();
  const getSituacao = (lic: Licitacao) => lic.situacao || (lic as any).status || lic.situacaoCompraNome || 'Divulgada no PNCP';

  const getPrazoLimiteDate = getNoticeDeadline;

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

  const handleRealDownload = async (url: string, title: string, arqMeta?: any) => {
    if (!url || downloadingUrl) return;
    if (!arqMeta && /^https?:\/\//i.test(url) && !url.includes('/arquivos/') && !/\.(pdf|zip|docx?|xlsx?)(?:[?#]|$)/i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    setDownloadingUrl(url);
    setArquivosError('');
    try {
      const compra = resolvePncpCompra(licitacao);
      const safeTitle = String(title || 'Documento').replace(/[\/\\]/g, '_');
      let endpoint: string;
      if (arqMeta?.origem === 'PNCP_OFICIAL' && compra && arqMeta.sequencialDocumento) {
        endpoint = buildApiUrl(`/b2g-licitacoes/arquivos/${compra.cnpj}/${compra.ano}/${compra.sequencial}/download/${arqMeta.sequencialDocumento}`);
      } else if (arqMeta?.origem === 'CACHE_LOCAL' && url.startsWith('/api/b2g-licitacoes/documentos/cache/')) {
        endpoint = buildApiUrl(url.replace(/^\/api/, ''));
      } else if (url.startsWith('/api/b2g-licitacoes/documento-gerado/')) {
        endpoint = url;
      } else {
        endpoint = buildApiUrl(`/b2g-licitacoes/proxy-download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeTitle)}`);
      }
      const response = await fetch(endpoint, { headers: getAuthHeaders() });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'Não foi possível baixar o documento. Tente novamente.');
      }
      const { blob, filename } = await prepareDocumentDownload(await response.blob(), {
        title: safeTitle,
        contentDisposition: response.headers.get('content-disposition')
      });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error: any) {
      setArquivosError(error.message || 'Erro ao baixar o documento.');
    } finally {
      setDownloadingUrl(null);
    }
  };

  const status = getPrazoStatus(licitacao);
  const numControle = licitacao.numeroControlePNCP || (licitacao as any).numero_controle_pncp || (licitacao as any).numeroCompra || licitacao.id;
  const isManagedNow = isManaged || addSuccess;

  // Links oficiais
  const compra = resolvePncpCompra(licitacao);
  const cnpjRaw = compra?.cnpj;
  const anoRaw = compra?.ano;
  const seqRaw = compra?.sequencial;
  const origemLink = licitacao.linkSistemaOrigem || licitacao.linkProcessoEletronico ||
    (licitacao.link && !licitacao.link.includes('pncp.gov.br') ? licitacao.link : null) || originLinks.find(link => !link.includes('pncp.gov.br'));
  const pncpPageLink = compra
    ? `https://pncp.gov.br/app/editais/${compra.cnpj}/${compra.ano}/${compra.sequencial}`
    : (licitacao.pncpPageLink || null);
  const origemDou = /^https:\/\/(?:www\.)?in\.gov\.br\//i.test(origemLink || '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[#011419] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-[#07323e]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-[#011116]/60">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-md uppercase tracking-wider",
                isAtivo(licitacao) ? "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300" : "bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300"
              )}>
                {getSituacao(licitacao)}
              </span>
              <span className="text-xs text-cyan-300">Origem: {Array.from(new Set(((licitacao as any).origens?.length ? (licitacao as any).origens : [{ nome: (licitacao as any).fonte || 'Fonte oficial' }]).map((origin: any) => origin.nome))).join(' • ')}</span>
              <span className={cn(
                "text-xs font-semibold px-2.5 py-1 rounded-md flex items-center gap-1",
                status.type === 'expired' ? "bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300" : "bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300"
              )}>
                <Clock className="w-3 h-3" />
                {status.label}
              </span>

              <span className="text-sm text-slate-400 font-medium">{numControle || 'Sem código PNCP'}</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-2">Detalhes e Anexos do Edital</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Objeto */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-2">Objeto da Contratação</h3>
            <p className="text-slate-200 leading-relaxed text-sm bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
              {getObjeto(licitacao)}
            </p>
          </div>

          {/* Quadros de Informações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">Informações Gerais</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Órgão / Ente Público</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center">
                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-cyan-400 flex-shrink-0" />
                    {getOrgaoName(licitacao)}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Modalidade</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{licitacao.modalidade || licitacao.modalidadeNome || 'Não informada'}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Localidade</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center">
                    <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
                    {getCidade(licitacao) ? `${getCidade(licitacao)} - ${getUf(licitacao)}` : getUf(licitacao)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-3">Valores e Prazos</h3>
              <div className="space-y-4">
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Valor Estimado</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    {formatNoticeValue(licitacao)}
                  </span>
                  {(licitacao as any).fonteValor && <span className="text-xs text-slate-400 block mt-1">{(licitacao as any).fonteValor}</span>}
                  {(licitacao as any).motivoValorNaoInformado && <span className="text-xs text-slate-400 block mt-1">{(licitacao as any).motivoValorNaoInformado}</span>}
                </div>
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Prazo Limite para Envio de Propostas</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100 flex items-center">
                    <Clock className="w-3.5 h-3.5 mr-1.5 text-cyan-400 flex-shrink-0" />
                    {formatPrazoLimite(licitacao)}
                  </span>
                </div>
                {formatInicioPropostas(licitacao) && (
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Início do Recebimento de Propostas</span>
                    <span className="text-sm font-medium text-slate-200 flex items-center">
                      <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
                      {formatInicioPropostas(licitacao)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-xs text-slate-400 block mb-1">Data de Publicação / Divulgação</span>
                  <span className="text-sm font-medium text-slate-300 flex items-center">
                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-400 flex-shrink-0" />
                    {new Date(getData(licitacao)).toLocaleString('pt-BR')}
                  </span>
                </div>
                {origemLink && (
                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Sistema de Origem</span>
                    <a 
                      href={origemLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                    >
                      {origemDou ? 'Consultar publicação no DOU' : 'Acessar Processo Eletrônico'} <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Anexos e Documentos Oficiais */}
          <div>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider flex items-center">
                <FileText className="w-4 h-4 mr-2 text-cyan-400" /> Documentos e Anexos Oficiais
              </h3>
              <div className="flex items-center gap-2">
                {searchingPncp && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-950/60 text-cyan-300 border border-cyan-800">
                    <div className="w-3 h-3 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin"></div>
                    Consultando fontes...
                  </span>
                )}
                {arquivos.length > 0 && <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/60 text-emerald-300 border border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Documentos disponíveis
                </span>}
              </div>
            </div>
            
            {arquivosError && !searchingPncp && (
              <div role="alert" className="mb-3 rounded-xl border border-amber-700/60 bg-amber-950/30 p-4">
                <p className="text-sm text-amber-200">{arquivosError}</p>
                <button type="button" onClick={() => setRetryCount((count) => count + 1)} className="mt-2 text-sm font-semibold text-cyan-300 hover:underline">Tentar novamente</button>
              </div>
            )}
            {documentDiagnostics.length > 0 && !searchingPncp && (
              <details className="mb-3 rounded-xl border border-amber-800/50 p-3 text-sm text-amber-200">
                <summary className="cursor-pointer">Diagnóstico das fontes de documentos</summary>
                <ul className="mt-2 space-y-1">{documentDiagnostics.map((entry, i) => <li key={i}>{entry.fonte}: {entry.mensagem}</li>)}</ul>
                <button type="button" onClick={() => setRetryCount(count => count + 1)} className="mt-2 font-semibold text-cyan-300">Tentar novamente</button>
              </details>
            )}
            {searchingPncp ? (
              <div className="border border-[#07323e] rounded-xl p-8 bg-[#011419] text-center">
                <div className="w-7 h-7 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin mx-auto mb-3"></div>
                <p className="text-sm font-semibold text-slate-100">Buscando documentos no PNCP e nos sistemas de origem...</p>
                <p className="text-xs text-slate-400 mt-1">Localizando arquivos originais de edital, termos de referência e minutas contratuais.</p>
              </div>
            ) : arquivos.length > 0 ? (
              <div className="border border-[#07323e] rounded-xl overflow-hidden shadow-sm divide-y divide-slate-800/80">
                {arquivos.map((arq, idx) => {
                  const fileUrl = arq.url || arq.uri;
                  const isDownloadingThis = downloadingUrl === fileUrl;
                  return (
                    <div key={idx} className="flex items-center justify-between p-4 bg-[#011419] hover:bg-slate-900/60 transition-colors">
                      <div className="flex items-center min-w-0 pr-4">
                        <div className="bg-cyan-950/50 p-2.5 rounded-lg mr-4 border border-cyan-900/60 flex-shrink-0">
                          <FileText className="w-5 h-5 text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-100 truncate" title={arq.titulo}>{arq.titulo}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-slate-400 font-medium">{arq.tipoDocumentoNome || 'Documento Oficial'}</span>
                            <span className="text-slate-600">•</span>
                            <span className="text-[11px] text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded font-mono border border-emerald-800">
                              {arq.origem === 'PNCP_OFICIAL' ? 'Anexo Oficial PNCP' : arq.origem === 'SISTEMA_ORIGEM' ? 'Sistema Oficial de Origem' : 'Documento Verificado'}
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
                            className="flex items-center px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                            title="Abrir documento original em nova aba"
                          >
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir
                          </a>
                        )}
                        <button 
                          onClick={() => handleRealDownload(fileUrl, arq.titulo, arq)}
                          disabled={Boolean(downloadingUrl) || !fileUrl}
                          className="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 rounded-lg transition-all shadow-sm shadow-[#00171d] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {isDownloadingThis ? (
                            <>
                              <div className="w-4 h-4 mr-2 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
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
              <div className="border border-[#07323e] rounded-xl p-6 bg-slate-900/40 text-center">
                <FileText className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-white">
                  Documentação e Edital Oficial
                </p>
                <p className="text-xs text-slate-300 mt-1 max-w-lg mx-auto">
                  {arquivosError
                      ? "Consulte a página oficial enquanto a busca de documentos estiver indisponível."
                      : "Nenhum arquivo pôde ser recuperado automaticamente nas fontes consultadas. Confira o diagnóstico ou acesse o sistema de origem."
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
                      <ExternalLink className="w-3.5 h-3.5" /> {origemDou ? 'Consultar publicação no DOU' : 'Acessar Sistema de Origem'}
                    </a>
                  )}
                  {pncpPageLink && (
                    <a 
                      href={pncpPageLink}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-medium border border-slate-700 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Consultar Certame no PNCP
                    </a>
                  )}
                  {cnpjRaw && anoRaw && seqRaw && (
                    <button
                      onClick={() => handleRealDownload(`/api/b2g-licitacoes/documento-gerado/${cnpjRaw}/${anoRaw}/${seqRaw}/resumo?titulo=Ficha_Resumo_Edital_${seqRaw}_${anoRaw}.pdf`, `Ficha_Resumo_Edital_${seqRaw}_${anoRaw}.pdf`)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition-all cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" /> Exportar Ficha Resumo (PDF)
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {originLinks.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">{originLinks.map(link => (
                <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-300 hover:underline">Acessar origem: {new URL(link).hostname}</a>
              ))}</div>
            )}

            <div className="mt-3 flex items-center justify-between text-xs text-slate-400 bg-slate-900/40 px-3 py-2 rounded-lg border border-slate-800">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {arquivos.length ? `${arquivos.length} documento(s) disponível(is) nas fontes oficiais.` : 'Nenhum arquivo recuperado. Consulte o diagnóstico e os links de origem.'}
              </span>
              {pncpPageLink && (
                <a
                  href={pncpPageLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-cyan-400 hover:underline inline-flex items-center gap-1 font-medium ml-2 flex-shrink-0"
                >
                  Página da Licitação no PNCP <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-[#011419] flex justify-between items-center gap-3">
          <div>
            {onAddToManaged && (
              <button
                type="button"
                onClick={() => onAddToManaged(licitacao)}
                disabled={addingToManaged || isManagedNow}
                className={cn(
                  "px-6 py-2.5 font-medium rounded-lg transition-all shadow-sm flex items-center gap-2",
                  isManagedNow 
                    ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/80 cursor-default" 
                    : "bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white shadow-[#00171d] cursor-pointer"
                )}
              >
                {addingToManaged ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                ) : isManagedNow ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
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
            className="px-6 py-2.5 bg-slate-900 dark:bg-slate-800 text-white font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
