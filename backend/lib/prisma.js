// Share the same bounded pool with the CommonJS routes.
import shared from './prisma.cjs';

export const prisma = shared.prisma;
