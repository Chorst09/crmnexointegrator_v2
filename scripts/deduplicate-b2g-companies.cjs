/**
 * Deduplica órgãos B2G duplicados/triplicados no portal de busca
 * Agrupa por nome normalizado (sem acento, lowercase) e CNPJ, mantém o mais antigo
 * Move oportunidades, atividades, contratos, etc. para o registro mantido
 * Uso: node scripts/deduplicate-b2g-companies.cjs [--dry-run]
 */

const { PrismaClient } = require('../backend/node_modules/@prisma/client');
const prisma = new PrismaClient();

const normalize = (v) =>
  String(v || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const dryRun = process.argv.includes('--dry-run');

async function main() {
  console.log(`=== Deduplicação B2G Órgãos ${dryRun ? '(DRY-RUN)' : ''} ===`);

  const companies = await prisma.company.findMany({
    where: { clientType: 'B2G' },
    select: { id: true, name: true, document: true, createdAt: true, city: true, state: true }
  });

  console.log(`Total B2G: ${companies.length}`);

  // Agrupa por chave normalizada: CNPJ se houver, senão nome normalizado
  const groups = new Map();
  for (const c of companies) {
    const key = c.document
      ? `doc:${String(c.document).replace(/\D/g, '')}`
      : `name:${normalize(c.name)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  let duplicates = 0;
  let toDelete = [];

  for (const [key, list] of groups.entries()) {
    if (list.length > 1) {
      // Ordena por createdAt mais antigo primeiro (mantém o primeiro)
      list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const keep = list[0];
      const dups = list.slice(1);
      console.log(`\nDuplicado: "${keep.name}" (${key}) - ${list.length}x`);
      console.log(`  Mantém: ${keep.id} (${keep.createdAt.toISOString().slice(0,10)})`);
      for (const dup of dups) {
        console.log(`  Duplicado: ${dup.id} (${dup.createdAt.toISOString().slice(0,10)}) - ${dup.name}`);
        toDelete.push({ keep, dup });
      }
      duplicates += dups.length;
    }
  }

  console.log(`\n=== Resumo ===`);
  console.log(`Grupos duplicados: ${[...groups.values()].filter(l => l.length > 1).length}`);
  console.log(`Registros duplicados para remover: ${duplicates}`);

  if (dryRun) {
    console.log('\nDRY-RUN: nenhuma alteração feita. Rode sem --dry-run para aplicar.');
    return;
  }

  if (toDelete.length === 0) {
    console.log('Nenhum duplicado encontrado.');
    return;
  }

  for (const { keep, dup } of toDelete) {
    console.log(`\nMigrando ${dup.id} -> ${keep.id} (${dup.name})`);
    await prisma.$transaction(async (tx) => {
      // Mover oportunidades
      await tx.opportunity.updateMany({ where: { companyId: dup.id }, data: { companyId: keep.id } });
      // Mover atividades
      await tx.activity.updateMany({ where: { companyId: dup.id }, data: { companyId: keep.id } });
      // Mover contratos
      await tx.contract.updateMany({ where: { companyId: dup.id }, data: { companyId: keep.id } });
      // Mover contatos
      await tx.contact.updateMany({ where: { companyId: dup.id }, data: { companyId: keep.id } });
      // Outras tabelas opcionais
      try { await tx.preSalesRequest.updateMany({ where: { leadId: dup.id }, data: { leadId: keep.id } }); } catch {}
      try { await tx.companyDocument.deleteMany({ where: { companyId: dup.id } }); } catch {}
      try { await tx.supportTicket.updateMany({ where: { companyId: dup.id }, data: { companyId: keep.id } }); } catch {}
      try { await tx.nPSSurvey.updateMany({ where: { companyId: dup.id }, data: { companyId: keep.id } }); } catch {}
      try { await tx.customerOnboarding.updateMany({ where: { companyId: dup.id }, data: { companyId: keep.id } }); } catch {}
      try { await tx.churnAlert.deleteMany({ where: { companyId: dup.id } }); } catch {}

      // Deletar duplicado
      await tx.contact.deleteMany({ where: { companyId: dup.id } });
      await tx.company.delete({ where: { id: dup.id } });
    });
    console.log(`  ✓ Migrado e removido ${dup.id}`);
  }

  console.log(`\n✓ Concluído. ${duplicates} registros removidos.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
