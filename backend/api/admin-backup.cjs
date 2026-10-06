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

    if (names.length > 0) return names;
  } catch (err) {
    console.warn('[Backup] Falha ao listar tabelas via information_schema, fallback para modelos:', err.message);
  }

  // Fallback para modelos definidos no schema do Prisma
  const models = getPrismaModels();
  if (models.length > 0) {
    return models.map((m) => m.tableName);
  }

  return [
    'User', 'TenantCompany', 'Company', 'LicensePlan', 'CompanyLicense',
    'Contact', 'Product', 'Opportunity', 'OpportunityProduct', 'Activity',
    'Proposal', 'ProposalTemplate', 'ProposalItem', 'Commission', 'Region',
    'Contract', 'PreSalesRequest', 'KickoffMeeting', 'Project', 'AuditLog'
  ];
};

const readDatabaseTables = async () => {
  const tableNames = await listDatabaseTables();
  const tables = {};
  let totalRows = 0;

  for (const tableName of tableNames) {
    try {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${escapeIdentifier(tableName)}`);
      const safeRows = Array.isArray(rows) ? rows : [];
      tables[tableName] = {
        count: safeRows.length,
        rows: safeRows
      };
      totalRows += safeRows.length;
    } catch (err) {
      console.warn(`[Backup Export] Aviso ao ler tabela ${tableName}:`, err.message);
      tables[tableName] = { count: 0, rows: [] };
    }
  }

  return { tableNames, tables, totalRows };
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
        return `${placeholder}::\"${cleanUdt}\"`;
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
    console.warn(`[Backup Restore] Tabelas do backup não presentes no banco e ignoradas: ${skippedTables.join(', ')}`);
  }

  if (validTableNames.length === 0) {
    throw new Error('Nenhuma tabela do arquivo de backup corresponde às tabelas existentes no banco de dados.');
  }

  const orderedTableNames = await orderTablesForInsert(validTableNames);
  const columnTypesByTable = await readColumnTypes(validTableNames);

  return prisma.$transaction(
    async (tx) => {
      // 1. Desativa temporariamente a verificação estrita de foreign keys para permitir inserção sem bloqueios cíclicos
      await tx.$executeRawUnsafe("SET CONSTRAINTS ALL DEFERRED;").catch(() => {});
      await tx.$executeRawUnsafe("SET session_replication_role = 'replica';").catch(() => {});

      // 2. Limpa as tabelas existentes
      const truncateSql = validTableNames.map(escapeIdentifier).join(', ');
      try {
        await tx.$executeRawUnsafe(`TRUNCATE TABLE ${truncateSql} RESTART IDENTITY CASCADE`);
      } catch (truncateErr) {
        console.warn('[Backup Restore] TRUNCATE CASCADE falhou, limpando tabelas com DELETE:', truncateErr.message);
        for (const tableName of [...orderedTableNames].reverse()) {
          await tx.$executeRawUnsafe(`DELETE FROM ${escapeIdentifier(tableName)}`).catch(() => {});
        }
      }

      // 3. Insere os registros na ordem correta
      let restoredRows = 0;
      const tables = [];

      for (const tableName of orderedTableNames) {
        const rows = tableByName.get(tableName)?.rows || [];
        const insertedRows = await insertRows(tx, tableName, rows, columnTypesByTable.get(tableName));
        restoredRows += insertedRows;
        tables.push({ tableName, restoredRows: insertedRows });
      }

      // 4. Sincroniza sequences numéricas (autoincrement / nextval)
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
        console.warn('[Backup Restore] Aviso ao sincronizar sequences:', seqErr.message);
      }

      // 5. Restaura o modo normal de replicação
      await tx.$executeRawUnsafe("SET session_replication_role = 'origin';").catch(() => {});

      return { tableCount: orderedTableNames.length, totalRows: restoredRows, tables };
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
    const backupDir = '/root/backups/nexoscrm-3026';
    const logFile = '/var/log/nexoscrm-3026-backup.log';
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
      // Diretório pode não existir em dev local
    }

    try {
      const logContent = await fs.readFile(logFile, 'utf-8');
      const lines = logContent.trim().split('\n');
      logSnippet = lines.slice(-20).join('\n');
    } catch (e) {
      logSnippet = 'Log ainda não gerado ou aguardando primeiro ciclo do cron.';
    }

    res.json({
      active: true,
      schedule: 'Diário às 02:30 (America/Sao_Paulo)',
      cronExpression: '30 2 * * *',
      database: 'nexoscrm',
      databasePort: 5433,
      domain: 'nexos.chorstconsult.com.br',
      retentionDays: 14,
      backupDir,
      logFile,
      backupScript: '/root/backups/backup-nexoscrm-3026.sh',
      restoreScript: null,
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
    const [database, uploads, system] = await Promise.all([
      readDatabaseTables(),
      collectUploads({ includeContents: includeUploadContents }),
      readSystemMetadata()
    ]);

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
        'Inclui manifesto dos uploads e conteúdo base64 quando dentro do limite BACKUP_MAX_UPLOAD_BYTES.'
      ]
    };

    // ── Gera modulesSummary agrupando tabelas por módulo funcional ────────────
    // Exibido no painel de backup da UI (log de tabelas incluídas)
    const MODULE_MAP = [
      { module: 'AUTENTICAÇÃO & USUÁRIOS',    tables: ['User','TenantCompany','LicensePlan','user_sessions','profiles','users'] },
      { module: 'EMPRESAS & CONTATOS',         tables: ['Company','CompanyDocument','CompanyLicense','Contact','contacts','clientes'] },
      { module: 'OPORTUNIDADES & CRM',         tables: ['Opportunity','OpportunityAttentionPoint','OpportunityLearning','OpportunityProduct','oportunidades','oportunidades_parceiro','oportunidade_historico','oportunidade_parceiro_historico','oportunidade_fornecedores'] },
      { module: 'PRODUTOS & PREÇOS',           tables: ['Product','ProductPrice','PriceTable','products','product_configs'] },
      { module: 'PROPOSTAS',                   tables: ['Proposal','ProposalItem','ProposalTemplate','proposals','proposal_items','proposal_logs','calculations'] },
      { module: 'PRÉ-VENDAS',                  tables: ['PreSalesRequest','PreSalesItem','PreSalesApproval','PreSalesPoc','PreSalesPocFollowUp'] },
      { module: 'PROJETOS',                    tables: ['Project','ProjectPhase','ProjectTask','ProjectTeam','ProjectMilestone','ProjectRisk','ProjectIssue','ProjectBilling','ProjectAttachment','ProjectAcceptance','ProjectTimelog','ProjectChangeRequest','ProjectB2BConfig','ProjectB2GConfig'] },
      { module: 'KICKOFF',                     tables: ['KickoffMeeting','KickoffParticipant','KickoffAgendaItem','KickoffChecklistItem','KickoffActionItem','KickoffHistory','KickoffTemplate'] },
      { module: 'CONTRATOS',                   tables: ['Contract','ContractAttachment','Commission','commission_seller','commission_channel_director','commission_channel_seller','commission_channel_indicator','commission_channel_influencer'] },
      { module: 'ATIVIDADES & HISTÓRICO',      tables: ['Activity','atividades','audit_logs','webhook_logs'] },
      { module: 'SIMULADOR',                   tables: ['SimulatorProposal','simulator_licitacao','calculations'] },
      { module: 'B2G LICITAÇÕES',              tables: ['BidNotice','BidNoticeHistory','SavedAnalysis','gerenciadas_licitacao','alertas_licitacao','editais_analisados','licitacoes_pncp'] },
      { module: 'WORKFLOW & AUTOMAÇÃO',        tables: ['Workflow','WorkflowExecution','AdvancedWorkflow','AutomationRule','ApprovalWorkflow','ApprovalRequest','ApprovalStep','approval_workflows','approval_steps'] },
      { module: 'NOTIFICAÇÕES & SUPORTE',      tables: ['Notification','SupportTicket','TicketResponse','NPSSurvey','ChurnAlert','notificacoes'] },
      { module: 'PARCEIROS & FORNECEDORES',    tables: ['Region','partners','fornecedores','teams','integrations'] },
      { module: 'CONFIGURAÇÕES DO SISTEMA',    tables: ['SystemSetting','Integration','IntegrationLog','GoogleToken','branding_configs','system_configs','system_metrics','document_templates'] },
      { module: 'VENDAS & METAS',              tables: ['SalesTarget','TeamBonus','TeamBonusDistribution','CustomerOnboarding','OnboardingStep','CrossSellRule','UpSellRule','Competitor','CompetitorComparison'] },
      { module: 'FILTROS TI & B2G',            tables: ['categorias_filtro_ti','palavras_chave_ti','palavras_chave_customizadas','historico_buscas_ti','site_surveys'] },
    ];

    const allTableNames = new Set(database.tableNames);
    const modulesSummary = {
      totalTables: database.tableNames.length,
      totalRows: database.totalRows,
      modules: MODULE_MAP.map(({ module, tables }) => {
        const matchedTables = tables.filter(t => allTableNames.has(t));
        const totalRows = matchedTables.reduce((sum, t) => {
          const entry = database.tables[t];
          return sum + (entry?.count || (Array.isArray(entry?.rows) ? entry.rows.length : 0));
        }, 0);
        return { module, tableCount: matchedTables.length, totalRows, tables: matchedTables };
      }).filter(m => m.tableCount > 0)
    };
    backup.modulesSummary = modulesSummary;
    // ─────────────────────────────────────────────────────────────────────────

    const body = JSON.stringify(backup, jsonReplacer, 2);
    const filename = `nexoscrm-backup-completo-${generatedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;

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

    const restoreSessionAnchor = await readRestoreSessionAnchor(req.user);
    const backupTables = normalizeBackupTables(backup);
    const database = await restoreDatabase(backupTables);
    const sessionAccess = await ensureRestoreSessionAnchor(restoreSessionAnchor);
    const uploads = await restoreUploads(backup.uploads);

    res.json({
      message: 'Backup completo restaurado com sucesso',
      restoredAt: new Date().toISOString(),
      restoredBy: {
        id: req.user?.id || req.user?.userId || null,
        name: req.user?.name || null,
        email: req.user?.email || null,
        role: req.user?.actualRole || req.user?.role || null
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
