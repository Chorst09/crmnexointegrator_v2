#!/usr/bin/env node
/**
 * Script para migrar dados de segment para clientType
 * Funciona com arquitetura multi-tenant (cada empresa tem seu banco)
 * 
 * USO:
 * 1. Certifique-se que a migration do Prisma já foi aplicada
 * 2. Execute: node scripts/migrate-client-type.cjs
 */

const { PrismaClient } = require('@prisma/client');

async function migrateClientType() {
  console.log('🔄 Iniciando migração de clientType...\n');
  console.log('⚠️  IMPORTANTE: Este script migra dados no banco atual');
  console.log('   Em arquitetura multi-tenant, execute para cada tenant\n');

  const prisma = new PrismaClient();

  try {
    // 1. Verificar se o campo clientType existe
    try {
      await prisma.$queryRaw`SELECT "clientType" FROM "Company" LIMIT 1`;
      console.log('✅ Campo clientType encontrado no schema\n');
    } catch (error) {
      console.error('❌ Campo clientType não existe. Execute a migration primeiro:');
      console.error('   npx prisma migrate dev --name add_client_type\n');
      process.exit(1);
    }

    // 2. Contar empresas antes da migração
    const totalCompanies = await prisma.company.count();
    console.log(`📊 Total de empresas no banco: ${totalCompanies}`);

    if (totalCompanies === 0) {
      console.log('⚠️  Nenhuma empresa encontrada. Nada a migrar.');
      await prisma.$disconnect();
      return;
    }

    // 3. Migrar empresas B2G baseado em segment
    const b2gPatterns = ['B2G', 'GOVERNO', 'PUBLICO', 'PÚBLICO', 'EDITAL', 'LICITACAO', 'LICITAÇÃO'];
    
    let b2gCount = 0;
    for (const pattern of b2gPatterns) {
      const result = await prisma.company.updateMany({
        where: {
          segment: { contains: pattern, mode: 'insensitive' },
          clientType: 'B2B' // Só atualiza se ainda for B2B (default)
        },
        data: { clientType: 'B2G' }
      });
      b2gCount += result.count;
    }

    console.log(`✅ ${b2gCount} empresas migradas para B2G`);

    // 4. Verificar distribuição final
    const distribution = await prisma.company.groupBy({
      by: ['clientType'],
      _count: { clientType: true }
    });

    console.log('\n📊 Distribuição final:');
    distribution.forEach(item => {
      console.log(`   ${item.clientType}: ${item._count.clientType} empresas`);
    });

    // 5. Listar algumas empresas B2G para validação
    const sampleB2G = await prisma.company.findMany({
      where: { clientType: 'B2G' },
      select: { id: true, name: true, segment: true, clientType: true },
      take: 5
    });

    if (sampleB2G.length > 0) {
      console.log('\n📋 Amostra de empresas B2G:');
      sampleB2G.forEach(company => {
        console.log(`   - ${company.name} (segment: ${company.segment || 'N/A'})`);
      });
    }

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n💡 Próximos passos:');
    console.log('   1. Reinicie o servidor backend');
    console.log('   2. Teste a detecção de churn com empresas B2G');
    console.log('   3. Verifique os filtros no frontend\n');

  } catch (error) {
    console.error('❌ Erro na migração:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  migrateClientType();
}

module.exports = { migrateClientType };
