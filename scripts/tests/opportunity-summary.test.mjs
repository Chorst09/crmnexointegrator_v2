import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getOpportunitySummary } from '../../apps/web/src/utils/opportunity-summary.mjs';

test('current B2G data shows the object summary rather than its JSON', () => {
  assert.equal(getOpportunitySummary({ description: JSON.stringify({ processNumber: 'B2G-2026-00008', objectSummary: 'Projeto para Backup com VEEAM', objectDetail: 'Detalhamento completo' }) }), 'Projeto para Backup com VEEAM');
});
test('legacy Portuguese data shows its summary or object detail', () => {
  assert.equal(getOpportunitySummary({ description: JSON.stringify({ objetoResumido: '', objetoDetalhado: 'Fornecimento de equipamentos' }) }), 'Fornecimento de equipamentos');
});
test('legacy closed opportunity can summarize supplied products', () => {
  assert.equal(getOpportunitySummary({ description: JSON.stringify({ objetoResumido: '', closeData: { productsInvolved: 'CLOUD STORAGE, LINKS FIBRA E RADIO' } }) }), 'CLOUD STORAGE, LINKS FIBRA E RADIO');
});
test('plain descriptions remain legible and long descriptions are shortened', () => {
  assert.equal(getOpportunitySummary({ description: '  Serviço de\n backup  ' }), 'Serviço de backup');
  const summary = getOpportunitySummary({ description: 'A'.repeat(500) });
  assert.ok(summary.length <= 240);
  assert.ok(summary.endsWith('…'));
});
test('unknown or malformed technical descriptions never expose raw JSON', () => {
  for (const description of ['{"processNumber":"123"}', '{"objectSummary":', '[{"field":"value"}]', null]) {
    assert.equal(getOpportunitySummary({ description }), 'Resumo não informado.');
  }
});
