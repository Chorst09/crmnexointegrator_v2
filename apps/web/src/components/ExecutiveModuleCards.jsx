import { ArrowRight, BriefcaseBusiness, ChevronRight, Landmark, Layers, Rocket, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ExecutiveBrazilMap, ExecutiveDonut, ExecutiveIcon, ExecutiveMiniBars, ExecutiveSparkline, getOpportunityLocations } from './ExecutiveVisuals';
import { buildExecutiveModuleMetrics } from './executiveModuleMetrics.mjs';
import './ExecutiveModuleCards.css';

const count = value => new Intl.NumberFormat('pt-BR').format(value || 0);
const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:2}).format(value || 0);
const percent = value => `${Number(value || 0).toLocaleString('pt-BR',{maximumFractionDigits:1})}%`;
function Metrics({ items }) {
  return <div className="nex-module-metrics">{items.map(item=><div key={item.label}><strong>{item.value}</strong><span>{item.label}</span></div>)}</div>;
}
function ModuleCard({title, subtitle, icon, kind, tone, route, action='Ver detalhes', children}) {
  const navigate=useNavigate();
  return <article className={`nex-panel nex-overview-card nex-${tone}`}><header><span className="nex-overview-icon"><ExecutiveIcon icon={icon} kind={kind} size={36}/></span><div><h3>{title}</h3><p>{subtitle}</p></div><ChevronRight size={13}/></header>{children}<button className="nex-overview-action" onClick={()=>navigate(route)}>{action}<ArrowRight size={12}/></button></article>;
}
export default function ExecutiveModuleCards({computed:c, access, adminLike}) {
  const m=buildExecutiveModuleMetrics(c);
  const locations=getOpportunityLocations(c.opportunitiesB2GRange,c.companiesB2G);
  const byState=new Map();
  locations.filter(item=>item.state).forEach(item=>byState.set(item.state,(byState.get(item.state)||0)+1));
  const states=[...byState.entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
  const stateTotal=[...byState.values()].reduce((sum,n)=>sum+n,0);
  const b2bValues=c.monthlyB2B?.single?.map((value,i)=>value+(c.monthlyB2B.contract[i]||0)) || [];
  const contractValues=m.contractGroups.map(item=>item.value);
  return <section className="nex-module-overview" aria-label="Visão dos cinco módulos" data-section="module-overview">
    {access.accessB2B && <ModuleCard title="B2B Privado" subtitle="Pipeline e performance" icon={BriefcaseBusiness} kind="briefcase" tone="blue" route="/dashboard"><Metrics items={[{label:'Oportunidades',value:count(c.opportunitiesB2BRange.length)},{label:'Empresas',value:count(c.companiesB2B.length)},{label:'Pipeline',value:money(c.b2bPipelineValue)}]}/><div className="nex-overview-b2b"><div><div className="nex-overview-gauge" style={{'--gauge':`${Math.max(0,Math.min(100,c.b2bConversion))}%`}}><strong>{percent(c.b2bConversion)}</strong></div><span>Taxa de conversão</span></div><ExecutiveMiniBars values={b2bValues} label="Valor das oportunidades B2B por mês de entrada"/></div></ModuleCard>}
    {access.accessB2G && <ModuleCard title="B2G Governo" subtitle="Editais e licitações" icon={Landmark} kind="building" tone="green" route="/b2g-dashboard#mapa" action="Ver mapa"><Metrics items={[{label:'Oportunidades',value:count(c.opportunitiesB2GRange.length)},{label:'Órgãos',value:count(c.companiesB2G.length)},{label:'Pipeline',value:money(c.b2gRevenue.total)}]}/><div className="nex-overview-geography"><ExecutiveBrazilMap locations={locations} category="B2G"/><div>{states.map(([state,total])=><p key={state}><b>{state}</b><span>{percent(stateTotal ? total/stateTotal*100 : 0)}</span></p>)}{states.length === 0 && <small>{locations.length ? 'Pontos por coordenadas' : 'Sem UF ou coordenadas cadastradas'}</small>}</div></div></ModuleCard>}
    {(access.accessPreSales || adminLike) && <ModuleCard title="Pré-Vendas" subtitle="Solicitações e qualificação" icon={Rocket} kind="rocket" tone="purple" route="/pre-vendas"><Metrics items={[{label:'Solicitações',value:count(m.requests)},{label:'Concluídas',value:count(m.completed)},{label:'Conclusão',value:percent(m.completionRate)}]}/><ExecutiveSparkline values={m.monthlyPreSales} label="Solicitações de pré-vendas por mês"/></ModuleCard>}
    {(access.accessB2B || adminLike) && <ModuleCard title="Gestão" subtitle="Clientes e contratos" icon={Layers} kind="layers" tone="amber" route="/contratos" action="Ver carteira"><Metrics items={[{label:'Clientes',value:count(m.clients)},{label:'Ativos',value:percent(m.activeClientPercent)},{label:'Carteira',value:money(m.portfolio)}]}/><ExecutiveDonut values={contractValues} labels={m.contractGroups.map(item=>item.label)} label="Valor dos contratos por situação"/><div className="nex-overview-donut-legend">{m.contractGroups.map((item,index)=><span key={item.label}><i style={{background:['#ffb400','#008fff','#00d8ef'][index]}}/>{item.label}</span>)}</div></ModuleCard>}
    {access.accessB2G && <ModuleCard title="GovFlow B2G" subtitle="Inteligência de editais" icon={TrendingUp} tone="indigo" route="/b2g-oportunidades" action="Ver oportunidades"><Metrics items={[{label:'Editais',value:count(m.notices)},{label:'Em análise',value:count(m.inAnalysis)},{label:'Vencem em 30d',value:count(m.expiring)}]}/><div className="nex-overview-gov-image" role="img" aria-label="Arquitetura institucional e inteligência de governo"/></ModuleCard>}
  </section>;
}
