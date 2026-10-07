/**
 * Migra as propostas do SIMULADOR (backup .sql legado, tabelas snake_case)
 * para a tabela "SimulatorProposal", que é a fonte de dados do módulo
 * Calculadoras/Simuladores (backend/api/simulator-proposals.js).
 *
 * Não toca em nenhuma tabela dos outros módulos (Opportunity, Proposal,
 * Commission, PreSalesRequest, Company, ...): escreve apenas em
 * "SimulatorProposal", que é isolada e não tem FK para o CRM.
 *
 * Mapeamento por vendedor:
 *   proposals.created_by (uuid) -> User.email no banco alvo
 *   porque simulator-proposals.js:46 filtra por req.user.email
 *
 * Uso:
 *   node scripts/migrate-simulador-calculadoras.cjs              # dry-run (default)
 *   node scripts/migrate-simulador-calculadoras.cjs --apply      # grava
 *   node scripts/migrate-simulador-calculadoras.cjs --apply --backup-only
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');

const BACKUP_SQL = process.env.SIMULADOR_BACKUP
  || path.join(ROOT, 'BACKUP', 'Simulador', 'backup-producao-FINAL-20261001_120743.sql');

const TARGET_DB = {
  host: process.env.PGHOST || 'localhost',
  port: Number(process.env.PGPORT || 5436),
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'postgres',
  database: process.env.PGDATABASE || 'nexoscrm',
};

const apply = process.argv.includes('--apply');
const backupOnly = process.argv.includes('--backup-only');

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

/**
 * account_manager no dump tem dois formatos:
 *   - objeto {name, email, phone}  (275 linhas)
 *   - string com nome              (16 linhas, só as de VM)
 * Normaliza sempre para {name, email, phone} e corrige emails digitados
 * cruzando com o vendedor dono da proposta.
 */
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

function toIsoOrNull(raw) {
  const v = nul(raw);
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// ─── Migration ───────────────────────────────────────────────────────────────

const DDL_SIMULATOR_PROPOSAL = `
CREATE TABLE IF NOT EXISTS "SimulatorProposal" (
  "id"                  TEXT NOT NULL,
  "baseId"              TEXT NOT NULL,
  "version"             INTEGER NOT NULL DEFAULT 1,
  "title"               TEXT NOT NULL,
  "client"              TEXT NOT NULL,
  "type"                TEXT NOT NULL,
  "value"               DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"              TEXT NOT NULL DEFAULT 'Rascunho',
  "forecastTemperature" DOUBLE PRECISION,
  "metadata"            JSONB,
  "createdBy"           TEXT NOT NULL,
  "accountManager"      TEXT,
  "distributorId"       TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SimulatorProposal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SimulatorProposal_baseId_idx"    ON "SimulatorProposal" ("baseId");
CREATE INDEX IF NOT EXISTS "SimulatorProposal_createdBy_idx" ON "SimulatorProposal" ("createdBy");
CREATE INDEX IF NOT EXISTS "SimulatorProposal_type_idx"      ON "SimulatorProposal" ("type");
`;

async function main() {
  if (!fs.existsSync(BACKUP_SQL)) {
    throw new Error(`Backup não encontrado: ${BACKUP_SQL}`);
  }

  console.log('=== Migração SIMULADOR -> Calculadoras ===');
  console.log(`Origem : ${BACKUP_SQL}`);
  console.log(`Destino: ${TARGET_DB.host}:${TARGET_DB.port}/${TARGET_DB.database}`);
  console.log(`Modo   : ${backupOnly ? 'BACKUP ONLY' : apply ? 'APPLY' : 'DRY-RUN'}\n`);

  const sql = fs.readFileSync(BACKUP_SQL, 'utf-8');

  const proposals = readCopyBlock(sql, 'public.proposals');
  const legacyUsers = readCopyBlock(sql, 'public.users');
  const logs = readCopyBlock(sql, 'public.proposal_logs');

  console.log(`Lido do dump: ${proposals.rows.length} propostas, `
    + `${legacyUsers.rows.length} usuários, ${logs.rows.length} logs\n`);

  if (!proposals.rows.length) {
    console.log('Nenhuma proposta no dump — nada a fazer.');
    return;
  }

  const db = new Client(TARGET_DB);
  await db.connect();

  try {
    // ── Usuários do dump: uuid -> {email, nome} ──────────────────────────────
    const uIdx = (c) => legacyUsers.columns.indexOf(c);
    const legacyUsersById = new Map();
    for (const row of legacyUsers.rows) {
      legacyUsersById.set(row[uIdx('id')], {
        email: row[uIdx('email')],
        role: row[uIdx('role')],
      });
    }

    // Nomes vêm de public.profiles
    const profiles = readCopyBlock(sql, 'public.profiles');
    const pIdx = (c) => profiles.columns.indexOf(c);
    const namesById = new Map();
    for (const row of profiles.rows) {
      namesById.set(row[pIdx('id')], row[pIdx('full_name')]);
    }

    // ── Vendedores: confirmar que existem no "User" do banco alvo ────────────
    const { rows: targetUsers } = await db.query(
      'SELECT id, email, name FROM "User"',
    );
    const targetById = new Map(targetUsers.map((u) => [u.id, u]));
    const targetByEmail = new Map(targetUsers.map((u) => [u.email.toLowerCase(), u]));

    const sellerTally = new Map();
    const skipped = [];

    // ── Logs agrupados por proposal_id (uuid legado) ─────────────────────────
    const logsByProposal = new Map();
    const lIdx = (c) => logs.columns.indexOf(c);
    for (const row of logs.rows) {
      const pid = row[lIdx('proposal_id')];
      const list = logsByProposal.get(pid) || [];
      list.push({
        action: nul(row[lIdx('action')]),
        fieldName: nul(row[lIdx('field_name')]),
        oldValue: nul(row[lIdx('old_value')]),
        newValue: nul(row[lIdx('new_value')]),
        description: nul(row[lIdx('description')]),
        userId: nul(row[lIdx('user_id')]),
        createdAt: toIsoOrNull(row[lIdx('created_at')]),
      });
      logsByProposal.set(pid, list);
    }

    const col = (c) => proposals.columns.indexOf(c);
    const prepared = [];

    for (const row of proposals.rows) {
      const legacyId = nul(row[col('id')]);
      const creatorUuid = nul(row[col('created_by')]);
      const legacyUser = legacyUsersById.get(creatorUuid);
      const sellerEmail = legacyUser?.email;
      const sellerName = namesById.get(creatorUuid) || '';

      if (!sellerEmail) {
        skipped.push({ baseId: nul(row[col('base_id')]), reason: 'created_by sem usuário correspondente' });
        continue;
      }

      // Vendedor precisa existir no "User" do alvo (createdBy = email)
      const targetUser = targetById.get(creatorUuid) || targetByEmail.get(sellerEmail.toLowerCase());
      if (!targetUser) {
        skipped.push({ baseId: nul(row[col('base_id')]), reason: `vendedor ${sellerEmail} não existe no "User"` });
        continue;
      }

      const accountManager = normalizeAccountManager(
        row[col('account_manager')],
        targetUser.email,
        sellerName,
      );

      const products = parseJson(row[col('products')], []) || [];
      const clientData = parseJson(row[col('client_data')], {}) || {};
      const legacyMeta = parseJson(row[col('metadata')], {}) || {};

      // O frontend lê products/clientData/descontos de dentro de metadata
      // (DashboardView.tsx:643), então o payload inteiro vai para lá.
      const metadata = {
        ...legacyMeta,
        products,
        clientData,
        totalSetup: cleanNumber(row[col('total_setup')]),
        totalMonthly: cleanNumber(row[col('total_monthly')]),
        contractPeriod: Number(nul(row[col('contract_period')])) || null,
        proposalDate: toIsoOrNull(row[col('date')]),
        expiryDate: toIsoOrNull(row[col('expiry_date')]),
        distributorId: nul(row[col('distributor_id')]),
        accountManagerData: accountManager,
        sellerUserId: targetUser.id,
        logs: logsByProposal.get(legacyId) || [],
        _legacy: {
          source: 'backup-producao-FINAL-20261001_120743.sql',
          table: 'public.proposals',
          id: legacyId,
          baseId: nul(row[col('base_id')]),
          contractPeriodRaw: nul(row[col('contract_period')]),
          valueRaw: nul(row[col('value')]),
          itemsData: parseJson(row[col('items_data')], []),
        },
      };

      const type = (nul(row[col('type')]) || 'standard').toUpperCase();
      const status = nul(row[col('status')]) || 'Rascunho';
      const monthly = cleanNumber(row[col('total_monthly')]);
      const rawValue = cleanNumber(row[col('value')]);

      sellerTally.set(targetUser.email, (sellerTally.get(targetUser.email) || 0) + 1);

      prepared.push({
        legacyId,
        baseId: nul(row[col('base_id')]),
        version: Number(nul(row[col('version')])) || 1,
        title: nul(row[col('title')]) || 'Proposta',
        client: parseJson(row[col('client')], nul(row[col('client')])) || 'N/A',
        type,
        value: monthly || rawValue,
        status,
        forecastTemperature: typeof legacyMeta.forecastTemperature === 'number'
          ? legacyMeta.forecastTemperature
          : null,
        metadata,
        createdBy: targetUser.email,
        accountManager: JSON.stringify(accountManager),
        distributorId: nul(row[col('distributor_id')]) || '',
        createdAt: toIsoOrNull(row[col('created_at')]) || new Date().toISOString(),
        updatedAt: toIsoOrNull(row[col('updated_at')]) || toIsoOrNull(row[col('created_at')]),
      });
    }

    console.log('--- Propostas por vendedor ( destino ) ---');
    [...sellerTally.entries()]
      .sort((a, b) => b[1] - a[1])
      .forEach(([email, n]) => console.log(`  ${String(n).padStart(4)}  ${email}`));
    console.log(`  ${String(prepared.length).padStart(4)}  TOTAL a gravar`);

    if (skipped.length) {
      console.log(`\n--- Ignoradas (${skipped.length}) ---`);
      skipped.slice(0, 20).forEach((s) => console.log(`  ${s.baseId}: ${s.reason}`));
    }

    const dupes = new Map();
    for (const p of prepared) {
      const key = `${p.baseId}::${p.version}`;
      dupes.set(key, (dupes.get(key) || 0) + 1);
    }
    const dupList = [...dupes.entries()].filter(([, n]) => n > 1);
    console.log(`\nChaves (baseId, version) duplicadas no dump: ${dupList.length}`);

    // ── Estado atual ─────────────────────────────────────────────────────────
    const tableExists = await db.query(
      `SELECT to_regclass('public."SimulatorProposal"') IS NOT NULL AS exists`,
    );
    console.log(`Tabela "SimulatorProposal" existe: ${tableExists.rows[0].exists}`);

    let current = 0;
    if (tableExists.rows[0].exists) {
      const c = await db.query('SELECT COUNT(*)::int AS n FROM "SimulatorProposal"');
      current = c.rows[0].n;
    }
    console.log(`Registros já existentes em "SimulatorProposal": ${current}`);

    if (backupOnly) {
      console.log('\n--backup-only: nada foi gravado.');
      return;
    }

    if (!apply) {
      console.log('\n=== DRY-RUN: nenhuma alteração feita. Use --apply para gravar. ===');
      return;
    }

    // ── Backup da tabela alvo antes de mexer ────────────────────────────────
    await db.query(DDL_SIMULATOR_PROPOSAL);
    console.log('\nDDL aplicado (CREATE TABLE/INDEX IF NOT EXISTS em "SimulatorProposal").');

    if (current > 0) {
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(ROOT, 'BACKUP', `simulatorproposal-antes-migracao-${ts}.json`);
      const { rows: existing } = await db.query('SELECT * FROM "SimulatorProposal"');
      fs.writeFileSync(file, JSON.stringify(existing, null, 2));
      console.log(`Backup de "SimulatorProposal" salvo em: ${file} (${existing.length} linhas)`);
    }

    // ── Upsert por (baseId, version) ────────────────────────────────────────
    const INSERT = `
      INSERT INTO "SimulatorProposal"
        ("id","baseId","version","title","client","type","value","status",
         "forecastTemperature","metadata","createdBy","accountManager",
         "distributorId","createdAt","updatedAt")
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15)
      ON CONFLICT ("id") DO NOTHING
    `;

    const { rows: existingRows } = await db.query(
      'SELECT id, "baseId", version FROM "SimulatorProposal"',
    );
    const byKey = new Map(existingRows.map((r) => [`${r.baseId}::${r.version}`, r.id]));

    let inserted = 0;
    let updated = 0;
    let untouched = 0;

    await db.query('BEGIN');
    try {
      for (const p of prepared) {
        const key = `${p.baseId}::${p.version}`;
        const existingId = byKey.get(key);

        if (existingId) {
          // Já existe essa (baseId, version): só completa o que estiver faltando
          // (expiryDate, logs, totalSetup...), sem sobrescrever edições do CRM.
          const { rows: cur } = await db.query(
            'SELECT metadata FROM "SimulatorProposal" WHERE id = $1',
            [existingId],
          );
          const curMeta = parseJson(cur[0]?.metadata, {}) || {};
          const patch = {};
          for (const field of ['expiryDate', 'totalSetup', 'totalMonthly', 'contractPeriod', 'logs']) {
            const incoming = p.metadata[field];
            const missing = incoming != null
              && (Array.isArray(incoming) ? incoming.length > 0 : true);
            if (missing && (curMeta[field] == null
              || (Array.isArray(curMeta[field]) && curMeta[field].length === 0))) {
              patch[field] = incoming;
            }
          }
          if (!Object.keys(patch).length) { untouched += 1; continue; }

          await db.query(
            `UPDATE "SimulatorProposal"
                SET metadata = metadata || $2::jsonb,
                    "accountManager" = COALESCE("accountManager", $3)
              WHERE id = $1`,
            [existingId, JSON.stringify(patch), p.accountManager],
          );
          updated += 1;
          continue;
        }

        await db.query(INSERT, [
          p.legacyId,
          p.baseId,
          p.version,
          p.title,
          String(p.client),
          p.type,
          p.value,
          p.status,
          p.forecastTemperature,
          JSON.stringify(p.metadata),
          p.createdBy,
          p.accountManager,
          p.distributorId,
          p.createdAt,
          p.updatedAt,
        ]);
        byKey.set(key, p.legacyId);
        inserted += 1;
      }
      await db.query('COMMIT');
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }

    console.log(`\nInseridas: ${inserted} | Complementadas: ${updated} | Sem mudança: ${untouched}`);

    // ── Verificação ──────────────────────────────────────────────────────────
    const after = await db.query(`
      SELECT "createdBy" AS vendedor, type, COUNT(*)::int AS n
        FROM "SimulatorProposal"
       GROUP BY 1, 2
       ORDER BY 1, 2
    `);
    console.log('\n--- Verificação: "SimulatorProposal" por vendedor x tipo ---');
    let grand = 0;
    for (const r of after.rows) {
      console.log(`  ${String(r.n).padStart(4)}  ${r.vendedor}  ${r.type}`);
      grand += r.n;
    }
    console.log(`  ${String(grand).padStart(4)}  TOTAL`);

    const orphan = await db.query(`
      SELECT COUNT(*)::int AS n FROM "SimulatorProposal" sp
       WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE lower(u.email) = lower(sp."createdBy"))
    `);
    console.log(`\nPropostas com vendedor inexistente no "User": ${orphan.rows[0].n}`);
  } finally {
    await db.end();
  }
}

main().catch((err) => {
  console.error('\n❌ Falhou:', err.message);
  process.exit(1);
});
