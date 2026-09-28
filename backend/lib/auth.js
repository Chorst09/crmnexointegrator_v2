
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { normalizeRole, resolveUserAccess, getPermissionTemplate, isMaster } = require('./permissions.cjs');

const prisma = new PrismaClient();
const JWT_SECRET = (() => {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET precisa estar configurado');
  return secret;
})();

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token de acesso requerido' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }

    const userId = decoded?.userId || decoded?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Token inválido ou expirado' });
    }

    // Buscar usuário no banco de dados
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        regionId: true,
        tenantCompanyId: true,
        accessB2B: true,
        accessB2G: true,
        accessPreSales: true,
        accessManagement: true,
        accessAutomation: true,
        tenantCompany: {
          select: {
            status: true,
            accessB2B: true,
            accessB2G: true,
            accessPreSales: true,
            accessManagement: true,
            accessAutomation: true,
            rolePolicyOverrides: true
          }
        },
        permissionOverrides: true,
        isCompanyOwner: true
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado' });
    }

    const actualRole = normalizeRole(user.role);
    if (!isMaster({ actualRole }) && user.tenantCompany && user.tenantCompany.status !== 'ACTIVE') {
      const statusMessages = {
        PROSPECT: 'Empresa aguardando aprovação do usuário MASTER',
        SUSPENDED: 'Empresa suspensa. Entre em contato com o suporte.',
        CANCELED: 'Empresa cancelada. Entre em contato com o suporte.'
      };
      return res.status(403).json({
        error: statusMessages[user.tenantCompany.status] || 'Empresa não está liberada para acesso'
      });
    }

    const legacyRole = actualRole === 'USER' ? 'SELLER' : actualRole;
    const tenantAccess = user.tenantCompany;
    const tenantPolicies =
      tenantAccess?.rolePolicyOverrides && typeof tenantAccess.rolePolicyOverrides === 'object'
        ? tenantAccess.rolePolicyOverrides
        : {};
    const policyRole = actualRole === 'SELLER' ? 'USER' : actualRole;
    const rolePolicy = tenantPolicies[policyRole] && typeof tenantPolicies[policyRole] === 'object' ? tenantPolicies[policyRole] : {};
    const rolePolicyAccess = rolePolicy.moduleAccess && typeof rolePolicy.moduleAccess === 'object' ? rolePolicy.moduleAccess : {};
    const rolePolicyPermissions = rolePolicy.permissions && typeof rolePolicy.permissions === 'object' ? rolePolicy.permissions : {};
    const access = resolveUserAccess(actualRole, { ...user, ...rolePolicyAccess });
    const effectiveAccess = isMaster({ actualRole })
      ? access
      : tenantAccess
        ? {
            accessB2B: Boolean(access.accessB2B && tenantAccess.accessB2B),
            accessB2G: Boolean(access.accessB2G && tenantAccess.accessB2G),
            accessPreSales: Boolean(access.accessPreSales && tenantAccess.accessPreSales),
            accessManagement: Boolean(access.accessManagement && tenantAccess.accessManagement),
            accessAutomation: Boolean(access.accessAutomation && tenantAccess.accessAutomation)
          }
        : access;

    req.user = {
      userId: user.id,
      id: user.id,
      email: user.email,
      role: legacyRole,
      actualRole,
      name: user.name,
      regionId: user.regionId,
      tenantCompanyId: user.tenantCompanyId,
      accessB2B: Boolean(effectiveAccess.accessB2B),
      accessB2G: Boolean(effectiveAccess.accessB2G),
      accessPreSales: Boolean(effectiveAccess.accessPreSales),
      accessManagement: Boolean(effectiveAccess.accessManagement),
      accessAutomation: Boolean(effectiveAccess.accessAutomation),
      permissionOverrides: user.permissionOverrides || {},
      permissions: getPermissionTemplate(actualRole, { ...rolePolicyPermissions, ...(user.permissionOverrides || {}) }),
      isCompanyOwner: Boolean(user.isCompanyOwner)
    };
    next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Usuário não autenticado' });
    }

    if (isMaster(req.user)) return next();

    const allowed = roles.map((item) => normalizeRole(item));
    const currentRoles = [req.user.role, req.user.actualRole].filter(Boolean);
    if (!allowed.some((role) => currentRoles.includes(role))) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    next();
  };
};

module.exports = { authenticateToken, requireRole };
