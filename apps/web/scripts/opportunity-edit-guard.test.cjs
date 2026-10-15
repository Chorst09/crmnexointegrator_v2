'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findUndefinedReferences } = require('./check-opportunity-edit.cjs');

test('blocks the undefined normalizer that prevented the edit modal from opening', () => {
  const source = `const normalizeNegotiationType = value => normalizeText(String(value || ''));
    const handleEdit = opportunity => normalizeNegotiationType(opportunity.negotiationType);`;
  assert.equal(findUndefinedReferences(source).length, 1);
  assert.match(findUndefinedReferences(source)[0], /não definida: normalizeText/);
});

test('understands imports, local bindings, JSX and browser APIs without allowing missing helpers', () => {
  const source = `import { normalizeNegotiationType } from './normalization.mjs';
    export function Editor({ opportunity }) {
      const submit = () => { localStorage.setItem('last', opportunity.id); alert('Salvo'); };
      return <button onClick={submit}>{normalizeNegotiationType(opportunity.negotiationType)}</button>;
    }`;
  assert.deepEqual(findUndefinedReferences(source), []);
});

test('legacy B2B negotiation values preserve the correct client classification', async () => {
  const { normalizeNegotiationType, projectClientTypeFromNegotiation } = await import('../src/utils/opportunity-negotiation.mjs');
  for (const [input, label, clientType] of [
    ['Nova Venda', 'Cliente Novo', 'NEW_CLIENT'],
    ['NEW_CLIENT', 'Cliente Novo', 'NEW_CLIENT'],
    ['Cliente da Base', 'Cliente da Base', 'BASE_CLIENT'],
    ['Renovação', 'Renovações', 'RENEWAL'],
    ['RENEWAL', 'Renovações', 'RENEWAL'],
    ['Up-Sell', 'Up Selling', 'BASE_CLIENT']
  ]) {
    assert.equal(normalizeNegotiationType(input), label);
    assert.equal(projectClientTypeFromNegotiation(input), clientType);
  }
  assert.equal(normalizeNegotiationType(null), '');
});
