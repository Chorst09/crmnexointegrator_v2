const text = (value) => String(value ?? '').trim();
const searchable = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const getPipelineType = (opportunity) => {
  const type = text(opportunity?.clientType).toUpperCase();
  if (type === 'B2B' || type === 'B2G') return type;
  if (text(opportunity?.number).toUpperCase().startsWith('B2G-') || opportunity?.b2gStage) return 'B2G';
  return text(opportunity?.company?.clientType).toUpperCase() === 'B2G' ? 'B2G' : 'B2B';
};

export const getPipelineClient = (opportunity) => text(opportunity?.company?.name || opportunity?.companyName || opportunity?.cliente);

export const filterPipelineOpportunities = (opportunities, type, query) => {
  const terms = searchable(query).split(/\s+/).filter(Boolean);
  return opportunities.filter((item) => getPipelineType(item) === type && terms.every((term) =>
    searchable([item.number, item.title, getPipelineClient(item)].join(' ')).includes(term)
  ));
};

export const applyPipelineOpportunity = (form, opportunity) => ({
  ...form,
  oportunidadeId: opportunity.id,
  titulo: opportunity.title || form.titulo,
  cliente: getPipelineClient(opportunity),
  origem: getPipelineType(opportunity),
  valorEstimado: opportunity.value != null && Number.isFinite(Number(opportunity.value)) ? String(opportunity.value) : form.valorEstimado
});
