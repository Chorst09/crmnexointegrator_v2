const { ownCompaniesOnly } = require('./company-visibility.cjs');

async function resolveCompanyAssignment(prisma, user, body, tenantCompanyId, creating) {
  const restricted = ownCompaniesOnly(user) && (body.clientType || 'B2B') === 'B2B';
  const selfId = user.userId || user.id;
  if (restricted && body.accountManagerId && body.accountManagerId !== selfId) {
    return { error: 'Você só pode atribuir empresas B2B a si mesmo.' };
  }
  const id = restricted ? selfId : body.accountManagerId;
  if (!restricted && !creating && id === undefined) return { data: {} };
  if (!id) return { data: { accountManagerId: null, accountManagerName: null, accountManagerEmail: null, accountManagerPhone: null, accountManagerPosition: null } };
  // Legacy global records have no tenant. Resolve their owner within the
  // acting user's tenant; scoped records always retain their original boundary.
  const ownerTenant = tenantCompanyId || user.tenantCompanyId || null;
  const owner = await prisma.user.findFirst({
    where: { id, tenantCompanyId: ownerTenant },
    select: { id: true, name: true, email: true, phone: true, role: true }
  });
  if (!owner) return { error: 'Responsável inválido para esta empresa.' };
  return { data: { accountManagerId: owner.id, accountManagerName: owner.name, accountManagerEmail: owner.email || null, accountManagerPhone: owner.phone || null, accountManagerPosition: owner.role || null } };
}

module.exports = { resolveCompanyAssignment };
