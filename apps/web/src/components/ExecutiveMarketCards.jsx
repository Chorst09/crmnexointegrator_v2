import { isFinalActivity } from '../utils/dashboardFlow.mjs';
import { ArrowRight, BriefcaseBusiness, CalendarDays, Coins, FileText, Landmark, Layers, TrendingUp, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ExecutiveBrazilMap, ExecutiveDonut, ExecutiveIcon, ExecutiveMiniBars, ExecutiveSparkline, getOpportunityLocations } from './ExecutiveVisuals';
import { revenueBreakdownFromOpportunities } from './generalDashboardMetrics.mjs';
import { buildExecutiveModuleMetrics } from './executiveModuleMetrics.mjs';
import './ExecutiveModuleCards.css';

const number=value=>new Intl.NumberFormat('pt-BR').format(value || 0);
const money=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:2}).format(value || 0);
const percent=value=>`${Number(value || 0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
const statuses=items=>items.reduce((groups,item)=>{const key=String(item.status || 'Não informado');groups.set(key,(groups.get(key)||0)+1);return groups;},new Map());
const isClosed=item=>['WON','LOST','GANHO','PERDIDO','NO_GO'].includes(String(item.b2gStage || item.stage).toUpperCase());
function Card({title,subtitle,icon,kind,tone,route,action,stats,children}) {
  const navigate=useNavigate();
  return <article className={`nex-panel nex-overview-card nex-${tone}`}><header><span className="nex-overview-icon"><ExecutiveIcon icon={icon} kind={kind} size={36}/></span><div><h3>{title}</h3><p>{subtitle}</p></div></header><div className="nex-module-metrics">{stats.map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>{children}<button className="nex-overview-action" onClick={()=>navigate(route)}>{action}<ArrowRight size={12}/></button></article>;
}
export default function ExecutiveMarketCards({computed:c,data,market}) {
  const m=buildExecutiveModuleMetrics({...c,contractsRange:data.contracts || []});
  const opportunities=data[`opportunities${market}`] || [];
  const companies=data[`companies${market}`] || [];
  const open=opportunities.filter(item=>!isClosed(item));
  const proposals=data.proposals || [];
  const contracts=data.contracts || [];
  const activities=data.activities || [];
  const future=activities.filter(item=>item.dueDate && new Date(item.dueDate)>=new Date() && !isFinalActivity(item));
  const overdue=activities.filter(item=>item.dueDate && new Date(item.dueDate)<new Date() && !isFinalActivity(item));
  const locations=getOpportunityLocations(opportunities,companies);
  const monthly=market==='B2B'?c.monthlyB2B:c.monthlyB2G;
  const values=(monthly?.single || []).map((value,index)=>value+(monthly.contract[index] || 0));
  const pipeline=revenueBreakdownFromOpportunities(open).total;
  const active=companies.filter(item=>item.status==='ACTIVE').length;
  const won=opportunities.filter(item=>['WON','GANHO'].includes(String(item.b2gStage || item.stage).toUpperCase()));
  const conversion=opportunities.length ? won.length/opportunities.length*100 : 0;
  const wonByMonth=c.buckets.map(bucket=>revenueBreakdownFromOpportunities(won.filter(item=>{const date=new Date(item.createdAt);return Number.isFinite(date.getTime()) && `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`===bucket.key;})).total);
  const groupedStatuses=[...statuses(proposals).entries()];
  const publicAnalysis=open.filter(item=>['ANALISE','LEAD','QUALIFICATION','DIAGNOSIS'].includes(String(item.b2gStage || item.stage).toUpperCase())).length;
  const winRevenue=revenueBreakdownFromOpportunities(won);
  return <section className="nex-module-overview" aria-label={`Cinco resumos exclusivos ${market}`} data-section="module-overview">
    <Card title={`Pipeline ${market}`} subtitle="Carteira e performance" icon={BriefcaseBusiness} kind="briefcase" tone="blue" route={market==='B2B'?'/oportunidades':'/b2g-oportunidades'} action="Ver oportunidades" stats={[["Oportunidades",number(opportunities.length)],["Em aberto",number(open.length)],["Pipeline",money(pipeline)]]}><div className="nex-overview-b2b"><div><div className="nex-overview-gauge" style={{'--gauge':`${Math.max(0,Math.min(100,conversion))}%`}}><strong>{percent(conversion)}</strong></div><span>Taxa de conversão</span></div><ExecutiveMiniBars values={values} label={`Valor das oportunidades ${market} por entrada`}/></div></Card>
    <Card title={market==='B2B'?'Clientes B2B':'Órgãos B2G'} subtitle={market==='B2B'?'Relacionamento comercial':'Contas públicas'} icon={market==='B2B'?Users:Landmark} kind={market==='B2G'?'building':undefined} tone="green" route={market==='B2B'?'/empresas':'/b2g-orgaos'} action={market==='B2B'?'Ver clientes':'Ver órgãos'} stats={[[market==='B2B'?'Empresas':'Órgãos',number(companies.length)],['Ativos',number(active)],['Localizados',number(locations.length)]]}><div className="nex-overview-geography"><ExecutiveBrazilMap locations={locations} category={market}/><div><small>Localizações exclusivas da carteira {market}.</small></div></div></Card>
    {market==='B2B' ? <>
      <Card title="Propostas B2B" subtitle="Negociação comercial" icon={FileText} tone="purple" route="/propostas" action="Ver propostas" stats={[["Propostas",number(proposals.length)],["Situações",number(groupedStatuses.length)],["Valor",money(proposals.reduce((sum,item)=>sum+Number(item.totalValue || 0),0))]]}><ExecutiveDonut values={groupedStatuses.map(([,value])=>value)} labels={groupedStatuses.map(([label])=>label)} label="Propostas B2B por situação" colors={['#ac70ff','#00bfff','#14dfb0']}/></Card>
      <Card title="Contratos B2B" subtitle="Carteira contratual privada" icon={Layers} kind="layers" tone="amber" route="/contratos" action="Ver contratos" stats={[["Contratos",number(contracts.length)],["Ativos",number(contracts.filter(item=>item.status==='ACTIVE').length)],["Carteira",money(m.portfolio)]]}><ExecutiveDonut values={m.contractGroups.map(item=>item.value)} labels={m.contractGroups.map(item=>item.label)} label="Valor dos contratos B2B por situação"/></Card>
      <Card title="Receitas B2B" subtitle="Vendas ganhas" icon={Coins} kind="coins" tone="cyan" route="/dashboard#receitas-b2b" action="Ver receitas" stats={[["Ganhas",number(won.length)],["Recorrente",money(winRevenue.monthly)],["Contratada",money(winRevenue.total)]]}><ExecutiveMiniBars values={wonByMonth} label="Valor contratado das vendas ganhas B2B por mês de cadastro"/></Card>
    </> : <>
      <Card title="Licitações B2G" subtitle="Processos da carteira pública" icon={Landmark} kind="building" tone="purple" route="/b2g-oportunidades" action="Ver licitações" stats={[["Processos",number(opportunities.length)],["Em análise",number(publicAnalysis)],["Ganhas",number(won.length)]]}><div className="nex-overview-gov-image" role="img" aria-label="Arquitetura institucional"/></Card>
      <Card title="Agenda B2G" subtitle="Compromissos públicos" icon={CalendarDays} tone="amber" route="/b2g-atividades" action="Ver agenda" stats={[["Atividades",number(activities.length)],["Futuras",number(future.length)],["Atrasadas",number(overdue.length)]]}><ExecutiveSparkline values={c.monthlyActivities} label="Atividades B2G por mês" color="#ffb42a"/></Card>
      <Card title="GovFlow B2G" subtitle="Inteligência da carteira pública" icon={TrendingUp} tone="indigo" route="/b2g-dashboard#mapa" action="Ver mapa" stats={[["Pipeline",money(pipeline)],["Conversão",percent(conversion)],["Ganho",money(winRevenue.total)]]}><ExecutiveSparkline values={values} label="Volume financeiro das entradas B2G" color="#00caff"/></Card>
    </>}
  </section>;
}
