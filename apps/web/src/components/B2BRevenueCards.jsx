import { CalendarDays, Repeat2, Package, CheckCheck, Target } from 'lucide-react';
import './B2BRevenueCards.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function B2BRevenueCards({ revenue = {}, historyLabel, insights, onInspect }) {
  const recurring = Math.max(0, Number(revenue.periodRecurring) || 0);
  const oneTime = Math.max(0, Number(revenue.periodOneTime) || 0);
  const total = recurring + oneTime;
  const recurringShare = total ? recurring / total * 100 : 0;
  const percent = value => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value) + '%';
  const groups = [
    {
      title: 'Vendas ganhas', label: 'Receita projetada', Icon: CheckCheck,
      description: 'Valores dos contratos fechados, conforme a data de fechamento e a vigência.',
      cards: [
        { metric: 'activeMrr', title: 'Receita mensal ativa', tag: 'MRR · hoje', value: revenue.activeMrr, description: 'Mensalidades dos contratos vigentes hoje.', Icon: Repeat2, tone: 'cyan' },
        { metric: 'periodRecurring', title: 'Recorrente no período', tag: 'Acumulado', value: revenue.periodRecurring, description: 'Mensalidades projetadas no período selecionado.', Icon: CalendarDays, tone: 'cyan' },
        { metric: 'periodOneTime', title: 'Pontual no período', tag: 'Venda única', value: revenue.periodOneTime, description: 'Produtos e implantação das vendas ganhas no período.', Icon: Package, tone: 'orange' }
      ]
    },
    {
      title: 'Em negociação', label: 'Potencial da carteira', Icon: Target,
      description: 'Oportunidades em aberto, sujeitas ao fechamento da venda.',
      cards: [
        { metric: 'recurringPipelineMonthly', title: 'Potencial mensal', tag: 'Mensalidades', value: revenue.recurringPipelineMonthly, description: 'Receita mensal prevista se as oportunidades forem ganhas.', Icon: Repeat2, tone: 'cyan' },
        { metric: 'recurringPipelineTotal', title: 'Recorrente total', tag: 'Vigência completa', value: revenue.recurringPipelineTotal, description: 'Mensalidade × duração dos contratos em aberto.', Icon: CalendarDays, tone: 'cyan' },
        { metric: 'oneTimePipeline', title: 'Potencial pontual', tag: 'Venda única', value: revenue.oneTimePipeline, description: 'Produtos e implantação das oportunidades em aberto.', Icon: Package, tone: 'orange' }
      ]
    }
  ];

  return (
    <div className="b2b-revenue">
      <header className="b2b-revenue__heading">
        <div>
          <h2>Receitas recorrentes e pontuais</h2>
          <p>Contratos ganhos e potencial das oportunidades em aberto.</p>
        </div>
        <span className="b2b-revenue__period"><CalendarDays size={14} aria-hidden="true" />{historyLabel}</span>
      </header>
      {groups.map(({ title, label, description, Icon, cards }) => (
        <section className="b2b-revenue__group" key={title} aria-label={title}>
          <header className="b2b-revenue__group-heading" title={description}>
            <div><Icon size={16} aria-hidden="true" /><h3>{title}</h3><span>{label}</span></div>
          </header>
          <div className="b2b-revenue__grid">
            {cards.map(({ metric, title: cardTitle, tag, value, description: detail, Icon: CardIcon, tone }) => (
              <article className={`b2b-revenue__card b2b-revenue__card--${tone}`} key={cardTitle}>
                <div className="b2b-revenue__card-top"><span className="b2b-revenue__icon"><CardIcon size={15} aria-hidden="true" /></span><h4>{cardTitle}</h4></div>
                <button type="button" className="b2b-revenue__inspect" onClick={() => onInspect?.(metric, cardTitle)} aria-label={`Ver composição de ${cardTitle}`}><span className="b2b-revenue__value">{currency.format(Number(value) || 0)}</span><span className="b2b-revenue__inspect-hint">Ver detalhes ↗</span></button>
                {insights?.comparison?.available && insights.comparison.metrics[metric] && <p className="b2b-revenue__change">{insights.comparison.metrics[metric].delta > 0 ? '+' : ''}{currency.format(insights.comparison.metrics[metric].delta)} <span>({insights.comparison.metrics[metric].percent === null ? 'sem base percentual' : `${insights.comparison.metrics[metric].percent > 0 ? '+' : ''}${percent(insights.comparison.metrics[metric].percent)}`})</span></p>}
                <div className="b2b-revenue__card-bottom"><span className="b2b-revenue__tag">{tag}</span><span className="b2b-revenue__help" tabIndex={0} aria-label={detail} title={detail}>i</span></div>
              </article>
            ))}
          </div>
        </section>
      ))}
      <section className="b2b-revenue__composition" aria-label="Composição da receita no período">
        <div className="b2b-revenue__composition-total">
          <h3>Composição da Receita</h3>
          <strong>{currency.format(total)}</strong>
          <span>Total projetado no período · vendas ganhas</span>
        </div>
        <div className="b2b-revenue__mix">
          <div className="b2b-revenue__mix-labels">
            <div><span><i className="b2b-revenue__dot" />Recorrente</span><strong>{currency.format(recurring)} <small>{percent(recurringShare)}</small></strong></div>
            <div><span><i className="b2b-revenue__dot b2b-revenue__dot--orange" />Pontual + setup</span><strong>{currency.format(oneTime)} <small>{percent(total ? 100 - recurringShare : 0)}</small></strong></div>
          </div>
          <div className="b2b-revenue__mix-bar" role="img" aria-label={total ? `Receita recorrente: ${percent(recurringShare)}. Receita pontual: ${percent(100 - recurringShare)}.` : 'Sem receita projetada no período.'}>
            <span style={{ width: `${recurringShare}%` }} /><span style={{ width: `${total ? 100 - recurringShare : 0}%` }} />
          </div>
        </div>
      </section>
      {insights?.comparison?.available && <p className="b2b-revenue__note">Variações em relação aos {insights.comparison.days} dias anteriores ({insights.comparison.start.split('-').reverse().join('/')} a {insights.comparison.end.split('-').reverse().join('/')}). MRR compara as duas datas de referência.</p>}
      <p className="b2b-revenue__note">Os valores projetados não representam recebimentos.
        {Number(revenue.undatedWins) > 0 && ` ${revenue.undatedWins} venda${Number(revenue.undatedWins) === 1 ? '' : 's'} sem data de fechamento fora da projeção.`}
      </p>
    </div>
  );
}
