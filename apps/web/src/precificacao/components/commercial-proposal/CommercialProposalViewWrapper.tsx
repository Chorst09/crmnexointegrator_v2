import React from 'react';
import CommercialProposalView, { CommercialProposalViewProps } from './CommercialProposalView';

/**
 * CommercialProposalViewWrapper
 * 
 * Re-exporta e renderiza o CommercialProposalView atualizado para todas
 * as visualizações de propostas do CRM e Simuladores.
 */
const CommercialProposalViewWrapper: React.FC<CommercialProposalViewProps> = (props) => {
  return <CommercialProposalView {...props} />;
};

export default CommercialProposalViewWrapper;
