const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../apps/web/src/pages/Solicitacoes.jsx'), 'utf8');
const helpers = source.slice(source.indexOf('const REQUEST_STATUS_FROM_ACTIVITY'), source.indexOf('const stageLabel'));
const context = { module: { exports: {} } };
vm.runInNewContext(helpers + '\nmodule.exports = { mapActivityRow, mapRequestRow };', context);
const { mapActivityRow, mapRequestRow } = context.module.exports;

for (const stage of ['REPROVADO', 'CANCELADA']) {
  test(`atividade legada CANCELLED mantém a decisão ${stage}`, () => {
    const item = mapActivityRow({ id: 'legacy', status: 'CANCELLED', description: `Motivo registrado\n[FLOW_STAGE:${stage}]` });
    assert.equal(item.status, stage);
    assert.equal(item.stage, stage);
  });
}
for (const status of ['REPROVADO', 'CANCELADA']) {
  test(`encerramento explícito ${status} prevalece sobre marcadores antigos`, () => {
    const item = mapActivityRow({ id: 'returned', status: 'PENDING', description: '[FLOW_STAGE:COTACAO]', flow: { preSalesClosure: { status, motivo: 'Decisão registrada' } } });
    assert.equal(item.status, status);
    assert.equal(item.stage, status);
    const request = mapRequestRow({ id: 'request', status, observacoes: '[FLOW_STAGE:COTACAO]' });
    assert.equal(request.stage, status);
  });
}
test('atividade cancelada sem marcador mantém cancelamento', () => {
  const item = mapActivityRow({ id: 'legacy', status: 'CANCELLED' });
  assert.equal(item.status, 'CANCELADA');
  assert.equal(item.stage, 'CANCELADA');
});
test('atividade em cotação preserva a etapa ativa', () => {
  const item = mapActivityRow({ id: 'active', status: 'IN_PROGRESS', description: '[FLOW_STAGE:COTACAO]' });
  assert.equal(item.status, 'EM_PRECIFICACAO');
  assert.equal(item.stage, 'COTACAO');
});
