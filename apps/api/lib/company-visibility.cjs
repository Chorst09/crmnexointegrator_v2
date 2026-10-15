const { isMaster, normalizeRole, getPermissionTemplate } = require('./permissions.cjs');

function restrictOwnCompanies(user = {}) {
  const role = normalizeRole(user.actualRole || user.role);
  if (isMaster(user) || ['ADMIN', 'MANAGER', 'DIRECTOR'].includes(role)) return false;
  return Boolean(user.permissions?.ownCompaniesOnly ?? getPermissionTemplate(role).ownCompaniesOnly);
}

// Explicit responsibility takes precedence; older unassigned records use opportunity ownership.
function companyOwnershipWhere(user = {}) {
  if (!restrictOwnCompanies(user)) return {};
  const userId = user.userId || user.id;
  if (!userId) return { clientType: 'B2G' };
  return { OR: [
    { clientType: 'B2G' },
    { accountManagerId: userId },
    { accountManagerId: null, opportunities: { some: { ownerId: userId } } }
  ] };
}

async function canAccessOwnedCompany(prisma, user, companyId) {
  if (isMaster(user)) return true;
  return Boolean(await prisma.company.findFirst({
    where: { id: companyId, ...(user?.tenantCompanyId ? { tenantCompanyId: user.tenantCompanyId } : {}), ...companyOwnershipWhere(user) }, select: { id: true }
  }));
}

function companyResponsibility(user = {}, body = {}, creating = false) {
  const role = normalizeRole(user.actualRole || user.role);
  // Sellers cannot transfer responsibility through a forged payload.
  if (!isMaster(user) && !['ADMIN', 'MANAGER', 'DIRECTOR'].includes(role)) {
    return creating ? { accountManagerId: user.userId || user.id, accountManagerName: user.name || user.email || null } : {};
  }
  return {
    accountManagerId: body.accountManagerId !== undefined ? body.accountManagerId || null : undefined,
    accountManagerName: body.accountManagerName !== undefined ? body.accountManagerName || null : undefined
  };
}

module.exports = { restrictOwnCompanies, companyOwnershipWhere, canAccessOwnedCompany, companyResponsibility };
