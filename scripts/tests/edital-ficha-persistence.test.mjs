import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFicha } from '../../apps/web/src/pages/licitacoes_components/ficha-normalizer.mjs';
import { salvarFicha } from '../../apps/web/src/pages/licitacoes_components/ficha-persistence.mjs';

test('API extraction metadata survives normalization, saving and reopening a database row', async () => {
  const raw = { id_licitacao: 'TEST-DOCUMENT', extractionMethod: 'document-text-v2', extractionEvidence: { source: 'document.pdf' }, valor_estimado_total: null, matriz_itens: [] };
  const ficha = normalizeFicha(raw);
  const result = await salvarFicha(ficha, { headers: { Authorization: 'Bearer test' }, fetchImpl: async (url, options) => {
    assert.equal(url, '/api/analise-tr/salvar-ficha');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test');
    const body = JSON.parse(options.body);
    assert.equal(body.extractionMethod, raw.extractionMethod);
    assert.deepEqual(body.extractionEvidence, raw.extractionEvidence);
    assert.equal(body.valor_estimado_total, null);
    assert.deepEqual(body.matriz_itens, []);
    return { ok: true, json: async () => ({ success: true, ficha: { id: 'db-id', analysisData: JSON.stringify(body) } }) };
  } });
  const reopened = normalizeFicha(result.ficha);
  assert.equal(reopened.extractionMethod, raw.extractionMethod);
  assert.equal(reopened.id, 'db-id');
  assert.equal(normalizeFicha({ id_licitacao: 'old' }).extractionMethod, undefined);
});

test('conflicts and server errors reject instead of confirming a successful save', async () => {
  await assert.rejects(salvarFicha({}, { fetchImpl: async () => ({ ok: false, status: 409, json: async () => ({ error: 'Reanalise o documento original.' }) }) }), /Reanalise/);
  await assert.rejects(salvarFicha({}, { fetchImpl: async () => ({ ok: true, json: async () => ({ success: false }) }) }), /Falha ao salvar/);
  await assert.rejects(salvarFicha({}, { fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } }) }), /Falha ao salvar/);
});
