// Read all authorized pages before calculating dashboard totals.
export async function loadPreSalesDashboardRows(getPage, limit = 200) {
  const rows = [], seen = new Set();
  let page=1, pages=1;
  do {
    const payload=await getPage(page,limit);
    const items=Array.isArray(payload?.solicitacoes)?payload.solicitacoes:Array.isArray(payload?.data)?payload.data:Array.isArray(payload)?payload:[];
    for(const row of items){if(!row.id || !seen.has(row.id)){rows.push(row);if(row.id)seen.add(row.id);}}
    const total=Number(payload?.pagination?.total ?? payload?.total);
    const reported=Number(payload?.pagination?.pages);
    pages=Number.isFinite(reported) && reported>0 ? Math.ceil(reported) : Number.isFinite(total) && total>0 ? Math.ceil(total/limit) : 1;
    if(page<pages && items.length===0)throw new Error('Página de solicitações indisponível');
    page+=1;
  } while(page<=pages);
  return rows;
}
