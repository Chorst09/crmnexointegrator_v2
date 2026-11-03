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
      badgeClassName: "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300",
    };
  }

  if (APPROVED_STATUSES.has(normalized)) {
    return {
      label: 'Aprovado',
      badgeClassName: "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-300",
    };
  }

  if (REJECTED_STATUSES.has(normalized)) {
    return {
      label: 'Rejeitado',
      badgeClassName: "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300",
    };
  }

  switch (normalized) {
    case 'rascunho':
      return { label: 'Rascunho', badgeClassName: "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]" };
    case 'enviada':
    case 'enviado':
      return { label: 'Enviada', badgeClassName: "bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300" };
    case 'em análise':
    case 'em analise':
      return { label: 'Em Análise', badgeClassName: "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-300" };
    case 'renovação':
    case 'renovacao':
      return { label: 'Renovação', badgeClassName: "bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300" };
    default:
      return {
        label: status?.trim() || 'Sem status',
        badgeClassName: "bg-[rgb(var(--crm-surface-rgb)_/_1)] text-[rgb(var(--crm-ink-rgb)_/_1)]",
      };
  }
};
