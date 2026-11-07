// Shared validation for lead follow-up fields. Dates must include an explicit timezone.
const FIELDS = ['leadNextAction', 'leadNextActionAt', 'leadReminderMinutes'];
function normalizeLeadNextAction(body, existing = {}) {
  if (!FIELDS.some((key) => Object.hasOwn(body, key))) return { data: {} };
  const action = String(body.leadNextAction === undefined ? existing.leadNextAction || '' : body.leadNextAction || '').trim();
  const rawDate = body.leadNextActionAt === undefined ? existing.leadNextActionAt : body.leadNextActionAt;
  const at = rawDate ? new Date(rawDate) : null;
  const minutes = body.leadReminderMinutes === undefined ? (existing.leadReminderMinutes ?? 15) : Number(body.leadReminderMinutes);
  if (action.length > 1000) return { error: 'A próxima ação deve ter no máximo 1000 caracteres.' };
  if (Boolean(action) !== Boolean(rawDate)) return { error: 'Informe a próxima ação e sua data/horário, ou limpe ambos.' };
  if (rawDate && (Number.isNaN(at.getTime()) || (typeof rawDate === 'string' && !/(Z|[+-]\d{2}:\d{2})$/.test(rawDate)))) return { error: 'Data/horário inválidos. Informe o fuso horário.' };
  if (![0, 15, 30, 60, 1440].includes(minutes)) return { error: 'Antecedência do lembrete inválida.' };
  return { data: { leadNextAction: action || null, leadNextActionAt: at, leadReminderMinutes: minutes } };
}
module.exports = { normalizeLeadNextAction };
