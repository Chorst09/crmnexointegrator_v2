const path = require('node:path');
const { prisma } = require('../lib/prisma.cjs');
const { authenticateToken } = require('../lib/auth');
const { canViewCompany } = require('../lib/company-visibility.cjs');
const { createCompanyDocumentsRouter } = require('../lib/company-documents-router.cjs');

module.exports = createCompanyDocumentsRouter({
  prisma, authenticateToken, canViewCompany, opportunityMode: true,
  contractUploadDir: path.resolve(__dirname, '../private-uploads/contracts'),
  uploadDir: path.resolve(__dirname, '../private-uploads/companies')
});
