import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import B2BRevenueCards from './B2BRevenueCards';
import DashboardAdvancedChart from './DashboardAdvancedChart';
import { useTheme } from '../theme/ThemeProvider';

const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 }).format(Number(value) || 0);
const day = value => value ? value.slice(0, 10).split('-').reverse().join('/') : '—';
const columns = ['Mês', 'Recorrente ganha', 'Produtos ganhos', 'Setup ganho', 'Total ganho', 'Potencial ponderado'];

function exportCsv(rows, future) {
  const safe = value => '"' + String(value).replace(/"/g, '""') + '"';
  const numeric = n => (Number(n) || 0).toFixed(2).replace('.', ',');
  const content = [columns, ...rows.map(r => [r.label, numeric(r.recurring), numeric(r.products), numeric(r.setup), numeric(r.total), numeric(r.potential)])].map(row => row.map(safe).join(';')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url; a.download = `receitas-b2b-${future ? 'proximos-12-meses' : 'periodo'}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function RevenueDetail({ selection, rows, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (selection && !dialog.open) dialog.showModal();
    if (!selection && dialog.open) dialog.close();
  }, [selection]);
  return createPortal(<dialog ref={ref} className="b2b-revenue-dialog" aria-labelledby="b2b-revenue-detail-title" onCancel={onClose} onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }}>
    <div className="b2b-revenue-dialog__body">
      <header><div><h2 id="b2b-revenue-detail-title">{selection?.title}</h2><p>{rows.length} oportunidade(s) · contribuição total {money(rows.reduce((s, r) => s + r.amount, 0))}</p></div><button type="button" onClick={onClose} aria-label="Fechar detalhamento"><X size={20} /></button></header>
      <p>Valores derivados das oportunidades. A vigência usa a data de fechamento e a duração contratada; a data final é exclusiva.</p>
      <div className="b2b-revenue-panel__table-scroll"><table><thead><tr>{['Cliente / oportunidade', 'Responsável', 'Mensalidade', 'Vigência / previsão', 'Contribuição'].map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>
        {rows.map(r => <tr key={r.id}><td><strong>{r.client}</strong><span>{r.number || r.id} · {r.title}</span></td><td>{r.owner}</td><td>{r.months ? money(r.monthly) : '—'}</td><td>{r.start ? `${day(r.start)} → ${day(r.end)}` : `Previsão: ${day(r.expected)}`}{r.months && <span>{r.months} meses</span>}</td><td>{money(r.amount)}</td></tr>)}
        {!rows.length && <tr><td colSpan={5}>Nenhuma oportunidade contribui para este indicador nos filtros atuais.</td></tr>}
      </tbody></table></div>
    </div>
  </dialog>, document.body);
}

export default function B2BRevenuePanel({ revenue, insights, historyLabel }) {
  const { resolvedTheme } = useTheme();
  const tickColor = resolvedTheme === 'dark' ? '#94a3b8' : '#475569';
  const [selection, setSelection] = useState(null);
  const [future, setFuture] = useState(false);
  const [view, setView] = useState('chart');
  const inspect = (key, title) => setSelection({ key, title });
  const rows = (future ? insights?.projection : insights?.monthly) || [];
  const sum = field => rows.reduce((n, r) => n + r[field], 0);
  const total = sum('total');
  const potential = sum('potential');
  const metrics = insights?.comparison?.metrics?.total;
  const series = [
    { label: 'Recorrente ganha', field: 'recurring', color: '#18c8df' },
    { label: 'Produtos ganhos', field: 'products', color: '#ff8a26' },
    { label: 'Setup ganho', field: 'setup', color: '#a78bfa' },
    ...(future ? [{ label: 'Potencial ponderado', field: 'potential', color: '#64748b' }] : [])
  ];
  return <div className="b2b-revenue-panel">
    <B2BRevenueCards revenue={revenue} insights={insights} historyLabel={historyLabel} onInspect={inspect} />
    {insights && <>
      <div className="b2b-revenue-panel__breakdown" aria-label="Detalhamento da receita pontual">
        <span>Pontual no período</span>
        <button type="button" onClick={() => inspect('periodProducts', 'Produtos no período')}>Produtos <strong>{money(insights.breakdown.products)}</strong> ↗</button>
        <button type="button" onClick={() => inspect('periodSetup', 'Implantação e setup no período')}>Implantação / setup <strong>{money(insights.breakdown.setup)}</strong> ↗</button>
        {insights.comparison.available && <span>Total do período: {metrics.delta > 0 ? '+' : ''}{money(metrics.delta)} em relação ao período anterior.</span>}
      </div>
      <section className="b2b-revenue-panel__renewals" aria-label="Contratos próximos do fim">
        <div><h3>Renovações no radar</h3><p>MRR de vendas ganhas cuja vigência termina em até 30, 60 ou 90 dias. Faixas cumulativas.</p></div>
        <div className="b2b-revenue-panel__bands">{insights.expirations.bands.map(b => <button type="button" key={b.days} onClick={() => inspect(`expiry${b.days}`, `Vigências encerrando em até ${b.days} dias`)}><span>Até {b.days} dias · {b.count} contrato(s)</span><strong>{money(b.monthlyRevenue)}<small> / mês</small></strong></button>)}</div>
      </section>
    </>}
    <section className="b2b-revenue-panel__evolution" aria-label="Evolução das receitas">
      <div className="b2b-revenue-panel__toolbar">
        <div className="b2b-revenue-panel__toggle" role="group" aria-label="Horizonte das receitas"><button type="button" aria-pressed={!future} onClick={() => setFuture(false)}>Período selecionado</button><button type="button" aria-pressed={future} onClick={() => setFuture(true)}>Próximos 12 meses</button></div>
        <div className="b2b-revenue-panel__actions"><div className="b2b-revenue-panel__toggle" role="group" aria-label="Visualização das receitas"><button type="button" aria-pressed={view === 'chart'} onClick={() => setView('chart')}>Gráfico</button><button type="button" aria-pressed={view === 'table'} onClick={() => setView('table')}>Tabela</button></div><button type="button" onClick={() => exportCsv(rows, future)} disabled={!rows.length}><Download size={14} />Exportar CSV (Excel)</button></div>
      </div>
      <p className="b2b-revenue-panel__caption">{future ? `${day(insights?.projectionPeriod?.start)} a ${day(insights?.projectionPeriod?.end)} · contratos ganhos: ${money(total)} · potencial ponderado: ${money(potential)}. Potencial = valor × probabilidade, condicionado ao fechamento na data prevista. Contratos encerrados deixam de gerar parcelas; renovações não são presumidas.` : `${historyLabel} · total projetado das vendas ganhas: ${money(total)}. Meses parciais respeitam as datas do filtro.`}</p>
      {future && insights?.exclusions.unscheduledOpen > 0 && <p className="b2b-revenue-panel__caption">{insights.exclusions.unscheduledOpen} oportunidade(s) sem previsão futura válida fora da projeção.</p>}
      {view === 'chart' ? <DashboardAdvancedChart title={future ? 'Projeção dos próximos 12 meses' : 'Evolução das Receitas'} subtitle={future ? 'Parcelas dos contratos ganhos e potencial ponderado das oportunidades abertas' : 'Recorrente, produtos e implantação por mês'} type="bar" height={250}
        data={{ labels: rows.map(r => r.label), datasets: series.map(s => ({ label: s.label, data: rows.map(r => r[s.field]), backgroundColor: s.color, stack: s.field === 'potential' ? 'potential' : 'won', borderRadius: 3, maxBarThickness: 38 })) }}
        customOptions={{ scales: { x: { stacked: true, grid: { display: false }, ticks: { autoSkip: true, maxTicksLimit: 12, maxRotation: 0, color: tickColor } }, y: { stacked: true, beginAtZero: true, ticks: { callback: value => money(value), color: tickColor }, grid: { color: 'rgba(148,163,184,.15)' } } }, plugins: { tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } } }}
        isEmpty={!total && !potential} emptyMessage="Nenhuma receita projetada neste horizonte." /> : <div className="b2b-revenue-panel__table-scroll"><table><caption>{future ? 'Projeção mensal dos próximos 12 meses' : 'Receitas mensais do período selecionado'}</caption><thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.month}><td>{r.label}</td>{['recurring', 'products', 'setup', 'total', 'potential'].map(k => <td key={k}>{money(r[k])}</td>)}</tr>)}</tbody><tfoot><tr><th>Total</th>{['recurring', 'products', 'setup', 'total', 'potential'].map(k => <td key={k}>{money(sum(k))}</td>)}</tr></tfoot></table></div>}
    </section>
    <RevenueDetail selection={selection} rows={selection?.key.startsWith('expiry') ? (insights?.expirations.rows || []).filter(r => r.days <= Number(selection.key.slice(6))) : insights?.details?.[selection?.key] || []} onClose={() => setSelection(null)} />
  </div>;
}
