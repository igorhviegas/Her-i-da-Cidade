import test from 'node:test';
import assert from 'node:assert/strict';
import { runMissionsSync } from './missions-sync.js';

// Firestore Admin em memória, com o suficiente para a rotina: where(==, >=), get, doc().create/update.
function fakeAdminDatabase(seed = {}) {
  const store = new Map(Object.entries(seed).flatMap(([collection, docs]) => Object.entries(docs).map(([id, data]) => [`${collection}/${id}`, data])));
  const creates = [];
  const api = {
    store, creates,
    collection(name) {
      const filters = [];
      const query = {
        where(field, op, value) { filters.push({ field, op, value }); return query; },
        async get() {
          const docs = [...store.entries()].filter(([path]) => path.startsWith(`${name}/`)).map(([path, data]) => ({ id: path.split('/')[1], data: () => data }))
            .filter((d) => filters.every(({ field, op, value }) => (op === '==' ? d.data()[field] === value : d.data()[field] >= value)));
          return { docs };
        },
        doc(id) {
          const path = `${name}/${id}`;
          return {
            async create(data) { if (store.has(path)) { const e = new Error('6 ALREADY_EXISTS'); e.code = 6; throw e; } store.set(path, data); creates.push(path); },
            async update(patch) { store.set(path, { ...store.get(path), ...patch }); },
            async get() { return { data: () => store.get(path) }; },
          };
        },
      };
      return query;
    },
  };
  return api;
}

const task = { title: 'Treinar', difficulty: 2, time: '07:00', frequency: 'daily', status: 'active', startDate: '2026-10-01', lastGeneratedDate: '2026-09-30' };

test('rotina agendada: gera a ocorrência do dia e o aviso uma única vez, mesmo se disparada duas vezes (cron duplicado)', async () => {
  const db = fakeAdminDatabase({ recurringTasks: { t1: { ...task } } });
  const now = new Date('2026-10-01T03:30:00Z'); // 00:30 de 01/10 em Brasília
  const first = await runMissionsSync(db, now);
  const second = await runMissionsSync(db, now);
  assert.equal(first.created, 1);
  assert.equal(first.notified, 1);
  assert.deepEqual([second.created, second.notified], [0, 0]);
  assert.equal(db.store.get('taskOccurrences/t1_2026-10-01').status, 'pending');
  assert.equal(db.store.get('notifications/task_today_t1_2026-10-01').dismissed, false);
});

test('rotina agendada recupera dias sem execução e marca perdidas sem criar avisos duplicados', async () => {
  const db = fakeAdminDatabase({ recurringTasks: { t1: { ...task } } });
  await runMissionsSync(db, new Date('2026-10-01T03:30:00Z'));
  await runMissionsSync(db, new Date('2026-10-04T04:00:00Z')); // fora do ar nos dias 02 e 03
  assert.deepEqual(['01', '02', '03'].map((d) => db.store.get(`taskOccurrences/t1_2026-10-${d}`).status), ['missed', 'missed', 'missed']);
  assert.equal(db.store.get('taskOccurrences/t1_2026-10-04').status, 'pending');
  assert.equal([...db.store.keys()].filter((k) => k.startsWith('taskOccurrences/')).length, 4);
});

test('um aviso descartado não é recriado pela rotina', async () => {
  const db = fakeAdminDatabase({ recurringTasks: { t1: { ...task } } });
  const now = new Date('2026-10-01T03:30:00Z');
  await runMissionsSync(db, now);
  db.store.set('notifications/task_today_t1_2026-10-01', { ...db.store.get('notifications/task_today_t1_2026-10-01'), dismissed: true });
  await runMissionsSync(db, now);
  assert.equal(db.store.get('notifications/task_today_t1_2026-10-01').dismissed, true);
});

test('rotina agendada cria os avisos de saúde do Instagram uma única vez e não quebra sem perfil', async () => {
  const now = new Date('2026-10-10T03:30:00Z');
  const stale = { syncedAt: '2026-10-05T10:00:00.000Z', lastAttemptAt: '2026-10-10T02:00:00.000Z', lastError: { code: 'token_invalid', message: 'Token expirado.' }, tokenExpiresAt: '2026-10-05T10:00:00.000Z' };
  const db = fakeAdminDatabase({ instagramMeta: { profile: stale } });
  const first = await runMissionsSync(db, now);
  const second = await runMissionsSync(db, now);
  assert.deepEqual([first.notified, second.notified], [2, 0]);
  assert.deepEqual(['instagram_stale_2026-10-05', 'instagram_token_invalid_2026-10-09'].map((id) => db.store.get('notifications/' + id)?.refType), ['instagram', 'instagram']);
  assert.equal((await runMissionsSync(fakeAdminDatabase(), now)).notified, 0);
});
