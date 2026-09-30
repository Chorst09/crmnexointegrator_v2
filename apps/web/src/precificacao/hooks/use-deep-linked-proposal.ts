import { useEffect, useRef } from 'react';

interface ProposalWithId {
  id?: string | number | null;
}

/**
 * Abre automaticamente a proposta quando chegar um deep-link com proposalId.
 */
export function useDeepLinkedProposal<T extends ProposalWithId>(
  initialProposalId: string | null | undefined,
  proposals: T[],
  onOpenProposal: (proposal: T) => void,
  isLoading: boolean = false
) {
  const handledProposalIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!initialProposalId) {
      handledProposalIdRef.current = null;
      return;
    }

    if (isLoading) return;
    if (handledProposalIdRef.current === initialProposalId) return;

    const targetProposal = proposals.find(
      (proposal) => String(proposal?.id ?? '') === String(initialProposalId)
    );

    if (!targetProposal) return;

    onOpenProposal(targetProposal);
    handledProposalIdRef.current = initialProposalId;
  }, [initialProposalId, proposals, onOpenProposal, isLoading]);
}
