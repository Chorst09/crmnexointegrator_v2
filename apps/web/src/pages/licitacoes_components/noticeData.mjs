const closedStatus = /encerrad|cancelad|cancelamento|revogad|revoga[cç][aã]o|suspens|anulad|fracassad|desert|homologad|adjudicad|conclu[ií]d|exclu[ií]d|confirmado vencedor|autoriza[cç][aã]o de fornecimento gerada|aviso de resultado/i;

export const getBrazilToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

export function getNoticeValue(notice) {
  if (notice.orcamentoSigiloso) return null;
  for (const value of [notice.valor, notice.valor_estimado, notice.valorTotalEstimado]) {
    if (value == null || typeof value === 'boolean') continue;
    let text = String(value).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
    if (!/^\d[\d.,]*$/.test(text)) continue;
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    const number = Number(text);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return null;
}

export function formatNoticeValue(notice) {
  if (notice.orcamentoSigiloso) return 'Orçamento sigiloso';
  const value = getNoticeValue(notice);
  return value == null ? 'Não informado' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function parseNoticeDate(value, endOfDay = false) {
  if (!value) return null;
  let text = String(value).trim();
  const br = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(.*)$/);
  if (br) text = `${br[3]}-${br[2]}-${br[1]}${br[4]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += `T${endOfDay ? '23:59:59' : '00:00:00'}-03:00`;
  else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/.test(text)) text = text.replace(' ', 'T') + '-03:00';
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getNoticeDeadline(notice) {
  return parseNoticeDate(notice.dataEncerramentoProposta || notice.dataEncerramento || notice.data_encerramento
    || notice.dataSessao || notice.dataHoraAberturaSessaoPublica, true);
}

export const isNoticeActive = notice => !closedStatus.test(String(notice.status || notice.situacao || notice.situacaoCompraNome || ''));

export function isNoticeCurrent(notice, referenceDate = getBrazilToday()) {
  if (!isNoticeActive(notice)) return false;
  const threshold = referenceDate === getBrazilToday() ? Date.now() : parseNoticeDate(referenceDate)?.getTime() || Date.now();
  const deadline = getNoticeDeadline(notice);
  if (deadline) return deadline.getTime() >= threshold;
  const publication = parseNoticeDate(notice.dataPublicacao);
  return !publication || publication.getTime() >= threshold - 365 * 86400000;
}

export function compareNoticeValues(a, b, descending = false) {
  const va = getNoticeValue(a), vb = getNoticeValue(b);
  if (va == null || vb == null) return va == null ? (vb == null ? 0 : 1) : -1;
  return descending ? vb - va : va - vb;
}
