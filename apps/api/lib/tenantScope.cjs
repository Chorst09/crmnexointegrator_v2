const normalizeRole = (user = {}) => String(user.actualRole || user.role || '').trim().toUpperCase();

const isMasterUser = (user = {}) => normalizeRole(user) === 'MASTER';

const getTenantCompanyId = (user = {}) => {
  if (!user || isMasterUser(user)) return null;
  return String(user.tenantCompanyId || '').trim() || null;
};

const tenantScopedWhere = (user = {}) => {
  const tenantCompanyId = getTenantCompanyId(user);
  return tenantCompanyId ? { tenantCompanyId } : {};
};

const isTenantRecordVisible = (user = {}, record = {}) => {
  const tenantCompanyId = getTenantCompanyId(user);
  if (!tenantCompanyId) return true;
  return String(record?.tenantCompanyId || '') === tenantCompanyId;
};

const mergeRelationWhere = (where = {}, relationName, relationWhere = {}) => ({
  ...where,
  [relationName]: {
    ...(
      where[relationName] && typeof where[relationName] === 'object' && !Array.isArray(where[relationName])
        ? where[relationName]
        : {}
    ),
    ...relationWhere
  }
});

module.exports = {
  getTenantCompanyId,
  isMasterUser,
  isTenantRecordVisible,
  mergeRelationWhere,
  normalizeRole,
  tenantScopedWhere
};
