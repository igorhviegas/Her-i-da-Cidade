import test from 'node:test';
import assert from 'node:assert/strict';
import { agoLabel, buildHealth } from './systemHealth.js';

const NOW = Date.parse('2026-10-15T12:00:00.000Z');
const ago = (hours) => new Date(NOW - hours * 3_600_000).toISOString();
const levels = (result) => Object.fromEntries(result.rows.map((r) => [r.id, r.level]));
const healthyInstagram = { syncedAt: ago(6), lastError: null, tokenExpiresAt: new Date(NOW + 40 * 86_400_000).toISOString() };

test('agoLabel: minutos, horas e dias', () => {
  assert.equal(agoLabel(10_000), 'agora há pouco');
  assert.equal(agoLabel(20 * 60_000), 'há 20 min');
  assert.equal(agoLabel(5 * 3_600_000), 'há 5 h');
  assert.equal(agoLabel(47 * 3_600_000), 'há 47 h');
  assert.equal(agoLabel(72 * 3_600_000), 'há 3 dias');
});

test('tudo em dia: nível geral ok', () => {
  const r = buildHealth({
    now: NOW, instagram: healthyInstagram, reviewsOk: true,
    status: { missions: { ok: true, lastRunAt: ago(9) }, backup: { ok: true, latestAt: ago(5), count: 7 } },
  });
  assert.deepEqual(levels(r), { missions: 'ok', instagram: 'ok', token: 'ok', backup: 'ok', reviews: 'ok' });
  assert.equal(r.overall, 'ok');
  assert.match(r.rows.find((x) => x.id === 'backup').detail, /há 5 h · 7 guardados/);
});

test('rotina atrasada: 36 h vira atenção, 72 h vira erro; falha registrada é erro com o motivo', () => {
  const run = (hours) => buildHealth({ now: NOW, status: { missions: { ok: true, lastRunAt: ago(hours) } } });
  assert.equal(levels(run(30)).missions, 'ok');
  assert.equal(levels(run(40)).missions, 'warn');
  assert.equal(levels(run(80)).missions, 'error');
  const failed = buildHealth({ now: NOW, status: { missions: { ok: false, lastRunAt: ago(2), detail: 'quebrou' } } });
  assert.deepEqual([levels(failed).missions, failed.rows[0].detail], ['error', 'Falhou há 2 h: quebrou']);
});

test('Instagram: erro de token e sincronização parada; validade do token por faixas', () => {
  const token = (days) => buildHealth({ now: NOW, instagram: { ...healthyInstagram, tokenExpiresAt: new Date(NOW + days * 86_400_000).toISOString() } }).rows.find((r) => r.id === 'token');
  assert.deepEqual([token(40).level, token(10).level, token(2).level, token(-1).level], ['ok', 'warn', 'error', 'error']);
  assert.equal(token(1).detail, 'Vale por mais 1 dia');
  const invalid = buildHealth({ now: NOW, instagram: { ...healthyInstagram, lastError: { code: 'token_invalid' } } });
  assert.equal(levels(invalid).instagram, 'error');
  const stale = buildHealth({ now: NOW, instagram: { ...healthyInstagram, syncedAt: ago(50) } });
  assert.equal(levels(stale).instagram, 'warn');
  assert.equal(levels(buildHealth({ now: NOW, instagram: null })).instagram, 'unknown');
});

test('backup: permissão negada vira "não verificado" (não é erro); sem cópias é erro; velho é atraso', () => {
  const backup = (doc) => buildHealth({ now: NOW, status: { backup: doc } }).rows.find((r) => r.id === 'backup');
  assert.equal(backup({ ok: false, detail: 'permission' }).level, 'unknown');
  assert.equal(backup({ ok: false, detail: 'unavailable' }).level, 'unknown');
  assert.equal(backup({ ok: false, detail: 'sem backups' }).level, 'error');
  assert.equal(backup({ ok: true, latestAt: ago(40) }).level, 'warn');
  assert.equal(backup({ ok: true, latestAt: ago(100) }).level, 'error');
  assert.equal(backup(undefined).level, 'unknown');
});

test('avaliações e nível geral: pior nível conhecido; "sem informação" não pesa', () => {
  assert.equal(buildHealth({ now: NOW, reviewsOk: false }).rows.find((r) => r.id === 'reviews').level, 'warn');
  assert.equal(buildHealth({ now: NOW }).overall, 'unknown');
  const mixed = buildHealth({ now: NOW, reviewsOk: false, status: { missions: { ok: false, lastRunAt: ago(1) } } });
  assert.equal(mixed.overall, 'error');
  assert.equal(buildHealth({ now: NOW, reviewsOk: true }).overall, 'ok');
});
