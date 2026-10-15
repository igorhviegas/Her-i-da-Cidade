import test from 'node:test';
import assert from 'node:assert/strict';
import { handleInstagramSync } from '../api/instagram-sync.ts';

const SECRET = 'cron-test-secret-0123456789';
const response = () => ({ statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const request = () => ({ method: 'GET', query: { job: 'missions' }, headers: { authorization: `Bearer ${SECRET}` } });
const call = async (deps) => { const res = response(); await handleInstagramSync(request(), res, { secret: SECRET, ...deps }); return res; };

test('cron de missões registra a execução e o backup mais recente (telemetria do cartão Saúde do sistema)', async () => {
  const records = [];
  const res = await call({
    runMissions: async () => ({ created: 1 }),
    record: async (job, info) => { records.push([job, info]); },
    backups: async ({ getToken }) => { assert.equal(typeof getToken, 'function'); return { latestAt: '2026-10-15T07:00:00.000Z', count: 7 }; },
  });
  assert.deepEqual([res.statusCode, res.body], [200, { ok: true, created: 1 }]);
  assert.deepEqual(records, [['missions', { ok: true }], ['backup', { ok: true, detail: null, extra: { latestAt: '2026-10-15T07:00:00.000Z', count: 7 } }]]);
});

test('falha da rotina é registrada (mensagem curta) e a resposta continua 500 genérica', async () => {
  const records = [];
  const res = await call({
    runMissions: async () => { throw new Error('x'.repeat(400)); },
    record: async (job, info) => { records.push([job, info]); },
    backups: async () => { throw new Error('não deveria checar backup depois de falha'); },
  });
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(res.body), /xxxx/);
  assert.equal(records.length, 1);
  assert.deepEqual([records[0][0], records[0][1].ok, records[0][1].detail.length], ['missions', false, 160]);
});

test('backup não verificável (permissão) vira registro "não verificado" e não derruba a rotina; falha ao registrar também não', async () => {
  const records = [];
  const denied = Object.assign(new Error('permission'), { code: 'permission' });
  const res = await call({ runMissions: async () => ({}), record: async (job, info) => { records.push([job, info]); }, backups: async () => { throw denied; } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(records[1], ['backup', { ok: false, detail: 'permission' }]);

  // Registrar a telemetria falhou (ex.: banco fora): a rotina continua 200 e a resposta é a mesma.
  const broken = await call({ runMissions: async () => ({ created: 2 }), record: async () => { throw new Error('banco fora'); }, backups: async () => ({ latestAt: null, count: 0 }) });
  assert.deepEqual([broken.statusCode, broken.body], [200, { ok: true, created: 2 }]);
});
