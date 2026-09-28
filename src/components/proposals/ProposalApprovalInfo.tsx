import { isApprovedStatus } from '@/lib/proposals/status-presentation';

type ApprovalMetadata = {
  status?: string | null;
  decidedByRole?: string | null;
  decidedByRoleLabel?: string | null;
  decidedByName?: string | null;
  decidedByEmail?: string | null;
};

interface ProposalApprovalInfoProps {
  proposal?:
    | {
        status?: string | null;
        approval?: ApprovalMetadata | null;
        metadata?: { approval?: ApprovalMetadata | null } | Record<string, any> | null;
      }
    | null;
  className?: string;
}

const getNormalizedToken = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getStringValue = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getApprovalMetadata = (proposal?: ProposalApprovalInfoProps['proposal']): ApprovalMetadata | null => {
  if (!proposal) return null;

  if (proposal.approval && typeof proposal.approval === 'object') {
    return proposal.approval as ApprovalMetadata;
  }

  if (!proposal.metadata || typeof proposal.metadata !== 'object') {
    return null;
  }

  const metadataApproval = (proposal.metadata as any).approval;
  if (!metadataApproval || typeof metadataApproval !== 'object') {
    return null;
  }

  return metadataApproval as ApprovalMetadata;
};

const getRoleLabel = (approval: ApprovalMetadata): string | null => {
  const explicitLabel = getStringValue(approval.decidedByRoleLabel);
  if (explicitLabel) return explicitLabel;

  const role = getStringValue(approval.decidedByRole);
  if (!role) return null;

  const normalized = getNormalizedToken(role);
  if (['admin', 'administrador', 'administrator'].includes(normalized)) {
    return 'Administrador';
  }
  if (['director', 'diretor'].includes(normalized)) {
    return 'Diretor';
  }
  return null;
};

export function ProposalApprovalInfo({ proposal, className = 'text-gray-600 text-xs' }: ProposalApprovalInfoProps) {
  const approval = getApprovalMetadata(proposal);
  if (!approval) return null;

  const statusFromApproval = getStringValue(approval.status);
  const isApproved = isApprovedStatus(proposal?.status) || statusFromApproval?.toLowerCase() === 'approved';
  if (!isApproved) return null;

  const roleLabel = getRoleLabel(approval);
  const approverName = getStringValue(approval.decidedByName);
  const approverEmail = getStringValue(approval.decidedByEmail);

  if (!roleLabel && !approverName && !approverEmail) {
    return null;
  }

  const identityParts = [roleLabel, approverName].filter(Boolean) as string[];
  const identity = identityParts.join(' - ') || approverEmail;
  const emailSuffix = approverEmail && identity !== approverEmail ? ` (${approverEmail})` : '';

  return (
    <p className={className}>
      <strong>Aprovada por:</strong> {identity}
      {emailSuffix}
    </p>
  );
}
