#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const ALLOWED_ROLES = new Set([
  'MASTER',
  'ADMIN',
  'MANAGER',
  'DIRECTOR',
  'SELLER',
  'USER',
  'PRE_SALES'
]);

const ALLOWED_COMPANY_STATUS = new Set([
  'LEAD',
  'PROSPECT',
  'ACTIVE',
  'INACTIVE',
  'CHURNED'
]);

const ALLOWED_STAGES = new Set([
  'LEAD',
  'QUALIFICATION',
  'DIAGNOSIS',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST'
]);

const ALLOWED_SOURCES = new Set([
  'WEBSITE',
  'WHATSAPP',
  'PHONE',
  'EMAIL',
  'REFERRAL',
  'CAMPAIGN',
  'MANUAL'
]);

const toObject = (value) => {
  if (!value || typeof value !== 'object') return null;
  return value;
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const normalizeRole = (value) => {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/-/g, '_');

  const mapped = {
    MASTER: 'MASTER',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    DIRECTOR: 'DIRECTOR',
    SELLER: 'SELLER',
    USUARIO: 'USER',
    USER: 'USER',
    PREVENDAS: 'PRE_SALES',
    PRE_VENDAS: 'PRE_SALES',
    PRE_SALES: 'PRE_SALES'
  }[raw] || raw;

  return ALLOWED_ROLES.has(mapped) ? mapped : 'USER';
};

const roleForRestore = (normalizedRole) => {
  // Evita falha de permissão quando o restore é executado por ADMIN.
  if (normalizedRole === 'MASTER') return 'ADMIN';
  return normalizedRole;
};

const normalizeCompanyStatus = (value) => {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const mapped = {
    LEAD: 'LEAD',
    PROSPECT: 'PROSPECT',
    ACTIVE: 'ACTIVE',
    ATIVA: 'ACTIVE',
    ATIVO: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    INATIVA: 'INACTIVE',
    INATIVO: 'INACTIVE',
    CHURNED: 'CHURNED',
    PERDIDO: 'CHURNED'
  }[raw] || raw;

  return ALLOWED_COMPANY_STATUS.has(mapped) ? mapped : 'ACTIVE';
};

const normalizeStage = (value, decisionValue = '') => {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (ALLOWED_STAGES.has(raw)) return raw;
  if (raw.includes('NEGOCI')) return 'NEGOTIATION';
  if (raw.includes('PROPOSTA')) return 'PROPOSAL';
  if (raw.includes('ANAL')) return 'DIAGNOSIS';
  if (raw.includes('QUAL')) return 'QUALIFICATION';
  if (raw.includes('GANH')) return 'WON';
  if (raw.includes('PERD')) return 'LOST';

  const decision = String(decisionValue || '').trim().toUpperCase();
  if (decision === 'GO') return 'PROPOSAL';
  if (decision === 'NO GO' || decision === 'NOGO' || decision === 'NO_GO') return 'LOST';

  return 'LEAD';
};

const normalizeSource = (value) => {
  const raw = String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (ALLOWED_SOURCES.has(raw)) return raw;
  if (!raw) return undefined;
  if (raw.includes('WHATSAPP')) return 'WHATSAPP';
  if (raw.includes('PHONE') || raw.includes('TELEFONE') || raw.includes('LIGACAO')) return 'PHONE';
  if (raw.includes('EMAIL')) return 'EMAIL';
  if (raw.includes('SITE') || raw.includes('WEB')) return 'WEBSITE';
  if (raw.includes('CAMPANHA') || raw.includes('CAMPAIGN')) return 'CAMPAIGN';
  if (raw.includes('INDIC')) return 'REFERRAL';
  return 'MANUAL';
};

const asNumber = (value, fallback = 0) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return fallback;
  return numberValue;
};

const clampProbability = (value) => {
  const numeric = asNumber(value, 50);
  if (numeric < 0) return 0;
  if (numeric > 100) return 100;
  return Math.round(numeric);
};

const pickIsoDate = (...values) => {
  for (const value of values) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return null;
};

const parseTableRecords = (tableRows) => {
  if (!Array.isArray(tableRows)) return [];

  return tableRows
    .map((row) => {
      const asObj = toObject(row);
      if (!asObj) return null;
      if (toObject(asObj.data)) return asObj.data;
      if (typeof asObj.data === 'string') {
        try {
          return JSON.parse(asObj.data);
        } catch {
          return null;
        }
      }
      return null;
    })
    .filter((item) => toObject(item));
};

const buildTargetBackup = (sourceJson, sourceFileName) => {
  const tables = toObject(sourceJson?.tables) || {};
  const rawUsers = parseTableRecords(tables.users);
  const rawCompanies = parseTableRecords(tables.companies);
  const rawOpportunities = parseTableRecords(tables.opportunities);

  const usersByEmail = new Map();
  let downgradedMasterRoles = 0;
  for (const raw of rawUsers) {
    const email = normalizeEmail(raw.email);
    const name = String(raw.name || '').trim();
    if (!email || !name) continue;

    if (!usersByEmail.has(email)) {
      const normalizedRole = normalizeRole(raw.role);
      const role = roleForRestore(normalizedRole);
      if (normalizedRole === 'MASTER' && role !== 'MASTER') {
        downgradedMasterRoles += 1;
      }

      usersByEmail.set(email, {
        id: raw.id || undefined,
        name,
        email,
        role,
        active: !String(raw.status || '').toLowerCase().includes('inativ'),
        companyId: raw.companyId || null
      });
    }
  }
  const users = [...usersByEmail.values()];
  const validUserIds = new Set(users.map((user) => String(user.id || '')).filter(Boolean));
  const defaultOwnerId =
    users.find((user) => user.role === 'MASTER')?.id ||
    users.find((user) => user.role === 'ADMIN')?.id ||
    users[0]?.id ||
    null;

  const companiesById = new Map();
  for (const raw of rawCompanies) {
    if (!raw.id || !raw.name) continue;
    companiesById.set(String(raw.id), {
      id: raw.id,
      name: String(raw.name || '').trim(),
      document: raw.document || raw.cnpj || null,
      email: raw.email || null,
      phone: raw.phone || null,
      status: normalizeCompanyStatus(raw.status),
      segment: raw.segment || null,
      leadScore: asNumber(raw.leadScore, 0),
      notes: raw.notes || null
    });
  }
  const companies = [...companiesById.values()];
  const validCompanyIds = new Set(companies.map((company) => String(company.id)));

  let opportunitiesSkipped = 0;
  const opportunities = [];

  for (const raw of rawOpportunities) {
    const companyId = String(raw.companyId || '').trim();
    if (!companyId || !validCompanyIds.has(companyId)) {
      opportunitiesSkipped += 1;
      continue;
    }

    const candidateOwnerId = String(raw.ownerId || raw.createdByUserId || '').trim();
    const ownerId = validUserIds.has(candidateOwnerId) ? candidateOwnerId : defaultOwnerId;
    if (!ownerId) {
      opportunitiesSkipped += 1;
      continue;
    }

    const title =
      String(raw.title || '').trim() ||
      String(raw.projectName || '').trim() ||
      String(raw.processNumber || '').trim() ||
      String(raw.objectSummary || '').trim() ||
      `Oportunidade ${raw.id || ''}`.trim();

    const projectName =
      String(raw.projectName || '').trim() ||
      title;

    const description =
      String(raw.description || '').trim() ||
      String(raw.objectDetailed || '').trim() ||
      String(raw.objectSummary || '').trim() ||
      null;

    const value = asNumber(
      raw.value,
      asNumber(
        raw.estimatedValue,
        asNumber(raw.estimatedOneTimeValue, asNumber(raw.maxAcceptableValue, 0))
      )
    );

    opportunities.push({
      id: raw.id || undefined,
      title,
      projectName,
      description,
      value,
      probability: clampProbability(raw.probability ?? raw.winProbability),
      stage: normalizeStage(raw.stage || raw.currentPhase, raw.decision),
      b2gStage: raw.b2gStage || raw.currentPhase || null,
      source: normalizeSource(raw.source || raw.sourcePortal || raw.opportunityRegistrationPortal),
      expectedCloseDate: pickIsoDate(
        raw.expectedCloseDate,
        raw.proposalDeadline,
        raw.estimatedValidity,
        raw.openingDate,
        raw.publicationDate
      ),
      companyId,
      ownerId
    });
  }

  const output = {
    generatedAt: new Date().toISOString(),
    generatedBy: {
      id: null,
      name: 'Conversor Backup->B2G',
      email: null,
      role: 'SYSTEM'
    },
    settings: {
      appName: 'CRM B2G',
      logoUrl: null
    },
    modules: {
      users,
      regions: [],
      companies,
      opportunities,
      activities: [],
      products: [],
      priceTables: [],
      crossSell: [],
      upSell: [],
      approvals: []
    },
    metadata: {
      sourceFile: sourceFileName,
      sourceVersion: sourceJson?.version ?? null,
      sourceType: sourceJson?.source ?? null,
      exportedAt: sourceJson?.exportedAt ?? null,
      inputCounts: {
        users: rawUsers.length,
        companies: rawCompanies.length,
        opportunities: rawOpportunities.length
      },
      outputCounts: {
        users: users.length,
        companies: companies.length,
        opportunities: opportunities.length
      },
      skipped: {
        opportunities: opportunitiesSkipped
      },
      transforms: {
        masterRolesDowngradedToAdmin: downgradedMasterRoles
      }
    }
  };

  return output;
};

const main = () => {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];

  if (!inputPath) {
    console.error('Uso: node scripts/prepare-b2g-upload-backup.mjs <arquivo-entrada.json> [arquivo-saida.json]');
    process.exit(1);
  }

  const sourceRaw = fs.readFileSync(inputPath, 'utf8');
  const sourceJson = JSON.parse(sourceRaw);

  const built = buildTargetBackup(sourceJson, path.basename(inputPath));

  const defaultOutputPath = path.join(
    process.cwd(),
    'backups-preparados',
    path.basename(inputPath).replace(/\.json$/i, '.b2g-ready.json')
  );
  const finalOutputPath = outputPath ? path.resolve(outputPath) : defaultOutputPath;

  fs.mkdirSync(path.dirname(finalOutputPath), { recursive: true });
  fs.writeFileSync(finalOutputPath, JSON.stringify(built, null, 2));

  console.log('Arquivo preparado com sucesso.');
  console.log(`Entrada : ${path.resolve(inputPath)}`);
  console.log(`Saída   : ${finalOutputPath}`);
  console.log(
    `Resumo  : users=${built.modules.users.length}, companies=${built.modules.companies.length}, opportunities=${built.modules.opportunities.length}, oppsPuladas=${built.metadata.skipped.opportunities}`
  );
};

main();
