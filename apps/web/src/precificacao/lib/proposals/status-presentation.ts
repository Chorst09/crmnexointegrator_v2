const normalizeStatus = (status?: string | null): string => (status || '').trim().toLowerCase();

const PENDING_APPROVAL_STATUSES = new Set([
  'aguardando aprovação',
  'aguardando aprovacao',
  'aguardando aprovação diretoria',
  'aguardando aprovacao diretoria',
  'aguardando aprovação desconto diretoria',
  'aguardando aprovacao desconto diretoria',
  'enviado para aprovação',
  'enviado para aprovacao',
]);

const APPROVED_STATUSES = new Set([
  'aprovada',
  'aprovado',
  'fechado ganho',
  'assinado',
  'assinada',
  'fechado',
]);

const REJECTED_STATUSES = new Set([
  'rejeitada',
  'rejeitado',
  'perdido',
  'cancelada',
  'cancelado',
]);

export interface ProposalStatusPresentation {
  label: string;
  badgeClassName: string;
}

export const isPendingApprovalStatus = (status?: string | null): boolean => {
  return PENDING_APPROVAL_STATUSES.has(normalizeStatus(status));
};

export const isApprovedStatus = (status?: string | null): boolean => {
  return APPROVED_STATUSES.has(normalizeStatus(status));
};

export const getProposalStatusPresentation = (status?: string | null): ProposalStatusPresentation => {
  const normalized = normalizeStatus(status);

  if (PENDING_APPROVAL_STATUSES.has(normalized)) {
    return {
      label: 'Enviado para aprovação',
      badgeClassName: 'bg-red-100 text-red-800',
    };
  }

  if (APPROVED_STATUSES.has(normalized)) {
    return {
      label: 'Aprovado',
      badgeClassName: 'bg-green-100 text-green-800',
    };
  }

  if (REJECTED_STATUSES.has(normalized)) {
    return {
      label: 'Rejeitado',
      badgeClassName: 'bg-red-100 text-red-800',
    };
  }

  switch (normalized) {
    case 'rascunho':
      return { label: 'Rascunho', badgeClassName: 'bg-gray-100 text-gray-800' };
    case 'enviada':
    case 'enviado':
      return { label: 'Enviada', badgeClassName: 'bg-blue-100 text-blue-800' };
    case 'em análise':
    case 'em analise':
      return { label: 'Em Análise', badgeClassName: 'bg-yellow-100 text-yellow-800' };
    case 'renovação':
    case 'renovacao':
      return { label: 'Renovação', badgeClassName: 'bg-purple-100 text-purple-800' };
    default:
      return {
        label: status?.trim() || 'Sem status',
        badgeClassName: 'bg-gray-100 text-gray-800',
      };
  }
};
