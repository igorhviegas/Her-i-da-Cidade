import test from 'node:test';
import assert from 'node:assert/strict';
import { EVENT_CHECKLIST_ITEMS, buildEventMission, cleanChecklist, eventMissionId, eventMissionPatch, orderEventSlot, syncEventMissions } from './event-missions.js';

const order = (extra = {}) => ({
  id: 'o1', childName: 'Pedro', eventDate: new Date('2026-10-10T15:00:00Z'), // dia 10 ao meio-dia em Brasília
  eventForm: { eventTime: '14:30', location: 'Rua A, 10', formType: 'Aniversário' }, ...extra,
});
const NOW = new Date('2026-10-10T03:10:00Z'); // 00:10 de 10/10 em Brasília

/** Store em memória com a mesma semântica do adapter do Firestore. */
function memoryStore(orders, missions = {}) {
  const data = new Map(Object.entries(missions));
  return {
    data,
    listOrdersBetween: async (start, end) => orders.filter((o) => o.eventDate >= start && o.eventDate <= end),
    listPendingEventMissions: async () => [...data].filter(([, m]) => m.source === 'event_checklist' && m.status === 'pending').map(([id, m]) => ({ id, ...m })),
    getOrder: async (id) => orders.find((o) => o.id === id) ?? null,
    createMissionIfAbsent: async (id, mission) => { if (data.has(id)) return false; data.set(id, mission); return true; },
    updateMission: async (id, patch) => data.set(id, { ...data.get(id), ...patch }),
  };
}

test('missão do evento: título, dificuldade 1, prazo = data+horário do evento (Brasília) e sete itens desmarcados', () => {
  const mission = buildEventMission(order(), NOW);
  assert.equal(mission.title, 'Check list do evento');
  assert.equal(mission.difficulty, 1);
  assert.equal(mission.status, 'pending');
  assert.equal(mission.orderId, 'o1');
  assert.equal(mission.dueAt.toISOString(), '2026-10-10T17:30:00.000Z'); // 14:30 em Brasília
  assert.deepEqual(mission.checklist.map((i) => i.text), ['Traje', 'Certificados', 'Medalhas', 'Figurinhas', 'Microfone', 'Faceshell', 'Caixa de som']);
  assert.deepEqual(mission.checklist.map((i) => i.text), EVENT_CHECKLIST_ITEMS);
  assert.ok(mission.checklist.every((i) => i.done === false));
  assert.equal(new Set(mission.checklist.map((i) => i.id)).size, 7);
});

test('pedido sem evento completo (serviço comum, rascunho do ManyChat) não gera missão', () => {
  assert.equal(buildEventMission({ id: 'x', eventDate: new Date() }, NOW), null);
  assert.equal(buildEventMission(order({ eventDraft: true }), NOW), null);
  assert.equal(orderEventSlot(order({ eventForm: { eventTime: '25:00' } })), null);
  assert.equal(orderEventSlot(order({ eventDate: undefined })), null);
});

test('data do evento usa o dia de Brasília: 02h UTC do dia 11 ainda é dia 10, e Timestamp do Firestore é aceito', () => {
  assert.equal(orderEventSlot(order({ eventDate: new Date('2026-10-11T02:00:00Z') })).key, '2026-10-10');
  assert.equal(orderEventSlot(order({ eventDate: { toDate: () => new Date('2026-10-10T12:00:00Z') } })).key, '2026-10-10');
});

test('rotina: cria só no dia do evento, uma única vez, mesmo rodando de novo (cron duplicado)', async () => {
  const store = memoryStore([order(), order({ id: 'futuro', eventDate: new Date('2026-10-11T15:00:00Z') }), order({ id: 'ontem', eventDate: new Date('2026-10-09T15:00:00Z') })]);
  assert.deepEqual(await syncEventMissions(store, NOW), { created: 1, updated: 0 });
  assert.deepEqual(await syncEventMissions(store, NOW), { created: 0, updated: 0 });
  assert.deepEqual([...store.data.keys()], [eventMissionId('o1')]);
});

test('editar o pedido, reabri-lo ou concluir a missão não gera outra missão', async () => {
  const orders = [order()];
  const store = memoryStore(orders);
  await syncEventMissions(store, NOW);
  orders[0] = order({ status: 'delivery', totalPaid: 99 }); // pedido alterado
  store.data.set('evento-checklist-o1', { ...store.data.get('evento-checklist-o1'), status: 'completed' });
  assert.deepEqual(await syncEventMissions(store, NOW), { created: 0, updated: 0 });
  assert.equal(store.data.size, 1);
});

test('data alterada depois da criação: só o prazo é remarcado, o checklist marcado à mão é preservado', async () => {
  const orders = [order()];
  const store = memoryStore(orders);
  await syncEventMissions(store, NOW);
  const id = eventMissionId('o1');
  store.data.set(id, { ...store.data.get(id), checklist: store.data.get(id).checklist.map((i, n) => ({ ...i, done: n < 2 })) });
  orders[0] = order({ eventDate: new Date('2026-10-17T15:00:00Z') });
  assert.deepEqual(await syncEventMissions(store, NOW), { created: 0, updated: 1 });
  const mission = store.data.get(id);
  assert.equal(mission.eventDateKey, '2026-10-17');
  assert.equal(mission.dueAt.toISOString(), '2026-10-17T17:30:00.000Z');
  assert.equal(mission.checklist.filter((i) => i.done).length, 2);
  assert.deepEqual(await syncEventMissions(store, NOW), { created: 0, updated: 0 }); // estável
});

test('prazo editado à mão é preservado enquanto a data do evento não muda', () => {
  const mission = { orderId: 'o1', orderState: 'active', eventDateKey: '2026-10-10', dueAt: new Date('2026-10-10T20:00:00Z') };
  assert.equal(eventMissionPatch(mission, order()), null);
});

test('pedido excluído: a missão (e o progresso) é mantida e apenas sinalizada; nada é criado para pedido inexistente', async () => {
  const orders = [order()];
  const store = memoryStore(orders);
  await syncEventMissions(store, NOW);
  orders.length = 0; // pedido excluído
  assert.deepEqual(await syncEventMissions(store, NOW), { created: 0, updated: 1 });
  assert.equal(store.data.get(eventMissionId('o1')).orderState, 'deleted');
  assert.deepEqual(await syncEventMissions(store, NOW), { created: 0, updated: 0 });
  assert.deepEqual(await syncEventMissions(memoryStore([]), NOW), { created: 0, updated: 0 });
});

test('cleanChecklist: descarta vazios, apara texto, força booleano e garante IDs únicos; entradas inválidas viram lista vazia', () => {
  const list = cleanChecklist([{ id: 'a', text: ' Traje ', done: true }, { id: 'a', text: 'Outro', done: 'sim' }, { text: '   ' }, null, { text: 'x'.repeat(300) }]);
  assert.deepEqual(list.map((i) => [i.text.length > 10 ? 120 : i.text, i.done]), [['Traje', true], ['Outro', false], [120, false]]);
  assert.equal(new Set(list.map((i) => i.id)).size, 3);
  for (const bad of [undefined, null, 'x', 5, {}]) assert.deepEqual(cleanChecklist(bad), []);
});
