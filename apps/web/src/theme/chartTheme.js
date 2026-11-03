import { Chart } from 'chart.js';

// Canvas does not resolve CSS variables. Resolve the shared palette at update
// time, including charts that were already mounted when the theme changed.
const originalColors = new WeakMap();
const colorCache = new Map();

function resolveColor(value, palette) {
  if (Array.isArray(value)) return value.map((color) => resolveColor(color, palette));
  if (typeof value !== 'string') return value;
  if (/^#1f2937$/i.test(value)) return palette.track;
  if (!value.includes('var(--crm-')) return value;
  const key = `${palette.theme}:${value}`;
  if (colorCache.has(key)) return colorCache.get(key);
  const probe = document.createElement('span');
  probe.style.cssText = 'display:none';
  probe.style.color = value;
  document.body.appendChild(probe);
  const resolved = getComputedStyle(probe).color;
  probe.remove();
  colorCache.set(key, resolved);
  return resolved;
}

Chart.register({
  id: 'crmTheme',
  beforeUpdate(chart) {
    const styles = getComputedStyle(document.documentElement);
    const read = (name) => styles.getPropertyValue(`--crm-${name}`).trim();
    const palette = {
      theme: document.documentElement.dataset.theme,
      surface: read('surface'), ink: read('ink'), muted: read('muted'),
      border: read('border'), track: read('chart-track')
    };
    const plugins = chart.options.plugins;
    if (plugins.tooltip) Object.assign(plugins.tooltip, {
      backgroundColor: palette.surface, titleColor: palette.ink,
      bodyColor: palette.muted, borderColor: palette.border
    });
    if (plugins.legend?.labels) plugins.legend.labels.color = palette.muted;
    for (const scale of Object.values(chart.options.scales || {})) {
      if (scale.ticks) scale.ticks.color = palette.muted;
      if (scale.grid) scale.grid.color = palette.border;
    }
    for (const dataset of chart.data.datasets) {
      let colors = originalColors.get(dataset);
      if (!colors) { colors = {}; originalColors.set(dataset, colors); }
      for (const key of ['backgroundColor', 'borderColor', 'pointBackgroundColor', 'pointBorderColor']) {
        const current = dataset[key];
        const previous = colors[key];
        const source = previous && current === previous.resolved ? previous.source : current;
        const resolved = resolveColor(source, palette);
        dataset[key] = resolved;
        colors[key] = { source, resolved };
      }
    }
  }
});

export function updateChartThemes() {
  for (const chart of Object.values(Chart.instances)) chart.update('none');
}
