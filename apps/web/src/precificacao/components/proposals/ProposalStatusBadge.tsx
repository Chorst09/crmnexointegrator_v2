import { Badge } from '@/components/ui/badge';
import { getProposalStatusPresentation } from '@/lib/proposals/status-presentation';

interface ProposalStatusBadgeProps {
  status?: string | null;
  className?: string;
}

export function ProposalStatusBadge({ status, className = '' }: ProposalStatusBadgeProps) {
  const presentation = getProposalStatusPresentation(status);

  return (
    <Badge className={`${presentation.badgeClassName} border-0 ${className}`.trim()}>
      {presentation.label}
    </Badge>
  );
}
