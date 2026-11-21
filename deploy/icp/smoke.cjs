'use strict';
async function main() {
  const base = process.argv[2] || 'http://127.0.0.1:3000';
  const health = await fetch(base + '/api/health');
  if (!health.ok || (await health.json()).database !== 'connected') throw new Error('database health');
  const home = await fetch(base + '/');
  const html = await home.text();
  if (!home.ok || !html.includes('<html')) throw new Error('frontend');
  const assets = [...html.matchAll(/(?:src|href)="([^"\s]+\.(?:js|css))"/g)].map(m => m[1]);
  if (!assets.length) throw new Error('missing assets');
  for (const asset of assets) {
    const r = await fetch(new URL(asset, base));
    if (!r.ok || /text\/html/.test(r.headers.get('content-type'))) throw new Error('asset');
  }
  if ((await fetch(base + '/api/companies')).status !== 401) throw new Error('authentication guard');
  console.log('Database health, frontend, JS/CSS and unauthenticated API guard passed.');
}
main().catch(e => { console.error('Smoke check failed:', e.message); process.exitCode = 1; });
