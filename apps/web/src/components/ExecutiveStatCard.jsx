import React from 'react';
import { BarChart3 } from 'lucide-react';
import './ExecutiveStatCard.css';

const accents = {
  blue:'#55caff',cyan:'#55e4ff',sky:'#55caff',indigo:'#839bff',purple:'#ad91ff',violet:'#ad91ff',
  green:'#65e9a7',emerald:'#65e9a7',teal:'#5be4d2',orange:'#ffb754',amber:'#ffd257',yellow:'#ffd257',
  red:'#ff838d',rose:'#ff838d',pink:'#f798dc',gray:'#a6c9e8',slate:'#a6c9e8'
};

/** Shared executive indicator. No fabricated trends or chart data. */
export default function ExecutiveStatCard({
  title='',value=0,subtitle='',icon:Icon=BarChart3,color='blue',colorTheme,trend,trendValue,
  prefix='',suffix='',format='default',size='default',onClick,valueTitle,className='',children
}) {
  const accent=accents[colorTheme || color] || accents.blue;
  const formatted=typeof value==='number' ? new Intl.NumberFormat('pt-BR',format==='currency' ? {style:'currency',currency:'BRL'} : {}).format(value) : value;
  const richValue=React.isValidElement(formatted);
  const text=richValue ? '' : `${prefix}${formatted ?? ''}${suffix}`;
  const change=typeof trend==='object' && trend ? trend : trendValue!=null ? {direction:trend,value:trendValue} : null;
  const direction=change?.direction==='up'?'up':change?.direction==='down'?'down':'neutral';
  const Tag=onClick?'button':'article';
  const icon=typeof Icon==='string'?<span>{Icon}</span>:React.isValidElement(Icon)?Icon:Icon?<Icon strokeWidth={2.2}/>:<BarChart3/>;
  return <Tag {...(onClick?{type:'button',onClick}:{})} className={`nex-stat-card ${className}`}
    data-stat-density={size} data-value-length={text.length>15?'long':'normal'} style={{'--stat-accent':accent}}>
    <span className="nex-stat-card__icon" aria-hidden="true">{icon}</span>
    <div className="nex-stat-card__body">
      <h3 className="nex-stat-card__title">{title}</h3>
      <div className="nex-stat-card__value" title={valueTitle || text} data-stat-value>{richValue ? <>{prefix}{formatted}{suffix}</> : text}</div>
      {subtitle && <div className="nex-stat-card__subtitle">{subtitle}</div>}
      {change?.value!=null && <div className="nex-stat-card__trend" data-direction={direction}>
        <span aria-hidden="true">{direction==='up'?'▲':direction==='down'?'▼':'•'}</span><span>{change.value}</span>
        {change.label && <span className="nex-stat-card__trend-label">{change.label}</span>}
      </div>}
      {children}
    </div>
  </Tag>;
}
