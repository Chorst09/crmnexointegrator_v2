import { normalizeText } from './text-utils';

export const COMMERCIAL_PROPOSALS_STORAGE_KEY = 'proposta-comercial-double-drafts-v1';

export const getCommercialProposalNumber = (proposal) =>
  normalizeText(proposal?.proposalNumber || proposal?.number || proposal?.draft?.proposalNumber || proposal?.draft?.number);

export const readCommercialProposalDrafts = () => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(COMMERCIAL_PROPOSALS_STORAGE_KEY) || '[]');
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => new Date(b.savedAt || 0).getTime() - new Date(a.savedAt || 0).getTime())
      : [];
  } catch {
    return [];
  }
};

const generateProposalNumber = (proposals) => {
  const year = new Date().getFullYear();
  const prefix = `PROP-${year}-`;
  const used = proposals
    .map(getCommercialProposalNumber)
    .filter(number => number.startsWith(prefix))
    .map(number => Number(number.slice(prefix.length)))
    .filter(Number.isFinite);

  return `${prefix}${String(Math.max(0, ...used) + 1).padStart(4, '0')}`;
};

const generateProposalId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const formatProposalDate = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('pt-BR');
  return date.toLocaleDateString('pt-BR');
};

const formatCurrency = (value) => {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number <= 0) return '';
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const createOrUpdateCommercialProposalFromOpportunity = (opportunity, options = {}) => {
  if (!opportunity?.id || typeof window === 'undefined') return null;

  const currentEntries = readCommercialProposalDrafts();
  const existing = currentEntries.find(proposal =>
    proposal.opportunityId === opportunity.id || proposal?.draft?.opportunityId === opportunity.id
  );
  const proposalId = existing?.id || generateProposalId();
  const proposalNumber = getCommercialProposalNumber(existing) || generateProposalNumber(currentEntries);
  const now = new Date().toISOString();
  const clientType = options.clientType || existing?.clientType || 'B2B';
  const companyName = normalizeText(opportunity?.company?.name || opportunity?.companyName || opportunity?.clientName);
  const clientName = companyName || normalizeText(opportunity?.title) || 'Cliente sem nome';
  const productName = normalizeText(opportunity?.projectName || opportunity?.title || opportunity?.description) || 'Produto/servico';
  const projectMonths = Number(opportunity?.projectMonths || 0);
  const contractTerm = projectMonths > 0 ? `${projectMonths} meses` : '';
  const draft = existing?.draft || {
    savedAt: now,
    cover: {
      clientName,
      date: formatProposalDate(),
      product: productName
    },
    slides: {},
    contract: {
      vigencia: '',
      prazo: contractTerm,
      termos: ''
    },
    investment: {
      rows: [
        {
          service: productName,
          description: normalizeText(opportunity?.description),
          monthly: formatCurrency(opportunity?.value),
          contract: contractTerm
        }
      ],
      installationFee: ''
    }
  };

  const entry = {
    ...(existing || {}),
    id: proposalId,
    title: existing?.title || clientName,
    proposalNumber,
    opportunityId: opportunity.id,
    clientType,
    savedAt: existing?.savedAt || now,
    draft: {
      ...draft,
      proposalNumber,
      opportunityId: opportunity.id,
      cover: {
        ...(draft.cover || {}),
        clientName: draft.cover?.clientName || clientName,
        date: draft.cover?.date || formatProposalDate(),
        product: draft.cover?.product || productName
      }
    }
  };

  const next = [entry, ...currentEntries.filter(proposal => proposal.id !== proposalId)];
  window.localStorage.setItem(COMMERCIAL_PROPOSALS_STORAGE_KEY, JSON.stringify(next));
  return entry;
};

/**
 * Cria ou atualiza proposta comercial de 10 lâminas diretamente a partir dos itens devolvidos pelo Pré-Vendas
 * Preenche automaticamente a lâmina financeira (Slide 7 - Investimento) sem qualquer digitação manual.
 */
export const createCommercialProposalFromReturnedBudget = ({
  activity,
  items = [],
  totals = {},
  options = {}
} = {}) => {
  if (typeof window === 'undefined') return null;

  const currentEntries = readCommercialProposalDrafts();
  const proposalId = generateProposalId();
  const now = new Date().toISOString();

  const companyName = normalizeText(
    activity?.company?.name ||
    activity?.company?.tradingName ||
    activity?.companyName ||
    'Cliente Corporativo'
  );
  const clientName = companyName || 'Cliente Corporativo';
  const productName = normalizeText(
    activity?.title ||
    items[0]?.descricao ||
    'Solução Corporativa Conectividade & TI'
  );

  const proposalNumber = totals?.numeroOrcamento
    ? `PROP-${String(totals.numeroOrcamento).replace(/[^a-zA-Z0-9]/g, '-')}`
    : generateProposalNumber(currentEntries);

  // Mapeia os itens devolvidos diretamente para a tabela comercial da lâmina financeira (Slide 7)
  const investmentRows = Array.isArray(items) && items.length > 0
    ? items.map((item) => {
        const qty = Number(item.quantidade || 1);
        const precoUnit = Number(item.precoSugerido ?? item.precoVenda ?? 0);
        const subtotal = Number(item.subtotalVenda ?? (qty * precoUnit) ?? precoUnit);
        return {
          service: normalizeText(item.descricao || item.produto || 'Item Técnico Homologado'),
          description: `Qtd: ${qty} un · Especificação validada pela Engenharia de Pré-Vendas`,
          monthly: formatCurrency(subtotal || precoUnit),
          contract: formatCurrency(subtotal || precoUnit)
        };
      })
    : [
        {
          service: productName,
          description: 'Solução validada e precificada pela equipe de Pré-Vendas',
          monthly: formatCurrency(totals?.valorMensal || totals?.valorTotalContrato || 0),
          contract: formatCurrency(totals?.valorTotalContrato || totals?.valorMensal || 0)
        }
      ];

  const installationFee = totals?.valorSetup && Number(totals.valorSetup) > 0
    ? formatCurrency(totals.valorSetup)
    : 'Isento';

  const entry = {
    id: proposalId,
    title: `${clientName} - ${productName}`,
    proposalNumber,
    opportunityId: activity?.opportunityId || null,
    activityId: activity?.id || null,
    clientType: options.clientType || 'B2B',
    savedAt: now,
    source: 'PRE_SALES_RETURN_AUTO',
    draft: {
      proposalNumber,
      opportunityId: activity?.opportunityId || null,
      activityId: activity?.id || null,
      source: 'PRE_SALES_RETURN_AUTO',
      savedAt: now,
      cover: {
        clientName,
        date: formatProposalDate(),
        product: productName
      },
      slides: {},
      contract: {
        vigencia: '36 meses',
        prazo: '30 dias úteis',
        termos: 'Faturamento 30 DDL após ativação do serviço homologado'
      },
      investment: {
        rows: investmentRows,
        installationFee
      }
    }
  };

  const next = [entry, ...currentEntries.filter(p => p.id !== proposalId)];
  window.localStorage.setItem(COMMERCIAL_PROPOSALS_STORAGE_KEY, JSON.stringify(next));
  return entry;
};

