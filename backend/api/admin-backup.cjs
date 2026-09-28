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

const getPrismaModels = () =>
  (Prisma.dmmf?.datamodel?.models || []).map((model) => ({
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

const listDatabaseTables = async () => {
  const tables = await prisma.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `;

  return tables.map((row) => row.table_name).filter(Boolean);
};

const readDatabaseTables = async () => {
  const tableNames = await listDatabaseTables();
  const tables = {};
  let totalRows = 0;

  for (const tableName of tableNames) {
    const rows = await prisma.$queryRawUnsafe(`SELECT * FROM ${escapeIdentifier(tableName)}`);
    tables[tableName] = {
      count: rows.length,
      rows
    };
    totalRows += rows.length;
  }

  return { tableNames, tables, totalRows };
};

const summarizeDatabaseTables = async () => {
  const tableNames = await listDatabaseTables();
  const tables = [];
  let totalRows = 0;

  for (const tableName of tableNames) {
    const result = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM ${escapeIdentifier(tableName)}`);
    const count = Number(result?.[0]?.count || 0);
    tables.push({ tableName, count });
    totalRows += count;
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
  if (!rawTables || typeof rawTables !== 'object' || Array.isArray(rawTables)) {
    throw new Error('Arquivo de backup completo inválido: tabelas do banco não encontradas');
  }

  return Object.entries(rawTables).map(([tableName, payload]) => {
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    return { tableName, rows };
  });
};

const readForeignKeyDependencies = async () => {
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

  return rows
    .map((row) => ({
      tableName: row.table_name,
      dependsOn: row.foreign_table_name
    }))
    .filter((row) => row.tableName && row.dependsOn && row.tableName !== row.dependsOn);
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
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      table_name AS "tableName",
      column_name AS "columnName",
      data_type AS "dataType",
      udt_schema AS "udtSchema",
      udt_name AS "udtName",
      pg_catalog.format_type(a.atttypid, a.atttypmod) AS "formattedType"
    FROM information_schema.columns
    JOIN pg_catalog.pg_namespace n
      ON n.nspname = table_schema
    JOIN pg_catalog.pg_class t
      ON t.relnamespace = n.oid
      AND t.relname = table_name
    JOIN pg_catalog.pg_attribute a
      ON a.attrelid = t.oid
      AND a.attname = column_name
      AND a.attnum > 0
    WHERE table_schema = 'public'
      AND table_name IN (${tableListSql})
  `);

  const result = new Map();
  for (const row of rows) {
    if (!row.tableName || !row.columnName) continue;
    if (!result.has(row.tableName)) result.set(row.tableName, new Map());
    result.get(row.tableName).set(row.columnName, {
      dataType: String(row.dataType || '').toLowerCase(),
      udtSchema: row.udtSchema || null,
      udtName: row.udtName || null,
      formattedType: row.formattedType || null
    });
  }

  return result;
};

const formatPostgresTypeName = (columnType) => {
  if (columnType?.formattedType) return columnType.formattedType;
  if (!columnType?.udtName) return null;
  const typeName = escapeIdentifier(columnType.udtName);
  if (!columnType.udtSchema || columnType.udtSchema === 'public') return typeName;
  return `${escapeIdentifier(columnType.udtSchema)}.${typeName}`;
};

const buildRestorePlaceholder = (index, columnType) => {
  const placeholder = `$${index}`;
  const dataType = columnType?.dataType;

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
      const typeName = formatPostgresTypeName(columnType);
      return typeName ? `${placeholder}::${typeName}` : placeholder;
    }
    case 'user-defined': {
      const typeName = formatPostgresTypeName(columnType);
      return typeName ? `${placeholder}::${typeName}` : placeholder;
    }
    default:
      return placeholder;
  }
};

const normalizeRestoreValue = (value, columnType) => {
  if (value === undefined) return null;
  if (value === null) return null;

  if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
    return Buffer.from(value.data);
  }

  const dataType = columnType?.dataType;
  if (dataType === 'json' || dataType === 'jsonb') {
    return JSON.stringify(value);
  }

  if (dataType === 'bytea' && typeof value === 'string') {
    return Buffer.from(value, 'base64');
  }

  return value;
};

const insertRows = async (tx, tableName, rows, columnTypes = new Map()) => {
  let inserted = 0;

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;

    const rawColumns = Object.keys(row);
    const columns = columnTypes.size > 0 ? rawColumns.filter((column) => columnTypes.has(column)) : rawColumns;
    if (columns.length === 0) continue;

    const placeholders = columns
      .map((column, index) => buildRestorePlaceholder(index + 1, columnTypes.get(column)))
      .join(', ');
    const columnSql = columns.map(escapeIdentifier).join(', ');
    const values = columns.map((column) => normalizeRestoreValue(row[column], columnTypes.get(column)));

    await tx.$executeRawUnsafe(
      `INSERT INTO ${escapeIdentifier(tableName)} (${columnSql}) VALUES (${placeholders})`,
      ...values
    );
    inserted += 1;
  }

  return inserted;
};

const restoreDatabase = async (backupTables) => {
  const currentTables = new Set(await listDatabaseTables());
  const tableNames = backupTables.map((table) => table.tableName);
  const missingTables = tableNames.filter((tableName) => !currentTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(`O banco atual não possui tabela(s) do backup: ${missingTables.join(', ')}`);
  }

  const tableByName = new Map(backupTables.map((table) => [table.tableName, table]));
  const orderedTableNames = await orderTablesForInsert(tableNames);
  const columnTypesByTable = await readColumnTypes(tableNames);
  const truncateSql = tableNames.map(escapeIdentifier).join(', ');

  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${truncateSql} RESTART IDENTITY CASCADE`);

      let restoredRows = 0;
      const tables = [];

      for (const tableName of orderedTableNames) {
        const rows = tableByName.get(tableName)?.rows || [];
        const insertedRows = await insertRows(tx, tableName, rows, columnTypesByTable.get(tableName));
        restoredRows += insertedRows;
        tables.push({ tableName, restoredRows: insertedRows });
      }

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
};

const ensureRestoreSessionAnchor = async (anchor) => {
  if (!anchor?.user?.email) return { preserved: false, reason: 'empty_anchor' };

  const existingUser = await prisma.user.findFirst({
    where: { email: { equals: normalizeEmail(anchor.user.email), mode: 'insensitive' } },
    select: { id: true }
  });

  if (existingUser) {
    return { preserved: false, reason: 'user_exists' };
  }

  let tenantCompanyId = null;
  const preservedTenant = anchor.tenantCompany;

  if (anchor.user.tenantCompanyId && preservedTenant?.id) {
    const existingTenantById = await prisma.tenantCompany.findUnique({
      where: { id: preservedTenant.id },
      select: { id: true }
    });

    if (existingTenantById) {
      tenantCompanyId = existingTenantById.id;
    } else {
      let cnpj = preservedTenant.cnpj || null;
      if (cnpj) {
        const existingTenantByCnpj = await prisma.tenantCompany.findUnique({
          where: { cnpj },
          select: { id: true }
        });
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
          createdAt: preservedTenant.createdAt || undefined,
          updatedAt: preservedTenant.updatedAt || undefined
        },
        select: { id: true }
      });
      tenantCompanyId = createdTenant.id;
    }
  }

  let regionId = null;
  if (anchor.user.regionId) {
    const existingRegion = await prisma.region.findUnique({
      where: { id: anchor.user.regionId },
      select: { id: true }
    });
    if (existingRegion) regionId = existingRegion.id;
  }

  const existingUserId = await prisma.user.findUnique({
    where: { id: anchor.user.id },
    select: { id: true }
  });

  const role = normalizeRole(anchor.user);
  if (role !== 'MASTER' && anchor.user.tenantCompanyId && !tenantCompanyId) {
    return { preserved: false, reason: 'tenant_missing' };
  }

  const preservedUser = await prisma.user.create({
    data: {
      id: existingUserId ? undefined : anchor.user.id,
      name: anchor.user.name,
      email: normalizeEmail(anchor.user.email),
      password: anchor.user.password,
      role,
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
      createdAt: anchor.user.createdAt || undefined
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

    const targetPath = resolveSafeUploadPath(file.path);
    const data = Buffer.from(String(file.contentBase64), 'base64');

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, data);

    restoredFiles += 1;
    restoredBytes += data.length;
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
    res.status(500).json({ error: 'Erro ao gerar resumo do backup completo' });
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

    const body = JSON.stringify(backup, jsonReplacer, 2);
    const filename = `nexoscrm-backup-completo-${generatedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(body);
  } catch (error) {
    console.error('Erro ao exportar backup completo:', error);
    res.status(500).json({ error: 'Erro ao exportar backup completo do sistema' });
  }
});

router.post('/restore', async (req, res) => {
  try {
    req.setTimeout?.(0);
    res.setTimeout?.(0);

    const confirmation = String(req.headers['x-restore-confirmation'] || '').trim();
    if (confirmation !== 'RESTAURAR_BACKUP_COMPLETO') {
      return res.status(400).json({ error: 'Confirmação de restauração completa não informada' });
    }

    const backup = req.body;
    if (backup?.format !== 'nexoscrm-full-system-backup') {
      return res.status(400).json({ error: 'Arquivo não é um backup completo do NexosCRM' });
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
    res.status(500).json({ error: error.message || 'Erro ao restaurar backup completo do sistema' });
  }
});

module.exports = router;
