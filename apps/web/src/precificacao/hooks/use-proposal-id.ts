import { useState, useEffect } from 'react';
import { ProposalType, generateNextProposalId } from '@/lib/proposal-id-generator';

/**
 * Hook para gerar IDs de propostas
 * @param type Tipo da proposta
 * @param existingProposals Lista de propostas existentes
 * @returns ID gerado para a próxima proposta
 */
export function useProposalId(
  type: ProposalType,
  existingProposals: Array<{ base_id: string }> = []
) {
  const [proposalId, setProposalId] = useState<string>('');

  useEffect(() => {
    const id = generateNextProposalId(existingProposals, type);
    setProposalId(id);
  }, [type, existingProposals]);

  return proposalId;
}
