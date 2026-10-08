import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPayEditorMission, payEditorMissionId } from './paymentMission.js';

const order = { id: 'abc12345xyz', serviceId: '3', childName: 'Bernardo', content: 'Detalhes: Parabéns!', editingCost: 25 };

test('Vídeo Personalizado concluído gera "Pagar Vitor" fácil, com prazo no fim do dia da conclusão', () => {
  const completedAt = new Date(2026, 9, 8, 10, 30);
  const mission = buildPayEditorMission(order, { name: 'Guilherme' }, null, completedAt);
  assert.equal(mission.title, 'Pagar Vitor');
  assert.equal(mission.difficulty, 2);
  assert.equal(mission.status, 'pending');
  assert.equal(mission.orderId, order.id);
  assert.equal(mission.dueAt.toDateString(), completedAt.toDateString());
  assert.equal(mission.dueAt.getHours(), 23);
  assert.match(mission.description, /Cliente: Guilherme/);
  assert.match(mission.description, /Criança: Bernardo/);
  assert.match(mission.description, /Custo de edição: R\$ 25,00/);
  assert.match(mission.description, /Parabéns!/);
});

test('outros serviços não geram a missão; o ID é por pedido', () => {
  assert.equal(buildPayEditorMission({ ...order, serviceId: '4' }, null, null, new Date()), null);
  assert.equal(payEditorMissionId('x'), 'pay-editor-x');
});
