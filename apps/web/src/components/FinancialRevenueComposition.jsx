import { Bar3DShape, Pie3DShape } from './charts/Chart3DShapes';
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export const REVENUE_COLORS = { recurring: '#22D3EE', oneTime: '#A78BFA', unknown: '#FBBF24' };
export const financialCurrency = value => (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const compact = value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const tooltip = { backgroundColor: "rgb(var(--crm-surface-2-rgb) / 1)", border: "1px solid var(--crm-border)", borderRadius: 12, color: "rgb(var(--crm-ink-rgb) / 1)" };

export default function FinancialRevenueComposition({ revenue, scope }) {
  const [view, setView] = useState('won');
  if (!revenue) return <p role="status" className="text-sm text-amber-700 dark:text-amber-300">Composição das receitas indisponível. Sincronize os dados para tentar novamente.</p>;
  const summary = revenue[view];
  const groups = revenue[view === 'won' ? 'wonBySegment' : 'openBySegment'] || [];
  const parts = [
    { name: 'Recorrente · total no prazo', value: summary.recurringTotal, color: REVENUE_COLORS.recurring },
    { name: 'Pontual · produtos e implantação', value: summary.oneTime, color: REVENUE_COLORS.oneTime },
    { name: 'Sem classificação', value: summary.unclassified, color: REVENUE_COLORS.unknown }
  ].filter(item => item.value > 0);
  const won = view === 'won';
  return <section aria-label={`Composição das receitas ${scope}`} className="rounded-2xl border border-[var(--crm-border)] bg-[rgb(var(--crm-surface-2-rgb)_/_0.8)] p-4 md:p-6 space-y-5">
    <div className="flex flex-wrap justify-between items-start gap-4">
      <div>
        <h2 className="text-xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)]">Receita mensal e pontual · {scope}</h2>
        <p className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1">Entenda quanto se repete a cada mês e quanto é cobrado uma única vez.</p>
      </div>
      <div role="group" aria-label="Situação das oportunidades" className="flex gap-2 flex-wrap">
        {[['won', 'Contratos ganhos'], ['open', 'Em negociação']].map(([key, label]) => <button key={key} type="button" aria-pressed={view === key} onClick={() => setView(key)} className={`px-4 py-2 rounded-lg border text-sm font-semibold ${view === key ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-700 dark:text-cyan-300" : "border-[var(--crm-border)] text-[rgb(var(--crm-muted-rgb)_/_1)] hover:text-[rgb(var(--crm-ink-rgb)_/_1)]"}`}>{label}</button>)}
      </div>
    </div>
    <p className="text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">{won ? 'Contratos ganhos' : 'Oportunidades em negociação'}: <strong>{summary.count}</strong> · {won ? 'Valores contratados; não são comprovantes de faturamento ou recebimento.' : 'Valores potenciais; dependem do fechamento das oportunidades.'}</p>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-xl border border-[var(--crm-border)] p-4">
        <p className="text-sm font-semibold" style={{ color: REVENUE_COLORS.recurring }}>Receita recorrente mensal</p>
        <p className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mt-2">{financialCurrency(summary.recurringMonthly)}<span className="text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] font-normal"> / mês</span></p>
        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-2">Soma das mensalidades {won ? 'dos contratos ganhos' : 'em negociação'}. Não é o total do contrato.</p>
      </div>
      <div className="rounded-xl border border-[var(--crm-border)] p-4">
        <p className="text-sm font-semibold" style={{ color: REVENUE_COLORS.oneTime }}>Receita pontual</p>
        <p className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mt-2">{financialCurrency(summary.oneTime)}</p>
        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-2">Produtos, projetos e implantação. Cobranças que não se repetem mensalmente.</p>
      </div>
      <div className="rounded-xl border border-[var(--crm-border)] p-4">
        <p className="text-sm font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{won ? 'Valor total contratado' : 'Valor total em negociação'}</p>
        <p className="text-2xl font-bold text-[rgb(var(--crm-ink-rgb)_/_1)] mt-2">{financialCurrency(summary.total)}</p>
        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-2">Recorrência no prazo: {financialCurrency(summary.recurringTotal)} + pontual{summary.unclassified > 0 ? ' + sem classificação' : ''}.</p>
      </div>
    </div>
    {summary.incompleteCount > 0 && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{summary.incompleteCount} oportunidade(s) mensal(is) com prazo incompleto. Revise o cadastro para conferir a mensalidade e o total do contrato.</p>}
    {summary.unclassifiedCount > 0 && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">{financialCurrency(summary.unclassified)} em {summary.unclassifiedCount} oportunidade(s) sem classificação. Esse valor está no total, separado das receitas mensal e pontual.</p>}
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="min-w-0">
        <h3 className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Mensalidade {won ? 'contratada' : 'potencial'} por segmento</h3>
        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1 mb-4">Somente valores recorrentes, em R$/mês.</p>
        {summary.recurringMonthly > 0 ? <ResponsiveContainer width="100%" height={240}>
          <BarChart data={groups} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey="label" stroke="#94A3B8" />
            <YAxis stroke="#94A3B8" tickFormatter={compact} width={65} />
            <Tooltip contentStyle={tooltip} formatter={value => [`${financialCurrency(value)} / mês`, 'Recorrente mensal']} cursor={{ fill: "rgb(var(--crm-ink-rgb) / 0.03137254901960784)" }} />
            <Bar shape={<Bar3DShape />} activeBar={<Bar3DShape />} dataKey="recurringMonthly" name="Recorrente mensal (R$/mês)" fill={REVENUE_COLORS.recurring} radius={[6, 6, 0, 0]} maxBarSize={100} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer> : <div className="h-60 flex items-center justify-center text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] text-center">Nenhuma mensalidade informada neste recorte.</div>}
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[rgb(var(--crm-ink-rgb)_/_1)]">{groups.map(row => <li key={row.label}><strong>{row.label}:</strong> {financialCurrency(row.recurringMonthly)} / mês</li>)}</ul>
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">Composição do valor total</h3>
        <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] mt-1 mb-4">Aqui a recorrência considera todo o prazo contratado, em R$.</p>
        {summary.total > 0 ? <ResponsiveContainer width="100%" height={220}>
          <PieChart><Pie activeIndex={-1} inactiveShape={<Pie3DShape />} activeShape={<Pie3DShape />} data={parts} dataKey="value" nameKey="name" innerRadius={58} outerRadius={90} paddingAngle={parts.length > 1 ? 3 : 0} stroke="none" isAnimationActive={false}>{parts.map(part => <Cell key={part.name} fill={part.color} />)}</Pie><Tooltip contentStyle={tooltip} formatter={(value, name) => [financialCurrency(value), name]} /></PieChart>
        </ResponsiveContainer> : <div className="h-60 flex items-center justify-center text-sm text-[rgb(var(--crm-muted-rgb)_/_1)] text-center">Nenhum valor informado neste recorte.</div>}
        <ul className="space-y-2 text-sm">{parts.map(part => <li key={part.name} className="flex flex-wrap justify-between gap-2"><span className="flex items-center gap-2 text-[rgb(var(--crm-ink-rgb)_/_1)]"><span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: part.color }} />{part.name}</span><span className="font-semibold text-[rgb(var(--crm-ink-rgb)_/_1)]">{financialCurrency(part.value)} <span className="font-normal text-[rgb(var(--crm-muted-rgb)_/_1)]">({(part.value / summary.total * 100).toFixed(1)}%)</span></span></li>)}</ul>
      </div>
    </div>
    <p className="text-xs text-[rgb(var(--crm-muted-rgb)_/_1)] border-t border-[var(--crm-border)] pt-4">Como ler: R$ 1.000/mês por 12 meses + R$ 500 de implantação = R$ 12.500 no contrato. A mensalidade continua R$ 1.000/mês. Filtros pela data de cadastro; as mensalidades incluem contratos históricos do recorte.</p>
  </section>;
}
