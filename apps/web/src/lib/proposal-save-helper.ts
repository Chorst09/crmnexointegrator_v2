/**
 * Helper para salvar propostas com tratamento correto de versões
 * Detecta se é edição ou nova proposta e gera ID apropriado
 */

import { generateNextProposalId, generateNewVersion, parseProposalId } from './proposal-id-generator';

export interface ProposalSaveContext {
  currentProposal?: {
    id: string;
    baseId: string;
    version: number;
  };
  existingProposals: Array<{ base_id: string }>;
  proposalType: string;
}

export interface ProposalSaveResult {
  baseId: string;
  version: number;
  isNewProposal: boolean;
}

/**
 * Determina se deve criar nova proposta ou nova versão
 * @param context Contexto com proposta atual e existentes
 * @returns Resultado com base_id e versão apropriados
 */
export function determineSaveStrategy(context: ProposalSaveContext): ProposalSaveResult {
  const { currentProposal, existingProposals, proposalType } = context;

  // Se não há proposta atual, é nova proposta
  if (!currentProposal) {
    const baseId = generateNextProposalId(existingProposals, proposalType as any, 1);
    return {
      baseId,
      version: 1,
      isNewProposal: true,
    };
  }

  // Se há proposta atual, é edição - gerar nova versão
  const newBaseId = generateNewVersion(currentProposal.baseId, existingProposals);
  const parsed = parseProposalId(newBaseId);
  const newVersion = parsed?.version || (currentProposal.version + 1);

  return {
    baseId: newBaseId,
    version: newVersion,
    isNewProposal: false,
  };
}

/**
 * Extrai base_id sem versão para agrupamento
 * @param baseId ID completo (ex: Prop_Pabx_Sip_001_v2)
 * @returns Base ID sem versão (ex: Prop_Pabx_Sip_001)
 */
export function getBaseIdWithoutVersion(baseId: string): string {
  return baseId.replace(/_v\d+$/, '');
}

/**
 * Extrai versão do base_id
 * @param baseId ID completo (ex: Prop_Pabx_Sip_001_v2)
 * @returns Versão (ex: 2)
 */
export function getVersionFromBaseId(baseId: string): number {
  const match = baseId.match(/_v(\d+)$/);
  return match ? parseInt(match[1], 10) : 1;
}
