import test from 'node:test';
import assert from 'node:assert/strict';
import { handleFitIngest } from '../api/fit-ingest.ts';

const TOKEN = 'fit-test-token-0123456789';
const UID = 'ownerUid123';

function response() {
  return { statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
function fakeDatabase(failure) {
  const paths = [];
  return {
    paths,
    collection: (c) => ({ doc: (id) => ({ collection: (sub) => ({ doc: (day) => ({ path: `${c}/${id}/${sub}/${day}` }) }) }) }),
    batch: () => ({ set: (ref) => paths.push(ref.path), commit: async () => { if (failure) throw new Error(failure); } }),
  };
}
const body = { data: { metrics: [{ name: 'step_count', units: 'count', data: [{ date: '2026-10-01 00:00:00 -0300', qty: 5000, source: 'iPhone' }] }] } };
const request = (overrides = {}) => ({ method: 'POST', headers: { authorization: `Bearer ${TOKEN}` }, body, ...overrides });
const call = async (req, deps = {}) => { const res = response(); await handleFitIngest(req, res, { token: TOKEN, ownerUid: UID, database: fakeDatabase(), ...deps }); return res; };

test('fit-ingest: só POST, exige configuração e credencial correta antes de gravar', async () => {
  const database = fakeDatabase();
  assert.equal((await call(request({ method: 'GET' }), { database })).statusCode, 405);
  assert.equal((await call(request(), { database, token: '' })).statusCode, 500); // sem segredo configurado nunca aceita
  assert.equal((await call(request(), { database, ownerUid: '' })).statusCode, 500);
  assert.equal((await call(request(), { database, ownerUid: 'a/b' })).statusCode, 500); // uid vira caminho: sem "/"
  assert.equal((await call(request({ headers: {} }), { database })).statusCode, 401);
  assert.equal((await call(request({ headers: { authorization: 'Bearer errado' } }), { database })).statusCode, 401);
  assert.equal((await call(request({ headers: { authorization: TOKEN } }), { database })).statusCode, 401); // sem "Bearer "
  assert.deepEqual(database.paths, []);
});

test('fit-ingest: payload inválido é 400 e não grava', async () => {
  const database = fakeDatabase();
  assert.equal((await call(request({ body: { foo: 1 } }), { database })).statusCode, 400);
  assert.equal((await call(request({ body: '{não é json' }), { database })).statusCode, 400);
  assert.deepEqual(database.paths, []);
});

test('fit-ingest: grava só sob users/{uid do servidor}, mesmo que o payload tente indicar outro dono; corpo em texto também vale', async () => {
  const database = fakeDatabase();
  const hostile = { ...body, uid: 'outroUsuario', ownerUid: 'outroUsuario', path: 'users/outroUsuario/fitDaily/x' };
  const res = await call(request({ body: JSON.stringify(hostile) }), { database });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(database.paths, [`users/${UID}/fitDaily/2026-10-01`]);
  assert.deepEqual(res.body, { ok: true, days: 1, accepted: 1, ignoredMetrics: 0, invalid: 0, workoutsIgnored: 0 });
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(res.body), /5000|2026-10-01/); // a resposta não devolve dado de saúde
});

test('fit-ingest: envio simples de um dia (Atalho do iPhone) grava no mesmo caminho e responde só contagens', async () => {
  const database = fakeDatabase();
  const res = await call(request({ body: { day: '2026-10-07', steps: '2431', walkRunKm: '1,8', weightKg: 72, uid: 'outroUsuario' } }), { database });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(database.paths, [`users/${UID}/fitDaily/2026-10-07`]);
  assert.deepEqual(res.body, { ok: true, days: 1, accepted: 3, ignoredMetrics: 1, invalid: 0, workoutsIgnored: 0 });
});

test('fit-ingest: falha ao gravar devolve 500 genérico, sem vazar a mensagem do erro', async () => {
  const res = await call(request(), { database: fakeDatabase('detalhe interno xyz') });
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(res.body), /xyz|detalhe interno/);
});
