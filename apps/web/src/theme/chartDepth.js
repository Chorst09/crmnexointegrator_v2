import { Chart } from 'chart.js';
import { toPadding } from 'chart.js/helpers';
import { barPrism, shade, PIE_TILT, projectY } from './chart3dGeometry.mjs';

const arcMethods = new WeakMap();
const arcTilt = arc => arc.outerRadius < 48 ? 1 : PIE_TILT;
const arcDepth = arc => Math.min(18, Math.max(3, arc.outerRadius * 0.13));

function polygon(ctx, points, fill) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawBar(ctx, bar) {
  if (bar.skip || !Number.isFinite(bar.x + bar.y + bar.base)) return;
  const x = bar.horizontal ? Math.min(bar.x, bar.base) : bar.x - bar.width / 2;
  const y = bar.horizontal ? bar.y - bar.height / 2 : Math.min(bar.y, bar.base);
  const w = bar.horizontal ? Math.abs(bar.x - bar.base) : bar.width;
  const h = bar.horizontal ? bar.height : Math.abs(bar.y - bar.base);
  if (w < 0.1 || h < 0.1) return;
  const prism = barPrism(x, y, w, h);
  const fill = bar.options.backgroundColor;
  const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
  gradient.addColorStop(0, shade(fill, 0.12));
  gradient.addColorStop(1, shade(fill, -0.12));
  ctx.fillStyle = gradient;
  ctx.fillRect(prism.left, prism.top, prism.width, prism.height);
  polygon(ctx, prism.side, shade(fill, -0.33));
  polygon(ctx, prism.cap, shade(fill, 0.28));
}

function drawArc(ctx, arc, depth, fill, borderWidth = 0) {
  const original = arc.options;
  const tilt = arcTilt(arc);
  ctx.save();
  ctx.translate(0, arc.y * (1 - tilt) + depth);
  ctx.scale(1, tilt);
  arc.options = { ...original, backgroundColor: fill, borderWidth, borderColor: 'rgba(255,255,255,0.25)' };
  try { arc.draw(ctx); } finally { arc.options = original; ctx.restore(); }
}

// Keep native hit testing and tooltip positions aligned with the projected pie.
// The original elements/data remain available for legend toggles and callbacks.
function projectArcInteraction(arc, chart) {
  if (arcMethods.has(arc)) return;
  const original = { inRange: arc.inRange, getCenterPoint: arc.getCenterPoint };
  arcMethods.set(arc, original);
  arc.inRange = function(x, y, final) {
    if (chart.options.plugins.crmDepth === false) return original.inRange.call(this, x, y, final);
    const center = this.getProps(['y'], final).y;
    const unproject = value => center + (value - center) / arcTilt(this);
    return original.inRange.call(this, x, unproject(y), final)
      || original.inRange.call(this, x, unproject(y - arcDepth(this)), final);
  };
  arc.getCenterPoint = function(final) {
    const point = original.getCenterPoint.call(this, final);
    if (chart.options.plugins.crmDepth === false) return point;
    return { x: point.x, y: projectY(point.y, this.getProps(['y'], final).y, arcTilt(this)) };
  };
}

export const chartDepthPlugin = {
  id: 'crmDepth',
  beforeInit(chart) {
    const padding = toPadding(chart.options.layout.padding);
    chart.options.layout.padding = {
      top: padding.top + 10, right: padding.right + 8,
      bottom: padding.bottom + 8, left: padding.left
    };
  },
  afterDatasetsUpdate(chart) {
    chart.getSortedVisibleDatasetMetas().forEach(meta => {
      if (['pie', 'doughnut', 'polarArea'].includes(meta.type)) {
        meta.data.forEach(arc => projectArcInteraction(arc, chart));
      }
    });
  },
  beforeDatasetDraw(chart, { meta }) {
    const { ctx } = chart;
    if (meta.type === 'bar') {
      ctx.save();
      try { meta.data.forEach(bar => drawBar(ctx, bar)); } finally { ctx.restore(); }
      return false;
    }
    if (['pie', 'doughnut', 'polarArea'].includes(meta.type)) {
      const arcs = meta.data.filter((arc, index) => chart.getDataVisibility(index) && !arc.hidden && arc.circumference !== 0);
      // Draw every side before every top so adjacent slices never cover a top.
      for (let layer = 18; layer >= 1; layer -= 1) {
        arcs.forEach(arc => {
          if (layer <= arcDepth(arc)) drawArc(ctx, arc, layer, shade(arc.options.backgroundColor, -0.34));
        });
      }
      arcs.forEach(arc => {
        const gradient = ctx.createLinearGradient(arc.x, arc.y - arc.outerRadius, arc.x, arc.y + arc.outerRadius);
        gradient.addColorStop(0, shade(arc.options.backgroundColor, 0.19));
        gradient.addColorStop(1, shade(arc.options.backgroundColor, -0.05));
        drawArc(ctx, arc, 0, gradient, 1);
      });
      return false;
    }
    if (['line', 'radar'].includes(meta.type) && meta.dataset) {
      ctx.save();
      ctx.translate(3, 5);
      ctx.globalAlpha = 0.18;
      meta.dataset.draw(ctx, chart.chartArea);
      ctx.restore();
    }
  }
};

Chart.register(chartDepthPlugin);
