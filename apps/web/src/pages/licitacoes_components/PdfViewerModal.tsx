import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Printer,
  X,
  FileText,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { FichaTecnicaEditalTR } from './types';
import { buildFichaHtmlDocument } from './utils/pdfGenerator';

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
  documentTitle,
}) => {
  const [zoom, setZoom] = useState<number>(100);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const htmlDoc = useMemo(() => {
    if (!ficha) return '';
    return buildFichaHtmlDocument(ficha);
  }, [ficha]);

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
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    } else {
      window.print();
    }
  };

  const handleOpenExternal = () => {
    if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank');
    } else {
      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] rounded-2xl shadow-2xl w-full max-w-6xl h-[94vh] flex flex-col overflow-hidden border border-[var(--crm-border)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra Superior de Ferramentas */}
        <div className="bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--crm-border)] flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold truncate leading-tight text-[rgb(var(--crm-ink-rgb)_/_1)]">
                {documentTitle}
              </h2>
              <p className="text-[11px] text-[rgb(var(--crm-muted-rgb)_/_1)] mt-0.5">
                Padrão ConLicitação • Visualização A4 Estruturada
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] rounded-lg px-1.5 py-1 gap-1">
              <button
                onClick={() => setZoom((z) => Math.max(z - 10, 70))}
                className="p-1 text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] rounded disabled:opacity-40"
                title="Diminuir zoom"
                disabled={zoom <= 70}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono px-1.5">{zoom}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(z + 10, 140))}
                className="p-1 text-[rgb(var(--crm-ink-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-2-rgb)_/_1)] rounded disabled:opacity-40"
                title="Aumentar zoom"
                disabled={zoom >= 140}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(100)}
                className="p-1 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] rounded"
                title="Resetar zoom"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:brightness-110 text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 border border-[var(--crm-border)]"
              title="Imprimir documento A4"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={handleOpenExternal}
              className="px-3 py-1.5 bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:brightness-110 text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs font-medium rounded-lg transition-colors hidden md:flex items-center gap-1.5 border border-[var(--crm-border)]"
              title="Abrir relatório em nova aba"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Nova Aba</span>
            </button>

            <button
              onClick={onDownload}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              title="Baixar relatório estruturado"
            >
              <Download className="w-4 h-4" />
              <span>Salvar PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] rounded-lg hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] transition-colors ml-1"
              title="Fechar visualizador (ESC)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área do Documento A4 */}
        <div className="flex-1 bg-slate-900/90 overflow-auto p-4 sm:p-6 flex justify-center">
          <div
            style={{
              width: `${Math.round((960 * zoom) / 100)}px`,
              minWidth: '320px',
              maxWidth: '100%',
              height: '100%',
            }}
            className="bg-white rounded-lg shadow-2xl overflow-hidden border border-slate-300"
          >
            <iframe
              ref={iframeRef}
              title={documentTitle}
              srcDoc={htmlDoc}
              className="w-full h-full border-0 bg-white"
            />
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : modalContent;
};
