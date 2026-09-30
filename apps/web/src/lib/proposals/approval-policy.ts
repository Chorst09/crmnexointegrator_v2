const toNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toBooleanOrNull = (value: unknown): boolean | null => {
  if (typeof value === 'boolean') return value;
  return null;
};

export type ApprovalReasonCode =
  | 'DIRECTOR_DISCOUNT'
  | 'PAYBACK_ABOVE_LIMIT'
  | 'PAYBACK_ABOVE_ABSOLUTE_LIMIT'
  | 'MANUAL_OVERRIDE';

export interface ApprovalReason {
  code: ApprovalReasonCode;
  label: string;
  details?: string;
}

export interface ApprovalPolicyResult {
  requiresApproval: boolean;
  reasons: ApprovalReason[];
  metrics: {
    directorDiscountPercent: number;
    maxPaybackFound: number | null;
    maxPaybackLimitFound: number | null;
    paybackAbsoluteLimit: number;
  };
}

const DEFAULT_DIRECTOR_DISCOUNT_THRESHOLD = Number(process.env.PROPOSAL_APPROVAL_DIRECTOR_DISCOUNT_THRESHOLD ?? '0');
const DEFAULT_PAYBACK_ABSOLUTE_LIMIT = Number(process.env.PROPOSAL_APPROVAL_PAYBACK_ABSOLUTE_LIMIT ?? '12');

const ensureArray = (value: unknown): any[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export interface EvaluateApprovalPolicyInput {
  products?: unknown;
  metadata?: Record<string, any> | null;
  appliedDirectorDiscountPercentage?: number | null;
}

export const evaluateProposalApprovalPolicy = (input: EvaluateApprovalPolicyInput): ApprovalPolicyResult => {
  const metadata = (input.metadata || {}) as Record<string, any>;
  const directorDiscountPercent =
    toNumberOrNull(input.appliedDirectorDiscountPercentage ?? metadata.appliedDirectorDiscountPercentage) ?? 0;

  const reasons: ApprovalReason[] = [];
  const products = ensureArray(input.products);

  if (directorDiscountPercent > DEFAULT_DIRECTOR_DISCOUNT_THRESHOLD) {
    reasons.push({
      code: 'DIRECTOR_DISCOUNT',
      label: 'Desconto fora do padrão',
      details: `Desconto diretoria de ${directorDiscountPercent}% (limite padrão: ${DEFAULT_DIRECTOR_DISCOUNT_THRESHOLD}%).`,
    });
  }

  let maxPaybackFound: number | null = null;
  let maxPaybackLimitFound: number | null = null;
  let hasPaybackAboveLimit = false;
  let hasPaybackAboveAbsoluteLimit = false;

  products.forEach((product) => {
    const details = (product as any)?.details || {};
    const payback = toNumberOrNull(details.paybackCalculated ?? details.paybackMonths ?? details.paybackMeses);
    const maxPayback = toNumberOrNull(details.maxPayback ?? details.maxPaybackMonths ?? details.max_payback);
    const withinLimit = toBooleanOrNull(details.paybackWithinLimit ?? details.payback_within_limit);

    if (payback !== null) {
      maxPaybackFound = maxPaybackFound === null ? payback : Math.max(maxPaybackFound, payback);
      if (payback > DEFAULT_PAYBACK_ABSOLUTE_LIMIT) hasPaybackAboveAbsoluteLimit = true;
    }

    if (maxPayback !== null) {
      maxPaybackLimitFound = maxPaybackLimitFound === null ? maxPayback : Math.max(maxPaybackLimitFound, maxPayback);
    }

    if (withinLimit === false) {
      hasPaybackAboveLimit = true;
      return;
    }

    if (payback !== null && maxPayback !== null && payback > maxPayback) {
      hasPaybackAboveLimit = true;
    }
  });

  if (hasPaybackAboveLimit) {
    reasons.push({
      code: 'PAYBACK_ABOVE_LIMIT',
      label: 'Payback acima do limite do plano',
      details:
        maxPaybackFound !== null && maxPaybackLimitFound !== null
          ? `Payback máximo encontrado: ${maxPaybackFound} meses (limite: ${maxPaybackLimitFound} meses).`
          : undefined,
    });
  }

  if (hasPaybackAboveAbsoluteLimit) {
    reasons.push({
      code: 'PAYBACK_ABOVE_ABSOLUTE_LIMIT',
      label: 'Payback muito alto',
      details: `Encontrado payback acima de ${DEFAULT_PAYBACK_ABSOLUTE_LIMIT} meses.`,
    });
  }

  if (metadata.forceApproval === true) {
    reasons.push({
      code: 'MANUAL_OVERRIDE',
      label: 'Aprovação forçada manualmente',
      details: 'Solicitação marcada para aprovação manual no metadata.',
    });
  }

  return {
    requiresApproval: reasons.length > 0,
    reasons,
    metrics: {
      directorDiscountPercent,
      maxPaybackFound,
      maxPaybackLimitFound,
      paybackAbsoluteLimit: DEFAULT_PAYBACK_ABSOLUTE_LIMIT,
    },
  };
};

