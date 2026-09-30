const { isMaster, normalizeRole } = require('./permissions.cjs');

function isGlobalOperator(user = {}) {
  const role = normalizeRole(user.actualRole || user.role);
  return isMaster(user) || role === 'ADMIN';
}

function getUserRegionId(user = {}) {
  return user.regionId || null;
}

// Retorna o tenantCompanyId do usuário (null para MASTER = acesso global)
function getTenantId(user = {}) {
  if (isMaster(user)) return null;
  return user.tenantCompanyId || null;
}

function buildCompanyScopeWhere(user = {}) {
  const tenantId = getTenantId(user);
  // MASTER vê tudo; demais usuários veem apenas seu tenant
  if (!tenantId) return {};
  return { tenantCompanyId: tenantId };
}

function buildContractScopeWhere(user = {}) {
  const tenantId = getTenantId(user);
  if (!tenantId) return {};
  return {
    company: {
      tenantCompanyId: tenantId
    }
  };
}

function canAccessCompanyRecord(user = {}, company = {}) {
  const tenantId = getTenantId(user);
  if (!tenantId) return true; // MASTER
  return String(company?.tenantCompanyId || '') === tenantId;
}

async function canAccessCompany(prisma, user, companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, regionId: true }
  });

  if (!company) return { allowed: false, missing: true };
  return { allowed: canAccessCompanyRecord(user, company), missing: false, company };
}

async function canAccessContract(prisma, user, contractId) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      companyId: true,
      company: {
        select: { id: true, regionId: true }
      }
    }
  });

  if (!contract) return { allowed: false, missing: true };
  return { allowed: canAccessCompanyRecord(user, contract.company), missing: false, contract };
}

async function canAccessCompanyDocument(prisma, user, documentId) {
  const document = await prisma.companyDocument.findUnique({
    where: { id: documentId },
    include: {
      company: {
        select: { id: true, regionId: true }
      }
    }
  });

  if (!document) return { allowed: false, missing: true };
  return { allowed: canAccessCompanyRecord(user, document.company), missing: false, document };
}

async function canAccessContractAttachment(prisma, user, attachmentId) {
  const attachment = await prisma.contractAttachment.findUnique({
    where: { id: attachmentId },
    include: {
      contract: {
        select: {
          id: true,
          companyId: true,
          company: {
            select: { id: true, regionId: true }
          }
        }
      }
    }
  });

  if (!attachment) return { allowed: false, missing: true };
  return {
    allowed: canAccessCompanyRecord(user, attachment.contract?.company),
    missing: false,
    attachment
  };
}

module.exports = {
  isGlobalOperator,
  getTenantId,
  buildCompanyScopeWhere,
  buildContractScopeWhere,
  canAccessCompany,
  canAccessContract,
  canAccessCompanyDocument,
  canAccessContractAttachment
};
