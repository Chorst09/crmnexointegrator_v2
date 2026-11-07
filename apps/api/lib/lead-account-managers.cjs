const { isMaster, normalizeRole } = require('./permissions.cjs');

async function listLeadAccountManagers(prisma, user = {}, clientType = 'B2B') {
  const id = user.userId || user.id;
  if (!id) return [];
  const elevated = isMaster(user) || normalizeRole(user.actualRole || user.role) === 'ADMIN';
  const sellers = await prisma.user.findMany({
    where: {
      tenantCompanyId: user.tenantCompanyId || null,
      ...(elevated
        ? { role: { in: ['SELLER', 'USER', 'USER_B2B', 'ADMIN', 'MASTER', 'MANAGER', 'DIRECTOR'] } }
        : { id }),
      ...(clientType === 'B2G' ? { accessB2G: true } : { accessB2B: true }),
    },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, email: true,
      opportunities: { where: { stage: { notIn: ['WON', 'LOST'] } }, select: { value: true } },
    },
  });
  return sellers.map(({ opportunities, ...seller }) => ({
    ...seller, activeOpportunities: opportunities.length,
    totalValue: opportunities.reduce((sum, opportunity) => sum + (opportunity.value || 0), 0),
  }));
}

module.exports = { listLeadAccountManagers };
