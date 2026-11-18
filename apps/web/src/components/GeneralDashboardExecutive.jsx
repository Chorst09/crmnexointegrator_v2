import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExecutiveIcon, ExecutiveRevenueChart, ExecutiveFunnel, ExecutiveBrazilMap, getOpportunityLocations } from './ExecutiveVisuals';
import { ArrowRight, ArrowUpRight, CalendarDays, CheckCircle2, ChevronRight, Clock3, Coins, Handshake, RefreshCcw, Rocket, TrendingUp, TriangleAlert, Trophy, Brain, BriefcaseBusiness, Landmark, Settings, Check } from 'lucide-react';
import ExecutiveModuleNavigation from './ExecutiveModuleNavigation';
import ExecutiveModuleCards from './ExecutiveModuleCards';
import './GeneralDashboardExecutive.css';
import './GeneralDashboardExecutiveSkin.css';
const money = n => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0
}).format(Number(n) || 0);
const number = n => new Intl.NumberFormat('pt-BR').format(Number(n) || 0);
const pct = n => `${Number(n || 0).toLocaleString('pt-BR', {
  maximumFractionDigits: 1
})}%`;
const rows = v => Array.isArray(v) ? v : [];
const initial = name => String(name || '?').split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('');
function Panel({
  title,
  action,
  onAction,
  children,
  badge,
  className = ''
}) {
  return <section className={`nex-panel ${className}`}><div className="nex-panel-heading"><h2>{title} {badge > 0 && <span className="nex-count">{badge}</span>}</h2>{action && <button onClick={onAction} className="nex-link">{action}<ArrowRight size={14} /></button>}</div>{children}</section>;
}
function DashboardKPICard({
  title,
  value,
  icon: Icon,
  tone = 'cyan',
  delta,
  subtitle,
  kind
}) {
  return <section className={`nex-panel nex-kpi nex-${tone}`}><span className="nex-icon"><ExecutiveIcon kind={kind} icon={Icon} /></span><div><h2>{title}</h2><strong>{value}</strong><small className={delta == null ? '' : delta < 0 ? 'nex-negative' : 'nex-positive'}>{delta == null ? subtitle : <><ArrowUpRight size={13} />{delta > 0 ? '+' : ''}{pct(delta)} <span>vs. período anterior</span></>}</small></div></section>;
}
export default function GeneralDashboardExecutive({
  computed: c,
  data,
  user,
  access,
  adminLike,
  moduleHealth,
  timeRange,
  setTimeRange,
  loading,
  updatedAt,
  onRefresh
}) {
  const navigate = useNavigate();
  const intelligenceDialog = useRef(null);
  const alertDialog = useRef(null);
  const teamDialog = useRef(null);
  useEffect(() => {
    const open = () => {
      if (!intelligenceDialog.current?.open) intelligenceDialog.current?.showModal();
    };
    window.addEventListener('nexos-open-intelligence', open);
    return () => window.removeEventListener('nexos-open-intelligence', open);
  }, []);
  const [months, setMonths] = useState('12');
  const [funnelMode, setFunnelMode] = useState('count');
  const [mapCategory, setMapCategory] = useState('B2B');
  const opportunities = [...c.opportunitiesB2BRange, ...c.opportunitiesB2GRange];
  const change = (current, previous) => previous > 0 ? (current - previous) / previous * 100 : null;
  const growth = change(opportunities.length, c.previousMetrics.opportunities);
  const upcoming = rows(data.activities).filter(item => item.dueDate && new Date(item.dueDate) >= new Date() && !['COMPLETED', 'CANCELLED'].includes(String(item.status).toUpperCase())).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
  const alerts = [...c.overdueActivities.map(item => ({
    title: item.subject || 'Atividade atrasada',
    sub: 'Prazo da atividade ultrapassado',
    value: item.opportunity?.value,
    route: '/atividades',
    tone: 'red',
    icon: TriangleAlert
  })), ...c.pendingPreSales.map(item => ({
    title: item.title || item.subject || 'Pré-vendas pendente',
    sub: 'Aguardando análise ou aprovação',
    route: '/pre-vendas',
    tone: 'amber',
    icon: Clock3
  })), ...c.inAnalysisB2G.map(item => ({
    title: item.title || item.object || 'Edital em análise',
    sub: 'Aguardando decisão GO / NO-GO',
    value: item.estimatedValue,
    route: '/b2g-dashboard',
    tone: 'cyan',
    icon: CalendarDays
  })), ...c.blockedPreSalesPocs.map(item => ({
    title: item.title || 'POC bloqueada',
    sub: 'Requer atenção técnica',
    route: '/gestao-pocs',
    tone: 'red',
    icon: TriangleAlert
  })), ...c.overduePreSalesPocs.map(item => ({
    title: item.title || 'POC atrasada',
    sub: 'Prazo de conclusão ultrapassado',
    route: '/gestao-pocs',
    tone: 'amber',
    icon: Clock3
  })), ...[...c.expiredOportunidades, ...c.expiringOportunidades].map(item => ({
    title: item.title || item.name || 'Registro de oportunidade',
    sub: 'Verificar prazo de vigência',
    route: '/pre-vendas',
    tone: 'amber',
    icon: Clock3
  }))];
  const openActivities = c.pendingActivities.length;
  const health = openActivities ? Math.round(Math.max(0, 1 - c.overdueActivities.length / openActivities) * 100) : null;
  const stages = c.b2bStageBreakdown.filter(item => item.key !== 'LOST');
  const chartCount = Number(months);
  const mapRows = mapCategory === 'B2B' ? c.opportunitiesB2BRange : mapCategory === 'B2G' ? c.opportunitiesB2GRange : c.preSalesRange;
  const geoPoints = getOpportunityLocations(mapRows, [...c.companiesB2B, ...c.companiesB2G]);
  const failures = moduleHealth.filter(item => item.status === 'error');
  const hour = new Date().getHours();
  return <div className="nex-executive">
    <dialog ref={intelligenceDialog} className="nex-ai-dialog" aria-labelledby="nex-ai-title" onClick={event => {
      if (event.target === intelligenceDialog.current) intelligenceDialog.current.close();
    }}><h2 id="nex-ai-title">✧ NEXOS Intelligence</h2><p>Resumo dos últimos {timeRange} dias com os dados disponíveis no CRM.</p><p><strong>{money(c.totalPipeline)}</strong> em negociação em {number(opportunities.length)} oportunidades cadastradas no período.</p><p><strong>{alerts.length} alertas</strong> merecem atenção. {c.overdueActivities.length > 0 ? 'Priorize atividades atrasadas e retome os contatos comerciais.' : 'Mantenha o acompanhamento da agenda comercial.'}</p><p>Conversão B2B: <strong>{pct(c.b2bConversion)}</strong>. Receita contratada: <strong>{money(c.totalWonValue)}</strong>.</p><button onClick={() => intelligenceDialog.current.close()}>Fechar</button></dialog>
    <dialog ref={alertDialog} className="nex-ai-dialog" aria-labelledby="nex-alert-title"><h2 id="nex-alert-title">Alertas e Ações · {alerts.length}</h2><div style={{
        maxHeight: '60vh',
        overflow: 'auto'
      }}>{alerts.length ? alerts.map((item, i) => <button className={`nex-action-row nex-${item.tone}`} key={i} onClick={() => navigate(item.route)}><item.icon size={18} /><span className="nex-row-copy"><strong>{item.title}</strong><small>{item.sub}</small></span>{item.value != null && <b>{money(item.value)}</b>}<ChevronRight size={14} /></button>) : <p>Tudo em dia no período selecionado.</p>}</div><button onClick={() => alertDialog.current.close()}>Fechar</button></dialog>
    <dialog ref={teamDialog} className="nex-ai-dialog" aria-labelledby="nex-team-title"><h2 id="nex-team-title">Performance da Equipe</h2><p>Ordenado por pipeline no período. A barra indica a proporção de oportunidades ganhas.</p>{c.teamPerformance.length ? c.teamPerformance.map((item, index) => <div className="nex-team-row" key={item.name}><span className="nex-avatar">{initial(item.name)}</span><div className="nex-team-name"><strong>{index + 1}. {item.name}</strong><small>{number(item.total)} oportunidades · {number(item.won)} ganhas</small></div><strong>{money(item.pipeline)}</strong></div>) : <p>Sem dados de equipe no período.</p>}<button onClick={() => teamDialog.current.close()}>Fechar</button></dialog>
    <section className="nex-welcome" data-section="header"><div className="nex-welcome-copy"><TrendingUp size={40} /><div><span className="nex-eyebrow">DASHBOARD GERAL · VISÃO EXECUTIVA</span><h1>{hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'}, {String(user?.name || 'usuário').split(' ')[0]}!</h1><p>Acompanhe o desempenho da sua operação em tempo real.</p></div></div><div className="nex-welcome-tools"><label className="nex-select"><CalendarDays size={16} /><select aria-label="Período do dashboard" value={timeRange} onChange={e => setTimeRange(e.target.value)}>{['30', '90', '180', '365'].map(n => <option key={n} value={n}>Últimos {n} dias</option>)}</select></label><button className="nex-refresh" aria-label="Atualizar dashboard" disabled={loading} onClick={onRefresh}><RefreshCcw size={17} className={loading ? 'animate-spin' : ''} /></button></div></section>
    {failures.length > 0 && <p className="nex-warning" role="status"><TriangleAlert size={16} />Dados parciais: {failures.map(item => item.label).join(', ')}. Atualize para tentar novamente.</p>}
    <div className="nex-kpis" data-section="kpis">
      <DashboardKPICard title="Receita Contratada" value={money(c.totalWonValue)} icon={Coins} kind="coins" tone="blue" delta={change(c.totalWonValue, c.previousMetrics.revenue)} subtitle="Vendas ganhas · sem base anterior" />
      <DashboardKPICard title="Pipeline Comercial" value={money(c.totalPipeline)} icon={Handshake} delta={change(c.totalPipeline, c.previousMetrics.pipeline)} subtitle="Em negociação · sem base anterior" />
      <DashboardKPICard title="Oportunidades" value={number(opportunities.length)} icon={Trophy} kind="trophy" tone="amber" delta={growth} subtitle="Sem base anterior para comparação" />
      <DashboardKPICard title="Licitações em Andamento" value={number(c.activeB2GNotices.length)} icon={Landmark} kind="building" tone="blue" delta={change(c.activeB2GNotices.length, c.previousMetrics.notices)} subtitle="Editais ativos · sem base anterior" />
      <section className="nex-panel nex-health" title="Saúde da agenda comercial: percentual de atividades pendentes que não estão atrasadas."><div className="nex-ring" style={{
          '--progress': `${health || 0}%`,
          '--ring-green': `${(health || 0) * .55}%`,
          '--ring-yellow': `${(health || 0) * .7}%`
        }}><strong>{health == null ? '—' : `${health}%`}</strong></div><div><h2>Saúde Comercial</h2><strong className={health == null ? '' : health >= 80 ? 'nex-positive' : 'nex-negative'}>{health == null ? 'Sem atividades' : health >= 90 ? '● Excelente' : health >= 80 ? '● Boa' : '● Atenção'}</strong><small>Agenda em dia</small></div></section>
    </div>
    <div className="nex-three nex-charts" data-section="charts">
      <Panel title="Evolução da Receita"><label className="nex-chart-filter"><select aria-label="Horizonte da receita" value={months} onChange={e => setMonths(e.target.value)}><option value="12">12 meses</option><option value="6">6 meses</option></select></label><div className="nex-chart"><ExecutiveRevenueChart labels={c.buckets.slice(-chartCount).map(item => item.label)} won={c.monthlyWon.slice(-chartCount)} potential={c.monthlyPotential.slice(-chartCount)}/></div></Panel>
      <Panel title="Funil Comercial B2B"><label className="nex-chart-filter"><select aria-label="Métrica do funil" value={funnelMode} onChange={e => setFunnelMode(e.target.value)}><option value="count">Pipeline</option><option value="value">Valor</option></select></label><div className="nex-funnel-layout"><div className="nex-funnel"><ExecutiveFunnel stages={stages} mode={funnelMode} formatMoney={money} formatNumber={number}/></div><div className="nex-conversion"><span>Taxa de conversão</span><strong>{pct(c.b2bConversion)}</strong><TrendingUp size={55} /><button className="nex-link" onClick={() => navigate('/oportunidades')}>Ver detalhes <ArrowRight size={13} /></button></div></div></Panel>
      <Panel title="Mapa de Oportunidades"><div className="nex-map-layout"><ExecutiveBrazilMap locations={geoPoints} category={mapCategory}/><div className="nex-map-legend">{[{
              key: 'B2B',
              label: 'B2B Privado',
              count: c.opportunitiesB2BRange.length
            }, {
              key: 'B2G',
              label: 'B2G Governo',
              count: c.opportunitiesB2GRange.length
            }, {
              key: 'PRE',
              label: 'Pré-Vendas',
              count: c.preSalesRange.length
            }].map((item, i) => <button key={item.key} className={mapCategory === item.key ? 'active' : ''} onClick={() => setMapCategory(item.key)}><i style={{
                background: ['#00bdff', '#ffb900', '#00e792'][i]
              }} /><span>{item.label}<strong>{number(item.count)}</strong></span></button>)}<small>{geoPoints.length ? `${geoPoints.length} registros localizados${geoPoints.some(point => point.approximate) ? " · inclui localização por UF" : ""}` : 'Sem coordenadas cadastradas'}</small><button className="nex-link" onClick={() => navigate(mapCategory === 'B2G' ? '/b2g-oportunidades' : mapCategory === 'PRE' ? '/pre-vendas' : '/oportunidades')}>Ver oportunidades <ArrowRight size={13} /></button></div></div></Panel>
    </div>
    <div className="nex-three nex-lists" data-section="lists">
      <Panel title="Performance da Equipe" action="Ver ranking" onAction={() => teamDialog.current?.showModal()}><div className="nex-list-body">{c.teamPerformance.length ? c.teamPerformance.map((item, i) => {
            const rate = item.total ? item.won / item.total * 100 : 0;
            return <div className="nex-team-row" key={item.name}><span className="nex-rank">{i === 0 ? <Trophy size={17} /> : i + 1}</span><span className="nex-avatar">{initial(item.name)}</span><div className="nex-team-name"><strong>{item.name}</strong><small>{number(item.total)} oportunidades</small></div><span className="nex-progress"><i style={{
                  width: `${rate}%`
                }} /></span><strong title="Conversão em vendas ganhas">{pct(rate)}</strong></div>;
          }) : <p className="nex-empty">Sem dados de equipe no período.</p>}</div></Panel>
      <Panel title="Alertas e Ações" badge={alerts.length} action="Ver todos" onAction={() => alertDialog.current?.showModal()}><div className="nex-list-body" id="nex-alert-list">{alerts.length ? alerts.map((item, i) => <button className={`nex-action-row nex-${item.tone}`} key={i} onClick={() => navigate(item.route)}><span className="nex-status-icon"><item.icon size={20} /></span><span className="nex-row-copy"><strong>{item.title}</strong><small>{item.sub}</small></span>{item.value != null && <b>{money(item.value)}</b>}<ChevronRight size={15} /></button>) : <p className="nex-empty"><CheckCircle2 size={21} />Tudo em dia no período selecionado.</p>}</div></Panel>
      <Panel title="Próximos Compromissos" action="Ver agenda" onAction={() => navigate('/atividades')}><div className="nex-list-body">{upcoming.length ? upcoming.map((item, i) => <button className="nex-action-row" key={item.id || i} onClick={() => navigate('/atividades')}><span className="nex-status-icon"><CalendarDays size={20} /></span><span className="nex-row-copy"><strong>{item.subject || 'Atividade'}</strong><small>{new Date(item.dueDate).toLocaleDateString('pt-BR')}</small></span><b>{new Date(item.dueDate).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              })}</b></button>) : <p className="nex-empty">Nenhum compromisso futuro cadastrado.</p>}</div></Panel>
    </div>
    <ExecutiveModuleCards computed={c} access={access} adminLike={adminLike}/>
    <ExecutiveModuleNavigation access={access} adminLike={adminLike} onIntelligence={()=>intelligenceDialog.current?.showModal()} updatedAt={updatedAt}/>
  </div>;
}
