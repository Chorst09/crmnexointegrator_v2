const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const source = esbuild.buildSync({
  entryPoints: [path.resolve(__dirname, '../../apps/web/src/components/ExecutiveVisuals.jsx')],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  jsx: 'automatic',
  external: ['react']
}).outputFiles[0].text;
const compiled = { exports: {} };
new Function('require', 'module', 'exports', source)(require, compiled, compiled.exports);
const { getOpportunityLocations, ExecutiveRevenueChart, ExecutiveFunnel } = compiled.exports;

test('preserves coordinates and resolves registered company states without inventing locations', () => {
  const locations = getOpportunityLocations([
    { id: 1, latitude: -23.55, longitude: -46.63 },
    { id: 2, companyId: 'c1' },
    { id: 3, state: 'Parana' },
    { id: 4, state: 'INVALID' },
    { id: 5, latitude: null, longitude: null }
  ], [{ id: 'c1', address: { state: 'RS' } }]);
  assert.equal(locations.length, 3);
  assert.equal(locations[0].approximate, false);
  assert.equal(locations[0].lat, -23.55);
  assert.equal(locations[1].state, 'RS');
  assert.equal(locations[2].state, 'PR');
});

test('renders empty and populated revenue series without invalid SVG coordinates', () => {
  for (const won of [[0, 0], [400000, 1248750]]) {
    const html = renderToStaticMarkup(React.createElement(ExecutiveRevenueChart, {
      labels: ['Jan', 'Fev'], won, potential: [0, 0]
    }));
    assert.ok(!/NaN|Infinity/.test(html));
    assert.ok(html.includes('Evolução da receita em 2 meses'));
    assert.ok(html.includes('Receita contratada:'));
  }
});

test('map joins partial companies and pre-sales leads to their registered state', () => {
  const locations = getOpportunityLocations([
    { id: 'b2b', company: { id: 'sp', name: 'Partial' } },
    { id: 'pre', leadId: 'pr' },
    { id: 'linked', opportunity: { company: { state: 'RS' } } },
    { id: 'coords', latitude: -23.55, longitude: -46.63, uf: 'SP' }
  ], [{ id: 'sp', state: 'São Paulo' }, { id: 'pr', address: '{"uf":"PR"}' }]);
  assert.deepEqual(locations.map(point => point.state), ['SP', 'PR', 'RS', 'SP']);
  assert.equal(locations[3].approximate, false);
});

test('map identifies states and renders module colors from registered locations', () => {
  const locations = getOpportunityLocations([{ state: 'SP' }, { state: 'PR' }])
    .map((point, index) => ({ ...point, category: index ? 'B2G' : 'B2B' }));
  const html = renderToStaticMarkup(React.createElement(compiled.exports.ExecutiveBrazilMap, { locations, category: 'ALL' }));
  assert.ok(html.includes('SP: 1 registros B2B'));
  assert.ok(html.includes('PR: 1 registros B2G'));
  assert.ok(html.includes('#ffb400'));
  assert.ok(!/NaN|Infinity/.test(html));
});

test('empty funnel remains at zero and includes the final stage', () => {
  const html = renderToStaticMarkup(React.createElement(ExecutiveFunnel, {
    stages: [{ key: 'WON', label: 'Ganhas', count: 0, total: 0 }],
    mode: 'count', formatMoney: String, formatNumber: String
  }));
  assert.ok(html.includes('Ganhas'));
  assert.ok(html.includes('0 (0%)'));
  assert.ok(!/NaN|Infinity/.test(html));
});

test('conversion charts render gradient, real percentages and safe empty states', () => {
  for (const values of [[], [null, 0, null], [4, 7, 6, 9, 14]]) {
    const series = values.map((value, i) => ({ label: `Mês ${i + 1}`, value, won: value || 0, total: 100 }));
    const html = renderToStaticMarkup(React.createElement(compiled.exports.ExecutiveConversionChart, { series }));
    assert.ok(html.includes('linearGradient'));
    assert.ok(!/NaN|Infinity/.test(html));
    if (values.length === 5) {
      assert.ok(html.includes('Mês 5: 14%'));
      assert.ok(html.includes('14 ganhas / 100 oportunidades'));
    }
    if (!values.length) assert.ok(html.includes('Sem dados no período'));
  }
});
