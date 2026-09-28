import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { prisma: prismaInstance } = require('./prisma.cjs');

export const prisma = prismaInstance;
export default prisma;
