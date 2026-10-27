const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

test('manufacturer resolution supports older records and preserves explicit/link priorities', async () => {
  const { getOpportunityFabricante: resolve } = await import('../../apps/web/src/utils/registry-manufacturer.mjs');
  const suppliers = new Map([['brand', 'Marca Personalizada']]);
  assert.equal(resolve({ titulo: 'Backup SIPAL', produto: 'Veeam Data Cloud', numeroOportunidade: '202610207551510' }), 'VEEAM');
  assert.equal(resolve({ fabricante: '  Fabricante informado ', produto: 'Veeam Data Cloud' }), 'FABRICANTE INFORMADO');
  assert.equal(resolve({ fornecedorIds: ['brand'], produto: 'Veeam Data Cloud' }, suppliers), 'MARCA PERSONALIZADA');
  assert.equal(resolve({ produto: 'Solução Marca Personalizada' }, suppliers), 'MARCA PERSONALIZADA');
  for (const [item, expected] of [
    [{ numeroOportunidade: 'RO-DELL-123' }, 'DELL'],
    [{ numeroOportunidade: 'DELL123' }, 'DELL'],
    [{ produto: 'Servidor HPE ProLiant' }, 'HPE'],
    [{ produto: 'Switch TP-Link' }, 'TP-LINK'],
    [{ titulo: 'Proteção Trend Micro' }, 'TREND MICRO'],
    [{ titulo: 'Backup Acronis' }, 'ACRONIS'],
    [{ numeroOportunidade: 'RO-20261020', produto: 'Produto sem marca' }, ''],
    [{ produto: 'AMDAHL computing' }, ''],
    [{ produto: 'Produto sem marca', observacoes: 'Cliente usa Veeam com concorrente' }, '']
  ]) assert.equal(resolve(item), expected);
});

for (const filename of ['backend/api/prevendas-cadastros.js', 'apps/api/api/prevendas-cadastros.js']) {
  test(`${filename}: manufacturer survives create, partial update and explicit change`, async () => {
    let saved;
    const prisma = { systemSetting: {
      findUnique: async () => saved ? { value: saved } : null,
      upsert: async ({ create, update }) => { saved = saved ? update.value : create.value; }
    } };
    const source = fs.readFileSync(path.resolve(__dirname, '../..', filename), 'utf8')
      .replace(/^import .*;\n/gm, '').replace('export default async function handler', 'return async function handler');
    const handler = new Function('prisma', 'crypto', source)(prisma, crypto);
    const req = (method, suffix = '', body = {}) => ({ method, url: `/api/prevendas-cadastros/oportunidades${suffix}`, user: { id: 'tester' }, json: async () => body });
    const response = await handler(req('POST', '', { titulo: 'Backup SIPAL', fabricante: 'VEEAM' }));
    assert.equal(response.status, 201);
    const created = await response.json();
    assert.equal(created.fabricante, 'VEEAM');
    await handler(req('PUT', `/${created.id}`, { status: 'APROVADO' }));
    let read = await (await handler(req('GET', `/${created.id}`))).json();
    assert.equal(read.fabricante, 'VEEAM');
    await handler(req('PUT', `/${created.id}`, { fabricante: 'Marca Personalizada' }));
    read = await (await handler(req('GET', `/${created.id}`))).json();
    assert.equal(read.fabricante, 'Marca Personalizada');
  });
}
