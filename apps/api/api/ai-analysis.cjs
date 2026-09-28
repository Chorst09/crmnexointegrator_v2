const express = require('express');
const { PDFParse } = require('pdf-parse');
const { requireRole } = require('../lib/auth.cjs');

const router = express.Router();
const USER_ALLOWED_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'SELLER', 'PRE_SALES', 'USER'];

const MAX_TEXT_CHARS = 120000;

const cleanText = (value, max = MAX_TEXT_CHARS) => {
  if (typeof value !== 'string') return '';
  const normalized = value
    .replace(/\u0000/g, ' ')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!normalized) return '';
  return normalized.slice(0, max);
};

const parseDataUri = (dataUri) => {
  if (typeof dataUri !== 'string' || !dataUri.trim()) {
    throw new Error('fileDataUri obrigatorio.');
  }

  const match = dataUri.match(/^data:([^;,]+)?;base64,([a-z0-9+/=\s]+)$/i);
  if (!match) {
    throw new Error('fileDataUri invalido. Envie Data URI em base64.');
  }

  const mimeType = String(match[1] || 'application/octet-stream').toLowerCase();
  const base64Data = match[2].replace(/\s+/g, '');

  let buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch {
    throw new Error('Base64 invalido no fileDataUri.');
  }

  if (!buffer || buffer.length === 0) {
    throw new Error('Arquivo vazio no fileDataUri.');
  }

  return { mimeType, buffer };
};

const extractPdfText = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    return {
      text: cleanText(parsed?.text || ''),
      totalPages: Number(parsed?.total || parsed?.pages?.length || 0)
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
};

const normalizeLine = (line) => String(line || '').replace(/[ \t]+/g, ' ').trim();

const splitLines = (text) =>
  String(text || '')
    .split(/\n+/)
    .map(normalizeLine)
    .filter((line) => line.length >= 4);

const unique = (list) => [...new Set((Array.isArray(list) ? list : []).filter(Boolean))];

const findCapture = (text, regex) => {
  const match = String(text || '').match(regex);
  return match?.[1] ? normalizeLine(match[1]) : '';
};

const DATE_MONTH_INDEX = {
  jan: 1,
  janeiro: 1,
  fev: 2,
  fevereiro: 2,
  mar: 3,
  marco: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  jun: 6,
  junho: 6,
  jul: 7,
  julho: 7,
  ago: 8,
  agosto: 8,
  set: 9,
  setembro: 9,
  out: 10,
  outubro: 10,
  nov: 11,
  novembro: 11,
  dez: 12,
  dezembro: 12
};

const toNumber = (value) => Number.parseInt(String(value || ''), 10);
const pad2 = (value) => String(value).padStart(2, '0');

const normalizePlainText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const isUnknownText = (value) =>
  /^(nao identificado|nao informad[oa]|n\/a|na|nd|-|--)?$/.test(normalizePlainText(value));

const formatBrDate = (dayValue, monthValue, yearValue) => {
  const day = toNumber(dayValue);
  const month = toNumber(monthValue);
  let year = toNumber(yearValue);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return '';
  if (year < 100) year += 2000;
  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) return '';

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return '';
  }

  return `${pad2(day)}/${pad2(month)}/${String(year).padStart(4, '0')}`;
};

const extractDateFromValue = (value) => {
  const text = String(value || '');
  if (!text) return '';

  const br = text.match(/\b([0-3]?\d)[\/\-.]([0-1]?\d)[\/\-.](\d{2,4})\b/);
  if (br) {
    const normalized = formatBrDate(br[1], br[2], br[3]);
    if (normalized) return normalized;
  }

  const iso = text.match(/\b(20\d{2})[\/\-.]([0-1]?\d)[\/\-.]([0-3]?\d)\b/);
  if (iso) {
    const normalized = formatBrDate(iso[3], iso[2], iso[1]);
    if (normalized) return normalized;
  }

  const extenso = text.match(
    /\b([0-3]?\d)\s*(?:de\s+)?(janeiro|fevereiro|mar[cç]o|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan\.?|fev\.?|mar\.?|abr\.?|mai\.?|jun\.?|jul\.?|ago\.?|set\.?|out\.?|nov\.?|dez\.?)\s*(?:de\s+)?(\d{2,4})\b/i
  );
  if (extenso) {
    const monthKey = normalizePlainText(extenso[2]).replace(/\.$/, '');
    const month = DATE_MONTH_INDEX[monthKey] || 0;
    const normalized = month ? formatBrDate(extenso[1], month, extenso[3]) : '';
    if (normalized) return normalized;
  }

  return '';
};

const findDateLike = (text, regex) => {
  return extractDateFromValue(findCapture(text, regex));
};

const extractTimeFromValue = (value) => {
  const text = String(value || '');
  const hhmm = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (hhmm) return `${pad2(hhmm[1])}:${hhmm[2]}`;

  const hh = text.match(/\b([01]?\d|2[0-3])h(?:\s*([0-5]\d))?\b/i);
  if (hh) return `${pad2(hh[1])}:${hh[2] || '00'}`;

  return '';
};

const findTimeLike = (text, regex) => {
  return extractTimeFromValue(findCapture(text, regex));
};

const extractDateFromLineWindows = (lines, keywordPatterns = [], lookahead = 2) => {
  if (!Array.isArray(lines) || lines.length === 0 || !Array.isArray(keywordPatterns) || keywordPatterns.length === 0) {
    return '';
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!keywordPatterns.some((pattern) => pattern.test(line))) continue;

    const from = Math.max(0, index - 1);
    const to = Math.min(lines.length, index + lookahead + 1);
    const windowText = lines.slice(from, to).join(' ');
    const date = extractDateFromValue(windowText);
    if (date) return date;
  }

  return '';
};

const extractTimeFromLineWindows = (lines, keywordPatterns = [], lookahead = 2) => {
  if (!Array.isArray(lines) || lines.length === 0 || !Array.isArray(keywordPatterns) || keywordPatterns.length === 0) {
    return '';
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!keywordPatterns.some((pattern) => pattern.test(line))) continue;

    const from = Math.max(0, index - 1);
    const to = Math.min(lines.length, index + lookahead + 1);
    const windowText = lines.slice(from, to).join(' ');
    const hour = extractTimeFromValue(windowText);
    if (hour) return hour;
  }

  return '';
};

const extractTextFromLineWindows = (lines, keywordPatterns = [], lookahead = 2, max = 240) => {
  if (!Array.isArray(lines) || lines.length === 0 || !Array.isArray(keywordPatterns) || keywordPatterns.length === 0) {
    return '';
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!keywordPatterns.some((pattern) => pattern.test(line))) continue;

    const from = Math.max(0, index - 1);
    const to = Math.min(lines.length, index + lookahead + 1);
    const windowText = normalizeLine(lines.slice(from, to).join(' '));
    if (windowText) return windowText.slice(0, max);
  }

  return '';
};

const extractDateFromTextByKeywords = (text, keywordPatterns = [], lookahead = 2) =>
  extractDateFromLineWindows(splitLines(text), keywordPatterns, lookahead);

const extractTimeFromTextByKeywords = (text, keywordPatterns = [], lookahead = 2) =>
  extractTimeFromLineWindows(splitLines(text), keywordPatterns, lookahead);

const extractTextFromTextByKeywords = (text, keywordPatterns = [], lookahead = 2, max = 240) =>
  extractTextFromLineWindows(splitLines(text), keywordPatterns, lookahead, max);

const sanitizeContractTerm = (value, max = 160) => {
  let text = normalizeLine(value || '');
  if (!text || isUnknownText(text)) return '';

  text = text.replace(
    /^(?:vig[êe]ncia(?:\s+contratual)?|prazo\s+de\s+vig[êe]ncia|prazo\s+contratual|dura[cç][aã]o\s+do\s+contrato)\s*[:\-]?\s*/i,
    ''
  );
  text = normalizeLine(text);

  if (!text || text.length < 4 || /^[,.;:\-)\]]/.test(text)) return '';
  if (!/\d/.test(text) && !/\b(vig[êe]ncia|prazo|dura[cç][aã]o|mes(?:es)?|ano(?:s)?|dia(?:s)?|semanas?)\b/i.test(text)) {
    return '';
  }

  return text.slice(0, max);
};

const pickDateValue = (candidate, fallback) => extractDateFromValue(candidate) || extractDateFromValue(fallback) || 'Não identificado';

const pickTimeValue = (candidate, fallback) => extractTimeFromValue(candidate) || extractTimeFromValue(fallback) || 'Não identificado';

const pickContractTermValue = (candidate, fallback) => sanitizeContractTerm(candidate) || sanitizeContractTerm(fallback) || 'Não identificado';

const detectModality = (text) => {
  const m = String(text || '').match(
    /(preg[aã]o(?:\s+eletr[oô]nico)?|concorr[eê]ncia|dispensa(?:\s+eletr[oô]nica)?|inexigibilidade|tomada\s+de\s+pre[cç]os)/i
  );
  return normalizeLine(m?.[1] || '');
};

const detectPortal = (text) => {
  const direct = findCapture(text, /(?:portal|plataforma|sistema)\s*[:\-]\s*([^\n]{3,180})/i);
  if (direct) return direct;

  if (/comprasnet|gov\.br\/compras/i.test(text)) return 'Compras.gov.br';
  if (/licitacoes-e/i.test(text)) return 'Licitações-e';
  if (/bec\s*\/\s*sp|bolsa eletr[oô]nica de compras/i.test(text)) return 'BEC/SP';
  return 'Não identificado';
};

const detectAgency = (text) => {
  const direct = findCapture(
    text,
    /(?:[óo]rg[aã]o\s+licitante|entidade\s+demandante|unidade\s+demandante|secretaria)\s*[:\-]\s*([^\n]{3,220})/i
  );
  if (direct) return direct;

  const heuristic = findCapture(
    text,
    /(prefeitura(?:\s+municipal)?\s+de\s+[^\n,;]{3,140}|governo\s+do\s+estado\s+de\s+[^\n,;]{3,140}|tribunal\s+[^\n,;]{3,140}|minist[eé]rio\s+[^\n,;]{3,140})/i
  );
  return heuristic || 'Não identificado';
};

const detectObjectSummary = (text) => {
  const objectLine = findCapture(text, /(?:objeto(?:\s+da\s+licita[cç][aã]o)?)\s*[:\-]\s*([\s\S]{10,800})/i);
  if (objectLine) return objectLine.slice(0, 400);

  const lines = splitLines(text);
  const candidate = lines.find((line) => /contrata[cç][aã]o|aquisi[cç][aã]o|fornecimento|servi[cç]o/i.test(line));
  return (candidate || 'Não identificado').slice(0, 400);
};

const collectByKeywords = (lines, keywords, limit = 12) => {
  const result = [];
  for (const line of lines) {
    const lower = line.toLowerCase();
    if (keywords.some((keyword) => lower.includes(keyword))) {
      result.push(line);
      if (result.length >= limit) break;
    }
  }
  return unique(result);
};

const tokenize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4)
    .filter((token) => ![
      'para', 'com', 'pela', 'pelo', 'uma', 'como', 'deve', 'devera', 'sobre', 'entre', 'este', 'esta', 'quando',
      'sera', 'serao', 'item', 'lote', 'modelo', 'arquivo', 'documento', 'termo', 'referencia', 'nao', 'identificado'
    ].includes(token));

const tryParseJsonObject = (rawContent) => {
  if (!rawContent || typeof rawContent !== 'string') return null;
  try {
    const parsed = JSON.parse(rawContent);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // ignore direct parse errors
  }

  const start = rawContent.indexOf('{');
  const end = rawContent.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  try {
    return JSON.parse(rawContent.slice(start, end + 1));
  } catch {
    return null;
  }
};

const getGeminiApiKey = () =>
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY ||
  '';

const shouldRetryByMessage = (message) => {
  const lower = String(message || '').toLowerCase();
  return lower.includes('resource_exhausted') || lower.includes('quota') || lower.includes('429');
};

const retryDelayMsFromMessage = (message, fallbackMs) => {
  const m = String(message || '').match(/retry in ([\d.]+)s/i);
  if (!m) return fallbackMs;
  const secs = Number.parseFloat(m[1]);
  if (!Number.isFinite(secs)) return fallbackMs;
  return Math.max(500, Math.ceil(secs * 1000) + 500);
};

const resolveDataUriField = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^data:[^;,]+;base64,[a-z0-9+/=\s]+$/i.test(trimmed) ? trimmed : '';
};

const resolveInlineTextField = (value, max = MAX_TEXT_CHARS) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || /^data:/i.test(trimmed)) return '';
  return cleanText(trimmed, max);
};

const getMainFileDataUri = (payload) =>
  resolveDataUriField(payload?.fileDataUri) ||
  resolveDataUriField(payload?.fileData);

const getDatasheetFileDataUri = (payload) =>
  resolveDataUriField(payload?.datasheetFileDataUri) ||
  resolveDataUriField(payload?.datasheetData);

const getMainInlineText = (payload) => resolveInlineTextField(payload?.fileData, MAX_TEXT_CHARS);

const getDatasheetInlineText = (payload) => resolveInlineTextField(payload?.datasheetData, 30000);

const ANALYSIS_SCHEMAS = {
  request_edital: {
    type: 'object',
    properties: {
      fileDataUri: { type: 'string', minLength: 1 }
    },
    required: ['fileDataUri']
  },
  response_edital: {
    type: 'object',
    properties: {
      general: {
        type: 'object',
        properties: {
          openingDate: { type: 'string' },
          openingTime: { type: 'string' },
          portal: { type: 'string' },
          agency: { type: 'string' },
          modality: { type: 'string' },
          objectSummary: { type: 'string' }
        },
        required: ['openingDate', 'openingTime', 'portal', 'agency', 'modality', 'objectSummary']
      },
      deadlines: {
        type: 'object',
        properties: {
          publicationDate: { type: 'string' },
          impugnationDeadline: { type: 'string' },
          clarificationDeadline: { type: 'string' },
          proposalDeadline: { type: 'string' },
          contractTerm: { type: 'string' }
        },
        required: ['publicationDate', 'impugnationDeadline', 'clarificationDeadline', 'proposalDeadline', 'contractTerm']
      },
      requirements: {
        type: 'object',
        properties: {
          legal: { type: 'array', items: { type: 'string' } },
          technical: { type: 'array', items: { type: 'string' } },
          economic: { type: 'array', items: { type: 'string' } },
          fiscal: { type: 'array', items: { type: 'string' } }
        },
        required: ['legal', 'technical', 'economic', 'fiscal']
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'string' },
            specs: { type: 'string' }
          },
          required: ['name', 'quantity', 'specs']
        }
      },
      risks: {
        type: 'array',
        items: { type: 'string' }
      }
    },
    required: ['general', 'deadlines', 'requirements', 'items', 'risks']
  },
  request_tr: {
    type: 'object',
    properties: {
      fileDataUri: { type: 'string', minLength: 1 },
      analyzedModelName: { type: 'string', minLength: 1 },
      analyzedModelManufacturer: { type: 'string' },
      analyzedModelSpecs: { type: 'string', minLength: 1 },
      datasheetFileDataUri: { type: 'string' },
      datasheetFileName: { type: 'string' }
    },
    required: ['fileDataUri', 'analyzedModelName', 'analyzedModelSpecs']
  },
  response_tr: {
    type: 'object',
    properties: {
      analysisType: { type: 'string', enum: ['tr'] },
      trSummary: { type: 'string' },
      analyzedModel: {
        type: 'object',
        properties: {
          modelName: { type: 'string' },
          manufacturer: { type: 'string' },
          providedSpecs: { type: 'string' }
        },
        required: ['modelName', 'providedSpecs']
      },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            quantity: { type: 'string' },
            specs: { type: 'string' }
          },
          required: ['name', 'quantity', 'specs']
        }
      },
      termRequirements: {
        type: 'array',
        items: { type: 'string' }
      },
      technicalNotebook: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            termRequirement: { type: 'string' },
            meetsRequirement: { type: 'string', enum: ['ATENDE', 'NAO_ATENDE'] },
            datasheetEvidence: { type: 'string' },
            rationale: { type: 'string' }
          },
          required: ['termRequirement', 'meetsRequirement', 'rationale']
        }
      },
      compliantEquipment: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            model: { type: 'string' },
            manufacturer: { type: 'string' },
            rationale: { type: 'string' }
          },
          required: ['model', 'manufacturer', 'rationale']
        }
      },
      complianceOverview: {
        type: 'object',
        properties: {
          totalRequirements: { type: 'number' },
          metRequirements: { type: 'number' },
          fullCompliance: { type: 'boolean' }
        },
        required: ['totalRequirements', 'metRequirements', 'fullCompliance']
      }
    },
    required: ['analysisType', 'trSummary', 'analyzedModel', 'items', 'termRequirements', 'technicalNotebook', 'compliantEquipment', 'complianceOverview']
  }
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const validateBySchema = (schema, data, path = '$') => {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;

  if (schema.type === 'object') {
    if (!isPlainObject(data)) {
      errors.push(`${path} deve ser objeto.`);
      return errors;
    }

    const required = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) {
        errors.push(`${path}.${key} é obrigatório.`);
      }
    }

    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    for (const [key, propSchema] of Object.entries(properties)) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      errors.push(...validateBySchema(propSchema, data[key], `${path}.${key}`));
    }

    return errors;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(data)) {
      errors.push(`${path} deve ser array.`);
      return errors;
    }

    if (schema.items && typeof schema.items === 'object') {
      data.forEach((item, index) => {
        errors.push(...validateBySchema(schema.items, item, `${path}[${index}]`));
      });
    }

    return errors;
  }

  if (schema.type === 'string') {
    if (typeof data !== 'string') {
      errors.push(`${path} deve ser string.`);
      return errors;
    }
    if (Number.isFinite(schema.minLength) && data.length < schema.minLength) {
      errors.push(`${path} deve ter no mínimo ${schema.minLength} caracteres.`);
    }
  } else if (schema.type === 'number') {
    if (typeof data !== 'number' || !Number.isFinite(data)) {
      errors.push(`${path} deve ser number.`);
      return errors;
    }
  } else if (schema.type === 'boolean') {
    if (typeof data !== 'boolean') {
      errors.push(`${path} deve ser boolean.`);
      return errors;
    }
  }

  if (Array.isArray(schema.enum) && schema.enum.length > 0 && !schema.enum.includes(data)) {
    errors.push(`${path} deve ser um de: ${schema.enum.join(', ')}.`);
  }

  return errors;
};

const schemaErrorsToMessage = (errors) =>
  (Array.isArray(errors) ? errors : [])
    .slice(0, 5)
    .join(' ');

const buildTemplatePrompt = ({ mode, payload }) => {
  const common = [
    'Você é um Especialista em Licitações B2G e Engenharia de Pré-Vendas.',
    '',
    'Você vai receber um modo de análise:',
    '- "edital" para extração estruturada do edital completo',
    '- "tr" para análise técnica do Termo de Referência comparando com modelo/datasheet',
    '',
    'Regras gerais:',
    '1) Leia todo o documento enviado.',
    '2) Retorne SOMENTE JSON válido (sem markdown, sem texto extra).',
    '3) Se uma informação textual não for encontrada, use "Não identificado".',
    '4) Para listas sem dados, use [].',
    '5) Seja objetivo, técnico e sem suposições não suportadas pelo documento.'
  ];

  const inputExample = [
    '{',
    '  "mode": "{{mode}}",',
    '  "fileData": "{{pdf_text_or_multimodal_pdf}}",',
    '  "analyzedModelName": "{{model_name_if_tr}}",',
    '  "analyzedModelManufacturer": "{{manufacturer_if_tr_optional}}",',
    '  "analyzedModelSpecs": "{{specs_if_tr}}",',
    '  "datasheetData": "{{datasheet_text_or_pdf_optional}}",',
    '  "datasheetFileName": "{{datasheet_filename_optional}}"',
    '}'
  ].join('\n');

  if (mode === 'edital') {
    return [
      ...common,
      '',
      'ENTRADA (exemplo):',
      inputExample,
      '',
      'SE mode == "edital":',
      '- Extraia:',
      '  - general.openingDate (DD/MM/AAAA)',
      '  - general.openingTime (HH:MM)',
      '  - general.portal',
      '  - general.agency',
      '  - general.modality',
      '  - general.objectSummary',
      '  - deadlines.publicationDate',
      '  - deadlines.impugnationDeadline',
      '  - deadlines.clarificationDeadline',
      '  - deadlines.proposalDeadline',
      '  - deadlines.contractTerm',
      '  - requirements.legal[]',
      '  - requirements.technical[]',
      '  - requirements.economic[]',
      '  - requirements.fiscal[]',
      '  - items[] com { name, quantity, specs }',
      '  - risks[] com cláusulas restritivas, multas e riscos operacionais/jurídicos',
      '',
      'JSON DE SAÍDA (mode edital):',
      JSON.stringify({
        general: {
          openingDate: '',
          openingTime: '',
          portal: '',
          agency: '',
          modality: '',
          objectSummary: ''
        },
        deadlines: {
          publicationDate: '',
          impugnationDeadline: '',
          clarificationDeadline: '',
          proposalDeadline: '',
          contractTerm: ''
        },
        requirements: {
          legal: [],
          technical: [],
          economic: [],
          fiscal: []
        },
        items: [
          { name: '', quantity: '', specs: '' }
        ],
        risks: []
      }, null, 2)
    ].join('\n');
  }

  return [
    ...common,
    '',
    'ENTRADA (exemplo):',
    inputExample,
    '',
    'SE mode == "tr":',
    '- Sua tarefa principal é EXCLUSIVAMENTE extrair o catálogo técnico do Edital/TR.',
    '- items[] deve conter APENAS produtos, equipamentos, softwares, licenças, serviços, lotes ou itens contratados.',
    '- items[].name deve ser curto e comercial, sem título de seção. Exemplo: "switch 48 portas", "desktop i7", "licença de software".',
    '- items[].quantity deve trazer a quantidade e unidade quando houver. Exemplo: "500", "10 unidades", "25 licenças".',
    '- items[].specs deve trazer o resumo técnico completo do item: capacidade, portas, processador, memória, armazenamento, módulos, licenças, garantia técnica, suporte, instalação, compatibilidade e requisitos mínimos.',
    '- trSummary deve ser somente um resumo completo das especificações dos produtos/itens encontrados, agrupado por item.',
    '- NÃO inclua em items[] ou trSummary: preâmbulo, sumário/índice, disponibilidade financeira, parâmetros da licitação, elementos instrutores, retirada/alteração do edital, publicidade dos atos, prazos, vigência, documentos, habilitação, julgamento, sanções, multas ou obrigações administrativas.',
    '- NÃO faça recomendação comercial, aderência do modelo, análise jurídica ou análise geral do edital no trSummary.',
    '- technicalNotebook deve conter apenas requisitos técnicos diretamente ligados aos produtos, quando existirem.',
    '- meetsRequirement deve ser EXATAMENTE "ATENDE" ou "NAO_ATENDE".',
    '- datasheetEvidence deve sempre ser preenchido no formato:',
    '  - ATENDE: "TR exige [requisito]. Modelo possui [evidência objetiva]"',
    '  - NAO_ATENDE: "TR exige [requisito]. Modelo possui [diferença] ou Não identificado"',
    '',
    'Validação interna obrigatória (mode tr):',
    '- complianceOverview.totalRequirements = technicalNotebook.length',
    '- complianceOverview.metRequirements = quantidade de "ATENDE"',
    '- complianceOverview.fullCompliance = (metRequirements == totalRequirements && totalRequirements > 0)',
    '',
    'Modelo analisado:',
    `- Nome: ${normalizeLine(payload?.analyzedModelName || '') || 'Não identificado'}`,
    `- Fabricante: ${normalizeLine(payload?.analyzedModelManufacturer || '') || 'Não identificado'}`,
    `- Especificações: ${normalizeLine(payload?.analyzedModelSpecs || '') || 'Não identificado'}`,
    payload?.datasheetFileName
      ? `- Datasheet anexado: ${normalizeLine(payload.datasheetFileName)}`
      : '',
    '',
    'JSON DE SAÍDA (mode tr):',
    JSON.stringify({
      analysisType: 'tr',
      trSummary: '',
      analyzedModel: {
        modelName: '{{analyzedModelName}}',
        manufacturer: '{{analyzedModelManufacturer}}',
        providedSpecs: '{{analyzedModelSpecs}}'
      },
      items: [
        {
          name: '',
          quantity: '',
          specs: ''
        }
      ],
      termRequirements: [],
      technicalNotebook: [
        {
          termRequirement: '',
          meetsRequirement: 'ATENDE',
          datasheetEvidence: '',
          rationale: ''
        }
      ],
      compliantEquipment: [
        {
          model: '',
          manufacturer: '',
          rationale: ''
        }
      ],
      complianceOverview: {
        totalRequirements: 0,
        metRequirements: 0,
        fullCompliance: false
      }
    }, null, 2)
  ]
    .filter(Boolean)
    .join('\n');
};

const buildGeminiSchemaHint = (mode) =>
  mode === 'edital'
    ? {
        general: {
          openingDate: 'string',
          openingTime: 'string',
          portal: 'string',
          agency: 'string',
          modality: 'string',
          objectSummary: 'string'
        },
        deadlines: {
          publicationDate: 'string',
          impugnationDeadline: 'string',
          clarificationDeadline: 'string',
          proposalDeadline: 'string',
          contractTerm: 'string'
        },
        requirements: {
          legal: ['string'],
          technical: ['string'],
          economic: ['string'],
          fiscal: ['string']
        },
        items: [{ name: 'string', quantity: 'string', specs: 'string' }],
        risks: ['string']
      }
    : {
        analysisType: 'tr',
        trSummary: 'string',
        analyzedModel: { modelName: 'string', manufacturer: 'string', providedSpecs: 'string' },
        items: [{ name: 'string', quantity: 'string', specs: 'string' }],
        termRequirements: ['string'],
        technicalNotebook: [
          {
            termRequirement: 'string',
            meetsRequirement: 'ATENDE | NAO_ATENDE',
            datasheetEvidence: 'string',
            rationale: 'string'
          }
        ],
        compliantEquipment: [{ model: 'string', manufacturer: 'string', rationale: 'string' }],
        complianceOverview: { totalRequirements: 'number', metRequirements: 'number', fullCompliance: 'boolean' }
      };

const parseGeminiTextContent = (json) => {
  const parts = Array.isArray(json?.candidates?.[0]?.content?.parts)
    ? json.candidates[0].content.parts
    : [];
  return parts
    .map((part) => (typeof part?.text === 'string' ? part.text : ''))
    .join('\n')
    .trim();
};

const buildLegacyEditalPrompt = (documentText) => {
  const structure = `{
      "identificacao": { "data_sessao": "data", "orgao": "nome", "modalidade": "modalidade", "portal": "portal", "objeto": "objeto" },
      "prazos": [{"titulo": "prazo", "descricao": "desc"}],
      "exigencias": [{"categoria": "tipo", "requisito": "desc"}],
      "documentacao": [{"tipo": "tipo", "doc": "nome", "obrigatorio": true}],
      "itens_tr": [{"item": "nome", "desc": "especificacao tecnica detalhada e completa", "qtd": "valor"}],
      "riscos": [{"titulo": "risco", "descricao": "desc", "severidade": "alta|media"}],
      "pontuacao_viabilidade": 8
    }`;

  return `Analise este documento (EDITAL) de forma exaustiva.
    Não resuma demais. Traga o máximo de detalhamento possível para que um técnico possa avaliar a viabilidade de atendimento sem precisar ler o PDF original.

    Retorne este JSON:
    ${structure}

    TEXTO DO DOCUMENTO: ${cleanText(documentText, 60000)}`;
};

const runGeminiLegacyEdital = async ({ documentText, maxRetries = 3, baseDelayMs = 3000 }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const model = process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL || 'gemini-2.5-flash';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const systemPrompt = 'Aja como um Auditor Sênior de Licitações. Analise o texto e retorne um objeto JSON completo e exaustivo. Não economize palavras nas descrições técnicas. Retorne apenas o JSON bruto, sem markdown.';
  const prompt = buildLegacyEditalPrompt(documentText);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 140000);
  let lastError = null;

  try {
    for (let attempt = 0; attempt < maxRetries; attempt += 1) {
      try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        }),
        signal: controller.signal
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(normalizeLine(json?.error?.message || '') || `Gemini HTTP ${response.status}`);
      }

      const parsed = tryParseJsonObject(parseGeminiTextContent(json));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
      throw new Error('Gemini não retornou JSON válido para a análise do edital.');
      } catch (error) {
        lastError = error;
        const message = error instanceof Error ? error.message : String(error);
        const isLastAttempt = attempt >= maxRetries - 1;
        if (!shouldRetryByMessage(message) || isLastAttempt || controller.signal.aborted) break;

        const waitMs = retryDelayMsFromMessage(message, baseDelayMs * Math.pow(2, attempt));
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  } finally {
    clearTimeout(timeout);
  }

  if (lastError) {
    console.warn('Falha no fluxo compatível de edital.', lastError instanceof Error ? lastError.message : lastError);
  }
  return null;
};

const runGeminiStructured = async ({ mode, payload, maxRetries = 3, baseDelayMs = 3000 }) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const fileDataUri = getMainFileDataUri(payload);
  if (!fileDataUri) return null;

  const model = process.env.GEMINI_MODEL || process.env.GOOGLE_MODEL || 'gemini-2.5-flash';
  const prompt = buildTemplatePrompt({ mode, payload });
  const expectedSchema = buildGeminiSchemaHint(mode);

  const mainFile = parseDataUri(fileDataUri);
  const parts = [
    {
      text: [
        prompt,
        '',
        'Responda estritamente em JSON valido, sem markdown e sem texto adicional.',
        `Schema esperado (hint): ${JSON.stringify(expectedSchema)}`
      ].join('\n')
    },
    {
      inline_data: {
        mime_type: mainFile.mimeType || 'application/pdf',
        data: mainFile.buffer.toString('base64')
      }
    }
  ];

  const datasheetDataUri = getDatasheetFileDataUri(payload);
  if (mode === 'tr' && datasheetDataUri) {
    try {
      const datasheet = parseDataUri(datasheetDataUri);
      parts.push({
        text: `Datasheet complementar: ${normalizeLine(payload.datasheetFileName || 'arquivo sem nome')}`
      });
      parts.push({
        inline_data: {
          mime_type: datasheet.mimeType || 'application/pdf',
          data: datasheet.buffer.toString('base64')
        }
      });
    } catch (error) {
      console.warn('Falha ao anexar datasheet no prompt Gemini.', error?.message || error);
    }
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json'
          }
        })
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        const errMessage =
          normalizeLine(json?.error?.message || '') ||
          `Gemini HTTP ${response.status}`;
        throw new Error(errMessage);
      }

      const parsed = tryParseJsonObject(parseGeminiTextContent(json));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }

      throw new Error('Gemini não retornou JSON válido para a análise.');
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const isLastAttempt = attempt >= maxRetries - 1;
      if (!shouldRetryByMessage(message) || isLastAttempt) {
        break;
      }

      const waitMs = retryDelayMsFromMessage(message, baseDelayMs * Math.pow(2, attempt));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  if (lastError) {
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    console.warn(`Falha no fluxo Gemini (${mode}).`, message);
  }
  return null;
};

const runOpenAiStructured = async ({ mode, payload, text, datasheetText = '' }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const schemaHint = buildGeminiSchemaHint(mode);
  const systemPrompt = [
    buildTemplatePrompt({ mode, payload }),
    '',
    'Responda estritamente com JSON válido sem markdown e sem texto adicional.'
  ].join('\n');

  const compactPayload = {
    mode,
    analyzedModelName: normalizeLine(payload?.analyzedModelName || ''),
    analyzedModelManufacturer: normalizeLine(payload?.analyzedModelManufacturer || ''),
    analyzedModelSpecs: cleanText(payload?.analyzedModelSpecs || '', 8000),
    datasheetFileName: normalizeLine(payload?.datasheetFileName || '')
  };

  const userPayload = {
    mode,
    payload: compactPayload,
    documentText: cleanText(text, 30000),
    datasheetText: cleanText(datasheetText, 20000),
    expectedSchema: schemaHint
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify(userPayload) }
        ]
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    const parsed = tryParseJsonObject(content);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const ensureArray = (value, limit = 20) =>
  (Array.isArray(value) ? value : [])
    .map((item) => normalizeLine(String(item || '')))
    .filter(Boolean)
    .slice(0, limit);

const normalizeItemName = (name) =>
  String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const ITEM_STRONG_SIGNAL_REGEX =
  /\b(fornecimento|aquisi[cç][aã]o|loca[cç][aã]o|licen[cç]a|servi[cç]o|solu[cç][aã]o|equipamento|sistema|software|plataforma|assinatura|subscri[cç][aã]o|m[oó]dulo|ferramenta|aplica[cç][aã]o|implantac[aã]o|manuten[cç][aã]o|suporte|treinamento|consultoria|notebook|desktop|computador|servidor|storage|switch|roteador|impressora|scanner|monitor|tablet|c[âa]mera|link\s+de\s+internet)\b/i;
const ITEM_CONTEXT_BLOCKLIST_REGEX =
  /\b(prazo|vig[êe]ncia|per[ií]odo|abertura|sess[aã]o|impugna[cç][aã]o|esclarecimento|proposta|publica[cç][aã]o|habilita[cç][aã]o|qualifica[cç][aã]o|certid[aã]o|atestado|cl[aá]usula|penalidade|multa|entrega|execu[cç][aã]o|objeto|ata\s+de\s+registro\s+de\s+pre[cç]os|nota\s+de\s+empenho|ordem\s+de\s+servi[cç]o|federativos?)\b/i;
const ITEM_SINGLE_WORD_ALLOWLIST = new Set([
  'software',
  'sistema',
  'notebook',
  'desktop',
  'computador',
  'servidor',
  'storage',
  'switch',
  'roteador',
  'impressora',
  'scanner',
  'monitor',
  'tablet',
  'camera',
  'licenca',
  'plataforma',
  'assinatura',
  'subscricao'
]);
const ITEM_QUANTITY_PATTERN = /(\d+[\.,]?\d*)\s*(un|und|unidade|licen[cç]a|kit|meses?|anos?)/i;
const ITEM_QUANTITY_LINE_PATTERN = /^(.{8,220})\s+(\d+[\.,]?\d*)\s*(un|und|unidade|licen[cç]a|kit|meses?|anos?)\b/i;

const hasStrongItemSignal = (value) => ITEM_STRONG_SIGNAL_REGEX.test(String(value || ''));

const looksLikeAdministrativeContext = (value) => ITEM_CONTEXT_BLOCKLIST_REGEX.test(normalizeItemName(value));

const looksLikeLocationOnly = (value) => {
  const normalized = normalizeItemName(value);
  if (!normalized) return false;
  if (/\b(municipio|cidade|estado|capital|regional|territorio|sede)\b/.test(normalized)) return true;

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 1) {
    if (ITEM_SINGLE_WORD_ALLOWLIST.has(tokens[0])) return false;
    return !hasStrongItemSignal(tokens[0]);
  }

  if (tokens.length <= 2 && /\b(pr|sp|rj|mg|sc|rs|ba|go|mt|ms|df|ce|pe|pb|rn|al|se|pi|ma|pa|ap|am|rr|ro|ac|to|es)\b/.test(normalized)) {
    return !hasStrongItemSignal(normalized);
  }

  return false;
};

const isWeakItemName = (name) => {
  const n = normalizeItemName(name);
  if (!n || n.length < 6) return true;
  if (/^(periodo|prazo|vigencia|meses|anos|duracao|contrato)(\s|$)/.test(n)) return true;
  if (/^(de|da|do|dos|das|para|com|sem)$/.test(n)) return true;
  if (/^\d+(?:[\.,]\d+)?$/.test(n)) return true;
  if (looksLikeLocationOnly(n) && !hasStrongItemSignal(n)) return true;
  if (looksLikeAdministrativeContext(n) && !hasStrongItemSignal(n)) return true;

  const tokens = n
    .split(' ')
    .filter(Boolean)
    .filter((token) => !['de', 'da', 'do', 'dos', 'das', 'para', 'com', 'sem'].includes(token));
  if (tokens.length === 0) return true;
  if (tokens.length === 1 && !ITEM_SINGLE_WORD_ALLOWLIST.has(tokens[0]) && !hasStrongItemSignal(tokens[0])) {
    return true;
  }

  return false;
};

const shouldAcceptItemCandidate = (name, quantity = '', context = '') => {
  if (isWeakItemName(name)) return false;

  const signalCorpus = `${name || ''} ${context || ''}`;
  const hasSignal = hasStrongItemSignal(signalCorpus);
  const quantityNorm = normalizeItemName(quantity);
  const contextNorm = normalizeItemName(context);

  if (/\b(mes|meses|ano|anos)\b/.test(quantityNorm) && !hasSignal) return false;
  if (looksLikeAdministrativeContext(contextNorm) && !hasSignal) return false;

  return true;
};

const extractEditalItemsFromLines = (lines) => {
  const items = [];
  const seen = new Set();

  const pushItem = (rawName, rawQuantity, rawSpecs = 'Conforme edital/TR', context = '') => {
    const name = normalizeLine(
      String(rawName || '')
        .replace(/^(?:item|lote)\s*\d{1,3}(?:\.\d+)*\s*[:\-–]?\s*/i, '')
        .replace(/^\d{1,3}(?:\.\d+){1,4}\s+/, '')
        .replace(/\s+\d+[\.,]?\d*\s*(un|und|unidade|licen[cç]a|kit|meses?|anos?)\s*$/i, '')
    );
    if (!name || !shouldAcceptItemCandidate(name, rawQuantity, `${rawSpecs} ${context}`)) return;

    const key = normalizeItemName(name);
    if (!key || seen.has(key)) return;

    seen.add(key);
    items.push({
      name,
      quantity: normalizeLine(rawQuantity || 'Não identificado') || 'Não identificado',
      specs: normalizeLine(rawSpecs || 'Conforme edital/TR') || 'Conforme edital/TR'
    });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    const byItem = line.match(/^(?:item|lote)\s*(\d{1,3}(?:\.\d+)*)\s*[:\-–]?\s*(.{4,220})$/i);
    if (byItem) {
      const name = normalizeLine(byItem[2].replace(/^(?:descricao|descri[cç][aã]o)\s*[:\-]\s*/i, ''));
      const qtyFromCurrent = line.match(ITEM_QUANTITY_PATTERN);
      const nextLine = lines[i + 1] || '';
      const qtyFromNext = nextLine.match(ITEM_QUANTITY_PATTERN);
      const qty = qtyFromCurrent || qtyFromNext;
      pushItem(name, qty ? `${qty[1]} ${qty[2]}` : 'Não identificado', nextLine || 'Conforme edital/TR', line);
      continue;
    }

    const byQty = line.match(ITEM_QUANTITY_LINE_PATTERN);
    if (byQty) {
      const rawName = normalizeLine(
        byQty[1].replace(/^(?:item|lote)\s*\d{1,3}(?:\.\d+)*\s*[:\-–]?\s*/i, '')
      );
      const qty = `${byQty[2]} ${byQty[3]}`;
      if (!/(prazo|per[ií]odo|vig[êe]ncia)\s+de/i.test(rawName) && (hasStrongItemSignal(line) || hasStrongItemSignal(rawName))) {
        pushItem(rawName, qty, 'Conforme edital/TR', line);
      }
    }

    const coded = line.match(/^(\d{1,2}(?:\.\d+){1,3})\s+(.{10,240})$/);
    if (coded) {
      const candidate = normalizeLine(coded[2]);
      if (hasStrongItemSignal(candidate) && !looksLikeAdministrativeContext(candidate)) {
        pushItem(candidate, 'Não identificado', 'Conforme edital/TR', line);
      }
    }

    if (items.length >= 20) break;
  }

  if (items.length === 0) {
    for (const line of lines) {
      const candidate = normalizeLine(line.replace(/^(?:objeto|descri[cç][aã]o\s+do\s+objeto)\s*[:\-]\s*/i, ''));
      if (hasStrongItemSignal(candidate) && !looksLikeAdministrativeContext(candidate)) {
        pushItem(candidate, 'Não identificado', 'Conforme edital/TR', line);
      }
      if (items.length >= 6) break;
    }
  }

  return items;
};

const heuristicsEdital = (text) => {
  const lines = splitLines(text);

  const legal = collectByKeywords(lines, ['habilitação jurídica', 'contrato social', 'procuração', 'representante legal'], 10);
  const technical = collectByKeywords(lines, ['atestado', 'qualificação técnica', 'capacidade técnica', 'especificação técnica', 'comprovação técnica'], 12);
  const economic = collectByKeywords(lines, ['balanço patrimonial', 'índice de liquidez', 'patrimônio líquido', 'garantia de proposta', 'garantia contratual'], 10);
  const fiscal = collectByKeywords(lines, ['certidão', 'fgts', 'receita federal', 'dívida ativa', 'trabalhista', 'fazenda estadual', 'fazenda municipal'], 12);

  const itemCandidates = extractEditalItemsFromLines(lines);

  const openingKeywords = [
    /\babertura\b/i,
    /sess[aã]o\s+p[úu]blica/i,
    /data\s+da\s+sess[aã]o/i
  ];
  const publicationKeywords = [
    /publica[cç][aã]o/i,
    /divulga[cç][aã]o/i,
    /disponibiliza[cç][aã]o/i,
    /\baviso\b/i
  ];
  const impugnationKeywords = [
    /impugna[cç][aã]o/i,
    /prazo\s+.*impugna[cç][aã]o/i
  ];
  const clarificationKeywords = [
    /esclarecimentos?/i,
    /pedido\s+.*esclarecimento/i
  ];
  const proposalKeywords = [
    /prazo\s+.*propost/i,
    /(?:recebimento|envio|apresenta[cç][aã]o|entrega|abertura)\s+.*propost/i,
    /\bpropostas?\b/i
  ];
  const contractTermKeywords = [
    /vig[êe]ncia/i,
    /prazo\s+contratual/i,
    /dura[cç][aã]o\s+do\s+contrato/i
  ];

  const openingDateFallback =
    findDateLike(text, /(?:abertura(?:\s+da\s+sess[aã]o)?|sess[aã]o\s+p[úu]blica|data\s+da\s+sess[aã]o)\s*[:\-]?\s*([^\n]{4,90})/i) ||
    extractDateFromTextByKeywords(text, openingKeywords, 2);
  const openingTimeFallback =
    findTimeLike(text, /(?:abertura(?:\s+da\s+sess[aã]o)?|sess[aã]o\s+p[úu]blica|hora(?:\s+da\s+sess[aã]o)?)\s*[:\-]?\s*([^\n]{2,90})/i) ||
    extractTimeFromTextByKeywords(text, openingKeywords, 2);
  const publicationFallback =
    findDateLike(text, /(?:publica[cç][aã]o|divulga[cç][aã]o|disponibiliza[cç][aã]o)\s*[:\-]?\s*([^\n]{4,120})/i) ||
    extractDateFromTextByKeywords(text, publicationKeywords, 2);
  const impugnationFallback =
    findDateLike(text, /(?:impugna[cç][aã]o|prazo\s+para\s+impugna[cç][aã]o)\s*[:\-]?\s*([^\n]{4,140})/i) ||
    extractDateFromTextByKeywords(text, impugnationKeywords, 2);
  const clarificationFallback =
    findDateLike(text, /(?:esclarecimentos?|prazo\s+para\s+esclarecimentos?)\s*[:\-]?\s*([^\n]{4,140})/i) ||
    extractDateFromTextByKeywords(text, clarificationKeywords, 2);
  const proposalFallback =
    findDateLike(text, /(?:prazo(?:\s+final)?\s+para\s+(?:envio|apresenta[cç][aã]o|entrega)\s+de\s+propostas?|encerramento\s+de\s+propostas?|recebimento\s+das\s+propostas?)\s*[:\-]?\s*([^\n]{4,180})/i) ||
    extractDateFromTextByKeywords(text, proposalKeywords, 3);
  const contractTermFallback =
    findCapture(text, /(?:vig[êe]ncia|prazo\s+de\s+vig[êe]ncia|prazo\s+contratual|dura[cç][aã]o\s+do\s+contrato)\s*[:\-]?\s*([^\n]{3,180})/i) ||
    extractTextFromTextByKeywords(text, contractTermKeywords, 2, 180);

  const general = {
    openingDate: pickDateValue('', openingDateFallback),
    openingTime: pickTimeValue('', openingTimeFallback),
    portal: detectPortal(text),
    agency: detectAgency(text),
    modality: detectModality(text) || 'Não identificado',
    objectSummary: detectObjectSummary(text)
  };

  const deadlines = {
    publicationDate: pickDateValue('', publicationFallback),
    impugnationDeadline: pickDateValue('', impugnationFallback),
    clarificationDeadline: pickDateValue('', clarificationFallback),
    proposalDeadline: pickDateValue('', proposalFallback),
    contractTerm: pickContractTermValue('', contractTermFallback)
  };

  const risks = [];
  const lower = text.toLowerCase();
  if (lower.includes('multa')) risks.push('Verificar cláusulas de multa e penalidades para mitigar risco financeiro.');
  if (lower.includes('atestado') || lower.includes('qualificação técnica')) {
    risks.push('Exigências de qualificação técnica podem restringir participação sem acervo aderente.');
  }
  if (lower.includes('garantia')) risks.push('Necessidade de garantia contratual pode impactar fluxo de caixa.');

  return {
    analysisType: 'edital',
    general,
    deadlines,
    requirements: {
      legal,
      technical,
      economic,
      fiscal
    },
    items:
      itemCandidates.length > 0
        ? itemCandidates
        : [],
    risks
  };
};

const normalizeEditalResponse = (candidate, fallback) => {
  if (!candidate || typeof candidate !== 'object') return fallback;

  const generalCandidate = candidate.general && typeof candidate.general === 'object' ? candidate.general : {};
  const deadlineCandidate = candidate.deadlines && typeof candidate.deadlines === 'object' ? candidate.deadlines : {};
  const requirementsCandidate =
    candidate.requirements && typeof candidate.requirements === 'object' ? candidate.requirements : {};

  const normalized = {
    analysisType: 'edital',
    general: {
      openingDate: pickDateValue(generalCandidate.openingDate, fallback.general.openingDate),
      openingTime: pickTimeValue(generalCandidate.openingTime, fallback.general.openingTime),
      portal: normalizeLine(generalCandidate.portal || fallback.general.portal || 'Não identificado'),
      agency: normalizeLine(generalCandidate.agency || fallback.general.agency || 'Não identificado'),
      modality: normalizeLine(generalCandidate.modality || fallback.general.modality || 'Não identificado'),
      objectSummary: normalizeLine(generalCandidate.objectSummary || fallback.general.objectSummary || 'Não identificado')
    },
    deadlines: {
      publicationDate: pickDateValue(deadlineCandidate.publicationDate, fallback.deadlines.publicationDate),
      impugnationDeadline: pickDateValue(deadlineCandidate.impugnationDeadline, fallback.deadlines.impugnationDeadline),
      clarificationDeadline: pickDateValue(deadlineCandidate.clarificationDeadline, fallback.deadlines.clarificationDeadline),
      proposalDeadline: pickDateValue(deadlineCandidate.proposalDeadline, fallback.deadlines.proposalDeadline),
      contractTerm: pickContractTermValue(deadlineCandidate.contractTerm, fallback.deadlines.contractTerm)
    },
    requirements: {
      legal: ensureArray(requirementsCandidate.legal).length
        ? ensureArray(requirementsCandidate.legal)
        : fallback.requirements.legal,
      technical: ensureArray(requirementsCandidate.technical).length
        ? ensureArray(requirementsCandidate.technical)
        : fallback.requirements.technical,
      economic: ensureArray(requirementsCandidate.economic).length
        ? ensureArray(requirementsCandidate.economic)
        : fallback.requirements.economic,
      fiscal: ensureArray(requirementsCandidate.fiscal).length
        ? ensureArray(requirementsCandidate.fiscal)
        : fallback.requirements.fiscal
    },
    items: Array.isArray(candidate.items) && candidate.items.length > 0
      ? candidate.items
          .map((item) => ({
            name: normalizeLine(item?.name || ''),
            quantity: normalizeLine(item?.quantity || 'Não identificado'),
            specs: normalizeLine(item?.specs || 'Não identificado')
          }))
          .filter((item) => item.name && !isWeakItemName(item.name))
          .reduce((acc, item) => {
            const key = normalizeItemName(item.name);
            if (!key || acc.seen.has(key)) return acc;
            acc.seen.add(key);
            acc.list.push(item);
            return acc;
          }, { list: [], seen: new Set() }).list
          .slice(0, 20)
      : fallback.items,
    risks: ensureArray(candidate.risks).length ? ensureArray(candidate.risks) : fallback.risks
  };

  return normalized;
};

const TR_NOTEBOOK_MIN_ROWS = 5;

const normalizeTrRequirementText = (value) => normalizeLine(value || 'Não identificado') || 'Não identificado';

const normalizeTrMeetsRequirement = (value) =>
  String(value || '').toUpperCase() === 'ATENDE'
    ? 'ATENDE'
    : 'NAO_ATENDE';

const formatTrDatasheetEvidence = (termRequirement, meetsRequirement, detail = '') => {
  const requirement = normalizeTrRequirementText(termRequirement);
  const status = normalizeTrMeetsRequirement(meetsRequirement);
  const detailTextRaw = normalizeLine(detail || '');
  const isAlreadyFormatted = /^TR exige\s.+\.\s*Modelo possui\s.+/i.test(detailTextRaw);
  if (isAlreadyFormatted) {
    if (status === 'NAO_ATENDE' && !/\bou\s+Não identificado\b/i.test(detailTextRaw)) {
      return `${detailTextRaw} ou Não identificado`;
    }
    return detailTextRaw;
  }

  const detailText = detailTextRaw
    .replace(/^modelo\s+possui\s*/i, '')
    .replace(/\s+ou\s+n[aã]o\s+identificado\.?$/i, '')
    .trim();

  if (status === 'ATENDE') {
    const evidence = detailText && !isUnknownText(detailText)
      ? detailText
      : 'evidência objetiva não identificada';
    return `TR exige ${requirement}. Modelo possui ${evidence}`;
  }

  const difference = detailText && !isUnknownText(detailText)
    ? detailText
    : 'diferença técnica não comprovada';
  return `TR exige ${requirement}. Modelo possui ${difference} ou Não identificado`;
};

const buildDefaultTrNotebookRow = (termRequirement, rationale = 'Requisito não comprovado integralmente com as informações fornecidas.') => {
  const requirement = normalizeTrRequirementText(termRequirement);
  return {
    termRequirement: requirement,
    meetsRequirement: 'NAO_ATENDE',
    datasheetEvidence: formatTrDatasheetEvidence(requirement, 'NAO_ATENDE', ''),
    rationale: normalizeLine(rationale || 'Requisito não comprovado integralmente com as informações fornecidas.')
  };
};

const isAdministrativeOrLegalRequirementLine = (value) => {
  const text = normalizePlainText(value);
  if (!text) return false;
  return /\b(habilitacao|juridic|fiscal|certidao|trabalhista|balanco|patrimonio|impugnacao|recurso|multa|penalidade|garantia\s+contratual|assinatura|documentacao|proposta\s+comercial|regularidade|prazo\s+de\s+pagamento)\b/.test(text);
};

const isTrAdministrativeOrLegalLine = (value) => {
  const text = normalizePlainText(value);
  if (!text) return false;
  return isAdministrativeOrLegalRequirementLine(value) ||
    /\b(justificativa|fundamentacao|estudo\s+tecnico\s+preliminar|estimativa|valor\s+estimado|pesquisa\s+de\s+precos|dotacao|criterio\s+de\s+julgamento|fiscalizacao|gestao\s+do\s+contrato|recebimento)\b/.test(text);
};

const hasTechnicalOrFunctionalSignal = (value) => {
  const text = normalizePlainText(value);
  if (!text) return false;
  return /\b(requisito|funcional|tecnico|tecnica|desempenho|capacidade|compatibil|integrac|api|interface|plataforma|sistema|software|hardware|processador|memoria|armazenamento|seguranca|criptografia|autenticacao|latencia|disponibilidade|sla|suporte|instalacao|implantacao|treinamento|garantia\s+tecnica)\b/.test(text);
};

const TR_ITEM_UNIT_SOURCE =
  'un|und|unid\\.?|unidade(?:s)?|licen[cç]as?|servi[cç]os?|kit|kits|meses?|anos?|postos?|usu[aá]rios?|pacotes?|caixas?|pe[cç]as?|m2|m²|metros?';
const TR_ITEM_QUANTITY_PATTERN = new RegExp(`(\\d+(?:[\\.,]\\d+)?)\\s*(${TR_ITEM_UNIT_SOURCE})\\b`, 'i');
const TR_ITEM_ROW_PATTERN = new RegExp(`^(?:item|lote|grupo)?\\s*(\\d{1,4}(?:[.\\-]\\d{1,4})?)\\s+(.{8,260}?)\\s+(\\d+(?:[\\.,]\\d+)?)\\s*(${TR_ITEM_UNIT_SOURCE})\\b(?:\\s+(.{0,240}))?$`, 'i');
const TR_ITEM_ROW_NO_UNIT_PATTERN = /^((?:item|lote|grupo)?\s*\d{1,4}(?:[.\-]\d{1,4})*)\s+(.{8,260}?)\s+(\d+(?:[\.,]\d+)?)$/i;
const TR_ITEM_QUANTITY_LINE_PATTERN = new RegExp(`^(.{8,260}?)\\s+(\\d+(?:[\\.,]\\d+)?)\\s*(${TR_ITEM_UNIT_SOURCE})\\b(?:\\s+(.{0,240}))?$`, 'i');
const TR_LEADING_QUANTITY_ITEM_PATTERN = new RegExp(`^(\\d+(?:[\\.,]\\d+)?)(?:\\s*(${TR_ITEM_UNIT_SOURCE}))?\\s+(.{4,260})$`, 'i');
const TR_ITEM_SECTION_REGEX =
  /\b(itens?|lotes?|objeto(?:\s+da\s+contrata[cç][aã]o)?|descri[cç][aã]o(?:\s+do\s+objeto)?|especifica[cç][oõ]es?\s+t[eé]cnicas?|termo\s+de\s+refer[eê]ncia|planilha|tabela|rela[cç][aã]o\s+de\s+itens?|quantitativos?)\b/i;
const TR_SECTION_END_REGEX =
  /\b(prazos?|vig[êe]ncia|pagamento|san[cç][oõ]es?|penalidades?|habilita[cç][aã]o|qualifica[cç][aã]o|crit[eé]rios?\s+de\s+julgamento|fiscaliza[cç][aã]o|gest[aã]o\s+do\s+contrato|dota[cç][aã]o|assinatura|garantia\s+contratual|reajuste|recebimento|justificativa|fundamenta[cç][aã]o|estimativa|valor\s+estimado|pesquisa\s+de\s+pre[cç]os|obriga[cç][oõ]es?)\b/i;
const TR_SPEC_SIGNAL_REGEX =
  /\b(especifica[cç][aã]o|caracter[ií]stica|requisito|m[ií]nimo|capacidade|desempenho|compat[ií]vel|processador|mem[oó]ria|armazenamento|interface|porta|api|m[oó]dulo|usu[aá]rios?|licen[cç]a|software|sistema|plataforma|equipamento|material|dimens[oõ]es?|pot[êe]ncia|voltagem|resolu[cç][aã]o|certifica[cç][aã]o|norma|garantia\s+t[eé]cnica|suporte|instala[cç][aã]o|implanta[cç][aã]o|treinamento)\b/i;
const TR_NON_ITEM_TITLE_REGEX =
  /^(?:preambulo|sumario|indice|disponibilidade\s+financeira|parametros?\s+para\s+a\s+licitacao|elementos\s+instrutores|retirada\s+e\s+alteracoes\s+do\s+edital|publicidade\s+dos\s+atos|condicoes\s+de\s+participacao|credenciamento|impugnacao|esclarecimentos?|recursos?|propostas?|habilitacao|julgamento|adjudicacao|homologacao|contratacao|contrato|pagamento|sancoes?|penalidades?|anexos?|minuta|modelo\s+de\s+proposta|termo\s+de\s+contrato|aviso\s+de\s+licitacao|edital|justificativa|fundamentacao|estudo\s+tecnico\s+preliminar|valor\s+estimado|pesquisa\s+de\s+precos)\b/;

const isTrTableHeaderLine = (line) => {
  const text = normalizePlainText(line);
  if (!text) return false;
  const hasColumns = /\b(item|descricao|especificacao|qtd|quantidade|unid|unidade|valor unitario|valor total)\b/.test(text);
  return hasColumns && text.split(/\s+/).length <= 12 && !/\d+(?:[\.,]\d+)?/.test(text);
};

const stripLeadingSectionNumber = (value) =>
  normalizePlainText(value)
    .replace(/^[\s\d.()-]+/, '')
    .replace(/[·•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isLikelyTocLine = (line) => {
  const raw = normalizeLine(line);
  if (!raw) return false;

  const normalized = normalizePlainText(raw).replace(/\s+/g, ' ');
  if (/^(sumario|indice)\b/.test(normalized)) return true;

  const hasDotLeader = /(?:\.|\u2024|\u2026){5,}/.test(raw);
  const endsWithPage = /\b\d{1,4}\s*$/.test(raw);
  if (hasDotLeader && endsWithPage) return true;

  const sectionRefs = raw.match(/\b\d{1,2}\.?\s+[A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ][A-ZÁÀÂÃÉÊÍÓÔÕÚÜÇ0-9\s,/()\-]{4,}/g) || [];
  if (hasDotLeader && sectionRefs.length >= 1) return true;
  if (sectionRefs.length >= 2 && /\b\d{1,4}\s*$/.test(raw)) return true;

  return false;
};

const isTrNonItemHeading = (line) => {
  const raw = normalizeLine(line);
  if (!raw) return false;
  if (isLikelyTocLine(raw)) return true;
  if (TR_ITEM_QUANTITY_PATTERN.test(raw) || /:\s*\S.{10,}/.test(raw)) return false;

  const normalized = stripLeadingSectionNumber(raw)
    .replace(/[.]{2,}/g, ' ')
    .replace(/\s+\d{1,4}$/, '')
    .trim();
  if (!normalized) return true;
  if (TR_NON_ITEM_TITLE_REGEX.test(normalized)) return true;
  if (/^especificacoes(?:\s*,?\s*quantitativos?)?(?:\s+e\s+valor\s+maximo.*)?$/.test(normalized)) return true;
  if (/^(?:objeto|descricao\s+do\s+objeto|itens?|lotes?|relacao\s+de\s+itens?|quantitativos?|tabela|planilha)$/.test(normalized)) return true;

  const withoutDigits = raw.replace(/\d+/g, '').trim();
  const isShortUppercaseHeading =
    withoutDigits.length >= 6 &&
    withoutDigits.length <= 90 &&
    withoutDigits === withoutDigits.toUpperCase() &&
    !hasStrongItemSignal(raw) &&
    !TR_SPEC_SIGNAL_REGEX.test(raw);

  return isShortUppercaseHeading;
};

const getTrSearchLines = (lines) =>
  (Array.isArray(lines) ? lines : [])
    .map(normalizeLine)
    .filter((line) => line && !isLikelyTocLine(line));

const isLikelyNextTrItemLine = (line) => {
  const text = normalizeLine(line);
  if (!text) return false;
  if (TR_ITEM_ROW_PATTERN.test(text)) return true;
  return /^(?:item|lote|grupo)\s*\d{1,4}(?:[.\-]\d{1,4})*\s*[:\-.)]?\s+\S+/i.test(text) ||
    /^\d{1,4}(?:[.\-]\d{1,4})+\s*[:\-.)]?\s+\S+/i.test(text);
};

const hasNearbyTrItemSection = (lines, index) => {
  const start = Math.max(0, index - 8);
  for (let i = start; i <= index; i += 1) {
    const line = lines[i] || '';
    if (!isLikelyTocLine(line) && TR_ITEM_SECTION_REGEX.test(line)) return true;
  }
  return false;
};

const sanitizeTrItemName = (value) => {
  let text = normalizeLine(
    String(value || '')
      .replace(/^(?:item|lote|grupo)\s*\d{1,4}(?:[.\-]\d{1,4})*\s*[:\-.)]?\s*/i, '')
      .replace(/^\d{1,4}(?:[.\-]\d{1,4})*\s*[:\-.)]?\s*/, '')
      .replace(/^(?:descri[cç][aã]o|especifica[cç][aã]o|objeto(?:\s+da\s+contrata[cç][aã]o)?|produto|servi[cç]o|solu[cç][aã]o)\s*[:\-–]\s*/i, '')
      .replace(TR_ITEM_QUANTITY_PATTERN, ' ')
  );

  text = text
    .replace(/\b(?:qtd|quantidade|unid(?:ade)?|valor\s+(?:unit[aá]rio|total))\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length > 180) {
    const compact = text.match(/^(.{40,180}?)(?:\s+-\s+|\s+com\s+|\s+contendo\s+|\s+conforme\s+)/i);
    text = normalizeLine(compact?.[1] || text.slice(0, 180));
  }

  return text;
};

const normalizeTrItemSpecs = (value) => {
  const text = normalizeLine(value || '');
  if (!text) return 'Conforme edital/TR';
  return text.length > 700 ? `${text.slice(0, 700).trim()}...` : text;
};

const extractTrSpecsWindow = (lines, startIndex, maxLines = 5) => {
  const specs = [];

  for (let i = startIndex; i < lines.length && specs.length < maxLines; i += 1) {
    const line = normalizeLine(lines[i] || '');
    if (!line || isTrTableHeaderLine(line)) continue;
    if (isLikelyTocLine(line) || isTrNonItemHeading(line)) continue;
    if (TR_ITEM_SECTION_REGEX.test(line) && !TR_SPEC_SIGNAL_REGEX.test(line) && !hasStrongItemSignal(line)) continue;
    if (i > startIndex && isLikelyNextTrItemLine(line)) break;
    if (TR_SECTION_END_REGEX.test(line) && !hasStrongItemSignal(line) && !TR_SPEC_SIGNAL_REGEX.test(line)) break;
    if (line.length < 6 || line.length > 420) continue;
    if (isTrAdministrativeOrLegalLine(line) && !hasTechnicalOrFunctionalSignal(line) && !hasStrongItemSignal(line)) {
      continue;
    }

    if (
      hasStrongItemSignal(line) ||
      hasTechnicalOrFunctionalSignal(line) ||
      TR_SPEC_SIGNAL_REGEX.test(line) ||
      /[:;]/.test(line) ||
      line.length >= 24
    ) {
      specs.push(line);
    }
  }

  return normalizeTrItemSpecs(unique(specs).join(' '));
};

const shouldAcceptTrItemCandidate = (name, quantity = '', specs = '', context = '') => {
  const signalCorpus = `${name || ''} ${specs || ''} ${context || ''}`;
  const hasExplicitQuantity = !isUnknownText(quantity) && /\d/.test(String(quantity || ''));
  const normalizedName = stripLeadingSectionNumber(name);
  if (isLikelyTocLine(signalCorpus)) return false;
  if (TR_NON_ITEM_TITLE_REGEX.test(normalizedName)) return false;
  if (isTrNonItemHeading(name) && !hasExplicitQuantity) return false;
  if (!hasExplicitQuantity && !hasStrongItemSignal(signalCorpus) && !TR_SPEC_SIGNAL_REGEX.test(signalCorpus)) return false;
  const acceptanceContext = hasStrongItemSignal(signalCorpus) ? `${specs} ${context}` : name;
  return shouldAcceptItemCandidate(name, quantity, acceptanceContext);
};

const compactTrQuantity = (quantity) => {
  const text = normalizeLine(quantity || '');
  if (isUnknownText(text)) return '';
  const unitOnly = text.match(/^(\d+(?:[\.,]\d+)?)\s*(?:un|und|unid\.?|unidade|unidades)$/i);
  if (unitOnly) return unitOnly[1];
  return text;
};

const extractTrPrimarySpecTokens = (name, specs) => {
  const text = `${name || ''} ${specs || ''}`;
  const normalizedName = normalizeItemName(name);
  if (/\b(\d{1,4}\s*portas?|i[3579]|ryzen|ssd|\d+\s*gb|poe|gigabit|10g|wi\s*fi)\b/i.test(name || '')) {
    return [];
  }

  const tokens = [];
  const patterns = [
    /\b\d{1,4}\s*portas?\b/gi,
    /\b(?:core\s*)?i[3579](?:-\d{3,5}[a-z]*)?\b/gi,
    /\bryzen\s*[3579](?:\s+\d{3,5}[a-z]*)?\b/gi,
    /\b\d+\s*gb\s*(?:ram|mem[oó]ria)?\b/gi,
    /\bssd\s*\d+\s*(?:gb|tb)\b/gi,
    /\b\d+\s*(?:gb|tb)\s*(?:ssd|armazenamento)\b/gi,
    /\bpoe\+?\b/gi,
    /\bgigabit\b/gi,
    /\b10g\b/gi,
    /\bgerenci[aá]vel\b/gi,
    /\bwi-?fi\s*\d?\b/gi
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const token = normalizeLine(match[0].toLowerCase());
      const key = normalizeItemName(token);
      const processorShort = key.match(/\bi([3579])\b/)?.[0] || '';
      if (
        token &&
        !tokens.some((existing) => normalizeItemName(existing) === key) &&
        !normalizedName.includes(key) &&
        (!processorShort || !normalizedName.includes(processorShort))
      ) {
        tokens.push(token);
      }
      if (tokens.length >= 1) return tokens;
    }
  }

  return tokens;
};

const buildTrShortItemLabel = (item) => {
  const quantity = compactTrQuantity(item?.quantity);
  const name = sanitizeTrItemName(item?.name || '');
  const specs = normalizeTrItemSpecs(item?.specs || '');
  const specTokens = extractTrPrimarySpecTokens(name, specs);
  const parts = [quantity, name, ...specTokens].filter(Boolean);
  return normalizeLine(parts.join(' ')) || name || 'Item não identificado';
};

const escapeRegExp = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripTrItemNameFromSpecs = (item) => {
  const name = sanitizeTrItemName(item?.name || '');
  const specs = normalizeTrItemSpecs(item?.specs || '');
  if (!name || !specs) return specs || 'Especificação não identificada';
  return normalizeLine(specs.replace(new RegExp(`^${escapeRegExp(name)}\\s*[:\\-–]?\\s*`, 'i'), '')) ||
    specs ||
    'Especificação não identificada';
};

const buildTrProductSpecsSummary = (items, fallbackSummary = '') => {
  const validItems = normalizeTrItems(items, []);
  if (validItems.length === 0) {
    const fallback = normalizeLine(fallbackSummary || '');
    if (fallback && !/(ader[eê]ncia|recomenda[cç][aã]o|modelo|licita[cç][aã]o|habilita[cç][aã]o|preambulo|sum[aá]rio|[.]{5,})/i.test(fallback)) {
      return fallback;
    }
    return 'Nenhum produto, serviço ou item técnico foi identificado com segurança no TR.';
  }

  return [
    'Resumo técnico dos produtos e especificações identificados no TR:',
    ...validItems.map((item, index) => {
      const label = buildTrShortItemLabel(item);
      const specs = stripTrItemNameFromSpecs(item);
      return `${index + 1}. ${label}: ${specs}`;
    })
  ].join('\n');
};

const extractTrItemsFromLines = (lines) => {
  const items = [];
  const seen = new Set();
  const objectCandidates = [];
  const searchLines = getTrSearchLines(lines);

  const pushTrItem = (rawName, rawQuantity, rawSpecs = 'Conforme edital/TR', context = '') => {
    const name = sanitizeTrItemName(rawName);
    const quantity = normalizeLine(rawQuantity || 'Não identificado') || 'Não identificado';
    const specs = normalizeTrItemSpecs(rawSpecs || context || 'Conforme edital/TR');
    const signalCorpus = `${name} ${specs}`;

    if (!name || !shouldAcceptTrItemCandidate(name, quantity, specs, context)) return;
    if (isTrAdministrativeOrLegalLine(name) && !hasStrongItemSignal(signalCorpus) && !TR_SPEC_SIGNAL_REGEX.test(signalCorpus)) return;

    const key = normalizeItemName(name);
    if (!key || seen.has(key)) return;

    seen.add(key);
    items.push({ name, quantity, specs });
  };

  for (let i = 0; i < searchLines.length; i += 1) {
    const line = normalizeLine(searchLines[i] || '');
    if (!line || isTrTableHeaderLine(line) || isTrNonItemHeading(line)) continue;

    const specsWindow = () => extractTrSpecsWindow(searchLines, i + 1, 5);
    const quantityFromLine = line.match(TR_ITEM_QUANTITY_PATTERN);
    const nearbyItemSection = hasNearbyTrItemSection(searchLines, i);

    const objectLine = line.match(/^(?:objeto(?:\s+da\s+contrata[cç][aã]o)?|descri[cç][aã]o\s+do\s+objeto)\s*[:\-–]\s*(.{10,420})$/i);
    if (objectLine) {
      objectCandidates.push({
        name: objectLine[1],
        quantity: quantityFromLine ? `${quantityFromLine[1]} ${quantityFromLine[2]}` : 'Não identificado',
        specs: specsWindow() || objectLine[1],
        context: line
      });
    }

    const inlineProduct = line.match(/^(?:produto|servi[cç]o|solu[cç][aã]o|equipamento|software)\s*[:\-–]\s*(.{8,360})$/i);
    if (inlineProduct) {
      pushTrItem(
        inlineProduct[1],
        quantityFromLine ? `${quantityFromLine[1]} ${quantityFromLine[2]}` : 'Não identificado',
        specsWindow() || inlineProduct[1],
        line
      );
      continue;
    }

    const tableRow = line.match(TR_ITEM_ROW_PATTERN);
    if (tableRow) {
      const trailingSpecs = normalizeLine(tableRow[5] || '');
      const specs = normalizeTrItemSpecs([tableRow[2], trailingSpecs, specsWindow()].filter(Boolean).join(' '));
      pushTrItem(tableRow[2], `${tableRow[3]} ${tableRow[4]}`, specs, line);
      continue;
    }

    const tableRowNoUnit = line.match(TR_ITEM_ROW_NO_UNIT_PATTERN);
    if (tableRowNoUnit && nearbyItemSection) {
      const specs = normalizeTrItemSpecs([tableRowNoUnit[2], specsWindow()].filter(Boolean).join(' '));
      pushTrItem(tableRowNoUnit[2], tableRowNoUnit[3], specs, line);
      continue;
    }

    const itemWithExplicitQuantity = line.match(/(?:item|produto|servi[cç]o|solu[cç][aã]o)\s*[:\-–]\s*(.{8,220}?)\s+(?:qtd|qtde|quantidade)\s*[:\-–]?\s*(\d+(?:[\.,]\d+)?)\s*([a-zçãáéíóú².]+)?/i);
    if (itemWithExplicitQuantity) {
      const unit = normalizeLine(itemWithExplicitQuantity[3] || 'un');
      pushTrItem(itemWithExplicitQuantity[1], `${itemWithExplicitQuantity[2]} ${unit}`, specsWindow() || itemWithExplicitQuantity[1], line);
      continue;
    }

    const leadingQuantity = line.match(TR_LEADING_QUANTITY_ITEM_PATTERN);
    if (leadingQuantity && (nearbyItemSection || hasStrongItemSignal(line) || TR_SPEC_SIGNAL_REGEX.test(line))) {
      const unit = normalizeLine(leadingQuantity[2] || '');
      const quantity = [leadingQuantity[1], unit].filter(Boolean).join(' ');
      const specs = normalizeTrItemSpecs([leadingQuantity[3], specsWindow()].filter(Boolean).join(' '));
      pushTrItem(leadingQuantity[3], quantity, specs, line);
      continue;
    }

    const quantityLine = line.match(TR_ITEM_QUANTITY_LINE_PATTERN);
    if (quantityLine && (nearbyItemSection || hasStrongItemSignal(line) || TR_SPEC_SIGNAL_REGEX.test(line))) {
      const specs = normalizeTrItemSpecs([quantityLine[1], quantityLine[4] || '', specsWindow()].filter(Boolean).join(' '));
      pushTrItem(quantityLine[1], `${quantityLine[2]} ${quantityLine[3]}`, specs, line);
      continue;
    }

    const numbered = line.match(/^(?:item|lote|grupo)\s*(\d{1,4}(?:[.\-]\d{1,4})*)\s*[:\-.)]?\s*(.{8,360})$/i) ||
      (nearbyItemSection ? line.match(/^(\d{1,4}(?:[.\-]\d{1,4})*)\s*[:\-.)]?\s*(.{8,360})$/) : null);
    if (numbered) {
      const candidate = numbered[2];
      const specs = specsWindow();
      if (nearbyItemSection || hasStrongItemSignal(candidate) || TR_SPEC_SIGNAL_REGEX.test(`${candidate} ${specs}`)) {
        pushTrItem(
          candidate,
          quantityFromLine ? `${quantityFromLine[1]} ${quantityFromLine[2]}` : 'Não identificado',
          specs || candidate,
          line
        );
      }
    }

    if (items.length >= 30) break;
  }

  if (items.length === 0) {
    for (const item of objectCandidates) {
      pushTrItem(item.name, item.quantity, item.specs, item.context);
      if (items.length >= 6) break;
    }
  }

  if (items.length === 0) {
    for (const item of extractEditalItemsFromLines(searchLines)) {
      pushTrItem(item.name, item.quantity, item.specs, `${item.name} ${item.specs}`);
      if (items.length >= 20) break;
    }
  }

  if (items.length === 0) {
    const objectSummary = detectObjectSummary(searchLines.join('\n'));
    if (objectSummary && (hasStrongItemSignal(objectSummary) || TR_SPEC_SIGNAL_REGEX.test(objectSummary))) {
      pushTrItem(objectSummary, 'Não identificado', objectSummary, objectSummary);
    }
  }

  return items.slice(0, 30);
};

const normalizeTrItems = (value, fallbackItems = []) => {
  const normalizeList = (source) => (Array.isArray(source) ? source : [])
    .map((item) => {
      const name = sanitizeTrItemName(item?.name || item?.item || item?.produto || item?.servico || item?.description || '');
      const quantity = normalizeLine(item?.quantity || item?.qtd || item?.quantidade || 'Não identificado') || 'Não identificado';
      const specs = normalizeTrItemSpecs(item?.specs || item?.especificacoes || item?.description || item?.desc || item?.descricao || 'Conforme edital/TR');
      return { name, quantity, specs };
    })
    .filter((item) => {
      const signalCorpus = `${item.name} ${item.specs}`;
      if (!item.name || !shouldAcceptTrItemCandidate(item.name, item.quantity, item.specs, signalCorpus)) return false;
      return true;
    });

  const seen = new Set();
  return [...normalizeList(fallbackItems), ...normalizeList(value)]
    .filter((item) => {
      const key = normalizeItemName(item.name);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 30);
};

const ensureTrNotebookMinimum = (rows, termRequirements = []) => {
  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const requirement = normalizeTrRequirementText(row?.termRequirement);
      const meetsRequirement = normalizeTrMeetsRequirement(row?.meetsRequirement);
      return {
        termRequirement: requirement,
        meetsRequirement,
        datasheetEvidence: formatTrDatasheetEvidence(
          requirement,
          meetsRequirement,
          row?.datasheetEvidence || ''
        ),
        rationale: normalizeLine(row?.rationale || (
          meetsRequirement === 'ATENDE'
            ? 'Requisito considerado aderente com base nas informações fornecidas.'
            : 'Requisito não comprovado integralmente com as informações fornecidas.'
        ))
      };
    })
    .filter((row) => Boolean(row.termRequirement))
    .slice(0, 20);

  const requirementPool = unique([
    ...ensureArray(termRequirements, 40).map(normalizeTrRequirementText),
    ...normalizedRows.map((row) => normalizeTrRequirementText(row.termRequirement))
  ]).filter(Boolean);

  let placeholderCount = 1;
  while (normalizedRows.length < TR_NOTEBOOK_MIN_ROWS) {
    const requirement =
      requirementPool[normalizedRows.length] ||
      `Requisito técnico/funcional ${placeholderCount}: Não identificado`;
    normalizedRows.push(buildDefaultTrNotebookRow(requirement));
    if (!requirementPool.includes(requirement)) requirementPool.push(requirement);
    placeholderCount += 1;
  }

  const finalNotebook = normalizedRows.slice(0, 20);
  const finalTermRequirements = unique([
    ...requirementPool,
    ...finalNotebook.map((row) => normalizeTrRequirementText(row.termRequirement))
  ]).slice(0, 20);

  return {
    technicalNotebook: finalNotebook,
    termRequirements: finalTermRequirements
  };
};

const buildTrFallbackResponse = (payload, reason) => {
  const fallbackReason = normalizeLine(reason || 'Falha ao processar o TR nesta tentativa.');
  const { technicalNotebook, termRequirements } = ensureTrNotebookMinimum([], []);
  const totalRequirements = technicalNotebook.length;
  const metRequirements = technicalNotebook.filter((item) => item.meetsRequirement === 'ATENDE').length;

  return {
    analysisType: 'tr',
    trSummary:
      'Análise de contingência gerada automaticamente. Revise o caderno técnico e execute novamente para obter estrutura completa.',
    analyzedModel: {
      modelName: normalizeLine(payload.analyzedModelName || 'Não identificado') || 'Não identificado',
      manufacturer: normalizeLine(payload.analyzedModelManufacturer || 'Não identificado') || 'Não identificado',
      providedSpecs: normalizeLine(payload.analyzedModelSpecs || 'Não identificado') || 'Não identificado'
    },
    items: [],
    termRequirements,
    technicalNotebook: technicalNotebook.map((item) => ({
      ...item,
      rationale: fallbackReason
    })),
    compliantEquipment: [],
    complianceOverview: {
      totalRequirements,
      metRequirements,
      fullCompliance: metRequirements === totalRequirements && totalRequirements > 0
    }
  };
};

const extractTrRequirements = (text) => {
  const lines = getTrSearchLines(splitLines(text));
  const requirements = [];
  const technicalCandidates = [];

  for (const line of lines) {
    if (isLikelyTocLine(line) || isTrNonItemHeading(line)) continue;
    const lower = line.toLowerCase();
    const looksLikeRequirement =
      /\b(deve|devera|deverá|obrigat[oó]rio|minim[oa]|suportar|compat[ií]vel|comprovar|atender)\b/.test(lower) ||
      /\brequisito\b/.test(lower);
    const hasTechnicalSignal = hasTechnicalOrFunctionalSignal(line);
    const isLegalOrAdmin = isTrAdministrativeOrLegalLine(line);

    if (hasTechnicalSignal && line.length >= 12 && line.length <= 360) {
      technicalCandidates.push(line);
    }

    if (looksLikeRequirement && line.length >= 12 && line.length <= 360) {
      if (hasTechnicalSignal || !isLegalOrAdmin) {
        requirements.push(line);
      }
    }

    if (requirements.length >= 30) break;
  }

  return unique([...requirements, ...technicalCandidates]).slice(0, 20);
};

const heuristicsTr = (payload, trText, datasheetText = '') => {
  const itemCandidates = extractTrItemsFromLines(splitLines(trText));
  const itemRequirements = itemCandidates
    .map((item) => normalizeTrRequirementText(`${item.name}: ${item.specs}`))
    .filter((item) => !isUnknownText(item));
  const extractedRequirements = unique([
    ...extractTrRequirements(trText),
    ...itemRequirements
  ]).slice(0, 30);
  const corpus = `${payload.analyzedModelSpecs || ''} ${datasheetText || ''}`.toLowerCase();

  const notebookRows = extractedRequirements.slice(0, 12).map((requirement) => {
    const tokens = tokenize(requirement).slice(0, 10);
    const matched = tokens.filter((token) => corpus.includes(token));
    const missing = tokens.filter((token) => !corpus.includes(token));
    const meetsRequirement = matched.length >= 2 ? 'ATENDE' : 'NAO_ATENDE';

    const detail =
      meetsRequirement === 'ATENDE'
        ? `evidência objetiva para ${matched.slice(0, 4).join(', ') || 'requisito técnico avaliado'}`
        : `diferença em ${missing.slice(0, 4).join(', ') || 'requisito técnico não comprovado'}`;

    return {
      termRequirement: normalizeTrRequirementText(requirement),
      meetsRequirement,
      datasheetEvidence: formatTrDatasheetEvidence(requirement, meetsRequirement, detail),
      rationale:
        meetsRequirement === 'ATENDE'
          ? 'Requisito considerado aderente com base nas especificações fornecidas.'
          : 'Requisito não comprovado integralmente com as informações fornecidas.'
    };
  });

  const { technicalNotebook, termRequirements } = ensureTrNotebookMinimum(notebookRows, extractedRequirements);

  const metRequirements = technicalNotebook.filter((item) => item.meetsRequirement === 'ATENDE').length;
  const totalRequirements = technicalNotebook.length;
  const fullCompliance = totalRequirements > 0 && metRequirements === totalRequirements;

  const complianceRate = totalRequirements > 0 ? metRequirements / totalRequirements : 0;
  const compliantEquipment = complianceRate >= 0.6
    ? [
        {
          model: normalizeLine(payload.analyzedModelName || 'Não identificado') || 'Não identificado',
          manufacturer: normalizeLine(payload.analyzedModelManufacturer || 'Não identificado') || 'Não identificado',
          rationale:
            fullCompliance
              ? 'Modelo atende integralmente aos requisitos analisados do TR.'
              : 'Modelo apresenta aderência majoritária aos requisitos analisados do TR.'
        }
      ]
    : [];

  const trSummary = [
    buildTrProductSpecsSummary(itemCandidates),
    itemCandidates.length > 0
      ? `Total de itens identificados: ${itemCandidates.length}.`
      : ''
  ].filter(Boolean).join('\n\n');

  return {
    analysisType: 'tr',
    trSummary,
    analyzedModel: {
      modelName: normalizeLine(payload.analyzedModelName || 'Não identificado') || 'Não identificado',
      manufacturer: normalizeLine(payload.analyzedModelManufacturer || 'Não identificado') || 'Não identificado',
      providedSpecs: normalizeLine(payload.analyzedModelSpecs || 'Não identificado') || 'Não identificado'
    },
    items: itemCandidates,
    termRequirements,
    technicalNotebook,
    compliantEquipment,
    complianceOverview: {
      totalRequirements,
      metRequirements,
      fullCompliance
    }
  };
};

const normalizeTrResponse = (candidate, fallback, payload) => {
  if (!candidate || typeof candidate !== 'object') return fallback;

  const notebook = Array.isArray(candidate.technicalNotebook)
    ? candidate.technicalNotebook
        .map((row) => {
          const requirement = normalizeTrRequirementText(row?.termRequirement || 'Não identificado');
          const meetsRequirement = normalizeTrMeetsRequirement(row?.meetsRequirement);
          return {
            termRequirement: requirement,
            meetsRequirement,
            datasheetEvidence: formatTrDatasheetEvidence(
              requirement,
              meetsRequirement,
              row?.datasheetEvidence || ''
            ),
            rationale: normalizeLine(row?.rationale || (
              meetsRequirement === 'ATENDE'
                ? 'Requisito considerado aderente com base nas informações fornecidas.'
                : 'Requisito não comprovado integralmente com as informações fornecidas.'
            ))
          };
        })
        .filter((row) => row.termRequirement)
        .slice(0, 20)
    : [];

  const fallbackNotebook = Array.isArray(fallback?.technicalNotebook) ? fallback.technicalNotebook : [];
  const initialNotebook = notebook.length ? notebook : fallbackNotebook;
  const items = normalizeTrItems(candidate.items, fallback?.items);
  const initialRequirements = ensureArray(candidate.termRequirements).length
    ? ensureArray(candidate.termRequirements, 30)
    : ensureArray(fallback?.termRequirements, 30);
  const itemRequirements = items
    .map((item) => normalizeTrRequirementText(`${item.name}: ${item.specs}`))
    .filter((item) => !isUnknownText(item));

  const { technicalNotebook, termRequirements } = ensureTrNotebookMinimum(
    initialNotebook,
    unique([...initialRequirements, ...itemRequirements]).slice(0, 40)
  );
  const metRequirements = technicalNotebook.filter((item) => item.meetsRequirement === 'ATENDE').length;
  const totalRequirements = technicalNotebook.length;
  const fullCompliance = totalRequirements > 0 && metRequirements === totalRequirements;

  const compliantEquipment = Array.isArray(candidate.compliantEquipment)
    ? candidate.compliantEquipment
        .map((item) => ({
          model: normalizeLine(item?.model || ''),
          manufacturer: normalizeLine(item?.manufacturer || 'Não identificado') || 'Não identificado',
          rationale: normalizeLine(item?.rationale || 'Aderência técnica identificada.')
        }))
        .filter((item) => item.model)
        .slice(0, 20)
    : (Array.isArray(fallback?.compliantEquipment) ? fallback.compliantEquipment : []);

  return {
    analysisType: 'tr',
    trSummary: buildTrProductSpecsSummary(items, candidate.trSummary || fallback.trSummary),
    analyzedModel: {
      modelName: normalizeLine(candidate?.analyzedModel?.modelName || payload.analyzedModelName || 'Não identificado') || 'Não identificado',
      manufacturer: normalizeLine(candidate?.analyzedModel?.manufacturer || payload.analyzedModelManufacturer || 'Não identificado') || 'Não identificado',
      providedSpecs: normalizeLine(candidate?.analyzedModel?.providedSpecs || payload.analyzedModelSpecs || 'Não identificado') || 'Não identificado'
    },
    items,
    termRequirements,
    technicalNotebook,
    compliantEquipment,
    complianceOverview: {
      totalRequirements,
      metRequirements,
      fullCompliance
    }
  };
};

router.post('/edital-legacy', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const documentText = cleanText(req.body?.documentText || '', 60000);
    if (!documentText) {
      return res.status(400).json({ message: 'Texto do edital não informado.' });
    }

    const result = await runGeminiLegacyEdital({ documentText });
    if (res.headersSent || res.writableEnded) return;
    if (!result) {
      return res.status(502).json({ message: 'Não foi possível concluir a análise do edital com o mecanismo original.' });
    }

    return res.json(result);
  } catch (error) {
    if (res.headersSent || res.writableEnded) return;
    const message = error instanceof Error ? error.message : 'Falha ao processar edital.';
    return res.status(500).json({ message });
  }
});

router.post('/edital', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const payload = req.body || {};
    const requestSchemaErrors = validateBySchema(ANALYSIS_SCHEMAS.request_edital, payload);
    if (requestSchemaErrors.length > 0) {
      return res.status(400).json({
        message: `Payload inválido para request_edital. ${schemaErrorsToMessage(requestSchemaErrors)}`,
        errors: requestSchemaErrors
      });
    }

    const fileDataUri = getMainFileDataUri(payload);
    const inlineDocumentText = getMainInlineText(payload);
    if (!fileDataUri && !inlineDocumentText) {
      return res.status(400).json({ message: 'fileDataUri invalido. Envie Data URI em base64.' });
    }

    const runtimePayload = {
      ...payload,
      ...(fileDataUri ? { fileDataUri } : {})
    };

    let extracted = { text: inlineDocumentText || '', totalPages: 0 };
    if (fileDataUri) {
      const { mimeType, buffer } = parseDataUri(fileDataUri);
      if (mimeType.includes('pdf')) {
        try {
          extracted = await extractPdfText(buffer);
        } catch (error) {
          console.warn('Falha ao extrair texto do PDF de edital. Seguindo com fallback.', error?.message || error);
        }
      } else if (!extracted.text && mimeType.startsWith('text/')) {
        extracted.text = cleanText(buffer.toString('utf8'), MAX_TEXT_CHARS);
      }
    }

    const fallback = heuristicsEdital(extracted.text || '');

    let aiResponse = null;
    if (fileDataUri) {
      try {
        aiResponse = await runGeminiStructured({ mode: 'edital', payload: runtimePayload });
      } catch (error) {
        console.warn('Falha no fluxo Gemini de edital. Seguindo para fallback local.', error?.message || error);
      }
    }

    if (!aiResponse && extracted.text) {
      aiResponse = await runOpenAiStructured({ mode: 'edital', payload: runtimePayload, text: extracted.text });
    }

    const normalized = normalizeEditalResponse(aiResponse, fallback);
    const responseSchemaErrors = validateBySchema(ANALYSIS_SCHEMAS.response_edital, normalized);
    if (responseSchemaErrors.length > 0) {
      return res.status(500).json({
        message: `Response fora do schema response_edital. ${schemaErrorsToMessage(responseSchemaErrors)}`,
        errors: responseSchemaErrors
      });
    }

    return res.json(normalized);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar edital.';
    return res.status(500).json({ message });
  }
});

router.post('/tr', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const payload = req.body || {};
    const requestSchemaErrors = validateBySchema(ANALYSIS_SCHEMAS.request_tr, payload);
    if (requestSchemaErrors.length > 0) {
      return res.status(400).json({
        message: `Payload inválido para request_tr. ${schemaErrorsToMessage(requestSchemaErrors)}`,
        errors: requestSchemaErrors
      });
    }

    const fileDataUri = getMainFileDataUri(payload);
    const inlineDocumentText = getMainInlineText(payload);
    const datasheetFileDataUri = getDatasheetFileDataUri(payload);
    const inlineDatasheetText = getDatasheetInlineText(payload);

    if (!fileDataUri && !inlineDocumentText) {
      return res.status(400).json({ message: 'fileDataUri invalido. Envie Data URI em base64.' });
    }

    const runtimePayload = {
      ...payload,
      ...(fileDataUri ? { fileDataUri } : {}),
      ...(datasheetFileDataUri ? { datasheetFileDataUri } : {})
    };

    let trTextResponse = { text: inlineDocumentText || '', totalPages: 0 };
    if (fileDataUri) {
      const { mimeType, buffer } = parseDataUri(fileDataUri);
      if (mimeType.includes('pdf')) {
        try {
          trTextResponse = await extractPdfText(buffer);
        } catch (error) {
          console.warn('Falha ao extrair texto do PDF de TR. Seguindo com fallback.', error?.message || error);
        }
      } else if (!trTextResponse.text && mimeType.startsWith('text/')) {
        trTextResponse.text = cleanText(buffer.toString('utf8'), MAX_TEXT_CHARS);
      }
    }

    let datasheetText = inlineDatasheetText || '';
    if (datasheetFileDataUri) {
      try {
        const datasheet = parseDataUri(datasheetFileDataUri);
        if (datasheet.mimeType.includes('pdf')) {
          const parsed = await extractPdfText(datasheet.buffer);
          datasheetText = parsed.text;
        } else if (!datasheetText) {
          datasheetText = cleanText(datasheet.buffer.toString('utf8'), 30000);
        }
      } catch {
        if (!datasheetText) datasheetText = '';
      }
    }

    const fallback = heuristicsTr(runtimePayload, trTextResponse.text || '', datasheetText);

    try {
      let aiResponse = null;
      if (fileDataUri) {
        try {
          aiResponse = await runGeminiStructured({ mode: 'tr', payload: runtimePayload });
        } catch (error) {
          console.warn('Falha no fluxo Gemini de TR. Seguindo para fallback local.', error?.message || error);
        }
      }

      if (!aiResponse && trTextResponse.text) {
        aiResponse = await runOpenAiStructured({
          mode: 'tr',
          payload: runtimePayload,
          text: trTextResponse.text,
          datasheetText
        });
      }

      const normalized = normalizeTrResponse(aiResponse, fallback, runtimePayload);
      const responseSchemaErrors = validateBySchema(ANALYSIS_SCHEMAS.response_tr, normalized);
      if (responseSchemaErrors.length > 0) {
        return res.status(500).json({
          message: `Response fora do schema response_tr. ${schemaErrorsToMessage(responseSchemaErrors)}`,
          errors: responseSchemaErrors
        });
      }
      return res.json(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao processar TR.';
      const fallbackResponse = buildTrFallbackResponse(runtimePayload, message);
      const responseSchemaErrors = validateBySchema(ANALYSIS_SCHEMAS.response_tr, fallbackResponse);
      if (responseSchemaErrors.length > 0) {
        return res.status(500).json({
          message: `Response fallback fora do schema response_tr. ${schemaErrorsToMessage(responseSchemaErrors)}`,
          errors: responseSchemaErrors
        });
      }
      return res.json(fallbackResponse);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao processar TR.';
    return res.status(500).json({ message });
  }
});

module.exports = router;
