import { ArrowRight, Brain, BriefcaseBusiness, Check, Landmark, Rocket, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MARKET_NAVIGATION } from '../utils/dashboardMarket.mjs';
import { ExecutiveIcon, ExecutivePlatform } from './ExecutiveVisuals';

export default function ExecutiveModuleNavigation({access,adminLike,onIntelligence,updatedAt,market=null}) {
  const navigate=useNavigate();
  const generalModules=[
    access.accessB2B && {title:'Comercial B2B',description:'Gestão de oportunidades e clientes privados',route:'/dashboard',icon:BriefcaseBusiness,kind:'briefcase',tone:'blue'},
    access.accessB2G && {title:'Comercial B2G',description:'Licitações e contratos públicos',route:'/b2g-dashboard',icon:Landmark,kind:'building',tone:'green'},
    (access.accessPreSales || adminLike) && {title:'Pré-Vendas',description:'Prospecção e qualificação',route:'/pre-vendas',icon:Rocket,kind:'rocket',tone:'purple'},
    (access.accessB2B || adminLike) && {title:'Gestão',description:'Clientes, contratos e performance',route:'/contratos',icon:Settings,tone:'amber'},
    (access.accessB2B || access.accessB2G || adminLike) && {title:'NEXOS Intelligence',description:'Inteligência para decisões estratégicas',action:onIntelligence,icon:Brain,tone:'cyan'}
  ].filter(Boolean);
  const modules=market ? [...MARKET_NAVIGATION[market].map(item=>({...item,icon:BriefcaseBusiness})),{title:'NEXOS Intelligence',description:`Inteligência da operação ${market}`,action:onIntelligence,icon:Brain,tone:'cyan'}] : generalModules;
  return <><section className="nex-modules" data-section="modules"><div className="nex-modules-intro"><h2>{market ? `Operação ${market}` : 'Nossos Módulos'}</h2><p>{market ? `Ferramentas e atalhos exclusivos da operação ${market}.` : 'Uma plataforma completa para grandes resultados.'}</p><ExecutivePlatform/></div><div className="nex-module-grid">{modules.map(item=><article key={item.title} className={`nex-panel nex-module nex-${item.tone}`}><span className="nex-module-icon"><ExecutiveIcon kind={item.kind} icon={item.icon} size={57}/></span><h3>{item.title}</h3><p>{item.description}</p><button onClick={()=>item.action ? item.action() : navigate(item.route)}>Acessar<ArrowRight size={15}/></button></article>)}</div><aside className="nex-differentials"><h3>Diferenciais NEXOS</h3>{['Visão comercial integrada','Pipeline de oportunidades','Automação de processos','Relatórios estratégicos','Indicadores em tempo real'].map(label=><p key={label}><Check size={14}/>{label}</p>)}<button onClick={onIntelligence}>Descobrir mais<ArrowRight size={14}/></button></aside></section><footer className="nex-footer"><span>Inteligência que conecta negócios.</span>{updatedAt && <span>Atualizado {updatedAt.toLocaleString('pt-BR')}</span>}</footer></>;
}
