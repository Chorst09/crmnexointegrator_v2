/** Exhaust a paginated source; never silently present the first page as the total. */
export async function loadDashboardPages(getPage, { key = 'projects', limit = 200 } = {}) {
  const rows = [], seen = new Set();
  let page = 1, expected = null;
  while (true) {
    const payload = await getPage(page, limit);
    const items = Array.isArray(payload) ? payload : payload?.[key] || payload?.data;
    if (!Array.isArray(items)) throw new Error('Resposta de dados inválida');
    const rawTotal = payload?.total ?? payload?.pagination?.total;
    if (rawTotal != null && Number.isFinite(Number(rawTotal))) expected = Number(rawTotal);
    let added = 0;
    for (const row of items) {
      if (row.id != null && seen.has(String(row.id))) continue;
      if (row.id != null) seen.add(String(row.id));
      rows.push(row); added += 1;
    }
    if (Array.isArray(payload)) return rows;
    if (expected != null && rows.length >= expected) return rows;
    const pages = Number(payload?.pagination?.pages);
    if (Number.isFinite(pages) && pages > 0 && page >= pages) return rows;
    if (expected == null && !(pages > 0) && items.length < limit) return rows;
    if (!added) throw new Error('A fonte não retornou todas as páginas do dashboard');
    page += 1;
  }
}
