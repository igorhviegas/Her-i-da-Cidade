import test from 'node:test';
import assert from 'node:assert/strict';
import { StatusCheckError, checkBackups, latestBackup, recordRun } from './system-status.js';

const fakeDb = () => { const writes = []; return { writes, collection: (c) => ({ doc: (id) => ({ set: async (data, opts) => { writes.push({ path: `${c}/${id}`, data, opts }); } }) }) }; };
const NOW = new Date('2026-10-15T03:00:00.000Z');

test('recordRun: grava a execução; sucesso marca lastOkAt, falha mantém o último sucesso (merge)', async () => {
  const db = fakeDb();
  await recordRun(db, 'missions', { ok: true, now: NOW });
  await recordRun(() => db, 'missions', { ok: false, detail: 'quebrou', now: NOW, extra: { n: 1 } });
  assert.deepEqual(db.writes[0], { path: 'systemStatus/missions', data: { job: 'missions', ok: true, lastRunAt: NOW.toISOString(), detail: null, lastOkAt: NOW.toISOString() }, opts: { merge: true } });
  assert.deepEqual(db.writes[1].data, { job: 'missions', ok: false, lastRunAt: NOW.toISOString(), detail: 'quebrou', n: 1 });
  assert.equal('lastOkAt' in db.writes[1].data, false);
});

test('recordRun nunca lança, mesmo sem banco ou com erro de escrita', async () => {
  await recordRun(() => { throw new Error('sem credencial'); }, 'x', { ok: true });
  await recordRun({ collection: () => ({ doc: () => ({ set: async () => { throw new Error('negado'); } }) }) }, 'x', { ok: true });
});

test('latestBackup: só prontos do banco (default); pega o mais recente e conta', () => {
  const body = { backups: [
    { database: 'projects/p/databases/(default)', snapshotTime: '2026-10-13T06:00:00Z', state: 'READY' },
    { database: 'projects/p/databases/(default)', snapshotTime: '2026-10-15T07:00:00Z', state: 'READY' },
    { database: 'projects/p/databases/(default)', snapshotTime: '2026-10-16T07:00:00Z', state: 'CREATING' },
    { database: 'projects/p/databases/restore-1', snapshotTime: '2026-10-17T07:00:00Z', state: 'READY' },
  ] };
  assert.deepEqual(latestBackup(body), { latestAt: '2026-10-15T07:00:00.000Z', count: 2 });
  assert.equal(latestBackup({}), null);
  assert.equal(latestBackup(null), null);
});

test('checkBackups: usa o token no header e o projeto na URL; 403 vira permission; falha de rede, unavailable', async () => {
  const seen = {};
  const getToken = async () => ({ token: 'tok', projectId: 'meu-proj' });
  const ok = (body) => async (url, init) => { seen.url = String(url); seen.auth = init.headers.Authorization; return { ok: true, status: 200, json: async () => body }; };
  const result = await checkBackups({ getToken, fetchImpl: ok({ backups: [{ database: 'projects/meu-proj/databases/(default)', snapshotTime: '2026-10-15T07:00:00Z', state: 'READY' }] }) });
  assert.deepEqual(result, { latestAt: '2026-10-15T07:00:00.000Z', count: 1 });
  assert.equal(seen.url, 'https://firestore.googleapis.com/v1/projects/meu-proj/locations/-/backups');
  assert.equal(seen.auth, 'Bearer tok');
  assert.deepEqual(await checkBackups({ getToken, fetchImpl: ok({}) }), { latestAt: null, count: 0 });
  await assert.rejects(checkBackups({ getToken, fetchImpl: async () => ({ ok: false, status: 403, json: async () => ({}) }) }), (e) => e instanceof StatusCheckError && e.code === 'permission');
  await assert.rejects(checkBackups({ getToken, fetchImpl: async () => ({ ok: false, status: 500, json: async () => ({}) }) }), (e) => e.code === 'unavailable');
  await assert.rejects(checkBackups({ getToken, fetchImpl: async () => { throw new Error('rede'); } }), (e) => e.code === 'unavailable');
  await assert.rejects(checkBackups({ getToken: async () => { throw new Error('sem credencial'); }, fetchImpl: ok({}) }), (e) => e.code === 'unavailable');
});
