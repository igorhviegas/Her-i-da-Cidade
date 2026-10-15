import test from 'node:test';
import assert from 'node:assert/strict';
import { handleVideoCall } from '../api/video-call.ts';

const response = () => ({ statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const call = async (req, deps) => { const res = response(); await handleVideoCall(req, res, { database: {}, expire: async () => 0, ...deps }); return res; };
const post = (body, headers = {}) => ({ method: 'POST', body, headers });

test('sem segredo (recurso desligado) o POST segue como antes e o token nunca entra na reserva', async () => {
  const saved = process.env.TURNSTILE_SECRET_KEY;
  delete process.env.TURNSTILE_SECRET_KEY;
  try {
    let received;
    const res = await call(post({ name: 'Ana', turnstileToken: 'qualquer' }), { book: async ({ input }) => { received = input; return { orderId: 'o1' }; } });
    assert.deepEqual([res.statusCode, res.body.ok], [200, true]);
    assert.deepEqual(received, { name: 'Ana' });
  } finally { if (saved !== undefined) process.env.TURNSTILE_SECRET_KEY = saved; }
});

test('com captcha reprovado: 403 genérico e a reserva nem é tentada; com captcha aprovado: reserva normal', async () => {
  let booked = 0;
  const book = async () => { booked += 1; return { orderId: 'o1' }; };
  const seen = [];
  const deny = async (args) => { seen.push(args); return { ok: false, reason: 'invalid' }; };
  const blocked = await call(post({ name: 'Bot', turnstileToken: 't' }, { 'x-forwarded-for': '200.1.1.1, 10.0.0.1' }), { book, captcha: deny });
  assert.deepEqual([blocked.statusCode, blocked.body.error.code, booked], [403, 'captcha_failed', 0]);
  assert.equal(blocked.headers['cache-control'], 'no-store');
  assert.doesNotMatch(JSON.stringify(blocked.body), /invalid|segredo|secret/i);
  assert.deepEqual([seen[0].token, seen[0].ip], ['t', '200.1.1.1']);

  const allowed = await call(post({ name: 'Ana', turnstileToken: 't' }), { book, captcha: async () => ({ ok: true }) });
  assert.deepEqual([allowed.statusCode, allowed.body.ok, booked], [200, true, 1]);
});

test('o captcha vale só para o POST: a consulta de horários (GET) nunca o exige', async () => {
  let checked = 0;
  const res = await call({ method: 'GET' }, { availability: async () => ({ days: [], config: { texts: {}, priceLabel: 'R$ 75,00' } }), captcha: async () => { checked += 1; return { ok: false, reason: 'missing_token' }; } });
  assert.equal(res.statusCode, 200);
  assert.equal(checked, 0);
});
