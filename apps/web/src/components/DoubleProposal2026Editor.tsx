import React, { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  Plus,
  Printer,
  Save,
  Trash2,
} from 'lucide-react';

export interface DoubleProposalItem {
  id: string;
  item: string;
  descricao: string;
  qtd: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface DoubleProposal2026Data {
  ano: string;
  solucaoTitulo: string;
  clienteNome: string;
  gerenteNome: string;
  gerenteCargo: string;
  gerenteTelefone: string;
  localEmissao: string;
  dataEmissaoExtenso: string;
  validadeDias: string;
  prazoEntregaDias: string;
  objetoProposta: string;
  descritivoProduto: string;
  itens: DoubleProposalItem[];
  premissas: string;
  faturamentoPagamento: string;
  conclusaoTexto: string;
}

interface DoubleProposal2026EditorProps {
  initialEntry?: any;
  onSave: (data: DoubleProposal2026Data, proposalId?: string) => string;
  onSwitchLegacy?: () => void;
}

const formatBRL = (v: number) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatDataExtenso = (date = new Date()) =>
  date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const buildInitialData = (entry?: any): DoubleProposal2026Data => {
  const saved = entry?.draft?.double2026;
  if (saved) return saved;

  const cover = entry?.draft?.cover || {};
  const invRows = Array.isArray(entry?.draft?.investment?.rows)
    ? entry.draft.investment.rows
    : [];

  const itens: DoubleProposalItem[] =
    invRows.length > 0
      ? invRows.map((r: any, idx: number) => {
          const numVal = Number(
            String(r.monthly || '0')
              .replace(/[^\d,.-]/g, '')
              .replace(/\./g, '')
              .replace(',', '.')
          ) || 0;
          return {
            id: `item-${idx + 1}`,
            item: r.service || `Item ${idx + 1}`,
            descricao: r.description || '',
            qtd: 1,
            valorUnitario: numVal,
            valorTotal: numVal,
          };
        })
      : [
          {
            id: 'item-1',
            item: cover.product || 'Solução de Infraestrutura / TI + Telecom',
            descricao: 'Fornecimento, configuração e suporte conforme especificações.',
            qtd: 1,
            valorUnitario: 0,
            valorTotal: 0,
          },
        ];

  return {
    ano: String(new Date().getFullYear()),
    solucaoTitulo: cover.product || 'Solução',
    clienteNome: cover.clientName || 'Nome do Cliente',
    gerenteNome: 'Carlos Horst',
    gerenteCargo: 'Contas Corporativas',
    gerenteTelefone: '+55 41 99142 9522',
    localEmissao: 'Curitiba',
    dataEmissaoExtenso: formatDataExtenso(),
    validadeDias: '60',
    prazoEntregaDias: '30',
    objetoProposta:
      cover.product && cover.product !== 'Produto/servico'
        ? `Fornecimento de ${cover.product}, contemplando equipamentos, serviços e suporte técnico especializado conforme especificações desta proposta.`
        : 'Fornecimento de solução tecnológica integrada de TI e Telecomunicações, conforme especificações descritas neste documento.',
    descritivoProduto:
      itens
        .map((it) => `• ${it.item}${it.descricao ? `: ${it.descricao}` : ''}`)
        .join('\n') || 'Especificações técnicas detalhadas da solução proposta.',
    itens,
    premissas:
      '• A contratante deverá disponibilizar infraestrutura elétrica, climatização e acessos físicos/lógicos necessários à implantação.\n• Eventuais serviços fora do escopo descrito serão objeto de aditivo ou orçamento complementar.',
    faturamentoPagamento: 'Entrada / 30 / 60 DDL',
    conclusaoTexto:
      'Esta proposta foi elaborada com o objetivo de fornecer informações detalhadas para a tomada de preços. Nossa solução oferece alta capacidade e performance garantindo qualidade, eficiência e conformidade com os requisitos do projeto.\n\nEstamos à disposição para esclarecer quaisquer dúvidas e ajustar os detalhes conforme necessário, visando atender plenamente às expectativas e exigências do processo. Com isso, esperamos contribuir para uma decisão bem fundamentada e transparente.\n\nAguardamos o próximo passo e nos colocamos à disposição para eventuais discussões e ajustes. Será um prazer colaborar neste processo e garantir uma solução que atenda às suas necessidades.',
  };
};

const escHtml = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export const DoubleProposal2026Editor: React.FC<DoubleProposal2026EditorProps> = ({
  initialEntry,
  onSave,
  onSwitchLegacy,
}) => {
  const [data, setData] = useState<DoubleProposal2026Data>(() =>
    buildInitialData(initialEntry)
  );
  const [proposalId, setProposalId] = useState<string | undefined>(initialEntry?.id);
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'edit'>('split');
  const [savedNotice, setSavedNotice] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const totalGeral = useMemo(
    () => data.itens.reduce((acc, it) => acc + Number(it.valorTotal || 0), 0),
    [data.itens]
  );

  const updateField = <K extends keyof DoubleProposal2026Data>(
    key: K,
    value: DoubleProposal2026Data[K]
  ) => {
    setData((prev) => ({ ...prev, [key]: value }));
  };

  const updateItem = (
    id: string,
    field: keyof DoubleProposalItem,
    value: string | number
  ) => {
    setData((prev) => ({
      ...prev,
      itens: prev.itens.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, [field]: value };
        if (field === 'qtd' || field === 'valorUnitario') {
          next.valorTotal = Number(next.qtd || 0) * Number(next.valorUnitario || 0);
        }
        return next;
      }),
    }));
  };

  const addItem = () => {
    setData((prev) => ({
      ...prev,
      itens: [
        ...prev.itens,
        {
          id: `item-${Date.now()}`,
          item: 'Novo Item / Serviço',
          descricao: '',
          qtd: 1,
          valorUnitario: 0,
          valorTotal: 0,
        },
      ],
    }));
  };

  const removeItem = (id: string) => {
    setData((prev) => ({
      ...prev,
      itens: prev.itens.filter((it) => it.id !== id),
    }));
  };

  const handleSave = () => {
    const id = onSave(data, proposalId);
    setProposalId(id);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  const htmlDocument = useMemo(() => {
    const internalHeader = `<div class="page-header"><img src="${origin}/proposal-templates/double-2026/image5.png" alt="Double TI + Telecom" /></div>`;
    const internalFooter = `<div class="page-footer"><img src="${origin}/proposal-templates/double-2026/image6.png" alt="Contato Double TI + Telecom" /></div>`;

    const itensRows = data.itens
      .map(
        (it, idx) => `
      <tr>
        <td style="text-align:center;">${idx + 1}</td>
        <td><strong>${escHtml(it.item)}</strong>${
          it.descricao
            ? `<div style="font-size:10px;color:#475569;margin-top:2px;">${escHtml(it.descricao)}</div>`
            : ''
        }</td>
        <td style="text-align:center;">${it.qtd}</td>
        <td style="text-align:right;">${formatBRL(it.valorUnitario)}</td>
        <td style="text-align:right;font-weight:700;">${formatBRL(it.valorTotal)}</td>
      </tr>`
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Proposta Comercial - ${escHtml(data.clienteNome)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
      color: #1e293b;
      background: #e2e8f0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto 12px auto;
      background: #ffffff;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; break-after: auto; }
    @media print {
      body { background: #fff; }
      .page { margin: 0; box-shadow: none; }
    }
    .page-header img, .page-footer img {
      width: 100%;
      display: block;
    }
    .page-body {
      padding: 14mm 18mm;
      flex: 1;
    }
    /* Capa */
    .cover-page {
      padding: 16mm 18mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 297mm;
    }
    .cover-year {
      font-size: 56px;
      font-weight: 900;
      letter-spacing: -2px;
      color: #4A6482;
      line-height: 1;
    }
    .cover-year span { color: #7AB3CC; }
    .cover-logo {
      max-width: 310px;
      margin: 14px 0 18px 0;
    }
    .cover-hero {
      width: 100%;
      height: 105mm;
      object-fit: cover;
      border-radius: 10px;
      box-shadow: 0 10px 25px rgba(15, 23, 42, 0.18);
    }
    .cover-title-box {
      margin-top: 18px;
      border-left: 6px solid #7AB3CC;
      padding-left: 16px;
    }
    .cover-title {
      font-size: 32px;
      font-weight: 800;
      color: #4A6482;
      margin: 0;
    }
    .cover-subtitle {
      font-size: 20px;
      font-weight: 600;
      color: #7AB3CC;
      margin: 4px 0 0 0;
    }
    .cover-company {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 2px solid #4A6482;
      font-size: 11px;
      color: #334155;
      line-height: 1.5;
      font-weight: 600;
    }
    h1.chapter {
      font-size: 20px;
      font-weight: 800;
      color: #4A6482;
      border-bottom: 2px solid #7AB3CC;
      padding-bottom: 6px;
      margin: 0 0 14px 0;
    }
    h2.sub {
      font-size: 14px;
      font-weight: 700;
      color: #4A6482;
      margin: 14px 0 6px 0;
    }
    p, .prose {
      font-size: 11.5px;
      line-height: 1.6;
      color: #334155;
      white-space: pre-line;
      margin: 0 0 10px 0;
    }
    .toc-row {
      display: flex;
      justify-content: space-between;
      border-bottom: 1px dotted #cbd5e1;
      padding: 4px 0;
      font-size: 11.5px;
    }
    .toc-main { font-weight: 700; color: #4A6482; margin-top: 6px; }
    .toc-sub { padding-left: 16px; color: #475569; }
    .pillars-img {
      width: 100%;
      margin-top: 16px;
      border-radius: 8px;
    }
    table.items-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 11px;
    }
    table.items-table th {
      background: #4A6482;
      color: #ffffff;
      padding: 8px;
      text-align: left;
      font-weight: 700;
    }
    table.items-table td {
      padding: 8px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    table.items-table tfoot td {
      background: #f1f5f9;
      font-weight: 800;
      color: #4A6482;
      border-top: 2px solid #4A6482;
    }
    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 28px;
      font-size: 11px;
    }
    .meta-table td {
      border: 1px solid #cbd5e1;
      padding: 10px 12px;
      width: 33.33%;
      vertical-align: top;
    }
    .meta-label {
      font-size: 9.5px;
      font-weight: 800;
      color: #4A6482;
      text-transform: uppercase;
      display: block;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <!-- PÁGINA 1: CAPA -->
  <div class="page cover-page">
    <div>
      <div class="cover-year">${escHtml(data.ano.slice(0, 2))}<span>${escHtml(data.ano.slice(2))}</span></div>
      <img class="cover-logo" src="${origin}/proposal-templates/double-2026/image1.png" alt="Double TI + Telecom" />
      <img class="cover-hero" src="${origin}/proposal-templates/double-2026/image2.jpg" alt="Infraestrutura Datacenter" />
      <div class="cover-title-box">
        <h1 class="cover-title">Proposta Comercial</h1>
        <p class="cover-subtitle">${escHtml(data.solucaoTitulo)}</p>
      </div>
    </div>
    <div class="cover-company">
      DOUBLE T.I &amp; TELECOM LTDA<br/>
      CNPJ: 53.745.191/0001-87 &nbsp;|&nbsp; RUA: FRANCISCO NEGRÃO, 175 &nbsp;|&nbsp; CEP.: 80.620-390 &nbsp;|&nbsp; CURITIBA - PR
    </div>
  </div>

  <!-- PÁGINA 2: INFORMAÇÕES DO DOCUMENTO -->
  <div class="page">
    ${internalHeader}
    <div class="page-body">
      <h1 class="chapter">Informações do Documento</h1>
      <p><strong>À ${escHtml(data.clienteNome)}.</strong></p>
      <p>Prezado,</p>
      <p>Conforme solicitação, segue proposta para fornecimento de <strong>${escHtml(data.solucaoTitulo)}</strong>.</p>
      <p>A Double TI + Telecom agradece a confiança e a oportunidade de participação no presente projeto, reafirmando nosso compromisso com a busca incessante das melhores soluções para nossos clientes baseada nos mais altos padrões de qualidade, inovação e transparência.</p>
      <p>Colocamo-nos à sua disposição para quaisquer informações e/ou esclarecimentos adicionais.</p>
      <p style="margin-top:22px;">
        Atenciosamente,<br/>
        <strong>${escHtml(data.gerenteNome)}</strong><br/>
        ${escHtml(data.gerenteCargo)}<br/>
        Office: ${escHtml(data.gerenteTelefone)}
      </p>
    </div>
    ${internalFooter}
  </div>

  <!-- PÁGINA 3: ÍNDICE -->
  <div class="page">
    ${internalHeader}
    <div class="page-body">
      <h1 class="chapter">Índice</h1>
      <div class="toc-row toc-main"><span>Capítulo 1 - Apresentação</span><span>4</span></div>
      <div class="toc-row toc-sub"><span>1.1 - Double TI + Telecom: A próxima tecnologia ao seu alcance</span><span>4</span></div>
      <div class="toc-row toc-main"><span>Capítulo 2 - Objeto</span><span>5</span></div>
      <div class="toc-row toc-sub"><span>2.1 - Objeto da proposta</span><span>5</span></div>
      <div class="toc-row toc-sub"><span>2.2 - Especificações do produto</span><span>5</span></div>
      <div class="toc-row toc-main"><span>Capítulo 3 - Valor</span><span>5</span></div>
      <div class="toc-row toc-sub"><span>3.1 - Valor do produto</span><span>5</span></div>
      <div class="toc-row toc-sub"><span>3.2 - Condições Gerais de Fornecimento</span><span>6</span></div>
      <div class="toc-row toc-sub"><span>3.3 - Premissas</span><span>6</span></div>
      <div class="toc-row toc-sub"><span>3.4 - Faturamento e Pagamento</span><span>6</span></div>
      <div class="toc-row toc-sub"><span>3.5 - Conclusão</span><span>7</span></div>
    </div>
    ${internalFooter}
  </div>

  <!-- PÁGINA 3: APRESENTAÇÃO -->
  <div class="page">
    ${internalHeader}
    <div class="page-body">
      <h1 class="chapter">Apresentação</h1>
      <h2 class="sub">Double TI + Telecom: A próxima tecnologia ao seu alcance</h2>
      <p>Com 28 anos de história no mercado de TI e Telecom, a Double TI + Telecom se destaca pela experiência consolidada de sua equipe e pela confiança conquistada junto aos clientes. Nossa jornada é guiada pela tradição que nos conecta às nossas raízes e pela inovação, que nos impulsiona a evoluir continuamente, sempre mirando um futuro promissor e cheio de oportunidades.</p>
      <p>Nossa atuação é baseada em três pilares essenciais:</p>
      <img class="pillars-img" src="${origin}/proposal-templates/double-2026/image3.png" alt="Por que optar pela Double TI + Telecom?" />
    </div>
    ${internalFooter}
  </div>

  <!-- PÁGINA 4: OBJETO E VALOR -->
  <div class="page">
    ${internalHeader}
    <div class="page-body">
      <h1 class="chapter">Objeto</h1>
      <h2 class="sub">Objeto da proposta</h2>
      <div class="prose">${escHtml(data.objetoProposta)}</div>

      <h2 class="sub">Descritivo do Produto</h2>
      <div class="prose">${escHtml(data.descritivoProduto)}</div>

      <h1 class="chapter" style="margin-top:20px;">Valor</h1>
      <h2 class="sub">Valor do produto</h2>
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:36px;text-align:center;">Item</th>
            <th>Solução / Descrição</th>
            <th style="width:48px;text-align:center;">Qtd</th>
            <th style="width:105px;text-align:right;">Valor Unit.</th>
            <th style="width:110px;text-align:right;">Valor Total</th>
          </tr>
        </thead>
        <tbody>
          ${itensRows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4" style="text-align:right;">TOTAL DA PROPOSTA:</td>
            <td style="text-align:right;">${formatBRL(totalGeral)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
    ${internalFooter}
  </div>

  <!-- PÁGINA 5: CONDIÇÕES GERAIS, PREMISSAS E FATURAMENTO -->
  <div class="page">
    ${internalHeader}
    <div class="page-body">
      <h1 class="chapter">Condições Gerais de Fornecimento</h1>
      <p>
        <strong>Validade da Proposta:</strong> ${escHtml(data.validadeDias)} dias<br/>
        <strong>Prazo de entrega:</strong> ${escHtml(data.prazoEntregaDias)} dias<br/>
        Todos os impostos vigentes nesta data estão inclusos.
      </p>

      <h1 class="chapter" style="margin-top:22px;">Premissas</h1>
      <div class="prose">${escHtml(data.premissas)}</div>

      <h1 class="chapter" style="margin-top:22px;">Faturamento e Pagamento</h1>
      <div class="prose">${escHtml(data.faturamentoPagamento)}</div>
    </div>
    ${internalFooter}
  </div>

  <!-- PÁGINA 6: CONCLUSÃO -->
  <div class="page">
    ${internalHeader}
    <div class="page-body">
      <h1 class="chapter">Conclusão</h1>
      <p><strong>À ${escHtml(data.clienteNome)}</strong></p>
      <div class="prose">${escHtml(data.conclusaoTexto)}</div>

      <table class="meta-table">
        <tr>
          <td>
            <span class="meta-label">LOCAL/DATA DE EMISSÃO</span>
            ${escHtml(data.localEmissao)}, ${escHtml(data.dataEmissaoExtenso)}.
          </td>
          <td>
            <span class="meta-label">VALIDADE DA PROPOSTA</span>
            ${escHtml(data.validadeDias)} dias da Emissão.
          </td>
          <td>
            <span class="meta-label">Gerente de Contas</span>
            ${escHtml(data.gerenteNome)}
          </td>
        </tr>
      </table>
    </div>
    ${internalFooter}
  </div>
</body>
</html>`;
  }, [data, origin, totalGeral]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.focus();
      iframeRef.current.contentWindow.print();
    }
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Proposta_Double_${data.clienteNome.replace(/[^a-zA-Z0-9_-]/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Barra de Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[rgb(var(--crm-surface-rgb)_/_0.8)] border border-[var(--crm-border)] rounded-xl p-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              viewMode === 'split'
                ? 'bg-cyan-600 text-white'
                : 'bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)]'
            }`}
          >
            Lado a Lado
          </button>
          <button
            type="button"
            onClick={() => setViewMode('edit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              viewMode === 'edit'
                ? 'bg-cyan-600 text-white'
                : 'bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)]'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            type="button"
            onClick={() => setViewMode('preview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
              viewMode === 'preview'
                ? 'bg-cyan-600 text-white'
                : 'bg-[rgb(var(--crm-surface-2-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)] border border-[var(--crm-border)]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Visualizar A4
          </button>
          {onSwitchLegacy && (
            <button
              type="button"
              onClick={onSwitchLegacy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-white border border-[var(--crm-border)]"
            >
              Editor PPTX Clássico
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {savedNotice && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-4 h-4" /> Proposta salva!
            </span>
          )}
          <button
            type="button"
            onClick={handleSave}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> Salvar Proposta
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" /> Imprimir / Salvar PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadHtml}
            className="px-3 py-1.5 rounded-lg bg-[rgb(var(--crm-surface-2-rgb)_/_1)] border border-[var(--crm-border)] text-xs font-medium flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Baixar HTML
          </button>
        </div>
      </div>

      {/* Área principal */}
      <div
        className={`grid gap-5 ${
          viewMode === 'split' ? 'grid-cols-1 xl:grid-cols-12' : 'grid-cols-1'
        }`}
      >
        {/* Formulário */}
        {viewMode !== 'preview' && (
          <div
            className={`${
              viewMode === 'split' ? 'xl:col-span-5' : ''
            } space-y-4 bg-[rgb(var(--crm-surface-rgb)_/_0.75)] border border-[var(--crm-border)] rounded-xl p-5 max-h-[82vh] overflow-y-auto`}
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
              Dados da Proposta (Modelo Double 2026)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                  Ano da Capa
                </label>
                <input
                  className="crm-input text-xs"
                  value={data.ano}
                  onChange={(e) => updateField('ano', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                  Nome da Solução
                </label>
                <input
                  className="crm-input text-xs"
                  value={data.solucaoTitulo}
                  onChange={(e) => updateField('solucaoTitulo', e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                  Nome do Cliente (À ...)
                </label>
                <input
                  className="crm-input text-xs"
                  value={data.clienteNome}
                  onChange={(e) => updateField('clienteNome', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                  Gerente de Contas
                </label>
                <input
                  className="crm-input text-xs"
                  value={data.gerenteNome}
                  onChange={(e) => updateField('gerenteNome', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                  Cargo / Telefone
                </label>
                <input
                  className="crm-input text-xs"
                  value={data.gerenteTelefone}
                  onChange={(e) => updateField('gerenteTelefone', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                  Validade (dias)
                </label>
                <input
                  className="crm-input text-xs"
                  value={data.validadeDias}
                  onChange={(e) => updateField('validadeDias', e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                  Prazo de Entrega (dias)
                </label>
                <input
                  className="crm-input text-xs"
                  value={data.prazoEntregaDias}
                  onChange={(e) => updateField('prazoEntregaDias', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                Capítulo 2.1 — Objeto da Proposta
              </label>
              <textarea
                rows={3}
                className="crm-input text-xs"
                value={data.objetoProposta}
                onChange={(e) => updateField('objetoProposta', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                Capítulo 2.2 — Descritivo / Especificações do Produto
              </label>
              <textarea
                rows={4}
                className="crm-input text-xs"
                value={data.descritivoProduto}
                onChange={(e) => updateField('descritivoProduto', e.target.value)}
              />
            </div>

            {/* Itens / Valor */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] uppercase">
                  Capítulo 3.1 — Itens e Valores ({formatBRL(totalGeral)})
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="px-2.5 py-1 rounded bg-cyan-600 text-white text-[11px] font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Item
                </button>
              </div>
              {data.itens.map((it) => (
                <div
                  key={it.id}
                  className="p-2.5 rounded-lg border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.7)] space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      className="crm-input text-xs flex-1"
                      placeholder="Nome do item/solução"
                      value={it.item}
                      onChange={(e) => updateItem(it.id, 'item', e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(it.id)}
                      className="p-1.5 text-rose-400 hover:text-rose-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    className="crm-input text-xs"
                    placeholder="Descrição técnica"
                    value={it.descricao}
                    onChange={(e) => updateItem(it.id, 'descricao', e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <input
                      type="number"
                      className="crm-input text-xs"
                      placeholder="Qtd"
                      value={it.qtd}
                      onChange={(e) => updateItem(it.id, 'qtd', Number(e.target.value))}
                    />
                    <input
                      type="number"
                      step="0.01"
                      className="crm-input text-xs"
                      placeholder="Valor Unit."
                      value={it.valorUnitario}
                      onChange={(e) =>
                        updateItem(it.id, 'valorUnitario', Number(e.target.value))
                      }
                    />
                    <div className="crm-input text-xs flex items-center justify-end font-semibold text-emerald-400">
                      {formatBRL(it.valorTotal)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                Capítulo 3.3 — Premissas
              </label>
              <textarea
                rows={3}
                className="crm-input text-xs"
                value={data.premissas}
                onChange={(e) => updateField('premissas', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                Capítulo 3.4 — Faturamento e Pagamento
              </label>
              <input
                className="crm-input text-xs"
                value={data.faturamentoPagamento}
                onChange={(e) => updateField('faturamentoPagamento', e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[rgb(var(--crm-muted-rgb)_/_1)] mb-1">
                Capítulo 3.5 — Conclusão
              </label>
              <textarea
                rows={4}
                className="crm-input text-xs"
                value={data.conclusaoTexto}
                onChange={(e) => updateField('conclusaoTexto', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Preview A4 */}
        {viewMode !== 'edit' && (
          <div
            className={`${
              viewMode === 'split' ? 'xl:col-span-7' : ''
            } rounded-xl border border-[var(--crm-border)] bg-slate-800 overflow-hidden h-[82vh]`}
          >
            <iframe
              ref={iframeRef}
              title="Preview Proposta Double 2026"
              srcDoc={htmlDocument}
              className="w-full h-full border-0"
            />
          </div>
        )}
      </div>
    </div>
  );
};
