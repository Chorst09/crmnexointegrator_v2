import { Chart } from 'chart.js';

// Canvas charts cannot inherit CSS text colors. Keep their data colors, and
// adapt only labels, grid lines and tooltips. Restore originals in dark mode.
const originals = new WeakMap();
function themeValue(target, key, value, light) {
  if (!target) return;
  if (!originals.has(target)) originals.set(target, new Map());
  const saved = originals.get(target);
  if (light) {
    if (!saved.has(key)) saved.set(key, { exists: Object.hasOwn(target, key), value: target[key] });
    target[key] = value;
  } else if (saved.has(key)) {
    const previous = saved.get(key);
    if (previous.exists) target[key] = previous.value;
    else delete target[key];
    saved.delete(key);
  }
}

export const lightChartTheme = {
  id: 'crmLightTheme',
  beforeUpdate(chart) {
    const light = !document.documentElement.classList.contains('dark');
    const options = chart.config.options;
    themeValue(options, 'color', '#475569', light);
    for (const scale of Object.values(options.scales || {})) {
      if (light) { scale.ticks ||= {}; scale.grid ||= {}; scale.title ||= {}; }
      themeValue(scale.ticks, 'color', '#475569', light);
      themeValue(scale.grid, 'color', '#e2e8f0', light);
      themeValue(scale.title, 'color', '#334155', light);
      themeValue(scale.pointLabels, 'color', '#475569', light);
      themeValue(scale.angleLines, 'color', '#e2e8f0', light);
    }
    if (light) {
      options.plugins ||= {};
      if (options.plugins.legend !== false) {
        options.plugins.legend ||= {};
        options.plugins.legend.labels ||= {};
      }
      if (options.plugins.tooltip !== false) options.plugins.tooltip ||= {};
    }
    themeValue(options.plugins?.legend?.labels, 'color', '#334155', light);
    themeValue(options.plugins?.title, 'color', '#172033', light);
    themeValue(options.plugins?.subtitle, 'color', '#475569', light);
    themeValue(options.plugins?.datalabels, 'color', '#334155', light);
    const tooltip = options.plugins?.tooltip;
    if (tooltip && typeof tooltip === 'object') {
      for (const [key, value] of Object.entries({ backgroundColor: '#ffffff', titleColor: '#172033', bodyColor: '#334155', borderColor: '#cbd5e1', borderWidth: 1 })) {
        themeValue(tooltip, key, value, light);
      }
    }
  }
};

Chart.register(lightChartTheme);
if (typeof document !== 'undefined') {
  let wasDark = document.documentElement.classList.contains('dark');
  new MutationObserver(() => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark === wasDark) return;
    wasDark = isDark;
    for (const chart of Object.values(Chart.instances)) chart.update('none');
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
}
