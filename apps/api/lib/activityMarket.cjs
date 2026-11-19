const normalize = value => String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
function resolveActivityMarket(activity = {}) {
  const opportunity = activity.opportunity || {};
  if (opportunity.b2gStage || String(opportunity.number || '').startsWith('B2G-')) return 'B2G';
  const related = normalize(opportunity.company?.clientType || activity.company?.clientType);
  if (['B2B','B2G'].includes(related)) return related;
  let flow = activity.flow;
  if (!flow) {
    const description = String(activity.description || '');
    const marker = description.indexOf('[CRM_ACTIVITY_FLOW]');
    if (marker >= 0) { try { flow = JSON.parse(description.slice(marker + '[CRM_ACTIVITY_FLOW]'.length).trim()); } catch {} }
  }
  const areas = [flow?.sourceArea, flow?.targetArea].map(normalize).map(value => value === 'B2B_PRIVADO' ? 'B2B' : value === 'B2G_GOVERNO' ? 'B2G' : value);
  return areas.find(value => ['B2B','B2G'].includes(value)) || null;
}
module.exports = { resolveActivityMarket };
