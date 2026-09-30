import React from 'react';

const B2B_STAGES = [
  { key: 'LEAD', label: 'Lead', width: 100, height: 43, palette: ['#38bdf8', '#0284c7', '#075985'] },
  { key: 'QUALIFICATION', label: 'Qualificação', width: 88, height: 43, palette: ['#60a5fa', '#2563eb', '#1e3a8a'] },
  { key: 'DIAGNOSIS', label: 'Diagnóstico', width: 76, height: 43, palette: ['#2dd4bf', '#0d9488', '#134e4a'] },
  { key: 'PROPOSAL', label: 'Proposta', width: 64, height: 43, palette: ['#fbbf24', '#f59e0b', '#92400e'] },
  { key: 'NEGOTIATION', label: 'Negociação', width: 52, height: 43, palette: ['#fb923c', '#ea580c', '#9a3412'] },
  { key: 'WON', label: 'Ganhas', width: 42, height: 43, palette: ['#34d399', '#16a34a', '#14532d'] },
  { key: 'LOST', label: 'Perdidas', width: 34, height: 43, palette: ['#94a3b8', '#64748b', '#334155'] }
];

const TEMPERATURE_ACCENTS = {
  '0': { color: '#ef4444', label: '0%' },
  '25': { color: '#fef08a', label: '25%' },
  '50': { color: '#22c55e', label: '50%' },
  '75': { color: '#22d3ee', label: '75%' },
  '100': { color: '#a855f7', label: '100%' }
};

const getStageCount = (data, stage) => {
  const row = data.find((item) => item?.stage === stage.key || item?.key === stage.key);
  return Number(row?._count?.stage ?? row?.count ?? row?.deals ?? 0) || 0;
};

const getStageValue = (data, stage) => {
  const row = data.find((item) => item?.stage === stage.key || item?.key === stage.key);
  return Number(row?._sum?.value ?? row?.value ?? row?.revenue ?? 0) || 0;
};

const SalesFunnel = ({ data = [], selectedTemperature = '' }) => {
  const svgWidth = 620;
  const svgHeight = 340;
  const centerX = svgWidth / 2;
  const maxStageWidth = 510;
  const selectedAccent = TEMPERATURE_ACCENTS[String(selectedTemperature || '')] || null;
  const totalCount = B2B_STAGES.reduce((sum, stage) => sum + getStageCount(data, stage), 0);
  let currentY = 18;
  const layouts = B2B_STAGES.map((stage, index) => {
    const count = getStageCount(data, stage);
    const percent = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    const renderedWidth = (stage.width / 100) * maxStageWidth;
    const bottomWidth = index < B2B_STAGES.length - 1
      ? (B2B_STAGES[index + 1].width / 100) * maxStageWidth + 14
      : renderedWidth * 0.7;
    const layout = { ...stage, y: currentY, renderedWidth, bottomWidth, count, percent, value: getStageValue(data, stage) };
    currentY += stage.height + 2;
    return layout;
  });

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden px-2 py-1">
      {selectedAccent && (
        <div
          className="absolute right-3 top-3 z-10 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] shadow-lg"
          style={{
            borderColor: selectedAccent.color,
            color: selectedAccent.color,
            background: 'rgba(3, 8, 18, 0.78)',
            boxShadow: `0 0 22px ${selectedAccent.color}55`
          }}
        >
          Temp. {selectedAccent.label}
        </div>
      )}
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="h-full w-full max-w-[760px]" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Funil comercial B2B em seis etapas">
        <defs>
          {layouts.map((stage) => (
            <React.Fragment key={stage.key}>
              <linearGradient id={`b2b-front-${stage.key}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={stage.palette[2]} />
                <stop offset="17%" stopColor={stage.palette[1]} />
                <stop offset="50%" stopColor={stage.palette[0]} />
                <stop offset="83%" stopColor={stage.palette[1]} />
                <stop offset="100%" stopColor={stage.palette[2]} />
              </linearGradient>
              <linearGradient id={`b2b-rim-${stage.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={stage.palette[0]} />
                <stop offset="48%" stopColor={stage.palette[1]} />
                <stop offset="100%" stopColor={stage.palette[2]} />
              </linearGradient>
              <linearGradient id={`b2b-depth-${stage.key}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#020713" stopOpacity="0.55" />
              </linearGradient>
            </React.Fragment>
          ))}
          <filter id="b2b-stage-shadow" x="-20%" y="-25%" width="140%" height="175%">
            <feDropShadow dx="0" dy="7" stdDeviation="5" floodColor="#01040c" floodOpacity="0.62" />
          </filter>
          <filter id="b2b-selected-glow" x="-25%" y="-35%" width="150%" height="190%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={selectedAccent?.color || '#22d3ee'} floodOpacity="0.95" />
            <feDropShadow dx="0" dy="0" stdDeviation="12" floodColor={selectedAccent?.color || '#22d3ee'} floodOpacity="0.55" />
          </filter>
        </defs>

        {layouts.map((stage, index) => {
          const topLeft = centerX - stage.renderedWidth / 2;
          const topRight = centerX + stage.renderedWidth / 2;
          const bottomLeft = centerX - stage.bottomWidth / 2;
          const bottomRight = centerX + stage.bottomWidth / 2;
          const topY = stage.y;
          const bottomY = topY + stage.height;
          const textColor = stage.key === 'PROPOSAL' ? '#27303b' : '#ffffff';
          const textStartY = topY + (stage.height / 2) + 1;
          const isTemperatureFiltered = Boolean(selectedAccent);
          const isHighlighted = isTemperatureFiltered && stage.count > 0;
          const isMuted = isTemperatureFiltered && stage.count === 0;
          const stageOpacity = isMuted ? 0.34 : 1;
          const strokeColor = isHighlighted ? selectedAccent.color : stage.palette[2];
          const strokeWidth = isHighlighted ? 2.8 : 1.2;

          return (
            <g key={stage.key} filter={isHighlighted ? 'url(#b2b-selected-glow)' : 'url(#b2b-stage-shadow)'} opacity={stageOpacity}>
              <title>{`${stage.label}: ${stage.count} oportunidade${stage.count === 1 ? '' : 's'} • ${stage.percent}%`}</title>
              <path d={`M ${topLeft + 5} ${topY + 2} C ${topLeft + 10} ${topY + 14}, ${bottomLeft - 3} ${bottomY - 13}, ${bottomLeft} ${bottomY - 5} Q ${centerX} ${bottomY + 7} ${bottomRight} ${bottomY - 5} C ${bottomRight + 3} ${bottomY - 13}, ${topRight - 10} ${topY + 14}, ${topRight - 5} ${topY + 2} Z`} fill={`url(#b2b-front-${stage.key})`} stroke={strokeColor} strokeWidth={strokeWidth} />
              <path d={`M ${bottomLeft} ${bottomY - 8} Q ${centerX} ${bottomY + 8} ${bottomRight} ${bottomY - 8} Q ${centerX} ${bottomY + 15} ${bottomLeft} ${bottomY - 8} Z`} fill={`url(#b2b-depth-${stage.key})`} opacity="0.8" />
              <ellipse cx={centerX} cy={topY + 2} rx={stage.renderedWidth / 2} ry="11" fill={`url(#b2b-rim-${stage.key})`} stroke={isHighlighted ? selectedAccent.color : 'rgba(255,255,255,0.42)'} strokeWidth={isHighlighted ? 2.6 : 1.2} />
              <ellipse cx={centerX} cy={topY + 3} rx={Math.max(stage.renderedWidth / 2 - 10, 24)} ry="6" fill={stage.palette[2]} opacity="0.72" />
              {isHighlighted && (
                <ellipse cx={centerX} cy={topY + 2} rx={stage.renderedWidth / 2 + 7} ry="15" fill="none" stroke={selectedAccent.color} strokeWidth="2" strokeDasharray="8 7" opacity="0.9" />
              )}
              <path d={`M ${topLeft + 16} ${topY - 1} Q ${centerX} ${topY - 8} ${topRight - 16} ${topY - 1}`} fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="2" opacity="0.38" />
              <text x={centerX} y={textStartY} textAnchor="middle" fill={textColor} fontFamily="Arial, Segoe UI, sans-serif" fontSize="15" fontWeight="800" paintOrder="stroke" stroke={textColor === '#ffffff' ? 'rgba(3,8,18,0.34)' : 'transparent'} strokeWidth="1.2">
                <tspan x={centerX}>{stage.label}</tspan>
                <tspan x={centerX} dy="16">{stage.count} • {stage.percent}%</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default SalesFunnel;
