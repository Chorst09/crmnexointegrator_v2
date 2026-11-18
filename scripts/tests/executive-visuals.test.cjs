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

test('empty funnel remains at zero and includes the final stage', () => {
  const html = renderToStaticMarkup(React.createElement(ExecutiveFunnel, {
    stages: [{ key: 'WON', label: 'Ganhas', count: 0, total: 0 }],
    mode: 'count', formatMoney: String, formatNumber: String
  }));
  assert.ok(html.includes('Ganhas'));
  assert.ok(html.includes('0 (0%)'));
  assert.ok(!/NaN|Infinity/.test(html));
});
