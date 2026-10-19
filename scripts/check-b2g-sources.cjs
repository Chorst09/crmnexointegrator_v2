'use strict';
// Consulta somente dados públicos. Não acessa nem altera registros do CRM.
// Uso: node scripts/check-b2g-sources.cjs [dataInicio] [dataFim] [UF] [cidade]
const { randomBytes } = require('node:crypto');
process.env.JWT_SECRET ||= randomBytes(32).toString('hex');
const router = require('../apps/api/api/b2g-search.cjs');
const handler = route => router.stack.find(layer => layer.route?.path === route).route.stack.at(-1).handle;
const invoke = async (route, query) => {
  let body;
  const res = { json: value => { body = value; }, status: () => res };
  await handler(route)({ query }, res);
  return body;
};
(async () => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const since = new Date(`${today}T12:00:00Z`); since.setUTCDate(since.getUTCDate() - 30);
  const catalog = await invoke('/fontes', {});
  const query = { fontes: process.env.B2G_SOURCES || catalog.fontes.map(s => s.id).join(','), dataInicio: process.argv[2] || since.toISOString().slice(0, 10), dataFim: process.argv[3] || today, uf: process.argv[4] || '', cidade: process.argv[5] || '', tamanhoPagina: '20', apenasVigentes: process.env.B2G_ONLY_ACTIVE || 'false' };
  const result = await invoke('/search', query);
  console.log(JSON.stringify({ query, total: result.total, fontes: result.statusFontes, filtros: result.diagnosticoFiltros, periodoConsulta: result.periodoConsulta, avisoPeriodo: result.avisoPeriodo, erros: result.erros }, null, 2));
  if (!result.statusFontes || result.statusFontes.length !== query.fontes.split(',').length || result.statusFontes.some(s => ['error', 'partial'].includes(s.status))) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
