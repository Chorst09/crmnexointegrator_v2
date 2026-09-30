const { PrismaClient } = require('@prisma/client');

const prismaOptions = {
  log: process.env.NODE_ENV !== 'production' ? ['query', 'warn', 'error'] : ['warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
};

// Connection pool configuration via DATABASE_URL parameters
const rawUrl = process.env.DATABASE_URL || '';
if (rawUrl && !rawUrl.includes('connection_limit=')) {
  const separator = rawUrl.includes('?') ? '&' : '?';
  prismaOptions.datasources.db.url =
    `${rawUrl}${separator}connection_limit=10&pool_timeout=15&pgbouncer=true&statement_cache_size=0`;
}

const prisma = global.__nexosPrisma || new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== 'production') {
  global.__nexosPrisma = prisma;
}

// Graceful shutdown
const disconnectPrisma = async () => {
  console.log('🔄 Desconectando Prisma...');
  await prisma.$disconnect();
  console.log('✅ Prisma desconectado');
};

process.on('SIGTERM', disconnectPrisma);
process.on('SIGINT', disconnectPrisma);

module.exports = { prisma };
