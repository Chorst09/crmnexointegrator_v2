'use strict';

// These routes use models declared in apps/api/prisma/schema.prisma.
// The legacy backend client does not contain these models.
const { PrismaClient } = require('@prisma/client');

const databaseUrl = new URL(process.env.DATABASE_URL);
if (!databaseUrl.searchParams.has('connection_limit')) databaseUrl.searchParams.set('connection_limit', '3');
if (!databaseUrl.searchParams.has('pool_timeout')) databaseUrl.searchParams.set('pool_timeout', '15');

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl.toString() } }
});

module.exports = { prisma };
