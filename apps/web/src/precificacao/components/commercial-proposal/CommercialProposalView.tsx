import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  SlidersHorizontal,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Check,
  Building,
  UserCheck,
  Calendar,
  Layers,
  ArrowLeft,
  ChevronDown,
  Sparkles,
  ShieldCheck,
  Eye,
  Edit3,
  Image as ImageIcon
} from 'lucide-react';
import { Proposal } from '../../lib/types';
import { useProposalsApi } from '../../hooks/use-proposals-api';
import CommercialProposalPresentationView from './CommercialProposalPresentationView';

export interface CommercialProposalViewProps {
  initialProposalId?: string | null;
  onBack?: () => void;
  proposal?: Proposal;
}

interface ProposalDisplayData {
  id: string;
  code: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  contactName: string;
  projectName: string;
  date: string;
  validityDays: number;
  sellerName: string;
  sellerEmail: string;
  sellerPhone: string;
  mainProduct: string;
  products: Array<{
    name: string;
    details?: string;
    setup: number;
    monthly: number;
    discount?: number;
  }>;
  totalSetup: number;
  grossMonthly: number;
  discountPercent: number;
  discountValue: number;
  finalMonthly: number;
  contractTerm: number;
  globalValue: number;
  notes?: string;
}

const DEFAULT_COVER_BG =
  'https://st4.depositphotos.com/1025323/27146/i/450/depositphotos_271460380-stock-photo-perspectives-of-virtual-world.jpg';
const DOUBLE_OFFICIAL_COVER_BG = '/proposal-templates/double/cover.webp';

export const CommercialProposalView: React.FC<CommercialProposalViewProps> = ({
  initialProposalId,
  onBack,
  proposal: propProposal
}) => {
  const { proposals, loading } = useProposalsApi();
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(initialProposalId || null);
  const [activeTab, setActiveTab] = useState<'document' | 'presentation'>('document');
  const [coverBgType, setCoverBgType] = useState<'simulator' | 'double_official'>('simulator');
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const documentRef = useRef<HTMLDivElement>(null);

  // Sync selectedProposalId when initialProposalId changes
  useEffect(() => {
    if (initialProposalId) {
      setSelectedProposalId(initialProposalId);
    }
  }, [initialProposalId]);

  // Find active proposal
  const activeProposal =
    propProposal ||
    proposals.find(p => p.id === selectedProposalId) ||
    (proposals.length > 0 ? proposals[0] : null);

  // Editable display data state
  const [displayData, setDisplayData] = useState<ProposalDisplayData>({
    id: 'DEMO-001',
    code: 'PROP-2026-001',
    clientName: 'Cliente Exemplo S/A',
    clientEmail: 'contato@cliente.com.br',
    clientPhone: '(11) 3456-7890',
    contactName: 'Diretoria de Tecnologia',
    projectName: 'Projeto Conectividade Corporativa',
    date: new Date().toLocaleDateString('pt-BR'),
    validityDays: 15,
    sellerName: 'Comercial Double',
    sellerEmail: 'comercial@doubletelecom.com.br',
    sellerPhone: '(11) 4004-0000',
    mainProduct: 'Internet Dedicada',
    products: [
      {
        name: 'Link Dedicado Fibra Óptica 500 Mbps',
        details: 'Garantia de 100% de banda, IPv4 Fixo, SLA 99.9%',
        setup: 0,
        monthly: 2490
      },
      {
        name: 'Firewall Gerenciado & Segurança Perimetral',
        details: 'Proteção contra intrusão, VPN corporativa, filtro web',
        setup: 500,
        monthly: 890
      }
    ],
    totalSetup: 500,
    grossMonthly: 3380,
    discountPercent: 5,
    discountValue: 169,
    finalMonthly: 3211,
    contractTerm: 24,
    globalValue: 77564
  });

  // Extract real proposal data
  useEffect(() => {
    if (!activeProposal) return;

    try {
      const clientName =
        activeProposal.clientName ||
        (activeProposal as any).cliente ||
        (activeProposal as any).company?.name ||
        'Cliente Não Informado';

      const projectName =
        activeProposal.projectName ||
        activeProposal.title ||
        (activeProposal as any).descricao ||
        'Projeto Comercial Integrado';

      const code =
        activeProposal.code ||
        activeProposal.proposalNumber ||
        `PROP-${activeProposal.id?.substring(0, 8).toUpperCase() || '2026'}`;

      const dateStr = activeProposal.createdAt
        ? new Date(activeProposal.createdAt).toLocaleDateString('pt-BR')
        : new Date().toLocaleDateString('pt-BR');

      const sellerName =
        (activeProposal as any).sellerName ||
        (activeProposal as any).seller?.name ||
        (activeProposal as any).usuarioCriador ||
        'Gerente de Contas Double';

      const sellerEmail =
        (activeProposal as any).sellerEmail ||
        (activeProposal as any).seller?.email ||
        'comercial@doubletelecom.com.br';

      const sellerPhone =
        (activeProposal as any).sellerPhone ||
        (activeProposal as any).seller?.phone ||
        '(11) 4004-0000';

      const clientEmail =
        (activeProposal as any).clientEmail ||
        (activeProposal as any).company?.email ||
        '';

      const clientPhone =
        (activeProposal as any).clientPhone ||
        (activeProposal as any).company?.phone ||
        '';

      const contactName =
        (activeProposal as any).contactName ||
        (activeProposal as any).clientContact ||
        '';

      // Parse items
      const rawItems =
        activeProposal.items ||
        (activeProposal as any).produtos ||
        (activeProposal as any).servicos ||
        [];

      let parsedProducts: Array<{
        name: string;
        details?: string;
        setup: number;
        monthly: number;
        discount?: number;
      }> = [];

      if (Array.isArray(rawItems) && rawItems.length > 0) {
        parsedProducts = rawItems.map((item: any, i: number) => ({
          name: item.name || item.descricao || item.produto || `Item ${i + 1}`,
          details: item.description || item.detalhes || item.velocidade || '',
          setup: Number(item.setupFee || item.taxaInstalacao || item.setup || 0),
          monthly: Number(item.monthlyFee || item.valorMensal || item.mensalidade || item.price || 0),
          discount: Number(item.discount || item.desconto || 0)
        }));
      } else {
        const value = Number(activeProposal.totalValue || (activeProposal as any).valor || 0);
        parsedProducts = [
          {
            name: activeProposal.title || 'Serviços de Telecomunicação & TI',
            details: 'Solução sob medida de conectividade e segurança perimetral',
            setup: 0,
            monthly: value > 0 ? value : 2990
          }
        ];
      }

      const totalSetup = parsedProducts.reduce((acc, p) => acc + (p.setup || 0), 0);
      const grossMonthly = parsedProducts.reduce((acc, p) => acc + (p.monthly || 0), 0);

      const discountPercent = Number(
        (activeProposal as any).discountPercent ||
        (activeProposal as any).descontoPercentual ||
        (activeProposal as any).desconto ||
        0
      );

      const discountValue =
        discountPercent > 0
          ? (grossMonthly * discountPercent) / 100
          : Number((activeProposal as any).descontoValor || 0);

      const finalMonthly = Math.max(0, grossMonthly - discountValue);
      const contractTerm = Number(activeProposal.contractTerm || (activeProposal as any).vigencia || 24);
      const globalValue = totalSetup + finalMonthly * contractTerm;

      const mainProduct = parsedProducts[0]?.name || 'Internet Dedicada';

      setDisplayData({
        id: activeProposal.id,
        code,
        clientName,
        clientEmail,
        clientPhone,
        contactName,
        projectName,
        date: dateStr,
        validityDays: Number((activeProposal as any).validityDays || 15),
        sellerName,
        sellerEmail,
        sellerPhone,
        mainProduct,
        products: parsedProducts,
        totalSetup,
        grossMonthly,
        discountPercent,
        discountValue,
        finalMonthly,
        contractTerm,
        globalValue,
        notes: (activeProposal as any).notes || ''
      });
    } catch (err) {
      console.warn('Erro ao normalizar dados da proposta:', err);
    }
  }, [activeProposal]);

  const formatCurrency = (val: number | undefined) => {
    const num = Number(val) || 0;
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!documentRef.current || isExportingPdf) return;
    setIsExportingPdf(true);

    try {
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const jspdfModule = await import('jspdf');
      const { jsPDF } = jspdfModule;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pages = documentRef.current.querySelectorAll<HTMLElement>('.proposal-document-page');

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        if (i > 0) pdf.addPage('a4', 'portrait');

        const canvas = await html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "rgb(var(--crm-surface-rgb) / 1)",
          logging: false
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const safeClient = displayData.clientName.replace(/[^a-zA-Z0-9]/g, '_');
      pdf.save(`Proposta_Comercial_${safeClient}_${displayData.code}.pdf`);
    } catch (err) {
      console.error('Falha ao gerar PDF, acionando impressão nativa:', err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Dimensions of page for A4
  const a4PageStyle: React.CSSProperties = {
    width: '210mm',
    height: '297mm',
    margin: '0 auto',
    pageBreakAfter: 'always',
    pageBreakInside: 'avoid',
    position: 'relative'
  };

  const coverBackgroundImage =
    coverBgType === 'double_official'
      ? `url('${DOUBLE_OFFICIAL_COVER_BG}')`
      : `url('${DEFAULT_COVER_BG}')`;

  return (
    <div className="min-h-screen bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] flex flex-col">
      {/* Media print style overrides */}
      <style>{`
        @media print {
          body, html {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          nav, header, aside, .no-print {
            display: none !important;
          }
          .proposal-document-page {
            width: 210mm !important;
            height: 297mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            overflow: hidden !important;
          }
          .proposal-view-container {
            padding: 0 !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* Top Navigation & Toolbar */}
      <header className="no-print sticky top-0 z-40 bg-[rgb(var(--crm-surface-2-rgb)_/_0.95)] backdrop-blur border-b border-[var(--crm-border)] px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] transition flex items-center gap-1.5 text-sm"
              title="Voltar para a lista"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-700 dark:text-blue-400" />
              <h1 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] tracking-wide">
                Proposta Comercial • {displayData.code}
              </h1>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                Double TI + Telecom
              </span>
            </div>
            <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] truncate max-w-[280px] sm:max-w-md">
              {displayData.clientName} • {displayData.projectName}
            </p>
          </div>
        </div>

        {/* Proposta Selector (if multiple) */}
        {proposals.length > 1 && !propProposal && (
          <div className="hidden lg:flex items-center gap-2">
            <span className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">Proposta:</span>
            <div className="relative">
              <select
                value={selectedProposalId || ''}
                onChange={e => setSelectedProposalId(e.target.value)}
                className="bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] rounded-lg text-xs text-[rgb(var(--crm-ink-rgb)_/_1)] py-1.5 pl-3 pr-8 focus:ring-2 focus:ring-blue-500 appearance-none"
              >
                {proposals.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.code || p.id.substring(0, 8)} - {p.clientName || 'Cliente'}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[rgb(var(--crm-muted-rgb)_/_1)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Tab Switcher: Document A4 vs Presentation PPTX */}
        <div className="flex items-center bg-[rgb(var(--crm-surface-rgb)_/_0.8)] p-1 rounded-xl border border-[var(--crm-border)] text-xs font-medium">
          <button
            onClick={() => setActiveTab('document')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'document'
                ? 'bg-blue-600 text-white shadow-md'
                : "text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Documento A4 (2 Págs)</span>
          </button>
          <button
            onClick={() => setActiveTab('presentation')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              activeTab === 'presentation'
                ? 'bg-blue-600 text-white shadow-md'
                : "text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Apresentação Double (10 Slides)</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {activeTab === 'document' && (
            <>
              {/* Cover Background Switcher */}
              <button
                onClick={() =>
                  setCoverBgType(prev => (prev === 'simulator' ? 'double_official' : 'simulator'))
                }
                className="p-2 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] transition text-xs flex items-center gap-1.5 border border-[var(--crm-border)]"
                title={
                  coverBgType === 'simulator'
                    ? 'Alternar para Imagem Oficial Double TI'
                    : 'Alternar para Fundo Padrão Simuladores'
                }
              >
                <ImageIcon className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                <span className="hidden xl:inline">
                  {coverBgType === 'simulator' ? 'Fundo: Simuladores' : 'Fundo: Oficial Double'}
                </span>
              </button>

              {/* Zoom Controls */}
              <div className="hidden sm:flex items-center bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-lg p-0.5 border border-[var(--crm-border)]">
                <button
                  onClick={() => setZoomScale(s => Math.max(0.6, s - 0.1))}
                  className="p-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] transition"
                  title="Diminuir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] text-[rgb(var(--crm-ink-rgb)_/_1)] font-mono px-1.5">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  onClick={() => setZoomScale(s => Math.min(1.4, s + 0.1))}
                  className="p-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] transition"
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomScale(1)}
                  className="p-1.5 text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)] transition border-l border-[var(--crm-border)]"
                  title="Resetar Zoom"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </div>

              {/* Edit Drawer Trigger */}
              <button
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                className="px-3 py-1.5 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition text-xs font-semibold flex items-center gap-1.5 border border-[var(--crm-border)]"
              >
                <Edit3 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>Ajustar Dados</span>
              </button>

              {/* Native Print */}
              <button
                onClick={handlePrint}
                className="px-3 py-1.5 rounded-lg bg-[rgb(var(--crm-surface-rgb)_/_1)] hover:bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] transition text-xs font-semibold flex items-center gap-1.5 border border-[var(--crm-border)]"
                title="Imprimir ou Salvar como PDF nativo"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Imprimir</span>
              </button>

              {/* High-Res PDF Download */}
              <button
                onClick={handleDownloadPdf}
                disabled={isExportingPdf}
                className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-blue-600/30 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isExportingPdf ? 'Exportando...' : 'Baixar PDF'}</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* VIEW 1: Document A4 (Exact layout matching TemplatesPropostas.jsx and official Double assets) */}
        {activeTab === 'document' ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-start proposal-view-container">
            <div
              ref={documentRef}
              style={{
                transform: `scale(${zoomScale})`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease-out'
              }}
              className="space-y-10 my-4 text-[rgb(var(--crm-ink-rgb)_/_1)]"
            >
              {/* PAGE 1: Capa Comercial Executiva (Exatamente igual ao código de TemplatesPropostas.jsx) */}
              <div
                className="proposal-document-page bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] rounded-lg shadow-2xl overflow-hidden relative select-none"
                style={a4PageStyle}
              >
                {/* Background Image & Overlay */}
                <div
                  className="relative h-full w-full"
                  style={{
                    backgroundImage: coverBackgroundImage,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                >
                  {/* Subtle Tech Gradients and Grid */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-950/85 via-blue-900/80 to-blue-800/85" />
                  <div className="absolute inset-0 opacity-15 pointer-events-none">
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundImage: `
                          linear-gradient(rgba(59, 130, 246, 0.15) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(59, 130, 246, 0.15) 1px, transparent 1px)
                        `,
                        backgroundSize: '24px 24px'
                      }}
                    />
                  </div>

                  {/* Top Right Logo Card (Identidade Oficial Double) */}
                  <div className="absolute top-8 right-8 z-20">
                    <div className="bg-blue-50 dark:bg-blue-900 border-2 border-[var(--crm-border)] rounded-lg p-4 w-40 h-40 flex flex-col items-center justify-center overflow-hidden shadow-2xl">
                      <div className="flex items-center justify-center mb-1">
                        <div className="w-4 h-4 border-2 border-[var(--crm-border)] rounded-full mr-1" />
                        <div className="w-4 h-4 border-2 border-[var(--crm-border)] rounded-full" />
                      </div>
                      <div className="text-[rgb(var(--crm-ink-rgb)_/_1)] font-bold text-xl tracking-wider">double</div>
                      <div className="text-[rgb(var(--crm-ink-rgb)_/_1)] text-xs tracking-wider opacity-90">ti + telecom</div>
                    </div>
                  </div>

                  {/* Main Header & Client Info */}
                  <div className="p-12 text-[rgb(var(--crm-ink-rgb)_/_1)] relative z-10">
                    <div className="mb-8">
                      <h1 className="text-6xl font-bold text-blue-700 dark:text-blue-200 leading-tight drop-shadow-md">
                        Proposta<br />Comercial
                      </h1>
                    </div>

                    <div className="mb-8 space-y-1.5">
                      <div className="text-2xl font-bold tracking-tight text-[rgb(var(--crm-ink-rgb)_/_1)] drop-shadow">
                        {displayData.clientName}
                      </div>
                      <div className="text-lg opacity-90 text-blue-700 dark:text-blue-100 font-medium">
                        {displayData.date}
                      </div>
                      <div className="text-base opacity-85 text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        Projeto: <span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{displayData.projectName}</span>
                      </div>
                    </div>

                    <div className="border-t border-[var(--crm-border)] mb-8 max-w-[480px]" />

                    {/* Products Scope Badges */}
                    <div className="space-y-3.5 max-w-[480px]">
                      <div className="text-xl font-semibold mb-2 text-blue-700 dark:text-blue-100">Produto:</div>
                      {displayData.products.slice(0, 3).map((prod, idx) => (
                        <div key={idx} className="flex items-center space-x-3">
                          <div className="w-6 h-6 bg-blue-200 dark:bg-blue-950 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                            <Check className="w-4 h-4 text-blue-900 dark:text-blue-300 stroke-[3]" />
                          </div>
                          <span className="text-lg font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)] drop-shadow-sm">
                            {prod.name}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-[var(--crm-border)] mt-8 max-w-[480px]" />
                  </div>

                  {/* Central 3D Visual Card (Elemento idêntico ao modelo Simuladores anexado) */}
                  <div className="absolute bottom-40 left-1/2 transform -translate-x-1/2 z-20">
                    <div className="w-[500px] h-[375px] bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg border-2 border-[var(--crm-border)] overflow-hidden shadow-2xl">
                      <div className="h-full bg-gradient-to-b from-blue-500 to-blue-700 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-gradient-to-b from-blue-600 to-blue-800">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <React.Fragment key={index}>
                              <div
                                className="absolute top-2 w-1 h-44 bg-blue-300 opacity-80"
                                style={{ left: `${8 + index * 8}px` }}
                              />
                              <div
                                className="absolute top-2 w-1 h-44 bg-blue-300 opacity-80"
                                style={{ right: `${8 + index * 8}px` }}
                              />
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="text-center text-[rgb(var(--crm-ink-rgb)_/_1)] relative z-10 px-6">
                          <div className="text-3xl font-bold mb-2 tracking-wide drop-shadow">
                            {displayData.mainProduct}
                          </div>
                          <div className="text-base opacity-90 font-medium">
                            Infraestrutura de Alta Tecnologia
                          </div>
                          <div className="mt-4 inline-flex items-center gap-2 bg-[rgb(var(--crm-surface-rgb)_/_0.2)] backdrop-blur-sm px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase border border-[var(--crm-border)]">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Alta Disponibilidade • SLA 99.9%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Left QR Code & Visit Website */}
                  <div className="absolute bottom-8 left-8 z-20">
                    <div className="flex items-center space-x-4 bg-blue-50/60 dark:bg-blue-950/60 backdrop-blur-md p-3.5 rounded-xl border border-[var(--crm-border)] shadow-lg">
                      <div className="w-16 h-16 bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded-lg flex items-center justify-center shadow shrink-0">
                        <div className="w-12 h-12 bg-[rgb(var(--crm-surface-rgb)_/_1)] rounded grid grid-cols-8 grid-rows-8 gap-0.5 p-1">
                          {Array.from({ length: 64 }).map((_, index) => (
                            <div
                              key={index}
                              className={
                                (index + Math.floor(index / 8)) % 3 === 0
                                  ? "bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                                  : "bg-[rgb(var(--crm-surface-rgb)_/_1)]"
                              }
                            />
                          ))}
                        </div>
                      </div>
                      <div className="text-[rgb(var(--crm-ink-rgb)_/_1)]">
                        <div className="font-semibold text-lg leading-tight">Visite Nosso Site</div>
                        <div className="text-sm opacity-90 font-mono">www.doubletelecom.com.br</div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Right Document Meta */}
                  <div className="absolute bottom-8 right-8 z-20 text-right text-xs text-blue-700/90 dark:text-blue-100/90 font-mono">
                    <div>REF: {displayData.code}</div>
                    <div>Validade: {displayData.validityDays} dias</div>
                  </div>
                </div>
              </div>

              {/* PAGE 2: Detalhamento Técnico e Financeiro (Exatamente igual ao código de TemplatesPropostas.jsx) */}
              <div
                className="proposal-document-page bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] rounded-lg shadow-2xl overflow-hidden relative select-none"
                style={a4PageStyle}
              >
                <div className="p-12 h-full relative text-[rgb(var(--crm-ink-rgb)_/_1)] flex flex-col justify-between">
                  <div>
                    {/* Header */}
                    <div className="flex justify-between items-start mb-6 pb-4 border-b border-[var(--crm-border)]">
                      <div>
                        <h1 className="text-3xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Proposta Comercial</h1>
                        <p className="text-blue-600 font-semibold">{displayData.mainProduct}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">Data: {displayData.date}</div>
                        <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-mono mt-0.5">REF: {displayData.code}</div>
                      </div>
                    </div>

                    {/* Section: Dados do Cliente & Gerente de Contas */}
                    <div className="grid grid-cols-2 gap-6 mb-6">
                      <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] rounded-lg p-4">
                        <h3 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2 flex items-center gap-2">
                          <Building className="w-4 h-4 text-blue-600" />
                          Dados do Cliente
                        </h3>
                        <div className="space-y-1.5 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          <p><strong>Nome:</strong> {displayData.clientName}</p>
                          <p><strong>Projeto:</strong> {displayData.projectName}</p>
                          {displayData.clientEmail && <p><strong>Email:</strong> {displayData.clientEmail}</p>}
                          {displayData.clientPhone && <p><strong>Telefone:</strong> {displayData.clientPhone}</p>}
                          {displayData.contactName && <p><strong>Contato:</strong> {displayData.contactName}</p>}
                        </div>
                      </div>

                      <div className="bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] rounded-lg p-4">
                        <h3 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2 flex items-center gap-2">
                          <UserCheck className="w-4 h-4 text-blue-600" />
                          Gerente de Contas
                        </h3>
                        <div className="space-y-1.5 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">
                          <p><strong>Nome:</strong> {displayData.sellerName}</p>
                          <p><strong>Email:</strong> {displayData.sellerEmail}</p>
                          <p><strong>Telefone:</strong> {displayData.sellerPhone}</p>
                          <p><strong>Atendimento:</strong> Double TI + Telecom</p>
                        </div>
                      </div>
                    </div>

                    {/* Section: Produtos e Serviços */}
                    <div className="mb-6">
                      <h3 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">Produtos e Serviços</h3>
                      <table className="w-full border-collapse border border-[var(--crm-border)] text-sm">
                        <thead>
                          <tr className="bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] font-semibold">
                            <th className="border border-[var(--crm-border)] px-4 py-2.5 text-left">Descrição</th>
                            <th className="border border-[var(--crm-border)] px-4 py-2.5 text-center">Setup</th>
                            <th className="border border-[var(--crm-border)] px-4 py-2.5 text-right">Mensal</th>
                            <th className="border border-[var(--crm-border)] px-4 py-2.5 text-center">Descontos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {displayData.products.map((prod, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-[rgb(var(--crm-surface-rgb)_/_1)]" : "bg-[rgb(var(--crm-surface-rgb)_/_0.6)]"}>
                              <td className="border border-[var(--crm-border)] px-4 py-2.5 font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">
                                <div>{prod.name}</div>
                                {prod.details && (
                                  <div className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] font-normal">{prod.details}</div>
                                )}
                              </td>
                              <td className="border border-[var(--crm-border)] px-4 py-2.5 text-center text-[rgb(var(--crm-muted-rgb)_/_1)]">
                                {formatCurrency(prod.setup)}
                              </td>
                              <td className="border border-[var(--crm-border)] px-4 py-2.5 text-right font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                                {formatCurrency(prod.monthly)}
                              </td>
                              <td className="border border-[var(--crm-border)] px-4 py-2.5 text-center text-emerald-600 font-medium">
                                {displayData.discountPercent > 0 ? `${displayData.discountPercent}%` : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Section: Resumo Financeiro Detalhado */}
                    <div className="mb-6">
                      <h3 className="text-base font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mb-2">Resumo Financeiro Detalhado</h3>
                      <div className="bg-gradient-to-br from-[rgb(var(--crm-surface-rgb)_/_1)] to-[rgb(var(--crm-surface-rgb)_/_1)] border-2 border-[var(--crm-border)] rounded-lg p-4">
                        <table className="w-full">
                          <tbody>
                            <tr className="border-b-2 border-[var(--crm-border)]">
                              <td className="py-2.5 text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">Total Setup (Instalação):</td>
                              <td className="py-2.5 text-sm text-right font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                                {formatCurrency(displayData.totalSetup)}
                              </td>
                            </tr>
                            {displayData.discountValue > 0 && (
                              <tr className="border-b border-[var(--crm-border)] text-emerald-700 dark:text-emerald-300">
                                <td className="py-2 text-sm font-semibold">
                                  Desconto Concedido ({displayData.discountPercent}%):
                                </td>
                                <td className="py-2 text-sm text-right font-semibold">
                                  - {formatCurrency(displayData.discountValue)}/mês
                                </td>
                              </tr>
                            )}
                            <tr className="bg-blue-50 dark:bg-blue-950 border-b-2 border-blue-300">
                              <td className="py-2.5 text-base font-bold text-blue-900 dark:text-blue-300">Valor Mensal Final:</td>
                              <td className="py-2.5 text-base text-right font-bold text-blue-900 dark:text-blue-300">
                                {formatCurrency(displayData.finalMonthly)}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm font-medium text-[rgb(var(--crm-ink-rgb)_/_1)]">Prazo Contratual:</td>
                              <td className="py-2 text-sm text-right font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">
                                {displayData.contractTerm} meses
                              </td>
                            </tr>
                            {displayData.globalValue > 0 && (
                              <tr className="border-t border-[var(--crm-border)]">
                                <td className="py-1.5 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                                  Valor Global Estimado do Contrato:
                                </td>
                                <td className="py-1.5 text-xs text-right font-medium text-[rgb(var(--crm-muted-rgb)_/_1)]">
                                  {formatCurrency(displayData.globalValue)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Section: Condições Comerciais */}
                    <div className="mb-4 bg-[rgb(var(--crm-surface-rgb)_/_1)] border border-[var(--crm-border)] rounded-lg p-3 text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] space-y-1">
                      <p>• <strong>Validade da Proposta:</strong> {displayData.validityDays} dias a contar da emissão.</p>
                      <p>• <strong>Prazo de Ativação:</strong> Até 15 a 30 dias úteis após assinatura do contrato e validação de viabilidade técnica.</p>
                      <p>• <strong>Forma de Pagamento:</strong> Faturamento mensal via boleto bancário com vencimento no dia 10 de cada mês.</p>
                      <p>• <strong>Reajuste:</strong> Anual pela variação positiva acumulada do IPCA/IBGE ou índice oficial substituto.</p>
                    </div>

                    {/* Formal Signatures & Acceptance */}
                    <div className="mt-4 pt-4 border-t border-[var(--crm-border)] grid grid-cols-2 gap-8 text-center text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                      <div>
                        <div className="h-10 border-b border-[var(--crm-border)] mb-1" />
                        <p className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{displayData.clientName}</p>
                        <p>De Acordo / Aceite da Contratante</p>
                      </div>
                      <div>
                        <div className="h-10 border-b border-[var(--crm-border)] mb-1" />
                        <p className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Double TI + Telecom</p>
                        <p>{displayData.sellerName} - Atendimento Comercial</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="border-t border-[var(--crm-border)] pt-3 mt-4">
                    <div className="flex justify-between items-center text-xs text-[rgb(var(--crm-muted-rgb)_/_1)]">
                      <div>
                        <p className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Double TI + Telecom</p>
                        <p className="text-[rgb(var(--crm-muted-rgb)_/_1)]">www.doubletelecom.com.br</p>
                      </div>
                      <div className="text-right text-[rgb(var(--crm-muted-rgb)_/_1)]">
                        <p>Página 2 de 2</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* VIEW 2: Apresentação Corporativa (10 Slides PPTX Oficial com backgrounds webp) */
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[rgb(var(--crm-surface-2-rgb)_/_1)]">
            <CommercialProposalPresentationView />
          </div>
        )}

        {/* Sidebar Drawer: Quick Data Adjustments */}
        {isDrawerOpen && activeTab === 'document' && (
          <aside className="no-print w-80 bg-[rgb(var(--crm-surface-rgb)_/_1)] border-l border-[var(--crm-border)] p-5 overflow-y-auto z-30 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--crm-border)] pb-3">
              <h3 className="text-sm font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                Ajustar Dados da Proposta
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"
              >
                ✕ Fechar
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Nome do Cliente</label>
                <input
                  type="text"
                  value={displayData.clientName}
                  onChange={e => setDisplayData(d => ({ ...d, clientName: e.target.value }))}
                  className="w-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded p-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                />
              </div>

              <div>
                <label className="block text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Nome do Projeto</label>
                <input
                  type="text"
                  value={displayData.projectName}
                  onChange={e => setDisplayData(d => ({ ...d, projectName: e.target.value }))}
                  className="w-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded p-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                />
              </div>

              <div>
                <label className="block text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Produto Principal</label>
                <input
                  type="text"
                  value={displayData.mainProduct}
                  onChange={e => setDisplayData(d => ({ ...d, mainProduct: e.target.value }))}
                  className="w-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded p-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                />
              </div>

              <div>
                <label className="block text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Gerente de Contas</label>
                <input
                  type="text"
                  value={displayData.sellerName}
                  onChange={e => setDisplayData(d => ({ ...d, sellerName: e.target.value }))}
                  className="w-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded p-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                />
              </div>

              <div>
                <label className="block text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">E-mail do Vendedor</label>
                <input
                  type="text"
                  value={displayData.sellerEmail}
                  onChange={e => setDisplayData(d => ({ ...d, sellerEmail: e.target.value }))}
                  className="w-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded p-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                />
              </div>

              <div>
                <label className="block text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Prazo Contratual (Meses)</label>
                <input
                  type="number"
                  value={displayData.contractTerm}
                  onChange={e => {
                    const term = Number(e.target.value) || 12;
                    setDisplayData(d => ({
                      ...d,
                      contractTerm: term,
                      globalValue: d.totalSetup + d.finalMonthly * term
                    }));
                  }}
                  className="w-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded p-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                />
              </div>

              <div>
                <label className="block text-[rgb(var(--crm-ink-rgb)_/_1)] mb-1">Desconto (%)</label>
                <input
                  type="number"
                  value={displayData.discountPercent}
                  onChange={e => {
                    const pct = Number(e.target.value) || 0;
                    const discVal = (displayData.grossMonthly * pct) / 100;
                    const finalM = Math.max(0, displayData.grossMonthly - discVal);
                    setDisplayData(d => ({
                      ...d,
                      discountPercent: pct,
                      discountValue: discVal,
                      finalMonthly: finalM,
                      globalValue: d.totalSetup + finalM * d.contractTerm
                    }));
                  }}
                  className="w-full bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] rounded p-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"
                />
              </div>

              <div className="pt-2 border-t border-[var(--crm-border)]">
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded text-xs transition"
                >
                  Aplicar e Fechar
                </button>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
};

export default CommercialProposalView;
