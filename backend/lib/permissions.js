const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return 'USER';
  const r = role.toUpperCase();
  return ['MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR', 'SELLER', 'PRE_SALES', 'USER'].includes(r) ? r : 'USER';
};

const isMaster = (user) => normalizeRole(user.actualRole || user.role) === 'MASTER';

const canAccessModule = (user = {}, moduleName) => {
  if (!user) return false;
  if (isMaster(user)) return true;

  const role = normalizeRole(user.actualRole || user.role);
  const moduleUpper = String(moduleName || '').trim().toUpperCase();

  if (role === 'ADMIN' || role === 'MANAGER' || role === 'DIRECTOR') {
    if (moduleUpper === 'PRE_SALES') return role !== 'DIRECTOR';
    return true;
  }

  if (role === 'PRE_SALES') return moduleUpper === 'PRE_SALES';

  const accessB2B = Boolean(user.accessB2B);
  const accessB2G = Boolean(user.accessB2G);
  const accessPreSales = Boolean(user.accessPreSales);

  if (moduleUpper === 'B2B') return accessB2B;
  if (moduleUpper === 'B2G') return accessB2G;
  if (moduleUpper === 'PRE_SALES') return accessPreSales;

  return true;
};

module.exports = { canAccessModule, normalizeRole, isMaster };
