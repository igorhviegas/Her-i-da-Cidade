import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCalendarEvents } from '../api/calendar-events.ts';
import { GoogleCalendarError } from '../functions/google-calendar.js';

const response = () => ({ statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const authorized = async () => 'authorized';
const post = (body) => ({ method: 'POST', headers: {}, body });
const call = async (req, deps) => { const res = response(); await handleCalendarEvents(req, res, deps); return res; };

test('somente POST de administrador; ação desconhecida é recusada antes de falar com o Google', async () => {
  let runs = 0;
  const actions = { list: async () => { runs += 1; return { events: [], truncated: false }; } };
  assert.equal((await call({ method: 'GET', headers: {} }, { authorize: authorized, actions })).statusCode, 405);
  assert.equal((await call(post({ action: 'list' }), { authorize: async () => 'unauthenticated', actions })).statusCode, 401);
  assert.equal((await call(post({ action: 'list' }), { authorize: async () => 'forbidden', actions })).statusCode, 403);
  assert.equal((await call(post({ action: 'list' }), { authorize: async () => { throw new Error('x'); }, actions })).statusCode, 503);
  assert.equal((await call(post({ action: 'drop' }), { authorize: authorized, actions })).statusCode, 400);
  assert.equal((await call(post({ action: 'toString' }), { authorize: authorized, actions })).statusCode, 400);
  assert.equal((await call(post(undefined), { authorize: authorized, actions })).statusCode, 400);
  assert.equal(runs, 0);
});

test('list/create/update/delete repassam só os campos esperados e respondem ok com o que o Google confirmou', async () => {
  const seen = {};
  const actions = {
    list: async (args) => { seen.list = args; return { events: [{ id: 'e1' }], truncated: false }; },
    create: async (args) => { seen.create = args; return { id: 'e2' }; },
    update: async (args) => { seen.update = args; return { id: 'e3' }; },
    delete: async (args) => { seen.delete = args; return { id: 'e4' }; },
  };
  const run = (body) => call(post(body), { authorize: authorized, actions });
  assert.deepEqual((await run({ action: 'list', from: '2026-10-01', to: '2026-10-31', q: 'Maria' })).body, { ok: true, events: [{ id: 'e1' }], truncated: false });
  assert.deepEqual([seen.list.from, seen.list.to, seen.list.q], ['2026-10-01', '2026-10-31', 'Maria']);
  assert.deepEqual((await run({ action: 'create', event: { title: 'A' } })).body, { ok: true, event: { id: 'e2' } });
  assert.deepEqual(seen.create.input, { title: 'A' });
  assert.deepEqual((await run({ action: 'update', id: 'e3', event: { title: 'B' } })).body, { ok: true, event: { id: 'e3' } });
  assert.equal(seen.update.id, 'e3');
  const deleted = await run({ action: 'delete', id: 'e4' });
  assert.deepEqual(deleted.body, { ok: true });
  assert.equal(deleted.headers['cache-control'], 'no-store');
});

test('falhas do Google viram status e mensagem clara (nunca ok); erro inesperado não vaza detalhes', async () => {
  const failing = (error) => ({ delete: async () => { throw error; } });
  const run = (error) => call(post({ action: 'delete', id: 'e1' }), { authorize: authorized, actions: failing(error) });
  const notFound = await run(new GoogleCalendarError('event_not_found'));
  assert.deepEqual([notFound.statusCode, notFound.body.ok, notFound.body.error.code], [404, false, 'event_not_found']);
  assert.equal((await run(new GoogleCalendarError('unavailable'))).statusCode, 503);
  assert.equal((await run(new GoogleCalendarError('permission'))).statusCode, 502);
  assert.equal((await run(new GoogleCalendarError('invalid_event'))).statusCode, 422);
  const unexpected = await run(new Error('segredo-interno'));
  assert.equal(unexpected.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(unexpected.body), /segredo-interno/);
});
