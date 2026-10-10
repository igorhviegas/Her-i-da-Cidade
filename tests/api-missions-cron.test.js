import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleInstagramSync } from '../api/instagram-sync.ts';

const SECRET = 'cron-test-secret-0123456789';

function response() {
  return { statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const request = (overrides = {}) => ({ method: 'GET', query: { job: 'missions' }, headers: { authorization: `Bearer ${SECRET}` }, ...overrides });

test('cron: só aceita GET, exige CRON_SECRET configurado e credencial correta antes de rodar a rotina', async () => {
  let runs = 0;
  const run = async () => { runs += 1; return { created: 1, resolved: 0, notified: 2 }; };
  const call = async (req, deps) => { const res = response(); await handleInstagramSync(req, res, { runMissions: run, run: async () => { throw new Error('instagram não deveria rodar'); }, ...deps }); return res; };

  assert.equal((await call(request({ method: 'PUT' }), { secret: SECRET })).statusCode, 405);
  assert.equal((await call(request(), { secret: '' })).statusCode, 500); // segredo não configurado: nunca executa sem proteção
  assert.equal((await call(request({ headers: {} }), { secret: SECRET })).statusCode, 401);
  assert.equal((await call(request({ headers: { authorization: 'Bearer errado' } }), { secret: SECRET })).statusCode, 401);
  assert.equal((await call(request({ headers: { authorization: SECRET } }), { secret: SECRET })).statusCode, 401); // sem "Bearer "
  assert.equal(runs, 0);

  const ok = await call(request(), { secret: SECRET });
  assert.equal(ok.statusCode, 200);
  assert.deepEqual(ok.body, { ok: true, created: 1, resolved: 0, notified: 2 });
  assert.equal(ok.headers['cache-control'], 'no-store');
  assert.equal(runs, 1);
});

test('cron: falha da rotina devolve 500 genérico, sem vazar a mensagem do erro', async () => {
  const res = response();
  await handleInstagramSync(request(), res, { secret: SECRET, runMissions: async () => { throw new Error('credencial interna xyz'); } });
  assert.equal(res.statusCode, 500);
  assert.doesNotMatch(JSON.stringify(res.body), /xyz|credencial interna/);
});

test('vercel.json agenda /api/instagram-sync?job=missions uma vez por dia às 03:00 UTC (00:00 de Brasília) e mantém o rewrite do SPA', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(config.crons.some((c) => c.path === '/api/instagram-sync?job=missions' && c.schedule === '0 3 * * *'));
  assert.ok(config.rewrites.some((r) => r.destination === '/index.html'));
  assert.match(config.rewrites[0].source, /\(\?!api\/\.\*\)/); // /api/* não cai no SPA
});

test('nenhum arquivo de api/ importa outro arquivo de api/ (na Vercel a função falha ao carregar: FUNCTION_INVOCATION_FAILED)', async () => {
  const { readdir } = await import('node:fs/promises');
  const dir = new URL('../api/', import.meta.url);
  for (const file of (await readdir(dir)).filter((name) => name.endsWith('.ts'))) {
    assert.doesNotMatch(await readFile(new URL(file, dir), 'utf8'), /from '\.\/[^']+'/, `${file} importa um irmão de api/`);
  }
});
