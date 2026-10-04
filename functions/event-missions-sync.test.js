import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { runMissionsSync } from './missions-sync.js';

// Firestore Admin em memória: where(==, >=, <=), get, doc().get/create/update.
function fakeDatabase(seed) {
  const store = new Map(Object.entries(seed).flatMap(([collection, docs]) => Object.entries(docs).map(([id, data]) => [`${collection}/${id}`, data])));
  const value = (v) => (v instanceof Timestamp ? v.toMillis() : v);
  const matches = (data, { field, op, v }) => (op === '==' ? data[field] === v : op === '>=' ? value(data[field]) >= value(v) : value(data[field]) <= value(v));
  return {
    store,
    collection(name) {
      const filters = [];
      const query = {
        where(field, op, v) { filters.push({ field, op, v }); return query; },
        async get() {
          return { docs: [...store].filter(([path]) => path.startsWith(`${name}/`)).map(([path, data]) => ({ id: path.split('/')[1], data: () => data })).filter((d) => filters.every((f) => matches(d.data(), f))) };
        },
        doc(id) {
          const path = `${name}/${id}`;
          return {
            async get() { return { exists: store.has(path), id, data: () => store.get(path) }; },
            async create(data) { if (store.has(path)) { const e = new Error('6 ALREADY_EXISTS'); e.code = 6; throw e; } store.set(path, data); },
            async update(patch) { store.set(path, { ...store.get(path), ...patch }); },
          };
        },
      };
      return query;
    },
  };
}

const eventOrder = (date) => ({ clientId: 'c', childName: 'Pedro', eventDate: Timestamp.fromDate(new Date(date)), eventForm: { eventTime: '14:30', location: 'Rua A', formType: 'Aniversário' } });
const NOW = new Date('2026-10-10T03:20:00Z'); // 00:20 de 10/10 em Brasília

test('cron: cria a missão "Check list do evento" no dia do evento, grava no Firestore e não duplica na segunda execução', async () => {
  const db = fakeDatabase({ orders: { hoje: eventOrder('2026-10-10T15:00:00Z'), amanha: eventOrder('2026-10-11T15:00:00Z'), comum: { clientId: 'c', eventDate: Timestamp.fromDate(new Date('2026-10-10T15:00:00Z')) } } });
  const first = await runMissionsSync(db, NOW);
  const second = await runMissionsSync(db, NOW);
  assert.equal(first.eventMissions, 1);
  assert.equal(second.eventMissions, 0);
  const missions = [...db.store].filter(([path]) => path.startsWith('missions/'));
  assert.deepEqual(missions.map(([path]) => path), ['missions/evento-checklist-hoje']);
  const mission = missions[0][1];
  assert.equal(mission.title, 'Check list do evento');
  assert.equal(mission.difficulty, 1);
  assert.equal(mission.checklist.length, 7);
  assert.ok(mission.dueAt instanceof Timestamp && mission.dueAt.toDate().toISOString() === '2026-10-10T17:30:00.000Z');
  assert.ok(mission.createdAt instanceof Timestamp);
});

test('cron: pedido excluído marca a missão pendente sem apagá-la; falha na rotina de eventos não impede os avisos mas é relançada', async () => {
  const db = fakeDatabase({ orders: { hoje: eventOrder('2026-10-10T15:00:00Z') } });
  await runMissionsSync(db, NOW);
  db.store.delete('orders/hoje');
  const result = await runMissionsSync(db, NOW);
  assert.equal(result.eventMissionsUpdated, 1);
  assert.equal(db.store.get('missions/evento-checklist-hoje').orderState, 'deleted');
  assert.equal(db.store.get('missions/evento-checklist-hoje').checklist.length, 7);

  const broken = fakeDatabase({});
  const original = broken.collection.bind(broken);
  broken.collection = (name) => { if (name === 'orders') throw new Error('indisponível'); return original(name); };
  await assert.rejects(runMissionsSync(broken, NOW), /indisponível/);
});
