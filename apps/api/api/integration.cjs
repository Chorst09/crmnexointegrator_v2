const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken, requireRole } = require('../lib/auth.cjs');

const router = express.Router();


const OAUTH_DEFAULT_TTL_SECONDS = Number(process.env.INTEGRATION_OAUTH_TOKEN_TTL_SECONDS || 3600);
const IDEMPOTENCY_TTL_HOURS = Number(process.env.INTEGRATION_IDEMPOTENCY_TTL_HOURS || 24);
const INTEGRATION_PEPPER = String(process.env.INTEGRATION_SECRET_PEPPER || process.env.JWT_SECRET || 'integration-pepper');
const DEFAULT_WEBHOOK_TIMEOUT_MS = Number(process.env.INTEGRATION_WEBHOOK_TIMEOUT_MS || 10000);
const MAX_WEBHOOK_DELIVERIES_BATCH = Number(process.env.INTEGRATION_WEBHOOK_PROCESS_LIMIT || 200);

const PARTNER_TIER_RATE_LIMIT = {
  BRONZE: 60,
  SILVER: 180,
  GOLD: 600,
  PLATINUM: 1200
};

const ALLOWED_INTEGRATION_TYPES = new Set(['ERP', 'API_EXTERNAL', 'WEBHOOK']);
const ALLOWED_PROVIDERS = new Set(['TOTVS', 'SAP', 'SENIOR', 'GENERIC_ERP', 'CUSTOM']);
const SUPPORTED_CONNECTOR_PROVIDERS = new Set([
  'ZOHO',
  'TOTVS',
  'BITRIX24',
  'GENERIC',
  'CUSTOM',
  'HUBSPOT',
  'PIPEDRIVE',
  'SALESFORCE'
]);
const ALLOWED_TIERS = new Set(['BRONZE', 'SILVER', 'GOLD', 'PLATINUM']);
const ALLOWED_MODULES = new Set(['B2B', 'B2G', 'PRE_SALES']);
const ALLOWED_ENTITY_TYPES = new Set([
  'CUSTOMER',
  'PRICE_TABLE',
  'PRODUCT',
  'ORDER',
  'LEAD',
  'OPPORTUNITY',
  'BID_NOTICE',
  'BID_DOCUMENT',
  'CONTRACT'
]);
const ALLOWED_CUSTOM_FIELD_TYPES = new Set(['STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON', 'OBJECT', 'ARRAY']);

const ALLOWED_COMPANY_STATUSES = new Set(['LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED']);
const ALLOWED_OPPORTUNITY_STAGES = new Set(['LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']);
const ALLOWED_BID_TYPES = new Set(['EDITAL', 'TERMO_REFERENCIA', 'ATA_REGISTRO_PRECOS', 'DOCUMENTACAO']);
const ALLOWED_BID_STATUSES = new Set([
  'MONITORANDO',
  'ANALISE_EM_ANDAMENTO',
  'ANALISE_CONCLUIDA',
  'PROPOSTA_EM_PREPARACAO',
  'ENVIADA',
  'SUSPENSA',
  'ENCERRADA'
]);

const WEBHOOK_EVENT_TYPES = new Set([
  'lead_qualified',
  'opportunity_created',
  'bid_status_changed',
  'bid_expired',
  'customer_synced',
  'order_synced',
  'price_table_synced',
  '*'
]);

const jsonParseSafe = (raw) => {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const toIsoDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const now = () => new Date();

const normalizeString = (value, maxLen = 4000) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLen);
};

const normalizeUrl = (value) => {
  const normalized = normalizeString(value, 1000);
  if (!normalized) return null;
  if (!/^https?:\/\//i.test(normalized)) return null;
  return normalized;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return fallback;
};

const normalizeCnpj = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length !== 14) return null;
  return digits;
};

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

let leadAutomationModulesPromise = null;

const getLeadAutomationModules = async () => {
  if (!leadAutomationModulesPromise) {
    leadAutomationModulesPromise = Promise.all([
      import('../lib/leadScoring.js'),
      import('../lib/leadDistribution.js')
    ]).then(([leadScoring, leadDistribution]) => ({
      updateCompanyLeadScore: leadScoring.updateCompanyLeadScore,
      createOpportunityForLead: leadDistribution.createOpportunityForLead,
      DISTRIBUTION_STRATEGIES: leadDistribution.DISTRIBUTION_STRATEGIES
    }));
  }

  return leadAutomationModulesPromise;
};

const normalizeConnectorProvider = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return 'GENERIC';
  return SUPPORTED_CONNECTOR_PROVIDERS.has(normalized) ? normalized : 'GENERIC';
};

const pickFirstValue = (...values) => {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return null;
};

const pickFirstString = (...values) => {
  const value = pickFirstValue(...values);
  if (value === null || value === undefined) return null;
  return normalizeString(String(value), 4000);
};

const normalizeEmail = (value) => {
  const normalized = normalizeString(value, 220);
  if (!normalized) return null;
  return normalized.toLowerCase();
};

const normalizePhone = (value) => {
  const normalized = normalizeString(value, 80);
  return normalized || null;
};

const normalizeState = (value) => {
  const normalized = normalizeString(value, 2);
  if (!normalized) return null;
  return normalized.toUpperCase();
};

const normalizeLeadScore = (value) => {
  const parsed = normalizeNumber(value);
  if (parsed === null) return null;
  return Math.max(0, Math.min(100, Math.round(parsed)));
};

const normalizeCompanySize = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return null;

  if (['MEI', 'MICRO', 'MICROEMPRESA'].includes(normalized)) return 'MICRO';
  if (['SMALL', 'PEQUENA', 'PEQUENO', 'PP'].includes(normalized)) return 'SMALL';
  if (['MEDIUM', 'MEDIA', 'MÉDIA'].includes(normalized)) return 'MEDIUM';
  if (['LARGE', 'GRANDE'].includes(normalized)) return 'LARGE';
  if (['ENTERPRISE', 'CORPORATE', 'CORPORATIVA'].includes(normalized)) return 'ENTERPRISE';
  return null;
};

const normalizeQualificationStatus = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return 'NEW';

  if (['QUALIFIED', 'QUALIFICADO', 'QUENTE', 'HOT'].includes(normalized)) return 'QUALIFIED';
  if (['DISQUALIFIED', 'DESCARTADO', 'REPROVADO'].includes(normalized)) return 'DISQUALIFIED';
  if (['CONTACTED', 'CONTATADO'].includes(normalized)) return 'CONTACTED';
  if (['NEW', 'NOVO'].includes(normalized)) return 'NEW';
  return normalized;
};

const isQualifiedLead = (leadScore, qualificationStatus) => {
  return qualificationStatus === 'QUALIFIED' || (typeof leadScore === 'number' && leadScore >= 70);
};

const extractBitrixMultiFieldValue = (value) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const first = value[0];
  if (!first || typeof first !== 'object') return normalizeString(first, 220);
  return pickFirstString(first.VALUE, first.value, first.EMAIL, first.PHONE, first.numero, first.email, first.phone);
};

const buildContactName = (firstName, lastName, fallback) => {
  const first = normalizeString(firstName, 120) || '';
  const last = normalizeString(lastName, 120) || '';
  const full = `${first} ${last}`.trim();
  return full || normalizeString(fallback, 180) || null;
};

const extractConnectorLeadPayload = (providerInput, payloadInput) => {
  const provider = normalizeConnectorProvider(providerInput);
  const payload = payloadInput && typeof payloadInput === 'object' ? payloadInput : {};
  const rootLead = payload.lead && typeof payload.lead === 'object' ? payload.lead : payload;

  if (provider === 'ZOHO') {
    const zohoLead =
      (Array.isArray(payload.data) && payload.data.length > 0 && typeof payload.data[0] === 'object' && payload.data[0]) ||
      rootLead;
    const contactName = buildContactName(zohoLead.First_Name, zohoLead.Last_Name, zohoLead.Full_Name);

    return {
      provider,
      externalLeadId: pickFirstString(zohoLead.id, zohoLead.Lead_ID, zohoLead.externalLeadId),
      companyName: pickFirstString(
        zohoLead.Company,
        zohoLead.Company_Name,
        zohoLead.Account_Name?.name,
        zohoLead.companyName,
        zohoLead.razaoSocial
      ),
      cnpj: normalizeCnpj(pickFirstValue(zohoLead.CNPJ, zohoLead.cnpj, zohoLead.Cnpj)),
      segment: pickFirstString(zohoLead.Industry, zohoLead.segment),
      website: pickFirstString(zohoLead.Website, zohoLead.website),
      address: pickFirstString(zohoLead.Street, zohoLead.address),
      city: pickFirstString(zohoLead.City, zohoLead.city),
      state: normalizeState(pickFirstValue(zohoLead.State, zohoLead.state)),
      country: pickFirstString(zohoLead.Country, zohoLead.country, 'Brasil'),
      size: normalizeCompanySize(pickFirstValue(zohoLead.Company_Size, zohoLead.Employee_Count, zohoLead.size)),
      leadScore: normalizeLeadScore(pickFirstValue(zohoLead.Lead_Score, zohoLead.Score, zohoLead.leadScore)),
      qualificationStatus: normalizeQualificationStatus(pickFirstValue(zohoLead.Lead_Status, zohoLead.Status, zohoLead.qualificationStatus)),
      sourceChannel: pickFirstString(zohoLead.Lead_Source, zohoLead.Source, 'ZOHO'),
      autoDistribute: normalizeBoolean(pickFirstValue(payload.autoDistribute, zohoLead.autoDistribute), false),
      contact: {
        name: contactName,
        email: normalizeEmail(pickFirstValue(zohoLead.Email, zohoLead.email)),
        phone: normalizePhone(pickFirstValue(zohoLead.Phone, zohoLead.Mobile, zohoLead.phone)),
        position: pickFirstString(zohoLead.Designation, zohoLead.position)
      }
    };
  }

  if (provider === 'BITRIX24') {
    const bitrixLead =
      (payload.data && typeof payload.data === 'object' && payload.data.FIELDS && typeof payload.data.FIELDS === 'object' && payload.data.FIELDS) ||
      (payload.FIELDS && typeof payload.FIELDS === 'object' && payload.FIELDS) ||
      rootLead;

    const contactName = buildContactName(bitrixLead.NAME, bitrixLead.LAST_NAME, bitrixLead.TITLE);
    const phoneValue = extractBitrixMultiFieldValue(bitrixLead.PHONE) || normalizePhone(bitrixLead.PHONE);
    const emailValue = extractBitrixMultiFieldValue(bitrixLead.EMAIL) || normalizeEmail(bitrixLead.EMAIL);

    return {
      provider,
      externalLeadId: pickFirstString(bitrixLead.ID, payload.data?.FIELDS?.ID, payload.id, bitrixLead.externalLeadId),
      companyName: pickFirstString(bitrixLead.COMPANY_TITLE, bitrixLead.TITLE, bitrixLead.companyName, bitrixLead.razaoSocial),
      cnpj: normalizeCnpj(
        pickFirstValue(
          bitrixLead.CNPJ,
          bitrixLead.cnpj,
          bitrixLead.UF_CRM_CNPJ,
          bitrixLead.UF_CRM_1713446742,
          bitrixLead.UF_CRM_1713446742_CNPJ
        )
      ),
      segment: pickFirstString(bitrixLead.SOURCE_DESCRIPTION, bitrixLead.segment),
      website: pickFirstString(bitrixLead.WEB, bitrixLead.website),
      address: pickFirstString(bitrixLead.ADDRESS, bitrixLead.address),
      city: pickFirstString(bitrixLead.ADDRESS_CITY, bitrixLead.city),
      state: normalizeState(pickFirstValue(bitrixLead.ADDRESS_PROVINCE, bitrixLead.state)),
      country: pickFirstString(bitrixLead.ADDRESS_COUNTRY, bitrixLead.country, 'Brasil'),
      size: normalizeCompanySize(pickFirstValue(bitrixLead.COMPANY_SIZE, bitrixLead.size)),
      leadScore: normalizeLeadScore(
        pickFirstValue(bitrixLead.UF_CRM_LEAD_SCORE, bitrixLead.LEAD_SCORE, bitrixLead.OPPORTUNITY, bitrixLead.leadScore)
      ),
      qualificationStatus: normalizeQualificationStatus(pickFirstValue(bitrixLead.STATUS_ID, bitrixLead.STATUS, bitrixLead.qualificationStatus)),
      sourceChannel: pickFirstString(bitrixLead.SOURCE_ID, bitrixLead.SOURCE_DESCRIPTION, 'BITRIX24'),
      autoDistribute: normalizeBoolean(pickFirstValue(payload.autoDistribute, bitrixLead.autoDistribute), false),
      contact: {
        name: contactName,
        email: emailValue,
        phone: phoneValue,
        position: pickFirstString(bitrixLead.POST, bitrixLead.position)
      }
    };
  }

  if (provider === 'TOTVS') {
    const totvs = payload.totvs && typeof payload.totvs === 'object' ? payload.totvs : {};
    const contactPayload =
      (payload.contato && typeof payload.contato === 'object' && payload.contato) ||
      (totvs.contato && typeof totvs.contato === 'object' && totvs.contato) ||
      {};

    return {
      provider,
      externalLeadId: pickFirstString(payload.externalLeadId, payload.codigoLead, payload.codigoCliente, payload.id, totvs.codigoSA1),
      companyName: pickFirstString(
        payload.companyName,
        payload.razaoSocial,
        payload.nomeFantasia,
        payload.empresa,
        totvs.razaoSocial,
        totvs.nomeFantasia
      ),
      cnpj: normalizeCnpj(pickFirstValue(payload.cnpj, payload.documento, payload.cnpjCpf, totvs.cnpj, totvs.cnpjCpf)),
      segment: pickFirstString(payload.segment, payload.ramoAtividade, totvs.segmento),
      website: pickFirstString(payload.website, payload.site, totvs.website),
      address: pickFirstString(payload.address, payload.endereco, totvs.endereco),
      city: pickFirstString(payload.city, payload.cidade, totvs.cidade),
      state: normalizeState(pickFirstValue(payload.state, payload.uf, payload.estado, totvs.uf)),
      country: pickFirstString(payload.country, payload.pais, totvs.pais, 'Brasil'),
      size: normalizeCompanySize(pickFirstValue(payload.size, payload.porte, totvs.porteEmpresa)),
      leadScore: normalizeLeadScore(pickFirstValue(payload.leadScore, payload.pontuacao, payload.score, totvs.leadScore)),
      qualificationStatus: normalizeQualificationStatus(pickFirstValue(payload.qualificationStatus, payload.statusQualificacao, payload.status, totvs.statusLead)),
      sourceChannel: pickFirstString(payload.sourceChannel, payload.origem, 'TOTVS'),
      autoDistribute: normalizeBoolean(pickFirstValue(payload.autoDistribute, payload.distribuirAutomaticamente, totvs.autoDistribute), false),
      contact: {
        name: pickFirstString(contactPayload.nome, contactPayload.name, payload.contactName),
        email: normalizeEmail(pickFirstValue(contactPayload.email, payload.email, payload.contactEmail)),
        phone: normalizePhone(
          pickFirstValue(contactPayload.telefone, contactPayload.phone, contactPayload.celular, payload.telefone, payload.phone, payload.contactPhone)
        ),
        position: pickFirstString(contactPayload.cargo, contactPayload.position, payload.contactPosition)
      }
    };
  }

  return {
    provider,
    externalLeadId: pickFirstString(rootLead.externalLeadId, rootLead.id, rootLead.leadId, rootLead.codigoLead),
    companyName: pickFirstString(rootLead.companyName, rootLead.razaoSocial, rootLead.nomeFantasia, rootLead.name),
    cnpj: normalizeCnpj(pickFirstValue(rootLead.cnpj, rootLead.documento, rootLead.document, rootLead.cnpjCpf)),
    segment: pickFirstString(rootLead.segment, rootLead.Industry),
    website: pickFirstString(rootLead.website, rootLead.site, rootLead.Website),
    address: pickFirstString(rootLead.address, rootLead.endereco, rootLead.Street),
    city: pickFirstString(rootLead.city, rootLead.cidade, rootLead.City),
    state: normalizeState(pickFirstValue(rootLead.state, rootLead.uf, rootLead.estado, rootLead.State)),
    country: pickFirstString(rootLead.country, rootLead.pais, rootLead.Country, 'Brasil'),
    size: normalizeCompanySize(pickFirstValue(rootLead.size, rootLead.porte, rootLead.companySize)),
    leadScore: normalizeLeadScore(pickFirstValue(rootLead.leadScore, rootLead.score, rootLead.pontuacao, rootLead.Lead_Score)),
    qualificationStatus: normalizeQualificationStatus(pickFirstValue(rootLead.qualificationStatus, rootLead.status, rootLead.Lead_Status)),
    sourceChannel: pickFirstString(rootLead.sourceChannel, rootLead.source, rootLead.Lead_Source, provider),
    autoDistribute: normalizeBoolean(pickFirstValue(rootLead.autoDistribute, rootLead.distribuirAutomaticamente), false),
    contact: {
      name: pickFirstString(rootLead.contactName, rootLead.nomeContato, rootLead.contact?.name),
      email: normalizeEmail(pickFirstValue(rootLead.email, rootLead.contactEmail, rootLead.contact?.email)),
      phone: normalizePhone(pickFirstValue(rootLead.phone, rootLead.telefone, rootLead.contactPhone, rootLead.contact?.phone)),
      position: pickFirstString(rootLead.contactPosition, rootLead.cargoContato, rootLead.contact?.position)
    }
  };
};

const upsertPrimaryContact = async (companyId, contactInput) => {
  const contact = contactInput && typeof contactInput === 'object' ? contactInput : {};
  const name = normalizeString(contact.name, 180);
  const email = normalizeEmail(contact.email);
  const phone = normalizePhone(contact.phone);
  const position = normalizeString(contact.position, 120);

  if (!name && !email && !phone) return null;

  const payload = {
    name: name || 'Contato principal',
    email: email || null,
    phone: phone || null,
    position: position || null,
    isPrimary: true
  };

  const existing = await prisma.contact.findFirst({
    where: {
      companyId,
      isPrimary: true
    },
    orderBy: { createdAt: 'asc' }
  });

  if (existing) {
    return prisma.contact.update({
      where: { id: existing.id },
      data: payload
    });
  }

  return prisma.contact.create({
    data: {
      ...payload,
      companyId
    }
  });
};

const randomToken = (prefix, bytes = 32) => `${prefix}_${crypto.randomBytes(bytes).toString('hex')}`;

const hashWithPepper = (value) => {
  return crypto
    .createHash('sha256')
    .update(`${INTEGRATION_PEPPER}:${value}`)
    .digest('hex');
};

const secureEqual = (a, b) => {
  if (!a || !b) return false;
  const aBuf = Buffer.from(String(a));
  const bBuf = Buffer.from(String(b));
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const parseScopeList = (input) => {
  if (Array.isArray(input)) {
    return [...new Set(input.map((v) => String(v || '').trim()).filter(Boolean))];
  }

  if (typeof input === 'string') {
    return [...new Set(input.split(/[\s,]+/g).map((v) => v.trim()).filter(Boolean))];
  }

  return [];
};

const scopeSatisfied = (grantedScopes, requiredScope) => {
  if (!requiredScope) return true;
  if (grantedScopes.has('*') || grantedScopes.has('integration:*')) return true;
  if (grantedScopes.has(requiredScope)) return true;

  const [module] = String(requiredScope).split(':');
  if (module && grantedScopes.has(`${module}:*`)) return true;

  return false;
};

const hasRequiredScopes = (grantedScopes, requiredScopes) => {
  if (!requiredScopes || requiredScopes.length === 0) return true;
  return requiredScopes.every((scope) => scopeSatisfied(grantedScopes, scope));
};

const createCorrelationId = () => {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return randomToken('corr', 16);
};

const buildErrorPayload = (code, message, correlationId, details = {}) => ({
  error: {
    code,
    message,
    details,
    correlationId
  }
});

const sendError = (res, status, code, message, correlationId, details = {}) => {
  return res.status(status).json(buildErrorPayload(code, message, correlationId, details));
};

const getValueByPath = (obj, pathExpression) => {
  if (!obj || !pathExpression || typeof pathExpression !== 'string') return undefined;
  const pathParts = pathExpression.split('.').map((v) => v.trim()).filter(Boolean);
  let cursor = obj;

  for (const part of pathParts) {
    if (cursor === null || cursor === undefined || typeof cursor !== 'object') return undefined;
    cursor = cursor[part];
  }

  return cursor;
};

const setValueByPath = (obj, pathExpression, value) => {
  if (!obj || !pathExpression || typeof pathExpression !== 'string') return;
  const pathParts = pathExpression.split('.').map((v) => v.trim()).filter(Boolean);
  if (pathParts.length === 0) return;

  let cursor = obj;
  for (let i = 0; i < pathParts.length - 1; i += 1) {
    const part = pathParts[i];
    if (!cursor[part] || typeof cursor[part] !== 'object') {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }

  cursor[pathParts[pathParts.length - 1]] = value;
};

const applyTransformRule = (value, transformRule) => {
  if (value === undefined || value === null) return value;
  if (!transformRule) return value;

  const normalizedRule =
    typeof transformRule === 'string'
      ? { type: transformRule }
      : typeof transformRule === 'object'
      ? transformRule
      : null;

  if (!normalizedRule || !normalizedRule.type) return value;

  const type = String(normalizedRule.type).toLowerCase();

  switch (type) {
    case 'trim':
      return typeof value === 'string' ? value.trim() : value;
    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;
    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;
    case 'number': {
      const n = Number(value);
      return Number.isFinite(n) ? n : value;
    }
    case 'boolean':
      return normalizeBoolean(value);
    case 'date': {
      const d = parseDate(value);
      return d ? d.toISOString() : value;
    }
    case 'replace': {
      if (typeof value !== 'string') return value;
      const from = String(normalizedRule.from || '');
      const to = String(normalizedRule.to || '');
      if (!from) return value;
      return value.split(from).join(to);
    }
    default:
      return value;
  }
};

const coerceCustomFieldValue = (value, dataType) => {
  const type = String(dataType || 'STRING').toUpperCase();
  if (value === undefined) return undefined;

  switch (type) {
    case 'NUMBER': {
      const n = normalizeNumber(value);
      return n === null ? undefined : n;
    }
    case 'BOOLEAN':
      return normalizeBoolean(value, false);
    case 'DATE': {
      const d = parseDate(value);
      return d ? d.toISOString() : undefined;
    }
    case 'JSON':
    case 'OBJECT':
    case 'ARRAY': {
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        const parsed = jsonParseSafe(value);
        if (parsed !== null) return parsed;
      }
      return undefined;
    }
    case 'STRING':
    default:
      return String(value);
  }
};

const normalizeBidDocumentation = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const name = normalizeString(item.name, 180);
      if (!name) return null;
      return {
        id: normalizeString(item.id, 100) || `doc_${Date.now()}_${index}`,
        name,
        required: item.required !== false,
        status: normalizeString(item.status, 80) || 'PENDENTE',
        notes: normalizeString(item.notes, 1000) || ''
      };
    })
    .filter(Boolean)
    .slice(0, 300);
};

const hashRequestFingerprint = (method, scope, body) => {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ method: method.toUpperCase(), scope, body: body || {} }))
    .digest('hex');
};

const parseClientCredentials = (req) => {
  const header = String(req.headers.authorization || '');
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const splitIndex = decoded.indexOf(':');
    if (splitIndex >= 0) {
      return {
        clientId: decoded.slice(0, splitIndex),
        clientSecret: decoded.slice(splitIndex + 1)
      };
    }
  }

  return {
    clientId: normalizeString(req.body?.client_id, 200),
    clientSecret: normalizeString(req.body?.client_secret, 400)
  };
};

const serializeIntegration = (integration, includeSensitive = false) => {
  const base = {
    id: integration.id,
    name: integration.name,
    type: integration.type,
    provider: integration.provider,
    partnerTier: integration.partnerTier,
    scopes: integration.scopes || [],
    rateLimitPerMinute: integration.rateLimitPerMinute,
    isActive: integration.isActive,
    webhookUrl: integration.webhookUrl,
    clientId: integration.clientId,
    config: integration.config,
    metadata: integration.metadata,
    createdAt: toIsoDate(integration.createdAt),
    updatedAt: toIsoDate(integration.updatedAt)
  };

  if (includeSensitive) {
    base.webhookSigningSecret = integration.webhookSigningSecret;
  }

  return base;
};

const normalizeModule = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!ALLOWED_MODULES.has(normalized)) return null;
  return normalized;
};

const normalizeEntityType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!ALLOWED_ENTITY_TYPES.has(normalized)) return null;
  return normalized;
};

const normalizeTier = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!ALLOWED_TIERS.has(normalized)) return null;
  return normalized;
};

const normalizeProvider = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!ALLOWED_PROVIDERS.has(normalized)) return null;
  return normalized;
};

const normalizeIntegrationType = (value) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!ALLOWED_INTEGRATION_TYPES.has(normalized)) return null;
  return normalized;
};

const getRateLimitForIntegration = (integration) => {
  const explicit = Number(integration.rateLimitPerMinute);
  if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);

  const byTier = PARTNER_TIER_RATE_LIMIT[integration.partnerTier];
  return byTier || PARTNER_TIER_RATE_LIMIT.BRONZE;
};

const getDefaultScopes = () => [
  'b2b:read',
  'b2b:write',
  'b2g:read',
  'b2g:write',
  'pre_sales:read',
  'pre_sales:write',
  'webhooks:write',
  'mapping:read',
  'mapping:write'
];

const extractBearerToken = (req) => {
  const raw = String(req.headers.authorization || '');
  if (!raw.startsWith('Bearer ')) return null;
  return raw.slice('Bearer '.length).trim() || null;
};

const getWebhookSecret = (endpoint, integration) => {
  if (endpoint.secret) return endpoint.secret;
  if (integration.webhookSigningSecret) return integration.webhookSigningSecret;
  return null;
};

const computeWebhookSignature = (secret, payload) => {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

const webhookBackoffMs = (attempt) => {
  const base = 30 * 1000;
  const max = 15 * 60 * 1000;
  const exp = Math.min(max, base * Math.pow(2, Math.max(0, attempt - 1)));
  return exp;
};

const buildIdempotencyScope = (scopeName) => String(scopeName || 'default').trim().toLowerCase();

const findOwnerForOpportunity = async (preferredOwnerId) => {
  if (preferredOwnerId) {
    const user = await prisma.user.findUnique({
      where: { id: preferredOwnerId },
      select: { id: true }
    });
    if (user) return user.id;
  }

  const fallback = await prisma.user.findFirst({
    where: { role: { in: ['ADMIN', 'MANAGER', 'DIRECTOR', 'SELLER'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true }
  });

  return fallback?.id || null;
};

const withWebhookTimeout = async (url, options, timeoutMs) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const logIntegration = async ({ integrationId, action, status, message, data }) => {
  try {
    await prisma.integrationLog.create({
      data: {
        integrationId,
        action,
        status,
        message: message || null,
        data: data || null
      }
    });
  } catch (error) {
    console.error('Erro ao registrar log de integração:', error.message);
  }
};

const upsertEntityMapping = async ({ integrationId, module, entityType, externalId, internalId, metadata }) => {
  if (!externalId || !internalId) return null;

  return prisma.integrationEntityMapping.upsert({
    where: {
      integrationId_module_entityType_externalId: {
        integrationId,
        module,
        entityType,
        externalId
      }
    },
    create: {
      integrationId,
      module,
      entityType,
      externalId,
      internalId,
      metadata: metadata || null
    },
    update: {
      internalId,
      metadata: metadata || undefined
    }
  });
};

const findInternalIdByExternal = async ({ integrationId, module, entityType, externalId }) => {
  if (!externalId) return null;

  const mapping = await prisma.integrationEntityMapping.findUnique({
    where: {
      integrationId_module_entityType_externalId: {
        integrationId,
        module,
        entityType,
        externalId
      }
    },
    select: { internalId: true }
  });

  return mapping?.internalId || null;
};

const upsertEntityData = async ({ integrationId, module, entityType, entityId, data }) => {
  if (!entityId) return null;

  return prisma.integrationEntityData.upsert({
    where: {
      integrationId_module_entityType_entityId: {
        integrationId,
        module,
        entityType,
        entityId
      }
    },
    create: {
      integrationId,
      module,
      entityType,
      entityId,
      data: data || {}
    },
    update: {
      data: data || {}
    }
  });
};

const getEntityData = async ({ integrationId, module, entityType, entityId }) => {
  if (!entityId) return null;

  return prisma.integrationEntityData.findUnique({
    where: {
      integrationId_module_entityType_entityId: {
        integrationId,
        module,
        entityType,
        entityId
      }
    }
  });
};

const resolveMappedPayload = async ({ integrationId, module, entityType, payload }) => {
  const [mappings, customFieldDefinitions] = await Promise.all([
    prisma.integrationFieldMapping.findMany({
      where: {
        integrationId,
        module,
        entityType
      }
    }),
    prisma.integrationCustomField.findMany({
      where: {
        integrationId,
        module,
        entityType
      }
    })
  ]);

  const mappedPayload = {};

  for (const mapping of mappings) {
    let value = getValueByPath(payload, mapping.sourceField);

    if ((value === undefined || value === null || value === '') && mapping.defaultValue !== null && mapping.defaultValue !== undefined) {
      value = mapping.defaultValue;
    }

    if (value === undefined || value === null || value === '') {
      continue;
    }

    const transformed = applyTransformRule(value, mapping.transformRule);
    setValueByPath(mappedPayload, mapping.targetField, transformed);
  }

  const customFieldValues = {};
  const incomingCustomFields = payload && typeof payload.customFields === 'object' && payload.customFields !== null
    ? payload.customFields
    : {};

  for (const definition of customFieldDefinitions) {
    let rawValue = incomingCustomFields[definition.fieldKey];
    if ((rawValue === undefined || rawValue === null || rawValue === '') && definition.defaultValue !== null && definition.defaultValue !== undefined) {
      rawValue = definition.defaultValue;
    }

    const coerced = coerceCustomFieldValue(rawValue, definition.dataType);

    if (coerced !== undefined) {
      customFieldValues[definition.fieldKey] = coerced;
    }
  }

  return {
    mappedPayload,
    customFieldValues,
    mappingsCount: mappings.length,
    customDefinitionsCount: customFieldDefinitions.length
  };
};

const enqueueWebhookDeliveries = async ({ integrationId, eventType, payload, correlationId, idempotencyKey }) => {
  const normalizedEventType = String(eventType || '').trim();
  if (!normalizedEventType) return { queued: 0, delivered: 0, failed: 0 };

  const endpoints = await prisma.integrationWebhookEndpoint.findMany({
    where: {
      integrationId,
      isActive: true,
      OR: [{ eventType: normalizedEventType }, { eventType: '*' }]
    }
  });

  if (endpoints.length === 0) {
    return { queued: 0, delivered: 0, failed: 0 };
  }

  const deliveries = [];

  for (const endpoint of endpoints) {
    const delivery = await prisma.integrationWebhookDelivery.create({
      data: {
        endpointId: endpoint.id,
        integrationId,
        eventType: normalizedEventType,
        payload: payload || {},
        idempotencyKey: idempotencyKey || null,
        maxRetries: endpoint.maxRetries || 5,
        nextAttemptAt: now()
      }
    });

    deliveries.push(delivery);
  }

  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const result = await dispatchWebhookDelivery(delivery.id, correlationId);
    if (result.delivered) delivered += 1;
    else failed += 1;
  }

  return {
    queued: deliveries.length,
    delivered,
    failed
  };
};

const dispatchWebhookDelivery = async (deliveryId, correlationId) => {
  const delivery = await prisma.integrationWebhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      endpoint: true,
      integration: true
    }
  });

  if (!delivery) {
    return { delivered: false, reason: 'NOT_FOUND' };
  }

  if (!delivery.endpoint?.isActive || !delivery.integration?.isActive) {
    await prisma.integrationWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'FAILED',
        errorResponse: 'Endpoint ou integração inativa',
        nextAttemptAt: null
      }
    });

    return { delivered: false, reason: 'INACTIVE' };
  }

  const payloadString = JSON.stringify(delivery.payload || {});
  const webhookSecret = getWebhookSecret(delivery.endpoint, delivery.integration);

  const headers = {
    'Content-Type': 'application/json',
    'X-CRM-Event': delivery.eventType,
    'X-CRM-Delivery-Id': delivery.id,
    'X-Correlation-Id': correlationId
  };

  if (webhookSecret) {
    headers['X-CRM-Signature'] = computeWebhookSignature(webhookSecret, payloadString);
  }

  let response = null;
  let fetchError = null;

  try {
    response = await withWebhookTimeout(
      delivery.endpoint.url,
      {
        method: 'POST',
        headers,
        body: payloadString
      },
      Number(delivery.endpoint.timeoutMs || DEFAULT_WEBHOOK_TIMEOUT_MS)
    );
  } catch (error) {
    fetchError = error;
  }

  const nextAttemptNumber = (delivery.attempt || 0) + 1;
  const maxRetries = delivery.maxRetries || 5;

  if (response && response.ok) {
    await prisma.integrationWebhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'SENT',
        attempt: nextAttemptNumber,
        httpStatus: response.status,
        errorResponse: null,
        sentAt: now(),
        nextAttemptAt: null
      }
    });

    await prisma.integrationWebhookEndpoint.update({
      where: { id: delivery.endpointId },
      data: {
        lastTriggeredAt: now()
      }
    });

    await logIntegration({
      integrationId: delivery.integrationId,
      action: `webhook.${delivery.eventType}`,
      status: 'SUCCESS',
      message: `Webhook entregue para ${delivery.endpoint.url}`,
      data: {
        deliveryId: delivery.id,
        statusCode: response.status
      }
    });

    return { delivered: true, statusCode: response.status };
  }

  const errorMessage = fetchError
    ? fetchError.message
    : `Webhook retornou status ${response ? response.status : 'n/a'}`;

  const shouldRetry = nextAttemptNumber < maxRetries;
  const nextAttemptAt = shouldRetry ? new Date(Date.now() + webhookBackoffMs(nextAttemptNumber)) : null;

  await prisma.integrationWebhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: shouldRetry ? 'PENDING' : 'FAILED',
      attempt: nextAttemptNumber,
      httpStatus: response?.status || null,
      errorResponse: errorMessage.slice(0, 2000),
      nextAttemptAt
    }
  });

  await logIntegration({
    integrationId: delivery.integrationId,
    action: `webhook.${delivery.eventType}`,
    status: shouldRetry ? 'WARNING' : 'ERROR',
    message: errorMessage,
    data: {
      deliveryId: delivery.id,
      attempt: nextAttemptNumber,
      maxRetries,
      statusCode: response?.status || null,
      nextAttemptAt: toIsoDate(nextAttemptAt)
    }
  });

  return {
    delivered: false,
    retryScheduled: shouldRetry,
    statusCode: response?.status || null,
    error: errorMessage
  };
};

const processPendingDeliveries = async (limit, correlationId) => {
  const batchLimit = Math.min(Math.max(Number(limit || 50), 1), MAX_WEBHOOK_DELIVERIES_BATCH);
  const current = now();

  const deliveries = await prisma.integrationWebhookDelivery.findMany({
    where: {
      status: 'PENDING',
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: current } }]
    },
    orderBy: [{ createdAt: 'asc' }],
    take: batchLimit,
    select: { id: true }
  });

  let delivered = 0;
  let failed = 0;

  for (const delivery of deliveries) {
    const result = await dispatchWebhookDelivery(delivery.id, correlationId);
    if (result.delivered) delivered += 1;
    else failed += 1;
  }

  return {
    processed: deliveries.length,
    delivered,
    failed
  };
};

const withIdempotency = (scopeName, handler) => {
  return async (req, res, next) => {
    try {
      const method = String(req.method || 'GET').toUpperCase();
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return handler(req, res, next);
      }

      const integrationId = req.integration?.id;
      if (!integrationId) {
        return sendError(res, 401, 'INTEGRATION_AUTH_REQUIRED', 'Token da integração não informado.', req.correlationId);
      }

      const idempotencyKey = normalizeString(req.headers['idempotency-key'], 180);
      if (!idempotencyKey) {
        return sendError(
          res,
          400,
          'IDEMPOTENCY_KEY_REQUIRED',
          'Cabeçalho Idempotency-Key é obrigatório para operações de escrita.',
          req.correlationId,
          { header: 'Idempotency-Key' }
        );
      }

      const scope = buildIdempotencyScope(scopeName);
      const requestHash = hashRequestFingerprint(method, scope, req.body || {});

      const existing = await prisma.integrationIdempotencyKey.findUnique({
        where: {
          integrationId_scope_key: {
            integrationId,
            scope,
            key: idempotencyKey
          }
        }
      });

      if (existing) {
        if (!secureEqual(existing.requestHash, requestHash)) {
          return sendError(
            res,
            409,
            'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD',
            'A chave de idempotência já foi usada com outro payload.',
            req.correlationId,
            { key: idempotencyKey }
          );
        }

        res.setHeader('Idempotency-Key', idempotencyKey);
        res.setHeader('Idempotent-Replayed', 'true');

        if (existing.responseBody === null || existing.responseBody === undefined) {
          return res.status(existing.statusCode || 204).send();
        }

        return res.status(existing.statusCode || 200).json(existing.responseBody);
      }

      let capturedBody;
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      res.json = (body) => {
        capturedBody = body;
        return originalJson(body);
      };

      res.send = (body) => {
        if (capturedBody === undefined) {
          if (typeof body === 'string') {
            capturedBody = jsonParseSafe(body) || { raw: body };
          } else {
            capturedBody = body;
          }
        }
        return originalSend(body);
      };

      res.setHeader('Idempotency-Key', idempotencyKey);

      res.on('finish', () => {
        if (res.statusCode >= 500) return;

        const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);

        prisma.integrationIdempotencyKey
          .create({
            data: {
              integrationId,
              scope,
              key: idempotencyKey,
              requestHash,
              statusCode: res.statusCode,
              responseBody: capturedBody === undefined ? null : capturedBody,
              expiresAt
            }
          })
          .catch((error) => {
            console.error('Erro ao persistir idempotência:', error.message);
          });
      });

      return handler(req, res, next);
    } catch (error) {
      return next(error);
    }
  };
};

const requireIntegrationScopes = (...requiredScopes) => {
  return (req, res, next) => {
    const scopes = req.integrationScopes || new Set();
    if (!hasRequiredScopes(scopes, requiredScopes)) {
      return sendError(
        res,
        403,
        'INSUFFICIENT_SCOPE',
        'Escopo insuficiente para acessar este recurso.',
        req.correlationId,
        { requiredScopes }
      );
    }

    return next();
  };
};

const integrationTokenAuth = async (req, res, next) => {
  try {
    const rawToken = extractBearerToken(req);
    if (!rawToken) {
      return sendError(res, 401, 'INVALID_TOKEN', 'Bearer token não informado.', req.correlationId);
    }

    const tokenHash = hashWithPepper(rawToken);

    const tokenRecord = await prisma.integrationAccessToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: now() }
      },
      include: {
        integration: true
      }
    });

    if (!tokenRecord || !tokenRecord.integration?.isActive) {
      return sendError(res, 401, 'INVALID_TOKEN', 'Token inválido ou expirado.', req.correlationId);
    }

    const grantedScopes = new Set(
      (tokenRecord.scopes && tokenRecord.scopes.length > 0 ? tokenRecord.scopes : tokenRecord.integration.scopes) || []
    );

    req.integration = tokenRecord.integration;
    req.integrationToken = tokenRecord;
    req.integrationScopes = grantedScopes;

    prisma.integrationAccessToken
      .update({
        where: { id: tokenRecord.id },
        data: { lastUsedAt: now() }
      })
      .catch((error) => {
        console.error('Erro ao atualizar uso do token de integração:', error.message);
      });

    return next();
  } catch (error) {
    return next(error);
  }
};

const integrationRateLimit = async (req, res, next) => {
  try {
    const integration = req.integration;
    if (!integration) {
      return sendError(res, 401, 'INTEGRATION_AUTH_REQUIRED', 'Integração não autenticada.', req.correlationId);
    }

    const limitPerMinute = getRateLimitForIntegration(integration);
    const windowStart = new Date();
    windowStart.setSeconds(0, 0);

    const counter = await prisma.integrationRateLimitWindow.upsert({
      where: {
        integrationId_windowStart: {
          integrationId: integration.id,
          windowStart
        }
      },
      create: {
        integrationId: integration.id,
        windowStart,
        requestCount: 1
      },
      update: {
        requestCount: { increment: 1 }
      }
    });

    const used = counter.requestCount || 1;
    const remaining = Math.max(limitPerMinute - used, 0);
    const resetEpochMs = windowStart.getTime() + 60 * 1000;

    res.setHeader('X-RateLimit-Limit', String(limitPerMinute));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(resetEpochMs / 1000)));

    if (used > limitPerMinute) {
      const retryAfterSeconds = Math.max(Math.ceil((resetEpochMs - Date.now()) / 1000), 1);
      res.setHeader('Retry-After', String(retryAfterSeconds));

      return sendError(
        res,
        429,
        'RATE_LIMIT_EXCEEDED',
        'Limite de requisições por minuto excedido para este parceiro.',
        req.correlationId,
        {
          limit: limitPerMinute,
          used,
          retryAfterSeconds
        }
      );
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

router.use((req, res, next) => {
  const incoming = normalizeString(req.headers['x-correlation-id'], 120);
  req.correlationId = incoming || createCorrelationId();
  res.setHeader('X-Correlation-Id', req.correlationId);
  next();
});

router.get('/openapi', (req, res) => {
  const openApiPath = path.resolve(__dirname, '../docs/integration-openapi.yaml');
  if (!fs.existsSync(openApiPath)) {
    return sendError(res, 404, 'OPENAPI_NOT_FOUND', 'Arquivo OpenAPI não encontrado.', req.correlationId);
  }
  return res.sendFile(openApiPath);
});

router.post('/oauth/token', async (req, res) => {
  try {
    const grantType = normalizeString(req.body?.grant_type, 80);
    if (grantType !== 'client_credentials') {
      return sendError(
        res,
        400,
        'UNSUPPORTED_GRANT_TYPE',
        'Somente grant_type=client_credentials é suportado.',
        req.correlationId,
        { grantType }
      );
    }

    const { clientId, clientSecret } = parseClientCredentials(req);

    if (!clientId || !clientSecret) {
      return sendError(
        res,
        400,
        'INVALID_CLIENT',
        'client_id e client_secret são obrigatórios.',
        req.correlationId
      );
    }

    const integration = await prisma.integration.findFirst({
      where: {
        clientId,
        isActive: true
      }
    });

    if (!integration?.clientSecretHash) {
      return sendError(res, 401, 'INVALID_CLIENT', 'Credenciais da integração inválidas.', req.correlationId);
    }

    const providedSecretHash = hashWithPepper(clientSecret);
    if (!secureEqual(providedSecretHash, integration.clientSecretHash)) {
      return sendError(res, 401, 'INVALID_CLIENT', 'Credenciais da integração inválidas.', req.correlationId);
    }

    const requestedScopes = parseScopeList(req.body?.scope);
    const allowedScopes = integration.scopes && integration.scopes.length > 0 ? integration.scopes : getDefaultScopes();

    const invalidScopes = requestedScopes.filter((scope) => !allowedScopes.includes(scope));
    if (invalidScopes.length > 0) {
      return sendError(
        res,
        400,
        'INVALID_SCOPE',
        'Um ou mais escopos solicitados não são permitidos para este parceiro.',
        req.correlationId,
        { invalidScopes }
      );
    }

    const grantedScopes = requestedScopes.length > 0 ? requestedScopes : allowedScopes;
    const tokenTtlSeconds = Math.max(60, Number(integration.config?.oauth?.tokenTtlSeconds || OAUTH_DEFAULT_TTL_SECONDS));

    const rawAccessToken = randomToken('itg', 32);
    const tokenHash = hashWithPepper(rawAccessToken);
    const expiresAt = new Date(Date.now() + tokenTtlSeconds * 1000);

    await prisma.integrationAccessToken.create({
      data: {
        integrationId: integration.id,
        tokenHash,
        scopes: grantedScopes,
        expiresAt
      }
    });

    await logIntegration({
      integrationId: integration.id,
      action: 'oauth.token.issued',
      status: 'SUCCESS',
      message: 'Token OAuth2 emitido com sucesso',
      data: {
        scopes: grantedScopes,
        expiresAt: toIsoDate(expiresAt)
      }
    });

    prisma.integrationAccessToken
      .deleteMany({
        where: {
          OR: [{ expiresAt: { lt: now() } }, { revokedAt: { not: null } }]
        }
      })
      .catch(() => {});

    return res.json({
      access_token: rawAccessToken,
      token_type: 'Bearer',
      expires_in: tokenTtlSeconds,
      scope: grantedScopes.join(' ')
    });
  } catch (error) {
    console.error('Erro ao gerar token OAuth2:', error);
    return sendError(res, 500, 'TOKEN_ISSUE_FAILED', 'Falha ao emitir token OAuth2.', req.correlationId);
  }
});

const adminRouter = express.Router();
adminRouter.use(authenticateToken, requireRole(['ADMIN']));

adminRouter.get('/partners', async (req, res) => {
  try {
    const partners = await prisma.integration.findMany({
      where: {
        type: { in: ['ERP', 'API_EXTERNAL', 'WEBHOOK'] }
      },
      include: {
        _count: {
          select: {
            oauthTokens: true,
            webhookEndpoints: true,
            fieldMappings: true,
            customFields: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    return res.json({
      data: partners.map((partner) => ({
        ...serializeIntegration(partner),
        stats: {
          tokens: partner._count.oauthTokens,
          webhooks: partner._count.webhookEndpoints,
          fieldMappings: partner._count.fieldMappings,
          customFields: partner._count.customFields
        }
      }))
    });
  } catch (error) {
    console.error('Erro ao listar parceiros de integração:', error);
    return sendError(res, 500, 'PARTNERS_LIST_FAILED', 'Não foi possível listar parceiros de integração.', req.correlationId);
  }
});

adminRouter.post('/partners', async (req, res) => {
  try {
    const name = normalizeString(req.body?.name, 200);
    if (!name) {
      return sendError(res, 400, 'PARTNER_NAME_REQUIRED', 'Nome do parceiro é obrigatório.', req.correlationId);
    }

    const type = normalizeIntegrationType(req.body?.type) || 'API_EXTERNAL';
    const provider = normalizeProvider(req.body?.provider) || 'CUSTOM';
    const partnerTier = normalizeTier(req.body?.partnerTier) || 'BRONZE';
    const scopes = parseScopeList(req.body?.scopes);

    const clientId = normalizeString(req.body?.clientId, 120) || randomToken('client', 12);
    const clientSecret = randomToken('secret', 24);
    const webhookSigningSecret = randomToken('whsec', 24);

    const integration = await prisma.integration.create({
      data: {
        name,
        type,
        provider,
        partnerTier,
        config: req.body?.config && typeof req.body.config === 'object' ? req.body.config : {},
        metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : null,
        isActive: req.body?.isActive !== undefined ? normalizeBoolean(req.body.isActive, true) : true,
        webhookUrl: normalizeUrl(req.body?.webhookUrl),
        clientId,
        clientSecretHash: hashWithPepper(clientSecret),
        scopes: scopes.length > 0 ? scopes : getDefaultScopes(),
        rateLimitPerMinute: normalizeNumber(req.body?.rateLimitPerMinute) || PARTNER_TIER_RATE_LIMIT[partnerTier],
        webhookSigningSecret
      }
    });

    if (integration.webhookUrl) {
      await prisma.integrationWebhookEndpoint.create({
        data: {
          integrationId: integration.id,
          eventType: '*',
          url: integration.webhookUrl,
          secret: webhookSigningSecret,
          isActive: true
        }
      });
    }

    await logIntegration({
      integrationId: integration.id,
      action: 'admin.partner.created',
      status: 'SUCCESS',
      message: 'Parceiro de integração criado',
      data: { clientId: integration.clientId }
    });

    return res.status(201).json({
      data: {
        partner: serializeIntegration(integration),
        credentials: {
          client_id: integration.clientId,
          client_secret: clientSecret,
          token_url: '/api/integration/oauth/token'
        }
      }
    });
  } catch (error) {
    console.error('Erro ao criar parceiro de integração:', error);
    if (String(error.code || '').includes('P2002')) {
      return sendError(res, 409, 'PARTNER_CLIENT_ID_ALREADY_EXISTS', 'client_id já está em uso.', req.correlationId);
    }
    return sendError(res, 500, 'PARTNER_CREATE_FAILED', 'Não foi possível criar parceiro de integração.', req.correlationId);
  }
});

adminRouter.put('/partners/:id', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    if (!partnerId) {
      return sendError(res, 400, 'PARTNER_ID_REQUIRED', 'ID do parceiro é obrigatório.', req.correlationId);
    }

    const current = await prisma.integration.findUnique({ where: { id: partnerId } });
    if (!current) {
      return sendError(res, 404, 'PARTNER_NOT_FOUND', 'Parceiro não encontrado.', req.correlationId);
    }

    const type = req.body?.type ? normalizeIntegrationType(req.body.type) : null;
    const provider = req.body?.provider ? normalizeProvider(req.body.provider) : null;
    const partnerTier = req.body?.partnerTier ? normalizeTier(req.body.partnerTier) : null;

    if (req.body?.type && !type) {
      return sendError(res, 400, 'INVALID_PARTNER_TYPE', 'Tipo de integração inválido.', req.correlationId);
    }
    if (req.body?.provider && !provider) {
      return sendError(res, 400, 'INVALID_PROVIDER', 'Provider inválido.', req.correlationId);
    }
    if (req.body?.partnerTier && !partnerTier) {
      return sendError(res, 400, 'INVALID_PARTNER_TIER', 'Nível do parceiro inválido.', req.correlationId);
    }

    const nextData = {
      name: req.body?.name !== undefined ? normalizeString(req.body.name, 200) || current.name : undefined,
      type: type || undefined,
      provider: provider || undefined,
      partnerTier: partnerTier || undefined,
      scopes: req.body?.scopes ? parseScopeList(req.body.scopes) : undefined,
      config: req.body?.config && typeof req.body.config === 'object' ? req.body.config : undefined,
      metadata: req.body?.metadata && typeof req.body.metadata === 'object' ? req.body.metadata : undefined,
      isActive: req.body?.isActive !== undefined ? normalizeBoolean(req.body.isActive, current.isActive) : undefined,
      webhookUrl: req.body?.webhookUrl !== undefined ? normalizeUrl(req.body.webhookUrl) : undefined,
      rateLimitPerMinute:
        req.body?.rateLimitPerMinute !== undefined
          ? normalizeNumber(req.body.rateLimitPerMinute)
          : undefined
    };

    if (Array.isArray(nextData.scopes) && nextData.scopes.length === 0) {
      nextData.scopes = getDefaultScopes();
    }

    Object.keys(nextData).forEach((key) => {
      if (nextData[key] === undefined) delete nextData[key];
    });

    const updated = await prisma.integration.update({
      where: { id: partnerId },
      data: nextData
    });

    await logIntegration({
      integrationId: updated.id,
      action: 'admin.partner.updated',
      status: 'SUCCESS',
      message: 'Parceiro de integração atualizado',
      data: nextData
    });

    return res.json({ data: serializeIntegration(updated) });
  } catch (error) {
    console.error('Erro ao atualizar parceiro de integração:', error);
    return sendError(res, 500, 'PARTNER_UPDATE_FAILED', 'Não foi possível atualizar parceiro.', req.correlationId);
  }
});

adminRouter.post('/partners/:id/rotate-secret', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const partner = await prisma.integration.findUnique({ where: { id: partnerId } });

    if (!partner) {
      return sendError(res, 404, 'PARTNER_NOT_FOUND', 'Parceiro não encontrado.', req.correlationId);
    }

    const newSecret = randomToken('secret', 24);

    const updated = await prisma.integration.update({
      where: { id: partnerId },
      data: {
        clientSecretHash: hashWithPepper(newSecret)
      }
    });

    await prisma.integrationAccessToken.updateMany({
      where: {
        integrationId: partnerId,
        revokedAt: null
      },
      data: {
        revokedAt: now()
      }
    });

    await logIntegration({
      integrationId: partnerId,
      action: 'admin.partner.secret_rotated',
      status: 'WARNING',
      message: 'Client secret rotacionado e tokens revogados'
    });

    return res.json({
      data: {
        partner: serializeIntegration(updated),
        credentials: {
          client_id: updated.clientId,
          client_secret: newSecret,
          token_url: '/api/integration/oauth/token'
        }
      }
    });
  } catch (error) {
    console.error('Erro ao rotacionar segredo do parceiro:', error);
    return sendError(res, 500, 'PARTNER_SECRET_ROTATE_FAILED', 'Não foi possível rotacionar secret.', req.correlationId);
  }
});

adminRouter.get('/partners/:id/field-mappings', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const module = req.query?.module ? normalizeModule(req.query.module) : null;
    const entityType = req.query?.entityType ? normalizeEntityType(req.query.entityType) : null;

    const where = {
      integrationId: partnerId
    };

    if (module) where.module = module;
    if (entityType) where.entityType = entityType;

    const mappings = await prisma.integrationFieldMapping.findMany({
      where,
      orderBy: [{ module: 'asc' }, { entityType: 'asc' }, { sourceField: 'asc' }]
    });

    return res.json({ data: mappings });
  } catch (error) {
    console.error('Erro ao listar mapeamentos:', error);
    return sendError(res, 500, 'FIELD_MAPPING_LIST_FAILED', 'Não foi possível listar mapeamentos.', req.correlationId);
  }
});

adminRouter.post('/partners/:id/field-mappings', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const module = normalizeModule(req.body?.module);
    const entityType = normalizeEntityType(req.body?.entityType);
    const sourceField = normalizeString(req.body?.sourceField, 180);
    const targetField = normalizeString(req.body?.targetField, 180);

    if (!module || !entityType || !sourceField || !targetField) {
      return sendError(
        res,
        400,
        'FIELD_MAPPING_INVALID_PAYLOAD',
        'module, entityType, sourceField e targetField são obrigatórios.',
        req.correlationId
      );
    }

    const mapping = await prisma.integrationFieldMapping.upsert({
      where: {
        integrationId_module_entityType_sourceField: {
          integrationId: partnerId,
          module,
          entityType,
          sourceField
        }
      },
      create: {
        integrationId: partnerId,
        module,
        entityType,
        sourceField,
        targetField,
        transformRule: req.body?.transformRule && typeof req.body.transformRule === 'object' ? req.body.transformRule : null,
        defaultValue: req.body?.defaultValue !== undefined ? String(req.body.defaultValue) : null,
        isCustom: normalizeBoolean(req.body?.isCustom, false),
        isRequired: normalizeBoolean(req.body?.isRequired, false)
      },
      update: {
        targetField,
        transformRule: req.body?.transformRule && typeof req.body.transformRule === 'object' ? req.body.transformRule : null,
        defaultValue: req.body?.defaultValue !== undefined ? String(req.body.defaultValue) : null,
        isCustom: normalizeBoolean(req.body?.isCustom, false),
        isRequired: normalizeBoolean(req.body?.isRequired, false)
      }
    });

    return res.status(201).json({ data: mapping });
  } catch (error) {
    console.error('Erro ao salvar mapeamento:', error);
    return sendError(res, 500, 'FIELD_MAPPING_UPSERT_FAILED', 'Não foi possível salvar mapeamento.', req.correlationId);
  }
});

adminRouter.delete('/partners/:id/field-mappings/:mappingId', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const mappingId = normalizeString(req.params.mappingId, 120);

    await prisma.integrationFieldMapping.deleteMany({
      where: {
        id: mappingId,
        integrationId: partnerId
      }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir mapeamento:', error);
    return sendError(res, 500, 'FIELD_MAPPING_DELETE_FAILED', 'Não foi possível excluir mapeamento.', req.correlationId);
  }
});

adminRouter.get('/partners/:id/custom-fields', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const module = req.query?.module ? normalizeModule(req.query.module) : null;
    const entityType = req.query?.entityType ? normalizeEntityType(req.query.entityType) : null;

    const where = {
      integrationId: partnerId
    };

    if (module) where.module = module;
    if (entityType) where.entityType = entityType;

    const customFields = await prisma.integrationCustomField.findMany({
      where,
      orderBy: [{ module: 'asc' }, { entityType: 'asc' }, { fieldKey: 'asc' }]
    });

    return res.json({ data: customFields });
  } catch (error) {
    console.error('Erro ao listar custom fields:', error);
    return sendError(res, 500, 'CUSTOM_FIELDS_LIST_FAILED', 'Não foi possível listar campos customizados.', req.correlationId);
  }
});

adminRouter.post('/partners/:id/custom-fields', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const module = normalizeModule(req.body?.module);
    const entityType = normalizeEntityType(req.body?.entityType);
    const fieldKey = normalizeString(req.body?.fieldKey, 180);
    const label = normalizeString(req.body?.label, 220);
    const dataType = String(req.body?.dataType || 'STRING').trim().toUpperCase();

    if (!module || !entityType || !fieldKey || !label) {
      return sendError(
        res,
        400,
        'CUSTOM_FIELD_INVALID_PAYLOAD',
        'module, entityType, fieldKey e label são obrigatórios.',
        req.correlationId
      );
    }

    if (!ALLOWED_CUSTOM_FIELD_TYPES.has(dataType)) {
      return sendError(res, 400, 'CUSTOM_FIELD_INVALID_DATATYPE', 'Tipo de campo customizado inválido.', req.correlationId);
    }

    const customField = await prisma.integrationCustomField.upsert({
      where: {
        integrationId_module_entityType_fieldKey: {
          integrationId: partnerId,
          module,
          entityType,
          fieldKey
        }
      },
      create: {
        integrationId: partnerId,
        module,
        entityType,
        fieldKey,
        label,
        dataType,
        description: normalizeString(req.body?.description, 800),
        totvsFieldCode: normalizeString(req.body?.totvsFieldCode, 120),
        isRequired: normalizeBoolean(req.body?.isRequired, false),
        defaultValue: req.body?.defaultValue !== undefined ? req.body.defaultValue : null
      },
      update: {
        label,
        dataType,
        description: normalizeString(req.body?.description, 800),
        totvsFieldCode: normalizeString(req.body?.totvsFieldCode, 120),
        isRequired: normalizeBoolean(req.body?.isRequired, false),
        defaultValue: req.body?.defaultValue !== undefined ? req.body.defaultValue : null
      }
    });

    return res.status(201).json({ data: customField });
  } catch (error) {
    console.error('Erro ao salvar custom field:', error);
    return sendError(res, 500, 'CUSTOM_FIELD_UPSERT_FAILED', 'Não foi possível salvar campo customizado.', req.correlationId);
  }
});

adminRouter.delete('/partners/:id/custom-fields/:fieldId', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const fieldId = normalizeString(req.params.fieldId, 120);

    await prisma.integrationCustomField.deleteMany({
      where: {
        id: fieldId,
        integrationId: partnerId
      }
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir custom field:', error);
    return sendError(res, 500, 'CUSTOM_FIELD_DELETE_FAILED', 'Não foi possível excluir campo customizado.', req.correlationId);
  }
});

adminRouter.get('/partners/:id/webhooks', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const endpoints = await prisma.integrationWebhookEndpoint.findMany({
      where: { integrationId: partnerId },
      orderBy: [{ createdAt: 'desc' }]
    });

    return res.json({ data: endpoints });
  } catch (error) {
    console.error('Erro ao listar webhooks:', error);
    return sendError(res, 500, 'WEBHOOK_LIST_FAILED', 'Não foi possível listar webhooks.', req.correlationId);
  }
});

adminRouter.post('/partners/:id/webhooks', async (req, res) => {
  try {
    const partnerId = normalizeString(req.params.id, 120);
    const eventType = normalizeString(req.body?.eventType, 120) || '*';
    const url = normalizeUrl(req.body?.url);

    if (!url) {
      return sendError(res, 400, 'WEBHOOK_URL_REQUIRED', 'URL do webhook é obrigatória e deve ser HTTP/HTTPS.', req.correlationId);
    }

    if (!WEBHOOK_EVENT_TYPES.has(eventType) && eventType !== '*') {
      return sendError(res, 400, 'WEBHOOK_EVENT_INVALID', 'Tipo de evento de webhook inválido.', req.correlationId);
    }

    const endpoint = await prisma.integrationWebhookEndpoint.create({
      data: {
        integrationId: partnerId,
        eventType,
        url,
        secret: normalizeString(req.body?.secret, 300),
        isActive: req.body?.isActive !== undefined ? normalizeBoolean(req.body.isActive, true) : true,
        maxRetries: Math.max(1, Math.min(Number(req.body?.maxRetries || 5), 15)),
        timeoutMs: Math.max(1000, Math.min(Number(req.body?.timeoutMs || DEFAULT_WEBHOOK_TIMEOUT_MS), 60000))
      }
    });

    return res.status(201).json({ data: endpoint });
  } catch (error) {
    console.error('Erro ao criar webhook:', error);
    return sendError(res, 500, 'WEBHOOK_CREATE_FAILED', 'Não foi possível criar webhook.', req.correlationId);
  }
});

adminRouter.put('/webhooks/:endpointId', async (req, res) => {
  try {
    const endpointId = normalizeString(req.params.endpointId, 120);
    const existing = await prisma.integrationWebhookEndpoint.findUnique({ where: { id: endpointId } });

    if (!existing) {
      return sendError(res, 404, 'WEBHOOK_NOT_FOUND', 'Webhook não encontrado.', req.correlationId);
    }

    const eventType = req.body?.eventType ? normalizeString(req.body.eventType, 120) : null;
    if (eventType && !WEBHOOK_EVENT_TYPES.has(eventType) && eventType !== '*') {
      return sendError(res, 400, 'WEBHOOK_EVENT_INVALID', 'Tipo de evento de webhook inválido.', req.correlationId);
    }

    const updated = await prisma.integrationWebhookEndpoint.update({
      where: { id: endpointId },
      data: {
        eventType: eventType || undefined,
        url: req.body?.url !== undefined ? normalizeUrl(req.body.url) : undefined,
        secret: req.body?.secret !== undefined ? normalizeString(req.body.secret, 300) : undefined,
        isActive: req.body?.isActive !== undefined ? normalizeBoolean(req.body.isActive, existing.isActive) : undefined,
        maxRetries:
          req.body?.maxRetries !== undefined
            ? Math.max(1, Math.min(Number(req.body.maxRetries), 15))
            : undefined,
        timeoutMs:
          req.body?.timeoutMs !== undefined
            ? Math.max(1000, Math.min(Number(req.body.timeoutMs), 60000))
            : undefined
      }
    });

    return res.json({ data: updated });
  } catch (error) {
    console.error('Erro ao atualizar webhook:', error);
    return sendError(res, 500, 'WEBHOOK_UPDATE_FAILED', 'Não foi possível atualizar webhook.', req.correlationId);
  }
});

adminRouter.delete('/webhooks/:endpointId', async (req, res) => {
  try {
    const endpointId = normalizeString(req.params.endpointId, 120);
    await prisma.integrationWebhookEndpoint.deleteMany({ where: { id: endpointId } });
    return res.json({ success: true });
  } catch (error) {
    console.error('Erro ao excluir webhook:', error);
    return sendError(res, 500, 'WEBHOOK_DELETE_FAILED', 'Não foi possível excluir webhook.', req.correlationId);
  }
});

adminRouter.get('/webhooks/deliveries', async (req, res) => {
  try {
    const status = normalizeString(req.query?.status, 30)?.toUpperCase();
    const integrationId = normalizeString(req.query?.integrationId, 120);
    const eventType = normalizeString(req.query?.eventType, 120);
    const take = Math.max(1, Math.min(Number(req.query?.limit || 50), 500));

    const where = {};
    if (status && ['PENDING', 'SENT', 'FAILED'].includes(status)) where.status = status;
    if (integrationId) where.integrationId = integrationId;
    if (eventType) where.eventType = eventType;

    const deliveries = await prisma.integrationWebhookDelivery.findMany({
      where,
      include: {
        endpoint: {
          select: {
            id: true,
            eventType: true,
            url: true
          }
        }
      },
      orderBy: [{ createdAt: 'desc' }],
      take
    });

    return res.json({ data: deliveries });
  } catch (error) {
    console.error('Erro ao listar entregas de webhook:', error);
    return sendError(res, 500, 'WEBHOOK_DELIVERY_LIST_FAILED', 'Não foi possível listar entregas de webhook.', req.correlationId);
  }
});

adminRouter.post('/webhooks/deliveries/process', async (req, res) => {
  try {
    const limit = Number(req.body?.limit || 100);
    const summary = await processPendingDeliveries(limit, req.correlationId);
    return res.json({ data: summary });
  } catch (error) {
    console.error('Erro ao processar fila de webhooks:', error);
    return sendError(res, 500, 'WEBHOOK_PROCESS_FAILED', 'Não foi possível processar fila de webhooks.', req.correlationId);
  }
});

router.use('/admin', adminRouter);

const v1Router = express.Router();
v1Router.use(integrationTokenAuth, integrationRateLimit);

v1Router.get('/health', (req, res) => {
  return res.json({
    status: 'ok',
    integration: {
      id: req.integration.id,
      name: req.integration.name,
      provider: req.integration.provider,
      tier: req.integration.partnerTier
    },
    scopes: Array.from(req.integrationScopes || []),
    timestamp: now().toISOString()
  });
});

v1Router.post(
  '/b2b/customers/sync',
  requireIntegrationScopes('b2b:write'),
  withIdempotency('b2b.customers.sync', async (req, res) => {
    const integrationId = req.integration.id;
    const payload = req.body || {};

    const mapped = await resolveMappedPayload({
      integrationId,
      module: 'B2B',
      entityType: 'CUSTOMER',
      payload
    });

    const merged = {
      ...payload,
      ...mapped.mappedPayload
    };

    const cnpj = normalizeCnpj(merged.cnpj || merged.document || merged.documento);
    const companyName = normalizeString(merged.razaoSocial || merged.nomeFantasia || merged.name, 220);

    if (!cnpj || !companyName) {
      return sendError(
        res,
        400,
        'CUSTOMER_INVALID_PAYLOAD',
        'cnpj e razaoSocial (ou name) são obrigatórios.',
        req.correlationId
      );
    }

    const externalId = normalizeString(merged.externalId || merged.codigoExterno || merged.customerExternalId, 180);

    let company = await prisma.company.findFirst({
      where: { document: cnpj }
    });

    if (!company && externalId) {
      const mappedCompanyId = await findInternalIdByExternal({
        integrationId,
        module: 'B2B',
        entityType: 'CUSTOMER',
        externalId
      });

      if (mappedCompanyId) {
        company = await prisma.company.findUnique({ where: { id: mappedCompanyId } });
      }
    }

    const companyStatusRaw = String(merged.status || 'ACTIVE').trim().toUpperCase();
    const companyStatus = ALLOWED_COMPANY_STATUSES.has(companyStatusRaw) ? companyStatusRaw : 'ACTIVE';

    const companyData = {
      name: companyName,
      document: cnpj,
      segment: normalizeString(merged.segment, 140),
      website: normalizeString(merged.website, 260),
      address: normalizeString(merged.address || merged.endereco, 260),
      city: normalizeString(merged.city || merged.cidade, 140),
      state: normalizeString(merged.state || merged.uf, 2)?.toUpperCase() || null,
      country: normalizeString(merged.country, 80) || 'Brasil',
      status: companyStatus
    };

    let persisted;
    if (company) {
      persisted = await prisma.company.update({
        where: { id: company.id },
        data: companyData
      });
    } else {
      persisted = await prisma.company.create({
        data: companyData
      });
    }

    await upsertEntityMapping({
      integrationId,
      module: 'B2B',
      entityType: 'CUSTOMER',
      externalId,
      internalId: persisted.id,
      metadata: {
        cnpj,
        source: 'customer_sync'
      }
    });

    const extensionData = {
      inscricaoEstadual: normalizeString(
        merged.inscricaoEstadual || merged.ie || payload?.totvs?.inscricaoEstadual,
        80
      ),
      codigoMunicipioIBGE: normalizeString(
        merged.codigoMunicipioIBGE || payload?.totvs?.codigoMunicipioIBGE,
        20
      ),
      codigoSA1: normalizeString(merged.codigoSA1 || payload?.totvs?.codigoSA1, 80),
      customFields: mapped.customFieldValues,
      mappedFieldsCount: mapped.mappingsCount,
      updatedAt: now().toISOString()
    };

    await upsertEntityData({
      integrationId,
      module: 'B2B',
      entityType: 'CUSTOMER',
      entityId: persisted.id,
      data: extensionData
    });

    await logIntegration({
      integrationId,
      action: 'b2b.customer.sync',
      status: 'SUCCESS',
      message: `Cliente ${persisted.id} sincronizado`,
      data: {
        companyId: persisted.id,
        cnpj,
        externalId
      }
    });

    const webhookResult = await enqueueWebhookDeliveries({
      integrationId,
      eventType: 'customer_synced',
      payload: {
        id: persisted.id,
        cnpj,
        name: persisted.name,
        externalId
      },
      correlationId: req.correlationId,
      idempotencyKey: req.headers['idempotency-key']
    });

    return res.status(company ? 200 : 201).json({
      data: {
        customer: persisted,
        metadata: extensionData,
        webhooks: webhookResult
      }
    });
  })
);

v1Router.get('/b2b/customers/:cnpj', requireIntegrationScopes('b2b:read'), async (req, res) => {
  const cnpj = normalizeCnpj(req.params.cnpj);
  if (!cnpj) {
    return sendError(res, 400, 'INVALID_CNPJ', 'CNPJ inválido.', req.correlationId);
  }

  const company = await prisma.company.findFirst({
    where: { document: cnpj }
  });

  if (!company) {
    return sendError(res, 404, 'CUSTOMER_NOT_FOUND', 'Cliente não encontrado.', req.correlationId, { cnpj });
  }

  const [entityData, mappings] = await Promise.all([
    getEntityData({
      integrationId: req.integration.id,
      module: 'B2B',
      entityType: 'CUSTOMER',
      entityId: company.id
    }),
    prisma.integrationEntityMapping.findMany({
      where: {
        integrationId: req.integration.id,
        module: 'B2B',
        entityType: 'CUSTOMER',
        internalId: company.id
      },
      select: {
        externalId: true,
        metadata: true,
        updatedAt: true
      }
    })
  ]);

  return res.json({
    data: {
      customer: company,
      externalMappings: mappings,
      metadata: entityData?.data || {}
    }
  });
});

v1Router.post(
  '/b2b/price-tables/sync',
  requireIntegrationScopes('b2b:write'),
  withIdempotency('b2b.price_tables.sync', async (req, res) => {
    const integrationId = req.integration.id;
    const payload = req.body || {};

    const externalId = normalizeString(payload.externalId || payload.priceTableExternalId || payload.codigoTabela, 180);
    const tableName = normalizeString(payload.name || payload.nome, 220);

    if (!tableName) {
      return sendError(res, 400, 'PRICE_TABLE_NAME_REQUIRED', 'Nome da tabela de preços é obrigatório.', req.correlationId);
    }

    const mappedPriceTableId = await findInternalIdByExternal({
      integrationId,
      module: 'B2B',
      entityType: 'PRICE_TABLE',
      externalId
    });

    let priceTable = mappedPriceTableId
      ? await prisma.priceTable.findUnique({ where: { id: mappedPriceTableId } })
      : null;

    const validFrom = parseDate(payload.validFrom) || now();
    const validUntil = parseDate(payload.validUntil);

    if (priceTable) {
      priceTable = await prisma.priceTable.update({
        where: { id: priceTable.id },
        data: {
          name: tableName,
          description: normalizeString(payload.description, 400),
          validFrom,
          validUntil,
          customerSegment: normalizeString(payload.customerSegment, 120)
        }
      });
    } else {
      priceTable = await prisma.priceTable.create({
        data: {
          name: tableName,
          description: normalizeString(payload.description, 400),
          validFrom,
          validUntil,
          customerSegment: normalizeString(payload.customerSegment, 120),
          isDefault: false
        }
      });
    }

    await upsertEntityMapping({
      integrationId,
      module: 'B2B',
      entityType: 'PRICE_TABLE',
      externalId,
      internalId: priceTable.id,
      metadata: {
        name: tableName
      }
    });

    const items = Array.isArray(payload.items) ? payload.items : [];
    let processedItems = 0;

    for (const rawItem of items) {
      if (!rawItem || typeof rawItem !== 'object') continue;

      const item = { ...rawItem };
      const productExternalId = normalizeString(item.productExternalId || item.codigoProduto, 180);
      const productIdFromPayload = normalizeString(item.productId, 120);
      const productName = normalizeString(item.productName || item.nomeProduto || item.name, 220);
      const productPrice = normalizeNumber(item.price);

      let product = null;

      if (productIdFromPayload) {
        product = await prisma.product.findUnique({ where: { id: productIdFromPayload } });
      }

      if (!product && productExternalId) {
        const mappedProductId = await findInternalIdByExternal({
          integrationId,
          module: 'B2B',
          entityType: 'PRODUCT',
          externalId: productExternalId
        });

        if (mappedProductId) {
          product = await prisma.product.findUnique({ where: { id: mappedProductId } });
        }
      }

      if (!product && productName) {
        product = await prisma.product.findFirst({ where: { name: productName } });
      }

      if (!product && productName) {
        product = await prisma.product.create({
          data: {
            name: productName,
            description: normalizeString(item.description, 500),
            category: normalizeString(item.category, 120),
            price: productPrice || 0,
            active: true
          }
        });
      }

      if (!product) {
        continue;
      }

      if (productExternalId) {
        await upsertEntityMapping({
          integrationId,
          module: 'B2B',
          entityType: 'PRODUCT',
          externalId: productExternalId,
          internalId: product.id,
          metadata: {
            source: 'price_table_sync'
          }
        });
      }

      const minQuantity = Math.max(1, Number(item.minQuantity || 1));

      await prisma.productPrice.upsert({
        where: {
          productId_priceTableId_minQuantity: {
            productId: product.id,
            priceTableId: priceTable.id,
            minQuantity
          }
        },
        create: {
          productId: product.id,
          priceTableId: priceTable.id,
          price: productPrice || product.price || 0,
          minQuantity,
          maxQuantity: normalizeNumber(item.maxQuantity),
          discount: normalizeNumber(item.discount) || 0
        },
        update: {
          price: productPrice || product.price || 0,
          maxQuantity: normalizeNumber(item.maxQuantity),
          discount: normalizeNumber(item.discount) || 0
        }
      });

      processedItems += 1;
    }

    await logIntegration({
      integrationId,
      action: 'b2b.price_table.sync',
      status: 'SUCCESS',
      message: `Tabela de preços ${priceTable.id} sincronizada`,
      data: {
        priceTableId: priceTable.id,
        externalId,
        processedItems
      }
    });

    const webhookResult = await enqueueWebhookDeliveries({
      integrationId,
      eventType: 'price_table_synced',
      payload: {
        priceTableId: priceTable.id,
        externalId,
        processedItems
      },
      correlationId: req.correlationId,
      idempotencyKey: req.headers['idempotency-key']
    });

    return res.status(200).json({
      data: {
        priceTable,
        processedItems,
        webhooks: webhookResult
      }
    });
  })
);

v1Router.post(
  '/b2b/orders/sync',
  requireIntegrationScopes('b2b:write'),
  withIdempotency('b2b.orders.sync', async (req, res) => {
    const integrationId = req.integration.id;
    const payload = req.body || {};

    const externalOrderId = normalizeString(payload.externalOrderId || payload.codigoPedido, 180);
    if (!externalOrderId) {
      return sendError(res, 400, 'ORDER_EXTERNAL_ID_REQUIRED', 'externalOrderId é obrigatório.', req.correlationId);
    }

    const totalValue = normalizeNumber(payload.totalValue || payload.valorTotal);
    if (totalValue === null) {
      return sendError(res, 400, 'ORDER_TOTAL_VALUE_REQUIRED', 'totalValue é obrigatório.', req.correlationId);
    }

    const cnpj = normalizeCnpj(payload.cnpj);
    const customerExternalId = normalizeString(payload.customerExternalId, 180);

    let company = null;
    if (cnpj) {
      company = await prisma.company.findFirst({ where: { document: cnpj } });
    }

    if (!company && customerExternalId) {
      const mappedCompanyId = await findInternalIdByExternal({
        integrationId,
        module: 'B2B',
        entityType: 'CUSTOMER',
        externalId: customerExternalId
      });

      if (mappedCompanyId) {
        company = await prisma.company.findUnique({ where: { id: mappedCompanyId } });
      }
    }

    let opportunity = null;
    const externalOpportunityId = normalizeString(payload.externalOpportunityId, 180);

    if (externalOpportunityId) {
      const mappedOpportunityId = await findInternalIdByExternal({
        integrationId,
        module: 'PRE_SALES',
        entityType: 'OPPORTUNITY',
        externalId: externalOpportunityId
      });

      if (mappedOpportunityId) {
        opportunity = await prisma.opportunity.findUnique({ where: { id: mappedOpportunityId } });
      }
    }

    if (!opportunity && normalizeBoolean(payload.createOpportunity, false) && company) {
      const ownerId = await findOwnerForOpportunity(normalizeString(payload.ownerUserId, 120));
      if (!ownerId) {
        return sendError(
          res,
          400,
          'OPPORTUNITY_OWNER_NOT_FOUND',
          'Nenhum usuário disponível para vincular oportunidade.',
          req.correlationId
        );
      }

      const stageRaw = String(payload.opportunityStage || 'QUALIFICATION').trim().toUpperCase();
      const stage = ALLOWED_OPPORTUNITY_STAGES.has(stageRaw) ? stageRaw : 'QUALIFICATION';

      opportunity = await prisma.opportunity.create({
        data: {
          title: normalizeString(payload.opportunityTitle, 220) || `Pedido ${externalOrderId}`,
          value: totalValue,
          stage,
          source: 'MANUAL',
          companyId: company.id,
          ownerId,
          description: normalizeString(payload.notes || payload.observacoes, 2000),
          expectedCloseDate: parseDate(payload.expectedCloseDate)
        }
      });

      if (externalOpportunityId) {
        await upsertEntityMapping({
          integrationId,
          module: 'PRE_SALES',
          entityType: 'OPPORTUNITY',
          externalId: externalOpportunityId,
          internalId: opportunity.id,
          metadata: {
            source: 'order_sync'
          }
        });
      }
    }

    const persistedOrder = await prisma.integrationOrder.upsert({
      where: {
        integrationId_externalOrderId: {
          integrationId,
          externalOrderId
        }
      },
      create: {
        integrationId,
        externalOrderId,
        companyId: company?.id || null,
        opportunityId: opportunity?.id || null,
        status: normalizeString(payload.status, 80) || 'PENDING',
        currency: normalizeString(payload.currency, 20) || 'BRL',
        totalValue,
        issuedAt: parseDate(payload.issuedAt),
        payload
      },
      update: {
        companyId: company?.id || null,
        opportunityId: opportunity?.id || null,
        status: normalizeString(payload.status, 80) || 'PENDING',
        currency: normalizeString(payload.currency, 20) || 'BRL',
        totalValue,
        issuedAt: parseDate(payload.issuedAt),
        payload
      }
    });

    await upsertEntityMapping({
      integrationId,
      module: 'B2B',
      entityType: 'ORDER',
      externalId: externalOrderId,
      internalId: persistedOrder.id,
      metadata: {
        companyId: company?.id || null,
        opportunityId: opportunity?.id || null
      }
    });

    await logIntegration({
      integrationId,
      action: 'b2b.order.sync',
      status: 'SUCCESS',
      message: `Pedido ${externalOrderId} sincronizado`,
      data: {
        orderId: persistedOrder.id,
        externalOrderId,
        companyId: company?.id || null,
        opportunityId: opportunity?.id || null
      }
    });

    const webhookResult = await enqueueWebhookDeliveries({
      integrationId,
      eventType: 'order_synced',
      payload: {
        orderId: persistedOrder.id,
        externalOrderId,
        companyId: company?.id || null,
        totalValue
      },
      correlationId: req.correlationId,
      idempotencyKey: req.headers['idempotency-key']
    });

    return res.json({
      data: {
        order: persistedOrder,
        company,
        opportunity,
        webhooks: webhookResult
      }
    });
  })
);

v1Router.get('/b2b/orders/:externalOrderId', requireIntegrationScopes('b2b:read'), async (req, res) => {
  const externalOrderId = normalizeString(req.params.externalOrderId, 180);
  if (!externalOrderId) {
    return sendError(res, 400, 'ORDER_EXTERNAL_ID_REQUIRED', 'externalOrderId inválido.', req.correlationId);
  }

  const order = await prisma.integrationOrder.findUnique({
    where: {
      integrationId_externalOrderId: {
        integrationId: req.integration.id,
        externalOrderId
      }
    },
    include: {
      company: true,
      opportunity: true
    }
  });

  if (!order) {
    return sendError(res, 404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.', req.correlationId);
  }

  return res.json({ data: order });
});

v1Router.post(
  '/b2g/bids/sync',
  requireIntegrationScopes('b2g:write'),
  withIdempotency('b2g.bids.sync', async (req, res) => {
    const integrationId = req.integration.id;
    const payload = req.body || {};

    const externalBidId = normalizeString(payload.externalBidId || payload.codigoEdital, 180);
    const title = normalizeString(payload.title || payload.titulo, 260);
    const organization = normalizeString(payload.organization || payload.orgao, 260);

    if (!title || !organization) {
      return sendError(
        res,
        400,
        'BID_INVALID_PAYLOAD',
        'title e organization são obrigatórios.',
        req.correlationId
      );
    }

    let bidNotice = null;

    if (externalBidId) {
      const mappedBidId = await findInternalIdByExternal({
        integrationId,
        module: 'B2G',
        entityType: 'BID_NOTICE',
        externalId: externalBidId
      });

      if (mappedBidId) {
        bidNotice = await prisma.bidNotice.findUnique({ where: { id: mappedBidId } });
      }
    }

    if (!bidNotice && payload.referenceCode) {
      bidNotice = await prisma.bidNotice.findFirst({
        where: {
          referenceCode: String(payload.referenceCode),
          organization
        }
      });
    }

    const bidTypeRaw = String(payload.type || 'EDITAL').trim().toUpperCase();
    const bidType = ALLOWED_BID_TYPES.has(bidTypeRaw) ? bidTypeRaw : 'EDITAL';
    const bidStatusRaw = String(payload.status || 'MONITORANDO').trim().toUpperCase();
    const bidStatus = ALLOWED_BID_STATUSES.has(bidStatusRaw) ? bidStatusRaw : 'MONITORANDO';

    const bidData = {
      type: bidType,
      title,
      referenceCode: normalizeString(payload.referenceCode, 120),
      organization,
      stateCode: normalizeString(payload.stateCode || payload.uf, 2)?.toUpperCase() || null,
      modality: normalizeString(payload.modality, 120),
      objectDescription: normalizeString(payload.objectDescription || payload.objeto, 4000),
      estimatedValue: normalizeNumber(payload.estimatedValue),
      openingDate: parseDate(payload.openingDate),
      proposalDueDate: parseDate(payload.proposalDueDate),
      status: bidStatus,
      sourceUrl: normalizeUrl(payload.sourceUrl),
      documentText: normalizeString(payload.documentText, 30000),
      summary: normalizeString(payload.summary, 3000),
      documentation: normalizeBidDocumentation(payload.documentation),
      tags: Array.isArray(payload.tags)
        ? [...new Set(payload.tags.map((item) => normalizeString(item, 80)).filter(Boolean))].slice(0, 20)
        : []
    };

    const persisted = bidNotice
      ? await prisma.bidNotice.update({ where: { id: bidNotice.id }, data: bidData })
      : await prisma.bidNotice.create({ data: bidData });

    await prisma.bidNoticeHistory.create({
      data: {
        noticeId: persisted.id,
        eventType: bidNotice ? 'SYNC_UPDATED' : 'SYNC_CREATED',
        title: bidNotice ? 'Edital atualizado via integração' : 'Edital criado via integração',
        details: normalizeString(payload.historyMessage, 300),
        payload: {
          integrationId,
          externalBidId,
          correlationId: req.correlationId
        },
        createdByName: req.integration.name
      }
    });

    await upsertEntityMapping({
      integrationId,
      module: 'B2G',
      entityType: 'BID_NOTICE',
      externalId: externalBidId,
      internalId: persisted.id,
      metadata: {
        referenceCode: persisted.referenceCode,
        organization: persisted.organization
      }
    });

    await upsertEntityData({
      integrationId,
      module: 'B2G',
      entityType: 'BID_NOTICE',
      entityId: persisted.id,
      data: {
        codigoContratoERP: normalizeString(payload.codigoContratoERP, 120),
        fiscalRetentions: {
          retencaoISS: normalizeNumber(payload?.fiscalRetentions?.retencaoISS),
          retencaoIRRF: normalizeNumber(payload?.fiscalRetentions?.retencaoIRRF),
          retencaoPIS: normalizeNumber(payload?.fiscalRetentions?.retencaoPIS),
          retencaoCOFINS: normalizeNumber(payload?.fiscalRetentions?.retencaoCOFINS),
          retencaoCSLL: normalizeNumber(payload?.fiscalRetentions?.retencaoCSLL)
        },
        customFields: payload?.customFields && typeof payload.customFields === 'object' ? payload.customFields : {}
      }
    });

    await logIntegration({
      integrationId,
      action: 'b2g.bid.sync',
      status: 'SUCCESS',
      message: `Edital ${persisted.id} sincronizado`,
      data: {
        bidId: persisted.id,
        externalBidId,
        status: persisted.status
      }
    });

    return res.status(bidNotice ? 200 : 201).json({
      data: persisted
    });
  })
);

v1Router.patch(
  '/b2g/bids/:externalBidId/status',
  requireIntegrationScopes('b2g:write'),
  withIdempotency('b2g.bids.status.update', async (req, res) => {
    const integrationId = req.integration.id;
    const externalBidId = normalizeString(req.params.externalBidId, 180);
    const payload = req.body || {};

    if (!externalBidId) {
      return sendError(res, 400, 'BID_EXTERNAL_ID_REQUIRED', 'externalBidId é obrigatório.', req.correlationId);
    }

    const statusRaw = String(payload.status || '').trim().toUpperCase();
    if (!ALLOWED_BID_STATUSES.has(statusRaw)) {
      return sendError(res, 400, 'BID_STATUS_INVALID', 'Status de licitatório inválido.', req.correlationId);
    }

    const mappedBidId = await findInternalIdByExternal({
      integrationId,
      module: 'B2G',
      entityType: 'BID_NOTICE',
      externalId: externalBidId
    });

    const notice = mappedBidId
      ? await prisma.bidNotice.findUnique({ where: { id: mappedBidId } })
      : await prisma.bidNotice.findUnique({ where: { id: externalBidId } });

    if (!notice) {
      return sendError(res, 404, 'BID_NOT_FOUND', 'Licitatório não encontrado.', req.correlationId, { externalBidId });
    }

    const nextDocumentation = payload.documentation
      ? normalizeBidDocumentation(payload.documentation)
      : notice.documentation;

    const updated = await prisma.bidNotice.update({
      where: { id: notice.id },
      data: {
        status: statusRaw,
        sourceUrl: payload.sourceUrl !== undefined ? normalizeUrl(payload.sourceUrl) : undefined,
        proposalDueDate: payload.proposalDueDate !== undefined ? parseDate(payload.proposalDueDate) : undefined,
        documentation: nextDocumentation
      }
    });

    await prisma.bidNoticeHistory.create({
      data: {
        noticeId: notice.id,
        eventType: 'STATUS_CHANGED',
        title: `Status alterado para ${statusRaw}`,
        details: normalizeString(payload.message || payload.observacao, 1000),
        payload: {
          oldStatus: notice.status,
          newStatus: statusRaw,
          externalBidId,
          correlationId: req.correlationId
        },
        createdByName: req.integration.name
      }
    });

    const existingData = await getEntityData({
      integrationId,
      module: 'B2G',
      entityType: 'BID_NOTICE',
      entityId: notice.id
    });

    const mergedData = {
      ...(existingData?.data || {}),
      fiscalRetentions: {
        retencaoISS: normalizeNumber(payload?.fiscalRetentions?.retencaoISS),
        retencaoIRRF: normalizeNumber(payload?.fiscalRetentions?.retencaoIRRF),
        retencaoPIS: normalizeNumber(payload?.fiscalRetentions?.retencaoPIS),
        retencaoCOFINS: normalizeNumber(payload?.fiscalRetentions?.retencaoCOFINS),
        retencaoCSLL: normalizeNumber(payload?.fiscalRetentions?.retencaoCSLL)
      },
      updatedAt: now().toISOString()
    };

    await upsertEntityData({
      integrationId,
      module: 'B2G',
      entityType: 'BID_NOTICE',
      entityId: notice.id,
      data: mergedData
    });

    await logIntegration({
      integrationId,
      action: 'b2g.bid.status.update',
      status: 'SUCCESS',
      message: `Status do edital ${notice.id} atualizado para ${statusRaw}`,
      data: {
        bidId: notice.id,
        externalBidId,
        oldStatus: notice.status,
        newStatus: statusRaw
      }
    });

    const bidStatusWebhook = await enqueueWebhookDeliveries({
      integrationId,
      eventType: 'bid_status_changed',
      payload: {
        bidId: updated.id,
        externalBidId,
        previousStatus: notice.status,
        currentStatus: updated.status,
        referenceCode: updated.referenceCode,
        organization: updated.organization
      },
      correlationId: req.correlationId,
      idempotencyKey: req.headers['idempotency-key']
    });

    let bidExpiredWebhook = null;
    if (updated.status === 'ENCERRADA') {
      bidExpiredWebhook = await enqueueWebhookDeliveries({
        integrationId,
        eventType: 'bid_expired',
        payload: {
          bidId: updated.id,
          externalBidId,
          status: updated.status,
          proposalDueDate: toIsoDate(updated.proposalDueDate)
        },
        correlationId: req.correlationId,
        idempotencyKey: req.headers['idempotency-key']
      });
    }

    return res.json({
      data: {
        notice: updated,
        metadata: mergedData,
        webhooks: {
          bid_status_changed: bidStatusWebhook,
          bid_expired: bidExpiredWebhook
        }
      }
    });
  })
);

v1Router.get('/b2g/bids/status', requireIntegrationScopes('b2g:read'), async (req, res) => {
  const page = Math.max(1, Number(req.query?.page || 1));
  const limit = Math.max(1, Math.min(Number(req.query?.limit || 20), 100));
  const skip = (page - 1) * limit;

  const where = {};
  const status = normalizeString(req.query?.status, 120)?.toUpperCase();
  if (status && ALLOWED_BID_STATUSES.has(status)) {
    where.status = status;
  }

  const updatedSince = parseDate(req.query?.updatedSince);
  if (updatedSince) {
    where.updatedAt = { gte: updatedSince };
  }

  const [items, total] = await Promise.all([
    prisma.bidNotice.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take: limit
    }),
    prisma.bidNotice.count({ where })
  ]);

  const bidIds = items.map((item) => item.id);

  const [mappings, extraData] = await Promise.all([
    prisma.integrationEntityMapping.findMany({
      where: {
        integrationId: req.integration.id,
        module: 'B2G',
        entityType: 'BID_NOTICE',
        internalId: { in: bidIds }
      },
      select: {
        internalId: true,
        externalId: true,
        metadata: true
      }
    }),
    prisma.integrationEntityData.findMany({
      where: {
        integrationId: req.integration.id,
        module: 'B2G',
        entityType: 'BID_NOTICE',
        entityId: { in: bidIds }
      },
      select: {
        entityId: true,
        data: true
      }
    })
  ]);

  const mapByInternal = new Map(mappings.map((item) => [item.internalId, item]));
  const extraByInternal = new Map(extraData.map((item) => [item.entityId, item.data]));

  return res.json({
    data: items.map((item) => ({
      ...item,
      externalId: mapByInternal.get(item.id)?.externalId || null,
      externalMetadata: mapByInternal.get(item.id)?.metadata || null,
      integrationData: extraByInternal.get(item.id) || null
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
});

v1Router.get('/b2g/bids/:externalBidId/documents', requireIntegrationScopes('b2g:read'), async (req, res) => {
  const integrationId = req.integration.id;
  const externalBidId = normalizeString(req.params.externalBidId, 180);
  if (!externalBidId) {
    return sendError(res, 400, 'BID_EXTERNAL_ID_REQUIRED', 'externalBidId é obrigatório.', req.correlationId);
  }

  const mappedBidId = await findInternalIdByExternal({
    integrationId,
    module: 'B2G',
    entityType: 'BID_NOTICE',
    externalId: externalBidId
  });

  const notice = mappedBidId
    ? await prisma.bidNotice.findUnique({ where: { id: mappedBidId } })
    : await prisma.bidNotice.findUnique({ where: { id: externalBidId } });

  if (!notice) {
    return sendError(res, 404, 'BID_NOT_FOUND', 'Licitatório não encontrado.', req.correlationId);
  }

  const extraData = await getEntityData({
    integrationId,
    module: 'B2G',
    entityType: 'BID_NOTICE',
    entityId: notice.id
  });

  return res.json({
    data: {
      bidId: notice.id,
      externalBidId,
      documentation: notice.documentation || [],
      fiscalData: extraData?.data?.fiscalRetentions || {},
      metadata: extraData?.data || {}
    }
  });
});

v1Router.post(
  '/connectors/:provider/leads',
  requireIntegrationScopes('pre_sales:write'),
  withIdempotency('connectors.leads.upsert', async (req, res) => {
    const integrationId = req.integration.id;
    const rawPayload = req.body || {};
    const provider = normalizeConnectorProvider(req.params.provider || rawPayload.provider);

    const normalizedLead = extractConnectorLeadPayload(provider, rawPayload);
    if (!normalizedLead.companyName) {
      return sendError(
        res,
        400,
        'CONNECTOR_LEAD_COMPANY_NAME_REQUIRED',
        'Não foi possível identificar o nome da empresa no payload.',
        req.correlationId,
        { provider }
      );
    }

    let company = null;
    let isNewLead = false;

    if (normalizedLead.cnpj) {
      company = await prisma.company.findFirst({
        where: { document: normalizedLead.cnpj }
      });
    }

    if (!company && normalizedLead.externalLeadId) {
      const mappedLeadId = await findInternalIdByExternal({
        integrationId,
        module: 'PRE_SALES',
        entityType: 'LEAD',
        externalId: normalizedLead.externalLeadId
      });

      if (mappedLeadId) {
        company = await prisma.company.findUnique({ where: { id: mappedLeadId } });
      }
    }

    const leadIsQualified = isQualifiedLead(normalizedLead.leadScore, normalizedLead.qualificationStatus);
    const recommendedStatus = leadIsQualified ? 'PROSPECT' : 'LEAD';
    const keepCurrentStatus = company && ['ACTIVE', 'CHURNED'].includes(company.status);
    const companyStatus = keepCurrentStatus ? company.status : recommendedStatus;

    const companyData = {
      name: normalizedLead.companyName,
      status: companyStatus,
      leadScore: normalizedLead.leadScore ?? 0,
      country: normalizedLead.country || 'Brasil',
      document: normalizedLead.cnpj || undefined,
      segment: normalizedLead.segment || undefined,
      website: normalizedLead.website || undefined,
      address: normalizedLead.address || undefined,
      city: normalizedLead.city || undefined,
      state: normalizedLead.state || undefined,
      size: normalizedLead.size || undefined
    };

    if (company) {
      if (normalizedLead.leadScore === null) {
        delete companyData.leadScore;
      }

      company = await prisma.company.update({
        where: { id: company.id },
        data: companyData
      });
    } else {
      company = await prisma.company.create({
        data: companyData
      });
      isNewLead = true;
    }

    const contact = await upsertPrimaryContact(company.id, normalizedLead.contact);

    let computedLeadScore = normalizedLead.leadScore;
    if (computedLeadScore === null) {
      try {
        const { updateCompanyLeadScore } = await getLeadAutomationModules();
        computedLeadScore = await updateCompanyLeadScore(company.id);
      } catch (error) {
        console.error('Erro ao recalcular score do lead recebido por conector:', error);
      }
    }

    if (typeof computedLeadScore === 'number' && company.leadScore !== computedLeadScore) {
      company = await prisma.company.update({
        where: { id: company.id },
        data: { leadScore: computedLeadScore }
      });
    } else if (typeof computedLeadScore === 'number') {
      company = {
        ...company,
        leadScore: computedLeadScore
      };
    }

    let autoDistribution = null;
    if (normalizedLead.autoDistribute && ['LEAD', 'PROSPECT'].includes(company.status)) {
      try {
        const { createOpportunityForLead, DISTRIBUTION_STRATEGIES } = await getLeadAutomationModules();
        autoDistribution = await createOpportunityForLead(
          company.id,
          DISTRIBUTION_STRATEGIES.SCORE_BASED
        );
      } catch (error) {
        autoDistribution = {
          error: error.message
        };
      }
    }

    await upsertEntityMapping({
      integrationId,
      module: 'PRE_SALES',
      entityType: 'LEAD',
      externalId: normalizedLead.externalLeadId,
      internalId: company.id,
      metadata: {
        provider,
        cnpj: normalizedLead.cnpj,
        sourceChannel: normalizedLead.sourceChannel
      }
    });

    const leadMetadata = {
      provider,
      sourceChannel: normalizedLead.sourceChannel,
      qualificationStatus: normalizedLead.qualificationStatus,
      leadScore: typeof computedLeadScore === 'number' ? computedLeadScore : null,
      externalLeadId: normalizedLead.externalLeadId,
      customPayload: rawPayload,
      updatedAt: now().toISOString()
    };

    await upsertEntityData({
      integrationId,
      module: 'PRE_SALES',
      entityType: 'LEAD',
      entityId: company.id,
      data: leadMetadata
    });

    await logIntegration({
      integrationId,
      action: 'connector.lead.upsert',
      status: autoDistribution?.error ? 'WARNING' : 'SUCCESS',
      message: `Lead ${company.id} sincronizado via ${provider}`,
      data: {
        companyId: company.id,
        provider,
        externalLeadId: normalizedLead.externalLeadId,
        leadScore: typeof computedLeadScore === 'number' ? computedLeadScore : null
      }
    });

    let qualifiedWebhook = null;
    if (isQualifiedLead(computedLeadScore, normalizedLead.qualificationStatus)) {
      qualifiedWebhook = await enqueueWebhookDeliveries({
        integrationId,
        eventType: 'lead_qualified',
        payload: {
          provider,
          leadId: company.id,
          externalLeadId: normalizedLead.externalLeadId,
          companyName: company.name,
          leadScore: typeof computedLeadScore === 'number' ? computedLeadScore : null,
          qualificationStatus: normalizedLead.qualificationStatus
        },
        correlationId: req.correlationId,
        idempotencyKey: req.headers['idempotency-key']
      });
    }

    const persistedLead = await prisma.company.findUnique({
      where: { id: company.id },
      include: {
        contacts: true
      }
    });

    return res.status(isNewLead ? 201 : 200).json({
      data: {
        lead: persistedLead,
        metadata: leadMetadata,
        contact,
        distribution: autoDistribution,
        webhooks: {
          lead_qualified: qualifiedWebhook
        }
      }
    });
  })
);

v1Router.post(
  '/pre-sales/leads',
  requireIntegrationScopes('pre_sales:write'),
  withIdempotency('pre_sales.leads.create', async (req, res) => {
    const integrationId = req.integration.id;
    const payload = req.body || {};

    const mapped = await resolveMappedPayload({
      integrationId,
      module: 'PRE_SALES',
      entityType: 'LEAD',
      payload
    });

    const merged = {
      ...payload,
      ...mapped.mappedPayload
    };

    const externalLeadId = normalizeString(merged.externalLeadId || merged.codigoLead, 180);
    const cnpj = normalizeCnpj(merged.cnpj);
    const companyName = normalizeString(merged.companyName || merged.razaoSocial || merged.name, 220);

    if (!companyName) {
      return sendError(res, 400, 'LEAD_COMPANY_NAME_REQUIRED', 'companyName é obrigatório.', req.correlationId);
    }

    let company = null;

    if (cnpj) {
      company = await prisma.company.findFirst({ where: { document: cnpj } });
    }

    if (!company && externalLeadId) {
      const mappedLeadId = await findInternalIdByExternal({
        integrationId,
        module: 'PRE_SALES',
        entityType: 'LEAD',
        externalId: externalLeadId
      });

      if (mappedLeadId) {
        company = await prisma.company.findUnique({ where: { id: mappedLeadId } });
      }
    }

    const leadScore = Math.max(0, Math.min(100, Number(merged.leadScore || 0)));
    const qualificationStatus = String(merged.qualificationStatus || '').trim().toUpperCase();
    const isQualified = qualificationStatus === 'QUALIFIED' || leadScore >= 70;

    const baseData = {
      name: companyName,
      document: cnpj,
      status: isQualified ? 'PROSPECT' : 'LEAD',
      leadScore,
      segment: normalizeString(merged.segment, 140),
      website: normalizeString(merged.website, 260),
      city: normalizeString(merged.city, 140),
      state: normalizeString(merged.state || merged.uf, 2)?.toUpperCase() || null,
      country: normalizeString(merged.country, 80) || 'Brasil',
      address: normalizeString(merged.address, 260)
    };

    company = company
      ? await prisma.company.update({ where: { id: company.id }, data: baseData })
      : await prisma.company.create({ data: baseData });

    await upsertEntityMapping({
      integrationId,
      module: 'PRE_SALES',
      entityType: 'LEAD',
      externalId: externalLeadId,
      internalId: company.id,
      metadata: {
        cnpj,
        sourceChannel: normalizeString(merged.sourceChannel, 100)
      }
    });

    const leadData = {
      sourceChannel: normalizeString(merged.sourceChannel, 100),
      contact: {
        name: normalizeString(merged.contactName || merged.nomeContato, 180),
        email: normalizeString(merged.email, 220),
        phone: normalizeString(merged.phone, 80)
      },
      qualificationStatus: isQualified ? 'QUALIFIED' : qualificationStatus || 'NEW',
      leadScore,
      customFields: mapped.customFieldValues,
      updatedAt: now().toISOString()
    };

    await upsertEntityData({
      integrationId,
      module: 'PRE_SALES',
      entityType: 'LEAD',
      entityId: company.id,
      data: leadData
    });

    await logIntegration({
      integrationId,
      action: 'pre_sales.lead.upsert',
      status: 'SUCCESS',
      message: `Lead ${company.id} sincronizado`,
      data: {
        companyId: company.id,
        externalLeadId,
        leadScore,
        qualificationStatus: leadData.qualificationStatus
      }
    });

    let qualifiedWebhook = null;
    if (isQualified) {
      qualifiedWebhook = await enqueueWebhookDeliveries({
        integrationId,
        eventType: 'lead_qualified',
        payload: {
          leadId: company.id,
          externalLeadId,
          companyName: company.name,
          leadScore,
          qualificationStatus: leadData.qualificationStatus
        },
        correlationId: req.correlationId,
        idempotencyKey: req.headers['idempotency-key']
      });
    }

    return res.status(201).json({
      data: {
        lead: company,
        metadata: leadData,
        webhooks: {
          lead_qualified: qualifiedWebhook
        }
      }
    });
  })
);

v1Router.get('/pre-sales/leads/:externalLeadId', requireIntegrationScopes('pre_sales:read'), async (req, res) => {
  const integrationId = req.integration.id;
  const externalLeadId = normalizeString(req.params.externalLeadId, 180);

  if (!externalLeadId) {
    return sendError(res, 400, 'LEAD_EXTERNAL_ID_REQUIRED', 'externalLeadId é obrigatório.', req.correlationId);
  }

  const companyId = await findInternalIdByExternal({
    integrationId,
    module: 'PRE_SALES',
    entityType: 'LEAD',
    externalId: externalLeadId
  });

  if (!companyId) {
    return sendError(res, 404, 'LEAD_NOT_FOUND', 'Lead não encontrado.', req.correlationId, { externalLeadId });
  }

  const [company, entityData] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId } }),
    getEntityData({
      integrationId,
      module: 'PRE_SALES',
      entityType: 'LEAD',
      entityId: companyId
    })
  ]);

  if (!company) {
    return sendError(res, 404, 'LEAD_NOT_FOUND', 'Lead não encontrado.', req.correlationId, { externalLeadId });
  }

  return res.json({
    data: {
      lead: company,
      metadata: entityData?.data || {}
    }
  });
});

v1Router.post(
  '/pre-sales/leads/:externalLeadId/convert',
  requireIntegrationScopes('pre_sales:write'),
  withIdempotency('pre_sales.leads.convert', async (req, res) => {
    const integrationId = req.integration.id;
    const externalLeadId = normalizeString(req.params.externalLeadId, 180);
    const payload = req.body || {};

    if (!externalLeadId) {
      return sendError(res, 400, 'LEAD_EXTERNAL_ID_REQUIRED', 'externalLeadId é obrigatório.', req.correlationId);
    }

    const companyId = await findInternalIdByExternal({
      integrationId,
      module: 'PRE_SALES',
      entityType: 'LEAD',
      externalId: externalLeadId
    });

    if (!companyId) {
      return sendError(res, 404, 'LEAD_NOT_FOUND', 'Lead não encontrado para conversão.', req.correlationId);
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return sendError(res, 404, 'LEAD_NOT_FOUND', 'Lead não encontrado para conversão.', req.correlationId);
    }

    const ownerId = await findOwnerForOpportunity(normalizeString(payload.ownerUserId, 120));
    if (!ownerId) {
      return sendError(res, 400, 'OPPORTUNITY_OWNER_NOT_FOUND', 'Não há usuário para atribuir oportunidade.', req.correlationId);
    }

    const stageRaw = String(payload.stage || 'QUALIFICATION').trim().toUpperCase();
    const stage = ALLOWED_OPPORTUNITY_STAGES.has(stageRaw) ? stageRaw : 'QUALIFICATION';

    const value = normalizeNumber(payload.value || payload.expectedValue || 0) || 0;

    const opportunity = await prisma.opportunity.create({
      data: {
        title: normalizeString(payload.opportunityTitle, 220) || `Oportunidade - ${company.name}`,
        description: normalizeString(payload.notes, 2000),
        value,
        stage,
        source: 'MANUAL',
        expectedCloseDate: parseDate(payload.expectedCloseDate),
        b2gStage: normalizeString(payload.b2gStage, 120),
        companyId: company.id,
        ownerId
      }
    });

    await prisma.company.update({
      where: { id: company.id },
      data: {
        status: 'PROSPECT'
      }
    });

    const externalOpportunityId = normalizeString(payload.externalOpportunityId || payload.codigoOportunidade, 180);
    await upsertEntityMapping({
      integrationId,
      module: 'PRE_SALES',
      entityType: 'OPPORTUNITY',
      externalId: externalOpportunityId,
      internalId: opportunity.id,
      metadata: {
        leadExternalId: externalLeadId,
        companyId: company.id
      }
    });

    await logIntegration({
      integrationId,
      action: 'pre_sales.lead.convert',
      status: 'SUCCESS',
      message: `Lead ${company.id} convertido em oportunidade`,
      data: {
        leadId: company.id,
        externalLeadId,
        opportunityId: opportunity.id,
        externalOpportunityId
      }
    });

    const webhookResult = await enqueueWebhookDeliveries({
      integrationId,
      eventType: 'opportunity_created',
      payload: {
        leadId: company.id,
        externalLeadId,
        opportunityId: opportunity.id,
        externalOpportunityId,
        value: opportunity.value,
        stage: opportunity.stage
      },
      correlationId: req.correlationId,
      idempotencyKey: req.headers['idempotency-key']
    });

    return res.status(201).json({
      data: {
        opportunity,
        webhooks: webhookResult
      }
    });
  })
);

v1Router.post(
  '/events/:eventType',
  requireIntegrationScopes('webhooks:write'),
  withIdempotency('events.emit', async (req, res) => {
    const eventType = normalizeString(req.params.eventType, 120);
    if (!eventType || !WEBHOOK_EVENT_TYPES.has(eventType)) {
      return sendError(res, 400, 'EVENT_TYPE_INVALID', 'Tipo de evento inválido para emissão.', req.correlationId);
    }

    const payload = req.body && typeof req.body === 'object' ? req.body : {};

    const result = await enqueueWebhookDeliveries({
      integrationId: req.integration.id,
      eventType,
      payload,
      correlationId: req.correlationId,
      idempotencyKey: req.headers['idempotency-key']
    });

    return res.status(202).json({ data: result });
  })
);

router.use('/v1', v1Router);

router.use((req, res) => {
  return sendError(res, 404, 'INTEGRATION_ROUTE_NOT_FOUND', 'Rota de integração não encontrada.', req.correlationId);
});

router.use((error, req, res, next) => {
  console.error('Erro na API de integração:', error);

  if (error?.type === 'entity.parse.failed') {
    return sendError(res, 400, 'INVALID_JSON', 'JSON inválido no corpo da requisição.', req.correlationId);
  }

  return sendError(
    res,
    500,
    'INTEGRATION_API_INTERNAL_ERROR',
    'Erro interno da API de integração.',
    req.correlationId,
    { message: error.message }
  );
});

module.exports = router;
