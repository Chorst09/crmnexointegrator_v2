import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyPipelineOpportunity, filterPipelineOpportunities, getPipelineType } from '../../apps/web/src/utils/pipeline-opportunity.mjs';

const opportunities = [
  { id: 'business', number: 'B2B-100', title: 'Renovação de rede', clientType: 'B2B', company: { name: 'São José Telecom' }, value: 12000 },
  { id: 'government', number: 'B2G-200', title: 'Rede da prefeitura', clientType: 'B2G', company: { name: 'Município de São José' } }
];

test('search scopes results to the selected pipeline and accepts accents, number and customer', () => {
  assert.deepEqual(filterPipelineOpportunities(opportunities, 'B2B', 'sao jose renovacao').map(item => item.id), ['business']);
  assert.deepEqual(filterPipelineOpportunities(opportunities, 'B2G', 'B2G-200').map(item => item.id), ['government']);
  assert.equal(filterPipelineOpportunities(opportunities, 'B2B', 'prefeitura').length, 0);
});

test('selecting B2B replaces a previous B2G customer and origin while preserving registry details', () => {
  const result = applyPipelineOpportunity({ origem: 'B2G', cliente: 'Cliente anterior', fabricante: 'DELL' }, opportunities[0]);
  assert.equal(result.cliente, 'São José Telecom');
  assert.equal(result.origem, 'B2B');
  assert.equal(result.oportunidadeId, 'business');
  assert.equal(result.valorEstimado, '12000');
  assert.equal(result.fabricante, 'DELL');
});

test('selecting B2G fills the agency and does not retain an unrelated customer when missing', () => {
  assert.equal(applyPipelineOpportunity({}, opportunities[1]).cliente, 'Município de São José');
  assert.equal(applyPipelineOpportunity({ cliente: 'Cliente anterior' }, { id: 'no-client' }).cliente, '');
});

test('supports older opportunities and preserves explicit pipeline type', () => {
  assert.equal(getPipelineType({ number: 'B2G-300' }), 'B2G');
  assert.equal(getPipelineType({ company: { clientType: 'B2G' } }), 'B2G');
  assert.equal(getPipelineType({ clientType: 'B2B', company: { clientType: 'B2G' } }), 'B2B');
});
