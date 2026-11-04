import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getActivityDisplayStatus, isOverdue } from '../../apps/web/src/utils/commercial-activity-status.mjs';

for (const [decision, expected] of [['CANCELADA', 'CANCELLED'], ['REPROVADO', 'REJECTED'], ['REJEITADA', 'REJECTED']]) {
  for (const previousStatus of ['PENDING', 'IN_PROGRESS', 'CANCELLED', 'COMPLETED']) {
    test(`${decision} em atividade ${previousStatus} vai diretamente para ${expected}`, () => {
      const activity = { status: previousStatus, dueDate: '2020-01-01', flow: { preSalesClosure: { status: decision, motivo: 'Motivo preservado' } } };
      assert.equal(getActivityDisplayStatus(activity), expected);
      assert.equal(isOverdue(activity.dueDate, getActivityDisplayStatus(activity)), false);
      assert.notEqual(getActivityDisplayStatus(activity), 'PENDING');
    });
  }
}
test('reprovação legada mantém coluna própria sem exigir alteração de enum no banco', () => {
  assert.equal(getActivityDisplayStatus({ status: 'CANCELLED', description: '[FLOW_STAGE:COTACAO]\n[FLOW_STAGE:REPROVADO]' }), 'REJECTED');
  assert.equal(getActivityDisplayStatus({ status: 'CANCELLED', description: '[FLOW_STAGE:CANCELADA]' }), 'CANCELLED');
});
test('retorno antigo com preSalesStatus também sai da fila pendente', () => {
  assert.equal(getActivityDisplayStatus({ status: 'PENDING', flow: { returnedFromPreSales: true, preSalesStatus: 'REPROVADO' } }), 'REJECTED');
});
test('atividades abertas e propostas enviadas preservam o comportamento normal', () => {
  assert.equal(getActivityDisplayStatus({ status: 'PENDING' }), 'PENDING');
  assert.equal(getActivityDisplayStatus({ status: 'IN_PROGRESS' }), 'IN_PROGRESS');
  assert.equal(getActivityDisplayStatus({ status: 'COMPLETED' }), 'COMPLETED');
  assert.equal(getActivityDisplayStatus({ status: 'COMPLETED', flow: { activityStage: 'PROPOSTA_ENVIADA' } }), 'PROPOSAL_SENT');
  assert.equal(getActivityDisplayStatus({ status: 'CANCELLED' }), 'CANCELLED');
});
test('apenas atividades abertas com prazo válido podem ficar atrasadas', () => {
  assert.equal(isOverdue('2020-01-01', 'PENDING'), true);
  assert.equal(isOverdue('data inválida', 'PENDING'), false);
  assert.equal(isOverdue(null, 'PENDING'), false);
  assert.equal(isOverdue('2020-01-01', 'COMPLETED'), false);
  assert.equal(isOverdue('2020-01-01', 'PROPOSAL_SENT'), false);
});
