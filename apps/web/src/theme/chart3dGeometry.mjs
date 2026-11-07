import { color } from 'chart.js/helpers';

// Shared by canvas and SVG charts. Explicit status colors always take priority.
export const CHART_3D_PALETTE = ['#00aea5', '#199bb5', '#4285c1', '#6662ad', '#9271bb', '#f5b82e'];

export function shade(value, amount = 0) {
  const parsed = color(value);
  if (!parsed.valid) return value || CHART_3D_PALETTE[0];
  const opaque = parsed.alpha(1);
  return (amount < 0 ? opaque.darken(-amount) : opaque.lighten(amount)).rgbString();
}

export function barPrism(x, y, width, height, depth = 8) {
  const left = Math.min(x, x + width);
  const top = Math.min(y, y + height);
  const w = Math.abs(width);
  const h = Math.abs(height);
  // Tiny/zero values must never turn into a full-height decorative block.
  const d = Math.max(0, Math.min(depth, w * 0.24, h * 0.35));
  return {
    left, top, width: Math.max(0, w - d), height: h, depth: d,
    cap: [[left, top], [left + d, top - d], [left + w, top - d], [left + w - d, top]],
    side: [[left + w - d, top], [left + w, top - d], [left + w, top + h - d], [left + w - d, top + h]]
  };
}

export const PIE_TILT = 0.76;
export const projectY = (y, center, tilt = PIE_TILT) => center + (y - center) * tilt;
