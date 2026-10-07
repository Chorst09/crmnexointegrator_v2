/**
 * Sincroniza as propostas do SIMULADOR (backup .sql legado) para a tabela
 * "SimulatorProposal" em PRODUÇÃO, que é a fonte de dados do módulo
 * Calculadoras/Simuladores (backend/api/simulator-proposals.js).
 *
 * Estratégia (não destrutiva e idempotente):
 *   1. Backup da tabela alvo em JSON + pg_dump no servidor.
 *   2. Carrega as 291 linhas num TEMP TABLE.
 *   3. UPDATE por (baseId, version) — corrige campos e completa metadata.
 *   4. INSERT apenas do que ainda não existir.
 *   Nenhum DELETE, nenhum TRUNCATE, nenhuma outra tabela é tocada.
 *
 * Correções em relação à carga anterior já presente em produção:
 *   - client: remove as aspas literais (a carga antiga não parseou o JSON)
 *   - metadata: completa clientData, expiryDate, logs (39), approvalPolicy,
 *     forecastTemperature, baseTotalMonthly, accountManagerData, sellerUserId
 *   - createdBy: vendedores sem login em produção são atribuídos ao MASTER,
 *     com o valor original preservado em metadata._legacy.originalCreatedBy
 *
 * Uso:
 *   node scripts/sync-simulador-calculadoras-prod.cjs            # dry-run
 *   node scripts/sync-simulador-calculadoras-prod.cjs --apply
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');

const BACKUP_SQL = process.env.SIMULADOR_BACKUP
  || path.join(ROOT, 'BACKUP', 'Simulador', 'backup-producao-FINAL-20261001_120743.sql');

const SSH_KEY = process.env.SSH_KEY || path.join(process.env.HOME, '.ssh/id_ed25519_kvm');
const PROD_HOST = process.env.PROD_HOST || 'root@209.50.241.25';
const PG_CONTAINER = process.env.PROD_PG_CONTAINER || 'nexoscrm-postgres';
const PG_USER = process.env.PROD_PG_USER || 'nexoscrm';
const PG_DB = process.env.PROD_PG_DB || 'nexoscrm';

// Vendedor sem login em produção -> atribui ao MASTER (original fica em metadata)
const FALLBACK_EMAIL = process.env.PROD_FALLBACK_EMAIL || 'chorstconsult@gmail.com';

const apply = process.argv.includes('--apply');

// ─── Infra ───────────────────────────────────────────────────────────────────

const ssh = (remoteCmd, input) => execFileSync(
  'ssh',
  ['-i', SSH_KEY, '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', PROD_HOST, remoteCmd],
  { maxBuffer: 1024 * 1024 * 256, input },
).toString();

/** Executa SQL via stdin (evita qualquer quoting no shell remoto). */
const psql = (sql) => ssh(
  `docker exec -i ${PG_CONTAINER} psql -U ${PG_USER} -d ${PG_DB} -v ON_ERROR_STOP=1 -t -A`,
  sql,
);

// ─── Parser do dump COPY ─────────────────────────────────────────────────────

function readCopyBlock(sql, table) {
  const re = new RegExp(
    `COPY ${table.replace('.', '\\.')} \\((.*?)\\) FROM stdin;\\n([\\s\\S]*?)\\n\\\\\\.`,
  );
  const m = sql.match(re);
  if (!m) return { columns: [], rows: [] };
  const columns = m[1].split(', ').map((c) => c.trim());
  const rows = m[2] === '' ? [] : m[2].split('\n');
  return { columns, rows: rows.map((line) => line.split('\t')) };
}

const nul = (v) => (v === undefined || v === '\\N' ? null : v);

const parseJson = (raw, fallback = null) => {
  if (raw == null || raw === '' || raw === '\\N') return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

// ─── Normalização ────────────────────────────────────────────────────────────

const EMAIL_TYPO_FIXES = {
  'sivana.taborda@doubletelecom.com.br': 'silvana.taborda@doubletelecom.com.br',
};

function normalizeAccountManager(raw, sellerEmail, sellerName) {
  let value = parseJson(raw, null);

  if (value == null || value === '') {
    value = { name: sellerName, email: sellerEmail, phone: '' };
  } else if (typeof value === 'string') {
    value = { name: value, email: sellerEmail, phone: '' };
  } else if (!value.name) {
    value = { name: sellerName, email: sellerEmail, phone: '' };
  }

  let email = (value.email || '').trim();
  if (EMAIL_TYPO_FIXES[email]) email = EMAIL_TYPO_FIXES[email];
  if (!email || email === sellerEmail) email = sellerEmail;

  return {
    name: String(value.name).trim(),
    email,
    phone: String(value.phone || '').trim(),
  };
}

const cleanNumber = (v) => {
  const n = Number(nul(v));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Mantém o horário de parede original do dump (ex.: '2026-06-03 13:15:43.818-03'
 * -> '2026-06-03 13:15:43.818'). Converter para UTC deslocaria as datas que já
 * estão gravadas em produção.
 */
function toPgTimestamp(raw, fallback) {
  const v = nul(raw);
  if (v) {
    const m = v.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})(\.\d+)?/);
    if (m) {
      const frac = (m[2] || '.0').slice(0, 4);
      return `${m[1]}${frac}`;
    }
  }
  return fallback;
}

/** Escapa um valor para o formato text do COPY do PostgreSQL. */
const copyText = (v) => {
  if (v === null || v === undefined) return '\\N';
  return String(v)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
};

// ─── Montagem ────────────────────────────────────────────────────────────────

function buildRows(sql) {
  const proposals = readCopyBlock(sql, 'public.proposals');
  const legacyUsers = readCopyBlock(sql, 'public.users');
  const profiles = readCopyBlock(sql, 'public.profiles');
  const logs = readCopyBlock(sql, 'public.proposal_logs');

  const uIdx = (c) => legacyUsers.columns.indexOf(c);
  const legacyUsersById = new Map(
    legacyUsers.rows.map((r) => [r[uIdx('id')], { email: r[uIdx('email')] }]),
  );

  const pIdx = (c) => profiles.columns.indexOf(c);
  const namesById = new Map(profiles.rows.map((r) => [r[pIdx('id')], r[pIdx('full_name')]]));

  const lIdx = (c) => logs.columns.indexOf(c);
  const logsByProposal = new Map();
  for (const row of logs.rows) {
    const list = logsByProposal.get(row[lIdx('proposal_id')]) || [];
    list.push({
      action: nul(row[lIdx('action')]),
      fieldName: nul(row[lIdx('field_name')]),
      oldValue: nul(row[lIdx('old_value')]),
      newValue: nul(row[lIdx('new_value')]),
      description: nul(row[lIdx('description')]),
      userId: nul(row[lIdx('user_id')]),
      createdAt: nul(row[lIdx('created_at')]),
    });
    logsByProposal.set(row[lIdx('proposal_id')], list);
  }

  const col = (c) => proposals.columns.indexOf(c);
  const rows = [];

  for (const r of proposals.rows) {
    const legacyId = nul(r[col('id')]);
    const creatorUuid = nul(r[col('created_by')]);
    const legacyUser = legacyUsersById.get(creatorUuid);
    const originalSellerEmail = legacyUser?.email;
    const sellerName = namesById.get(creatorUuid) || '';

    if (!originalSellerEmail) continue;

    const accountManager = normalizeAccountManager(
      r[col('account_manager')],
      originalSellerEmail,
      sellerName,
    );

    const products = parseJson(r[col('products')], []) || [];
    const clientData = parseJson(r[col('client_data')], {}) || {};
    const legacyMeta = parseJson(r[col('metadata')], {}) || {};

    const metadata = {
      ...legacyMeta,
      products,
      clientData,
      totalSetup: cleanNumber(r[col('total_setup')]),
      totalMonthly: cleanNumber(r[col('total_monthly')]),
      contractPeriod: Number(nul(r[col('contract_period')])) || null,
      proposalDate: nul(r[col('date')]),
      expiryDate: nul(r[col('expiry_date')]),
      distributorId: nul(r[col('distributor_id')]),
      accountManagerData: accountManager,
      logs: logsByProposal.get(legacyId) || [],
      _legacy: {
        source: 'backup-producao-FINAL-20261001_120743.sql',
        table: 'public.proposals',
        id: legacyId,
        baseId: nul(r[col('base_id')]),
        contractPeriodRaw: nul(r[col('contract_period')]),
        valueRaw: nul(r[col('value')]),
        itemsData: parseJson(r[col('items_data')], []),
        originalCreatedBy: originalSellerEmail,
      },
    };

    const monthly = cleanNumber(r[col('total_monthly')]);
    const rawValue = cleanNumber(r[col('value')]);
    const createdAt = toPgTimestamp(r[col('created_at')], toPgTimestamp(r[col('date')], null))
      || '2026-01-01 00:00:00.000';
    const updatedAt = toPgTimestamp(r[col('updated_at')], createdAt) || createdAt;

    rows.push({
      legacyId,
      baseId: nul(r[col('base_id')]),
      version: Number(nul(r[col('version')])) || 1,
      title: nul(r[col('title')]) || 'Proposta',
      // A carga anterior guardou o JSON cru: "Luson" (com aspas). Parseamos.
      client: String(parseJson(r[col('client')], nul(r[col('client')])) ?? 'N/A'),
      type: (nul(r[col('type')]) || 'standard').toUpperCase(),
      value: monthly || rawValue,
      status: nul(r[col('status')]) || 'Rascunho',
      forecastTemperature: typeof legacyMeta.forecastTemperature === 'number'
        ? legacyMeta.forecastTemperature
        : null,
      metadata,
      originalSellerEmail,
      sellerName,
      accountManager: JSON.stringify(accountManager),
      distributorId: nul(r[col('distributor_id')]) || '',
      createdAt,
      updatedAt,
    });
  }

  return rows;
}

// ─── SQL ─────────────────────────────────────────────────────────────────────

const COLS = [
  'id', 'baseId', 'version', 'title', 'client', 'type', 'value', 'status',
  'forecastTemperature', 'metadata', 'createdBy', 'accountManager',
  'distributorId', 'createdAt', 'updatedAt',
];

function buildSql(rows, sellerEmailByLegacy) {
  const lines = [];
  lines.push('BEGIN;');
  lines.push('CREATE TEMP TABLE stage ('
    + '"id" text, "baseId" text, "version" int, "title" text, "client" text,'
    + ' "type" text, "value" double precision, "status" text,'
    + ' "forecastTemperature" double precision, "metadata" jsonb, "createdBy" text,'
    + ' "accountManager" text, "distributorId" text, "createdAt" timestamp(3),'
    + ' "updatedAt" timestamp(3)) ON COMMIT DROP;');
  lines.push(`COPY stage (${COLS.map((c) => `"${c}"`).join(', ')}) FROM stdin;`);

  for (const r of rows) {
    const createdBy = sellerEmailByLegacy.get(r.legacyId);
    lines.push([
      copyText(r.legacyId),
      copyText(r.baseId),
      copyText(r.version),
      copyText(r.title),
      copyText(r.client),
      copyText(r.type),
      copyText(r.value),
      copyText(r.status),
      copyText(r.forecastTemperature),
      copyText(JSON.stringify(r.metadata)),
      copyText(createdBy),
      copyText(r.accountManager),
      copyText(r.distributorId),
      copyText(r.createdAt),
      copyText(r.updatedAt),
    ].join('\t'));
  }
  lines.push('\\.');

  // UPDATE: metadata mescla (sp.metadata || s.metadata) para não perder
  // chaves snake_case que a carga anterior gravou (total_setup, total_monthly...).
  lines.push(`
UPDATE "SimulatorProposal" sp SET
  "client"          = s."client",
  "title"           = s."title",
  "type"            = s."type",
  "value"           = s."value",
  "status"          = s."status",
  "metadata"        = sp.metadata || s."metadata",
  "createdBy"       = s."createdBy",
  "accountManager"  = s."accountManager",
  "distributorId"   = s."distributorId",
  "forecastTemperature" = COALESCE(s."forecastTemperature", sp."forecastTemperature")
FROM stage s
WHERE sp."baseId" = s."baseId" AND sp.version = s.version;`);

  lines.push(`
INSERT INTO "SimulatorProposal"
  ("id","baseId","version","title","client","type","value","status",
   "forecastTemperature","metadata","createdBy","accountManager",
   "distributorId","createdAt","updatedAt")
SELECT s."id", s."baseId", s."version", s."title", s."client", s."type", s."value",
       s."status", s."forecastTemperature", s."metadata", s."createdBy",
       s."accountManager", s."distributorId", s."createdAt", s."updatedAt"
  FROM stage s
 WHERE NOT EXISTS (
   SELECT 1 FROM "SimulatorProposal" sp
    WHERE sp."baseId" = s."baseId" AND sp.version = s.version);`);

  lines.push('COMMIT;');
  return lines.join('\n');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Sync SIMULADOR -> Calculadoras (PRODUÇÃO) ===');
  console.log(`Origem : ${BACKUP_SQL}`);
  console.log(`Destino: ${PROD_HOST} / ${PG_CONTAINER} / ${PG_DB}`);
  console.log(`Modo   : ${apply ? 'APPLY' : 'DRY-RUN'}\n`);

  const sql = fs.readFileSync(BACKUP_SQL, 'utf-8');
  const rows = buildRows(sql);
  console.log(`Propostas extraídas do dump: ${rows.length}`);

  // Usuários reais em produção
  const usersOut = ssh(
    `docker exec ${PG_CONTAINER} psql -U ${PG_USER} -d ${PG_DB} -t -A -F'|' `
    + `-c ${JSON.stringify('SELECT id, email, name, role FROM "User";')}`,
  );
  const prodUsers = usersOut.split('\n').filter(Boolean).map((l) => {
    const [id, email, name, role] = l.split('|');
    return { id, email, name, role };
  });
  const byEmail = new Map(prodUsers.map((u) => [u.email.toLowerCase(), u]));
  console.log(`Usuários em produção: ${prodUsers.length}`);

  if (!byEmail.has(FALLBACK_EMAIL.toLowerCase())) {
    throw new Error(`Fallback ${FALLBACK_EMAIL} não existe em produção — ajuste PROD_FALLBACK_EMAIL.`);
  }

  // Resolver vendedor de cada proposta
  const sellerEmailByLegacy = new Map();
  const tally = new Map();
  const remapped = [];
  const skipped = [];

  for (const r of rows) {
    const found = byEmail.get(r.originalSellerEmail.toLowerCase());
    const finalEmail = found ? found.email : FALLBACK_EMAIL;
    sellerEmailByLegacy.set(r.legacyId, finalEmail);

    tally.set(finalEmail, (tally.get(finalEmail) || 0) + 1);
    if (!found) {
      remapped.push({ baseId: r.baseId, from: r.originalSellerEmail, to: finalEmail });
    } else {
      r.metadata.sellerUserId = found.id;
    }
  }

  void skipped;

  console.log('\n--- Propostas por vendedor (destino) ---');
  [...tally.entries()].sort((a, b) => b[1] - a[1])
    .forEach(([email, n]) => console.log(`  ${String(n).padStart(4)}  ${email}`));

  if (remapped.length) {
    console.log(`\n--- Vendedores sem login em produção -> ${FALLBACK_EMAIL} ---`);
    remapped.forEach((r) => console.log(`  ${r.baseId}: ${r.from} -> ${r.to} (original em metadata._legacy)`));
  }

  // Estado atual
  const before = psql('SELECT COUNT(*) FROM "SimulatorProposal";').trim();
  console.log(`\nSimulatorProposal antes: ${before}`);

  const script = buildSql(rows, sellerEmailByLegacy);

  if (!apply) {
    console.log('\n=== DRY-RUN: nada foi gravado. Use --apply. ===');
    console.log(`(script SQL de ${script.split('\n').length} linhas seria executado)`);
    return;
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const remoteDir = `/root/backups`;
  ssh(`mkdir -p ${remoteDir}`);
  const dumpFile = `${remoteDir}/simulatorproposal-${ts}.dump`;
  const jsonFile = `${remoteDir}/simulatorproposal-${ts}.json`;

  ssh(`docker exec ${PG_CONTAINER} pg_dump -U ${PG_USER} -d ${PG_DB} -t '"SimulatorProposal"' `
    + `-Fc > ${dumpFile} && ls -l ${dumpFile}`);
  console.log(`\nBackup pg_dump: ${dumpFile}`);

  const jsonSql = `SELECT COALESCE(json_agg(t)::text,'[]') FROM (SELECT * FROM "SimulatorProposal" ORDER BY "baseId", version) t;`;
  fs.writeFileSync('/tmp/sp-before.json', psql(jsonSql));
  ssh(`cat > ${jsonFile}`, fs.readFileSync('/tmp/sp-before.json'));
  console.log(`Backup JSON   : ${jsonFile}`);
  fs.writeFileSync(path.join(ROOT, 'BACKUP', `simulatorproposal-prod-antes-${ts}.json`),
    fs.readFileSync('/tmp/sp-before.json'));

  // ── Aplica ────────────────────────────────────────────────────────────────
  console.log('\nAplicando sincronização...');
  const out = psql(script);
  console.log(out.trim() || '(sem output)');

  // ── Verificação ───────────────────────────────────────────────────────────
  const after = psql('SELECT COUNT(*) FROM "SimulatorProposal";').trim();
  console.log(`\nSimulatorProposal depois: ${after}`);

  const bySeller = psql(
    `SELECT "createdBy" || ' :: ' || COUNT(*) FROM "SimulatorProposal" `
    + 'GROUP BY 1 ORDER BY 1;',
  );
  console.log('\n--- por vendedor ---');
  bySeller.split('\n').filter(Boolean).forEach((l) => console.log(`  ${l}`));

  const orphans = psql(`
    SELECT COUNT(*) FROM "SimulatorProposal" sp
     WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE lower(u.email) = lower(sp."createdBy"));`);
  console.log(`\nPropostas com vendedor inexistente no "User": ${orphans.trim()}`);

  const quoted = psql(`SELECT COUNT(*) FROM "SimulatorProposal" WHERE "client" LIKE '"%';`);
  console.log(`Propostas com aspas literais no client (antes: 291): ${quoted.trim()}`);

  const filled = psql(`
    SELECT COUNT(*) FILTER (WHERE metadata ? 'clientData') || '/' || COUNT(*)
      || ' clientData, '
      || COUNT(*) FILTER (WHERE metadata ? 'logs') || '/' || COUNT(*) || ' logs, '
      || COUNT(*) FILTER (WHERE metadata ? 'approvalPolicy') || '/' || COUNT(*) || ' approvalPolicy'
      FROM "SimulatorProposal";`);
  console.log(`Metadata preenchida: ${filled.trim()}`);

  console.log('\nPronto.');
}

main().catch((err) => {
  console.error('\n❌ Falhou:', err.message);
  process.exit(1);
});
