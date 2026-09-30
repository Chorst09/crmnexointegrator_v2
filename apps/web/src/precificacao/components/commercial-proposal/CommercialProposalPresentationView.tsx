
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Download, Eye, Loader2, Pencil, RefreshCw, Save, Trash2, FileText, CheckCircle2, Printer } from 'lucide-react';
import { createDefaultProposalPptx } from './defaultProposalTemplate';

type SlideShape = {
  id: string;
  name: string;
  label: string;
  helperText?: string;
  text: string;
};

type CoverFieldsState = {
  clientName: { value: string };
  date: { value: string };
  product: { value: string };
};

type ContractFields = {
  vigencia: string;
  prazo: string;
  termos: string;
};

type InvestmentRow = {
  service: string;
  description: string;
  monthly: string;
  contract: string;
};

type InvestmentDraft = {
  rows: InvestmentRow[];
  installationFee: string;
};

type SavedDraft = {
  savedAt: string;
  proposalNumber?: string;
  opportunityId?: string;
  cover: {
    clientName: string;
    date: string;
    product: string;
  };
  slides: Record<string, Record<string, string>>;
  contract?: ContractFields;
  investment?: InvestmentDraft;
};

type SavedProposalEntry = {
  id: string;
  title: string;
  proposalNumber?: string;
  opportunityId?: string;
  clientType?: string;
  savedAt: string;
  draft: SavedDraft;
};

type CommercialProposalPresentationViewProps = {
  initialProposalId?: string | null;
  initialMode?: 'latest' | 'blank';
  initialSlide?: number;
  onSaved?: () => void;
  onNewProposal?: () => void;
};

type ShapeMeta = {
  label: string;
  helperText?: string;
};

type ParsedInvestmentTable = {
  rows: InvestmentRow[];
  totalMonthly: string;
  totalContract: string;
  installationFee: string;
};

type SlideSize = {
  cx: number;
  cy: number;
};

type PreviewTextShape = {
  id: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  text: string;
  align: 'l' | 'ctr' | 'r' | 'just';
  verticalAlign: 't' | 'ctr' | 'b';
  fontSizePt: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
};

type PreviewPictureShape = {
  id: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  src: string;
  cropLeft: number;
  cropRight: number;
  cropTop: number;
  cropBottom: number;
};

type PreviewTableCell = {
  text: string;
  align: 'l' | 'ctr' | 'r' | 'just';
  fontSizePt: number;
  bold: boolean;
  color: string;
  backgroundColor: string | null;
  fontFamily: string;
  gridSpan: number;
  hMerge: boolean;
  borderColor: string | null;
};

type PreviewTableRow = {
  height: number;
  cells: PreviewTableCell[];
};

type PreviewTableShape = {
  id: string;
  x: number;
  y: number;
  cx: number;
  cy: number;
  columnWidths: number[];
  rows: PreviewTableRow[];
};

type SlidePreviewLayout = {
  slideNumber: number;
  backgroundSrc: string | null;
  textShapes: PreviewTextShape[];
  pictures: PreviewPictureShape[];
  tables: PreviewTableShape[];
};

type PremissasParagraphTemplate = {
  level: number;
  autoNumType: 'romanUcPeriod' | 'alphaUcPeriod' | 'arabicPeriod' | null;
  bold: boolean;
  marginLeft: number;
  indent: number;
  align: 'l' | 'ctr' | 'r' | 'just';
};

type PremissasRenderedParagraph = {
  level: number;
  prefix: string;
  text: string;
  bold: boolean;
  markerStart: number;
  markerWidth: number;
  textStart: number;
  align: 'l' | 'ctr' | 'r' | 'just';
};

const PPTX_URL = '/proposta-comercial-double.pptx';
const STORAGE_KEY = 'proposta-comercial-double-draft-v4';
const STORAGE_LIST_KEY = 'proposta-comercial-double-drafts-v1';
const EDITABLE_SLIDES = [3, 4, 5, 6, 7, 8] as const;
const TOTAL_SLIDES = 10;
const DEFAULT_SLIDE_SIZE: SlideSize = { cx: 7559675, cy: 10691800 };

const SLIDE_TITLES: Record<number, string> = {
  1: 'Slide 1 - Capa (Comercial)',
  2: 'Slide 2 - Quem Somos (+30 Anos, +500 Clientes, +5.000 Projetos)',
  3: 'Slide 3 - Nossos Clientes e Parceiros',
  4: 'Slide 4 - Descritivo do Produto',
  5: 'Slide 5 - Escopo Técnico',
  6: 'Slide 6 - Premissas',
  7: 'Slide 7 - Investimento',
  8: 'Slide 8 - Informações para Contratação',
  9: 'Slide 9 - Segurança da Informação e LGPD',
  10: 'Slide 10 - Encerramento / Contracapa'
};

const DEFAULT_CONTRACT_FIELDS: ContractFields = {
  vigencia: '60meses',
  prazo: '30dias',
  termos: '30/60'
};

const DEFAULT_INVESTMENT_ROWS: InvestmentRow[] = [
  {
    service: 'Internet 100Mbps rádio',
    description: 'Link de internet dedicada via rádio',
    monthly: 'R$500,00',
    contract: 'R$500,00'
  },
  {
    service: 'Rede MAN 50Mbps',
    description: 'Link L2L MAN via rádio',
    monthly: 'R$1000,00',
    contract: 'R$500,00'
  },
  {
    service: 'Link Double 100Mbps',
    description: 'Link internet redundante Rádio + Fibra Óptica',
    monthly: 'R$2000,00',
    contract: 'R$500,00'
  }
];

const DEFAULT_INSTALLATION_FEE = 'R$1500,00';
const DEFAULT_TOTAL_MONTHLY = 'R$3500,00';
const DEFAULT_TOTAL_CONTRACT = 'R$1500,00';
const PREVIEW_FONT_STACK = '"Poppins", "Segoe UI", Arial, sans-serif';

const EDITABLE_SHAPE_IDS: Record<number, string[] | 'ALL'> = {
  3: ['41'],
  4: ['97', '102'],
  5: ['107'],
  6: ['121'],
  7: ['127', '130'],
  8: 'ALL'
};

const SHAPE_LAYOUT_OVERRIDES: Record<number, Record<string, Partial<Pick<PreviewTextShape, 'x' | 'y' | 'cx' | 'cy'>>>> = {};

const SHAPE_META: Record<number, Record<string, ShapeMeta>> = {
  3: {
    '41': {
      label: 'Texto Institucional - Nossos Clientes (Print 1)',
      helperText: 'Texto descritivo exibido acima dos logos dos clientes atendidos.'
    }
  },
  4: {
    '97': {
      label: 'Descritivo do produto',
      helperText: 'Campo principal para preenchimento do descritivo.'
    },
    '102': {
      label: 'Caracteristicas',
      helperText: 'Campo para preencher o bloco de caracteristicas.'
    }
  },
  5: {
    '107': {
      label: 'Escopo do Projeto',
      helperText: 'Preencha apenas o escopo tecnico. Diferenciais permanecem padrao.'
    }
  },
  6: {
    '121': {
      label: 'Premissas (editavel)',
      helperText: 'O texto carrega padrao e pode ser alterado.'
    }
  },
  7: {
    '127': {
      label: 'Valor do Projeto'
    },
    '130': {
      label: 'Vigencia, Prazo e Termos'
    }
  },
  8: {
    '137': {
      label: 'Pessoa juridica / Contatos / Vencimento'
    },
    '138': {
      label: 'Texto final de contratacao'
    },
    '139': {
      label: 'Subtitulo: Documentacao'
    },
    '140': {
      label: 'Subtitulo: Termo de Contratacao'
    }
  }
};

const decodeXmlEntities = (value: string): string =>
  value
    .replace(/&#10;|&#xA;/g, '\n')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

const encodeXmlEntities = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\n/g, '&#10;');

const getTagAttribute = (tag: string, attribute: string): string | null => {
  const match = tag.match(new RegExp(`${attribute}="([^"]*)"`));
  return match?.[1] ?? null;
};

const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const extractTextFromSegment = (segment: string): string => {
  const textMatches = Array.from(segment.matchAll(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/g));
  return textMatches.map(match => decodeXmlEntities(match[1])).join('');
};

const extractShapeText = (shapeBlock: string): string => {
  const paragraphMatches = shapeBlock.match(/<a:p\b[\s\S]*?<\/a:p>/g);
  if (!paragraphMatches?.length) {
    return extractTextFromSegment(shapeBlock).trim();
  }

  return paragraphMatches
    .map(paragraph => extractTextFromSegment(paragraph))
    .join('\n')
    .trim();
};

const parseSlideShapes = (xml: string, slideNumber: number): SlideShape[] => {
  const shapes = xml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) ?? [];

  return shapes
    .map((shapeBlock, index): SlideShape | null => {
      const cNvPrTag = shapeBlock.match(/<p:cNvPr\b[^>]*>/)?.[0];
      if (!cNvPrTag) return null;

      const id = getTagAttribute(cNvPrTag, 'id') ?? `shape-${index}`;
      const name = getTagAttribute(cNvPrTag, 'name') ?? `Texto ${index + 1}`;
      const text = extractShapeText(shapeBlock);
      if (!text) return null;

      const meta = SHAPE_META[slideNumber]?.[id];
      const fallbackLabel = text.split('\n')[0].slice(0, 90) || name;

      const parsed: SlideShape = {
        id,
        name,
        label: meta?.label ?? fallbackLabel,
        text
      };

      if (meta?.helperText) {
        parsed.helperText = meta.helperText;
      }

      return parsed;
    })
    .filter((shape): shape is SlideShape => Boolean(shape));
};

const toNumber = (value: string | null | undefined, fallback = 0): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveZipPath = (baseDir: string, relativeTarget: string): string => {
  const raw = `${baseDir}/${relativeTarget}`;
  const parts = raw.split('/');
  const stack: string[] = [];

  parts.forEach(part => {
    if (!part || part === '.') return;
    if (part === '..') {
      stack.pop();
      return;
    }
    stack.push(part);
  });

  return stack.join('/');
};

const parseSlideRelationships = (xml: string | undefined): Record<string, string> => {
  if (!xml) return {};

  const map: Record<string, string> = {};
  const relationshipTags = xml.match(/<Relationship\b[^>]*>/g) ?? [];

  relationshipTags.forEach(tag => {
    const id = getTagAttribute(tag, 'Id');
    const target = getTagAttribute(tag, 'Target');
    if (id && target) {
      map[id] = target;
    }
  });

  return map;
};

const parseSlideSizeFromPresentationXml = (xml: string | undefined): SlideSize | null => {
  if (!xml) return null;

  const tag = xml.match(/<p:sldSz\b[^>]*>/)?.[0];
  if (!tag) return null;

  const cx = toNumber(getTagAttribute(tag, 'cx'));
  const cy = toNumber(getTagAttribute(tag, 'cy'));
  if (cx <= 0 || cy <= 0) return null;

  return { cx, cy };
};

const mimeTypeFromPath = (path: string): string => {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
};

const SCHEME_COLOR_MAP: Record<string, string> = {
  lt1: '#FFFFFF',
  dk1: '#000000',
  dk2: '#4C6584',
  accent1: '#4F6788',
  accent2: '#68ADC9',
  accent3: '#9BA9BB',
  accent4: '#445E82',
  accent5: '#4C6584',
  accent6: '#4C6584'
};

const getColorFromStyleBlock = (styleBlock: string | undefined, fallback = '#4C6584'): string => {
  if (!styleBlock) return fallback;

  const solidFill = styleBlock.match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/)?.[0];
  if (!solidFill) return fallback;

  const srgb = solidFill.match(/<a:srgbClr\b[^>]*val="([0-9A-Fa-f]{6})"/)?.[1];
  if (srgb) return `#${srgb.toUpperCase()}`;

  const scheme = solidFill.match(/<a:schemeClr\b[^>]*val="([^"]+)"/)?.[1];
  if (scheme) {
    return SCHEME_COLOR_MAP[scheme] ?? fallback;
  }

  return fallback;
};

const getTableCellFillColor = (tcPrBlock: string | undefined): string | null => {
  if (!tcPrBlock) return null;

  const withoutBorders = tcPrBlock
    .replace(/<a:ln[TLRB]\b[\s\S]*?<\/a:ln[TLRB]>/g, '')
    .replace(/<a:ln[TLRB]\b[^>]*\/>/g, '');
  const directFill = withoutBorders.match(/<a:solidFill>[\s\S]*?<\/a:solidFill>/)?.[0];
  if (!directFill) return null;

  const color = getColorFromStyleBlock(directFill, '');
  return color || null;
};

const getTableCellBorderColor = (tcPrBlock: string | undefined): string | null => {
  if (!tcPrBlock) return null;

  const borderMatch = tcPrBlock.match(/<a:ln[TLRB]\b[\s\S]*?<\/a:ln[TLRB]>/)?.[0];
  if (!borderMatch) return null;

  const color = getColorFromStyleBlock(borderMatch, '');
  return color || null;
};

const toRomanUpper = (value: number): string => {
  if (value <= 0) return '';

  const map: Array<[number, string]> = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I']
  ];

  let remaining = value;
  let roman = '';

  map.forEach(([amount, symbol]) => {
    while (remaining >= amount) {
      roman += symbol;
      remaining -= amount;
    }
  });

  return roman;
};

const toAlphaUpper = (value: number): string => {
  if (value <= 0) return '';

  let current = value;
  let output = '';

  while (current > 0) {
    current -= 1;
    output = String.fromCharCode(65 + (current % 26)) + output;
    current = Math.floor(current / 26);
  }

  return output;
};

const stripListPrefix = (line: string): string => line.replace(/^\s*(?:[IVXLCDM]+|[A-Z]|\d+)\.\s+/u, '').trim();

const parsePremissasTemplateFromSlideXml = (slideXml: string, shapeId = '121'): PremissasParagraphTemplate[] => {
  const shapeBlocks = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) ?? [];
  const targetShape = shapeBlocks.find(shapeBlock => {
    const cNvPrTag = shapeBlock.match(/<p:cNvPr\b[^>]*>/)?.[0];
    return getTagAttribute(cNvPrTag ?? '', 'id') === shapeId;
  });

  if (!targetShape) return [];

  const paragraphs = targetShape.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? [];

  return paragraphs
    .map(paragraphXml => {
      const paragraphText = extractTextFromSegment(paragraphXml).trim();
      if (!paragraphText) return null;

      const pPrTag = paragraphXml.match(/<a:pPr\b[^>]*>/)?.[0] ?? '';
      const level = Math.max(0, toNumber(getTagAttribute(pPrTag, 'lvl'), 0));
      const marginLeft = Math.max(0, toNumber(getTagAttribute(pPrTag, 'marL'), 0));
      const indent = toNumber(getTagAttribute(pPrTag, 'indent'), 0);
      const alignAttr = getTagAttribute(pPrTag, 'algn');
      const align = alignAttr === 'ctr' || alignAttr === 'r' || alignAttr === 'just' ? alignAttr : 'l';
      const autoNumRaw = paragraphXml.match(/<a:buAutoNum\b[^>]*type="([^"]+)"/)?.[1] ?? null;
      const autoNumType =
        autoNumRaw === 'romanUcPeriod' || autoNumRaw === 'alphaUcPeriod' || autoNumRaw === 'arabicPeriod'
          ? autoNumRaw
          : null;
      const runTag =
        paragraphXml.match(/<a:rPr\b[^>]*>/)?.[0] ?? paragraphXml.match(/<a:endParaRPr\b[^>]*>/)?.[0] ?? '';
      const bold = getTagAttribute(runTag, 'b') === '1';

      return {
        level,
        autoNumType,
        bold,
        marginLeft,
        indent,
        align
      } as PremissasParagraphTemplate;
    })
    .filter((item): item is PremissasParagraphTemplate => Boolean(item));
};

const buildPremissasRenderedParagraphs = (
  text: string,
  template: PremissasParagraphTemplate[]
): PremissasRenderedParagraph[] => {
  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  if (!lines.length) return [];

  const fallbackTemplate: PremissasParagraphTemplate = {
    level: 0,
    autoNumType: null,
    bold: false,
    marginLeft: 0,
    indent: 0,
    align: 'l'
  };
  const counters: number[] = [];

  return lines.map((line, index) => {
    const currentTemplate = template[index] ?? fallbackTemplate;
    const normalizedLevel = Math.max(0, currentTemplate.level);

    for (let resetLevel = normalizedLevel + 1; resetLevel < counters.length; resetLevel += 1) {
      counters[resetLevel] = 0;
    }

    let prefix = '';

    if (currentTemplate.autoNumType) {
      counters[normalizedLevel] = (counters[normalizedLevel] ?? 0) + 1;
      const currentValue = counters[normalizedLevel];

      if (currentTemplate.autoNumType === 'romanUcPeriod') {
        prefix = `${toRomanUpper(currentValue)}.`;
      } else if (currentTemplate.autoNumType === 'alphaUcPeriod') {
        prefix = `${toAlphaUpper(currentValue)}.`;
      } else {
        prefix = `${currentValue}.`;
      }
    }

    const markerStart = Math.max(0, currentTemplate.marginLeft + Math.min(0, currentTemplate.indent));
    const textStart = Math.max(0, currentTemplate.marginLeft + Math.max(0, currentTemplate.indent));
    const markerWidth = Math.max(0, textStart - markerStart);

    return {
      level: normalizedLevel,
      prefix,
      text: currentTemplate.autoNumType ? stripListPrefix(line) : line,
      bold: currentTemplate.bold,
      markerStart,
      markerWidth,
      textStart,
      align: currentTemplate.align
    };
  });
};

const toCssFontFamily = (fontFamily: string | undefined): string => {
  if (!fontFamily) return PREVIEW_FONT_STACK;
  const sanitized = fontFamily.replace(/"/g, '').trim();
  if (!sanitized) return PREVIEW_FONT_STACK;
  return `"${sanitized}", ${PREVIEW_FONT_STACK}`;
};

const parseShapeBounds = (block: string): { x: number; y: number; cx: number; cy: number } => {
  const xfrmBlock = block.match(/<a:xfrm\b[\s\S]*?<\/a:xfrm>/)?.[0] ?? block.match(/<p:xfrm\b[\s\S]*?<\/p:xfrm>/)?.[0];
  if (!xfrmBlock) {
    return { x: 0, y: 0, cx: 0, cy: 0 };
  }

  const offTag = xfrmBlock.match(/<a:off\b[^>]*>/)?.[0];
  const extTag = xfrmBlock.match(/<a:ext\b[^>]*>/)?.[0];

  return {
    x: toNumber(getTagAttribute(offTag ?? '', 'x')),
    y: toNumber(getTagAttribute(offTag ?? '', 'y')),
    cx: toNumber(getTagAttribute(extTag ?? '', 'cx')),
    cy: toNumber(getTagAttribute(extTag ?? '', 'cy'))
  };
};

const parseParagraphStyle = (
  paragraphXml: string | undefined
): {
  align: 'l' | 'ctr' | 'r' | 'just';
  fontSizePt: number;
  color: string;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
} => {
  const defaultStyle = {
    align: 'l' as const,
    fontSizePt: 14,
    color: '#4C6584',
    fontFamily: 'Poppins',
    bold: false,
    italic: false
  };

  if (!paragraphXml) return defaultStyle;

  const pPrTag = paragraphXml.match(/<a:pPr\b[^>]*>/)?.[0];
  const alignAttr = getTagAttribute(pPrTag ?? '', 'algn');
  const align = alignAttr === 'ctr' || alignAttr === 'r' || alignAttr === 'just' ? alignAttr : 'l';

  const runBlock =
    paragraphXml.match(/<a:r\b[\s\S]*?<\/a:r>/)?.[0] ??
    paragraphXml.match(/<a:endParaRPr\b[\s\S]*?<\/a:endParaRPr>/)?.[0];

  const rPrTag = runBlock?.match(/<a:rPr\b[^>]*>/)?.[0] ?? runBlock?.match(/<a:endParaRPr\b[^>]*>/)?.[0];
  const sizeRaw = toNumber(getTagAttribute(rPrTag ?? '', 'sz'), 1400);
  const fontSizePt = Math.max(8, sizeRaw / 100);
  const bold = getTagAttribute(rPrTag ?? '', 'b') === '1';
  const italic = getTagAttribute(rPrTag ?? '', 'i') === '1';
  const color = getColorFromStyleBlock(runBlock, '#4C6584');
  const fontFamily = runBlock?.match(/<a:latin\b[^>]*typeface="([^"]+)"/)?.[1] ?? 'Poppins';

  return {
    align,
    fontSizePt,
    color,
    fontFamily,
    bold,
    italic
  };
};

const parseTextShapesForPreview = (slideXml: string): PreviewTextShape[] => {
  const shapeBlocks = slideXml.match(/<p:sp\b[\s\S]*?<\/p:sp>/g) ?? [];

  return shapeBlocks
    .map((shapeBlock, index): PreviewTextShape | null => {
      const cNvPrTag = shapeBlock.match(/<p:cNvPr\b[^>]*>/)?.[0];
      if (!cNvPrTag) return null;

      const id = getTagAttribute(cNvPrTag, 'id') ?? `shape-${index}`;
      const bounds = parseShapeBounds(shapeBlock);
      if (bounds.cx <= 0 || bounds.cy <= 0) return null;

      const text = extractShapeText(shapeBlock);
      if (!text) return null;

      const firstParagraph = shapeBlock.match(/<a:p\b[\s\S]*?<\/a:p>/)?.[0];
      const style = parseParagraphStyle(firstParagraph);
      const bodyPrTag = shapeBlock.match(/<a:bodyPr\b[^>]*>/)?.[0];
      const anchor = getTagAttribute(bodyPrTag ?? '', 'anchor');
      const verticalAlign = anchor === 'ctr' || anchor === 'b' ? anchor : 't';

      return {
        id,
        x: bounds.x,
        y: bounds.y,
        cx: bounds.cx,
        cy: bounds.cy,
        text,
        align: style.align,
        verticalAlign,
        fontSizePt: style.fontSizePt,
        color: style.color,
        fontFamily: style.fontFamily,
        bold: style.bold,
        italic: style.italic
      };
    })
    .filter((shape): shape is PreviewTextShape => Boolean(shape));
};

const parsePicturesForPreview = async (
  slideXml: string,
  relMap: Record<string, string>,
  zip: any,
  mediaCache: Record<string, string>
): Promise<PreviewPictureShape[]> => {
  const pictureBlocks = slideXml.match(/<p:pic\b[\s\S]*?<\/p:pic>/g) ?? [];
  const pictures: PreviewPictureShape[] = [];

  for (const picBlock of pictureBlocks) {
    const cNvPrTag = picBlock.match(/<p:cNvPr\b[^>]*>/)?.[0];
    const id = getTagAttribute(cNvPrTag ?? '', 'id');
    if (!id) continue;

    const bounds = parseShapeBounds(picBlock);
    if (bounds.cx <= 0 || bounds.cy <= 0) continue;

    const blipTag = picBlock.match(/<a:blip\b[^>]*>/)?.[0];
    const relId = getTagAttribute(blipTag ?? '', 'r:embed');
    if (!relId) continue;

    const target = relMap[relId];
    if (!target) continue;

    const zipPath = resolveZipPath('ppt/slides', target);
    const cached = mediaCache[zipPath];
    let src = cached;

    if (!src) {
      const imageFile = zip.file(zipPath);
      if (!imageFile) continue;
      const base64 = await imageFile.async('base64');
      src = `data:${mimeTypeFromPath(zipPath)};base64,${base64}`;
      mediaCache[zipPath] = src;
    }

    const srcRectTag = picBlock.match(/<a:srcRect\b[^>]*\/?>/)?.[0];
    const cropLeft = toNumber(getTagAttribute(srcRectTag ?? '', 'l'));
    const cropRight = toNumber(getTagAttribute(srcRectTag ?? '', 'r'));
    const cropTop = toNumber(getTagAttribute(srcRectTag ?? '', 't'));
    const cropBottom = toNumber(getTagAttribute(srcRectTag ?? '', 'b'));

    pictures.push({
      id,
      x: bounds.x,
      y: bounds.y,
      cx: bounds.cx,
      cy: bounds.cy,
      src,
      cropLeft,
      cropRight,
      cropTop,
      cropBottom
    });
  }

  return pictures;
};

const parseTablesForPreview = (slideXml: string): PreviewTableShape[] => {
  const frames = slideXml.match(/<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g) ?? [];

  return frames
    .map((frame, index): PreviewTableShape | null => {
      const tableXml = frame.match(/<a:tbl>[\s\S]*?<\/a:tbl>/)?.[0];
      if (!tableXml) return null;

      const cNvPrTag = frame.match(/<p:cNvPr\b[^>]*>/)?.[0];
      const id = getTagAttribute(cNvPrTag ?? '', 'id') ?? `table-${index}`;
      const bounds = parseShapeBounds(frame);
      if (bounds.cx <= 0 || bounds.cy <= 0) return null;

      const columnWidths = Array.from(tableXml.matchAll(/<a:gridCol\b[^>]*w="(\d+)"/g)).map(match =>
        toNumber(match[1], 1)
      );

      const rowsXml = tableXml.match(/<a:tr\b[\s\S]*?<\/a:tr>/g) ?? [];
      const rows: PreviewTableRow[] = rowsXml.map(rowXml => {
        const rowTag = rowXml.match(/<a:tr\b[^>]*>/)?.[0];
        const height = toNumber(getTagAttribute(rowTag ?? '', 'h'), 0);

        const cellsXml = rowXml.match(/<a:tc\b[\s\S]*?<\/a:tc>/g) ?? [];
        const cells: PreviewTableCell[] = cellsXml.map(cellXml => {
          const tcTag = cellXml.match(/<a:tc\b[^>]*>/)?.[0] ?? '';
          const firstParagraph = cellXml.match(/<a:p\b[\s\S]*?<\/a:p>/)?.[0];
          const style = parseParagraphStyle(firstParagraph);
          const tcPrBlock =
            cellXml.match(/<a:tcPr\b[\s\S]*?<\/a:tcPr>/)?.[0] ??
            cellXml.match(/<a:tcPr\b[^>]*\/>/)?.[0] ??
            '';
          const cellBackground = getTableCellFillColor(tcPrBlock);
          const borderColor = getTableCellBorderColor(tcPrBlock);
          const gridSpan = Math.max(1, toNumber(getTagAttribute(tcTag, 'gridSpan'), 1));
          const hMerge = getTagAttribute(tcTag, 'hMerge') === '1';

          return {
            text: extractCellText(cellXml),
            align: style.align,
            fontSizePt: style.fontSizePt,
            bold: style.bold,
            color: style.color,
            backgroundColor: cellBackground,
            fontFamily: style.fontFamily,
            gridSpan,
            hMerge,
            borderColor
          };
        });

        return { height, cells };
      });

      const intrinsicWidth = columnWidths.reduce((sum, width) => sum + width, 0);
      const intrinsicHeight = rows.reduce((sum, row) => sum + Math.max(0, row.height), 0);

      return {
        id,
        x: bounds.x,
        y: bounds.y,
        cx: intrinsicWidth > 0 ? intrinsicWidth : bounds.cx,
        cy: intrinsicHeight > 0 ? intrinsicHeight : bounds.cy,
        columnWidths,
        rows
      };
    })
    .filter((table): table is PreviewTableShape => Boolean(table));
};

const parseSlideLayoutForPreview = async (
  slideNumber: number,
  slideXml: string,
  relMap: Record<string, string>,
  zip: any,
  mediaCache: Record<string, string>
): Promise<SlidePreviewLayout> => {
  const bgRelId = slideXml.match(/<p:bg[\s\S]*?<a:blip\b[^>]*r:embed="([^"]+)"/)?.[1] ?? null;
  let backgroundSrc: string | null = null;

  if (bgRelId) {
    const target = relMap[bgRelId];
    if (target) {
      const zipPath = resolveZipPath('ppt/slides', target);
      backgroundSrc = mediaCache[zipPath] ?? null;

      if (!backgroundSrc) {
        const file = zip.file(zipPath);
        if (file) {
          const base64 = await file.async('base64');
          backgroundSrc = `data:${mimeTypeFromPath(zipPath)};base64,${base64}`;
          mediaCache[zipPath] = backgroundSrc;
        }
      }
    }
  }

  const textShapes = parseTextShapesForPreview(slideXml);
  const pictures = await parsePicturesForPreview(slideXml, relMap, zip, mediaCache);
  const tables = parseTablesForPreview(slideXml);

  return {
    slideNumber,
    backgroundSrc,
    textShapes,
    pictures,
    tables
  };
};

const replaceTextInRuns = (xmlSegment: string, nextText: string): { updated: string; changed: boolean } => {
  const encodedText = encodeXmlEntities(nextText.replace(/\r\n/g, '\n'));
  let wrotePrimaryText = false;

  const updated = xmlSegment.replace(/<a:t(\s+[^>]*)?>[\s\S]*?<\/a:t>/g, (_match, attrs = '') => {
    if (!wrotePrimaryText) {
      wrotePrimaryText = true;
      return `<a:t${attrs}>${encodedText}</a:t>`;
    }
    return `<a:t${attrs}></a:t>`;
  });

  return { updated, changed: wrotePrimaryText };
};

const replaceTextAcrossParagraphs = (xmlSegment: string, nextText: string): { updated: string; changed: boolean } => {
  const paragraphs = xmlSegment.match(/<a:p\b[\s\S]*?<\/a:p>/g);
  if (!paragraphs?.length) {
    return replaceTextInRuns(xmlSegment, nextText);
  }

  const writableParagraphIndexes = paragraphs
    .map((paragraph, index) => (/<a:t(?:\s+[^>]*)?>[\s\S]*?<\/a:t>/.test(paragraph) ? index : -1))
    .filter((index): index is number => index >= 0);

  if (!writableParagraphIndexes.length) {
    return { updated: xmlSegment, changed: false };
  }

  const normalizedLines = nextText.replace(/\r\n/g, '\n').split('\n');
  const distributedLines = writableParagraphIndexes.map(() => '');

  normalizedLines.forEach((line, lineIndex) => {
    const slot = Math.min(lineIndex, distributedLines.length - 1);
    distributedLines[slot] = distributedLines[slot] ? `${distributedLines[slot]}\n${line}` : line;
  });

  let updated = xmlSegment;
  let changed = false;

  writableParagraphIndexes.forEach((paragraphIndex, slot) => {
    const currentParagraph = paragraphs[paragraphIndex];
    const replacedParagraph = replaceTextInRuns(currentParagraph, distributedLines[slot] ?? '');
    if (!replacedParagraph.changed) return;

    changed = true;
    updated = replaceNthMatch(updated, /<a:p\b[\s\S]*?<\/a:p>/g, paragraphIndex, replacedParagraph.updated);
  });

  return { updated, changed };
};

const replaceShapeTextInSlideXml = (slideXml: string, shapeId: string, nextText: string): string => {
  let replaced = false;

  return slideXml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, shapeBlock => {
    if (replaced) return shapeBlock;

    const cNvPrTag = shapeBlock.match(/<p:cNvPr\b[^>]*>/)?.[0];
    if (!cNvPrTag) return shapeBlock;

    const currentId = getTagAttribute(cNvPrTag, 'id');
    if (currentId !== shapeId) return shapeBlock;

    const updatedShape = replaceTextAcrossParagraphs(shapeBlock, nextText);
    if (updatedShape.changed) {
      replaced = true;
      return updatedShape.updated;
    }

    return shapeBlock;
  });
};

const applyShapeLayoutOverrideInSlideXml = (
  slideXml: string,
  shapeId: string,
  override: Partial<Pick<PreviewTextShape, 'x' | 'y' | 'cx' | 'cy'>>
): string => {
  let applied = false;

  return slideXml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, shapeBlock => {
    if (applied) return shapeBlock;

    const cNvPrTag = shapeBlock.match(/<p:cNvPr\b[^>]*>/)?.[0];
    if (!cNvPrTag || getTagAttribute(cNvPrTag, 'id') !== shapeId) return shapeBlock;

    let updatedShape = shapeBlock;
    if (override.x !== undefined || override.y !== undefined) {
      updatedShape = updatedShape.replace(/<a:off\b[^>]*\/>/, offTag => {
        const x = override.x ?? toNumber(getTagAttribute(offTag, 'x'));
        const y = override.y ?? toNumber(getTagAttribute(offTag, 'y'));
        return `<a:off x="${x}" y="${y}"/>`;
      });
    }
    if (override.cx !== undefined || override.cy !== undefined) {
      updatedShape = updatedShape.replace(/<a:ext\b[^>]*\/>/, extTag => {
        const cx = override.cx ?? toNumber(getTagAttribute(extTag, 'cx'));
        const cy = override.cy ?? toNumber(getTagAttribute(extTag, 'cy'));
        return `<a:ext cx="${cx}" cy="${cy}"/>`;
      });
    }

    applied = true;
    return updatedShape;
  });
};

const replacePlaceholderTextInSlideXml = (
  slideXml: string,
  placeholderText: string,
  nextText: string
): string => {
  const encodedPlaceholder = encodeXmlEntities(placeholderText);
  const encodedNextText = encodeXmlEntities(nextText.replace(/\r\n/g, '\n'));
  const placeholderRegex = new RegExp(`<a:t(\\s+[^>]*)?>${escapeRegex(encodedPlaceholder)}<\\/a:t>`);

  return slideXml.replace(placeholderRegex, (_match, attrs = '') => {
    return `<a:t${attrs}>${encodedNextText}</a:t>`;
  });
};

const replaceNthMatch = (source: string, regex: RegExp, index: number, replacement: string): string => {
  let cursor = -1;
  return source.replace(regex, match => {
    cursor += 1;
    if (cursor === index) {
      return replacement;
    }
    return match;
  });
};

const extractCellText = (cellXml: string): string => {
  const paragraphs = cellXml.match(/<a:p\b[\s\S]*?<\/a:p>/g) ?? [];
  return paragraphs
    .map(paragraph => {
      const texts = Array.from(paragraph.matchAll(/<a:t(?:\s+[^>]*)?>([\s\S]*?)<\/a:t>/g));
      return texts.map(match => decodeXmlEntities(match[1])).join('');
    })
    .join('\n')
    .trim();
};

const replaceCellText = (cellXml: string, nextText: string): string => {
  const updatedCell = replaceTextAcrossParagraphs(cellXml, nextText);
  return updatedCell.changed ? updatedCell.updated : cellXml;
};

const getTableRowsXml = (tableXml: string): string[] => tableXml.match(/<a:tr\b[\s\S]*?<\/a:tr>/g) ?? [];

const TABLE_CELL_REGEX = /<a:tc\b[^>]*\/>|<a:tc\b[\s\S]*?<\/a:tc>/g;

const getEditableCellsFromRowXml = (rowXml: string): string[] => rowXml.match(TABLE_CELL_REGEX) ?? [];

const getTableCellTag = (cellXml: string): string => cellXml.match(/<a:tc\b[^>]*>/)?.[0] ?? cellXml.match(/<a:tc\b[^>]*\/>/)?.[0] ?? '';

const isMergedTableCell = (cellXml: string): boolean => getTagAttribute(getTableCellTag(cellXml), 'hMerge') === '1';

const getVisibleCellIndexesFromRowXml = (rowXml: string): number[] => {
  const cells = getEditableCellsFromRowXml(rowXml);
  return cells
    .map((cellXml, index) => (isMergedTableCell(cellXml) ? -1 : index))
    .filter((index): index is number => index >= 0);
};

const normalizeTableLabel = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const findInvestmentSpecialRowIndexes = (rowsXml: string[]): { totalRowIndex: number; installationRowIndex: number } => {
  let totalRowIndex = -1;
  let installationRowIndex = -1;

  rowsXml.forEach((rowXml, index) => {
    const firstCell = getEditableCellsFromRowXml(rowXml)[0] ?? '';
    const firstText = normalizeTableLabel(extractCellText(firstCell));

    if (firstText.startsWith('TOTAL')) {
      totalRowIndex = index;
      return;
    }

    if (firstText.includes('TAXA DE INSTALACAO')) {
      installationRowIndex = index;
    }
  });

  if (totalRowIndex < 0 && rowsXml.length >= 2) {
    totalRowIndex = rowsXml.length - 2;
  }

  if (installationRowIndex < 0 && rowsXml.length >= 1) {
    installationRowIndex = rowsXml.length - 1;
  }

  if (installationRowIndex <= totalRowIndex) {
    installationRowIndex = Math.min(rowsXml.length - 1, totalRowIndex + 1);
  }

  return { totalRowIndex, installationRowIndex };
};

const replaceTableCellInRowXml = (rowXml: string, cellIndex: number, nextText: string): string => {
  const cells = getEditableCellsFromRowXml(rowXml);
  if (!cells[cellIndex]) return rowXml;
  if (isMergedTableCell(cells[cellIndex]) || !cells[cellIndex].includes('</a:tc>')) return rowXml;

  const updatedCell = replaceCellText(cells[cellIndex], nextText);
  return replaceNthMatch(rowXml, TABLE_CELL_REGEX, cellIndex, updatedCell);
};

const ensureInvestmentRowsInSlideXml = (slideXml: string, rows: InvestmentRow[]): string => {
  const tableXml = slideXml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/)?.[0];
  if (!tableXml) return slideXml;

  const rowsXml = getTableRowsXml(tableXml);
  if (rowsXml.length < 3) return slideXml;

  const { totalRowIndex, installationRowIndex } = findInvestmentSpecialRowIndexes(rowsXml);
  if (totalRowIndex <= 0 || installationRowIndex < 0) return slideXml;

  const headerRow = rowsXml[0];
  const footerRows = rowsXml.slice(totalRowIndex);
  const serviceTemplate =
    rowsXml.slice(1, totalRowIndex).find(row => getEditableCellsFromRowXml(row).length >= 4) ?? rowsXml[1];

  const safeRows = rows.length > 0 ? rows : [{ service: '', description: '', monthly: '', contract: '' }];
  const generatedRows = safeRows.map(item => {
    let rowXml = serviceTemplate;
    rowXml = replaceTableCellInRowXml(rowXml, 0, item.service);
    rowXml = replaceTableCellInRowXml(rowXml, 1, item.description);
    rowXml = replaceTableCellInRowXml(rowXml, 2, item.monthly);
    rowXml = replaceTableCellInRowXml(rowXml, 3, item.contract);
    return rowXml;
  });

  const firstRow = rowsXml[0];
  const lastRow = rowsXml[rowsXml.length - 1];
  const rowsStart = tableXml.indexOf(firstRow);
  const rowsEnd = tableXml.lastIndexOf(lastRow) + lastRow.length;

  if (rowsStart < 0 || rowsEnd <= rowsStart) return slideXml;

  const rebuiltRows = [headerRow, ...generatedRows, ...footerRows].join('');
  const updatedTableXml = `${tableXml.slice(0, rowsStart)}${rebuiltRows}${tableXml.slice(rowsEnd)}`;
  const tableStart = slideXml.indexOf(tableXml);
  if (tableStart < 0) return slideXml;

  return `${slideXml.slice(0, tableStart)}${updatedTableXml}${slideXml.slice(tableStart + tableXml.length)}`;
};

const parseInvestmentTableFromSlideXml = (slideXml: string): ParsedInvestmentTable => {
  const tableXml = slideXml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/)?.[0];
  if (!tableXml) {
    return {
      rows: DEFAULT_INVESTMENT_ROWS,
      totalMonthly: DEFAULT_TOTAL_MONTHLY,
      totalContract: DEFAULT_TOTAL_CONTRACT,
      installationFee: DEFAULT_INSTALLATION_FEE
    };
  }

  const rowsXml = getTableRowsXml(tableXml);
  const { totalRowIndex, installationRowIndex } = findInvestmentSpecialRowIndexes(rowsXml);

  const getCell = (rowXml: string, cellIndex: number): string => {
    const cells = getEditableCellsFromRowXml(rowXml);
    return extractCellText(cells[cellIndex] ?? '');
  };

  const serviceRows = rowsXml
    .slice(1, Math.max(1, totalRowIndex))
    .map(rowXml => ({
      service: getCell(rowXml, 0),
      description: getCell(rowXml, 1),
      monthly: getCell(rowXml, 2),
      contract: getCell(rowXml, 3)
    }))
    .filter(row => [row.service, row.description, row.monthly, row.contract].some(value => value.trim().length > 0));

  const totalRowXml = rowsXml[totalRowIndex] ?? '';
  const installationRowXml = rowsXml[installationRowIndex] ?? '';
  const totalVisibleIndexes = getVisibleCellIndexesFromRowXml(totalRowXml);
  const installationVisibleIndexes = getVisibleCellIndexesFromRowXml(installationRowXml);
  const totalMonthlyIndex = totalVisibleIndexes[1] ?? 2;
  const totalContractIndex = totalVisibleIndexes[2] ?? 3;
  const installationFeeIndex = installationVisibleIndexes[1] ?? 2;

  return {
    rows: serviceRows.length > 0 ? serviceRows : DEFAULT_INVESTMENT_ROWS,
    totalMonthly: getCell(totalRowXml, totalMonthlyIndex) || DEFAULT_TOTAL_MONTHLY,
    totalContract: getCell(totalRowXml, totalContractIndex) || DEFAULT_TOTAL_CONTRACT,
    installationFee: getCell(installationRowXml, installationFeeIndex) || DEFAULT_INSTALLATION_FEE
  };
};

const replaceTableCellInSlideXml = (
  slideXml: string,
  rowIndex: number,
  cellIndex: number,
  nextText: string
): string => {
  const tableXml = slideXml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/)?.[0];
  if (!tableXml) return slideXml;

  const rowsXml = getTableRowsXml(tableXml);
  if (!rowsXml[rowIndex]) return slideXml;

  const targetRow = rowsXml[rowIndex];
  const cells = getEditableCellsFromRowXml(targetRow);
  if (!cells[cellIndex]) return slideXml;
  if (isMergedTableCell(cells[cellIndex]) || !cells[cellIndex].includes('</a:tc>')) return slideXml;

  const updatedCell = replaceCellText(cells[cellIndex], nextText);
  const updatedRow = replaceNthMatch(targetRow, TABLE_CELL_REGEX, cellIndex, updatedCell);
  const updatedTable = replaceNthMatch(tableXml, /<a:tr\b[\s\S]*?<\/a:tr>/g, rowIndex, updatedRow);

  const start = slideXml.indexOf(tableXml);
  if (start < 0) return slideXml;
  return `${slideXml.slice(0, start)}${updatedTable}${slideXml.slice(start + tableXml.length)}`;
};

const replaceVisibleTableCellInSlideXml = (
  slideXml: string,
  rowIndex: number,
  visibleCellPosition: number,
  nextText: string
): string => {
  const tableXml = slideXml.match(/<a:tbl>[\s\S]*?<\/a:tbl>/)?.[0];
  if (!tableXml) return slideXml;

  const rowsXml = getTableRowsXml(tableXml);
  const rowXml = rowsXml[rowIndex];
  if (!rowXml) return slideXml;

  const visibleIndexes = getVisibleCellIndexesFromRowXml(rowXml);
  const cellIndex = visibleIndexes[visibleCellPosition];
  if (cellIndex === undefined) return slideXml;

  return replaceTableCellInSlideXml(slideXml, rowIndex, cellIndex, nextText);
};

const parseSavedDraft = (rawValue: string | null): SavedDraft | null => {
  if (!rawValue) return null;

  try {
    const parsed = JSON.parse(rawValue) as SavedDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.cover || !parsed.slides) return null;
    return parsed;
  } catch {
    return null;
  }
};

const parseSavedProposalEntries = (rawValue: string | null): SavedProposalEntry[] => {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue) as SavedProposalEntry[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(entry => {
      return (
        Boolean(entry) &&
        typeof entry.id === 'string' &&
        typeof entry.title === 'string' &&
        typeof entry.savedAt === 'string' &&
        Boolean(entry.draft?.cover) &&
        Boolean(entry.draft?.slides)
      );
    });
  } catch {
    return [];
  }
};

const normalizeLabel = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const parseCaracteristicasValue = (value: string): string =>
  value
    .replace(/^CARACTER[IÍ]STICAS:\s*/i, '')
    .trim();

const composeCaracteristicasValue = (value: string): string => {
  const content = value.trim() || 'A ser preenchido';
  return `CARACTERÍSTICAS:\n${content}`;
};

const parseValorProjetoValue = (value: string): string => {
  const lines = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) return '';
  if (normalizeLabel(lines[0]) === normalizeLabel('Valor do Projeto')) {
    return lines.slice(1).join('\n').trim();
  }

  return lines.join('\n').trim();
};

const composeValorProjetoValue = (value: string): string => {
  const content = value.trim();
  return content ? `Valor do Projeto\n${content}` : 'Valor do Projeto';
};

const parseContractFields = (value: string): ContractFields => {
  const lines = value.split('\n');

  const findAfter = (label: string) => {
    const index = lines.findIndex(line => normalizeLabel(line) === normalizeLabel(label));
    if (index >= 0 && lines[index + 1] !== undefined) {
      return lines[index + 1];
    }
    return '';
  };

  return {
    vigencia: findAfter('VIGÊNCIA DE CONTRATO'),
    prazo: findAfter('PRAZO DE ENTREGA'),
    termos: findAfter('TERMOS E CONDIÇÕES')
  };
};

const composeContractFields = (fields: ContractFields): string => {
  const vigencia = fields.vigencia.length > 0 ? fields.vigencia : 'A ser preenchido';
  const prazo = fields.prazo.length > 0 ? fields.prazo : 'A ser preenchido';
  const termos = fields.termos.length > 0 ? fields.termos : 'A ser preenchido';

  return `VIGÊNCIA DE CONTRATO\n${vigencia}\nPRAZO DE ENTREGA\n${prazo}\nTERMOS E CONDIÇÕES\n${termos}`;
};

const updateShapeTextInArray = (shapes: SlideShape[], shapeId: string, text: string): SlideShape[] =>
  shapes.map(shape => (shape.id === shapeId ? { ...shape, text } : shape));

const getShapeTextFromMap = (shapeMap: Record<number, SlideShape[]>, slide: number, shapeId: string): string =>
  shapeMap[slide]?.find(shape => shape.id === shapeId)?.text ?? '';

const isShapeDraftEditable = (slideNumber: number, shapeId: string): boolean => {
  const config = EDITABLE_SHAPE_IDS[slideNumber];
  if (!config) return false;
  if (config === 'ALL') return true;
  return config.includes(shapeId);
};

const parseCurrency = (value: string): number | null => {
  const normalized = value
    .replace(/\s/g, '')
    .replace(/R\$/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const formatCurrency = (value: number): string => {
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `R$${formatted}`;
};

const formatCurrencyText = (value: string): string => {
  const parsed = parseCurrency(value);
  return parsed === null ? value : formatCurrency(parsed);
};

const calculateTotals = (
  rows: InvestmentRow[],
  fallbackMonthly: string,
  fallbackContract: string
): { monthly: string; contract: string } => {
  const monthlyValues = rows.map(row => parseCurrency(row.monthly));
  const contractValues = rows.map(row => parseCurrency(row.contract));

  const validMonthly = monthlyValues.filter((value): value is number => value !== null);
  const validContract = contractValues.filter((value): value is number => value !== null);

  const monthly = validMonthly.length
    ? formatCurrency(validMonthly.reduce((sum, item) => sum + item, 0))
    : fallbackMonthly;

  const contract = validContract.length
    ? formatCurrency(validContract.reduce((sum, item) => sum + item, 0))
    : fallbackContract;

  return { monthly, contract };
};

const firstNonEmpty = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }
  return '';
};

const generateProposalId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const normalizeProposalNumber = (entry?: Partial<SavedProposalEntry> | null): string => {
  const number = entry?.proposalNumber || entry?.draft?.proposalNumber || '';
  return String(number || '').trim();
};

const generateProposalNumber = (entries: SavedProposalEntry[]): string => {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;
  const used = entries
    .map(normalizeProposalNumber)
    .filter(number => number.startsWith(prefix))
    .map(number => Number(number.slice(prefix.length)))
    .filter(Number.isFinite);

  return `${prefix}${String(Math.max(0, ...used) + 1).padStart(4, '0')}`;
};

const formatProposalDate = (): string => new Date().toLocaleDateString('pt-BR');

const normalizeDraftCoverDate = (date: string): string => {
  const clean = String(date || '').trim();
  if (!clean || clean === 'Data DD/MM/AAAA') return formatProposalDate();
  return clean;
};

export default function CommercialProposalPresentationView({
  initialProposalId = null,
  initialMode = 'latest',
  initialSlide,
  onSaved,
  onNewProposal
}: CommercialProposalPresentationViewProps = {}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const slide7CardRef = useRef<HTMLDivElement>(null);
  const templateShapeMapRef = useRef<Record<number, SlideShape[]>>({});
  const templateInvestmentRef = useRef<ParsedInvestmentTable>({
    rows: DEFAULT_INVESTMENT_ROWS,
    totalMonthly: DEFAULT_TOTAL_MONTHLY,
    totalContract: DEFAULT_TOTAL_CONTRACT,
    installationFee: DEFAULT_INSTALLATION_FEE
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isWorking, setIsWorking] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('openSlide') === '7' || initialSlide === 7) {
      window.setTimeout(() => {
        slide7CardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  }, [initialSlide]);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [pptxBuffer, setPptxBuffer] = useState<ArrayBuffer | null>(null);

  const [coverFields, setCoverFields] = useState<CoverFieldsState>({
    clientName: { value: '' },
    date: { value: '' },
    product: { value: '' }
  });

  const [slideShapes, setSlideShapes] = useState<Record<number, SlideShape[]>>({});
  const [contractFields, setContractFields] = useState<ContractFields>(DEFAULT_CONTRACT_FIELDS);
  const [investmentRows, setInvestmentRows] = useState<InvestmentRow[]>(DEFAULT_INVESTMENT_ROWS);
  const [installationFee, setInstallationFee] = useState<string>(DEFAULT_INSTALLATION_FEE);
  const [totalsFallback, setTotalsFallback] = useState<{ monthly: string; contract: string }>({
    monthly: DEFAULT_TOTAL_MONTHLY,
    contract: DEFAULT_TOTAL_CONTRACT
  });
  const [savedProposals, setSavedProposals] = useState<SavedProposalEntry[]>([]);
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);
  const [proposalFilterText, setProposalFilterText] = useState('');
  const [proposalFilterSavedDate, setProposalFilterSavedDate] = useState('');
  const [proposalSortOrder, setProposalSortOrder] = useState<'recent' | 'oldest' | 'client'>('recent');
  const [slidePreviewLayouts, setSlidePreviewLayouts] = useState<Record<number, SlidePreviewLayout>>({});
  const [slideSize, setSlideSize] = useState<SlideSize>(DEFAULT_SLIDE_SIZE);
  const [slide6PremissasTemplate, setSlide6PremissasTemplate] = useState<PremissasParagraphTemplate[]>([]);

  const setShapeText = useCallback((slideNumber: number, shapeId: string, text: string) => {
    setSlideShapes(prev => {
      const current = prev[slideNumber] ?? [];
      return {
        ...prev,
        [slideNumber]: updateShapeTextInArray(current, shapeId, text)
      };
    });
  }, []);

  const getShapeText = useCallback(
    (slideNumber: number, shapeId: string) => getShapeTextFromMap(slideShapes, slideNumber, shapeId),
    [slideShapes]
  );

  const investmentTotals = useMemo(
    () => calculateTotals(investmentRows, totalsFallback.monthly, totalsFallback.contract),
    [investmentRows, totalsFallback]
  );

  const cloneTemplateShapeMap = useCallback((map: Record<number, SlideShape[]>): Record<number, SlideShape[]> => {
    const cloned: Record<number, SlideShape[]> = {};
    Object.entries(map).forEach(([slideNumber, shapes]) => {
      cloned[Number(slideNumber)] = shapes.map(shape => ({ ...shape }));
    });
    return cloned;
  }, []);

  const applyDraftToEditor = useCallback(
    (draft: SavedDraft | null) => {
      const defaultCover = {
        clientName: 'Nome do Cliente',
        date: 'Data DD/MM/AAAA',
        product: 'Datacenter\nFirewall'
      };

      const nextShapeMap = cloneTemplateShapeMap(templateShapeMapRef.current);

      if (draft) {
        for (const slideNumber of EDITABLE_SLIDES) {
          const draftShapes = draft.slides[String(slideNumber)];
          if (!draftShapes || !nextShapeMap[slideNumber]) continue;

          nextShapeMap[slideNumber] = nextShapeMap[slideNumber].map(shape => {
            const savedValue = draftShapes[shape.id];
            if (typeof savedValue === 'string' && isShapeDraftEditable(slideNumber, shape.id)) {
              return { ...shape, text: savedValue };
            }
            return shape;
          });
        }
      }

      const shape130Text = getShapeTextFromMap(nextShapeMap, 7, '130');
      const parsedContract = parseContractFields(shape130Text);
      const nextContract: ContractFields = {
        vigencia: firstNonEmpty(draft?.contract?.vigencia, parsedContract.vigencia, DEFAULT_CONTRACT_FIELDS.vigencia),
        prazo: firstNonEmpty(draft?.contract?.prazo, parsedContract.prazo, DEFAULT_CONTRACT_FIELDS.prazo),
        termos: firstNonEmpty(draft?.contract?.termos, parsedContract.termos, DEFAULT_CONTRACT_FIELDS.termos)
      };

      if (nextShapeMap[7]) {
        nextShapeMap[7] = updateShapeTextInArray(nextShapeMap[7], '130', composeContractFields(nextContract));
      }

      const templateInvestment = templateInvestmentRef.current;
      const incomingRows = draft?.investment?.rows?.length ? draft.investment.rows : templateInvestment.rows;

      const nextRows: InvestmentRow[] = incomingRows.map(row => ({
        service: row.service ?? '',
        description: row.description ?? '',
        monthly: row.monthly ?? '',
        contract: row.contract ?? ''
      }));

      if (nextRows.length === 0) {
        nextRows.push({ service: '', description: '', monthly: '', contract: '' });
      }

      setCoverFields({
        clientName: { value: draft?.cover.clientName ?? defaultCover.clientName },
        date: { value: draft?.cover.date ?? defaultCover.date },
        product: { value: draft?.cover.product ?? defaultCover.product }
      });
      setContractFields(nextContract);
      setSlideShapes(nextShapeMap);
      setInvestmentRows(nextRows);
      setInstallationFee(draft?.investment?.installationFee ?? templateInvestment.installationFee);
      setTotalsFallback({
        monthly: templateInvestment.totalMonthly,
        contract: templateInvestment.totalContract
      });
      setLastSavedAt(draft?.savedAt ?? null);
    },
    [cloneTemplateShapeMap]
  );

  const persistSavedProposals = useCallback((entries: SavedProposalEntry[]) => {
    const ordered = [...entries].sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()
    );
    setSavedProposals(ordered);
    window.localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(ordered));
    return ordered;
  }, []);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setLoading(true);
        setError(null);

        const JSZip = (await import('jszip')).default;

        let buffer: ArrayBuffer | null = null;
        const candidateUrls = [
          PPTX_URL,
          '/api/proposta-comercial-double.pptx',
          '/proposta-comercial-double.pptx',
          `${PPTX_URL}?v=${Date.now()}`,
          `/api/proposta-comercial-double.pptx?v=${Date.now()}`
        ];

        if (typeof window !== 'undefined' && window.location.origin) {
          candidateUrls.push(
            `${window.location.origin}/proposta-comercial-double.pptx`,
            `${window.location.origin}/api/proposta-comercial-double.pptx`
          );
        }

        for (let attempt = 1; attempt <= 3 && !buffer; attempt += 1) {
          for (const url of candidateUrls) {
            try {
              const res = await fetch(url, { cache: 'no-cache' });
              const contentType = res.headers.get('content-type') || '';
              if (res.ok && !contentType.includes('text/html')) {
                const tempBuf = await res.arrayBuffer();
                const u8 = new Uint8Array(tempBuf.slice(0, 4));
                if (u8[0] === 0x50 && u8[1] === 0x4b) {
                  buffer = tempBuf;
                  break;
                }
              }
            } catch (fetchErr) {
              console.warn(`Tentativa ${attempt} ao buscar template em ${url}:`, fetchErr);
            }
          }
          if (!buffer && attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 400 * attempt));
          }
        }

        if (!buffer) {
          console.info('Gerando modelo de apresentação PPTX via fallback local...');
          try {
            buffer = await createDefaultProposalPptx(JSZip);
          } catch (fallbackErr) {
            console.warn('Falha no gerador de fallback local:', fallbackErr);
          }
        }

        if (!buffer) {
          throw new Error('Não foi possível carregar o modelo de apresentação da proposta comercial.');
        }

        setPptxBuffer(buffer);

        const zip = await JSZip.loadAsync(buffer);
        const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
        const parsedSlideSize = parseSlideSizeFromPresentationXml(presentationXml) ?? DEFAULT_SLIDE_SIZE;
        setSlideSize(parsedSlideSize);

        const mediaCache: Record<string, string> = {};
        const parsedLayouts: Record<number, SlidePreviewLayout> = {};

        for (let slideNumber = 1; slideNumber <= TOTAL_SLIDES; slideNumber += 1) {
          const slideXml = await zip.file(`ppt/slides/slide${slideNumber}.xml`)?.async('string');
          if (!slideXml) continue;

          const relXml = await zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`)?.async('string');
          const relMap = parseSlideRelationships(relXml);
          parsedLayouts[slideNumber] = await parseSlideLayoutForPreview(slideNumber, slideXml, relMap, zip, mediaCache);
        }

        setSlidePreviewLayouts(parsedLayouts);

        const slideXmlByNumber: Partial<Record<number, string>> = {};
        for (const slideNumber of EDITABLE_SLIDES) {
          const xml = await zip.file(`ppt/slides/slide${slideNumber}.xml`)?.async('string');
          if (xml) {
            slideXmlByNumber[slideNumber] = xml;
          }
        }

        const baseShapeMap: Record<number, SlideShape[]> = {};

        for (const slideNumber of EDITABLE_SLIDES) {
          const xml = slideXmlByNumber[slideNumber];
          if (!xml) continue;

          let shapes = parseSlideShapes(xml, slideNumber);

          if (slideNumber === 3) {
            const current41 = shapes.find(s => s.id === '41')?.text;
            if (!current41) {
              shapes = updateShapeTextInArray(
                shapes,
                '41',
                'Acreditamos que o sucesso do nosso negócio está diretamente ligado ao sucesso dos nossos clientes. Por isso, investimos continuamente em infraestrutura, robustez, segurança, inovação e atendimento personalizado, garantindo que cada cliente (independentemente do porte ou segmento) tenha sempre a melhor experiência possível com nossos serviços.'
              );
            }
          }

          if (slideNumber === 4) {
            shapes = updateShapeTextInArray(shapes, '97', 'A ser preenchido');
            shapes = updateShapeTextInArray(shapes, '102', composeCaracteristicasValue('A ser preenchido'));
          }

          if (slideNumber === 5) {
            // Keep default template escopo if present
            const current107 = shapes.find(s => s.id === '107')?.text;
            if (!current107) {
              shapes = updateShapeTextInArray(shapes, '107', 'A ser preenchido');
            }
          }

          if (slideNumber === 7) {
            shapes = updateShapeTextInArray(shapes, '127', composeValorProjetoValue(''));
            shapes = updateShapeTextInArray(shapes, '128', '');
            shapes = updateShapeTextInArray(shapes, '129', '');
            shapes = updateShapeTextInArray(shapes, '130', composeContractFields(DEFAULT_CONTRACT_FIELDS));
          }

          baseShapeMap[slideNumber] = shapes;
        }

        templateShapeMapRef.current = baseShapeMap;
        templateInvestmentRef.current = slideXmlByNumber[7]
          ? parseInvestmentTableFromSlideXml(slideXmlByNumber[7])
          : {
              rows: DEFAULT_INVESTMENT_ROWS,
              totalMonthly: DEFAULT_TOTAL_MONTHLY,
              totalContract: DEFAULT_TOTAL_CONTRACT,
              installationFee: DEFAULT_INSTALLATION_FEE
            };
        setSlide6PremissasTemplate(
          slideXmlByNumber[6] ? parsePremissasTemplateFromSlideXml(slideXmlByNumber[6], '121') : []
        );

        const legacyDraft = parseSavedDraft(window.localStorage.getItem(STORAGE_KEY));
        let entries = parseSavedProposalEntries(window.localStorage.getItem(STORAGE_LIST_KEY));

        if (!entries.length && legacyDraft) {
          const migrated: SavedProposalEntry = {
            id: generateProposalId(),
            title: legacyDraft.cover.clientName?.trim() || 'Proposta sem nome',
            savedAt: legacyDraft.savedAt || new Date().toISOString(),
            draft: legacyDraft
          };
          entries = [migrated];
          window.localStorage.setItem(STORAGE_LIST_KEY, JSON.stringify(entries));
        }

        entries = [...entries].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        setSavedProposals(entries);

        const firstEntry =
          initialMode === 'blank'
            ? null
            : (initialProposalId ? entries.find(entry => entry.id === initialProposalId) : null) ?? entries[0] ?? null;
        setActiveProposalId(firstEntry?.id ?? null);
        applyDraftToEditor(firstEntry?.draft ?? null);

        if (firstEntry?.draft) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(firstEntry.draft));
        }
      } catch (loadError) {
        console.error('Erro ao carregar proposta:', loadError);
        setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar a proposta.');
      } finally {
        setLoading(false);
      }
    };

    loadTemplate();
  }, [applyDraftToEditor, initialProposalId, initialMode, reloadKey]);

  const slide4Descritivo = getShapeText(4, '97');
  const slide4Caracteristicas = parseCaracteristicasValue(getShapeText(4, '102'));
  const slide5Escopo = getShapeText(5, '107');
  const slide6Premissas = getShapeText(6, '121');
  const slide6RenderedPremissas = useMemo(
    () => buildPremissasRenderedParagraphs(slide6Premissas, slide6PremissasTemplate),
    [slide6Premissas, slide6PremissasTemplate]
  );
  const slide7ValorProjeto = parseValorProjetoValue(getShapeText(7, '127'));
  const slide8Shapes = useMemo(
    () => (slideShapes[8] ?? []).filter(shape => isShapeDraftEditable(8, shape.id)),
    [slideShapes]
  );

  const coverProductLines = useMemo(
    () =>
      coverFields.product.value
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean),
    [coverFields.product.value]
  );

  const filteredSavedProposals = useMemo(() => {
    const filterText = proposalFilterText.trim().toLowerCase();

    const filtered = savedProposals.filter(entry => {
      const client = (entry.draft.cover.clientName || entry.title || '').toLowerCase();
      const coverDate = (entry.draft.cover.date || '').toLowerCase();
      const product = (entry.draft.cover.product || '').toLowerCase();
      const savedDate = entry.savedAt.slice(0, 10);

      const matchesText =
        filterText.length === 0 ||
        client.includes(filterText) ||
        coverDate.includes(filterText) ||
        product.includes(filterText);

      const matchesSavedDate =
        proposalFilterSavedDate.length === 0 || savedDate === proposalFilterSavedDate;

      return matchesText && matchesSavedDate;
    });

    if (proposalSortOrder === 'oldest') {
      return [...filtered].sort((a, b) => new Date(a.savedAt).getTime() - new Date(b.savedAt).getTime());
    }

    if (proposalSortOrder === 'client') {
      return [...filtered].sort((a, b) =>
        (a.draft.cover.clientName || a.title).localeCompare(b.draft.cover.clientName || b.title, 'pt-BR')
      );
    }

    return [...filtered].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
  }, [savedProposals, proposalFilterText, proposalFilterSavedDate, proposalSortOrder]);

  const activeProposal = useMemo(
    () => savedProposals.find(entry => entry.id === activeProposalId) ?? null,
    [savedProposals, activeProposalId]
  );
  const activeProposalNumber = normalizeProposalNumber(activeProposal);

  const buildDraft = useCallback((): SavedDraft => {
    const slides: Record<string, Record<string, string>> = {};

    for (const slideNumber of EDITABLE_SLIDES) {
      slides[String(slideNumber)] = {};
      (slideShapes[slideNumber] ?? []).forEach(shape => {
        slides[String(slideNumber)][shape.id] = shape.text;
      });
    }

    return {
      savedAt: new Date().toISOString(),
      cover: {
        clientName: coverFields.clientName.value,
        date: coverFields.date.value,
        product: coverFields.product.value
      },
      slides,
      contract: contractFields,
      investment: {
        rows: investmentRows,
        installationFee
      }
    };
  }, [coverFields, slideShapes, contractFields, investmentRows, installationFee]);

  const saveCurrentProposal = useCallback((): SavedProposalEntry => {
    const draft = buildDraft();
    const proposalId = activeProposalId ?? generateProposalId();
    const existingEntry = savedProposals.find(item => item.id === proposalId);
    const proposalNumber = normalizeProposalNumber(existingEntry) || generateProposalNumber(savedProposals);
    const draftWithMetadata: SavedDraft = {
      ...draft,
      proposalNumber,
      opportunityId: existingEntry?.opportunityId || existingEntry?.draft?.opportunityId,
      cover: {
        ...draft.cover,
        date: normalizeDraftCoverDate(draft.cover.date)
      }
    };
    const entry: SavedProposalEntry = {
      id: proposalId,
      title: draft.cover.clientName.trim() || 'Proposta sem nome',
      proposalNumber,
      opportunityId: existingEntry?.opportunityId,
      clientType: existingEntry?.clientType,
      savedAt: draft.savedAt,
      draft: draftWithMetadata
    };

    const remaining = savedProposals.filter(item => item.id !== proposalId);
    const updated = persistSavedProposals([entry, ...remaining]);
    setActiveProposalId(proposalId);
    setLastSavedAt(draft.savedAt);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftWithMetadata));

    return updated.find(item => item.id === proposalId) ?? entry;
  }, [buildDraft, activeProposalId, savedProposals, persistSavedProposals]);

  const saveDraft = useCallback((): string => {
    const saved = saveCurrentProposal();
    return saved.savedAt;
  }, [saveCurrentProposal]);

  const loadSavedProposalById = useCallback(
    (proposalId: string): SavedProposalEntry | null => {
      const entry = savedProposals.find(item => item.id === proposalId);
      if (!entry) return null;

      setActiveProposalId(entry.id);
      applyDraftToEditor(entry.draft);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entry.draft));
      return entry;
    },
    [savedProposals, applyDraftToEditor]
  );

  const deleteSavedProposalById = useCallback(
    (proposalId: string): boolean => {
      const exists = savedProposals.some(item => item.id === proposalId);
      if (!exists) return false;

      const remaining = savedProposals.filter(item => item.id !== proposalId);
      const ordered = persistSavedProposals(remaining);

      if (activeProposalId === proposalId) {
        const nextEntry = ordered[0] ?? null;
        setActiveProposalId(nextEntry?.id ?? null);
        applyDraftToEditor(nextEntry?.draft ?? null);

        if (nextEntry?.draft) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntry.draft));
        } else {
          window.localStorage.removeItem(STORAGE_KEY);
        }
      }

      return true;
    },
    [savedProposals, persistSavedProposals, activeProposalId, applyDraftToEditor]
  );

  const handleLoadProposalForEdit = useCallback(
    (proposalId: string) => {
      const loaded = loadSavedProposalById(proposalId);
      if (!loaded) return;
      setShowPreview(false);
      setSaveMessage(`Proposta carregada para edicao: ${loaded.title}`);
    },
    [loadSavedProposalById]
  );

  const handleDeleteSavedProposal = useCallback(
    (proposalId: string) => {
      if (!window.confirm('Deseja realmente excluir esta proposta salva?')) return;
      if (!deleteSavedProposalById(proposalId)) return;
      setSaveMessage('Proposta excluida com sucesso.');
    },
    [deleteSavedProposalById]
  );

  const handleNewProposal = useCallback(() => {
    setActiveProposalId(null);
    applyDraftToEditor(null);
    setShowPreview(false);
    window.localStorage.removeItem(STORAGE_KEY);
    onNewProposal?.();
    setSaveMessage('Modo de nova proposta ativado.');
  }, [applyDraftToEditor, onNewProposal]);

  const buildEditedBlob = useCallback(async (): Promise<Blob | null> => {
    if (!pptxBuffer) return null;

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(pptxBuffer);

    const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('string');
    if (slide1Xml) {
      let updatedSlide1 = slide1Xml;

      const productLines = coverFields.product.value
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      updatedSlide1 = replacePlaceholderTextInSlideXml(updatedSlide1, 'Nome do Cliente', coverFields.clientName.value);
      updatedSlide1 = replacePlaceholderTextInSlideXml(updatedSlide1, 'Data DD/MM/AAAA', coverFields.date.value);
      updatedSlide1 = replacePlaceholderTextInSlideXml(updatedSlide1, 'Datacenter', productLines[0] ?? '');
      updatedSlide1 = replacePlaceholderTextInSlideXml(updatedSlide1, 'Firewall', productLines[1] ?? '');

      zip.file('ppt/slides/slide1.xml', updatedSlide1);
    }

    for (const slideNumber of EDITABLE_SLIDES) {
      const xml = await zip.file(`ppt/slides/slide${slideNumber}.xml`)?.async('string');
      if (!xml) continue;

      let updatedXml = xml;
      const layoutOverrides = SHAPE_LAYOUT_OVERRIDES[slideNumber] ?? {};
      Object.entries(layoutOverrides).forEach(([shapeId, override]) => {
        updatedXml = applyShapeLayoutOverrideInSlideXml(updatedXml, shapeId, override);
      });

      (slideShapes[slideNumber] ?? []).forEach(shape => {
        updatedXml = replaceShapeTextInSlideXml(updatedXml, shape.id, shape.text);
      });

      if (slideNumber === 7) {
        updatedXml = replaceShapeTextInSlideXml(updatedXml, '128', '');
        updatedXml = replaceShapeTextInSlideXml(updatedXml, '129', '');
        updatedXml = replaceShapeTextInSlideXml(updatedXml, '130', composeContractFields(contractFields));

        const rowsToApply = investmentRows.length
          ? investmentRows
          : [{ service: '', description: '', monthly: '', contract: '' }];

        updatedXml = ensureInvestmentRowsInSlideXml(updatedXml, rowsToApply);

        rowsToApply.forEach((row, index) => {
          updatedXml = replaceTableCellInSlideXml(updatedXml, index + 1, 0, row.service);
          updatedXml = replaceTableCellInSlideXml(updatedXml, index + 1, 1, row.description);
          updatedXml = replaceTableCellInSlideXml(updatedXml, index + 1, 2, formatCurrencyText(row.monthly));
          updatedXml = replaceTableCellInSlideXml(updatedXml, index + 1, 3, formatCurrencyText(row.contract));
        });

        const totalRowIndex = rowsToApply.length + 1;
        const installationRowIndex = rowsToApply.length + 2;

        updatedXml = replaceVisibleTableCellInSlideXml(updatedXml, totalRowIndex, 1, investmentTotals.monthly);
        updatedXml = replaceVisibleTableCellInSlideXml(updatedXml, totalRowIndex, 2, investmentTotals.contract);
        updatedXml = replaceVisibleTableCellInSlideXml(updatedXml, installationRowIndex, 1, formatCurrencyText(installationFee));
      }

      zip.file(`ppt/slides/slide${slideNumber}.xml`, updatedXml);
    }

    const generatedBlob = await zip.generateAsync({ type: 'blob' });
    return new Blob([generatedBlob], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });
  }, [pptxBuffer, coverFields, slideShapes, contractFields, investmentRows, investmentTotals, installationFee]);

  const downloadBlob = useCallback((blob: Blob, fileName: string) => {
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }, []);

  const handleSaveProposal = useCallback(async () => {
    if (loading || error || !pptxBuffer || isWorking) return;

    setIsWorking(true);
    try {
      const savedAt = saveDraft();
      const blob = await buildEditedBlob();
      if (!blob) {
        throw new Error('Nao foi possivel gerar o arquivo para salvamento.');
      }

      downloadBlob(blob, 'Proposta Comercial Double (Salva).pptx');
      onSaved?.();
      setSaveMessage(`Proposta salva com sucesso em ${new Date(savedAt).toLocaleString('pt-BR')}.`);
    } catch (saveError) {
      console.error('Erro ao salvar proposta:', saveError);
      setSaveMessage('Erro ao salvar proposta.');
    } finally {
      setIsWorking(false);
    }
  }, [loading, error, pptxBuffer, isWorking, saveDraft, buildEditedBlob, downloadBlob, onSaved]);

  const handleDownloadEdited = useCallback(async () => {
    if (loading || error || !pptxBuffer || isWorking) return;

    setIsWorking(true);
    try {
      const savedAt = saveDraft();
      const blob = await buildEditedBlob();
      if (!blob) {
        throw new Error('Nao foi possivel gerar o arquivo editado.');
      }

      downloadBlob(blob, 'Proposta Comercial Double (Editada).pptx');
      onSaved?.();
      setSaveMessage(`Download realizado e proposta salva na lista (${new Date(savedAt).toLocaleString('pt-BR')}).`);
    } catch (downloadError) {
      console.error('Erro ao baixar proposta editada:', downloadError);
      setSaveMessage('Erro ao baixar proposta editada.');
    } finally {
      setIsWorking(false);
    }
  }, [loading, error, pptxBuffer, isWorking, saveDraft, buildEditedBlob, downloadBlob, onSaved]);

  const handlePreviewProposal = useCallback(() => {
    if (loading || error || isWorking) return;

    setShowPreview(true);
    setSaveMessage('Preview completo da proposta exibido na tela (slides 1 a 10).');
    window.setTimeout(() => {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, [loading, error, isWorking]);

  const handlePrintPdf = useCallback(() => {
    if (loading || error || isWorking) return;

    setShowPreview(true);
    setSaveMessage('Gerando visualização para exportação em PDF oficial (10 Lâminas)...');

    const clientName = coverFields.clientName.value || 'Cliente';
    const propNumber = activeProposalNumber || 'PROP';

    window.setTimeout(() => {
      const previewElement = previewRef.current;
      if (!previewElement) {
        window.print();
        return;
      }

      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        window.print();
        return;
      }

      const slidesHtml = previewElement.innerHTML;
      const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Proposta Comercial Oficial (10 Lâminas) - ${clientName} (${propNumber})</title>
  <style>
    @page {
      size: 16in 9in landscape;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #0b1020;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }
    .print-wrapper {
      width: 100%;
    }
    .slide-page-container {
      width: 100vw;
      height: 100vh;
      page-break-after: always;
      break-after: page;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: #0b1020;
    }
    .slide-page-container > div {
      width: 100%;
      height: 100%;
    }
    @media print {
      body {
        background: #0b1020 !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-wrapper">
    ${slidesHtml}
  </div>
  <script>
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
    }, 150);
  }, [loading, error, isWorking, coverFields, activeProposalNumber]);


  const handleLoadProposalForPreview = useCallback(
    (proposalId: string) => {
      const loaded = loadSavedProposalById(proposalId);
      if (!loaded) return;

      setShowPreview(true);
      setSaveMessage(`Preview completo: ${loaded.title} (slides 1 a 10).`);
      window.setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    },
    [loadSavedProposalById]
  );

  const updateContractField = useCallback(
    (field: keyof ContractFields, value: string) => {
      setContractFields(prev => {
        const next = { ...prev, [field]: value };
        setShapeText(7, '130', composeContractFields(next));
        return next;
      });
    },
    [setShapeText]
  );

  const updateInvestmentRow = useCallback(
    (index: number, field: keyof InvestmentRow, value: string) => {
      setInvestmentRows(prev =>
        prev.map((row, rowIndex) => {
          if (rowIndex !== index) return row;
          return { ...row, [field]: value };
        })
      );
    },
    []
  );

  const addInvestmentRow = useCallback(() => {
    setInvestmentRows(prev => [...prev, { service: '', description: '', monthly: '', contract: '' }]);
  }, []);

  const removeInvestmentRow = useCallback((index: number) => {
    setInvestmentRows(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, rowIndex) => rowIndex !== index);
    });
  }, []);

  const getPreviewShapeText = useCallback(
    (slideNumber: number, shapeId: string, originalText: string): string => {
      if (slideNumber === 1) {
        const productLineOne = coverProductLines[0] ?? 'Datacenter';
        const productLineTwo = coverProductLines[1] ?? 'Firewall';
        const clientName = coverFields.clientName.value || 'Nome do Cliente';
        const dateValue = coverFields.date.value || 'Data DD/MM/AAAA';

        return originalText
          .replace(/Nome do Cliente/g, clientName)
          .replace(/Data DD\/MM\/AAAA/g, dateValue)
          .replace(/\bDatacenter\b/g, productLineOne)
          .replace(/\bFirewall\b/g, productLineTwo);
      }

      if (slideNumber === 7 && (shapeId === '128' || shapeId === '129')) {
        return '';
      }

      if (slideNumber === 7 && shapeId === '130') {
        return composeContractFields(contractFields);
      }

      const draftShape = slideShapes[slideNumber]?.find(shape => shape.id === shapeId);
      if (draftShape) {
        return draftShape.text;
      }

      return originalText;
    },
    [coverFields.clientName.value, coverFields.date.value, coverProductLines, slideShapes, contractFields]
  );

  const buildSlide7PreviewRows = useCallback(
    (table: PreviewTableShape): PreviewTableRow[] => {
      const defaultCell: PreviewTableCell = {
        text: '',
        align: 'l',
        fontSizePt: 12,
        bold: false,
        color: '#4C6584',
        backgroundColor: null,
        fontFamily: 'Poppins',
        gridSpan: 1,
        hMerge: false,
        borderColor: '#9BA9BB'
      };

      const cloneCell = (cell?: PreviewTableCell, overrides: Partial<PreviewTableCell> = {}): PreviewTableCell => ({
        ...(cell ?? defaultCell),
        ...overrides
      });

      const headerTemplate = table.rows[0];
      const bodyTemplate =
        table.rows.find((row, index) => index > 0 && row.cells.filter(cell => !cell.hMerge).length >= 4) ?? table.rows[1];
      const totalTemplate = table.rows[Math.max(0, table.rows.length - 2)];
      const installationTemplate = table.rows[Math.max(0, table.rows.length - 1)];
      const headerLabels = ['Serviço', 'Descrição', 'Valor Mensal', 'Valor Contrato'];

      const rows: PreviewTableRow[] = [];

      if (headerTemplate) {
        const headerCells = headerTemplate.cells.map((cell, index) =>
          cloneCell(cell, {
            text: cell.hMerge ? '' : headerLabels[index] ?? cell.text,
            bold: true,
            align: 'ctr',
            color: '#FFFFFF',
            backgroundColor: '#3A597D'
          })
        );
        rows.push({
          height: headerTemplate.height,
          cells: headerCells
        });
      }

      const serviceRows = investmentRows.length
        ? investmentRows
        : [{ service: '', description: '', monthly: '', contract: '' }];

      serviceRows.forEach(row => {
        const templateCells = (bodyTemplate?.cells ?? [defaultCell, defaultCell, defaultCell, defaultCell]).map(cell =>
          cloneCell(cell)
        );
        const visibleIndexes = templateCells
          .map((cell, cellIndex) => (cell.hMerge ? -1 : cellIndex))
          .filter((cellIndex): cellIndex is number => cellIndex >= 0);

        const serviceIndex = visibleIndexes[0] ?? 0;
        const descriptionIndex = visibleIndexes[1] ?? 1;
        const monthlyIndex = visibleIndexes[2] ?? 2;
        const contractIndex = visibleIndexes[3] ?? 3;

        templateCells[serviceIndex] = cloneCell(templateCells[serviceIndex], { text: row.service, align: 'l', color: '#4C6584' });
        templateCells[descriptionIndex] = cloneCell(templateCells[descriptionIndex], {
          text: row.description,
          align: 'l',
          color: '#4C6584'
        });
        templateCells[monthlyIndex] = cloneCell(templateCells[monthlyIndex], { text: formatCurrencyText(row.monthly), align: 'r', color: '#4C6584' });
        templateCells[contractIndex] = cloneCell(templateCells[contractIndex], { text: formatCurrencyText(row.contract), align: 'r', color: '#4C6584' });

        rows.push({
          height: bodyTemplate?.height ?? 0,
          cells: templateCells
        });
      });

      if (totalTemplate) {
        const totalCells = totalTemplate.cells.map(cell =>
          cloneCell(cell, {
            text: cell.hMerge ? '' : cell.text,
            color: '#FFFFFF',
            backgroundColor: '#3A597D'
          })
        );
        const visibleIndexes = totalCells
          .map((cell, cellIndex) => (cell.hMerge ? -1 : cellIndex))
          .filter((cellIndex): cellIndex is number => cellIndex >= 0);

        const labelIndex = visibleIndexes[0];
        const monthlyIndex = visibleIndexes[1];
        const contractIndex = visibleIndexes[2];

        if (labelIndex !== undefined) {
          totalCells[labelIndex] = cloneCell(totalCells[labelIndex], {
            text: 'Total:',
            align: 'r',
            bold: true,
            color: '#FFFFFF',
            backgroundColor: '#3A597D'
          });
        }
        if (monthlyIndex !== undefined) {
          totalCells[monthlyIndex] = cloneCell(totalCells[monthlyIndex], {
            text: investmentTotals.monthly,
            align: 'r',
            bold: true,
            color: '#FFFFFF',
            backgroundColor: '#3A597D'
          });
        }
        if (contractIndex !== undefined) {
          totalCells[contractIndex] = cloneCell(totalCells[contractIndex], {
            text: investmentTotals.contract,
            align: 'r',
            bold: true,
            color: '#FFFFFF',
            backgroundColor: '#3A597D'
          });
        }

        rows.push({
          height: totalTemplate.height,
          cells: totalCells
        });
      }

      if (installationTemplate) {
        const installationCells = installationTemplate.cells.map(cell =>
          cloneCell(cell, {
            text: cell.hMerge ? '' : cell.text,
            color: '#FFFFFF',
            backgroundColor: '#3A597D'
          })
        );
        const visibleIndexes = installationCells
          .map((cell, cellIndex) => (cell.hMerge ? -1 : cellIndex))
          .filter((cellIndex): cellIndex is number => cellIndex >= 0);

        const labelIndex = visibleIndexes[0];
        const valueIndex = visibleIndexes[1];

        if (labelIndex !== undefined) {
          installationCells[labelIndex] = cloneCell(installationCells[labelIndex], {
            text: 'Taxa de Instalação',
            align: 'r',
            bold: true,
            color: '#FFFFFF',
            backgroundColor: '#3A597D'
          });
        }
        if (valueIndex !== undefined) {
          installationCells[valueIndex] = cloneCell(installationCells[valueIndex], {
            text: formatCurrencyText(installationFee),
            align: 'ctr',
            bold: true,
            color: '#FFFFFF',
            backgroundColor: '#3A597D'
          });
        }

        rows.push({
          height: installationTemplate.height,
          cells: installationCells
        });
      }

      return rows;
    },
    [investmentRows, investmentTotals.monthly, investmentTotals.contract, installationFee]
  );

  const renderPreviewSlide = useCallback(
    (slideNumber: number) => {
      const layout = slidePreviewLayouts[slideNumber];
      if (!layout) {
        return (
          <div key={`preview-slide-missing-${slideNumber}`} className="mx-auto w-full max-w-[760px] rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
            Slide {slideNumber}: preview indisponivel.
          </div>
        );
      }

      const renderTextAlign = (align: 'l' | 'ctr' | 'r' | 'just'): 'left' | 'center' | 'right' | 'justify' => {
        if (align === 'ctr') return 'center';
        if (align === 'r') return 'right';
        if (align === 'just') return 'justify';
        return 'left';
      };

      const renderVerticalAlign = (align: 't' | 'ctr' | 'b'): 'flex-start' | 'center' | 'flex-end' => {
        if (align === 'ctr') return 'center';
        if (align === 'b') return 'flex-end';
        return 'flex-start';
      };

      const renderJustifyContent = (align: 'l' | 'ctr' | 'r' | 'just'): 'flex-start' | 'center' | 'flex-end' => {
        if (align === 'ctr') return 'center';
        if (align === 'r') return 'flex-end';
        return 'flex-start';
      };

      const toPercent = (value: number, total: number): string => `${(value / total) * 100}%`;
      const toFontSizeCqw = (pt: number): string => `${Math.max(0.75, ((pt * 12700) / slideSize.cx) * 100)}cqw`;
      const toEmuCqw = (emu: number): string => `${Math.max(0, (emu / slideSize.cx) * 100)}cqw`;

      const slide7TableRows = (table: PreviewTableShape): PreviewTableRow[] => {
        if (slideNumber !== 7) return table.rows;
        return buildSlide7PreviewRows(table);
      };

      return (
        <div key={`preview-slide-${slideNumber}`} className="mx-auto w-full max-w-[760px] rounded-md border bg-white shadow-sm" style={{ fontFamily: PREVIEW_FONT_STACK }}>
          <div className="border-b bg-muted/20 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
            {SLIDE_TITLES[slideNumber] ?? `Slide ${slideNumber}`}
          </div>
          <div className="relative w-full overflow-hidden" style={{ aspectRatio: `${slideSize.cx} / ${slideSize.cy}`, containerType: 'inline-size' }}>
            {layout.backgroundSrc && (
              <img
                src={layout.backgroundSrc}
                alt={`Fundo do slide ${slideNumber}`}
                className="absolute inset-0 h-full w-full object-fill"
              />
            )}

            {layout.pictures.map(picture => {
              const cropLeft = Math.max(0, picture.cropLeft / 100000);
              const cropRight = Math.max(0, picture.cropRight / 100000);
              const cropTop = Math.max(0, picture.cropTop / 100000);
              const cropBottom = Math.max(0, picture.cropBottom / 100000);
              const visibleWidth = Math.max(0.001, 1 - cropLeft - cropRight);
              const visibleHeight = Math.max(0.001, 1 - cropTop - cropBottom);

              return (
                <div
                  key={`slide-pic-${slideNumber}-${picture.id}`}
                  className="absolute overflow-hidden"
                  style={{
                    left: toPercent(picture.x, slideSize.cx),
                    top: toPercent(picture.y, slideSize.cy),
                    width: toPercent(picture.cx, slideSize.cx),
                    height: toPercent(picture.cy, slideSize.cy)
                  }}
                >
                  <img
                    src={picture.src}
                    alt=""
                    className="absolute"
                    style={{
                      left: `${-(cropLeft / visibleWidth) * 100}%`,
                      top: `${-(cropTop / visibleHeight) * 100}%`,
                      width: `${100 / visibleWidth}%`,
                      height: `${100 / visibleHeight}%`
                    }}
                  />
                </div>
              );
            })}

            {layout.tables.map(table => {
              const rows = slide7TableRows(table);
              const columnWidths =
                table.columnWidths.length > 0
                  ? table.columnWidths
                  : Array.from({ length: Math.max(1, rows[0]?.cells.length ?? 1) }).map(() => 1);
              const columnTotal = columnWidths.reduce((sum, item) => sum + item, 0) || 1;
              const rowHeights = rows.map(row => row.height).filter(height => height > 0);
              const rowsHeightTotal = rowHeights.reduce((sum, item) => sum + item, 0);

              return (
                <div
                  key={`slide-table-${slideNumber}-${table.id}`}
                  className="absolute overflow-hidden"
                  style={{
                    left: toPercent(table.x, slideSize.cx),
                    top: toPercent(table.y, slideSize.cy),
                    width: toPercent(table.cx, slideSize.cx),
                    height: toPercent(table.cy, slideSize.cy)
                  }}
                >
                  <table className="h-full w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                    <colgroup>
                      {columnWidths.map((width, index) => (
                        <col key={`slide-table-col-${slideNumber}-${table.id}-${index}`} style={{ width: `${(width / columnTotal) * 100}%` }} />
                      ))}
                    </colgroup>
                    <tbody>
                      {rows.map((row, rowIndex) => (
                        <tr
                          key={`slide-table-row-${slideNumber}-${table.id}-${rowIndex}`}
                          style={
                            rowsHeightTotal > 0 && row.height > 0
                              ? { height: `${(row.height / rowsHeightTotal) * 100}%` }
                              : undefined
                          }
                        >
                          {row.cells.map((cell, cellIndex) => {
                            if (cell.hMerge) return null;

                            return (
                              <td
                                key={`slide-table-cell-${slideNumber}-${table.id}-${rowIndex}-${cellIndex}`}
                                colSpan={Math.max(1, cell.gridSpan || 1)}
                                className="whitespace-pre-wrap px-2 py-1 align-top"
                                style={{
                                  fontFamily: toCssFontFamily(cell.fontFamily),
                                  fontSize: toFontSizeCqw(cell.fontSizePt || 10),
                                  fontWeight: cell.bold ? 700 : 500,
                                  color: cell.color || '#4C6584',
                                  backgroundColor: cell.backgroundColor ?? 'transparent',
                                  textAlign: renderTextAlign(cell.align),
                                  border: `1px solid ${cell.borderColor ?? '#9BA9BB'}`,
                                  lineHeight: 1.12
                                }}
                              >
                                {cell.text}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}

            {layout.textShapes.map(shape => {
              const text = getPreviewShapeText(slideNumber, shape.id, shape.text).trim();
              if (!text) return null;
              const frame = {
                ...shape,
                ...(SHAPE_LAYOUT_OVERRIDES[slideNumber]?.[shape.id] ?? {})
              };

              if (slideNumber === 6 && shape.id === '121' && slide6RenderedPremissas.length > 0) {
                return (
                  <div
                    key={`slide-text-${slideNumber}-${shape.id}`}
                    className="absolute overflow-hidden"
                    style={{
                      left: toPercent(frame.x, slideSize.cx),
                      top: toPercent(frame.y, slideSize.cy),
                      width: toPercent(frame.cx, slideSize.cx),
                      height: toPercent(frame.cy, slideSize.cy),
                      fontFamily: toCssFontFamily(shape.fontFamily),
                      fontSize: toFontSizeCqw(shape.fontSizePt || 14),
                      lineHeight: 1.1,
                      color: shape.color || '#4C6584',
                      padding: '0.15cqw'
                    }}
                  >
                    {slide6RenderedPremissas.map((paragraph, index) => {
                      const markerWidth = paragraph.markerWidth > 0 ? paragraph.markerWidth : 220000;
                      const textPadding = paragraph.prefix
                        ? '0'
                        : toEmuCqw(Math.max(0, paragraph.textStart - paragraph.markerStart));

                      return (
                        <div
                          key={`premissas-line-${index}`}
                          className="flex items-start"
                          style={{
                            paddingLeft: toEmuCqw(paragraph.markerStart),
                            marginBottom: '0.06cqw'
                          }}
                        >
                          {paragraph.prefix ? (
                            <span
                              style={{
                                flex: `0 0 ${toEmuCqw(markerWidth)}`,
                                width: toEmuCqw(markerWidth),
                                textAlign: 'left',
                                paddingRight: '0.2cqw',
                                fontWeight: paragraph.bold ? 700 : 500
                              }}
                            >
                              {paragraph.prefix}
                            </span>
                          ) : null}
                          <span
                            style={{
                              flex: '1 1 auto',
                              paddingLeft: textPadding,
                              textAlign: renderTextAlign(paragraph.align),
                              textJustify: paragraph.align === 'just' ? 'inter-word' : 'auto',
                              fontWeight: paragraph.bold ? 700 : 500
                            }}
                          >
                            {paragraph.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div
                  key={`slide-text-${slideNumber}-${shape.id}`}
                  className="absolute overflow-hidden whitespace-pre-wrap"
                  style={{
                    left: toPercent(frame.x, slideSize.cx),
                    top: toPercent(frame.y, slideSize.cy),
                    width: toPercent(frame.cx, slideSize.cx),
                    height: toPercent(frame.cy, slideSize.cy),
                    display: 'flex',
                    alignItems: renderVerticalAlign(shape.verticalAlign),
                    justifyContent: renderJustifyContent(shape.align),
                    fontFamily: toCssFontFamily(shape.fontFamily),
                    fontSize: toFontSizeCqw(shape.fontSizePt || 14),
                    fontWeight: shape.bold ? 700 : 500,
                    fontStyle: shape.italic ? 'italic' : 'normal',
                    lineHeight: 1.22,
                    color: shape.color || '#4C6584',
                    padding: '0.2cqw'
                  }}
                >
                  <div
                    className="w-full"
                    style={{
                      textAlign: renderTextAlign(shape.align),
                      textJustify: shape.align === 'just' ? 'inter-word' : 'auto'
                    }}
                  >
                    {text}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    },
    [slidePreviewLayouts, slideSize, getPreviewShapeText, buildSlide7PreviewRows, slide6RenderedPremissas]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Controle da Proposta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline">
              <a href={PPTX_URL} download>
                <Download className="mr-2 h-4 w-4" />
                Baixar Proposta (Original)
              </a>
            </Button>

            <Button variant="secondary" onClick={handlePreviewProposal} disabled={loading || Boolean(error) || isWorking}>
              {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
              Visualizar proposta completa
            </Button>

            <Button variant="outline" onClick={handleSaveProposal} disabled={loading || Boolean(error) || isWorking}>
              {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar proposta
            </Button>

            <Button onClick={handleDownloadEdited} disabled={loading || Boolean(error) || !pptxBuffer || isWorking}>
              {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar PowerPoint PPTX (10 Lâminas)
            </Button>

            <Button
              onClick={handlePrintPdf}
              className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-cyan-950/40"
              disabled={loading || Boolean(error) || isWorking}
            >
              <FileText className="mr-2 h-4 w-4 text-cyan-200" />
              Gerar PDF Oficial (10 Lâminas)
            </Button>

            <Button variant="ghost" onClick={handleNewProposal} disabled={loading || Boolean(error) || isWorking}>
              Nova proposta
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">Visualizacao com partes editaveis e fixas para todos os slides.</p>
          {activeProposalNumber && (
            <div className="flex flex-wrap items-center gap-4 rounded-md border bg-muted/20 px-3 py-2 text-sm">
              <span className="font-semibold">Proposta {activeProposalNumber}</span>
              <span className="text-muted-foreground">Data: {coverFields.date.value || formatProposalDate()}</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A opcao visualizar exibe os slides 1 a 10, incluindo 1, 2, 3 e os demais fixos.
          </p>

          {lastSavedAt && (
            <p className="text-xs text-muted-foreground">
              Ultimo salvamento: {new Date(lastSavedAt).toLocaleString('pt-BR')}
            </p>
          )}

          {saveMessage && <p className="text-xs text-muted-foreground">{saveMessage}</p>}

          <div className="rounded-md border">
            <div className="border-b bg-muted/40 px-3 py-2 text-sm font-medium">Propostas salvas</div>
            <div className="grid grid-cols-1 gap-2 border-b p-3 md:grid-cols-4">
              <Input
                placeholder="Filtrar por cliente, data ou produto"
                value={proposalFilterText}
                onChange={event => setProposalFilterText(event.target.value)}
              />
              <Input
                type="date"
                value={proposalFilterSavedDate}
                onChange={event => setProposalFilterSavedDate(event.target.value)}
              />
              <select
                className="h-10 rounded-md border bg-background px-3 text-sm"
                value={proposalSortOrder}
                onChange={event => setProposalSortOrder(event.target.value as 'recent' | 'oldest' | 'client')}
              >
                <option value="recent">Mais recentes</option>
                <option value="oldest">Mais antigas</option>
                <option value="client">Cliente (A-Z)</option>
              </select>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setProposalFilterText('');
                  setProposalFilterSavedDate('');
                  setProposalSortOrder('recent');
                }}
              >
                Limpar filtros
              </Button>
            </div>
            {savedProposals.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Nenhuma proposta salva ainda.</p>
            ) : filteredSavedProposals.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">Nenhuma proposta encontrada para os filtros.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/20">
                    <tr>
                      <th className="px-3 py-2 text-left">Cliente</th>
                      <th className="px-3 py-2 text-left">Número</th>
                      <th className="px-3 py-2 text-left">Data</th>
                      <th className="px-3 py-2 text-left">Produto</th>
                      <th className="px-3 py-2 text-left">Salvo em</th>
                      <th className="px-3 py-2 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSavedProposals.map(entry => (
                      <tr key={entry.id} className={`border-t ${entry.id === activeProposalId ? 'bg-muted/30' : ''}`}>
                        <td className="px-3 py-2">{entry.draft.cover.clientName || entry.title}</td>
                        <td className="px-3 py-2">{normalizeProposalNumber(entry) || '-'}</td>
                        <td className="px-3 py-2">{entry.draft.cover.date || '-'}</td>
                        <td className="px-3 py-2">{(entry.draft.cover.product || '').split('\n').join(' / ') || '-'}</td>
                        <td className="px-3 py-2">{new Date(entry.savedAt).toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleLoadProposalForPreview(entry.id)}
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              Visualizar
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => handleLoadProposalForEdit(entry.id)}
                            >
                              <Pencil className="mr-1 h-4 w-4" />
                              Editar
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeleteSavedProposal(entry.id)}
                            >
                              <Trash2 className="mr-1 h-4 w-4" />
                              Excluir
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showPreview && !loading && !error && (
        <Card ref={previewRef}>
          <CardHeader>
            <CardTitle>Visualizacao da Proposta (Layout)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {Array.from({ length: TOTAL_SLIDES }, (_value, index) => renderPreviewSlide(index + 1))}
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando proposta...
        </div>
      )}

      {error && (
        <div className="flex flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <p>{error}</p>
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReloadKey(k => k + 1)}
              className="gap-2 bg-white"
            >
              <RefreshCw className="h-4 w-4" />
              Tentar Novamente
            </Button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Slide 1 - Capa (Comercial)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="cover-client-name">Nome do Cliente</Label>
              <Input
                id="cover-client-name"
                value={coverFields.clientName.value}
                onChange={event =>
                  setCoverFields(prev => ({
                    ...prev,
                    clientName: { value: event.target.value }
                  }))
                }
              />
            </div>

            <div>
              <Label htmlFor="cover-date">Data</Label>
              <Input
                id="cover-date"
                value={coverFields.date.value}
                onChange={event =>
                  setCoverFields(prev => ({
                    ...prev,
                    date: { value: event.target.value }
                  }))
                }
              />
            </div>

            <div>
              <Label htmlFor="cover-product">Produto</Label>
              <Textarea
                id="cover-product"
                rows={3}
                value={coverFields.product.value}
                onChange={event =>
                  setCoverFields(prev => ({
                    ...prev,
                    product: { value: event.target.value }
                  }))
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Use uma linha por produto para manter o layout (ex.: Datacenter e Firewall).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Slide 3 - Nossos Clientes (Print 1)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label htmlFor="slide3-clients-text">Texto de Apresentação dos Clientes</Label>
              <Textarea
                id="slide3-clients-text"
                rows={4}
                value={getShapeText(3, '41')}
                onChange={event => setShapeText(3, '41', event.target.value)}
                placeholder="Acreditamos que o sucesso do nosso negócio..."
              />
              <p className="mt-2 text-xs text-muted-foreground">
                Texto descritivo exibido acima da grade institucional com os 24 logos de clientes parceiros atendidos pela Double.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Slide 4 - Descritivo do Produto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="slide4-descritivo">Descritivo</Label>
                <Textarea
                  id="slide4-descritivo"
                  rows={5}
                  value={slide4Descritivo}
                  onChange={event => setShapeText(4, '97', event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="slide4-caracteristicas">Caracteristicas</Label>
                <Textarea
                  id="slide4-caracteristicas"
                  rows={5}
                  value={slide4Caracteristicas}
                  onChange={event => setShapeText(4, '102', composeCaracteristicasValue(event.target.value))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slide 5 - Escopo do Projeto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="slide5-escopo">Escopo do Projeto</Label>
                <Textarea
                  id="slide5-escopo"
                  rows={6}
                  value={slide5Escopo}
                  onChange={event => setShapeText(5, '107', event.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Diferenciais permanecem no texto padrao do anexo.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slide 6 - Premissas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="slide6-premissas">Premissas (padrao editavel)</Label>
                <Textarea
                  id="slide6-premissas"
                  rows={12}
                  value={slide6Premissas}
                  onChange={event => setShapeText(6, '121', event.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slide 7 - Investimento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Label>Quadro de Valores</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addInvestmentRow}>
                    Adicionar serviço
                  </Button>
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="min-w-[1100px] w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Serviço</th>
                        <th className="px-3 py-2 text-left">Descrição</th>
                        <th className="px-3 py-2 text-left">Valor Mensal</th>
                        <th className="px-3 py-2 text-left">Valor Contrato</th>
                        <th className="px-3 py-2 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investmentRows.map((row, index) => (
                        <tr key={`row-${index}`} className="border-t">
                          <td className="p-2">
                            <Textarea
                              rows={2}
                              value={row.service}
                              onChange={event => updateInvestmentRow(index, 'service', event.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <Textarea
                              rows={2}
                              value={row.description}
                              onChange={event => updateInvestmentRow(index, 'description', event.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={row.monthly}
                              onChange={event => updateInvestmentRow(index, 'monthly', event.target.value)}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={row.contract}
                              onChange={event => updateInvestmentRow(index, 'contract', event.target.value)}
                            />
                          </td>
                          <td className="p-2 text-right">
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => removeInvestmentRow(index)}
                              disabled={investmentRows.length <= 1}
                            >
                              Excluir
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t bg-muted/50">
                        <td colSpan={2} className="px-3 py-2 text-right font-semibold">Total:</td>
                        <td className="px-3 py-2 font-semibold">{investmentTotals.monthly}</td>
                        <td className="px-3 py-2 font-semibold">{investmentTotals.contract}</td>
                        <td />
                      </tr>
                      <tr className="border-t bg-muted/50">
                        <td colSpan={2} className="px-3 py-2 text-right font-semibold">Taxa de Instalação</td>
                        <td colSpan={2} className="p-2">
                          <Input
                            value={installationFee}
                            onChange={event => setInstallationFee(event.target.value)}
                          />
                        </td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">
                  Você pode adicionar ou excluir serviços. O arquivo PPTX será gerado com a mesma quantidade de linhas.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <Label htmlFor="slide7-vigencia">Vigencia do contrato</Label>
                  <Input
                    id="slide7-vigencia"
                    value={contractFields.vigencia}
                    onChange={event => updateContractField('vigencia', event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="slide7-prazo">Prazo de entrega</Label>
                  <Input
                    id="slide7-prazo"
                    value={contractFields.prazo}
                    onChange={event => updateContractField('prazo', event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="slide7-termos">Termos e condicoes</Label>
                  <Textarea
                    id="slide7-termos"
                    rows={2}
                    value={contractFields.termos}
                    onChange={event => updateContractField('termos', event.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Slide 8 - Conteudo Editavel</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {slide8Shapes.map((shape, index) => (
                <div key={shape.id}>
                  <Label htmlFor={`slide-8-shape-${index}`}>{shape.label}</Label>
                  {shape.helperText && <p className="mb-1 text-xs text-muted-foreground">{shape.helperText}</p>}
                  <Textarea
                    id={`slide-8-shape-${index}`}
                    rows={Math.min(10, Math.max(4, shape.text.split('\n').length + 1))}
                    value={shape.text}
                    onChange={event => setShapeText(8, shape.id, event.target.value)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
