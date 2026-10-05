const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Prisma } = require('@prisma/client');
const { prisma } = require('../lib/prisma.cjs');
const { requireRole } = require('../lib/auth.cjs');

const router = express.Router();

const uploadsRoot = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const migrationsPath = path.join(__dirname, '..', 'prisma', 'migrations');
const DEFAULT_UPLOAD_CONTENT_LIMIT = 100 * 1024 * 1024;

const normalizeRole = (user = {}) => String(user.actualRole || user.role || '').trim().toUpperCase();
const canManageFullBackup = (user = {}) => {
  const role = normalizeRole(user);
  return role === 'MASTER' || role === 'ADMIN';
};
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const escapeIdentifier = (value) => `"${String(value).replace(/"/g, '""')}"`;
const escapeLiteral = (value) => `'${String(value).replace(/'/g, "''")}'`;

const jsonReplacer = (_key, value) => {
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  return value;
};

const getUploadContentLimit = () => {
  const configured = Number(process.env.BACKUP_MAX_UPLOAD_BYTES || DEFAULT_UPLOAD_CONTENT_LIMIT);
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_UPLOAD_CONTENT_LIMIT;
};

const getPrismaModels = () => {
  try {
    return (Prisma.dmmf?.datamodel?.models || []).map((model) => ({
      name: model.name,
      tableName: model.dbName || model.name,
      fields: model.fields.map((field) => ({
        name: field.name,
        kind: field.kind,
        type: field.type,
        isList: Boolean(field.isList),
        isRequired: Boolean(field.isRequired),
        isId: Boolean(field.isId),
        relationName: field.relationName || null
      }))
    }));
  } catch {
    return [];
  }
};

// Todas as tabelas que devem ser incluídas no backup/restore
// Inclui: Prisma models + tabelas B2G + tabelas SIMULADOR
const B2G_TABLES = [
  'gerenciadas_licitacao',
  'alertas_licitacao',
  'editais_analisados',
  'licitacoes_pncp'
];

const SIMULATOR_TABLES = [
  'simulator_proposal',
  'simulator_licitacao'
];

// Mapa de módulos: tableName (minúsculo) → módulo
// Usado para agrupar logs de backup/restore por módulo funcional
const MODULES_MAP = {
  // ── B2B Core ───────────────────────────────────────────────────────────────
  'User':                      'B2B Core',
  'TenantCompany':             'B2B Core',
  'LicensePlan':               'B2B Core',
  'CompanyLicense':            'B2B Core',
  'PendingSubscription':       'B2B Core',
  'Region':                    'B2B Core',
  'SystemSetting':             'B2B Core',

  // ── CRM (clientes, pipeline, propostas) ───────────────────────────────────
  'Company':                   'CRM',
  'Contact':                   'CRM',
  'Opportunity':               'CRM',
  'OpportunityProduct':        'CRM',
  'OpportunityFollowUp':       'CRM',
  'OpportunityAttentionPoint': 'CRM',
  'OpportunityLearning':       'CRM',
  'Activity':                  'CRM',
  'Proposal':                  'CRM',
  'ProposalTemplate':          'CRM',
  'ProposalItem':              'CRM',
  'Commission':                'CRM',
  'SalesTarget':               'CRM',
  'Contract':                  'CRM',
  'CompanyDocument':           'CRM',
  'Product':                   'CRM',
  'TeamBonusDistribution':     'CRM',

  // ── B2G ────────────────────────────────────────────────────────────────────
  'GerenciadaLicitacao':       'B2G',
  'AlertaLicitacao':           'B2G',
  'EditalAnalisado':           'B2G',
  'LicitacaoPncp':             'B2G',
  'gerenciadas_licitacao':     'B2G',
  'alertas_licitacao':         'B2G',
  'editais_analisados':        'B2G',
  'licitacoes_pncp':           'B2G',
  'BidNotice':                 'B2G',
  'BidNoticeHistory':          'B2G',
  'SavedAnalysis':             'B2G',

  // ── SIMULADOR ──────────────────────────────────────────────────────────────
  'SimulatorProposal':         'SIMULADOR',
  'SimulatorLicitacao':        'SIMULADOR',
  'simulator_proposal':        'SIMULADOR',
  'simulator_licitacao':       'SIMULADOR',

  // ── PRÉ-VENDAS ─────────────────────────────────────────────────────────────
  'PreSalesRequest':           'PRÉ-VENDAS',
  'PreSalesItem':              'PRÉ-VENDAS',
  'PreSalesApproval':          'PRÉ-VENDAS',
  'PreSalesPoc':               'PRÉ-VENDAS',
  'PreSalesPocFollowUp':       'PRÉ-VENDAS',

  // ── PROJETOS ───────────────────────────────────────────────────────────────
  'Project':                   'PROJETOS',
  'ProjectPhase':              'PROJETOS',
  'ProjectTask':               'PROJETOS',
  'ProjectTeam':               'PROJETOS',
  'ProjectTimelog':            'PROJETOS',
  'ProjectMilestone':          'PROJETOS',
  'ProjectRisk':               'PROJETOS',
  'ProjectIssue':              'PROJETOS',
  'ProjectAttachment':         'PROJETOS',
  'ProjectChangeRequest':      'PROJETOS',
  'ProjectBilling':            'PROJETOS',
  'ProjectAcceptance':         'PROJETOS',
  'ProjectB2GConfig':          'PROJETOS',
  'ProjectB2BConfig':          'PROJETOS',

  // ── KICKOFF ────────────────────────────────────────────────────────────────
  'KickoffMeeting':            'KICKOFF',
  'KickoffParticipant':        'KICKOFF',
  'KickoffAgendaItem':         'KICKOFF',
  'KickoffChecklistItem':      'KICKOFF',
  'KickoffActionItem':         'KICKOFF',
  'KickoffHistory':            'KICKOFF',
  'KickoffTemplate':           'KICKOFF',

  // ── GESTÃO (Workflows, Notificações, Auditoria) ────────────────────────────
  'Workflow':                  'GESTÃO',
  'WorkflowExecution':         'GESTÃO',
  'ApprovalRequest':           'GESTÃO',
  'ApprovalStep':              'GESTÃO',
  'Notification':              'GESTÃO',
  'AuditLog':                  'GESTÃO',
  'audit_logs':                'GESTÃO',
  'IntegrationOrder':          'GESTÃO',
  'IntegrationConfig':         'GESTÃO',

  // ── PÓS-VENDAS (Onboarding, Suporte, Churn, NPS) ─────────────────────────
  'CustomerOnboarding':        'PÓS-VENDAS',
  'SupportTicket':             'PÓS-VENDAS',
  'TicketResponse':            'PÓS-VENDAS',
  'NPSSurvey':                 'PÓS-VENDAS',
  'ChurnAlert':                'PÓS-VENDAS',
};

/**
 * Classifica uma lista de tabelas por módulo e retorna o resumo.
 * Cada entrada: { module, tables: [{tableName, rows?, restoredRows?}], totalRows }
 */
const buildModulesSummary = (tablesData) => {
  const moduleMap = {};

  for (const entry of tablesData) {
    const tn = entry.tableName || entry.name || '';
    const module = MODULES_MAP[tn] || MODULES_MAP[tn.toLowerCase()] || 'OUTROS';
    if (!moduleMap[module]) {
      moduleMap[module] = { module, tables: [], totalRows: 0, tableCount: 0 };
    }
    const rows = entry.restoredRows ?? entry.count ?? entry.rows ?? 0;
    const rowCount = typeof rows === 'number' ? rows : (Array.isArray(rows) ? rows.length : 0);
    moduleMap[module].tables.push({
      tableName: tn,
      rows: rowCount
    });
    moduleMap[module].totalRows += rowCount;
    moduleMap[module].tableCount += 1;
  }

  // Ordenar: módulos conhecidos primeiro, depois OUTROS
  const order = ['B2B Core', 'CRM', 'B2G', 'SIMULADOR', 'PRÉ-VENDAS', 'PROJETOS', 'KICKOFF', 'GESTÃO', 'PÓS-VENDAS', 'OUTROS'];
  return Object.values(moduleMap).sort((a, b) => {
    const ai = order.indexOf(a.module);
    const bi = order.indexOf(b.module);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
};

/**
 * Imprime o resumo de módulos no console em formato legível.
 * @param {'BACKUP'|'RESTORE'} operation
 * @param {Array} modulesSummary - resultado de buildModulesSummary()
 * @param {number} totalRows
 * @param {number} totalTables
 */
const logModulesSummary = (operation, modulesSummary, totalRows, totalTables) => {
  const label = operation === 'BACKUP' ? 'EXPORTAÇÃO' : 'RESTAURAÇÃO';
  const sep = '─'.repeat(60);
  console.log(`\n[Backup ${label}] ${sep}`);
  console.log(`[Backup ${label}] Módulos incluídos no ${operation.toLowerCase()}:`);
  console.log(`[Backup ${label}] ${sep}`);

  for (const mod of modulesSummary) {
    const tableList = mod.tables.map(t => `${t.tableName}(${t.rows})`).join(', ');
    const icon = mod.totalRows > 0 ? '✓' : '○';
    console.log(`[Backup ${label}]   ${icon} ${mod.module.padEnd(14)} ${mod.tableCount} tabelas | ${String(mod.totalRows).padStart(6)} registros`);
    console.log(`[Backup ${label}]       → ${tableList}`);
  }

  console.log(`[Backup ${label}] ${sep}`);
  console.log(`[Backup ${label}] TOTAL: ${totalTables} tabelas | ${totalRows} registros`);
  console.log(`[Backup ${label}] ${sep}\n`);
};

const listDatabaseTables = async () => {
  try {
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `;

    const names = (Array.isArray(tables) ? tables : [])
      .map((row) => row.table_name || row.tableName)
      .filter(Boolean);

    if (names.length > 0) {
      // Garantir que todas as tabelas B2G e SIMULADOR estejam na lista
      const nameSet = new Set(names.map(n => n.toLowerCase()));
      const missingTables = [...B2G_TABLES, ...SIMULATOR_TABLES]
        .filter(t => !nameSet.has(t.toLowerCase()));
      
      if (missingTables.length > 0) {
        console.warn(`[Backup] Adicionando tabelas faltantes ao backup: ${missingTables.join(', ')}`);
        return [...names, ...missingTables];
      }
      return names;
    }
  } catch (err) {
    console.warn('[Backup] Falha ao listar tabelas via information_schema, usando lista fixa:', err.message);
  }

  // Combinar modelos Prisma com tabelas B2G e SIMULADOR
  const models = getPrismaModels();
  const prismaTableNames = models.map((m) => m.tableName);
  
  // Remover duplicatas e adicionar faltantes
  const allTables = new Set([
    ...prismaTableNames,
    ...B2G_TABLES,
    ...SIMULATOR_TABLES
  ]);

  return Array.from(allTables).sort();
};

const readDatabaseTables = async () => {
  const tableNames = await listDatabaseTables();
  const tables = {};
  const tableStats = [];
  let totalRows = 0;

  console.log(`[Backup EXPORTAÇÃO] Iniciando leitura de ${tableNames.length} tabelas...`);

  for (const tableName of tableNames) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${escapeIdentifier(tableName)}`);
      const safeRows = Array.isArray(rows) ? rows : [];
      tables[tableName] = {
        count: safeRows.length,
        rows: safeRows
      };
      tableStats.push({ tableName, count: safeRows.length });
      totalRows += safeRows.length;
    } catch (err) {
      console.warn(`[Backup Export] Aviso ao ler tabela ${tableName}:`, err.message);
      tables[tableName] = { count: 0, rows: [] };
      tableStats.push({ tableName, count: 0 });
    }
  }

  // Log agrupado por módulo
  const modulesSummary = buildModulesSummary(tableStats);
  logModulesSummary('BACKUP', modulesSummary, totalRows, tableNames.length);

  return { tableNames, tables, totalRows, modulesSummary };
};

const summarizeDatabaseTables = async () => {
  const tableNames = await listDatabaseTables();
  const tables = [];
  let totalRows = 0;

  for (const tableName of tableNames) {
    try {
      const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM ${escapeIdentifier(tableName)}`);
      const count = Number(result?.[0]?.count || 0);
      tables.push({ tableName, count });
      totalRows += count;
    } catch {
      tables.push({ tableName, count: 0 });
    }
  }

  return { tables, totalRows };
};

const fileSha256 = async (filePath) => {
  const hash = crypto.createHash('sha256');
  const data = await fs.readFile(filePath);
  hash.update(data);
  return { hash: hash.digest('hex'), data };
};

const walkUploads = async (dir, options, state) => {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    const relativePath = path.relative(uploadsRoot, absolutePath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      await walkUploads(absolutePath, options, state);
      continue;
    }

    if (!entry.isFile()) continue;

    const stats = await fs.stat(absolutePath);
    state.totalFiles += 1;
    state.totalBytes += stats.size;

    const file = {
      path: relativePath,
      size: stats.size,
      mtime: stats.mtime.toISOString(),
      sha256: null,
      contentBase64: null
    };

    if (options.includeContents && state.includedBytes + stats.size <= options.contentLimit) {
      const { hash, data } = await fileSha256(absolutePath);
      file.sha256 = hash;
      file.contentBase64 = data.toString('base64');
      state.includedBytes += stats.size;
    } else {
      const { hash } = await fileSha256(absolutePath);
      file.sha256 = hash;
      if (options.includeContents) {
        state.omittedFiles += 1;
      }
    }

    state.files.push(file);
  }
};

const collectUploads = async ({ includeContents }) => {
  const state = {
    root: 'uploads',
    absoluteRoot: uploadsRoot,
    totalFiles: 0,
    totalBytes: 0,
    includedBytes: 0,
    omittedFiles: 0,
    files: []
  };

  await walkUploads(
    uploadsRoot,
    {
      includeContents,
      contentLimit: getUploadContentLimit()
    },
    state
  );

  return {
    root: state.root,
    totalFiles: state.totalFiles,
    totalBytes: state.totalBytes,
    includedBytes: state.includedBytes,
    omittedFiles: state.omittedFiles,
    files: state.files,
    warning: state.omittedFiles
      ? `${state.omittedFiles} arquivo(s) ficaram somente no manifesto por limite de tamanho. Ajuste BACKUP_MAX_UPLOAD_BYTES para incluir tudo.`
      : null
  };
};

const readSystemMetadata = async () => {
  const [schema, migrations] = await Promise.all([
    fs.readFile(schemaPath, 'utf8').catch(() => null),
    fs.readdir(migrationsPath, { withFileTypes: true })
      .then((entries) =>
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name)
          .sort()
      )
      .catch(() => [])
  ]);

  return {
    prismaSchema: schema,
    prismaMigrations: migrations,
    prismaModels: getPrismaModels()
  };
};

const normalizeBackupTables = (backup) => {
  const rawTables = backup?.database?.tables;
  if (rawTables && typeof rawTables === 'object' && !Array.isArray(rawTables)) {
    return Object.entries(rawTables).map(([tableName, payload]) => {
      const rows = Array.isArray(payload?.rows) ? payload.rows : (Array.isArray(payload) ? payload : []);
      return { tableName, rows };
    });
  }

  // Suporte a formato modular ({ modules: { users, companies, products, ... } })
  if (backup?.modules && typeof backup.modules === 'object') {
    const moduleToTable = {
      users: 'User',
      companies: 'Company',
      products: 'Product',
      opportunities: 'Opportunity',
      activities: 'Activity',
      regions: 'Region',
      priceTables: 'PriceTable',
      crossSell: 'CrossSellRule',
      upSell: 'UpSellRule',
      approvals: 'Approval'
    };

    const tables = [];
    for (const [modKey, tableName] of Object.entries(moduleToTable)) {
      const raw = backup.modules[modKey];
      let rows = [];
      if (Array.isArray(raw)) rows = raw;
      else if (raw && typeof raw === 'object') {
        if (Array.isArray(raw.data)) rows = raw.data;
        else if (Array.isArray(raw.items)) rows = raw.items;
      }
      if (rows.length > 0) {
        tables.push({ tableName, rows });
      }
    }

    if (tables.length > 0) {
      return tables;
    }
  }

  throw new Error('Arquivo de backup inválido: tabelas do banco ou módulos não encontrados no formato esperado.');
};

const readForeignKeyDependencies = async () => {
  try {
    const rows = await prisma.$queryRaw`
      SELECT
        tc.table_name AS table_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
    `;

    return (Array.isArray(rows) ? rows : [])
      .map((row) => ({
        tableName: row.table_name || row.tableName,
        dependsOn: row.foreign_table_name || row.foreignTableName
      }))
      .filter((row) => row.tableName && row.dependsOn && row.tableName !== row.dependsOn);
  } catch (err) {
    console.warn('[Backup Restore] Aviso ao ler dependências FK:', err.message);
    return [];
  }
};

const orderTablesForInsert = async (tableNames) => {
  const tableSet = new Set(tableNames);
  const dependencies = await readForeignKeyDependencies();
  const dependencyMap = new Map(tableNames.map((tableName) => [tableName, new Set()]));

  for (const dependency of dependencies) {
    if (!tableSet.has(dependency.tableName) || !tableSet.has(dependency.dependsOn)) continue;
    dependencyMap.get(dependency.tableName)?.add(dependency.dependsOn);
  }

  const ordered = [];
  const temporary = new Set();
  const permanent = new Set();

  const visit = (tableName) => {
    if (permanent.has(tableName)) return;
    if (temporary.has(tableName)) return;

    temporary.add(tableName);
    for (const dependency of dependencyMap.get(tableName) || []) {
      visit(dependency);
    }
    temporary.delete(tableName);
    permanent.add(tableName);
    ordered.push(tableName);
  };

  tableNames.forEach(visit);
  return ordered;
};

const readColumnTypes = async (tableNames) => {
  if (!Array.isArray(tableNames) || tableNames.length === 0) return new Map();

  const tableListSql = tableNames.map(escapeLiteral).join(', ');
  const result = new Map();

  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        table_name AS "tableName",
        column_name AS "columnName",
        data_type AS "dataType",
        udt_schema AS "udtSchema",
        udt_name AS "udtName"
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (${tableListSql})
    `);

    for (const row of (Array.isArray(rows) ? rows : [])) {
      if (!row.tableName || !row.columnName) continue;
      if (!result.has(row.tableName)) result.set(row.tableName, new Map());
      result.get(row.tableName).set(row.columnName, {
        dataType: String(row.dataType || '').toLowerCase(),
        udtSchema: row.udtSchema || null,
        udtName: row.udtName || null
      });
    }
  } catch (err) {
    console.warn('[Backup Restore] Aviso ao obter tipos das colunas:', err.message);
  }

  return result;
};

const buildRestorePlaceholder = (index, columnType) => {
  const placeholder = `$${index}`;
  if (!columnType) return placeholder;

  const dataType = String(columnType.dataType || '').toLowerCase();
  const udtName = columnType.udtName;

  switch (dataType) {
    case 'timestamp without time zone':
      return `${placeholder}::timestamp`;
    case 'timestamp with time zone':
      return `${placeholder}::timestamptz`;
    case 'date':
      return `${placeholder}::date`;
    case 'time without time zone':
      return `${placeholder}::time`;
    case 'time with time zone':
      return `${placeholder}::timetz`;
    case 'json':
      return `${placeholder}::json`;
    case 'jsonb':
      return `${placeholder}::jsonb`;
    case 'uuid':
      return `${placeholder}::uuid`;
    case 'bytea':
      return `${placeholder}::bytea`;
    case 'bigint':
      return `${placeholder}::bigint`;
    case 'integer':
      return `${placeholder}::integer`;
    case 'smallint':
      return `${placeholder}::smallint`;
    case 'double precision':
      return `${placeholder}::double precision`;
    case 'real':
      return `${placeholder}::real`;
    case 'numeric':
      return `${placeholder}::numeric`;
    case 'boolean':
      return `${placeholder}::boolean`;
    case 'array': {
      const rawElem = udtName && udtName.startsWith('_') ? udtName.slice(1) : 'text';
      const cleanElem = rawElem.replace(/[^a-zA-Z0-9_]/g, '');
      return `${placeholder}::${cleanElem}[]`;
    }
    case 'user-defined': {
      if (udtName) {
        const cleanUdt = udtName.replace(/[^a-zA-Z0-9_]/g, '');
        return `${placeholder}::${cleanUdt}`;
      }
      return placeholder;
    }
    default:
      return placeholder;
  }
};

const normalizeRestoreValue = (value, columnType) => {
  if (value === undefined || value === null) return null;

  const dataType = String(columnType?.dataType || '').toLowerCase();

  // Se string vazia em coluna que não é texto, converter para null para evitar erro de sintaxe SQL
  if (typeof value === 'string' && value.trim() === '') {
    const isTextual = dataType === 'text' || dataType === 'character varying' || dataType === 'character';
    if (!isTextual) {
      return null;
    }
  }

  // Converter Buffer serializado
  if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }

  // Bytea
  if (dataType === 'bytea' && typeof value === 'string') {
    return Buffer.from(value, 'base64');
  }

  // JSON e JSONB: garantir formato JSON válido sem dupla serialização
  if (dataType === 'json' || dataType === 'jsonb') {
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'string') {
      try {
        JSON.parse(value);
        return value;
      } catch {
        return JSON.stringify(value);
      }
    }
    return JSON.stringify(value);
  }

  // Booleans
  if (dataType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    return Boolean(value);
  }

  // Numéricos
  if (['integer', 'bigint', 'smallint', 'numeric', 'double precision', 'real'].includes(dataType)) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsedNum = Number(value);
      return Number.isFinite(parsedNum) ? parsedNum : null;
    }
    return null;
  }

  // Arrays (ex.: String[])
  if (dataType === 'array') {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  }

  return value;
};

const insertRows = async (tx, tableName, rows, columnTypes = new Map()) => {
  let inserted = 0;

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;

    const rawColumns = Object.keys(row);
    // Filtrar apenas colunas que realmente existem na tabela de destino quando columnTypes estiver disponível
    const columns = columnTypes.size > 0 ? rawColumns.filter((column) => columnTypes.has(column)) : rawColumns;
    if (columns.length === 0) continue;

    const placeholders = columns
      .map((column, index) => buildRestorePlaceholder(index + 1, columnTypes.get(column)))
      .join(', ');
    const columnSql = columns.map(escapeIdentifier).join(', ');
    const values = columns.map((column) => normalizeRestoreValue(row[column], columnTypes.get(column)));

    try {
      await tx.$executeRawUnsafe(
        `INSERT INTO ${escapeIdentifier(tableName)} (${columnSql}) VALUES (${placeholders})`,
        ...values
      );
      inserted += 1;
    } catch (insertErr) {
      console.warn(`[Backup Restore] Linha ignorada com erro na tabela ${tableName}:`, insertErr.message);
      // Se a falha for chave duplicada, continua restaurando as demais
      if (!insertErr.message.includes('unique constraint') && !insertErr.message.includes('duplicate key')) {
        throw new Error(`Erro ao restaurar dados na tabela "${tableName}": ${insertErr.message}`);
      }
    }
  }

  return inserted;
};

const restoreDatabase = async (backupTables) => {
  const currentTablesList = await listDatabaseTables();
  const currentTableMap = new Map();
  for (const t of currentTablesList) {
    currentTableMap.set(String(t).toLowerCase(), t);
  }

  const tableByName = new Map();
  const validTableNames = [];
  const skippedTables = [];

  for (const table of backupTables) {
    const matched = currentTableMap.get(String(table.tableName).toLowerCase());
    if (matched) {
      validTableNames.push(matched);
      tableByName.set(matched, table);
    } else {
      skippedTables.push(table.tableName);
    }
  }

  if (skippedTables.length > 0) {
    console.warn(`[Backup RESTAURAÇÃO] Tabelas do backup ausentes no banco (ignoradas): ${skippedTables.join(', ')}`);
  }

  if (validTableNames.length === 0) {
    throw new Error('Nenhuma tabela do arquivo de backup corresponde às tabelas existentes no banco de dados.');
  }

  console.log(`[Backup RESTAURAÇÃO] ${validTableNames.length} tabelas reconhecidas para restauração.`);

  const orderedTableNames = await orderTablesForInsert(validTableNames);
  const columnTypesByTable = await readColumnTypes(validTableNames);

  return prisma.$transaction(
    async (tx) => {
      // 1. Desativa temporariamente a verificação estrita de foreign keys
      await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED;").catch(() => {});
      await tx.$executeRawUnsafe("SET session_replication_role = 'replica';").catch(() => {});

      // 2. Limpa as tabelas existentes
      const truncateSql = validTableNames.map(escapeIdentifier).join(', ');
      try {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${truncateSql} RESTART IDENTITY CASCADE`);
        console.log(`[Backup RESTAURAÇÃO] Tabelas limpas (TRUNCATE CASCADE).`);
      } catch (truncateErr) {
        console.warn('[Backup RESTAURAÇÃO] TRUNCATE CASCADE falhou, usando DELETE:', truncateErr.message);
        for (const tableName of [...orderedTableNames].reverse()) {
          await tx.$executeRawUnsafe(`DELETE FROM ${escapeIdentifier(tableName)}`).catch(() => {});
        }
      }

      // 3. Insere os registros na ordem correta, logando cada tabela
      let restoredRows = 0;
      const tables = [];

      for (const tableName of orderedTableNames) {
        const sourceRows = tableByName.get(tableName)?.rows || [];
        const module = MODULES_MAP[tableName] || MODULES_MAP[tableName.toLowerCase()] || 'OUTROS';
        const insertedRows = await insertRows(tx, tableName, sourceRows, columnTypesByTable.get(tableName));
        restoredRows += insertedRows;
        tables.push({ tableName, restoredRows: insertedRows, module });

        // Log inline por tabela
        const icon = insertedRows > 0 ? '✓' : (sourceRows.length === 0 ? '○' : '⚠');
        console.log(
          `[Backup RESTAURAÇÃO]   ${icon} ${tableName.padEnd(38)} ${String(insertedRows).padStart(5)} registros  [${module}]`
        );
      }

      // 4. Sincroniza sequences numéricas
      try {
        await tx.$executeRawUnsafe(`
          DO $$
          DECLARE
            seq RECORD;
          BEGIN
            FOR seq IN
              SELECT sequence_name, table_name, column_name
              FROM information_schema.columns
              WHERE column_default LIKE 'nextval%'
                AND table_schema = 'public'
            LOOP
              BEGIN
                EXECUTE format(
                  'SELECT setval(%L, COALESCE((SELECT MAX(%I) FROM %I), 1))',
                  seq.sequence_name, seq.column_name, seq.table_name
                );
              EXCEPTION WHEN OTHERS THEN
                NULL;
              END;
            END LOOP;
          END $$;
        `);
      } catch (seqErr) {
        console.warn('[Backup RESTAURAÇÃO] Aviso ao sincronizar sequences:', seqErr.message);
      }

      // 5. Restaura o modo normal de replicação
      await tx.$executeRawUnsafe("SET session_replication_role = 'origin';").catch(() => {});

      // 6. Log final agrupado por módulo
      const modulesSummary = buildModulesSummary(
        tables.map(t => ({ tableName: t.tableName, restoredRows: t.restoredRows }))
      );
      logModulesSummary('RESTORE', modulesSummary, restoredRows, orderedTableNames.length);

      return {
        tableCount: orderedTableNames.length,
        totalRows: restoredRows,
        tables,
        modulesSummary,
        skippedTables
      };
    },
    {
      maxWait: 30000,
      timeout: Number(process.env.BACKUP_RESTORE_TIMEOUT_MS || 10 * 60 * 1000)
    }
  );
};

const readRestoreSessionAnchor = async (requestUser = {}) => {
  const userId = requestUser.id || requestUser.userId;
  if (!userId) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        role: true,
        regionId: true,
        quota: true,
        commissionSalePercentage: true,
        commissionProject12: true,
        commissionProject24: true,
        commissionProject36: true,
        commissionProject48: true,
        commissionProject60: true,
        tenantCompanyId: true,
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
        accessManagement: true,
        accessAutomation: true,
        permissionOverrides: true,
        isCompanyOwner: true,
        createdAt: true,
        tenantCompany: {
          select: {
            id: true,
            name: true,
            legalName: true,
            cnpj: true,
            email: true,
            phone: true,
            status: true,
            notes: true,
            accessB2B: true,
            accessB2G: true,
            accessPreSales: true,
            accessManagement: true,
            accessAutomation: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    });

    return user ? { user, tenantCompany: user.tenantCompany || null } : null;
  } catch (err) {
    console.warn('[Backup Restore] Aviso ao ler dados da sessão atual:', err.message);
    return null;
  }
};

const ensureRestoreSessionAnchor = async (anchor) => {
  if (!anchor?.user?.email) return { preserved: false, reason: 'empty_anchor' };

  try {
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizeEmail(anchor.user.email), mode: 'insensitive' } },
      select: { id: true, role: true }
    });

    if (existingUser) {
      const currentRole = normalizeRole(anchor.user);
      if ((currentRole === 'MASTER' || currentRole === 'ADMIN') && existingUser.role !== currentRole) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { role: currentRole }
        }).catch(() => {});
      }
      return { preserved: true, reason: 'user_exists_in_backup', user: existingUser };
    }

    let tenantCompanyId = null;
    const preservedTenant = anchor.tenantCompany;

    if (anchor.user.tenantCompanyId && preservedTenant?.id) {
      const existingTenantById = await prisma.tenantCompany.findUnique({
        where: { id: preservedTenant.id },
        select: { id: true }
      }).catch(() => null);

      if (existingTenantById) {
        tenantCompanyId = existingTenantById.id;
      } else {
        let cnpj = preservedTenant.cnpj || null;
        if (cnpj) {
          const existingTenantByCnpj = await prisma.tenantCompany.findUnique({
            where: { cnpj },
            select: { id: true }
          }).catch(() => null);
          if (existingTenantByCnpj) cnpj = null;
        }

        const createdTenant = await prisma.tenantCompany.create({
          data: {
            id: preservedTenant.id,
            name: preservedTenant.name,
            legalName: preservedTenant.legalName || null,
            cnpj,
            email: preservedTenant.email || null,
            phone: preservedTenant.phone || null,
            status: preservedTenant.status || 'ACTIVE',
            notes: preservedTenant.notes || null,
            accessB2B: Boolean(preservedTenant.accessB2B),
            accessB2G: Boolean(preservedTenant.accessB2G),
            accessPreSales: Boolean(preservedTenant.accessPreSales),
            accessManagement: Boolean(preservedTenant.accessManagement),
            accessAutomation: Boolean(preservedTenant.accessAutomation),
            createdAt: preservedTenant.createdAt ? new Date(preservedTenant.createdAt) : undefined,
            updatedAt: preservedTenant.updatedAt ? new Date(preservedTenant.updatedAt) : undefined
          },
          select: { id: true }
        }).catch((err) => {
          console.warn('[Backup Restore] Aviso ao recriar TenantCompany:', err.message);
          return null;
        });

        if (createdTenant) tenantCompanyId = createdTenant.id;
      }
    }

    let regionId = null;
    if (anchor.user.regionId) {
      const existingRegion = await prisma.region.findUnique({
        where: { id: anchor.user.regionId },
        select: { id: true }
      }).catch(() => null);
      if (existingRegion) regionId = existingRegion.id;
    }

    const role = normalizeRole(anchor.user);
    const preservedUser = await prisma.user.create({
      data: {
        name: anchor.user.name,
        email: normalizeEmail(anchor.user.email),
        password: anchor.user.password,
        role: role || 'MASTER',
        regionId,
        quota: anchor.user.quota,
        commissionSalePercentage: anchor.user.commissionSalePercentage,
        commissionProject12: anchor.user.commissionProject12,
        commissionProject24: anchor.user.commissionProject24,
        commissionProject36: anchor.user.commissionProject36,
        commissionProject48: anchor.user.commissionProject48,
        commissionProject60: anchor.user.commissionProject60,
        tenantCompanyId,
        accessB2B: Boolean(anchor.user.accessB2B),
        accessB2G: Boolean(anchor.user.accessB2G),
        accessPreSales: Boolean(anchor.user.accessPreSales),
        accessManagement: Boolean(anchor.user.accessManagement),
        accessAutomation: Boolean(anchor.user.accessAutomation),
        permissionOverrides: anchor.user.permissionOverrides || {},
        isCompanyOwner: Boolean(anchor.user.isCompanyOwner),
        createdAt: anchor.user.createdAt ? new Date(anchor.user.createdAt) : undefined
      },
      select: { id: true, email: true, role: true, tenantCompanyId: true }
    });

    return {
      preserved: true,
      user: {
        id: preservedUser.id,
        email: preservedUser.email,
        role: preservedUser.role,
        tenantCompanyId: preservedUser.tenantCompanyId
      }
    };
  } catch (err) {
    console.warn('[Backup Restore] Aviso ao recriar usuário de ancoragem da sessão:', err.message);
    return { preserved: false, reason: err.message };
  }
};

const resolveSafeUploadPath = (relativePath) => {
  const cleanRelativePath = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const absolutePath = path.resolve(uploadsRoot, cleanRelativePath);
  const root = path.resolve(uploadsRoot);

  if (absolutePath !== root && !absolutePath.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Caminho de upload inválido no backup: ${relativePath}`);
  }

  return absolutePath;
};

const restoreUploads = async (uploads) => {
  const files = Array.isArray(uploads?.files) ? uploads.files : [];
  let restoredFiles = 0;
  let skippedFiles = 0;
  let restoredBytes = 0;

  for (const file of files) {
    if (!file?.contentBase64) {
      skippedFiles += 1;
      continue;
    }

    try {
      const targetPath = resolveSafeUploadPath(file.path);
      const data = Buffer.from(String(file.contentBase64), 'base64');

      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, data);

      restoredFiles += 1;
      restoredBytes += data.length;
    } catch (err) {
      console.warn(`[Backup Restore] Aviso ao restaurar arquivo de upload ${file?.path}:`, err.message);
      skippedFiles += 1;
    }
  }

  return { restoredFiles, skippedFiles, restoredBytes };
};

router.use(requireRole(['ADMIN', 'MASTER']));
router.use((req, res, next) => {
  if (canManageFullBackup(req.user)) return next();
  return res.status(403).json({
    error: 'Backup completo restrito a usuários Admin ou Master.'
  });
});

router.get('/summary', async (_req, res) => {
  try {
    const [database, uploads, system] = await Promise.all([
      summarizeDatabaseTables(),
      collectUploads({ includeContents: false }),
      readSystemMetadata()
    ]);

    res.json({
      generatedAt: new Date().toISOString(),
      database: {
        tableCount: database.tables.length,
        totalRows: database.totalRows,
        tables: database.tables
      },
      uploads: {
        totalFiles: uploads.totalFiles,
        totalBytes: uploads.totalBytes
      },
      system: {
        prismaModelCount: system.prismaModels.length,
        prismaMigrationCount: system.prismaMigrations.length
      }
    });
  } catch (error) {
    console.error('Erro ao gerar resumo do backup:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar resumo do backup completo' });
  }
});

router.get('/routine-status', async (_req, res) => {
  try {
    const backupDir = '/var/backups/crmnexointegrator_v2';
    const logFile = '/var/log/crmnexointegrator_v2-backup.log';
    let files = [];
    let logSnippet = '';

    try {
      const dirEntries = await fs.readdir(backupDir, { withFileTypes: true });
      for (const entry of dirEntries) {
        if (entry.isFile() && (entry.name.endsWith('.dump') || entry.name.endsWith('.sql.gz'))) {
          const filePath = path.join(backupDir, entry.name);
          const stat = await fs.stat(filePath);
          files.push({
            name: entry.name,
            sizeBytes: stat.size,
            sizeFormatted: (stat.size / (1024 * 1024)).toFixed(2) + ' MB',
            createdAt: stat.birthtime || stat.mtime,
            modifiedAt: stat.mtime
          });
        }
      }
      files.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
    } catch (e) {
      // Directory may not exist in local dev
    }

    try {
      const logContent = await fs.readFile(logFile, 'utf-8');
      const lines = logContent.trim().split('\n');
      logSnippet = lines.slice(-15).join('\n');
    } catch (e) {
      logSnippet = 'Log ainda não gerado ou aguardando primeiro ciclo do cron.';
    }

    res.json({
      active: true,
      schedule: 'Segunda a Sexta às 17:00 (America/Sao_Paulo)',
      cronExpression: '0 17 * * 1-5',
      database: 'nexoscrm',
      databasePort: 5433,
      domain: 'nexosv2.chorstconsult.com.br',
      retentionDays: 30,
      backupDir,
      logFile,
      backupScript: '/var/www/crmnexointegrator_v2/scripts/backup-crmnexointegrator_v2.sh',
      restoreScript: '/var/www/crmnexointegrator_v2/scripts/restore-crmnexointegrator_v2.sh',
      totalFiles: files.length,
      files,
      latestBackup: files[0] || null,
      lastLogSnippet: logSnippet
    });
  } catch (err) {
    console.error('Erro ao consultar status da rotina de backup:', err);
    res.status(500).json({ error: 'Erro ao consultar status da rotina de backup.' });
  }
});

router.get('/export', async (req, res) => {
  try {
    req.setTimeout?.(0);
    res.setTimeout?.(0);

    const includeUploadContents = String(req.query.includeUploadContents || 'true') !== 'false';
    const generatedAt = new Date().toISOString();

    console.log(`[Backup EXPORTAÇÃO] Iniciando exportação completa — ${generatedAt}`);

    const [database, uploads, system] = await Promise.all([
      readDatabaseTables(),
      collectUploads({ includeContents: includeUploadContents }),
      readSystemMetadata()
    ]);

    // Montar resumo legível por módulo para incluir no JSON do backup
    const modulesReport = (database.modulesSummary || []).map(m => ({
      module: m.module,
      tableCount: m.tableCount,
      totalRows: m.totalRows,
      tables: m.tables.map(t => `${t.tableName}(${t.rows})`)
    }));

    const backup = {
      format: 'nexoscrm-full-system-backup',
      version: 1,
      generatedAt,
      generatedBy: {
        id: req.user?.id || req.user?.userId || null,
        name: req.user?.name || null,
        email: req.user?.email || null,
        role: req.user?.actualRole || req.user?.role || null
      },
      // Resumo de módulos incluídos — visível ao abrir o arquivo de backup
      modulesSummary: {
        totalTables: database.tableNames.length,
        totalRows: database.totalRows,
        modules: modulesReport
      },
      database: {
        provider: 'postgresql',
        schema: 'public',
        tableCount: database.tableNames.length,
        totalRows: database.totalRows,
        tables: database.tables
      },
      uploads,
      system,
      notes: [
        'Backup gerado pelo backend ativo do NexosCRM.',
        'Inclui todas as tabelas reais do schema public do PostgreSQL.',
        'Inclui manifesto dos uploads e conteúdo base64 quando dentro do limite BACKUP_MAX_UPLOAD_BYTES.',
        `Módulos incluídos: ${modulesReport.map(m => `${m.module}(${m.tableCount}t/${m.totalRows}r)`).join(', ')}`
      ]
    };

    const body = JSON.stringify(backup, jsonReplacer, 2);
    const filename = `nexoscrm-backup-completo-${generatedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;

    console.log(`[Backup EXPORTAÇÃO] Arquivo gerado: ${filename} — ${(body.length / 1024 / 1024).toFixed(2)} MB`);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (error) {
    console.error('Erro ao exportar backup completo:', error);
    res.status(500).json({ error: error.message || 'Erro ao exportar backup completo do sistema' });
  }
});

router.post('/restore', async (req, res) => {
  try {
    req.setTimeout?.(0);
    res.setTimeout?.(0);

    const confirmation = String(req.headers['x-restore-confirmation'] || '').trim();
    if (confirmation !== 'RESTAURAR_BACKUP_COMPLETO') {
      return res.status(400).json({ error: 'Confirmação de restauração completa não informada.' });
    }

    const backup = req.body;
    if (!backup || typeof backup !== 'object') {
      return res.status(400).json({ error: 'Conteúdo de backup inválido ou não fornecido.' });
    }

    if (backup?.format !== 'nexoscrm-full-system-backup' && !backup?.modules && !backup?.database?.tables) {
      return res.status(400).json({
        error: 'Arquivo não é um backup reconhecido do NexosCRM (formato esperado: nexoscrm-full-system-backup ou backup com módulos).'
      });
    }

    const restoredAt = new Date().toISOString();
    console.log(`[Backup RESTAURAÇÃO] Iniciando restauração — backup gerado em: ${backup?.generatedAt || 'desconhecido'}`);

    // Exibir o resumo de módulos do backup original (se disponível)
    if (backup?.modulesSummary?.modules?.length) {
      console.log(`[Backup RESTAURAÇÃO] Módulos contidos no arquivo de backup:`);
      for (const m of backup.modulesSummary.modules) {
        console.log(`[Backup RESTAURAÇÃO]   → ${m.module}: ${m.tableCount} tabelas, ${m.totalRows} registros`);
      }
    }

    const restoreSessionAnchor = await readRestoreSessionAnchor(req.user);
    const backupTables = normalizeBackupTables(backup);
    const database = await restoreDatabase(backupTables);
    const sessionAccess = await ensureRestoreSessionAnchor(restoreSessionAnchor);
    const uploads = await restoreUploads(backup.uploads);

    // Resumo legível dos módulos restaurados para a resposta
    const modulesRestoredReport = (database.modulesSummary || []).map(m => ({
      module: m.module,
      tableCount: m.tableCount,
      totalRows: m.totalRows,
      tables: m.tables.map(t => `${t.tableName}(${t.rows})`)
    }));

    console.log(`[Backup RESTAURAÇÃO] Concluída: ${database.tableCount} tabelas | ${database.totalRows} registros | uploads: ${uploads.restoredFiles} arquivos`);

    res.json({
      message: 'Backup completo restaurado com sucesso',
      restoredAt,
      restoredBy: {
        id: req.user?.id || req.user?.userId || null,
        name: req.user?.name || null,
        email: req.user?.email || null,
        role: req.user?.actualRole || req.user?.role || null
      },
      // Resumo por módulo do que foi restaurado
      modulesSummary: {
        totalTables: database.tableCount,
        totalRows: database.totalRows,
        modules: modulesRestoredReport,
        skippedTables: database.skippedTables || []
      },
      database,
      uploads,
      sessionAccess
    });
  } catch (error) {
    console.error('Erro ao restaurar backup completo:', error);
    res.status(500).json({
      error: error.message || 'Erro ao restaurar backup completo do sistema',
      message: error.message
    });
  }
});

module.exports = router;
