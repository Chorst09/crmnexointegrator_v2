import { useId, useState } from 'react';
import brazilStates from './brazilStatesGeometry.json';

const shortMoney = value => new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
const currency = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value);
const project = (lng, lat) => [12 + (lng + 74) / 40 * 296, 12 + (6 - lat) / 40 * 296];

/** Sculpted faces and extruded edges keep icons sharp at any display density. */
export function ExecutiveIcon({ kind, icon: Icon, size = 54 }) {
  const id = useId().replace(/:/g, '');
  const shapes = {
    coins: <><ellipse cx="24" cy="15" rx="15" ry="6"/><path d="M9 17v9c0 8 30 8 30 0v-9c-6 7-24 7-30 0Z"/><path d="M9 30v9c0 8 30 8 30 0v-9c-6 7-24 7-30 0Z"/><path d="M9 43v7c0 6 21 9 30 3v-9c-9 5-24 4-30-1Z"/><ellipse cx="47" cy="36" rx="12" ry="5"/><path d="M35 38v8c0 7 24 7 24 0v-8c-5 5-19 5-24 0Zm0 12v6c0 7 24 7 24 0v-6c-5 5-19 5-24 0Z"/></>,
    trophy: <><path d="M20 9h24v17c0 12-7 18-12 18S20 38 20 26Z"/><path d="M17 13H8v11c0 10 8 15 15 15v-7c-7-1-9-5-9-10v-3h3Zm30 0h9v11c0 10-8 15-15 15v-7c7-1 9-5 9-10v-3h-3Z"/><path d="M28 42h8v11h12v6H16v-6h12Z"/></>,
    building: <><path d="m5 19 27-15 27 15v6H5Z"/><circle cx="32" cy="16" r="3" fill="#d8ffff"/><path d="M10 29h7v22h-7Zm13 0h7v22h-7Zm13 0h7v22h-7Zm13 0h7v22h-7ZM6 54h52v6H6Z"/></>,
    briefcase: <><path d="M23 9h18l5 7v6h-6v-6H24v6h-6v-6Z"/><path d="M6 23h52v15c-12 7-40 7-52 0Z"/><path d="M6 41c12 6 40 6 52 0v15H6Z"/><rect x="27" y="35" width="10" height="12" rx="2" fill="#b8f8ff"/></>,
    rocket: <><path d="M21 28C29 12 42 6 57 6c0 18-8 31-23 39Z"/><circle cx="42" cy="22" r="6" fill="#dafbff"/><path d="m22 27-12 3-5 14 16-2Zm14 15-2 15 15-6 2-13Z"/><path d="M19 43 7 58l18-9Z" fill="#efffff"/></>,
    layers: <><path d="m32 7 27 13-27 13L5 20Z"/><path d="m5 29 27 13 27-13v9L32 51 5 38Z"/><path d="m5 43 27 13 27-13v9L32 64 5 52Z"/></>
  };
  const graphic = shapes[kind] || <Icon x="7" y="7" width="50" height="50" strokeWidth="2.6" fill="currentColor" fillOpacity=".16" />;
  return <svg className="nex-sculpted-icon" width={size} height={size} viewBox="0 0 68 72" aria-hidden="true">
    <defs><linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#dcffff"/><stop offset=".25" stopColor="currentColor"/><stop offset="1" stopColor="currentColor" stopOpacity=".65"/></linearGradient><filter id={`${id}-light`} x="-60%" y="-60%" width="220%" height="240%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/><feFlood floodColor="currentColor" floodOpacity=".45"/><feComposite in2="SourceAlpha" operator="in"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g transform="translate(2 6)" fill="currentColor" stroke="currentColor" opacity=".25">{graphic}</g>
    <g transform="translate(1 1)" fill={`url(#${id}-face)`} stroke="currentColor" strokeWidth=".45" filter={`url(#${id}-light)`}>{graphic}</g>
  </svg>;
}

export function ExecutiveRevenueChart({ labels, won, potential }) {
  const id = useId().replace(/:/g, '');
  const [showPotential, setShowPotential] = useState(false);
  const [active, setActive] = useState(null);
  const highestValue = Math.max(1, ...won, ...(showPotential ? potential : []));
  const magnitude = 10 ** Math.floor(Math.log10(highestValue / 5));
  const tickStep = [1, 2, 2.5, 5, 10].find(step => step * magnitude >= highestValue / 5) * magnitude;
  const tickCount = Math.ceil(highestValue / tickStep);
  const max = tickCount * tickStep;
  const left = 56, top = 23, width = 420, height = 205, bottom = top + height;
  const step = width / Math.max(1, labels.length);
  const x = index => left + step * (index + .5);
  const y = value => bottom - value / max * height;
  const line = won.map((value, index) => `${x(index)},${y(value) - 12}`).join(' ');
  const selectedIndex = active ?? won.findLastIndex(value => value > 0);
  return <div className="nex-revenue-visual"><svg viewBox="0 0 500 285" role="img" aria-label={`Evolução da receita em ${labels.length} meses. ${won.map((value, i) => `${labels[i]}: ${currency(value)}`).join('; ')}`}>
    <defs><linearGradient id={`${id}-front`} x1="0" x2="1"><stop stopColor="#0077ed"/><stop offset=".55" stopColor="#00beff"/><stop offset="1" stopColor="#0070de"/></linearGradient><linearGradient id={`${id}-side`}><stop stopColor="#0057b8"/><stop offset="1" stopColor="#002f72"/></linearGradient><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#00baff" stopOpacity=".22"/><stop offset="1" stopColor="#00baff" stopOpacity="0"/></linearGradient><filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter></defs>
    {Array.from({length:tickCount + 1}, (_, index) => index).map(index => { const value = tickStep * index; return <g key={index}><path d={`M${left} ${y(value)}H${left + width + 9}`} stroke="#174568" strokeOpacity=".6"/><text x={left - 10} y={y(value) + 4} textAnchor="end" className="nex-axis-label">{shortMoney(value)}</text></g>; })}
    {labels.map((label, index) => <g key={index}><path d={`M${x(index)} ${top}V${bottom}`} stroke="#153654" strokeOpacity=".5"/><text x={x(index)} y={bottom + 23} textAnchor="middle" className="nex-axis-label">{String(label).replace(/[./]\d{2,4}$/, '')}</text></g>)}
    <path d={`M${x(0)} ${bottom}L${line.replaceAll(' ', 'L')}L${x(won.length - 1)} ${bottom}Z`} fill={`url(#${id}-area)`}/>
    {won.map((value, index) => {const barWidth = Math.min(23, step * .55), barX = x(index) - barWidth / 2, barY = y(value), depth = 6; return <g key={index} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)}><title>{`${labels[index]} · Receita contratada: ${currency(value)}`}</title><rect x={barX - 3} y={top} width={barWidth + depth + 6} height={height + 8} fill="transparent"/>{value > 0 && <><path d={`M${barX} ${barY}h${barWidth}v${bottom - barY}h-${barWidth}Z`} fill={`url(#${id}-front)`} stroke="#00d0ff" strokeWidth=".6"/><path d={`M${barX + barWidth} ${barY}l${depth} -4V${bottom - 4}l-${depth} 4Z`} fill={`url(#${id}-side)`} stroke="#087abc" strokeWidth=".5"/><path d={`M${barX} ${barY}l${depth} -4h${barWidth}l-${depth} 4Z`} fill="#64ecff" stroke="#b4f9ff" strokeWidth=".5"/></>}</g>;})}
    <polyline points={line} fill="none" stroke="#00caff" strokeWidth="6" opacity=".8" filter={`url(#${id}-glow)`}/><polyline points={line} fill="none" stroke="#30dfff" strokeWidth="2"/>
    {won.map((value, index) => value > 0 && <g key={index}><circle cx={x(index)} cy={y(value) - 12} r="6" fill="#00caff" filter={`url(#${id}-glow)`}/><circle cx={x(index)} cy={y(value) - 12} r="3.2" fill="#e0ffff"/></g>)}
    {showPotential && <polyline points={potential.map((value, index) => `${x(index)},${y(value)}`).join(' ')} fill="none" stroke="#9aa8ff" strokeDasharray="5 4" strokeWidth="1.5"/>}
    {selectedIndex >= 0 && <g transform={`translate(${Math.min(412, Math.max(58, x(selectedIndex) - 44))} ${Math.max(2, y(won[selectedIndex]) - 46)})`}><rect width="83" height="25" rx="6" fill="#071932" stroke="#266c9f"/><text x="41.5" y="17" textAnchor="middle" className="nex-chart-value">R$ {shortMoney(won[selectedIndex])}</text></g>}
  </svg><div className="nex-chart-legend"><span><i/>Receita contratada</span><button aria-pressed={showPotential} onClick={() => setShowPotential(value => !value)}><i className="nex-projected-key"/>{showPotential ? 'Ocultar potencial' : 'Exibir potencial'}</button></div></div>;
}

export function ExecutiveFunnel({ stages, mode, formatMoney, formatNumber }) {
  const id = useId().replace(/:/g, '');
  const total = stages.reduce((sum, item) => sum + item.count, 0);
  const colors = [['#00cfff','#007bff','#0035b8'],['#00baff','#0065eb','#002891'],['#00e0bd','#009b94','#004c55'],['#24ed8a','#00a965','#00552e'],['#ffd327','#f29100','#8f3600'],['#ff9f21','#f35300','#a62a00']];
  return <svg className="nex-funnel-3d" viewBox={`0 0 290 ${stages.length * 48 + 10}`} role="img" aria-label="Funil comercial B2B por estágio">
    <defs>{stages.map((stage, index) => <linearGradient id={`${id}-${index}`} key={stage.key}><stop stopColor={colors[index % colors.length][2]}/><stop offset=".3" stopColor={colors[index % colors.length][1]}/><stop offset=".55" stopColor={colors[index % colors.length][0]}/><stop offset="1" stopColor={colors[index % colors.length][2]}/></linearGradient>)}<radialGradient id={`${id}-floor`}><stop stopColor="#ff6a00" stopOpacity=".65"/><stop offset="1" stopColor="#ff6a00" stopOpacity="0"/></radialGradient></defs>
    <ellipse cx="145" cy={stages.length * 48 + 1} rx="78" ry="9" fill={`url(#${id}-floor)`}/>
    {stages.map((item, index) => {const y = 12 + index * 47, half = 137 - index * 14, lower = half - 13, color = colors[index % colors.length];return <g key={item.key}><title>{`${item.label}: ${formatNumber(item.count)} · ${formatMoney(item.total)}`}</title><path d={`M${145-half} ${y}Q145 ${y+15} ${145+half} ${y}L${145+lower} ${y+38}Q145 ${y+51} ${145-lower} ${y+38}Z`} fill={`url(#${id}-${index})`} stroke={color[0]} strokeWidth="1.2"/><ellipse cx="145" cy={y} rx={half} ry="9" fill={color[1]} stroke={color[0]} strokeWidth="1.7"/><path d={`M${145-half+4} ${y+2}Q145 ${y+16} ${145+half-4} ${y+2}`} fill="none" stroke="#c2ffff" strokeOpacity=".6" strokeWidth="1"/><text x="145" y={y+23} textAnchor="middle" className="nex-funnel-label">{item.label}</text><text x="145" y={y+37} textAnchor="middle" className="nex-funnel-label nex-funnel-value">{mode === 'value' ? formatMoney(item.total) : `${formatNumber(item.count)} (${total ? Math.round(item.count / total * 100) : 0}%)`}</text></g>;})}
  </svg>;
}

export function getOpportunityLocations(records, companies = []) {
  const byId = new Map(companies.map(company => [String(company.id), company]));
  return records.flatMap(item => {
    const company = item.company || byId.get(String(item.companyId)) || {};
    const rawLat = item.latitude ?? company.latitude, rawLng = item.longitude ?? company.longitude;
    if (rawLat != null && rawLat !== '' && rawLng != null && rawLng !== '') {
      const lat = Number(rawLat), lng = Number(rawLng);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -34 && lat <= 6 && lng >= -74 && lng <= -34) return [{item, lat, lng, approximate:false}];
    }
    let address = company.address || item.address || {};
    if (typeof address === 'string') {try {address = JSON.parse(address);} catch {address = {};}}
    const normalizeState = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    const stateName = normalizeState(item.state || item.uf || company.state || company.uf || address.state || address.uf || '').trim();
    const state = brazilStates.find(state => state.uf === stateName || normalizeState(state.name) === stateName);
    return state ? [{item, lng:state.center[0], lat:state.center[1], approximate:true, state:state.uf}] : [];
  });
}

export function ExecutiveBrazilMap({ locations, category }) {
  const id = useId().replace(/:/g, '');
  const color = category === 'B2G' ? '#ffb400' : category === 'PRE' ? '#00ee80' : '#00ccff';
  const grouped = new Map();
  locations.forEach(point => {const key = `${point.lng.toFixed(2)},${point.lat.toFixed(2)}`; if (!grouped.has(key)) grouped.set(key,{...point,count:0}); grouped.get(key).count += 1;});
  return <svg className="nex-map" viewBox="0 0 320 330" role="img" aria-label="Mapa do Brasil com limites estaduais e oportunidades por coordenadas ou estado cadastrado"><defs><radialGradient id={`${id}-land`}><stop stopColor="#086295"/><stop offset=".7" stopColor="#033c66"/><stop offset="1" stopColor="#031e3e"/></radialGradient><filter id={`${id}-glow`} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="4"/></filter></defs><g transform="translate(0 3)" opacity=".4">{brazilStates.map(state => <path key={state.uf} d={state.path} fill="#0072ab" stroke="#0099df" strokeWidth="1.2"/>)}</g>{brazilStates.map(state => <path key={state.uf} d={state.path} fill={`url(#${id}-land)`} stroke="#1398d4" strokeWidth=".8"><title>{state.name}</title></path>)}{Array.from(grouped.values()).map((point, index) => {const [x,y] = project(point.lng,point.lat);return <g key={index}><title>{`${point.state ? `${point.state} · ` : ''}${point.count} oportunidade(s)${point.approximate ? ' · localização aproximada pelo estado' : ''}`}</title><circle cx={x} cy={y} r="11" fill={color} filter={`url(#${id}-glow)`}/><circle cx={x} cy={y} r="4.3" fill={color}/><circle cx={x} cy={y} r="1.8" fill="#fff"/></g>;})}</svg>;
}

export function ExecutivePlatform() {
  return <svg className="nex-platform" viewBox="0 0 240 170" aria-hidden="true"><defs><linearGradient id="nex-platform-top"><stop stopColor="#006eff"/><stop offset=".5" stopColor="#20ddff"/><stop offset="1" stopColor="#0051c4"/></linearGradient><linearGradient id="nex-platform-side" x2="0" y2="1"><stop stopColor="#0061c9"/><stop offset="1" stopColor="#001747"/></linearGradient><filter id="nex-platform-glow"><feGaussianBlur stdDeviation="5"/></filter></defs><ellipse cx="120" cy="139" rx="104" ry="18" fill="#00aaff" opacity=".3" filter="url(#nex-platform-glow)"/>{[0,1,2,3].map(i => {const y=110-i*24, half=105-i*18;return <g key={i}><path d={`M${120-half} ${y}l${half} 29 ${half} -29v12l-${half} 29 -${half} -29Z`} fill="url(#nex-platform-side)" stroke="#009fff"/><path d={`M${120-half} ${y}l${half} -28 ${half} 28 -${half} 29Z`} fill="url(#nex-platform-top)" stroke="#60eaff" strokeWidth="1.3"/></g>})}<path d="M110 38h20m-10-5v10" stroke="#baffff" strokeWidth="3"/></svg>;
}

export function ExecutiveMiniBars({ values = [], label = 'Evolução mensal', color = '#00caff' }) {
  const id = useId().replace(/:/g, '');
  const safe = values.map(value => Math.max(0, Number(value) || 0));
  const max = Math.max(1, ...safe);
  const width = 180 / Math.max(1, safe.length);
  return <svg viewBox="0 0 200 100" role="img" aria-label={`${label}: ${safe.join(', ')}`} className="nex-mini-bars"><defs><linearGradient id={`${id}-bar`} x2="1"><stop stopColor="#0070c7"/><stop offset=".6" stopColor={color}/><stop offset="1" stopColor="#0065ab"/></linearGradient></defs>{[20,45,70,95].map(y => <path key={y} d={`M5 ${y}H195`} stroke="#11426b" strokeOpacity=".45"/>)}{safe.map((value,index) => {const h=value/max*77, x=9+index*width, y=95-h, w=width*.6;return <g key={index}><title>{`${label} · ${index+1}: ${value}`}</title>{value > 0 && <><rect x={x} y={y} width={w} height={h} fill={`url(#${id}-bar)`}/><path d={`M${x} ${y}l3 -3h${w}l-3 3Z`} fill="#8ff2ff"/><path d={`M${x+w} ${y}l3 -3v${h}l-3 3Z`} fill="#0066ab"/></>}</g>;})}</svg>;
}

export function ExecutiveSparkline({ values = [], label = 'Evolução', color = '#ab7bff' }) {
  const id = useId().replace(/:/g, '');
  const safe = values.map(value => Math.max(0,Number(value)||0));
  const max = Math.max(1,...safe);
  const points = safe.map((value,index) => `${10+index/Math.max(1,safe.length-1)*260},${92-value/max*73}`).join(' ');
  return <svg className="nex-mini-sparkline" viewBox="0 0 280 110" role="img" aria-label={`${label}: ${safe.join(', ')}`}><defs><linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} stopOpacity=".45"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient><filter id={`${id}-glow`} x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.5"/></filter></defs>{[25,55,85].map(y => <path key={y} d={`M8 ${y}H272`} stroke="#19426a" strokeOpacity=".4"/>)}{safe.length > 0 && <><path d={`M10 98L${points.replaceAll(' ','L')}L270 98Z`} fill={`url(#${id}-area)`}/><polyline points={points} fill="none" stroke={color} strokeWidth="1.8"/>{safe.map((value,index) => {const x=10+index/Math.max(1,safe.length-1)*260,y=92-value/max*73;return <g key={index}><circle cx={x} cy={y} r="5" fill={color} filter={`url(#${id}-glow)`}/><circle cx={x} cy={y} r="2.4" fill="#e8e3ff" stroke={color}/></g>;})}</>}</svg>;
}

export function ExecutiveDonut({ values = [], labels = [], colors = ['#ffb400','#008fff','#00d8ef'], label = 'Composição' }) {
  const id=useId().replace(/:/g,'');
  const safe=values.map(value=>Math.max(0,Number(value)||0));
  const total=safe.reduce((sum,value)=>sum+value,0);
  const point=(angle,rx,ry)=>[120+Math.cos(angle)*rx,57+Math.sin(angle)*ry];
  let angle=-Math.PI/2;
  const parts=safe.map((value,index)=>{const start=angle; angle+=total ? value/total*Math.PI*2 : 0; const end=angle-.015; return {value,index,start,end};}).filter(part=>part.value>0);
  const path=({start,end})=>{const a=point(start,90,42),b=point(end,90,42),c=point(end,43,20),d=point(start,43,20),large=end-start>Math.PI?1:0; return `M${a}A90 42 0 ${large} 1 ${b}L${c}A43 20 0 ${large} 0 ${d}Z`;};
  return <svg className="nex-mini-donut" viewBox="0 0 240 125" role="img" aria-label={`${label}: ${safe.map((value,index)=>`${labels[index] || index+1}: ${value}`).join('; ')}`}><defs>{parts.map(part=><linearGradient key={part.index} id={`${id}-${part.index}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#ffffff" stopOpacity=".3"/><stop offset=".5" stopColor={colors[part.index%colors.length]}/><stop offset="1" stopColor={colors[part.index%colors.length]} stopOpacity=".65"/></linearGradient>)}</defs><ellipse cx="120" cy="80" rx="96" ry="29" fill="#00122b"/>{total === 0 ? <ellipse cx="120" cy="60" rx="78" ry="35" fill="none" stroke="#164367" strokeWidth="22"/> : <>{parts.map(part=><path key={part.index} d={path(part)} transform="translate(0 13)" fill={colors[part.index%colors.length]} style={{filter:'brightness(.45)'}}/>)}{parts.map(part=><g key={part.index}><title>{`${labels[part.index] || 'Parcela'}: ${part.value}`}</title><path d={path(part)} fill={colors[part.index%colors.length]} stroke="#78dcff55" strokeWidth=".7"/><path d={path(part)} fill={`url(#${id}-${part.index})`} opacity=".5"/></g>)}</>}</svg>;
}
