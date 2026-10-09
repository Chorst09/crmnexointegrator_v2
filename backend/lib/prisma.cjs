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
let isShuttingDown = false;
const disconnectPrisma = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    console.log('🔄 Desconectando Prisma...');
    await prisma.$disconnect();
    console.log('✅ Prisma desconectado');
    process.exit(0);
  } catch (error) {
    console.error(`Erro ao desconectar Prisma após ${signal}:`, error);
    process.exit(1);
  }
};

process.once('SIGTERM', () => disconnectPrisma('SIGTERM'));
process.once('SIGINT', () => disconnectPrisma('SIGINT'));

module.exports = { prisma };
