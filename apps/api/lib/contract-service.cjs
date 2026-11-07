const { companyVisibilityWhere } = require('./company-visibility.cjs');
const { opportunityDocumentWhere } = require('./company-documents-router.cjs');
const LIVE_STATUSES = ['ACTIVE', 'RENEWAL_PENDING'];
function contractScope(user = {}) {
  const master = String(user.actualRole || user.role).toUpperCase() === 'MASTER';
  const types = [user.accessB2B && 'B2B', user.accessB2G && 'B2G'].filter(Boolean);
  return { AND: [
    { company: { AND: [master ? {} : { tenantCompanyId: user.tenantCompanyId || '__missing_tenant__' }, companyVisibilityWhere(user), master ? {} : { clientType: { in: types } }] } },
    { OR: [{ opportunityId: null }, { opportunity: opportunityDocumentWhere(user) }] }
  ] };
}
function dateOnly(value) {
  if (!value) return null;
  const text = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(text + 'T00:00:00.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text) ? date : null;
}
function expirationSchedule(contract, now = new Date()) {
  if (!contract.expirationAlert || !LIVE_STATUSES.includes(contract.status)) return null;
  const expiry = dateOnly(contract.endDate);
  if (!expiry) return null;
  const expiresAt = new Date(expiry.toISOString().slice(0, 10) + 'T23:59:59-03:00');
  if (expiresAt < now) return null;
  // An event on the warning date avoids Google's 28-day reminder limit.
  const alertAt = new Date(expiry.toISOString().slice(0, 10) + 'T09:00:00-03:00');
  alertAt.setUTCDate(alertAt.getUTCDate() - 30);
  return { alertAt, expiresAt };
}
function normalizeContract(body = {}, existing = {}) {
  const data = {};
  for (const field of ['number', 'title', 'description', 'slaDescription']) {
    if (body[field] !== undefined) data[field] = String(body[field] || '').trim();
  }
  for (const field of ['startDate', 'endDate']) {
    if (body[field] !== undefined) {
      data[field] = dateOnly(body[field]);
      if (body[field] && !data[field]) return { error: 'Data de contrato inválida.' };
    }
  }
  for (const field of ['value', 'slaResponseTime', 'slaResolutionTime', 'slaAvailability']) {
    if (body[field] !== undefined) {
      data[field] = body[field] === '' || body[field] === null ? (field === 'value' ? 0 : null) : Number(body[field]);
      if (data[field] !== null && (!Number.isFinite(data[field]) || data[field] < 0)) return { error: 'Informe valores numéricos válidos.' };
      if (['slaResponseTime', 'slaResolutionTime'].includes(field) && data[field] !== null && !Number.isInteger(data[field])) return { error: 'Os tempos de SLA devem ser inteiros.' };
      if (field === 'slaAvailability' && data[field] > 100) return { error: 'Disponibilidade deve estar entre 0 e 100%.' };
    }
  }
  if (body.status !== undefined) {
    if (!['DRAFT', 'AWAITING_SIGNATURE', 'ACTIVE', 'RENEWAL_PENDING', 'EXPIRED', 'CANCELLED', 'RENEWED'].includes(body.status)) return { error: 'Status inválido.' };
    data.status = body.status;
  }
  if (body.expirationAlert !== undefined) {
    if (typeof body.expirationAlert !== 'boolean') return { error: 'Alerta de vencimento inválido.' };
    data.expirationAlert = body.expirationAlert;
  }
  const effective = { ...existing, ...data };
  if (!effective.number || !effective.title) return { error: 'Número e título são obrigatórios.' };
  if (LIVE_STATUSES.includes(effective.status) && (!effective.startDate || !effective.endDate)) return { error: 'Informe início e vencimento para ativar o contrato e seu alerta.' };
  if (effective.startDate && effective.endDate && new Date(effective.endDate) < new Date(effective.startDate)) return { error: 'O vencimento deve ser igual ou posterior ao início.' };
  return { data };
}
module.exports = { contractScope, dateOnly, expirationSchedule, normalizeContract, LIVE_STATUSES };
