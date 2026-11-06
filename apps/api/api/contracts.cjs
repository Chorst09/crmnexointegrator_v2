const path = require('node:path');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth.cjs');
const { createContractsRouter } = require('../lib/contracts-router.cjs');
module.exports = createContractsRouter({ prisma, authenticateToken, uploadDir: path.resolve(__dirname, '../private-uploads/contracts') });
