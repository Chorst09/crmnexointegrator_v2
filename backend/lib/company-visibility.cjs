const { normalizeRole, isMaster } = require('./permissions.cjs');

function ownCompaniesOnly(user = {}) {
  const role = normalizeRole(user.actualRole || user.role);
  if (isMaster(user) || role === 'ADMIN') return false;
  const configured = user.permissions?.somenteSuasEmpresas ?? user.permissions?.ownCompaniesOnly;
  return configured !== undefined ? Boolean(configured) : ['USER', 'SELLER'].includes(role);
}

// Explicit account ownership takes precedence over legacy opportunity ownership.
function companyVisibilityWhere(user = {}) {
  if (!ownCompaniesOnly(user)) return {};
  const userId = user.userId || user.id;
  if (!userId) return { clientType: 'B2G' };
  return { OR: [
    { clientType: 'B2G' },
    { accountManagerId: userId },
    { accountManagerId: null, opportunities: { some: { ownerId: userId } } }
  ] };
}

async function canViewCompany(prisma, user, id) {
  const tenant = !isMaster(user) && user.tenantCompanyId ? { tenantCompanyId: user.tenantCompanyId } : {};
  return Boolean(await prisma.company.findFirst({
    where: { id, ...tenant, ...companyVisibilityWhere(user) }, select: { id: true }
  }));
}

module.exports = { ownCompaniesOnly, companyVisibilityWhere, canViewCompany };
