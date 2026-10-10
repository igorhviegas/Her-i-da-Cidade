import test from 'node:test';
import assert from 'node:assert/strict';
import { handleCalendarEvents as handleGoogleCalendar } from '../api/calendar-events.ts';
import { GoogleCalendarError } from '../functions/google-calendar.js';

const response = () => ({ statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const authorized = async () => 'authorized';

function fakeDb({ order, client = { name: 'Maria', whatsapp: '31999044206' }, failUpdate = false } = {}) {
  const updates = [];
  const docRef = (collection, id) => ({
    get: async () => {
      const data = collection === 'orders' ? order : client;
      return { exists: Boolean(data), data: () => data };
    },
    update: async (data) => { if (failUpdate) throw new Error('falha'); updates.push({ collection, id, data }); },
  });
  return { db: { collection: (name) => ({ doc: (id) => docRef(name, id) }) }, updates };
}
const call = async (req, deps) => { const res = response(); await handleGoogleCalendar(req, res, deps); return res; };
const post = (body = { action: 'sync', orderId: 'o1' }) => ({ method: 'POST', headers: {}, body });
const eventOrder = { clientId: 'c1', childName: 'Pedro', eventForm: { formType: 'Aniversário' } };

test('somente POST de administrador autenticado; entrada validada antes de qualquer leitura', async () => {
  let reads = 0; const sync = async () => { reads += 1; return {}; };
  assert.equal((await call({ method: 'GET', headers: {} }, { authorize: authorized, sync })).statusCode, 405);
  assert.equal((await call(post(), { authorize: async () => 'unauthenticated', sync })).statusCode, 401);
  assert.equal((await call(post(), { authorize: async () => 'forbidden', sync })).statusCode, 403);
  assert.equal((await call(post(), { authorize: async () => { throw new Error('x'); }, sync })).statusCode, 503);
  assert.equal((await call(post({}), { authorize: authorized, sync })).statusCode, 400);
  assert.equal((await call(post({ action: 'sync', orderId: 'a/b' }), { authorize: authorized, sync })).statusCode, 400);
  assert.equal(reads, 0);
});

test('pedido inexistente, que não é evento do formulário manual, ou sem cliente: recusa sem chamar o Google', async () => {
  let syncs = 0; const sync = async () => { syncs += 1; return {}; };
  assert.equal((await call(post(), { authorize: authorized, sync, db: fakeDb({ order: undefined }).db })).statusCode, 404);
  const legacy = await call(post(), { authorize: authorized, sync, db: fakeDb({ order: { clientId: 'c1' } }).db });
  assert.deepEqual([legacy.statusCode, legacy.body.error.code], [422, 'not_event']);
  assert.equal((await call(post(), { authorize: authorized, sync, db: fakeDb({ order: eventOrder, client: null }).db })).statusCode, 422);
  assert.equal(syncs, 0);
});

test('sucesso: o servidor usa o pedido salvo, só responde ok após o Google confirmar e grava o vínculo no pedido', async () => {
  const { db, updates } = fakeDb({ order: eventOrder });
  let received;
  const sync = async (args) => { received = args; return { eventId: 'ev1', htmlLink: 'https://cal/1', created: true, calendarId: 'cal' }; };
  const res = await call({ ...post(), body: { action: 'sync', orderId: 'o1', order: { forjado: true } } }, { authorize: authorized, sync, db });
  assert.deepEqual(res.body, { ok: true, created: true, htmlLink: 'https://cal/1', persisted: true });
  assert.equal(received.order, eventOrder); // nada do corpo da requisição é usado como dados do evento
  assert.equal(received.orderId, 'o1');
  assert.equal(updates.length, 1);
  assert.deepEqual([updates[0].collection, updates[0].id], ['orders', 'o1']);
  assert.deepEqual([updates[0].data.googleCalendar.eventId, updates[0].data.googleCalendar.calendarId, updates[0].data.googleCalendar.htmlLink], ['ev1', 'cal', 'https://cal/1']);
  assert.equal(res.headers['cache-control'], 'no-store');
});

test('o Google confirmou mas o vínculo não foi gravado: ok com persisted=false (reenviar atualiza o mesmo evento)', async () => {
  const sync = async () => ({ eventId: 'ev1', created: false, calendarId: 'cal' });
  const res = await call(post(), { authorize: authorized, sync, db: fakeDb({ order: eventOrder, failUpdate: true }).db });
  assert.deepEqual([res.statusCode, res.body.ok, res.body.persisted, res.body.created], [200, true, false, false]);
});

test('falhas do Google viram status e mensagem próprios, sem "ok" e sem vazar detalhes internos', async () => {
  const db = fakeDb({ order: eventOrder }).db;
  const status = async (code) => (await call(post(), { authorize: authorized, db, sync: async () => { throw new GoogleCalendarError(code); } }));
  for (const [code, expected] of [['not_configured', 503], ['auth', 502], ['permission', 502], ['calendar_not_found', 502], ['rate_limited', 429], ['unavailable', 503], ['invalid_order', 422]]) {
    const res = await status(code);
    assert.equal(res.statusCode, expected, code);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error.code, code);
  }
  const other = await call(post(), { authorize: authorized, db, sync: async () => { throw new Error('segredo abc123'); } });
  assert.equal(other.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(other.body), /abc123/);
});
