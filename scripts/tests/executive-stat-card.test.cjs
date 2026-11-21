const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const esbuild = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(name) {
  const source = esbuild.buildSync({entryPoints:[path.resolve(__dirname,`../../apps/web/src/components/${name}.jsx`)],bundle:true,write:false,platform:'node',format:'cjs',jsx:'automatic',external:['react'],loader:{'.css':'empty'}}).outputFiles[0].text;
  const compiled={exports:{}};
  new Function('require','module','exports',source)(require,compiled,compiled.exports);
  return compiled.exports.default;
}

test('all legacy indicator entry points preserve units, decimals and the shared surface', () => {
  for (const name of ['DashboardKPICard','StatsCard','Card','AnimatedStats']) {
    const Component=load(name);
    const html=renderToStaticMarkup(React.createElement(Component,{title:'Margem',value:12.5,suffix:'%',animate:false}));
    assert.ok(html.includes('nex-stat-card__value'));
    assert.ok(html.includes('12,5%'));
    const money=renderToStaticMarkup(React.createElement(Component,{title:'Comissão',value:1234,prefix:'R$ ',animate:false}));
    assert.ok(money.includes('R$ 1.234'));
  }
});

test('emojis, icon elements, currency and empty trends render safely', () => {
  const Component=load('ExecutiveStatCard');
  for(const icon of ['📈',React.createElement('svg',{'aria-hidden':true}),undefined]) {
    const html=renderToStaticMarkup(React.createElement(Component,{title:'Receita',value:1234.5,format:'currency',icon}));
    assert.ok(!html.includes('<📈'));
    assert.ok(html.includes('1.234,50'));
    assert.ok(!html.includes('nex-stat-card__trend"'));
  }
});

test('clickable cards use keyboard-accessible buttons and preserve trend labels', () => {
  const Component=load('ExecutiveStatCard');
  const html=renderToStaticMarkup(React.createElement(Component,{title:'Receita',value:'R$ 12.000',onClick:()=>{},trend:{direction:'down',value:'−2,5%',label:'vs. mês anterior'}}));
  assert.ok(html.startsWith('<button type="button"'));
  assert.ok(html.includes('data-direction="down"'));
  assert.ok(html.includes('vs. mês anterior'));
});
