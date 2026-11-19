import { revenueBreakdownFromOpportunities } from '../components/generalDashboardMetrics.mjs';
export const isFinalActivity = item => ['COMPLETED','DONE','CANCELLED','CONCLUIDA','ENCERRADA'].includes(String(item?.status || '').toUpperCase());
export const activityMarket = item => item?.clientType || item?.company?.clientType || (item?.opportunity?.b2gStage || String(item?.opportunity?.number || '').startsWith('B2G-') ? 'B2G' : item?.opportunity?.company?.clientType);
export function activityRoute(item) {
  const route = activityMarket(item)==='B2G' ? '/b2g-atividades' : '/atividades';
  return item?.id ? `${route}?activityId=${encodeURIComponent(item.id)}` : route;
}
export function upcomingActivities(items = [], now = new Date()) {
  return items.filter(item => !isFinalActivity(item) && item.dueDate && Number.isFinite(new Date(item.dueDate).getTime()) && new Date(item.dueDate)>=now).sort((a,b)=>new Date(a.dueDate)-new Date(b.dueDate));
}
export function opportunityAlerts(items = [], market, now = new Date()) {
  const current = now.getTime(), day=86400000;
  return items.flatMap(item=>{
    if(['WON','LOST','GANHO','PERDIDO','NO_GO'].includes(String(item.b2gStage || item.stage).toUpperCase())) return [];
    const due = item.expectedCloseDate ? new Date(item.expectedCloseDate).getTime() : NaN;
    const updated = new Date(item.updatedAt || item.createdAt).getTime();
    const stale = Math.floor((current-updated)/day);
    const deadline = Number.isFinite(due) && due-current<=3*day;
    if(!deadline && !(Number.isFinite(stale) && stale>=15)) return [];
    return [{ id:item.id, title:item.title || item.company?.name || `Oportunidade ${market}`, sub:deadline ? due<current ? 'Previsão de fechamento vencida' : 'Fechamento previsto nos próximos 3 dias' : `Sem atualização há ${stale} dias`, value:revenueBreakdownFromOpportunities([item]).total, tone:deadline && due<current ? 'red' : 'amber', route:`${market==='B2G'?'/b2g-oportunidades':'/oportunidades'}?opportunityId=${encodeURIComponent(item.id)}&mode=view` }];
  });
}
