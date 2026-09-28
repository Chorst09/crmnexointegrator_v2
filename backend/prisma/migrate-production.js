const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🗄️  Executando setup inicial do banco...');

  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Opportunity"
        ADD COLUMN IF NOT EXISTS "projectName" TEXT,
        ADD COLUMN IF NOT EXISTS "projectClientType" TEXT,
        ADD COLUMN IF NOT EXISTS "projectType" TEXT NOT NULL DEFAULT 'SINGLE',
        ADD COLUMN IF NOT EXISTS "projectMonths" INTEGER;
    `);
    await prisma.$executeRawUnsafe(`
      UPDATE "Opportunity"
        SET "projectName" = "title"
        WHERE "projectName" IS NULL;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Commission"
        ADD COLUMN IF NOT EXISTS "calculationBase" DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS "projectType" TEXT NOT NULL DEFAULT 'SINGLE',
        ADD COLUMN IF NOT EXISTS "projectMonths" INTEGER;
    `);
    console.log('✅ Colunas de comissionamento por projeto verificadas');

    // Verificar se já existe usuário admin
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@nexoscrm.com' }
    });

    if (existingAdmin) {
      console.log('✅ Usuário admin já existe');
    } else {
      // Criar usuário administrador com senha injetada pelo ambiente de produção.
      const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
      if (!adminPassword) {
        throw new Error('ADMIN_PASSWORD precisa estar configurado para criar o admin inicial');
      }
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      
      const admin = await prisma.user.create({
        data: {
          name: 'Administrador',
          email: 'admin@nexoscrm.com',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });

      console.log('✅ Usuário admin criado:', admin.email);
    }

    // Criar configurações padrão do sistema
    const settings = [
      { key: 'company_name', value: 'NexosCRM' },
      { key: 'company_logo', value: '' },
      { key: 'default_currency', value: 'BRL' },
      { key: 'default_timezone', value: 'America/Sao_Paulo' },
      { key: 'email_notifications', value: 'true' },
      { key: 'system_version', value: '1.0.0' }
    ];

    for (const setting of settings) {
      await prisma.systemSetting.upsert({
        where: { key: setting.key },
        update: {},
        create: setting
      });
    }

    console.log('✅ Configurações do sistema criadas');

    // Criar região padrão
    await prisma.region.upsert({
      where: { code: 'BR-DEFAULT' },
      update: {},
      create: {
        name: 'Brasil - Padrão',
        code: 'BR-DEFAULT',
        country: 'Brasil',
        isActive: true
      }
    });

    console.log('✅ Região padrão criada');

    console.log('🎉 Setup inicial concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no setup:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
