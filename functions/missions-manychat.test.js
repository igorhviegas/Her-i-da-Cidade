import test from 'node:test';
import assert from 'node:assert/strict';
import { handleManyChatOrderRequest } from './manychat-handler.js';
import { validateMissionPayload } from './missions-manychat.js';

const SECRET = 'unit-test-secret';
const body = (mission, extra = {}) => ({ eventType: 'mission.create', mission, ...extra });

function call(payload, { auth = `Bearer ${SECRET}`, database } = {}) {
  const res = { statusCode: 200, body: undefined, set() { return this; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const req = { method: 'POST', rawBody: Buffer.from('{}'), body: payload, is: () => true, get: (h) => (h === 'authorization' ? auth : undefined) };
  return handleManyChatOrderRequest(req, res, { database, secret: SECRET }).then(() => res);
}

function fakeDatabase() {
  const writes = [];
  return { writes, collection: (name) => ({ doc: () => ({ id: 'new-mission', set: async (data) => { writes.push({ name, data }); } }) }) };
}

test('missão válida com prazo, sem prazo e dificuldade em texto', () => {
  const withDue = validateMissionPayload(body({ title: ' Ligar ', description: 'x', dueDate: '2026-10-10', difficulty: '4' }));
  assert.deepEqual(withDue.errors, []);
  assert.equal(withDue.mission.title, 'Ligar');
  assert.equal(withDue.mission.dueAt.toISOString(), '2026-10-11T02:59:59.999Z'); // 23:59:59 de Brasília
  assert.equal(validateMissionPayload(body({ title: 'A', difficulty: 1, dueDate: '' })).mission.dueAt, null);
  assert.equal(validateMissionPayload(body({ title: 'A', difficulty: 3 })).mission.dueAt, null);
  assert.equal(validateMissionPayload(body({ title: 'A', difficulty: 3, dueDate: '2026-10-10T09:00:00-03:00' })).mission.dueAt.toISOString(), '2026-10-10T12:00:00.000Z');
});

test('payloads inválidos são rejeitados', () => {
  const bad = (mission, extra) => validateMissionPayload(body(mission, extra)).errors.length > 0;
  assert.ok(bad({ title: '', difficulty: 3 }));
  assert.ok(bad({ title: 'A', difficulty: 6 }));
  assert.ok(bad({ title: 'A', difficulty: '2.5' }));
  assert.ok(bad({ title: 'A', difficulty: 3, dueDate: '31/12/2026' }));
  assert.ok(bad({ title: 'A', difficulty: 3, dueDate: '2026-02-30' }));
  assert.ok(bad({ title: 'A', difficulty: 3, extra: 'x' }));
  assert.ok(bad({ title: 'A', difficulty: 3 }, { other: 1 }));
  assert.ok(bad({ title: 'x'.repeat(121), difficulty: 3 }));
  assert.ok(validateMissionPayload({ eventType: 'mission.create' }).errors.length);
});

test('endpoint: exige segredo, valida e só então grava a missão', async () => {
  const database = fakeDatabase();
  const valid = body({ title: 'Comprar fantasia', description: 'Tamanho M', dueDate: '2026-10-10', difficulty: '2' });
  assert.equal((await call(valid, { auth: 'Bearer errado', database })).statusCode, 401);
  assert.equal((await call(body({ title: '', difficulty: 9 }), { database })).statusCode, 400);
  assert.equal(database.writes.length, 0);
  const ok = await call(valid, { database });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.body, { ok: true, missionId: 'new-mission' });
  assert.equal(database.writes.length, 1);
  assert.equal(database.writes[0].name, 'missions');
  assert.equal(database.writes[0].data.status, 'pending');
  assert.equal(database.writes[0].data.source, 'manychat');
  assert.equal(database.writes[0].data.difficulty, 2);
});

test('payload de pedido com campo de missão continua sendo rejeitado pelo fluxo de pedidos', async () => {
  const res = await call({ eventType: 'payment.paid', mission: { title: 'x' }, customer: { name: 'A', whatsapp: '31999990000' }, childName: 'B' }, { database: fakeDatabase() });
  assert.equal(res.statusCode, 400);
});
