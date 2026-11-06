const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const normalizeDocument = (value) => String(value || '').replace(/\D/g, '');

const sellerNameMatches = (sellerName, requesterName) => {
  const seller = normalizeText(sellerName);
  const requester = normalizeText(requesterName);
  if (!seller || !requester) return false;
  if (seller === requester) return true;
  const sellerFirst = seller.split(' ')[0];
  const requesterFirst = requester.split(' ')[0];
  return Boolean(sellerFirst && requesterFirst && sellerFirst === requesterFirst);
};

const normalizeDomain = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return raw
    .replace(/^https?:\/\//, '')
    .replace(/^mailto:/, '')
    .split('@')
    .pop()
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/^www\./, '')
    .trim();
};

const canBeResponsibleSeller = (user = {}) => {
  const role = String(user.role || '').trim().toUpperCase();
  if (role === 'PRE_SALES') return false;
  return user.accessB2B !== false;
};

const getCurrentSeller = (company) => {
  const accountManagerId = String(company?.accountManagerId || '').trim();
  const accountManagerName = String(company?.accountManagerName || '').trim();
  if (accountManagerId || accountManagerName) {
    return {
      id: accountManagerId || null,
      name: accountManagerName,
      email: ''
    };
  }

  const opportunityOwner = (company?.opportunities || [])
    .map((opportunity) => opportunity.owner)
    .find((owner) => owner?.id && canBeResponsibleSeller(owner));

  if (opportunityOwner) return opportunityOwner;

  return null;
};

const companyMatchesTarget = (company, target) => {
  const document = normalizeDocument(target.document);
  if (document && normalizeDocument(company.document) === document) return true;

  const targetName = normalizeText(target.name);
  if (targetName && normalizeText(company.name) === targetName) return true;

  const domain = normalizeDomain(target.website);
  if (domain && normalizeDomain(company.website) === domain) return true;

  return false;
};

export const buildOwnershipDecision = ({ allowed, reason, sellerName = '' }) => {
  if (!allowed) {
    return {
      permitido: false,
      motivo: 'CONFLITO_TITULARIDADE',
      mensagem: `Cadastro negado: este cliente já está mapeado para o vendedor ${sellerName}.`
    };
  }

  if (reason === 'MESMO_VENDEDOR') {
    return {
      permitido: true,
      motivo: 'MESMO_VENDEDOR',
      mensagem: 'Cadastro liberado: este cliente já pertence ao vendedor solicitante.'
    };
  }

  return {
    permitido: true,
    motivo: 'NOVO_CADASTRO',
    mensagem: 'Cadastro liberado: cliente novo sem conflito de titularidade.'
  };
};

export const validateCustomerOwnership = async (tx, {
  tenantCompanyId = null,
  requesterId,
  requesterName = '',
  companyId = null,
  companyName = '',
  document = '',
  website = '',
  clientType = 'B2B'
} = {}) => {
  const normalizedClientType = String(clientType || '').trim().toUpperCase();
  if (normalizedClientType && normalizedClientType !== 'B2B') {
    return buildOwnershipDecision({ allowed: true, reason: 'NOVO_CADASTRO' });
  }

  const target = { name: companyName, document, website };
  const hasSearchKey = Boolean(
    companyId ||
    normalizeDocument(document) ||
    normalizeText(companyName) ||
    normalizeDomain(website)
  );
  if (!hasSearchKey || !requesterId) {
    return buildOwnershipDecision({ allowed: true, reason: 'NOVO_CADASTRO' });
  }

  const companies = await tx.company.findMany({
    where: {
      ...(tenantCompanyId ? { tenantCompanyId } : {}),
      clientType: 'B2B'
    },
    select: {
      id: true,
      name: true,
      document: true,
      website: true,
      accountManagerId: true,
      accountManagerName: true,
      opportunities: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          owner: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              accessB2B: true
            }
          }
        }
      }
    }
  });

  const matchedCompany = (companyId
    ? companies.find((company) => company.id === companyId)
    : null)
    || companies.find((company) => companyMatchesTarget(company, target))
    || null;

  if (!matchedCompany) {
    return buildOwnershipDecision({ allowed: true, reason: 'NOVO_CADASTRO' });
  }

  const currentSeller = getCurrentSeller(matchedCompany);
  if (!currentSeller) {
    return buildOwnershipDecision({ allowed: true, reason: 'NOVO_CADASTRO' });
  }

  if (currentSeller.id) {
    return currentSeller.id === requesterId
      ? buildOwnershipDecision({ allowed: true, reason: 'MESMO_VENDEDOR' })
      : buildOwnershipDecision({ allowed: false, reason: 'CONFLITO_TITULARIDADE', sellerName: currentSeller.name || currentSeller.email || 'responsavel atual' });
  }

  const sameSellerByName = sellerNameMatches(currentSeller.name, requesterName);
  return sameSellerByName
    ? buildOwnershipDecision({ allowed: true, reason: 'MESMO_VENDEDOR' })
    : buildOwnershipDecision({ allowed: false, reason: 'CONFLITO_TITULARIDADE', sellerName: currentSeller.name || 'responsavel atual' });
};
