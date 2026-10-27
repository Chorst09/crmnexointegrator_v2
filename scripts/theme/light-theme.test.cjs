const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const postcss = require('postcss');
const root = path.resolve(__dirname, '../..');

test('all theme CSS rules require light mode, including print and interaction states', () => {
  for (const name of ['light-theme.css', 'light-utilities.css']) {
    const css = postcss.parse(fs.readFileSync(path.join(root, 'apps/web/src/styles', name), 'utf8'));
    let count = 0;
    css.walkRules(rule => {
      assert.ok(rule.selector.startsWith('html:not(.dark)'), `${name}: ${rule.selector}`);
      count++;
    });
    assert.ok(count > 20);
  }
});

function chartFixture(dark = false) {
  const source = fs.readFileSync(path.join(root, 'apps/web/src/theme/chartTheme.js'), 'utf8')
    .replace("import { Chart } from 'chart.js';", '')
    .replace('export const lightChartTheme', 'const lightChartTheme');
  const state = { dark, plugins: [], updates: [] };
  const context = {
    Chart: { register(plugin) { state.plugins.push(plugin); }, instances: {} },
    document: { documentElement: { classList: { contains() { return state.dark; } } } },
    MutationObserver: class { constructor(callback) { state.notify = callback; } observe() {} },
  };
  vm.runInNewContext(source, context);
  return { state, plugin: state.plugins[0], Chart: context.Chart };
}

test('canvas labels adapt in light mode and recover exact original values in dark mode', () => {
  const { state, plugin } = chartFixture(true);
  const options = { color: '#eeeeee', scales: { x: { ticks: { color: '#bcd4ee' }, grid: { color: '#222222' } } }, plugins: { legend: { labels: { color: '#ffffff' } }, tooltip: { backgroundColor: '#111111' } } };
  const original = JSON.parse(JSON.stringify(options));
  const chart = { config: { options } };
  plugin.beforeUpdate(chart);
  assert.deepEqual(options, original, 'dark initial render must not change');
  state.dark = false;
  plugin.beforeUpdate(chart);
  assert.equal(options.scales.x.ticks.color, '#475569');
  assert.equal(options.plugins.tooltip.backgroundColor, '#ffffff');
  state.dark = true;
  plugin.beforeUpdate(chart);
  // Empty containers may be created for optional scale titles; explicit colors
  // and all existing options must be restored, including inherited defaults.
  assert.equal(options.color, original.color);
  assert.deepEqual(options.scales.x.ticks, original.scales.x.ticks);
  assert.deepEqual(options.scales.x.grid, original.scales.x.grid);
  assert.deepEqual(options.plugins, original.plugins);
  assert.equal(Object.hasOwn(options.scales.x.title, 'color'), false);
});

test('disabled chart legends and tooltips stay disabled through theme changes', () => {
  const { state, plugin } = chartFixture(false);
  const options = { plugins: { legend: false, tooltip: false } };
  plugin.beforeUpdate({ config: { options } });
  assert.equal(options.plugins.legend, false);
  assert.equal(options.plugins.tooltip, false);
  state.dark = true;
  plugin.beforeUpdate({ config: { options } });
  assert.equal(Object.hasOwn(options, 'color'), false);
});

test('theme toggle refreshes mounted charts once and ignores unrelated root class changes', () => {
  const { state, Chart } = chartFixture(true);
  Chart.instances.sample = { update(mode) { state.updates.push(mode); } };
  state.notify();
  assert.equal(state.updates.length, 0);
  state.dark = false;
  state.notify();
  assert.deepEqual(state.updates, ['none']);
  state.notify();
  assert.equal(state.updates.length, 1);
});

test('B2G follows the CRM theme and never forces dark mode when opening a screen', () => {
  const page = fs.readFileSync(path.join(root, 'apps/web/src/pages/BuscarEditais.jsx'), 'utf8');
  const bridge = fs.readFileSync(path.join(root, 'apps/web/src/pages/licitacoes_components/context/ThemeContext.tsx'), 'utf8');
  assert.doesNotMatch(page, /classList\.add\(['"]dark['"]\)/);
  assert.doesNotMatch(page, /licitacoes_app_theme/);
  assert.match(bridge, /export \{ useTheme \} from '\.\.\/\.\.\/\.\.\/theme\/ThemeProvider'/);
});

test('shared page headers and inline simulator surfaces have explicit light backgrounds', () => {
  const header = fs.readFileSync(path.join(root, 'apps/web/src/components/PageHeader.jsx'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'apps/web/src/styles/light-theme.css'), 'utf8');
  const generated = fs.readFileSync(path.join(root, 'apps/web/src/styles/light-utilities.css'), 'utf8');
  assert.match(header, /crm-page-header/);
  assert.match(css, /html:not\(\.dark\) \.crm-page-header\s*\{/);
  for (const token of ['from-[#06111a]', 'via-[#082735]', 'to-[#0b3a46]', 'from-slate-900']) {
    assert.ok(generated.includes(`[class~="${token}"]`), `Missing gradient stop ${token}`);
  }
  for (const file of ['components/Simuladores/dashboard/DashboardView.tsx', 'precificacao/components/dashboard/DashboardView.tsx']) {
    const source = fs.readFileSync(path.join(root, 'apps/web/src', file), 'utf8');
    assert.match(source, /--crm-panel-background, linear-gradient/);
    assert.match(source, /--crm-panel-background, radial-gradient/);
    assert.match(source, /crm-simulator-kpi/);
  }
});
