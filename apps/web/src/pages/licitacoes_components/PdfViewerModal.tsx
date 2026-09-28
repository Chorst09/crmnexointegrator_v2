import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Printer, 
  X, 
  FileText, 
  CheckCircle2, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ExternalLink,
  Calendar,
  DollarSign,
  Clock,
  ShieldAlert,
  AlertTriangle,
  Building2,
  FileCheck,
  Scale,
  Package,
  Layers,
  Sun,
  Moon
} from 'lucide-react';
import { FichaTecnicaEditalTR } from './types';
import { formatarMoeda } from './utils/pdfGenerator';
import { useTheme } from './context/ThemeContext';

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfBlobUrl: string | null;
  ficha: FichaTecnicaEditalTR | null;
  onDownload: () => void;
  documentTitle: string;
}

export const PdfViewerModal: React.FC<PdfViewerModalProps> = ({
  isOpen,
  onClose,
  pdfBlobUrl,
  ficha,
  onDownload,
  documentTitle
}) => {
  const { resolvedTheme } = useTheme();
  const [zoom, setZoom] = useState<number>(100);
  const [docTheme, setDocTheme] = useState<'system' | 'paper' | 'dark'>('system');

  const isDarkDoc = docTheme === 'dark' || (docTheme === 'system' && resolvedTheme === 'dark');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !ficha) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 15, 145));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 15, 70));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handleOpenExternal = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank');
    } else {
      onDownload();
    }
  };

  const totalGeralItens = (ficha.matriz_itens || []).reduce(
    (acc, it) => acc + (it.valor_estimado_total || (it.valor_estimado_unitario || 0) * (it.quantitativo || 1)),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-pdf-document, #printable-pdf-document * {
            visibility: visible !important;
          }
          #printable-pdf-document {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: #0f172a !important;
          }
          .a4-page {
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
            margin-bottom: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
            width: 100% !important;
            min-height: 100vh !important;
            background: white !important;
            color: #0f172a !important;
          }
          .a4-page * {
            background-color: transparent !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
          }
          .faixa-oficial, .faixa-oficial * {
            background: #1e3a8a !important;
            color: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .faixa-oficial span, .faixa-oficial p {
            color: #bfdbfe !important;
          }
        }
      `}</style>

      <div 
        className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden border border-slate-700/80"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra Superior de Ferramentas */}
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate leading-tight text-white">
                {documentTitle}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3" /> Ficha Técnica Oficial (Lei 14.133/2021)
                </span>
                <span className="text-slate-500 text-[10px] hidden sm:inline">•</span>
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">Visualização Direta A4</span>
              </div>
            </div>
          </div>

          {/* Controles: Zoom, Modo Escuro/Papel, Imprimir, Salvar PDF, Abrir e Fechar */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Controle de Modo de Visualização (Escuro / Papel) */}
            <button
              onClick={() => setDocTheme(isDarkDoc ? 'paper' : 'dark')}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title={isDarkDoc ? "Mudar para visualização em folha branca (Modo Papel)" : "Mudar para leitura em modo escuro"}
            >
              {isDarkDoc ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Modo Papel</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Modo Escuro</span>
                </>
              )}
            </button>

            {/* Controle de Zoom */}
            <div className="flex items-center bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
              <button
                onClick={handleZoomOut}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-40 cursor-pointer"
                title="Diminuir zoom"
                disabled={zoom <= 70}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleResetZoom}
                className="px-2 py-1 text-[11px] font-mono text-slate-200 hover:text-white hover:bg-slate-700 rounded transition-colors cursor-pointer"
                title="Redefinir zoom para 100%"
              >
                {zoom}%
              </button>
              <button
                onClick={handleZoomIn}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-40 cursor-pointer"
                title="Aumentar zoom"
                disabled={zoom >= 145}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
              title="Imprimir documento formatado"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {pdfBlobUrl && (
              <button
                onClick={handleOpenExternal}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition-colors hidden md:flex items-center gap-1.5 border border-slate-700 cursor-pointer"
                title="Abrir arquivo em nova aba"
              >
                <ExternalLink className="w-4 h-4 text-slate-300" />
                <span>Nova Aba</span>
              </button>
            )}

            <button
              onClick={onDownload}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="Baixar arquivo PDF no seu computador"
            >
              <Download className="w-4 h-4" />
              <span>Salvar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1 cursor-pointer"
              title="Fechar visualizador (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área do Documento - Renderização A4 direta e contínua */}
        <div className="flex-1 bg-slate-800/90 dark:bg-slate-950/90 overflow-y-auto overflow-x-auto p-4 sm:p-8 flex flex-col items-center transition-colors">
          <div 
            id="printable-pdf-document"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center', transition: 'transform 0.15s ease' }}
            className="flex flex-col items-center gap-8 w-full max-w-[210mm]"
          >
            {/* ========================================================
                PÁGINA 1: IDENTIFICAÇÃO, DATAS CRÍTICAS, RESUMO E HABILITAÇÃO
                ======================================================== */}
            <div className={`a4-page w-full min-h-[297mm] shadow-2xl rounded-sm p-8 sm:p-12 flex flex-col justify-between border relative transition-colors ${
              isDarkDoc 
                ? 'bg-slate-900 text-slate-100 border-slate-700/80 shadow-slate-950/50' 
                : 'bg-white text-slate-900 border-slate-300'
            }`}>
              <div>
                {/* Faixa Oficial Timbrada */}
                <div className="faixa-oficial bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white p-4 rounded-md mb-6 shadow-sm">
                  <div className="flex items-center justify-between text-[10px] tracking-widest uppercase font-semibold text-blue-200 border-b border-blue-800 pb-1.5 mb-2">
                    <span>República Federativa do Brasil</span>
                    <span>Lei Federal nº 14.133/2021</span>
                  </div>
                  <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white uppercase">
                    Ficha Técnica Executiva & Auditoria de Edital / TR
                  </h1>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Relatório oficial de inteligência pré-certame para licitantes e analistas
                  </p>
                </div>

                {/* Identificação do Órgão e Processo */}
                <div className={`border-b pb-4 mb-5 ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>Órgão Licitante</span>
                      <h2 className={`text-lg font-bold leading-snug ${isDarkDoc ? 'text-slate-100' : 'text-slate-900'}`}>
                        {ficha.orgao_comprador}
                      </h2>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-[10px] uppercase font-bold tracking-wider ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>ID / PNCP</span>
                      <div className={`text-xs font-mono font-bold px-2.5 py-1 rounded border inline-block mt-0.5 ${
                        isDarkDoc 
                          ? 'text-blue-300 bg-blue-950/60 border-blue-800' 
                          : 'text-blue-700 bg-blue-50 border-blue-200'
                      }`}>
                        {ficha.id_licitacao}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3 text-xs">
                    <div>
                      <span className={isDarkDoc ? 'text-slate-400' : 'text-slate-500'}>Modalidade:</span>{' '}
                      <strong className={isDarkDoc ? 'text-slate-200' : 'text-slate-800'}>{ficha.modalidade_contratacao}</strong>
                    </div>
                    <div>
                      <span className={isDarkDoc ? 'text-slate-400' : 'text-slate-500'}>Critério:</span>{' '}
                      <strong className={isDarkDoc ? 'text-slate-200' : 'text-slate-800'}>{ficha.criterio_julgamento}</strong>
                    </div>
                    <div>
                      <span className={isDarkDoc ? 'text-slate-400' : 'text-slate-500'}>Modo de Disputa:</span>{' '}
                      <strong className={isDarkDoc ? 'text-slate-200' : 'text-slate-800'}>{ficha.modo_disputa || 'Aberto'}</strong>
                    </div>
                  </div>
                </div>

                {/* QUADRO DESTACADO: CRONOGRAMA CRÍTICO & PRAZOS */}
                <div className={`border-2 rounded-lg p-4 mb-6 shadow-xs ${
                  isDarkDoc 
                    ? 'bg-slate-950/60 border-blue-800/70' 
                    : 'bg-slate-50 border-blue-200'
                }`}>
                  <div className={`flex items-center gap-2 pb-2.5 mb-3 border-b ${
                    isDarkDoc 
                      ? 'border-blue-900/60 text-blue-300' 
                      : 'border-blue-100 text-blue-900'
                  }`}>
                    <Calendar className={`w-4 h-4 ${isDarkDoc ? 'text-blue-400' : 'text-blue-700'}`} />
                    <h3 className="text-xs font-bold uppercase tracking-wider">
                      Cronograma Crítico & Prazos da Licitação
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                    {/* Abertura */}
                    <div className={`p-2.5 rounded border ${
                      isDarkDoc ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    }`}>
                      <div className={`text-[10px] font-bold uppercase ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>Abertura da Sessão</div>
                      <div className={`text-sm font-extrabold mt-0.5 ${isDarkDoc ? 'text-blue-400' : 'text-blue-900'}`}>
                        {ficha.data_abertura || 'Consulte o Edital'}
                      </div>
                      <div className={`text-[10px] mt-1 flex items-center gap-1 ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>
                        <Clock className="w-3 h-3 text-blue-500" /> Disputa de lances
                      </div>
                    </div>

                    {/* Limite Propostas */}
                    <div className={`p-2.5 rounded border ${
                      isDarkDoc ? 'bg-slate-900 border-rose-900/70' : 'bg-white border-rose-200'
                    }`}>
                      <div className={`text-[10px] font-bold uppercase ${isDarkDoc ? 'text-rose-400' : 'text-rose-700'}`}>Limite de Propostas</div>
                      <div className={`text-sm font-extrabold mt-0.5 ${isDarkDoc ? 'text-slate-100' : 'text-slate-900'}`}>
                        {ficha.data_limite_proposta || 'Até abertura da sessão'}
                      </div>
                      <div className={`text-[10px] mt-1 flex items-center gap-1 font-medium ${isDarkDoc ? 'text-rose-400' : 'text-rose-600'}`}>
                        <AlertTriangle className="w-3 h-3 text-rose-500" /> Prazo fatal no sistema
                      </div>
                    </div>

                    {/* Impugnação / Esclarecimento */}
                    <div className={`p-2.5 rounded border ${
                      isDarkDoc ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
                    }`}>
                      <div className={`text-[10px] font-bold uppercase ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>Impugnação / Dúvidas</div>
                      <div className={`text-xs font-semibold mt-0.5 ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        {ficha.data_fim_esclarecimento || 'Até 3 dias úteis antes'}
                      </div>
                      <div className={`text-[10px] mt-1 flex items-center gap-1 ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>
                        <ShieldAlert className="w-3 h-3 text-amber-500" /> Art. 164 da Lei 14.133
                      </div>
                    </div>

                    {/* Valor Estimado Total */}
                    <div className={`p-2.5 rounded border ${
                      isDarkDoc ? 'bg-slate-900 border-emerald-900/70' : 'bg-white border-emerald-200'
                    }`}>
                      <div className={`text-[10px] font-bold uppercase ${isDarkDoc ? 'text-emerald-400' : 'text-emerald-800'}`}>Valor Global Estimado</div>
                      <div className={`text-sm font-extrabold mt-0.5 ${isDarkDoc ? 'text-emerald-400' : 'text-emerald-700'}`}>
                        {formatarMoeda(ficha.valor_estimado_total)}
                      </div>
                      <div className={`text-[10px] mt-1 flex items-center gap-1 ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>
                        <DollarSign className="w-3 h-3 text-emerald-500" /> Portal: {ficha.portal_compras?.split('/')[0] || 'PNCP'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 1. RESUMO EXECUTIVO */}
                <div className="mb-6">
                  <div className={`flex items-center gap-2 mb-2 pb-1 border-b ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                    <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                      isDarkDoc ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                    }`}>1</span>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>Resumo Executivo do Certame</h3>
                  </div>
                  <div className={`text-xs leading-relaxed whitespace-pre-line text-justify p-3.5 rounded border ${
                    isDarkDoc 
                      ? 'bg-slate-950/40 text-slate-300 border-slate-800' 
                      : 'bg-slate-50/50 text-slate-700 border-slate-200'
                  }`}>
                    {ficha.resumo_executivo}
                  </div>
                </div>

                {/* 2. REQUISITOS DE HABILITAÇÃO */}
                <div>
                  <div className={`flex items-center gap-2 mb-2 pb-1 border-b ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                    <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                      isDarkDoc ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                    }`}>2</span>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>Requisitos de Habilitação & Qualificação</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {/* Atestados Técnicos */}
                    <div className={`p-3 rounded border ${isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className={`font-bold mb-1.5 flex items-center gap-1.5 text-[11px] uppercase ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        <FileCheck className="w-3.5 h-3.5 text-blue-500" />
                        Capacidade Técnica Operacional
                      </div>
                      <ul className={`list-disc list-inside space-y-1 text-[11px] ${isDarkDoc ? 'text-slate-300' : 'text-slate-700'}`}>
                        {ficha.requisitos_habilitacao.atestados_capacidade_tecnica.map((item, idx) => (
                          <li key={idx} className="leading-snug">{item}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Exigências Contábeis */}
                    <div className={`p-3 rounded border ${isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className={`font-bold mb-1.5 flex items-center gap-1.5 text-[11px] uppercase ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        <Scale className="w-3.5 h-3.5 text-indigo-400" />
                        Qualificação Econômico-Financeira
                      </div>
                      <div className="space-y-1 text-[11px]">
                        {ficha.requisitos_habilitacao.exigencias_contabeis.map((ind, idx) => (
                          <div key={idx} className={`flex justify-between py-0.5 border-b last:border-0 ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                            <span className={`font-medium ${isDarkDoc ? 'text-slate-400' : 'text-slate-700'}`}>{ind.nome_indice}:</span>
                            <span className={`font-bold ${isDarkDoc ? 'text-slate-100' : 'text-slate-900'}`}>{ind.regra}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Certidões e Registros */}
                    <div className={`p-3 rounded border ${isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className={`font-bold mb-1.5 text-[11px] uppercase ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        Regularidade Fiscal, Social e Trabalhista
                      </div>
                      <ul className={`list-disc list-inside space-y-1 text-[11px] ${isDarkDoc ? 'text-slate-300' : 'text-slate-700'}`}>
                        {ficha.requisitos_habilitacao.certidoes_e_registros_especificos.map((cert, idx) => (
                          <li key={idx} className="leading-snug">{cert}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Equipe Chave */}
                    <div className={`p-3 rounded border ${isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className={`font-bold mb-1.5 text-[11px] uppercase ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        Equipe Técnica e Registros em Conselhos
                      </div>
                      <ul className={`list-disc list-inside space-y-1 text-[11px] ${isDarkDoc ? 'text-slate-300' : 'text-slate-700'}`}>
                        {ficha.requisitos_habilitacao.qualificacao_equipe_chave.map((eq, idx) => (
                          <li key={idx} className="leading-snug">{eq}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé da Página 1 */}
              <div className={`mt-8 pt-3 border-t flex items-center justify-between text-[10px] ${
                isDarkDoc ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
              }`}>
                <span>Processo nº {ficha.id_licitacao} • Emissão Eletrônica Conforme Lei nº 14.133/2021</span>
                <span>Página 1 de 3</span>
              </div>
            </div>

            {/* ========================================================
                PÁGINA 2: PRAZOS, LOCAIS E MATRIZ DE RISCOS
                ======================================================== */}
            <div className={`a4-page w-full min-h-[297mm] shadow-2xl rounded-sm p-8 sm:p-12 flex flex-col justify-between border relative transition-colors ${
              isDarkDoc 
                ? 'bg-slate-900 text-slate-100 border-slate-700/80 shadow-slate-950/50' 
                : 'bg-white text-slate-900 border-slate-300'
            }`}>
              <div>
                {/* Cabeçalho Resumido */}
                <div className={`flex items-center justify-between pb-3 mb-6 border-b text-[10px] ${
                  isDarkDoc ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}>
                  <span className={`font-semibold uppercase ${isDarkDoc ? 'text-slate-300' : 'text-slate-700'}`}>
                    Ficha Técnica Executiva • {ficha.orgao_comprador.slice(0, 50)}
                  </span>
                  <span className="font-mono">ID: {ficha.id_licitacao}</span>
                </div>

                {/* 3. PRAZOS, LOCAIS E EXECUÇÃO */}
                <div className="mb-6">
                  <div className={`flex items-center gap-2 mb-3 pb-1 border-b ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                    <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                      isDarkDoc ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                    }`}>3</span>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                      Prazos, Locais e Condições de Fornecimento
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className={`p-3 rounded border space-y-2 ${isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div>
                        <span className={`text-[10px] font-bold uppercase block ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>Prazo de Início e Entrega</span>
                        <span className={`font-semibold ${isDarkDoc ? 'text-slate-100' : 'text-slate-900'}`}>{ficha.prazos_e_locais.prazo_inicio_entrega}</span>
                      </div>
                      <div>
                        <span className={`text-[10px] font-bold uppercase block ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>Vigência Contratual</span>
                        <span className={`font-semibold ${isDarkDoc ? 'text-slate-100' : 'text-slate-900'}`}>{ficha.prazos_e_locais.vigencia_contrato}</span>
                      </div>
                      {ficha.prazos_e_locais.regime_execucao && (
                        <div>
                          <span className={`text-[10px] font-bold uppercase block ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>Regime de Execução</span>
                          <span className={`font-semibold ${isDarkDoc ? 'text-slate-100' : 'text-slate-900'}`}>{ficha.prazos_e_locais.regime_execucao}</span>
                        </div>
                      )}
                    </div>

                    <div className={`p-3 rounded border space-y-2 ${isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div>
                        <span className={`text-[10px] font-bold uppercase block ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>Locais de Entrega / Prestação</span>
                        <ul className={`list-disc list-inside text-[11px] mt-0.5 space-y-0.5 ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                          {ficha.prazos_e_locais.locais_prestacao_entrega.map((loc, idx) => (
                            <li key={idx}>{loc}</li>
                          ))}
                        </ul>
                      </div>
                      {ficha.prazos_e_locais.prazo_recebimento_provisorio_definitivo && (
                        <div>
                          <span className={`text-[10px] font-bold uppercase block ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>Recebimento Provisório e Definitivo</span>
                          <span className={`text-[11px] ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>{ficha.prazos_e_locais.prazo_recebimento_provisorio_definitivo}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 4. MATRIZ DE RISCOS & PONTOS DE ATENÇÃO */}
                <div>
                  <div className={`flex items-center gap-2 mb-3 pb-1 border-b ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                    <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                      isDarkDoc ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                    }`}>4</span>
                    <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                      Matriz de Riscos & Pontos Críticos de Atenção
                    </h3>
                  </div>

                  <div className="space-y-3 text-xs">
                    {/* Vistoria Técnica e Amostras */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className={`p-3 rounded border ${
                        isDarkDoc ? 'bg-amber-950/30 border-amber-800/70' : 'bg-amber-50/60 border-amber-200'
                      }`}>
                        <div className={`font-bold flex items-center gap-1.5 text-[11px] uppercase mb-1 ${
                          isDarkDoc ? 'text-amber-300' : 'text-amber-900'
                        }`}>
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                          Regras de Vistoria Técnica
                        </div>
                        <div className={`text-[11px] space-y-1 ${isDarkDoc ? 'text-amber-200' : 'text-amber-950'}`}>
                          <div>
                            <strong>Obrigatoriedade:</strong>{' '}
                            {ficha.pontos_de_atencao_risco.regras_vistoria.obrigatoria ? 'Sim (Exigência Formal)' : 'Facultativa / Não Exigida'}
                          </div>
                          <div>
                            <strong>Permite Declaração Substitutiva:</strong>{' '}
                            {ficha.pontos_de_atencao_risco.regras_vistoria.permite_declaracao_substitutiva ? 'Sim (Declaração de Pleno Conhecimento)' : 'Não'}
                          </div>
                          {ficha.pontos_de_atencao_risco.regras_vistoria.detalhes_e_prazo && (
                            <div className={`text-[10px] mt-1 italic ${isDarkDoc ? 'text-amber-300/80' : 'text-amber-900'}`}>
                              {ficha.pontos_de_atencao_risco.regras_vistoria.detalhes_e_prazo}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className={`p-3 rounded border ${isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`font-bold flex items-center gap-1.5 text-[11px] uppercase mb-1 ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                          <Package className="w-3.5 h-3.5 text-blue-500" />
                          Amostras e Garantia Contratual
                        </div>
                        <div className={`text-[11px] space-y-1 ${isDarkDoc ? 'text-slate-300' : 'text-slate-800'}`}>
                          <div>
                            <strong>Exigência de Amostra/PoC:</strong>{' '}
                            {ficha.pontos_de_atencao_risco.exigencia_amostra_poc || 'Não exigida na fase de propostas'}
                          </div>
                          <div>
                            <strong>Garantia Contratual (arts. 96-102):</strong>{' '}
                            {ficha.pontos_de_atencao_risco.garantia_contratual || 'Conforme percentual previsto na minuta do contrato'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Penalidades e Multas */}
                    <div className={`p-3 rounded border ${
                      isDarkDoc ? 'bg-rose-950/30 border-rose-850/70' : 'bg-rose-50/50 border-rose-200'
                    }`}>
                      <div className={`font-bold flex items-center gap-1.5 text-[11px] uppercase mb-1.5 ${
                        isDarkDoc ? 'text-rose-300' : 'text-rose-900'
                      }`}>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                        Cláusulas Punitivas e Penalidades Aplicáveis
                      </div>
                      <ul className={`list-disc list-inside space-y-1 text-[11px] ${
                        isDarkDoc ? 'text-rose-200' : 'text-rose-950'
                      }`}>
                        {ficha.pontos_de_atencao_risco.clausulas_punitivas_multas.map((multa, idx) => (
                          <li key={idx} className="leading-snug">{multa}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Pontos de Atenção Gerais */}
                    <div className={`p-3 rounded border ${isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                      <div className={`font-bold text-[11px] uppercase mb-1.5 ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        Recomendações e Orientações Técnicas ao Licitante
                      </div>
                      <ul className={`list-disc list-inside space-y-1 text-[11px] ${isDarkDoc ? 'text-slate-300' : 'text-slate-700'}`}>
                        {ficha.pontos_de_atencao_risco.pontos_de_atencao_gerais.map((pt, idx) => (
                          <li key={idx} className="leading-snug">{pt}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé da Página 2 */}
              <div className={`mt-8 pt-3 border-t flex items-center justify-between text-[10px] ${
                isDarkDoc ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
              }`}>
                <span>Processo nº {ficha.id_licitacao} • Emissão Eletrônica Conforme Lei nº 14.133/2021</span>
                <span>Página 2 de 3</span>
              </div>
            </div>

            {/* ========================================================
                PÁGINA 3: MATRIZ DE ITENS E ESPECIFICAÇÕES DO TR
                ======================================================== */}
            <div className={`a4-page w-full min-h-[297mm] shadow-2xl rounded-sm p-8 sm:p-12 flex flex-col justify-between border relative transition-colors ${
              isDarkDoc 
                ? 'bg-slate-900 text-slate-100 border-slate-700/80 shadow-slate-950/50' 
                : 'bg-white text-slate-900 border-slate-300'
            }`}>
              <div>
                {/* Cabeçalho Resumido */}
                <div className={`flex items-center justify-between pb-3 mb-6 border-b text-[10px] ${
                  isDarkDoc ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500'
                }`}>
                  <span className={`font-semibold uppercase ${isDarkDoc ? 'text-slate-300' : 'text-slate-700'}`}>
                    Ficha Técnica Executiva • {ficha.orgao_comprador.slice(0, 50)}
                  </span>
                  <span className="font-mono">ID: {ficha.id_licitacao}</span>
                </div>

                {/* 5. MATRIZ DE ITENS */}
                <div className="mb-6">
                  <div className={`flex items-center justify-between mb-3 pb-1 border-b ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center ${
                        isDarkDoc ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
                      }`}>5</span>
                      <h3 className={`text-xs font-bold uppercase tracking-wider ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        Matriz de Itens do Termo de Referência (TR)
                      </h3>
                    </div>
                    <span className={`text-[11px] font-medium ${isDarkDoc ? 'text-slate-400' : 'text-slate-500'}`}>
                      Total: {ficha.matriz_itens?.length || 0} itens mapeados
                    </span>
                  </div>

                  <div className={`border rounded-lg overflow-hidden ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className={`font-bold border-b text-[10px] uppercase ${
                          isDarkDoc 
                            ? 'bg-slate-800 text-slate-200 border-slate-700' 
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          <th className="py-2.5 px-3 w-12 text-center">Item</th>
                          <th className="py-2.5 px-3">Especificação Sucinta & Descrição Técnica</th>
                          <th className="py-2.5 px-3 w-20 text-center">Unidade</th>
                          <th className="py-2.5 px-3 w-20 text-right">Qtd</th>
                          <th className="py-2.5 px-3 w-28 text-right">Valor Unit.</th>
                          <th className="py-2.5 px-3 w-28 text-right">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y text-[11px] ${isDarkDoc ? 'divide-slate-800' : 'divide-slate-100'}`}>
                        {ficha.matriz_itens && ficha.matriz_itens.length > 0 ? (
                          ficha.matriz_itens.map((item, idx) => {
                            const valTot = item.valor_estimado_total || (item.valor_estimado_unitario || 0) * (item.quantitativo || 1);
                            const rowBg = isDarkDoc
                              ? (idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-950/40')
                              : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50');
                            return (
                              <tr key={idx} className={rowBg}>
                                <td className={`py-2 px-3 text-center font-bold ${isDarkDoc ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {item.item_numero || idx + 1}
                                </td>
                                <td className="py-2 px-3">
                                  <div className={`font-semibold ${isDarkDoc ? 'text-slate-100' : 'text-slate-900'}`}>{item.especificacao_sucinta}</div>
                                  {item.codigo_catalogo && (
                                    <div className={`text-[10px] font-mono ${isDarkDoc ? 'text-slate-500' : 'text-slate-400'}`}>
                                      Cód. CatMat/CatSer: {item.codigo_catalogo}
                                    </div>
                                  )}
                                </td>
                                <td className={`py-2 px-3 text-center font-medium ${isDarkDoc ? 'text-slate-400' : 'text-slate-600'}`}>
                                  {item.unidade}
                                </td>
                                <td className={`py-2 px-3 text-right font-semibold ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                                  {item.quantitativo.toLocaleString('pt-BR')}
                                </td>
                                <td className={`py-2 px-3 text-right ${isDarkDoc ? 'text-slate-300' : 'text-slate-700'}`}>
                                  {formatarMoeda(item.valor_estimado_unitario)}
                                </td>
                                <td className={`py-2 px-3 text-right font-bold ${isDarkDoc ? 'text-slate-100' : 'text-slate-900'}`}>
                                  {formatarMoeda(valTot)}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className={`py-4 px-3 text-center italic ${isDarkDoc ? 'text-slate-500' : 'text-slate-400'}`}>
                              Itens especificados no documento principal conforme detalhamento do Termo de Referência.
                            </td>
                          </tr>
                        )}
                      </tbody>
                      <tfoot>
                        <tr className={`font-bold border-t-2 text-xs ${
                          isDarkDoc 
                            ? 'bg-blue-950/60 border-blue-900 text-blue-300' 
                            : 'bg-blue-50/80 border-blue-200 text-blue-900'
                        }`}>
                          <td colSpan={4} className="py-2.5 px-3 text-right uppercase">
                            Valor Total Global da Matriz:
                          </td>
                          <td colSpan={2} className="py-2.5 px-3 text-right text-sm font-extrabold">
                            {formatarMoeda(ficha.valor_estimado_total || totalGeralItens)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* 6. TERMO DE RESPONSABILIDADE E CARIMBO TÉCNICO */}
                <div className={`border rounded-lg p-4 mt-6 ${
                  isDarkDoc ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className={`text-xs font-bold uppercase tracking-wider ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        Autenticação & Registro de Auditoria Documental
                      </div>
                      <p className={`text-[11px] mt-1 leading-relaxed ${isDarkDoc ? 'text-slate-400' : 'text-slate-600'}`}>
                        Este documento foi estruturado automaticamente pelo Pipeline de IA Documental para Análise de Editais e Termos de Referência, sob a égide da Lei Federal nº 14.133/2021. As informações devem ser confrontadas com a publicação oficial no Portal Nacional de Contratações Públicas (PNCP) ou diário oficial correspondente.
                      </p>
                    </div>

                    <div className={`text-right flex-shrink-0 border-l pl-4 ${isDarkDoc ? 'border-slate-800' : 'border-slate-200'}`}>
                      <div className={`text-[10px] uppercase font-bold ${isDarkDoc ? 'text-slate-500' : 'text-slate-400'}`}>Data de Processamento</div>
                      <div className={`text-xs font-semibold ${isDarkDoc ? 'text-slate-200' : 'text-slate-800'}`}>
                        {ficha.data_processamento ? new Date(ficha.data_processamento).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')}
                      </div>
                      <div className="text-[10px] text-emerald-500 font-medium mt-1 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Pydantic v2 Validado
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé da Página 3 */}
              <div className={`mt-8 pt-3 border-t flex items-center justify-between text-[10px] ${
                isDarkDoc ? 'border-slate-800 text-slate-500' : 'border-slate-200 text-slate-400'
              }`}>
                <span>Processo nº {ficha.id_licitacao} • Emissão Eletrônica Conforme Lei nº 14.133/2021</span>
                <span>Página 3 de 3</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

