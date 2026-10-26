import { CalendarDays, Repeat2, Package, CheckCheck, Target } from 'lucide-react';
import './B2BRevenueCards.css';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function B2BRevenueCards({ revenue = {}, historyLabel }) {
  const groups = [
    {
      title: 'Vendas ganhas', label: 'Receita projetada', Icon: CheckCheck,
      description: 'Valores dos contratos fechados, conforme a data de fechamento e a vigência.',
      cards: [
        { title: 'Receita mensal ativa', tag: 'MRR · hoje', value: revenue.activeMrr, description: 'Mensalidades dos contratos vigentes hoje.', Icon: Repeat2, tone: 'cyan' },
        { title: 'Recorrente no período', tag: 'Acumulado', value: revenue.periodRecurring, description: 'Mensalidades projetadas no período selecionado.', Icon: CalendarDays, tone: 'green' },
        { title: 'Pontual no período', tag: 'Venda única', value: revenue.periodOneTime, description: 'Produtos e implantação das vendas ganhas no período.', Icon: Package, tone: 'orange' }
      ]
    },
    {
      title: 'Em negociação', label: 'Potencial da carteira', Icon: Target,
      description: 'Oportunidades em aberto, sujeitas ao fechamento da venda.',
      cards: [
        { title: 'Potencial mensal', tag: 'Mensalidades', value: revenue.recurringPipelineMonthly, description: 'Receita mensal prevista se as oportunidades forem ganhas.', Icon: Repeat2, tone: 'cyan' },
        { title: 'Recorrente total', tag: 'Vigência completa', value: revenue.recurringPipelineTotal, description: 'Mensalidade × duração dos contratos em aberto.', Icon: CalendarDays, tone: 'green' },
        { title: 'Potencial pontual', tag: 'Venda única', value: revenue.oneTimePipeline, description: 'Produtos e implantação das oportunidades em aberto.', Icon: Package, tone: 'orange' }
      ]
    }
  ];

  return (
    <div className="b2b-revenue">
      <header className="b2b-revenue__heading">
        <div>
          <h2>Receitas recorrentes e pontuais</h2>
          <p>Receita projetada dos contratos e potencial das oportunidades em aberto.</p>
        </div>
        <span className="b2b-revenue__period"><CalendarDays size={14} aria-hidden="true" />{historyLabel}</span>
      </header>
      {groups.map(({ title, label, description, Icon, cards }) => (
        <section className="b2b-revenue__group" key={title} aria-label={title}>
          <header className="b2b-revenue__group-heading">
            <div><Icon size={16} aria-hidden="true" /><h3>{title}</h3><span>{label}</span></div>
            <p>{description}</p>
          </header>
          <div className="b2b-revenue__grid">
            {cards.map(({ title: cardTitle, tag, value, description: detail, Icon: CardIcon, tone }) => (
              <article className={`b2b-revenue__card b2b-revenue__card--${tone}`} key={cardTitle}>
                <div className="b2b-revenue__card-top"><span className="b2b-revenue__icon"><CardIcon size={18} aria-hidden="true" /></span><span className="b2b-revenue__tag">{tag}</span></div>
                <h4>{cardTitle}</h4>
                <p className="b2b-revenue__value">{currency.format(Number(value) || 0)}</p>
                <p className="b2b-revenue__detail">{detail}</p>
              </article>
            ))}
          </div>
        </section>
      ))}
      <p className="b2b-revenue__note">Os valores projetados não representam recebimentos.
        {Number(revenue.undatedWins) > 0 && ` ${revenue.undatedWins} venda${Number(revenue.undatedWins) === 1 ? '' : 's'} sem data de fechamento fora da projeção.`}
      </p>
    </div>
  );
}
