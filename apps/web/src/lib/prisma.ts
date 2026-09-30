import { PrismaClient } from '@prisma/client'
import { resolveDatabaseUrl } from './database-url'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Verificar se DATABASE_URL está configurada (apenas aviso, não erro)
if (!process.env.DATABASE_URL) {
  console.warn('⚠️ DATABASE_URL não está configurada - isso é esperado durante o build');
}

const resolvedDatabaseUrl = resolveDatabaseUrl()

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error', 'warn'],
    errorFormat: 'pretty',
    ...(resolvedDatabaseUrl
      ? {
          // Override runtime datasource URL to avoid "localhost" issues inside containers.
          datasources: { db: { url: resolvedDatabaseUrl } },
        }
      : {}),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
