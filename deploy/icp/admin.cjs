'use strict';
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');
const apiRequire = createRequire(require('node:path').resolve('/app/apps/api/package.json'));
const { PrismaClient } = apiRequire('@prisma/client');
const bcrypt = apiRequire('bcryptjs');
const url = new URL(process.env.DATABASE_URL);
if (decodeURIComponent(url.pathname.slice(1)) !== 'nexos_icp') throw new Error('Only the exclusive nexos_icp database is allowed');
async function main() {
  const command = process.argv[2];
  if (command === 'init-empty') {
    const sql = fs.readFileSync('/app/apps/api/prisma/icp-install.sql', 'utf8');
    const guard = `BEGIN; SELECT pg_advisory_xact_lock(19372026);
      DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public')
        OR EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public')
      THEN RAISE EXCEPTION 'Database is not empty; installation refused'; END IF;
      END $$;`;
    const result = spawnSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-q'], {
      input: guard + '\n' + sql + '\nCOMMIT;\n', encoding: 'utf8',
      env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432',
        PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password), PGDATABASE: 'nexos_icp' }
    });
    if (result.status !== 0) throw new Error('Atomic installation failed; no changes committed.');
    console.log('Empty database initialized atomically. No accounts or customer data seeded.');
    return;
  }
  if (command !== 'owner') throw new Error('Usage: init-empty | owner EMAIL');
  const email = String(process.argv[3] || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Valid owner email required');
  const password = fs.readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (password.length < 12) throw new Error('Password needs at least 12 characters');
  const prisma = new PrismaClient();
  try {
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(19372026)`;
      const existing = await tx.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
      if (existing && (existing.role !== 'MASTER' || existing.tenantCompanyId)) throw new Error('Existing organization account preserved');
      const data = { password: await bcrypt.hash(password, 12), role: 'MASTER', isCompanyOwner: true,
        accessB2B: true, accessB2G: true, accessPreSales: true, accessManagement: true, accessAutomation: true };
      if (existing) await tx.user.update({ where: { id: existing.id }, data });
      else await tx.user.create({ data: { ...data, email, name: 'Proprietário Nexos' } });
    });
    console.log('Global MASTER owner saved with bcrypt. No billing or tenant data changed.');
  } finally { await prisma.$disconnect(); }
}
main().catch(() => { console.error('Administrative operation refused or failed; no credentials logged.'); process.exitCode = 1; });
