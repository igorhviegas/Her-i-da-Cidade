import test from 'node:test';
import assert from 'node:assert/strict';
import { clientIp, verifyTurnstile } from './turnstile.js';

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const never = async () => { throw new Error('não deveria chamar o Cloudflare'); };

test('sem segredo configurado o recurso está desligado: passa sem chamar o Cloudflare', async () => {
  assert.deepEqual(await verifyTurnstile({ token: '', secret: '', fetchImpl: never }), { ok: true, skipped: true });
  assert.deepEqual(await verifyTurnstile({ token: 'x', secret: undefined, fetchImpl: never }), { ok: true, skipped: true });
});

test('com segredo: token ausente, vazio ou enorme bloqueia sem chamar o Cloudflare', async () => {
  for (const token of [undefined, null, '', '   ', 123, 'a'.repeat(3000)]) {
    assert.deepEqual(await verifyTurnstile({ token, secret: 's', fetchImpl: never }), { ok: false, reason: 'missing_token' });
  }
});

test('token válido passa; token recusado bloqueia e traz os códigos; segredo e IP vão no corpo do POST', async () => {
  let seen;
  const fetchImpl = async (url, init) => { seen = { url, body: init.body.toString(), method: init.method }; return { ok: true, status: 200, json: async () => ({ success: true }) }; };
  assert.deepEqual(await verifyTurnstile({ token: 'tok', secret: 'seg', ip: '1.2.3.4', fetchImpl }), { ok: true });
  assert.equal(seen.url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
  assert.equal(seen.method, 'POST');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(seen.body)), { secret: 'seg', response: 'tok', remoteip: '1.2.3.4' });

  const denied = await verifyTurnstile({ token: 'tok', secret: 'seg', fetchImpl: reply(200, { success: false, 'error-codes': ['invalid-input-response'] }) });
  assert.deepEqual(denied, { ok: false, reason: 'invalid', codes: ['invalid-input-response'] });
  assert.deepEqual(await verifyTurnstile({ token: 'tok', secret: 'seg', fetchImpl: reply(200, null) }), { ok: false, reason: 'invalid', codes: [] });
});

test('Cloudflare fora do ar ou rede com falha: passa (disponibilidade), marcado como indisponível', async () => {
  assert.deepEqual(await verifyTurnstile({ token: 't', secret: 's', fetchImpl: reply(500, {}) }), { ok: true, skipped: true, unavailable: true });
  assert.deepEqual(await verifyTurnstile({ token: 't', secret: 's', fetchImpl: async () => { throw new Error('rede'); } }), { ok: true, skipped: true, unavailable: true });
});

test('clientIp: primeiro IP de x-forwarded-for, com fallback para x-real-ip', () => {
  assert.equal(clientIp({ 'x-forwarded-for': '200.1.1.1, 10.0.0.1' }), '200.1.1.1');
  assert.equal(clientIp({ 'x-forwarded-for': ['200.1.1.2'] }), '200.1.1.2');
  assert.equal(clientIp({ 'x-real-ip': '200.1.1.3' }), '200.1.1.3');
  assert.equal(clientIp({}), '');
  assert.equal(clientIp(), '');
});
