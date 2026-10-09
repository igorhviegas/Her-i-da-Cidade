import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInstagramAlerts } from './instagram-alerts.js';

const NOW = new Date('2026-10-10T12:00:00Z');
const day = (n) => new Date(NOW.getTime() + n * 86_400_000).toISOString();
const healthy = { syncedAt: day(-0.25), lastAttemptAt: day(-0.25), lastError: null, tokenExpiresAt: day(45) };
const ids = (profile) => buildInstagramAlerts(profile, NOW).map((a) => a.id);

test('integração saudável (token com folga, sincronização recente) não gera aviso; sem perfil também não', () => {
  assert.deepEqual(ids(healthy), []);
  assert.deepEqual(ids(undefined), []);
  assert.deepEqual(ids({}), []);
  assert.deepEqual(ids({ tokenExpiresAt: 'lixo', syncedAt: 'lixo', lastAttemptAt: 'lixo' }), []);
});

test('token com 15 dias ou menos avisa (renovação falhando); com 16 não; expirado deixa para o aviso de token inválido', () => {
  const [alert] = buildInstagramAlerts({ ...healthy, tokenExpiresAt: day(10.5) }, NOW);
  assert.deepEqual([alert.id, alert.type, alert.refType], ['instagram_token_expiring_2026-10-20', 'instagram_token_expiring', 'instagram']);
  assert.match(alert.body, /Expira em 10 dias/);
  assert.match(buildInstagramAlerts({ ...healthy, tokenExpiresAt: day(1.2) }, NOW)[0].body, /Expira em 1 dia /);
  assert.equal(ids({ ...healthy, tokenExpiresAt: day(15.5) }).length, 1);
  assert.equal(ids({ ...healthy, tokenExpiresAt: day(16.5) }).length, 0);
  assert.equal(ids({ ...healthy, tokenExpiresAt: day(-1) }).length, 0);
});

test('token inválido avisa na hora; outros erros passageiros sozinhos não avisam', () => {
  const invalid = { ...healthy, lastAttemptAt: day(-0.1), lastError: { code: 'token_invalid', message: 'O token expirou.' } };
  assert.deepEqual(buildInstagramAlerts(invalid, NOW).map((a) => [a.id, a.body]), [['instagram_token_invalid_2026-10-10', 'O token expirou.']]);
  for (const code of ['rate_limited', 'unavailable', 'api_error']) assert.deepEqual(ids({ ...healthy, lastError: { code, message: 'x' } }), []);
});

test('3 dias sem sincronizar com sucesso avisa uma vez por episódio (id pelo último sucesso) e cita o último erro', () => {
  const stale = { ...healthy, syncedAt: day(-4), lastError: { code: 'unavailable', message: 'Instagram fora do ar.' } };
  const [alert] = buildInstagramAlerts(stale, NOW);
  assert.equal(alert.id, 'instagram_stale_2026-10-06');
  assert.match(alert.body, /06\/10.*Instagram fora do ar\./);
  assert.deepEqual(ids({ ...stale, syncedAt: day(-2) }), []);
  assert.deepEqual(ids(stale), ids({ ...stale, lastAttemptAt: day(-0.01) })); // novas tentativas falhas não mudam o id
});
