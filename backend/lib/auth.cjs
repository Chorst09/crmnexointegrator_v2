const jwt = require('jsonwebtoken');
const { prisma } = require('./prisma.cjs');
const { normalizeRole, resolveUserAccess, getPermissionTemplate, isMaster } = require('./permissions.cjs');
const { getJwtSecret } = require('./security.cjs');


const JWT_SECRET = getJwtSecret();

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

const authenticateToken = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Token não fornecido' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
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

    // Normalizar formato usado no código atual
    req.user = {
      userId: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: legacyRole,
      actualRole,
      regionId: user.regionId,
      tenantCompanyId: user.tenantCompanyId,
      accessB2B: Boolean(effectiveAccess.accessB2B),
      accessB2G: Boolean(effectiveAccess.accessB2G),
      accessPreSales: Boolean(effectiveAccess.accessPreSales),
      accessManagement: Boolean(effectiveAccess.accessManagement),
      accessAutomation: Boolean(effectiveAccess.accessAutomation),
      isCompanyOwner: Boolean(user.isCompanyOwner),
      permissions: getPermissionTemplate(actualRole, { ...rolePolicyPermissions, ...(user.permissionOverrides || {}) })
    };

    return next();
  } catch (error) {
    console.error('Erro na autenticação:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

const requireRole = (roles) => {
  const rolesArray = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (isMaster(req.user)) return next();

    const currentRoles = new Set([req.user.role, req.user.actualRole].filter(Boolean));
    const normalizedAllowed = rolesArray.map((item) => normalizeRole(item));
    const allowed = normalizedAllowed.some((allowedRole) => currentRoles.has(allowedRole));

    if (!allowed) {
      return res.status(403).json({ error: 'Acesso negado' });
    }
    return next();
  };
};

module.exports = { authenticateToken, requireRole };
