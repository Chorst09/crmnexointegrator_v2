const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const normalizeDocument = (value) => String(value || '').replace(/\D/g, '');

const normalizeDomain = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const withoutProtocol = raw
    .replace(/^https?:\/\//, '')
    .replace(/^mailto:/, '')
    .split('@')
    .pop()
    .split('/')[0]
    .split('?')[0]
    .split('#')[0]
    .replace(/^www\./, '');
  return withoutProtocol.trim();
};

const canBeResponsibleSeller = (user = {}) => {
  const role = String(user.role || '').trim().toUpperCase();
  if (role === 'PRE_SALES') return false;
  return user.accessB2B !== false;
};

const getCurrentSeller = (company) => {
  const opportunityOwner = (company?.opportunities || [])
    .map((opportunity) => opportunity.owner)
    .find((owner) => owner?.id && canBeResponsibleSeller(owner));

  if (opportunityOwner) {
    return opportunityOwner;
  }

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

export const buildOwnershipDecision = ({ allowed, reason, sellerName = '', context = 'cadastro' }) => {
  if (!allowed) {
    const isOpportunity = context === 'oportunidade';
    return {
      permitido: false,
      motivo: 'CONFLITO_TITULARIDADE',
      mensagem: isOpportunity 
        ? `Oportunidade já mapeada para o gerente de contas: ${sellerName}`
        : `Cadastro negado: este cliente já está mapeado para o vendedor ${sellerName}.`
    };
  }

  if (reason === 'MESMO_VENDEDOR') {
    return {
      permitido: true,
      motivo: 'MESMO_VENDEDOR',
      mensagem: context === 'oportunidade'
        ? 'Oportunidade liberada: este cliente já pertence ao vendedor solicitante.'
        : 'Cadastro liberado: este cliente já pertence ao vendedor solicitante.'
    };
  }

  return {
    permitido: true,
    motivo: 'NOVO_CADASTRO',
    mensagem: context === 'oportunidade'
      ? 'Oportunidade liberada: cliente novo sem conflito de titularidade.'
      : 'Cadastro liberado: cliente novo sem conflito de titularidade.'
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
  clientType = 'B2B',
  context = 'cadastro'
} = {}) => {
  const normalizedClientType = String(clientType || '').trim().toUpperCase();
  if (normalizedClientType && normalizedClientType !== 'B2B') {
    return buildOwnershipDecision({ allowed: true, reason: 'NOVO_CADASTRO', context });
  }

  const target = { name: companyName, document, website };
  const hasSearchKey = Boolean(
    companyId ||
    normalizeDocument(document) ||
    normalizeText(companyName) ||
    normalizeDomain(website)
  );
  if (!hasSearchKey || !requesterId) {
    return buildOwnershipDecision({ allowed: true, reason: 'NOVO_CADASTRO', context });
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

  const matchedCompany = companies.find((company) =>
    (companyId && company.id === companyId) || companyMatchesTarget(company, target)
  );

  if (!matchedCompany) {
    return buildOwnershipDecision({ allowed: true, reason: 'NOVO_CADASTRO', context });
  }

  const currentSeller = getCurrentSeller(matchedCompany);
  if (!currentSeller) {
    return buildOwnershipDecision({ allowed: true, reason: 'NOVO_CADASTRO', context });
  }

  if (currentSeller.id) {
    return currentSeller.id === requesterId
      ? buildOwnershipDecision({ allowed: true, reason: 'MESMO_VENDEDOR', context })
      : buildOwnershipDecision({ allowed: false, reason: 'CONFLITO_TITULARIDADE', sellerName: currentSeller.name || currentSeller.email || 'responsavel atual', context });
  }

  const sameSellerByName = normalizeText(currentSeller.name) && normalizeText(currentSeller.name) === normalizeText(requesterName);
  return sameSellerByName
    ? buildOwnershipDecision({ allowed: true, reason: 'MESMO_VENDEDOR', context })
    : buildOwnershipDecision({ allowed: false, reason: 'CONFLITO_TITULARIDADE', sellerName: currentSeller.name || 'responsavel atual', context });
};
