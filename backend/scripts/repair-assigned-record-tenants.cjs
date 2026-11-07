#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

// Repair only missing tenant scopes. Non-null disagreements require review.
function planRepairs(rows, owner) {
  const repairs = [];
  const conflicts = [];
  for (const { model, record } of rows) {
    const field = model === 'opportunity' ? 'ownerId' : 'assignedToId';
    if (record[field] !== owner.id) throw new Error('Registro de outro responsável na auditoria');
    if (record.tenantCompanyId === owner.tenantCompanyId) continue;
    const links = [record.company, record.opportunity].filter(Boolean);
    if (record.tenantCompanyId || links.some(link => link.tenantCompanyId && link.tenantCompanyId !== owner.tenantCompanyId)) {
      conflicts.push({ model, id: record.id, tenantCompanyId: record.tenantCompanyId, reason: 'Tenant divergente; revisão manual necessária' });
      continue;
    }
    if (!owner.tenantCompanyId) throw new Error('Responsável sem tenant; recuperação ambígua');
    repairs.push({ model, id: record.id, field, ownerId: owner.id, updatedAt: record.updatedAt, tenantCompanyId: owner.tenantCompanyId });
  }
  return { repairs, conflicts };
}

async function audit(prisma, email) {
  const owner = await prisma.user.findUnique({
    where: { email }, select: { id: true, email: true, tenantCompanyId: true }
  });
  if (!owner?.tenantCompanyId) throw new Error('Responsável inexistente ou sem tenant');
  const [opportunities, activities] = await Promise.all([
    prisma.opportunity.findMany({ where: { ownerId: owner.id }, include: { company: { select: { tenantCompanyId: true } } } }),
    prisma.activity.findMany({ where: { assignedToId: owner.id }, include: {
      company: { select: { tenantCompanyId: true } }, opportunity: { select: { tenantCompanyId: true } }
    } }),
  ]);
  const rows = [
    ...opportunities.map(record => ({ model: 'opportunity', record })),
    ...activities.map(record => ({ model: 'activity', record })),
  ];
  return { owner, rows, ...planRepairs(rows, owner) };
}

async function applyRepairs(prisma, snapshot, backupDir) {
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backup = path.join(backupDir, `assigned-records-${Date.now()}.json`);
  fs.writeFileSync(backup, JSON.stringify(snapshot, null, 2), { mode: 0o600, flag: 'wx' });
  await prisma.$transaction(async tx => {
    for (const repair of snapshot.repairs) {
      const result = await tx[repair.model].updateMany({
        where: {
          id: repair.id, tenantCompanyId: null, [repair.field]: repair.ownerId,
          updatedAt: repair.updatedAt,
          [repair.model === 'opportunity' ? 'owner' : 'assignedTo']: { tenantCompanyId: repair.tenantCompanyId },
        },
        data: { tenantCompanyId: repair.tenantCompanyId, updatedAt: repair.updatedAt },
      });
      if (result.count !== 1) throw new Error(`Registro alterado desde a auditoria: ${repair.model}/${repair.id}; transação revertida`);
    }
  });
  return backup;
}

async function main() {
  const args = process.argv.slice(2);
  const email = args.find(arg => arg.startsWith('--owner-email='))?.slice('--owner-email='.length);
  const backupDir = args.find(arg => arg.startsWith('--backup-dir='))?.slice('--backup-dir='.length);
  if (!email || (args.includes('--apply') && !backupDir)) {
    throw new Error('Uso: node --env-file=.env scripts/repair-assigned-record-tenants.cjs --owner-email=email [--apply --backup-dir=/caminho/seguro]');
  }
  const { prisma } = require('../lib/prisma.cjs');
  try {
    const snapshot = await audit(prisma, email);
    console.log(JSON.stringify({ owner: snapshot.owner, repairs: snapshot.repairs, conflicts: snapshot.conflicts }, null, 2));
    if (args.includes('--apply')) console.log(`Backup: ${await applyRepairs(prisma, snapshot, backupDir)}`);
    else console.log('Auditoria apenas. Nenhum registro alterado.');
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { planRepairs, audit, applyRepairs };
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
