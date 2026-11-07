import React, { useId } from 'react';
import { Sector } from 'recharts';
import { barPrism, CHART_3D_PALETTE, shade } from '../../theme/chart3dGeometry.mjs';

const points = vertices => vertices.map(point => point.join(',')).join(' ');

/** Native Recharts shapes retain the library's events, axes and data callbacks. */
export function Bar3DShape({ x = 0, y = 0, width = 0, height = 0, fill = CHART_3D_PALETTE[0], payload, index = 0 }) {
  const id = `bar-${useId().replace(/:/g, '')}`;
  if (!Number.isFinite(x + y + width + height) || Math.abs(width) < 0.1 || Math.abs(height) < 0.1) return null;
  const prism = barPrism(x, y, width, height);
  const base = fill.startsWith('url(') ? payload?.color || CHART_3D_PALETTE[index % CHART_3D_PALETTE.length] : fill;
  return <g className="crm-bar-3d">
    <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor={shade(base, 0.14)} />
      <stop offset="100%" stopColor={shade(base, -0.1)} />
    </linearGradient></defs>
    <rect x={prism.left} y={prism.top} width={prism.width} height={prism.height} fill={fill.startsWith('url(') ? fill : `url(#${id})`} />
    <polygon points={points(prism.side)} fill={shade(base, -0.32)} />
    <polygon points={points(prism.cap)} fill={shade(base, 0.28)} />
  </g>;
}

// Recharts 2 selects inactiveShape only when activeIndex is defined. Consumers
// use -1 (no selected slice), plus the same shape for active and inactive states.
export function Pie3DShape(props) {
  const id = `pie-${useId().replace(/:/g, '')}`;
  const { cx, cy, innerRadius = 0, outerRadius, startAngle, endAngle, fill = CHART_3D_PALETTE[0] } = props;
  if (!Number.isFinite(cx + cy + outerRadius + startAngle + endAngle) || outerRadius <= 0 || startAngle === endAngle) return null;
  const depth = Math.min(16, outerRadius * 0.13);
  const base = fill.startsWith('url(') ? props.payload?.color || CHART_3D_PALETTE[(props.index || 0) % CHART_3D_PALETTE.length] : fill;
  const sector = { cx, cy, innerRadius, outerRadius, startAngle, endAngle, cornerRadius: 0 };
  // Retain the original circular footprint, including label/tooltip anchors.
  // Only exposed walls are drawn: outer front and inner rear of the ring.
  const walls = [];
  const low = Math.min(startAngle, endAngle);
  const high = Math.max(startAngle, endAngle);
  const point = (radius, angle, offset = 0) => {
    const radians = angle * Math.PI / 180;
    return [cx + radius * Math.cos(radians), cy - radius * Math.sin(radians) + offset];
  };
  for (let turn = Math.floor(low / 360) - 1; turn <= Math.ceil(high / 360); turn++) {
    [[outerRadius, 180, 360], [innerRadius, 0, 180]].forEach(([radius, from, to]) => {
      const a = Math.max(low, from + turn * 360);
      const b = Math.min(high, to + turn * 360);
      if (!radius || b <= a) return;
      const steps = Math.max(2, Math.ceil((b - a) / 4));
      const angles = Array.from({ length: steps + 1 }, (_, i) => a + (b - a) * i / steps);
      walls.push([...angles.map(angle => point(radius, angle)), ...angles.reverse().map(angle => point(radius, angle, depth))]);
    });
  }
  return <g className="crm-pie-3d">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stopColor={shade(base, 0.2)} />
      <stop offset="100%" stopColor={shade(base, -0.05)} />
    </linearGradient></defs>
    {walls.map((wall, index) => <polygon key={index} points={points(wall)} fill={shade(base, -0.32)} />)}
    <Sector {...sector} fill={fill.startsWith('url(') ? fill : `url(#${id})`} stroke="rgba(255,255,255,0.24)" strokeWidth={1} />
  </g>;
}
