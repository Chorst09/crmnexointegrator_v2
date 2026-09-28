const express = require('express');
const { prisma } = require('../lib/prisma.cjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { PDFParse } = require('pdf-parse');
const { requireRole } = require('../lib/auth');
const { getTenantCompanyId } = require('../lib/tenantScope.cjs');

const router = express.Router();


const ALLOWED_TYPES = new Set([
  'EDITAL',
  'TERMO_REFERENCIA',
  'ATA_REGISTRO_PRECOS',
  'DOCUMENTACAO'
]);

const ALLOWED_STATUSES = new Set([
  'MONITORANDO',
  'ANALISE_EM_ANDAMENTO',
  'ANALISE_CONCLUIDA',
  'PROPOSTA_EM_PREPARACAO',
  'ENVIADA',
  'SUSPENSA',
  'ENCERRADA'
]);

const ALLOWED_DOC_STATUSES = new Set(['PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO']);

const TYPE_LABELS = {
  EDITAL: 'Edital',
  TERMO_REFERENCIA: 'Termo de Referência',
  ATA_REGISTRO_PRECOS: 'Ata de Registro de Preços',
  DOCUMENTACAO: 'Documentação'
};

const STATUS_LABELS = {
  MONITORANDO: 'Monitorando',
  ANALISE_EM_ANDAMENTO: 'Análise em andamento',
  ANALISE_CONCLUIDA: 'Análise concluída',
  PROPOSTA_EM_PREPARACAO: 'Proposta em preparação',
  ENVIADA: 'Enviada',
  SUSPENSA: 'Suspensa',
  ENCERRADA: 'Encerrada'
};

const getPrismaModelFields = (modelName) => {
  const runtimeFields = prisma?._runtimeDataModel?.models?.[modelName]?.fields;
  if (Array.isArray(runtimeFields)) return new Set(runtimeFields.map((field) => field.name));

  const dmmfFields = prisma?._dmmf?.modelMap?.[modelName]?.fields;
  if (Array.isArray(dmmfFields)) return new Set(dmmfFields.map((field) => field.name));

  return new Set();
};

const prismaModelHasField = (modelName, fieldName) => {
  const fields = getPrismaModelFields(modelName);
  return fields.size === 0 || fields.has(fieldName);
};

const generateOpportunityNumber = async (clientType = 'B2G') => {
  const type = String(clientType || 'B2G').toUpperCase() === 'B2B' ? 'B2B' : 'B2G';
  const year = new Date().getFullYear();
  const prefix = `${type}-${year}-`;
  const latest = await prisma.opportunity.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: 'desc' },
    select: { number: true }
  });
  const latestSequence = Number(String(latest?.number || '').slice(prefix.length)) || 0;
  return `${prefix}${String(latestSequence + 1).padStart(5, '0')}`;
};

const isB2GCompanyRecord = (company) => {
  if (!company) return false;
  if (String(company.clientType || '').toUpperCase() === 'B2G') return true;
  return /\bB2G\b|GOVERNO|\bGOV\b|LICIT/i.test(String(company.segment || ''));
};

const USER_ALLOWED_ROLES = ['ADMIN', 'DIRECTOR', 'MANAGER', 'SELLER', 'PRE_SALES', 'USER'];
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES
  }
});

const B2G_DOC_UPLOAD_DIR = path.join(__dirname, '../uploads/b2g-documents');
const B2G_DOC_INDEX_FILE = path.join(B2G_DOC_UPLOAD_DIR, 'index.json');
const B2G_MANAGED_BIDS_DIR = path.join(__dirname, '../uploads/b2g-managed-bids');
const B2G_MANAGED_BIDS_INDEX_FILE = path.join(B2G_MANAGED_BIDS_DIR, 'index.json');
const B2G_DOC_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const B2G_DOC_EXPIRING_THRESHOLD_DAYS = 30;
const B2G_DOC_ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx']);
const B2G_DOC_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream'
]);

const b2gDocumentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      if (!fs.existsSync(B2G_DOC_UPLOAD_DIR)) {
        fs.mkdirSync(B2G_DOC_UPLOAD_DIR, { recursive: true });
      }
      cb(null, B2G_DOC_UPLOAD_DIR);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const token = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${token}${ext}`);
  }
});

const b2gDocumentUpload = multer({
  storage: b2gDocumentStorage,
  limits: {
    fileSize: B2G_DOC_MAX_UPLOAD_BYTES
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    if (!B2G_DOC_ALLOWED_EXTENSIONS.has(ext)) {
      return cb(new Error('Formato inválido. Use PDF, DOC ou DOCX.'));
    }
    if (!B2G_DOC_ALLOWED_MIME_TYPES.has(mime)) {
      return cb(new Error('Tipo MIME inválido para o arquivo enviado.'));
    }
    return cb(null, true);
  }
});

const cleanText = (value, max = 8000) => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const ensureB2GDocumentStore = () => {
  if (!fs.existsSync(B2G_DOC_UPLOAD_DIR)) {
    fs.mkdirSync(B2G_DOC_UPLOAD_DIR, { recursive: true });
  }
  if (!fs.existsSync(B2G_DOC_INDEX_FILE)) {
    fs.writeFileSync(B2G_DOC_INDEX_FILE, JSON.stringify({ version: 1, documents: [] }, null, 2), 'utf8');
  }
};

const sanitizeB2GDocumentName = (value) => {
  const fromBody = cleanText(value, 220);
  if (fromBody) return fromBody;
  return 'Documento B2G';
};

const resolveSafeDocumentId = () => {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `doc_${Date.now()}_${Math.round(Math.random() * 1e9)}`;
};

const normalizeRepositoryDocument = (input) => {
  if (!input || typeof input !== 'object') return null;

  const id = cleanText(input.id, 120);
  const filename = cleanText(input.filename, 300);
  const originalName = cleanText(input.originalName, 300);
  const mimeType = cleanText(input.mimeType, 200);
  const pathValue = cleanText(input.path, 1200);
  if (!id || !filename || !originalName || !mimeType || !pathValue) return null;

  const createdAt = parseDate(input.createdAt) || new Date();
  const updatedAt = parseDate(input.updatedAt) || createdAt;
  const expirationDate = input.expirationDate ? parseDate(input.expirationDate) : null;
  const size = Number(input.size);

  return {
    id,
    name: sanitizeB2GDocumentName(input.name),
    category: cleanText(input.category, 120) || 'Geral',
    filename,
    originalName,
    mimeType,
    size: Number.isFinite(size) ? size : 0,
    path: pathValue,
    expirationDate: expirationDate ? expirationDate.toISOString() : null,
    createdByName: cleanText(input.createdByName, 180) || null,
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString()
  };
};

const readB2GRepositoryDocuments = () => {
  ensureB2GDocumentStore();
  try {
    const raw = fs.readFileSync(B2G_DOC_INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.documents) ? parsed.documents : [];
    return list
      .map((item) => normalizeRepositoryDocument(item))
      .filter(Boolean);
  } catch (error) {
    console.warn('Falha ao ler índice de documentos B2G:', error.message);
    return [];
  }
};

const writeB2GRepositoryDocuments = (documents) => {
  ensureB2GDocumentStore();
  fs.writeFileSync(
    B2G_DOC_INDEX_FILE,
    JSON.stringify({ version: 1, documents }, null, 2),
    'utf8'
  );
};

const ensureB2GManagedBidStore = () => {
  if (!fs.existsSync(B2G_MANAGED_BIDS_DIR)) {
    fs.mkdirSync(B2G_MANAGED_BIDS_DIR, { recursive: true });
  }
  if (!fs.existsSync(B2G_MANAGED_BIDS_INDEX_FILE)) {
    fs.writeFileSync(B2G_MANAGED_BIDS_INDEX_FILE, JSON.stringify({ version: 1, licitacoes: [] }, null, 2), 'utf8');
  }
};

const toManagedText = (value, max = 800) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return null;
  return cleanText(String(value), max);
};

const firstManagedText = (...values) => {
  for (const value of values) {
    const text = toManagedText(value, 1200);
    if (text) return text;
  }
  return null;
};

const toManagedDateString = (value) => {
  const parsed = parseDate(value);
  if (parsed) return parsed.toISOString();
  return toManagedText(value, 80);
};

const resolveManagedBidId = (input = {}) => firstManagedText(
  input.id,
  input.numeroControlePNCP,
  input.numeroCompra,
  input.numero,
  input.linkSistemaOrigem,
  input.link
);

const getManagedBidScope = (user = {}) => {
  const tenantCompanyId = getTenantCompanyId(user);
  const userId = toManagedText(user.userId || user.id, 160);
  return {
    tenantCompanyId,
    userId,
    scopeKey: tenantCompanyId ? `tenant:${tenantCompanyId}` : `user:${userId || 'default'}`
  };
};

const normalizeManagedBid = (input = {}, overrides = {}) => {
  const merged = { ...input, ...overrides };
  const id = resolveManagedBidId(merged);
  const scopeKey = toManagedText(merged.scopeKey, 260);
  if (!id || !scopeKey) return null;

  const now = new Date().toISOString();
  const valor = parseNumber(merged.valor ?? merged.valorTotalEstimado);
  const createdAt = toManagedDateString(merged.createdAt) || now;
  const updatedAt = toManagedDateString(merged.updatedAt) || now;
  const gerenciadaEm = toManagedDateString(merged.gerenciadaEm) || createdAt;

  return {
    id,
    scopeKey,
    tenantCompanyId: toManagedText(merged.tenantCompanyId, 160),
    createdById: toManagedText(merged.createdById, 160),
    createdByName: toManagedText(merged.createdByName, 180),
    fonte: firstManagedText(merged.fonte, merged.source) || 'Busca B2G',
    fonteLogo: toManagedText(merged.fonteLogo, 40) || '',
    titulo: firstManagedText(merged.titulo, merged.objetoCompra, merged.objeto, merged.descricao) || 'Sem descrição',
    orgao: firstManagedText(merged.orgao, merged.organization, merged.entidade) || '',
    modalidade: firstManagedText(merged.modalidade, merged.modalidadeNome, merged.tipo) || '',
    uf: toManagedText(merged.uf, 2) || '',
    municipio: firstManagedText(merged.municipio, merged.cidade) || '',
    valor,
    dataPublicacao: toManagedDateString(merged.dataPublicacao || merged.dataPublicacaoPncp),
    dataAbertura: toManagedDateString(merged.dataAbertura || merged.dataAberturaProposta),
    dataEncerramento: toManagedDateString(merged.dataEncerramento || merged.dataEncerramentoProposta),
    numero: firstManagedText(merged.numero, merged.numeroCompra) || '',
    ano: toManagedText(merged.ano, 20) || '',
    link: firstManagedText(merged.link, merged.linkSistemaOrigem) || '',
    status: firstManagedText(merged.status, merged.situacao, merged.situacaoCompraNome) || 'Aberto',
    gerenciadaEm,
    createdAt,
    updatedAt
  };
};

const readB2GManagedBids = () => {
  ensureB2GManagedBidStore();
  try {
    const raw = fs.readFileSync(B2G_MANAGED_BIDS_INDEX_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.licitacoes)
      ? parsed.licitacoes
      : Array.isArray(parsed?.items)
        ? parsed.items
        : Array.isArray(parsed)
          ? parsed
          : [];
    return list
      .map((item) => normalizeManagedBid(item))
      .filter(Boolean);
  } catch (error) {
    console.warn('Falha ao ler licitações gerenciadas B2G:', error.message);
    return [];
  }
};

const writeB2GManagedBids = (licitacoes) => {
  ensureB2GManagedBidStore();
  fs.writeFileSync(
    B2G_MANAGED_BIDS_INDEX_FILE,
    JSON.stringify({ version: 1, licitacoes }, null, 2),
    'utf8'
  );
};

const getDocumentValidity = (expirationDateValue) => {
  const expiration = parseDate(expirationDateValue);
  if (!expiration) {
    return {
      status: 'VALID',
      label: 'Válido',
      daysRemaining: null
    };
  }

  const daysRemaining = Math.ceil((expiration.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysRemaining < 0) {
    return {
      status: 'EXPIRED',
      label: 'Expirado',
      daysRemaining
    };
  }
  if (daysRemaining <= B2G_DOC_EXPIRING_THRESHOLD_DAYS) {
    return {
      status: 'EXPIRING',
      label: 'Expirando',
      daysRemaining
    };
  }
  return {
    status: 'VALID',
    label: 'Válido',
    daysRemaining
  };
};

const serializeRepositoryDocument = (document) => {
  const validity = getDocumentValidity(document.expirationDate);
  return {
    ...document,
    validity
  };
};

const normalizeStateCode = (value) => {
  if (!value || typeof value !== 'string') return null;
  const v = value.trim().toUpperCase();
  if (!v) return null;
  return v.slice(0, 2);
};

const normalizeTags = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(
      value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, 20)
    )];
  }

  if (typeof value === 'string') {
    return [...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 20)
    )];
  }

  return [];
};

const normalizeDocumentation = (value) => {
  if (!Array.isArray(value)) return [];

  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const name = cleanText(item.name, 160);
      if (!name) return null;

      const status = ALLOWED_DOC_STATUSES.has(item.status) ? item.status : 'PENDENTE';
      return {
        id: cleanText(item.id, 80) || `doc_${Date.now()}_${index}`,
        name,
        required: item.required !== false,
        status,
        notes: cleanText(item.notes, 600) || ''
      };
    })
    .filter(Boolean)
    .slice(0, 100);
};

const summarizeNotice = (notice) => {
  const typeLabel = TYPE_LABELS[notice.type] || 'Documento';
  const due = notice.proposalDueDate
    ? new Date(notice.proposalDueDate).toLocaleDateString('pt-BR')
    : null;
  const opening = notice.openingDate
    ? new Date(notice.openingDate).toLocaleDateString('pt-BR')
    : null;
  const amount =
    typeof notice.estimatedValue === 'number'
      ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(notice.estimatedValue)
      : null;

  const parts = [
    `${typeLabel}${notice.referenceCode ? ` ${notice.referenceCode}` : ''} do órgão ${notice.organization}${notice.stateCode ? `/${notice.stateCode}` : ''}.`
  ];

  if (notice.objectDescription) {
    parts.push(`Objeto: ${notice.objectDescription}.`);
  }
  if (opening) {
    parts.push(`Abertura em ${opening}.`);
  }
  if (due) {
    parts.push(`Prazo para proposta até ${due}.`);
  }
  if (amount) {
    parts.push(`Valor estimado: ${amount}.`);
  }

  return parts.join(' ').trim();
};

const normalizeNoticePayload = (body = {}, { partial = false } = {}) => {
  const data = {};

  if (!partial || body.type !== undefined) {
    if (ALLOWED_TYPES.has(body.type)) data.type = body.type;
  }

  if (!partial || body.title !== undefined) {
    const title = cleanText(body.title, 220);
    if (title) data.title = title;
  }

  if (!partial || body.referenceCode !== undefined) {
    data.referenceCode = cleanText(body.referenceCode, 120);
  }

  if (!partial || body.organization !== undefined) {
    const organization = cleanText(body.organization, 220);
    if (organization) data.organization = organization;
  }

  if (!partial || body.stateCode !== undefined || body.uf !== undefined) {
    data.stateCode = normalizeStateCode(body.stateCode || body.uf);
  }

  if (!partial || body.modality !== undefined) {
    data.modality = cleanText(body.modality, 120);
  }

  if (!partial || body.objectDescription !== undefined) {
    data.objectDescription = cleanText(body.objectDescription, 4000);
  }

  if (!partial || body.estimatedValue !== undefined) {
    data.estimatedValue = parseNumber(body.estimatedValue);
  }

  if (!partial || body.openingDate !== undefined) {
    data.openingDate = parseDate(body.openingDate);
  }

  if (!partial || body.proposalDueDate !== undefined) {
    data.proposalDueDate = parseDate(body.proposalDueDate);
  }

  if (!partial || body.status !== undefined) {
    if (ALLOWED_STATUSES.has(body.status)) data.status = body.status;
  }

  if (!partial || body.sourceUrl !== undefined) {
    data.sourceUrl = cleanText(body.sourceUrl, 800);
  }

  if (!partial || body.documentText !== undefined) {
    data.documentText = cleanText(body.documentText, 30000);
  }

  if (!partial || body.summary !== undefined) {
    data.summary = cleanText(body.summary, 5000);
  }

  if (!partial || body.tags !== undefined) {
    data.tags = normalizeTags(body.tags);
  }

  if (!partial || body.documentation !== undefined) {
    data.documentation = normalizeDocumentation(body.documentation);
  }

  if (!partial || body.aiAnalysis !== undefined) {
    if (body.aiAnalysis && typeof body.aiAnalysis === 'object' && !Array.isArray(body.aiAnalysis)) {
      data.aiAnalysis = body.aiAnalysis;
    } else if (body.aiAnalysis === null) {
      data.aiAnalysis = null;
    }
  }

  if (partial) {
    Object.keys(data).forEach((key) => {
      if (data[key] === undefined) delete data[key];
    });
  }

  return data;
};

const sanitizeChecklist = (documentation = []) => {
  if (!Array.isArray(documentation) || documentation.length === 0) {
    return [
      { item: 'Certidões fiscais e trabalhistas', status: 'pendente', details: 'Definir responsáveis e prazos' },
      { item: 'Atestado de capacidade técnica', status: 'pendente', details: 'Conferir aderência ao objeto' },
      { item: 'Documentos de habilitação jurídica', status: 'pendente', details: 'Validar versão atualizada' }
    ];
  }

  return documentation.map((doc) => ({
    item: doc.name,
    status:
      doc.status === 'CONCLUIDO'
        ? 'ok'
        : doc.status === 'EM_ANDAMENTO'
          ? 'em_andamento'
          : 'pendente',
    details: doc.notes || 'Sem observações'
  }));
};

const truncate = (value, max = 12000) => {
  if (!value || typeof value !== 'string') return '';
  return value.length <= max ? value : `${value.slice(0, max)}...`;
};

const daysUntil = (dateValue) => {
  if (!dateValue) return null;
  const now = new Date();
  const target = new Date(dateValue);
  const ms = target.getTime() - now.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(value)));

const parseBrazilianCurrency = (value) => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

const parseBrazilianDate = (value) => {
  if (!value || typeof value !== 'string') return null;
  const match = value.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  let year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (year < 100) year += 2000;
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const cleanFileTitle = (filename) => {
  const noExt = String(filename || '')
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return cleanText(noExt, 220) || `Documento B2G ${new Date().toLocaleDateString('pt-BR')}`;
};

const inferNoticeFromDocumentText = (text, originalName, mode) => {
  const compact = String(text || '')
    .replace(/\r/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .slice(0, 120000);

  const find = (regex) => compact.match(regex)?.[1]?.trim() || null;

  const modality = (() => {
    const m = compact.match(
      /(preg[aã]o(?:\s+eletr[oô]nico)?|concorr[eê]ncia|dispensa(?:\s+eletr[oô]nica)?|inexigibilidade|tomada de pre[cç]os)/i
    );
    return cleanText(m?.[1] || '', 120);
  })();

  const referenceCode = cleanText(
    find(
      /(?:edital|preg[aã]o|concorr[eê]ncia|processo|licita[cç][aã]o)\s*(?:n[º°.]?|n[oº]|no)?\s*[:\-]?\s*([0-9]{1,6}[\/\-.][0-9]{2,4})/i
    ),
    120
  );

  const organization =
    cleanText(
      find(
        /(?:[óo]rg[aã]o\s+licitante|unidade\s+demandante|entidade)\s*[:\-]\s*([^\n]{4,220})/i
      ),
      220
    ) ||
    cleanText(
      compact.match(
        /(prefeitura(?:\s+municipal)?\s+de\s+[^\n,;]{3,120}|governo\s+do\s+estado\s+de\s+[^\n,;]{3,120}|secretaria\s+[^\n,;]{3,120}|tribunal\s+[^\n,;]{3,120}|minist[ée]rio\s+[^\n,;]{3,120})/i
      )?.[1] || '',
      220
    ) ||
    'Órgão não identificado';

  const objectDescription = cleanText(
    find(/(?:objeto(?:\s+da\s+licita[cç][aã]o)?)\s*[:\-]\s*([\s\S]{20,700})/i),
    1200
  );

  const estimatedValue = parseBrazilianCurrency(
    find(/(?:valor(?:\s+global|\s+estimado|\s+total)?|pre[cç]o\s+global)\s*[:\-]?\s*(R\$\s*[0-9\.\,]+)/i)
  );

  const openingDate = parseBrazilianDate(
    find(/(?:abertura(?:\s+da\s+sess[aã]o)?|sess[aã]o\s+p[úu]blica)\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i)
  );

  const proposalDueDate = parseBrazilianDate(
    find(/(?:prazo(?:\s+final)?\s+para\s+(?:envio|apresenta[cç][aã]o)\s+de\s+propostas?|encerramento\s+de\s+propostas?)\s*[:\-]?\s*([0-9]{1,2}[\/\-.][0-9]{1,2}[\/\-.][0-9]{2,4})/i)
  );

  return {
    type: mode === 'TR' ? 'TERMO_REFERENCIA' : 'EDITAL',
    title: cleanFileTitle(originalName),
    referenceCode,
    organization,
    modality,
    objectDescription,
    estimatedValue,
    openingDate,
    proposalDueDate
  };
};

const normalizeUploadedPdfText = async (buffer) => {
  const parser = new PDFParse({ data: buffer });
  try {
    const parsed = await parser.getText();
    const rawText = typeof parsed?.text === 'string' ? parsed.text : '';
    const collapsed = rawText
      .replace(/\u0000/g, ' ')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return {
      text: cleanText(collapsed, 30000) || '',
      numPages: Number(parsed?.total || parsed?.pages?.length || 0)
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
};

const toNonEmptyString = (value, max = 8000) => cleanText(String(value || ''), max);

const mergeNoticeOverrides = (base, overrides) => {
  const result = { ...(base || {}) };
  if (!overrides || typeof overrides !== 'object') return result;

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === null || value === '') continue;
    result[key] = value;
  }

  return result;
};

const buildNoticeOverridesFromTemplateAnalysis = (analysisData, mode, originalName) => {
  if (!analysisData || typeof analysisData !== 'object' || Array.isArray(analysisData)) {
    return {
      type: mode === 'TR' ? 'TERMO_REFERENCIA' : 'EDITAL',
      title: cleanFileTitle(originalName)
    };
  }

  const analysisType = String(analysisData.analysisType || '').toLowerCase();
  const general = analysisData.general && typeof analysisData.general === 'object' ? analysisData.general : {};
  const deadlines = analysisData.deadlines && typeof analysisData.deadlines === 'object' ? analysisData.deadlines : {};

  return {
    type: analysisType === 'tr' || mode === 'TR' ? 'TERMO_REFERENCIA' : 'EDITAL',
    title: cleanFileTitle(originalName),
    organization: toNonEmptyString(general.agency, 220),
    modality: toNonEmptyString(general.modality, 120),
    objectDescription: toNonEmptyString(
      analysisType === 'tr'
        ? analysisData.trSummary || general.objectSummary
        : general.objectSummary || analysisData.trSummary,
      1200
    ),
    openingDate: parseBrazilianDate(String(general.openingDate || '')),
    proposalDueDate: parseBrazilianDate(String(deadlines.proposalDeadline || ''))
  };
};

const buildInternalAnalysisFromTemplateData = (analysisData, notice) => {
  if (!analysisData || typeof analysisData !== 'object' || Array.isArray(analysisData)) return null;

  const analysisType = String(analysisData.analysisType || '').toLowerCase();
  const noticeSafe = notice || {};

  if (analysisType === 'tr') {
    const termRequirements = Array.isArray(analysisData.termRequirements)
      ? analysisData.termRequirements.map((item) => toNonEmptyString(item, 500)).filter(Boolean).slice(0, 20)
      : [];

    const notebook = Array.isArray(analysisData.technicalNotebook)
      ? analysisData.technicalNotebook
          .map((row) => {
            const meets = String(row?.meetsRequirement || '').toUpperCase() === 'ATENDE' ? 'ATENDE' : 'NAO_ATENDE';
            return {
              termRequirement: toNonEmptyString(row?.termRequirement, 500) || 'Requisito não identificado',
              meetsRequirement: meets,
              datasheetEvidence: toNonEmptyString(row?.datasheetEvidence, 900) || '',
              rationale: toNonEmptyString(row?.rationale, 900) || 'Sem justificativa.'
            };
          })
          .slice(0, 20)
      : [];

    const totalRequirementsRaw = Number(analysisData?.complianceOverview?.totalRequirements);
    const metRequirementsRaw = Number(analysisData?.complianceOverview?.metRequirements);
    const totalRequirements = Number.isFinite(totalRequirementsRaw)
      ? totalRequirementsRaw
      : Math.max(notebook.length, termRequirements.length, 1);
    const metFromNotebook = notebook.filter((item) => item.meetsRequirement === 'ATENDE').length;
    const metRequirements = Number.isFinite(metRequirementsRaw) ? metRequirementsRaw : metFromNotebook;
    const safeTotal = Math.max(1, totalRequirements);
    const safeMet = Math.max(0, Math.min(safeTotal, metRequirements));
    const scoreAderencia = clampScore((safeMet / safeTotal) * 100);
    const recomendacao =
      scoreAderencia >= 85 ? 'GO' : scoreAderencia >= 60 ? 'GO_COM_RESSALVAS' : 'NO_GO';

    const riscos = notebook
      .filter((item) => item.meetsRequirement === 'NAO_ATENDE')
      .map((item) => item.rationale || `Requisito pendente: ${item.termRequirement}`)
      .filter(Boolean)
      .slice(0, 12);
    if (riscos.length === 0) {
      riscos.push('Monitorar atualização do TR e validar aderência final com engenharia.');
    }

    const oportunidades = Array.isArray(analysisData.compliantEquipment)
      ? analysisData.compliantEquipment
          .map((item) => {
            const model = toNonEmptyString(item?.model, 180);
            const rationale = toNonEmptyString(item?.rationale, 400);
            if (!model) return null;
            return rationale ? `${model}: ${rationale}` : model;
          })
          .filter(Boolean)
          .slice(0, 12)
      : [];
    if (oportunidades.length === 0) {
      oportunidades.push('Consolidar plano de aderência técnica para elevar taxa de atendimento do TR.');
    }

    const proximasAcoes = [
      'Validar requisitos não atendidos com o time técnico.',
      'Atualizar matriz de conformidade TR x modelo analisado.',
      'Ajustar estratégia comercial conforme riscos de não conformidade.',
      'Registrar evidências de datasheet para os pontos críticos.'
    ];

    const checklistDocumentacao = (termRequirements.length ? termRequirements : notebook.map((item) => item.termRequirement))
      .slice(0, 20)
      .map((requirement) => {
        const match = notebook.find((item) =>
          item.termRequirement.toLowerCase().includes(String(requirement || '').toLowerCase())
        );
        return {
          item: requirement,
          status: match?.meetsRequirement === 'ATENDE' ? 'ok' : 'pendente',
          details:
            match?.datasheetEvidence ||
            match?.rationale ||
            'Necessário validar documentação/evidência para o requisito.'
        };
      });

    return {
      provider: 'template-ai-analysis',
      generatedAt: new Date().toISOString(),
      templateExtractedData: analysisData,
      recomendacao,
      scoreAderencia,
      resumoExecutivo:
        toNonEmptyString(analysisData.trSummary, 5000) ||
        summarizeNotice(noticeSafe),
      pontosChave: [
        `Modelo analisado: ${toNonEmptyString(analysisData?.analyzedModel?.modelName, 180) || 'Não informado'}`,
        `Fabricante: ${toNonEmptyString(analysisData?.analyzedModel?.manufacturer, 180) || 'Não informado'}`,
        `Requisitos atendidos: ${safeMet}/${safeTotal}`,
        `Status do parecer: ${recomendacao}`
      ],
      riscos,
      oportunidades,
      proximasAcoes,
      checklistDocumentacao
    };
  }

  const general = analysisData.general && typeof analysisData.general === 'object' ? analysisData.general : {};
  const requirements = analysisData.requirements && typeof analysisData.requirements === 'object'
    ? analysisData.requirements
    : {};
  const items = Array.isArray(analysisData.items) ? analysisData.items : [];
  const risks = Array.isArray(analysisData.risks)
    ? analysisData.risks.map((item) => toNonEmptyString(item, 900)).filter(Boolean).slice(0, 12)
    : [];

  const legal = Array.isArray(requirements.legal) ? requirements.legal : [];
  const technical = Array.isArray(requirements.technical) ? requirements.technical : [];
  const economic = Array.isArray(requirements.economic) ? requirements.economic : [];
  const fiscal = Array.isArray(requirements.fiscal) ? requirements.fiscal : [];
  const checklistNames = [...legal, ...technical, ...economic, ...fiscal]
    .map((item) => toNonEmptyString(item, 400))
    .filter(Boolean)
    .slice(0, 20);

  const scoreBase = 72 + Math.min(items.length, 6) * 2 - Math.min(risks.length, 8) * 5;
  const scoreAderencia = clampScore(scoreBase);
  const recomendacao =
    scoreAderencia >= 75 ? 'GO' : scoreAderencia >= 55 ? 'GO_COM_RESSALVAS' : 'NO_GO';

  const oportunidades = items
    .map((item) => toNonEmptyString(item?.name, 220))
    .filter(Boolean)
    .slice(0, 8)
    .map((name) => `Item com potencial comercial: ${name}`);
  if (oportunidades.length === 0) {
    oportunidades.push('Detalhar itens prioritários para aumentar competitividade da proposta.');
  }

  const checklistDocumentacao = checklistNames.length
    ? checklistNames.map((item) => ({
        item,
        status: 'pendente',
        details: 'Revisar documentação comprobatória para este requisito.'
      }))
    : sanitizeChecklist(noticeSafe.documentation || []);

  return {
    provider: 'template-ai-analysis',
    generatedAt: new Date().toISOString(),
    templateExtractedData: analysisData,
    recomendacao,
    scoreAderencia,
    resumoExecutivo:
      toNonEmptyString(general.objectSummary, 5000) ||
      summarizeNotice(noticeSafe),
    pontosChave: [
      `Órgão: ${toNonEmptyString(general.agency, 220) || noticeSafe.organization || 'Não informado'}`,
      `Modalidade: ${toNonEmptyString(general.modality, 120) || noticeSafe.modality || 'Não informado'}`,
      `Portal: ${toNonEmptyString(general.portal, 160) || 'Não identificado'}`,
      `Requisitos mapeados: ${checklistNames.length}`
    ],
    riscos: risks.length ? risks : ['Monitorar atualizações e retificações do edital durante o processo.'],
    oportunidades,
    proximasAcoes: [
      'Conferir prazos críticos e marcos de proposta.',
      'Validar requisitos técnicos e fiscais com as áreas responsáveis.',
      'Ajustar estratégia de preço e proposta técnica.',
      'Registrar plano de ação para mitigar riscos de desclassificação.'
    ],
    checklistDocumentacao
  };
};

const runHeuristicAnalysis = (notice, instruction = '', fallbackReason = null) => {
  const corpus = [
    notice.title || '',
    notice.organization || '',
    notice.modality || '',
    notice.objectDescription || '',
    notice.documentText || '',
    instruction || ''
  ]
    .join(' ')
    .toLowerCase();

  const hasAny = (terms) => terms.some((term) => corpus.includes(term));
  const dueInDays = daysUntil(notice.proposalDueDate || notice.openingDate);
  const checklist = sanitizeChecklist(notice.documentation || []);

  let score = 55;
  if (notice.type === 'ATA_REGISTRO_PRECOS') score += 9;
  if (hasAny(['registro de preços', 'ata de registro'])) score += 6;
  if (hasAny(['transformação digital', 'modernização', 'inovação'])) score += 6;
  if (hasAny(['atestado', 'qualificação técnica', 'capacidade técnica'])) score -= 8;
  if (hasAny(['garantia contratual', 'garantia de execução'])) score -= 4;

  if (typeof notice.estimatedValue === 'number') {
    if (notice.estimatedValue >= 1000000) score += 8;
    else if (notice.estimatedValue >= 300000) score += 4;
  }

  if (typeof dueInDays === 'number') {
    if (dueInDays < 0) score -= 25;
    else if (dueInDays <= 7) score -= 12;
    else if (dueInDays <= 15) score -= 4;
    else score += 4;
  }

  const pendencias = checklist.filter((item) => item.status === 'pendente').length;
  if (pendencias >= 3) score -= 7;

  const finalScore = clampScore(score);
  const recomendacao =
    finalScore >= 75 ? 'GO' : finalScore >= 55 ? 'GO_COM_RESSALVAS' : 'NO_GO';

  const riscos = [];
  if (typeof dueInDays === 'number' && dueInDays <= 10) {
    riscos.push('Prazo curto para consolidação da proposta e documentação.');
  }
  if (hasAny(['atestado', 'qualificação técnica'])) {
    riscos.push('Exigências técnicas podem restringir competitividade sem acervo adequado.');
  }
  if (hasAny(['garantia contratual'])) {
    riscos.push('Demanda de garantias pode pressionar fluxo de caixa.');
  }
  if (riscos.length === 0) {
    riscos.push('Monitorar esclarecimentos e possíveis retificações no edital.');
  }

  const oportunidades = [];
  if (notice.type === 'ATA_REGISTRO_PRECOS' || hasAny(['registro de preços'])) {
    oportunidades.push('Ata de Registro de Preços pode ampliar volume contratado ao longo da vigência.');
  }
  if (typeof notice.estimatedValue === 'number' && notice.estimatedValue > 0) {
    oportunidades.push('Valor estimado permite priorização comercial e planejamento de equipe dedicada.');
  }
  if (hasAny(['inovação', 'tecnologia', 'digital'])) {
    oportunidades.push('Objeto favorece diferenciação por proposta técnica e abordagem de inovação.');
  }
  if (oportunidades.length === 0) {
    oportunidades.push('Organizar proposta técnica clara com foco em aderência ao TR para elevar competitividade.');
  }

  const proximasAcoes = [
    'Revisar item a item do edital/TR com matriz de conformidade.',
    'Validar documentos de habilitação e certidões com antecedência.',
    'Definir estratégia de preço e condições comerciais para o órgão público.',
    'Registrar perguntas para fase de esclarecimentos, quando aplicável.'
  ];

  const resumoExecutivo = summarizeNotice(notice);

  return {
    provider: fallbackReason ? 'heuristic-fallback' : 'heuristic-local',
    generatedAt: new Date().toISOString(),
    fallbackReason,
    recomendacao,
    scoreAderencia: finalScore,
    resumoExecutivo,
    pontosChave: [
      `Órgão: ${notice.organization || 'Não informado'}${notice.stateCode ? `/${notice.stateCode}` : ''}`,
      `Tipo: ${TYPE_LABELS[notice.type] || notice.type}`,
      `Status atual: ${STATUS_LABELS[notice.status] || notice.status}`,
      typeof dueInDays === 'number' ? `Prazo estimado: ${dueInDays} dia(s)` : 'Prazo: não informado'
    ],
    riscos,
    oportunidades,
    proximasAcoes,
    checklistDocumentacao: checklist
  };
};

const tryParseJsonObject = (rawContent) => {
  if (!rawContent || typeof rawContent !== 'string') return null;
  const direct = (() => {
    try {
      return JSON.parse(rawContent);
    } catch {
      return null;
    }
  })();

  if (direct && typeof direct === 'object') return direct;

  const start = rawContent.indexOf('{');
  const end = rawContent.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(rawContent.slice(start, end + 1));
  } catch {
    return null;
  }
};

const runOpenAiAnalysis = async (notice, instruction = '') => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  const systemPrompt = [
    'Você é um especialista em licitações públicas B2G no Brasil.',
    'Analise edital/TR/ata e retorne apenas JSON válido.',
    'Use linguagem objetiva em português.'
  ].join(' ');

  const userPayload = {
    notice: {
      type: notice.type,
      title: notice.title,
      referenceCode: notice.referenceCode,
      organization: notice.organization,
      stateCode: notice.stateCode,
      modality: notice.modality,
      objectDescription: notice.objectDescription,
      estimatedValue: notice.estimatedValue,
      openingDate: notice.openingDate,
      proposalDueDate: notice.proposalDueDate,
      status: notice.status,
      sourceUrl: notice.sourceUrl
    },
    instruction,
    documentText: truncate(notice.documentText || '', 12000),
    expectedSchema: {
      resumoExecutivo: 'string',
      recomendacao: 'GO | GO_COM_RESSALVAS | NO_GO',
      scoreAderencia: 'number de 0 a 100',
      pontosChave: ['string'],
      riscos: ['string'],
      oportunidades: ['string'],
      proximasAcoes: ['string'],
      checklistDocumentacao: [
        { item: 'string', status: 'ok | em_andamento | pendente', details: 'string' }
      ]
    }
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
      const errorText = await response.text();
      throw new Error(`OpenAI HTTP ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const json = await response.json();
    const content = json?.choices?.[0]?.message?.content;
    const parsed = tryParseJsonObject(content);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Resposta inválida da IA');
    }

    return {
      provider: `openai:${model}`,
      generatedAt: new Date().toISOString(),
      recomendacao: parsed.recomendacao || 'GO_COM_RESSALVAS',
      scoreAderencia: clampScore(Number(parsed.scoreAderencia ?? 60)),
      resumoExecutivo: cleanText(parsed.resumoExecutivo, 5000) || summarizeNotice(notice),
      pontosChave: Array.isArray(parsed.pontosChave) ? parsed.pontosChave.slice(0, 12) : [],
      riscos: Array.isArray(parsed.riscos) ? parsed.riscos.slice(0, 12) : [],
      oportunidades: Array.isArray(parsed.oportunidades) ? parsed.oportunidades.slice(0, 12) : [],
      proximasAcoes: Array.isArray(parsed.proximasAcoes) ? parsed.proximasAcoes.slice(0, 12) : [],
      checklistDocumentacao: Array.isArray(parsed.checklistDocumentacao)
        ? parsed.checklistDocumentacao.slice(0, 20)
        : sanitizeChecklist(notice.documentation || [])
    };
  } finally {
    clearTimeout(timeout);
  }
};

const generateAnalysis = async (notice, instruction) => {
  try {
    const openAi = await runOpenAiAnalysis(notice, instruction);
    if (openAi) return openAi;
  } catch (error) {
    return runHeuristicAnalysis(notice, instruction, error.message);
  }

  return runHeuristicAnalysis(notice, instruction);
};

const createHistory = async ({
  noticeId,
  eventType,
  title,
  details = null,
  payload = null,
  createdByName = null
}) => {
  return prisma.bidNoticeHistory.create({
    data: {
      noticeId,
      eventType,
      title,
      details,
      payload,
      createdByName
    }
  });
};

router.get('/licitacoes-gerenciadas', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const scope = getManagedBidScope(req.user);
    const rows = readB2GManagedBids()
      .filter((item) => item.scopeKey === scope.scopeKey)
      .sort((a, b) => {
        const aTs = parseDate(a.gerenciadaEm || a.createdAt)?.getTime() || 0;
        const bTs = parseDate(b.gerenciadaEm || b.createdAt)?.getTime() || 0;
        return bTs - aTs;
      });

    return res.json({ data: rows });
  } catch (error) {
    console.error('Erro ao listar licitações gerenciadas B2G:', error);
    return res.status(500).json({ error: 'Erro interno ao listar licitações gerenciadas.' });
  }
});

router.post('/licitacoes-gerenciadas', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const input = req.body?.item && typeof req.body.item === 'object' ? req.body.item : req.body;
    const externalId = resolveManagedBidId(input);
    if (!externalId) {
      return res.status(400).json({ error: 'Identificador da licitação é obrigatório.' });
    }

    const scope = getManagedBidScope(req.user);
    const records = readB2GManagedBids();
    const existingIndex = records.findIndex((item) => item.scopeKey === scope.scopeKey && item.id === externalId);
    const existing = existingIndex >= 0 ? records[existingIndex] : null;
    const now = new Date().toISOString();
    const nextBid = normalizeManagedBid(input, {
      id: externalId,
      scopeKey: scope.scopeKey,
      tenantCompanyId: scope.tenantCompanyId,
      createdById: existing?.createdById || scope.userId || null,
      createdByName: existing?.createdByName || req.user?.name || req.user?.email || null,
      createdAt: existing?.createdAt || input?.createdAt || now,
      gerenciadaEm: existing?.gerenciadaEm || input?.gerenciadaEm || now,
      updatedAt: now
    });

    if (!nextBid) {
      return res.status(400).json({ error: 'Dados da licitação são inválidos.' });
    }

    if (existingIndex >= 0) {
      records[existingIndex] = nextBid;
    } else {
      records.unshift(nextBid);
    }

    writeB2GManagedBids(records);
    return res.status(existing ? 200 : 201).json({ data: nextBid });
  } catch (error) {
    console.error('Erro ao salvar licitação gerenciada B2G:', error);
    return res.status(500).json({ error: 'Erro interno ao salvar licitação gerenciada.' });
  }
});

router.delete('/licitacoes-gerenciadas/:id', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const id = toManagedText(req.params?.id, 1200);
    if (!id) {
      return res.status(400).json({ error: 'Identificador da licitação é obrigatório.' });
    }

    const scope = getManagedBidScope(req.user);
    const records = readB2GManagedBids();
    const next = records.filter((item) => !(item.scopeKey === scope.scopeKey && item.id === id));
    if (next.length !== records.length) {
      writeB2GManagedBids(next);
    }

    return res.json({ success: true, removed: records.length - next.length });
  } catch (error) {
    console.error('Erro ao remover licitação gerenciada B2G:', error);
    return res.status(500).json({ error: 'Erro interno ao remover licitação gerenciada.' });
  }
});

router.get('/documentos', async (req, res) => {
  try {
    const search = cleanText(req.query?.search, 140)?.toLowerCase() || '';
    const statusFilter = cleanText(req.query?.status, 40)?.toUpperCase() || '';

    const rows = readB2GRepositoryDocuments()
      .map((item) => serializeRepositoryDocument(item))
      .filter((item) => {
        if (search) {
          const haystack = [
            item.name,
            item.category,
            item.originalName,
            item.createdByName
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!haystack.includes(search)) return false;
        }

        if (statusFilter && item.validity?.status !== statusFilter) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aTs = parseDate(a.createdAt)?.getTime() || 0;
        const bTs = parseDate(b.createdAt)?.getTime() || 0;
        return bTs - aTs;
      });

    return res.json(rows);
  } catch (error) {
    console.error('Erro ao listar documentos B2G:', error);
    return res.status(500).json({ error: 'Erro interno ao listar documentos B2G.' });
  }
});

router.get('/documentos/export-kit', async (req, res) => {
  try {
    const rows = readB2GRepositoryDocuments()
      .map((item) => {
        const validity = getDocumentValidity(item.expirationDate);
        return {
          ...item,
          validity
        };
      })
      .sort((a, b) => {
        const aTs = parseDate(a.createdAt)?.getTime() || 0;
        const bTs = parseDate(b.createdAt)?.getTime() || 0;
        return bTs - aTs;
      });

    const escapeCsv = (value) => {
      const text = String(value ?? '');
      if (/[",;\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const headers = ['Nome', 'Categoria', 'Arquivo', 'Validade', 'Status', 'Criado em', 'Responsável'];
    const lines = [headers.join(';')];
    rows.forEach((doc) => {
      lines.push(
        [
          doc.name,
          doc.category || '-',
          doc.originalName,
          doc.expirationDate ? new Date(doc.expirationDate).toLocaleDateString('pt-BR') : '-',
          doc.validity?.label || '-',
          doc.createdAt ? new Date(doc.createdAt).toLocaleString('pt-BR') : '-',
          doc.createdByName || '-'
        ]
          .map((item) => escapeCsv(item))
          .join(';')
      );
    });

    const csv = lines.join('\n');
    const suffix = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="kit-documentacao-b2g-${suffix}.csv"`);
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('Erro ao exportar kit documental B2G:', error);
    return res.status(500).json({ error: 'Erro interno ao exportar kit documental.' });
  }
});

router.post('/documentos/upload', requireRole(USER_ALLOWED_ROLES), (req, res) => {
  b2gDocumentUpload.single('file')(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo excede o limite de 20MB.' });
        }
        return res.status(400).json({ error: uploadError.message || 'Falha no upload do documento.' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'Selecione um arquivo PDF, DOC ou DOCX.' });
      }

      const expirationDateRaw = cleanText(req.body?.expirationDate, 60);
      const expirationDate = expirationDateRaw ? parseDate(expirationDateRaw) : null;
      if (expirationDateRaw && !expirationDate) {
        if (req.file?.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(400).json({ error: 'Data de validade inválida.' });
      }

      const repositoryDocs = readB2GRepositoryDocuments();
      const now = new Date().toISOString();
      const nextDoc = normalizeRepositoryDocument({
        id: resolveSafeDocumentId(),
        name: cleanText(req.body?.name, 220) || cleanText(path.parse(req.file.originalname).name, 220),
        category: cleanText(req.body?.category, 120) || 'Geral',
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        expirationDate: expirationDate ? expirationDate.toISOString() : null,
        createdByName: req.user?.name || null,
        createdAt: now,
        updatedAt: now
      });

      repositoryDocs.push(nextDoc);
      writeB2GRepositoryDocuments(repositoryDocs);

      return res.status(201).json(serializeRepositoryDocument(nextDoc));
    } catch (error) {
      console.error('Erro ao salvar documento B2G:', error);
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ error: 'Erro interno ao salvar documento B2G.' });
    }
  });
});

router.get('/documentos/:id/view', async (req, res) => {
  try {
    const { id } = req.params;
    const document = readB2GRepositoryDocuments().find((item) => item.id === id);
    if (!document) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });
    }

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
    return fs.createReadStream(document.path).pipe(res);
  } catch (error) {
    console.error('Erro ao visualizar documento B2G:', error);
    return res.status(500).json({ error: 'Erro interno ao visualizar documento.' });
  }
});

router.get('/documentos/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const document = readB2GRepositoryDocuments().find((item) => item.id === id);
    if (!document) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ error: 'Arquivo não encontrado no servidor.' });
    }

    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    return fs.createReadStream(document.path).pipe(res);
  } catch (error) {
    console.error('Erro ao baixar documento B2G:', error);
    return res.status(500).json({ error: 'Erro interno ao baixar documento.' });
  }
});

router.delete('/documentos/:id', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const documents = readB2GRepositoryDocuments();
    const document = documents.find((item) => item.id === id);
    if (!document) {
      return res.status(404).json({ error: 'Documento não encontrado.' });
    }

    if (document.path && fs.existsSync(document.path)) {
      fs.unlinkSync(document.path);
    }

    writeB2GRepositoryDocuments(documents.filter((item) => item.id !== id));
    return res.json({ success: true, id });
  } catch (error) {
    console.error('Erro ao remover documento B2G:', error);
    return res.status(500).json({ error: 'Erro interno ao remover documento.' });
  }
});

router.get('/editais', async (req, res) => {
  try {
    const search = cleanText(req.query.search, 120) || '';
    const type = ALLOWED_TYPES.has(req.query.type) ? req.query.type : null;
    const status = ALLOWED_STATUSES.has(req.query.status) ? req.query.status : null;
    const organization = cleanText(req.query.organization, 220) || '';
    const stateCode = normalizeStateCode(req.query.stateCode || req.query.uf);
    const modality = cleanText(req.query.modality, 120) || '';

    const where = {};
    if (type) where.type = type;
    if (status) where.status = status;
    if (organization) {
      where.organization = { contains: organization, mode: 'insensitive' };
    }
    if (stateCode) {
      where.stateCode = stateCode;
    }
    if (modality) {
      where.modality = { contains: modality, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { organization: { contains: search, mode: 'insensitive' } },
        { stateCode: { contains: search, mode: 'insensitive' } },
        { modality: { contains: search, mode: 'insensitive' } },
        { referenceCode: { contains: search, mode: 'insensitive' } },
        { objectDescription: { contains: search, mode: 'insensitive' } }
      ];
    }

    const notices = await prisma.bidNotice.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }]
    });

    return res.json(notices);
  } catch (error) {
    console.error('Erro ao listar editais B2G:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get('/editais/:id/historico', async (req, res) => {
  try {
    const { id } = req.params;

    const history = await prisma.bidNoticeHistory.findMany({
      where: { noticeId: id },
      orderBy: [{ createdAt: 'desc' }]
    });

    return res.json(history);
  } catch (error) {
    console.error('Erro ao carregar histórico B2G:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/editais', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const payload = normalizeNoticePayload(req.body, { partial: false });

    if (!payload.title) {
      return res.status(400).json({ error: 'Título é obrigatório' });
    }
    if (!payload.organization) {
      return res.status(400).json({ error: 'Órgão é obrigatório' });
    }

    if (!payload.type) payload.type = 'EDITAL';
    if (!payload.status) payload.status = 'MONITORANDO';

    if (!payload.summary) {
      payload.summary = summarizeNotice(payload);
    }

    payload.createdByName = req.user?.name || null;

    const notice = await prisma.bidNotice.create({ data: payload });

    await createHistory({
      noticeId: notice.id,
      eventType: 'CREATED',
      title: 'Edital cadastrado',
      details: `${TYPE_LABELS[notice.type] || 'Documento'} registrado para acompanhamento.`,
      payload: { status: notice.status, type: notice.type },
      createdByName: req.user?.name || null
    });

    return res.status(201).json(notice);
  } catch (error) {
    console.error('Erro ao criar edital B2G:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/editais/:id', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await prisma.bidNotice.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Edital não encontrado' });
    }

    const data = normalizeNoticePayload(req.body, { partial: true });
    if (Object.keys(data).length === 0) {
      return res.json(existing);
    }

    if ((data.documentText || data.objectDescription || data.organization || data.type) && !data.summary) {
      data.summary = summarizeNotice({ ...existing, ...data });
    }

    const updated = await prisma.bidNotice.update({
      where: { id },
      data
    });

    await createHistory({
      noticeId: updated.id,
      eventType: 'UPDATED',
      title: 'Edital atualizado',
      details: req.body?.changeNote || `Campos atualizados: ${Object.keys(data).join(', ')}`,
      payload: { updatedFields: Object.keys(data) },
      createdByName: req.user?.name || null
    });

    return res.json(updated);
  } catch (error) {
    console.error('Erro ao atualizar edital B2G:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.delete('/editais/:id', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.bidNotice.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Análise não encontrada' });
    }

    await prisma.bidNotice.delete({ where: { id } });

    return res.json({
      success: true,
      id,
      message: 'Análise excluída com sucesso.'
    });
  } catch (error) {
    console.error('Erro ao excluir análise B2G:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/editais/:id/analisar', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const instruction = cleanText(req.body?.instruction, 2000) || '';

    const notice = await prisma.bidNotice.findUnique({ where: { id } });
    if (!notice) {
      return res.status(404).json({ error: 'Edital não encontrado' });
    }

    const analysis = await generateAnalysis(notice, instruction);
    const nextSummary = cleanText(analysis?.resumoExecutivo, 5000) || notice.summary || summarizeNotice(notice);

    const updated = await prisma.bidNotice.update({
      where: { id },
      data: {
        summary: nextSummary,
        aiAnalysis: analysis,
        status:
          notice.status === 'MONITORANDO' || notice.status === 'ANALISE_EM_ANDAMENTO'
            ? 'ANALISE_CONCLUIDA'
            : notice.status
      }
    });

    await createHistory({
      noticeId: updated.id,
      eventType: 'AI_ANALYSIS',
      title: 'Análise de Edital/TR com IA executada',
      details: `Recomendação: ${analysis.recomendacao || 'GO_COM_RESSALVAS'} | Score: ${analysis.scoreAderencia ?? '-'}`,
      payload: analysis,
      createdByName: req.user?.name || null
    });

    return res.json({ notice: updated, analysis });
  } catch (error) {
    console.error('Erro ao analisar edital B2G com IA:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post('/analisar-arquivo', requireRole(USER_ALLOWED_ROLES), (req, res) => {
  upload.single('file')(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        if (uploadError.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Arquivo excede o limite de 20MB' });
        }
        return res.status(400).json({ error: uploadError.message || 'Erro ao processar upload do arquivo' });
      }

      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Arquivo PDF é obrigatório' });
      }

      const mime = String(file.mimetype || '').toLowerCase();
      const name = String(file.originalname || '').toLowerCase();
      const isPdf = mime.includes('pdf') || name.endsWith('.pdf');
      if (!isPdf) {
        return res.status(400).json({ error: 'Formato inválido. Envie um arquivo PDF.' });
      }

      const mode = String(req.body?.mode || 'EDITAL').toUpperCase() === 'TR' ? 'TR' : 'EDITAL';
      const instruction = cleanText(req.body?.instruction, 2000) || '';
      const aiExtractedDataRaw = req.body?.aiExtractedData;
      const aiExtractedData =
        typeof aiExtractedDataRaw === 'string'
          ? tryParseJsonObject(aiExtractedDataRaw)
          : aiExtractedDataRaw && typeof aiExtractedDataRaw === 'object' && !Array.isArray(aiExtractedDataRaw)
            ? aiExtractedDataRaw
            : null;

      let extractedText = '';
      let numPages = 0;
      try {
        const extracted = await normalizeUploadedPdfText(file.buffer);
        extractedText = extracted.text;
        numPages = extracted.numPages;
      } catch (error) {
        console.warn('Falha ao extrair texto do PDF em /b2g/analisar-arquivo:', error?.message || error);
      }

      const aiExtractedDataText = cleanText(
        aiExtractedData && typeof aiExtractedData === 'object'
          ? JSON.stringify(aiExtractedData)
          : '',
        30000
      );
      const fallbackDocumentText =
        extractedText ||
        aiExtractedDataText ||
        cleanText(
          [
            `Arquivo enviado: ${file.originalname}`,
            `Modo de análise: ${mode}`,
            instruction ? `Instrução do usuário: ${instruction}` : '',
            'Observação: PDF sem texto extraível automaticamente (possível documento escaneado).'
          ]
            .filter(Boolean)
            .join('\n'),
          30000
        ) ||
        '';
      const usedSyntheticDocumentText = !extractedText && !aiExtractedDataText;

      const inferredByText = inferNoticeFromDocumentText(fallbackDocumentText, file.originalname, mode);
      const inferredByTemplate = buildNoticeOverridesFromTemplateAnalysis(aiExtractedData, mode, file.originalname);
      const inferred = mergeNoticeOverrides(inferredByText, inferredByTemplate);
      const payload = normalizeNoticePayload(
        {
          ...inferred,
          documentText: fallbackDocumentText,
          sourceUrl: null,
          status: 'MONITORANDO'
        },
        { partial: false }
      );

      if (!payload.title) payload.title = cleanFileTitle(file.originalname);
      if (!payload.organization) payload.organization = 'Órgão não identificado';
      if (!payload.type) payload.type = mode === 'TR' ? 'TERMO_REFERENCIA' : 'EDITAL';
      if (!payload.status) payload.status = 'MONITORANDO';
      if (!payload.summary) payload.summary = summarizeNotice(payload);
      payload.createdByName = req.user?.name || null;

      const createdNotice = await prisma.bidNotice.create({ data: payload });

      await createHistory({
        noticeId: createdNotice.id,
        eventType: 'CREATED_FROM_UPLOAD',
        title: 'Documento enviado para análise',
        details: `Arquivo ${file.originalname} (${numPages || 0} página(s)) recebido para análise de ${mode}.`,
        payload: {
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          numPages,
          mode,
          extractedTextAvailable: Boolean(extractedText)
        },
        createdByName: req.user?.name || null
      });

      const analysisFromTemplate = buildInternalAnalysisFromTemplateData(aiExtractedData, createdNotice);
      const analysis = analysisFromTemplate || (await generateAnalysis(createdNotice, instruction));
      const nextSummary =
        cleanText(analysis?.resumoExecutivo, 5000) ||
        createdNotice.summary ||
        summarizeNotice(createdNotice);

      const updated = await prisma.bidNotice.update({
        where: { id: createdNotice.id },
        data: {
          summary: nextSummary,
          aiAnalysis: analysis,
          status: 'ANALISE_CONCLUIDA'
        }
      });

      await createHistory({
        noticeId: updated.id,
        eventType: 'AI_ANALYSIS',
        title: 'Análise de Edital/TR com IA executada',
        details: `Recomendação: ${analysis.recomendacao || 'GO_COM_RESSALVAS'} | Score: ${analysis.scoreAderencia ?? '-'}`,
        payload: {
          ...analysis,
          upload: {
            originalName: file.originalname,
            numPages,
            extractedTextAvailable: Boolean(extractedText)
          }
        },
        createdByName: req.user?.name || null
      });

      return res.json({
        success: true,
        notice: updated,
        analysis,
        upload: {
          originalName: file.originalname,
          numPages,
          extractedChars: fallbackDocumentText.length,
          extractedTextAvailable: Boolean(extractedText),
          usedSyntheticDocumentText
        },
        warnings:
          usedSyntheticDocumentText
            ? ['PDF sem texto extraível automaticamente. A análise foi concluída com fallback local.']
            : []
      });
    } catch (error) {
      console.error('Erro ao analisar arquivo B2G:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  });
});

router.post('/editais/:id/converter-oportunidade', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const notice = await prisma.bidNotice.findUnique({ where: { id } });
    if (!notice) {
      return res.status(404).json({ error: 'Edital não encontrado' });
    }

    const ownerId = req.user?.userId;
    const tenantCompanyId = getTenantCompanyId(req.user);
    if (!ownerId) {
      return res.status(400).json({ error: 'Usuário inválido para conversão de oportunidade' });
    }

    const organizationName = cleanText(notice.organization, 220) || `Órgão B2G ${notice.id.slice(0, 8)}`;
    const matchingCompanies = await prisma.company.findMany({
      where: {
        name: { equals: organizationName, mode: 'insensitive' },
        ...(tenantCompanyId ? { tenantCompanyId } : {})
      },
      take: 10
    });
    let company = matchingCompanies.find(isB2GCompanyRecord) || null;

    let createdCompany = false;
    if (!company) {
      const companyData = {
        name: organizationName,
        segment: 'B2G GOVERNO',
        status: 'PROSPECT',
        state: notice.stateCode || null,
        tenantCompanyId
      };
      if (prismaModelHasField('Company', 'clientType')) {
        companyData.clientType = 'B2G';
      }

      company = await prisma.company.create({
        data: companyData
      });
      createdCompany = true;
    }

    const recommendation = String(notice?.aiAnalysis?.recomendacao || '').toUpperCase();
    const suggestedScore = Number(notice?.aiAnalysis?.scoreAderencia || 55);
    const probability = Math.max(15, Math.min(95, Math.round(suggestedScore)));
    const b2gStage = recommendation === 'NO_GO' ? 'NO_GO' : 'ANALISE';
    const stage = recommendation === 'NO_GO' ? 'LOST' : 'DIAGNOSIS';
    const title = cleanText(
      [notice.referenceCode, notice.title].filter(Boolean).join(' - '),
      220
    ) || `Oportunidade B2G ${notice.id.slice(0, 8)}`;

    const descriptionParts = [
      `Oportunidade criada automaticamente a partir do ${TYPE_LABELS[notice.type] || 'documento'} B2G.`,
      `ID do edital: ${notice.id}.`,
      `Órgão: ${organizationName}.`,
      notice.summary ? `Resumo: ${notice.summary}` : null
    ].filter(Boolean);

    const opportunityData = {
      number: await generateOpportunityNumber('B2G'),
      title,
      description: descriptionParts.join(' '),
      value: Number.isFinite(Number(notice.estimatedValue)) ? Number(notice.estimatedValue) : 0,
      probability,
      stage,
      source: 'MANUAL',
      expectedCloseDate: notice.proposalDueDate || null,
      companyId: company.id,
      ownerId,
      tenantCompanyId
    };
    if (prismaModelHasField('Opportunity', 'projectName')) {
      opportunityData.projectName = title;
    }
    if (prismaModelHasField('Opportunity', 'projectClientType')) {
      opportunityData.projectClientType = 'B2G';
    }
    if (prismaModelHasField('Opportunity', 'b2gStage')) {
      opportunityData.b2gStage = b2gStage;
    }

    const opportunity = await prisma.opportunity.create({
      data: opportunityData,
      include: {
        company: {
          include: {
            contacts: {
              where: { isPrimary: true },
              take: 1
            }
          }
        },
        owner: {
          select: { id: true, name: true, email: true }
        },
        products: {
          include: {
            product: true
          }
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            assignedTo: {
              select: { name: true }
            }
          }
        },
        commission: true
      }
    });

    await createHistory({
      noticeId: notice.id,
      eventType: 'CONVERTED_OPPORTUNITY',
      title: 'Resumo convertido em oportunidade',
      details: `Oportunidade ${opportunity.title} criada automaticamente no pipeline B2G.`,
      payload: { opportunityId: opportunity.id, companyId: company.id, createdCompany },
      createdByName: req.user?.name || null
    });

    return res.json({
      success: true,
      opportunity,
      companyCreated: createdCompany
    });
  } catch (error) {
    console.error('Erro ao converter resumo B2G em oportunidade:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ============================================================
// ALERTAS DE ABERTURA DE EDITAL (5 DIAS ANTES)
// ============================================================

const parseOpportunityB2GData = (description) => {
  if (!description) return {};
  if (typeof description === 'object') return description;
  const raw = String(description || '').trim();
  if (!raw.startsWith('{')) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const parseAlertDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

router.get('/oportunidades/alertas/abertura', requireRole(USER_ALLOWED_ROLES), async (req, res) => {
  try {
    const tenantCompanyId = getTenantCompanyId(req.user);
    const opportunities = await prisma.opportunity.findMany({
      where: {
        ...(tenantCompanyId ? { tenantCompanyId } : {}),
        OR: [
          { stage: 'PROPOSAL' },
          { b2gStage: 'PROPOSTA_ENVIADA' }
        ]
      },
      include: {
        company: true,
        owner: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const alerts = opportunities
      .map((opp) => {
        const b2gData = parseOpportunityB2GData(opp.description);
        const openingDate = parseAlertDate(
          b2gData.openingDate ||
          b2gData.dataAbertura ||
          b2gData.dataSessao ||
          opp.expectedCloseDate
        );

        if (!openingDate) return null;

        const openingDay = new Date(openingDate.getFullYear(), openingDate.getMonth(), openingDate.getDate());
        const daysUntilOpening = Math.ceil((openingDay - today) / (1000 * 60 * 60 * 24));

        if (daysUntilOpening > 5 || daysUntilOpening < 0) return null;

        return {
          opportunityId: opp.id,
          title: opp.title,
          projectName: prismaModelHasField('Opportunity', 'projectName') ? opp.projectName : null,
          company: opp.company,
          owner: opp.owner,
          value: opp.value,
          probability: opp.probability,
          openingDate,
          daysUntilOpening,
          stage: opp.stage,
          b2gStage: opp.b2gStage,
          description: b2gData,
          alertType: daysUntilOpening === 0 ? 'TODAY' : daysUntilOpening === 1 ? 'TOMORROW' : 'UPCOMING'
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.daysUntilOpening - b.daysUntilOpening);

    return res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (error) {
    console.error('Erro ao buscar alertas de abertura:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
