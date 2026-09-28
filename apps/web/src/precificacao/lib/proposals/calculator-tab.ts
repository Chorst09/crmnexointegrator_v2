const MAN_FIBER_PREFIXES = [
  'Prop_Inter_Man_',
  'Prop_ManFibra_',
  'Prop_IM_',
  'Prop_Rede_Man/Filbra_',
  'Prop_Rede_Man/Fibra_',
];

const MAN_RADIO_PREFIXES = [
  'Prop_InterMan_Radio_',
  'Prop_ManRadio_',
  'Prop_Rede_Man/Radio_',
];

const startsWithAny = (value: string, prefixes: string[]): boolean => {
  return prefixes.some((prefix) => value.startsWith(prefix));
};

interface ProposalTabInput {
  type?: string | null;
  baseId?: string | null;
  base_id?: string | null;
}

/**
 * Resolve a aba da calculadora para deep-link de aprovação.
 */
export const getCalculatorTabForProposal = (proposal: ProposalTabInput): string => {
  const type = (proposal.type || '').toUpperCase().trim();
  const baseId = proposal.base_id || proposal.baseId || '';

  if (type === 'PABX') return 'pabx-sip';
  if (type === 'VM') return 'maquinas-virtuais';
  if (type === 'FIBER') return 'internet-fibra';
  if (type === 'RADIO') return 'internet-radio';
  if (type === 'DOUBLE') return 'internet-radio-v2';
  if (type === 'INTERNET_MAN_FIBRA' || type === 'REDE_MAN_MPLS_FIBRA') return 'internet-man';
  if (type === 'MANRADIO' || type === 'REDE_MAN_MPLS_RADIO') return 'internet-man-radio';
  if (type === 'SD_WAN') return 'sd-wan';
  if (type === 'EVENTOS_TI') return 'eventos-ti';

  if (baseId.startsWith('Prop_PABX_') || baseId.startsWith('Prop_Pabx_Sip_') || baseId.startsWith('Prop_PabxSip_')) {
    return 'pabx-sip';
  }
  if (baseId.startsWith('Prop_MV_')) return 'maquinas-virtuais';
  if (baseId.startsWith('Prop_Inter_Fibra_')) return 'internet-fibra';
  if (baseId.startsWith('Prop_Inter_Radio_')) return 'internet-radio';
  if (baseId.startsWith('Prop_Inter_Double_')) return 'internet-radio-v2';
  if (startsWithAny(baseId, MAN_FIBER_PREFIXES)) return 'internet-man';
  if (startsWithAny(baseId, MAN_RADIO_PREFIXES)) return 'internet-man-radio';
  if (baseId.startsWith('Prop_Rede_SD-WAN_')) return 'sd-wan';
  if (baseId.startsWith('Prop_Eventos_TI_')) return 'eventos-ti';

  return 'dashboard';
};
