export const ACTIVITY_FLOW_MARKER = '[CRM_ACTIVITY_FLOW]';

export const ACTIVITY_AREAS = {
  B2B: 'B2B Privado',
  B2G: 'B2G Governo',
  B2B_PRIVADO: 'B2B Privado',
  B2G_GOVERNO: 'B2G Governo',
  COMERCIAL: 'Comercial',
  PRE_VENDAS: 'Pré-Vendas',
  SDR: 'SDR',
  DIRETORIA_COMERCIAL: 'Diretoria Comercial',
  GERENTE_CONTAS: 'Gerente de Contas'
};

export const ACTIVITY_AREA_OPTIONS = Object.entries(ACTIVITY_AREAS)
  .filter(([value]) => value !== 'B2B_PRIVADO' && value !== 'B2G_GOVERNO')
  .map(([value, label]) => ({
    value,
    label
  }));

const safeJsonParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export const getAreaLabel = (area) => ACTIVITY_AREAS[area] || area || '-';

export const addFlowMetadataToDescription = (description, flow) => {
  const plain = String(description || '').trim();
  const metadata = {
    ...(flow && typeof flow === 'object' ? flow : {}),
    sourceArea: flow?.sourceArea || 'COMERCIAL',
    targetArea: flow?.targetArea || 'COMERCIAL',
    createdFrom: flow?.createdFrom || 'ATIVIDADES',
    createdByName: flow?.createdByName || '',
    createdAt: flow?.createdAt || new Date().toISOString()
  };

  return `${plain}\n\n${ACTIVITY_FLOW_MARKER}${JSON.stringify(metadata)}`;
};

export const updateFlowMetadataInDescription = (description, patch) => {
  const parsed = parseFlowFromDescription(description);
  return addFlowMetadataToDescription(parsed.cleanDescription, {
    ...parsed.flow,
    ...(patch && typeof patch === 'object' ? patch : {}),
    updatedAt: new Date().toISOString()
  });
};

export const parseFlowFromDescription = (description) => {
  const value = String(description || '');
  const markerIdx = value.indexOf(ACTIVITY_FLOW_MARKER);
  if (markerIdx < 0) {
    return {
      cleanDescription: value.trim(),
      flow: {
        sourceArea: 'COMERCIAL',
        targetArea: 'COMERCIAL',
        createdFrom: 'LEGACY'
      }
    };
  }

  const cleanDescription = value.slice(0, markerIdx).trim();
  const raw = value.slice(markerIdx + ACTIVITY_FLOW_MARKER.length).trim();
  const flow = safeJsonParse(raw, {});

  return {
    cleanDescription,
    flow: {
      ...(flow && typeof flow === 'object' ? flow : {}),
      sourceArea: flow?.sourceArea || 'COMERCIAL',
      targetArea: flow?.targetArea || 'COMERCIAL',
      createdFrom: flow?.createdFrom || 'ATIVIDADES',
      createdByName: flow?.createdByName || '',
      createdAt: flow?.createdAt || null
    }
  };
};

export const hydrateActivityFlow = (activity) => {
  const parsed = parseFlowFromDescription(activity?.description);
  return {
    ...activity,
    description: parsed.cleanDescription,
    flow: parsed.flow
  };
};
