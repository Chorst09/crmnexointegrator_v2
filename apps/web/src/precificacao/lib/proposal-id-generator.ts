// Gerador de IDs para propostas
// Formato: Prop_{Tipo}_{Número}_v{Versão}

export type ProposalType = 
  | 'PABX'
  | 'VM'
  | 'FIBER'
  | 'RADIO'
  | 'DOUBLE'
  | 'INTERNET_MAN_FIBRA'
  | 'MANRADIO'
  | 'REDE_MAN_MPLS_FIBRA'
  | 'REDE_MAN_MPLS_RADIO'
  | 'SD_WAN'
  | 'EVENTOS_TI';

const TYPE_PREFIXES: Record<ProposalType, string> = {
  'PABX': 'Prop_Pabx_Sip',
  'VM': 'Prop_MV',
  'FIBER': 'Prop_Inter_Fibra',
  'RADIO': 'Prop_Inter_Radio',
  'DOUBLE': 'Prop_Inter_Double',
  'INTERNET_MAN_FIBRA': 'Prop_Inter_Man',
  'MANRADIO': 'Prop_InterMan_Radio',
  'REDE_MAN_MPLS_FIBRA': 'Prop_Rede_Man/Filbra',
  'REDE_MAN_MPLS_RADIO': 'Prop_Rede_Man/Radio',
  'SD_WAN': 'Prop_Rede_SD-WAN',
  'EVENTOS_TI': 'Prop_Eventos_TI'
};

const TYPE_LEGACY_PREFIXES: Partial<Record<ProposalType, string[]>> = {
  'REDE_MAN_MPLS_FIBRA': ['Prop_Inter_Man', 'Prop_ManFibra', 'Prop_IM', 'Prop_Rede_Man/Fibra'],
  'REDE_MAN_MPLS_RADIO': ['Prop_InterMan_Radio', 'Prop_ManRadio']
};

const VERSION_SUFFIX_REGEX = /_v(\d+)$/;

/**
 * Normaliza a entrada de propostas para garantir que é sempre um array de objetos com base_id
 * Corrige o erro "u.get is not a function" quando URLSearchParams ou objetos inválidos são passados
 */
const normalizeProposalsInput = (input: any): Array<{ base_id: string }> => {
  // null / undefined → array vazio
  if (input == null) return [];

  // Já é array? normalizar cada item
  if (Array.isArray(input)) {
    return input.map(item => {
      if (!item || typeof item !== 'object') return { base_id: '' };
      // Suporta base_id ou baseId
      const baseId = String(item.base_id || item.baseId || '');
      return { base_id: baseId };
    });
  }

  // URLSearchParams ou Map (tem método .get) → não é uma lista de propostas
  if (typeof input.get === 'function') {
    console.warn('⚠️ proposal-id-generator: recebeu URLSearchParams/Map em vez de array - retornando vazio');
    return [];
  }

  // Objeto simples com .proposals ou .data.proposals
  if (typeof input === 'object') {
    const arr = input?.proposals || input?.data?.proposals || input?.data || [];
    if (Array.isArray(arr)) return normalizeProposalsInput(arr);
  }

  console.warn('⚠️ proposal-id-generator: tipo inesperado de entrada:', typeof input);
  return [];
};

const stripVersionSuffix = (proposalId: string): string => {
  return proposalId.replace(VERSION_SUFFIX_REGEX, '');
};

const extractVersionFromBaseId = (
  proposalId: string,
  baseIdWithoutVersion: string
): number | null => {
  if (!proposalId.startsWith(baseIdWithoutVersion)) return null;
  const suffix = proposalId.slice(baseIdWithoutVersion.length);
  if (suffix.length === 0) return 1;
  const match = suffix.match(/^_v(\d+)$/);
  return match ? parseInt(match[1], 10) : null;
};

/**
 * Gera um ID único para proposta no formato especificado
 */
export function generateProposalId(
  type: ProposalType,
  number: number,
  version: number = 1
): string {
  const prefix = TYPE_PREFIXES[type];
  const paddedNumber = String(number).padStart(3, '0');
  return `${prefix}_${paddedNumber}_v${version}`;
}

/**
 * Extrai informações de um ID de proposta
 */
export function parseProposalId(proposalId: string): {
  type: string;
  number: number;
  version: number;
} | null {
  const match = proposalId.match(/^Prop_(.+?)_(\d+)(?:_v(\d+))?$/);
  if (!match) return null;
  return {
    type: match[1],
    number: parseInt(match[2], 10),
    version: match[3] ? parseInt(match[3], 10) : 1
  };
}

/**
 * Obtém o próximo número disponível para um tipo de proposta
 */
export function getNextProposalNumber(
  existingProposals: any,
  type: ProposalType
): number {
  const normalized = normalizeProposalsInput(existingProposals);
  const prefix = TYPE_PREFIXES[type];
  const validPrefixes = [prefix, ...(TYPE_LEGACY_PREFIXES[type] || [])];

  const sameTypeProposals = normalized.filter(p =>
    validPrefixes.some(vp => p.base_id.startsWith(vp))
  );

  if (sameTypeProposals.length === 0) return 1;

  const numbers = sameTypeProposals
    .map(p => parseProposalId(p.base_id))
    .filter(Boolean)
    .map(parsed => parsed!.number);

  return Math.max(...numbers, 0) + 1;
}

/**
 * Gera o próximo ID disponível para uma proposta
 */
export function generateNextProposalId(
  existingProposals: any,
  type: ProposalType,
  version: number = 1
): string {
  const nextNumber = getNextProposalNumber(existingProposals, type);
  return generateProposalId(type, nextNumber, version);
}

/**
 * Gera uma nova versão de uma proposta existente
 */
export function generateNewVersion(
  currentBaseId: string,
  existingProposals: any
): string {
  const normalized = normalizeProposalsInput(existingProposals);
  const baseIdWithoutVersion = stripVersionSuffix(currentBaseId);

  const sameBaseProposals = normalized.filter(p =>
    p.base_id.startsWith(baseIdWithoutVersion)
  );

  const versions = sameBaseProposals
    .map(p => extractVersionFromBaseId(p.base_id, baseIdWithoutVersion))
    .filter((v): v is number => v !== null);

  const currentVersion = extractVersionFromBaseId(currentBaseId, baseIdWithoutVersion) ?? 1;
  const maxVersion = versions.length > 0 ? Math.max(...versions, currentVersion) : currentVersion;

  return `${baseIdWithoutVersion}_v${maxVersion + 1}`;
}
