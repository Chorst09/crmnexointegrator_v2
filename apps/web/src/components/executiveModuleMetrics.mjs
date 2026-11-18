const list = value => Array.isArray(value) ? value : [];
const numeric = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const status = item => String(item?.status || '').toUpperCase();
const date = value => { const parsed = value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value) : null; return parsed && Number.isFinite(parsed.getTime()) ? parsed : null; };

export function buildExecutiveModuleMetrics(computed = {}, now = new Date()) {
  const companies = [...new Map([...list(computed.companiesB2B), ...list(computed.companiesB2G)].map((item,index) => [item.id || item.cnpj || `row-${index}`,item])).values()];
  const contracts = list(computed.contractsRange);
  const contractGroups = [
    {label:'Ativos', value:0, count:0, statuses:['ACTIVE']},
    {label:'Renovação', value:0, count:0, statuses:['RENEWAL_PENDING']},
    {label:'Demais', value:0, count:0, statuses:[]}
  ];
  contracts.forEach(item => {const group = contractGroups.find(group => group.statuses.includes(status(item))) || contractGroups[2]; group.value += Math.max(0,numeric(item.value)); group.count += 1;});
  const notices = list(computed.b2gNoticesRange);
  const terminal = new Set(['GANHO','PERDIDO','CANCELADO','CANCELADA','DESERTA','FRACASSADA','NO_GO','WON','LOST','CANCELLED']);
  const today = new Date(now); today.setHours(0,0,0,0);
  const end = new Date(today); end.setDate(end.getDate()+30); end.setHours(23,59,59,999);
  const expiring = notices.filter(item => {if(terminal.has(status(item))) return false; const due = [item.proposalDueDate,item.openingDate,item.dueDate,item.submissionDeadline].map(date).find(Boolean); return due && due >= today && due <= end;});
  const requests = list(computed.preSalesRange);
  const completed = requests.filter(item => status(item)==='FINALIZADA');
  const monthlyPreSales = list(computed.buckets).map(bucket => requests.filter(item => {const created=date(item.createdAt);return created && `${created.getFullYear()}-${String(created.getMonth()+1).padStart(2,'0')}`===bucket.key;}).length);
  return {
    clients:companies.length,
    activeClientPercent:companies.length ? companies.filter(item=>status(item)==='ACTIVE').length/companies.length*100 : 0,
    portfolio:contractGroups.reduce((sum,group)=>sum+group.value,0), contractGroups,
    requests:requests.length, completed:completed.length,
    completionRate:requests.length ? completed.length/requests.length*100 : 0,
    monthlyPreSales, notices:notices.length,
    inAnalysis:notices.filter(item=>status(item)==='ANALISE_EM_ANDAMENTO').length,
    expiring:expiring.length
  };
}
