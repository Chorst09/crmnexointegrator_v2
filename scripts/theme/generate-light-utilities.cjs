// Compatibility layer for legacy screens that use dark Tailwind colors directly.
// Semantic components live in light-theme.css. Every rule here is light-only.
const fs = require('node:fs');
const path = require('node:path');
const colors = require('tailwindcss/colors');
const root = path.resolve(__dirname, '../..');
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (/\.(jsx?|tsx?)$/.test(entry.name)) files.push(file);
  }
}
walk(path.join(root, 'apps/web/src'));
const source = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
const groups = new Map();
function add(token, declaration, state = '') {
  const key = `${state}|${declaration}`;
  if (!groups.has(key)) groups.set(key, new Set());
  groups.get(key).add(`[class~="${token}"]`);
}
const neutral = new Set(['slate', 'gray', 'zinc', 'neutral', 'stone']);
const tones = { red: 800, rose: 800, orange: 800, amber: 800, yellow: 800, lime: 800, green: 800, emerald: 800, teal: 800, cyan: 800, sky: 800, blue: 800, indigo: 800, violet: 800, purple: 800, fuchsia: 800, pink: 800 };
const tokens = new Set(source.match(/(?:hover:|focus:|placeholder:)?(?:text|bg|border|divide|placeholder)-(?:white|black|[a-z]+-\d{2,3}|\[#[\da-fA-F]{3,8}\])(?:\/(?:\d+|\[[.\d]+\]))?/g) || []);
// Include normal shades even when a screen assembles a utility from a status map.
for (const name of [...neutral, ...Object.keys(tones)]) {
  for (const shade of [50,100,200,300,400,500,600,700,800,900,950]) tokens.add(`text-${name}-${shade}`);
}
function rgb(hex) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x+x).join('') : c.slice(0,6);
  return [0,2,4].map(i => parseInt(full.slice(i,i+2),16));
}
function readableHex(hex) {
  let c = rgb(hex);
  const luminance = values => values.map(v => { v /= 255; return v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4; }).reduce((n,v,i) => n + v*[.2126,.7152,.0722][i], 0);
  while (1.05 / (luminance(c)+.05) < 7) c = c.map(v => Math.floor(v*.92));
  return `rgb(${c.join(', ')})`;
}
for (const token of [...tokens].sort()) {
  const m = token.match(/^(?:(hover|focus|placeholder):)?(text|bg|border|divide|placeholder)-(.+?)(?:\/(.+))?$/);
  if (!m) continue;
  const [, variant, kind, value, alpha] = m;
  const state = variant === 'placeholder' || kind === 'placeholder' ? '::placeholder' : variant ? `:${variant}` : '';
  const named = value.match(/^([a-z]+)-(\d+)$/);
  const name = named?.[1], shade = Number(named?.[2]);
  const hex = value.match(/^\[(#[\da-fA-F]+)\]$/)?.[1];
  let darkHex = false, paleHex = false;
  if (hex) {
    const [r,g,b] = rgb(hex);
    darkHex = Math.max(r,g,b) < 125;
    paleHex = (r*.2126+g*.7152+b*.0722) > 145;
  }
  const prop = state === '::placeholder' || kind === 'text' || kind === 'placeholder' ? 'color' : kind === 'bg' ? 'background' : 'border-color';
  let color;
  if (kind === 'text' || kind === 'placeholder' || state === '::placeholder') {
    if (value === 'white' || value === 'black' || neutral.has(name)) color = shade >= 400 && shade <= 600 ? 'var(--crm-muted)' : 'var(--crm-ink)';
    else if (name in tones && shade <= 600) color = colors[name][tones[name]];
    else if (hex) color = readableHex(hex);
    if (state === '::placeholder' || kind === 'placeholder') color = 'var(--crm-muted)';
  } else if (kind === 'bg') {
    if (neutral.has(name) && shade >= 600 || darkHex) color = 'var(--crm-surface)';
    else if (value === 'white' && alpha) color = 'var(--crm-surface-2)';
    else if (name in tones && alpha) color = colors[name][50];
  } else {
    if (neutral.has(name) || value === 'white' || darkHex || paleHex) color = 'var(--crm-border)';
  }
  if (color) add(token, `${prop}: ${color} !important;${state === '::placeholder' ? ' opacity: 1;' : ''}`, state);
}
// Dark gradients and literal RGB surfaces appear in headers and dashboard cards.
// Theme variables are left to the semantic palette above.
for (const token of new Set(source.match(/(?:hover:|focus:)?bg-\[[^\]\s"']+\](?:\/\d+)?/g) || [])) {
  if (token.includes('var(')) continue;
  const hexes = [...token.matchAll(/#([0-9a-fA-F]{6})(?![0-9a-fA-F])/g)].map(m => rgb('#'+m[1]));
  const rgbs = [...token.matchAll(/rgba?\((\d+)[,_ ]+(\d+)[,_ ]+(\d+)/g)].map(m => m.slice(1).map(Number));
  if ([...hexes, ...rgbs].some(c => Math.max(...c) < 125)) {
    const state = token.startsWith('hover:') ? ':hover' : token.startsWith('focus:') ? ':focus' : '';
    add(token, 'background: var(--crm-surface) !important;', state);
  }
}
// Gradients composed from Tailwind stops also carry fixed dark surfaces.
// Replacing their background avoids mixed light text/dark gradient panels.
for (const token of new Set(source.match(/(?:hover:|focus:)?(?:from|via|to)-(?:[a-z]+-\d{2,3}|\[#[\da-fA-F]{3,8}\])(?:\/(?:\d+|\[[.\d]+\]))?/g) || [])) {
  const value = token.replace(/^(hover:|focus:)/, '').replace(/^(from|via|to)-/, '').split('/')[0];
  const named = value.match(/^([a-z]+)-(\d+)$/);
  const hex = value.match(/^\[(#[\da-fA-F]+)\]$/)?.[1];
  const darkStop = named && (Number(named[2]) >= 600)
    || hex && Math.max(...rgb(hex)) < 125;
  if (darkStop) add(token, 'background: var(--crm-surface) !important;', token.startsWith('hover:') ? ':hover' : token.startsWith('focus:') ? ':focus' : '');
}
// Inline foregrounds used by stage/status maps and KPI values. Match the
// complete color declaration, never background-color or document illustrations.
for (const hex of new Set(source.match(/#[\da-fA-F]{6}(?![\da-fA-F])/g) || [])) {
  const c = rgb(hex);
  if (Math.min(...c) > 240) continue; // White text on document headers stays white.
  const readable = readableHex(hex);
  if (readable === `rgb(${c.join(', ')})`) continue;
  const key = `|color: ${readable} !important;`;
  if (!groups.has(key)) groups.set(key, new Set());
  groups.get(key).add(`[style^="color: rgb(${c.join(', ')})"]`);
  groups.get(key).add(`[style*="; color: rgb(${c.join(', ')})"]`);
}
const output = ['/* Generated by scripts/theme/generate-light-utilities.cjs. Do not edit by hand. */'];
for (const [key, selectors] of groups) {
  const declaration = key.slice(key.indexOf('|')+1);
  const state = key.slice(0, key.indexOf('|'));
  output.push(`html:not(.dark) :is(\n  ${[...selectors].join(',\n  ')}\n)${state} { ${declaration} }`);
}
const target = path.join(root, 'apps/web/src/styles/light-utilities.css');
const result = output.join('\n\n')+'\n';
if (process.argv.includes('--check')) {
  if (fs.readFileSync(target, 'utf8') !== result) { console.error('Run node scripts/theme/generate-light-utilities.cjs'); process.exit(1); }
} else fs.writeFileSync(target, result);
console.log(`Light theme: ${files.length} source files audited, ${tokens.size} legacy color utilities inspected.`);
