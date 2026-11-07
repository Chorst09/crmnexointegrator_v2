const limit = (value) => {
  const text = value.replace(/\s+/g, ' ').trim();
  return text.length > 240 ? `${text.slice(0, 237).trimEnd()}…` : text;
};

export function getOpportunitySummary(opportunity = {}) {
  let description = opportunity.description;
  if (typeof description === 'string') {
    const text = description.trim();
    if (!text) return 'Resumo não informado.';
    if (/^[{\["]/.test(text)) {
      try { description = JSON.parse(text); }
      catch { return 'Resumo não informado.'; }
    } else {
      return limit(text);
    }
  }
  if (typeof description === 'string') return limit(description) || 'Resumo não informado.';
  if (!description || typeof description !== 'object' || Array.isArray(description)) return 'Resumo não informado.';
  const candidates = [
    description.objectSummary, description.objetoResumido,
    description.objectDetail, description.objetoDetalhado,
    description.summary, description.description, description.projectName,
    description.closeData?.productsInvolved, description.closeData?.history
  ];
  const summary = candidates.find(value => typeof value === 'string' && value.trim() && !/^[{\[]/.test(value.trim()));
  return summary ? limit(summary) : 'Resumo não informado.';
}
