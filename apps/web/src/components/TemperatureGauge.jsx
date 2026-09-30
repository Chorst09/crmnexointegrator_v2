export default function TemperatureGauge({ value = 0, size = 160 }) {
  const clamped = Math.min(Math.max(Number(value), 0), 100);
  const cx = size / 2;
  const cy = size / 2;
  const innerR = size * 0.3;
  const outerR = size * 0.44;
  const midR = (innerR + outerR) / 2;
  const bandWidth = outerR - innerR;

  const needleAngle = ((clamped - 50) / 50) * 90;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLen = midR * 0.82;
  const nx = cx + needleLen * Math.sin(needleRad);
  const ny = cy - needleLen * Math.cos(needleRad);

  const segments = 100;
  const segmentAngle = 180 / segments;

  function segPath(i, r1, r2) {
    const a1 = ((-90 + (i / segments) * 180) * Math.PI) / 180;
    const a2 = ((-90 + ((i + 1) / segments) * 180) * Math.PI) / 180;
    const x1 = cx + r1 * Math.cos(a1);
    const y1 = cy + r1 * Math.sin(a1);
    const x2 = cx + r2 * Math.cos(a1);
    const y2 = cy + r2 * Math.sin(a1);
    const x3 = cx + r2 * Math.cos(a2);
    const y3 = cy + r2 * Math.sin(a2);
    const x4 = cx + r1 * Math.cos(a2);
    const y4 = cy + r1 * Math.sin(a2);
    return `M ${x1} ${y1} L ${x2} ${y2} A ${r2} ${r2} 0 0 1 ${x3} ${y3} L ${x4} ${y4} A ${r1} ${r1} 0 0 0 ${x1} ${y1} Z`;
  }

  function tickPath(angleDeg, len) {
    const a = ((-90 + angleDeg) * Math.PI) / 180;
    const r1 = outerR + 4;
    const r2 = r1 + len;
    return {
      x1: cx + r1 * Math.cos(a),
      y1: cy + r1 * Math.sin(a),
      x2: cx + r2 * Math.cos(a),
      y2: cy + r2 * Math.sin(a)
    };
  }

  function labelPos(angleDeg) {
    const a = ((-90 + angleDeg) * Math.PI) / 180;
    const r = outerR + 20;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  return (
    <svg width={size + 40} height={size * 0.58 + 20} viewBox={`0 0 ${size + 40} ${size * 0.58 + 20}`}>
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="20%" stopColor="#22d3ee" />
          <stop offset="45%" stopColor="#22c55e" />
          <stop offset="65%" stopColor="#eab308" />
          <stop offset="85%" stopColor="#f97316" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>

        <filter id="needleShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.4)" />
        </filter>

        <filter id="gaugeGlow">
          <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(59,130,246,0.2)" />
        </filter>
      </defs>

      <g transform={`translate(20, 5)`}>
        <circle cx={cx} cy={cy} r={outerR + 2} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
        <circle cx={cx} cy={cy} r={innerR - 1} fill="rgba(11,34,67,0.5)" />

        {Array.from({ length: segments }, (_, i) => {
          const ratio = i / segments;
          const opacity = i < clamped * (segments / 100) ? 1 : 0.08;
          return (
            <path
              key={i}
              d={segPath(i, innerR, outerR)}
              fill={`hsla(${(1 - ratio) * 200}, 78%, ${45 + ratio * 20}%, ${opacity})`}
            />
          );
        })}

        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((v) => {
          const angle = (v / 100) * 180;
          const major = v % 20 === 0;
          const t = tickPath(angle, major ? 6 : 3);
          const lbl = labelPos(angle);
          return (
            <g key={v}>
              <line
                x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                stroke={major ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}
                strokeWidth={major ? 1.5 : 0.8}
              />
              {major && (
                <text
                  x={lbl.x} y={lbl.y}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="rgba(255,255,255,0.35)" fontSize={8}
                >
                  {v}%
                </text>
              )}
            </g>
          );
        })}

        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />

        <line
          x1={cx} y1={cy} x2={nx} y2={ny}
          stroke={`hsl(${(1 - clamped / 100) * 200}, 80%, 55%)`}
          strokeWidth={2.5}
          strokeLinecap="round"
          filter="url(#needleShadow)"
        />

        <circle cx={cx} cy={cy} r={5} fill="#e2e8f0" filter="url(#needleShadow)" />
        <circle cx={cx} cy={cy} r={3} fill={`hsl(${(1 - clamped / 100) * 200}, 80%, 55%)`} />

        <text
          x={cx} y={size * 0.5 + 2}
          textAnchor="middle"
          fill="#d9edff"
          fontSize={19}
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          {clamped.toFixed(1)}%
        </text>
      </g>
    </svg>
  );
}
