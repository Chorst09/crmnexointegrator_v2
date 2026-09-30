const normalizeRole = (user = {}) => String(user.actualRole || user.role || '').trim().toUpperCase();

export const isMasterUser = (user = {}) => normalizeRole(user) === 'MASTER';

export const getTenantCompanyId = (user = {}) => {
  if (!user || isMasterUser(user)) return null;
  return String(user.tenantCompanyId || '').trim() || null;
};

export const tenantScopedWhere = (user = {}) => {
  const tenantCompanyId = getTenantCompanyId(user);
  return tenantCompanyId ? { tenantCompanyId } : {};
};

export const mergeRelationWhere = (where = {}, relationName, relationWhere = {}) => ({
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

export const isTenantRecordVisible = (user = {}, record = {}) => {
  const tenantCompanyId = getTenantCompanyId(user);
  if (!tenantCompanyId) return true;
  return String(record?.tenantCompanyId || '') === tenantCompanyId;
};

export const forbiddenTenantResponse = () => new Response('Forbidden', { status: 403 });
