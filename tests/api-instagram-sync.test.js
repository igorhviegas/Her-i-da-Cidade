import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { handleInstagramSync } from '../api/instagram-sync.ts';
import { runInstagramSync, InstagramSyncError } from '../functions/instagram-sync.js';
import { currentPosts } from '../services/instagramMetrics.js';

const SECRET = 'cron-test-secret-0123456789';
const response = () => ({ statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const call = async (req, deps) => { const res = response(); await handleInstagramSync(req, res, deps); return res; };

test('handler: GET exige CRON_SECRET; POST exige administrador; outros métodos 405', async () => {
  let runs = 0; const run = async () => { runs += 1; return { status: 'completed', posts: 1 }; };
  assert.equal((await call({ method: 'PUT', headers: {} }, { run })).statusCode, 405);
  assert.equal((await call({ method: 'GET', headers: {} }, { secret: '', run })).statusCode, 500);
  assert.equal((await call({ method: 'GET', headers: {} }, { secret: SECRET, run })).statusCode, 401);
  assert.equal((await call({ method: 'GET', headers: { authorization: 'Bearer errado' } }, { secret: SECRET, run })).statusCode, 401);
  assert.equal((await call({ method: 'POST', headers: { authorization: `Bearer ${SECRET}` } }, { run, authorize: async () => 'unauthenticated' })).statusCode, 401);
  assert.equal((await call({ method: 'POST', headers: {} }, { run, authorize: async () => 'forbidden' })).statusCode, 403);
  assert.equal((await call({ method: 'POST', headers: {} }, { run, authorize: async () => { throw new Error('x'); } })).statusCode, 503);
  assert.equal(runs, 0);
  const cron = await call({ method: 'GET', headers: { authorization: `Bearer ${SECRET}` } }, { secret: SECRET, run });
  assert.deepEqual([cron.statusCode, cron.body], [200, { ok: true, status: 'completed', posts: 1 }]);
  assert.equal((await call({ method: 'POST', headers: {} }, { run, authorize: async () => 'authorized' })).statusCode, 200);
  assert.equal(runs, 2);
});

test('handler: erro da integração vira código/mensagem próprios, sem vazar detalhes internos', async () => {
  const expired = await call({ method: 'POST', headers: {} }, { authorize: async () => 'authorized', run: async () => { throw new InstagramSyncError('token_invalid'); } });
  assert.equal(expired.statusCode, 502); assert.equal(expired.body.error.code, 'token_invalid');
  const other = await call({ method: 'POST', headers: {} }, { authorize: async () => 'authorized', run: async () => { throw new Error('segredo abc123'); } });
  assert.equal(other.statusCode, 500); assert.doesNotMatch(JSON.stringify(other.body), /abc123/);
});

// --- núcleo da sincronização com db e fetch simulados (a API real da Meta NÃO foi exercitada) ---
function fakeDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const ref = (path) => ({ path, get: async () => ({ exists: store.has(path), data: () => store.get(path) }), set: async (d, o) => { store.set(path, o?.merge ? { ...store.get(path), ...d } : d); } });
  let queue = Promise.resolve(); // transações serializadas, como o isolamento do Firestore
  const runTransaction = (fn) => {
    const run = queue.then(async () => {
      const writes = [];
      const result = await fn({ get: (r) => r.get(), set: (r, d, o) => writes.push([r, d, o]) });
      for (const [r, d, o] of writes) await r.set(d, o);
      return result;
    });
    queue = run.catch(() => undefined);
    return run;
  };
  return { store, doc: ref, runTransaction, batch: () => { const ops = []; return { set: (r, d) => ops.push([r, d]), commit: async () => { for (const [r, d] of ops) await r.set(d); } }; } };
}
const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
const metaError = (code, status = 400) => json({ error: { code, message: 'x' } }, status);
const REEL = { id: '1', media_type: 'VIDEO', media_product_type: 'REELS', thumbnail_url: 't1', timestamp: '2026-01-02T00:00:00+0000', like_count: 10, comments_count: 2 };
const IMG = { id: '2', media_type: 'IMAGE', media_url: 'u2', timestamp: '2026-01-01T00:00:00+0000', comments_count: 1 };
const views = (value) => json({ data: [{ values: [{ value }] }] });

/** insight(id) devolve a resposta do endpoint de insights; refresh devolve a resposta da renovação do token. */
function fakeFetch({ media = [REEL, IMG], insight = () => views(123), refresh = () => json({ access_token: 'renovado', expires_in: 5184000 }), error, delay = 0, followers = 1500 } = {}) {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (error) return metaError(error.code, error.status);
    if (url.includes('refresh_access_token')) return refresh();
    if (url.includes('/me/media')) return json({ data: media });
    if (url.includes('/me?')) return json({ username: 'heroi', followers_count: followers, media_count: 40 });
    return insight(url.match(/\/(\d+)\/insights/)[1]);
  };
  return { impl, calls };
}
const env = { INSTAGRAM_ACCESS_TOKEN: 'tok' };
const T0 = Date.parse('2026-02-01T12:00:00Z');
const DAY = 86_400_000;
const run = (db, fetchImpl, extra = {}) => runInstagramSync({ db, fetchImpl, env, now: T0, ...extra });

test('sync: grava perfil e publicações; token renovado é guardado com a validade; sem views fica null', async () => {
  const db = fakeDb(); const { impl, calls } = fakeFetch({ insight: (id) => (id === '2' ? metaError(100) : views(123)) });
  assert.deepEqual(await run(db, impl), { status: 'completed', posts: 2, warning: null });
  assert.equal(db.store.get('instagramPosts/1').views, 123);
  assert.equal(db.store.get('instagramPosts/1').kind, 'reel');
  assert.equal(db.store.get('instagramPosts/1').publishedAt, '2026-01-02T00:00:00.000Z');
  assert.equal(db.store.get('instagramPosts/2').views, null); // 400/código 100: a Meta disse que não existe
  assert.equal(db.store.get('instagramPosts/2').likes, null);
  const profile = db.store.get('instagramMeta/profile');
  assert.equal(profile.followers, 1500); assert.equal(profile.lastError, null); assert.equal(profile.warning, null);
  assert.equal(profile.syncedAt, '2026-02-01T12:00:00.000Z');
  assert.equal(profile.tokenExpiresAt, new Date(T0 + 5184000 * 1000).toISOString());
  assert.equal(db.store.get('instagramPrivate/token').accessToken, 'renovado');
  assert.ok(calls.some((u) => u.includes('access_token=renovado')));
  assert.equal(db.store.get('instagramPrivate/lock').until, 0); // reserva liberada
});

test('concorrência: duas sincronizações simultâneas — só uma executa; a outra recebe "running"', async () => {
  const db = fakeDb(); const slow = fakeFetch({ delay: 5 });
  const [a, b] = await Promise.all([run(db, slow.impl), run(db, slow.impl, { manual: true })]);
  assert.deepEqual([a.status, b.status].sort(), ['completed', 'running']);
  assert.equal(slow.calls.filter((u) => u.includes('/me?')).length, 1); // /me chamado uma vez só
  assert.equal(db.store.get('instagramPrivate/lock').until, 0);
  assert.equal((await run(db, fakeFetch().impl, { now: T0 + 1000 })).status, 'completed'); // depois de liberada, o cron volta a rodar
});

test('concorrência: reserva vigente bloqueia sem chamar a Meta; reserva expirada é retomada; falha também libera', async () => {
  const held = fakeDb({ 'instagramPrivate/lock': { until: T0 + 60_000, by: 'outra' } }); const probe = fakeFetch();
  assert.deepEqual(await run(held, probe.impl), { status: 'running' });
  assert.equal(probe.calls.length, 0);
  assert.equal(held.store.get('instagramPrivate/lock').by, 'outra'); // não libera reserva alheia

  const expired = fakeDb({ 'instagramPrivate/lock': { until: T0 - 1, by: 'morta' } }); // execução anterior interrompida
  assert.equal((await run(expired, fakeFetch().impl)).status, 'completed');

  const failing = fakeDb();
  await assert.rejects(run(failing, fakeFetch({ error: { code: 190 } }).impl), { code: 'token_invalid' });
  assert.equal(failing.store.get('instagramPrivate/lock').until, 0);
});

test('intervalo mínimo manual: distingue "recém-concluída" de "recém-falhou"; nova tentativa após a falha funciona', async () => {
  const db = fakeDb(); const probe = fakeFetch();
  await assert.rejects(run(db, fakeFetch({ error: { code: 190 } }).impl, { manual: true }), { code: 'token_invalid' });
  assert.deepEqual(await run(db, probe.impl, { manual: true, now: T0 + 5000 }), { status: 'cooldown', afterFailure: true });
  assert.equal(probe.calls.length, 0);
  assert.equal(db.store.get('instagramMeta/profile').syncedAt, undefined); // tentativa falha não vira "sincronização"
  assert.equal((await run(db, fakeFetch().impl, { manual: true, now: T0 + 61_000 })).status, 'completed');
  assert.equal(db.store.get('instagramMeta/profile').lastError, null);
  assert.deepEqual(await run(db, probe.impl, { manual: true, now: T0 + 62_000 }), { status: 'cooldown', afterFailure: false });
  assert.equal((await run(db, fakeFetch().impl, { now: T0 + 62_000 })).status, 'completed'); // o cron ignora o intervalo manual
});

test('espelho: publicações fora das últimas retornadas ficam no banco, mas fora do conjunto atual', async () => {
  const db = fakeDb();
  await run(db, fakeFetch({ media: [REEL, IMG] }).impl);
  await run(db, fakeFetch({ media: [IMG, { ...IMG, id: '3' }] }).impl, { now: T0 + DAY });
  const all = [...db.store].filter(([k]) => k.startsWith('instagramPosts/')).map(([, v]) => v);
  assert.equal(all.length, 3); // nada foi apagado e nada duplicou
  const syncedAt = db.store.get('instagramMeta/profile').syncedAt;
  assert.deepEqual(currentPosts(all, syncedAt).map((p) => p.id).sort(), ['2', '3']);
});

test('insights: falha transitória preserva o valor anterior (desatualizado) e avisa; limite de requisições aborta sem gravar', async () => {
  const db = fakeDb();
  await run(db, fakeFetch().impl); // views = 123 nas duas
  const next = await run(db, fakeFetch({ insight: (id) => (id === '1' ? metaError(1, 500) : views(200)) }).impl, { now: T0 + DAY });
  assert.equal(next.warning, 'insights_partial');
  assert.equal(db.store.get('instagramPosts/1').views, 123);
  assert.equal(db.store.get('instagramPosts/1').viewsStale, true);
  assert.equal(db.store.get('instagramPosts/2').views, 200);
  assert.equal(db.store.get('instagramPosts/2').viewsStale, false);
  assert.deepEqual(db.store.get('instagramMeta/profile').insights, { total: 2, ok: 1, unsupported: 0, permission: 0, transient: 1 });

  const okAt = db.store.get('instagramMeta/profile').syncedAt;
  await assert.rejects(run(db, fakeFetch({ insight: () => metaError(4) }).impl, { now: T0 + 2 * DAY }), { code: 'rate_limited' });
  assert.equal(db.store.get('instagramPosts/1').views, 123); // dados válidos anteriores intactos
  assert.equal(db.store.get('instagramMeta/profile').lastError.code, 'rate_limited');
  assert.equal(db.store.get('instagramMeta/profile').syncedAt, okAt);
});

test('insights: indisponibilidade geral, falta de permissão e ausência legítima geram avisos distintos', async () => {
  const seed = async () => { const db = fakeDb(); await run(db, fakeFetch().impl); return db; };
  const later = { now: T0 + DAY };

  let db = await seed();
  assert.equal((await run(db, fakeFetch({ insight: () => metaError(2, 503) }).impl, later)).warning, 'insights_unavailable');
  assert.equal(db.store.get('instagramPosts/1').views, 123); // preservado, não virou "sem dado"

  db = await seed();
  assert.equal((await run(db, fakeFetch({ insight: () => metaError(10) }).impl, later)).warning, 'insights_permission');
  assert.equal(db.store.get('instagramPosts/2').views, 123);
  assert.equal(db.store.get('instagramPosts/2').viewsStale, true);
  assert.match(db.store.get('instagramMeta/profile').warning.message, /instagram_business_manage_insights/);
  assert.equal((await run(await seed(), fakeFetch({ insight: () => metaError(200) }).impl, later)).warning, 'insights_permission');

  db = await seed();
  assert.equal((await run(db, fakeFetch({ insight: () => metaError(100) }).impl, later)).warning, 'insights_unsupported');
  assert.equal(db.store.get('instagramPosts/1').views, null); // evidência de ausência: aí sim null
  assert.equal((await run(db, fakeFetch().impl, { now: T0 + 2 * DAY })).warning, null); // aviso some quando normaliza
  assert.equal(db.store.get('instagramMeta/profile').warning, null);
});

test('erros principais: permissão negada tem código próprio; token inválido não apaga dados; sem token não chama a API', async () => {
  const db = fakeDb({ 'instagramMeta/profile': { followers: 9, syncedAt: 'antes' } });
  await assert.rejects(run(db, fakeFetch({ error: { code: 10 } }).impl), { code: 'permission' });
  await assert.rejects(run(db, fakeFetch({ error: { code: 190 } }).impl), { code: 'token_invalid' });
  assert.equal(db.store.get('instagramMeta/profile').followers, 9);
  assert.equal(db.store.get('instagramMeta/profile').lastError.code, 'token_invalid');
  const none = fakeFetch();
  await assert.rejects(runInstagramSync({ db: fakeDb(), env: {}, fetchImpl: none.impl, now: T0 }), { code: 'not_configured' });
  assert.equal(none.calls.length, 0);
  await assert.rejects(run(fakeDb(), fakeFetch({ error: { code: 1, status: 503 } }).impl), { code: 'unavailable' });
  await assert.rejects(run(fakeDb(), async () => { throw new Error('rede'); }), { code: 'unavailable' });
});

test('token: renovação com resposta incompleta ou com erro mantém o token atual e não grava undefined', async () => {
  for (const refresh of [() => json({}), () => json({ access_token: '' }), () => metaError(1, 500), () => metaError(190)]) {
    const db = fakeDb(); const f = fakeFetch({ refresh });
    assert.equal((await run(db, f.impl)).status, 'completed');
    assert.ok(f.calls.filter((u) => u.includes('/me?')).every((u) => u.includes('access_token=tok')));
    assert.equal(db.store.has('instagramPrivate/token'), false); // nada gravado: o token do ambiente continua valendo
    assert.equal(db.store.get('instagramMeta/profile').tokenExpiresAt, null);
  }
  // token já renovado e recente: não renova de novo e reutiliza o salvo
  const db = fakeDb({ 'instagramPrivate/token': { accessToken: 'salvo', envToken: 'tok', refreshedAt: T0 - 1000, expiresAt: T0 + DAY } });
  const f = fakeFetch();
  await run(db, f.impl);
  assert.ok(!f.calls.some((u) => u.includes('refresh_access_token')));
  assert.ok(f.calls.some((u) => u.includes('access_token=salvo')));
  assert.equal(db.store.get('instagramMeta/profile').tokenExpiresAt, new Date(T0 + DAY).toISOString());
});

test('vercel.json agenda o cron do Instagram e mantém o de missões', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(config.crons.some((c) => c.path === '/api/instagram-sync' && c.schedule === '0 9 * * *'));
  assert.ok(config.crons.some((c) => c.path === '/api/missions-cron'));
});

test('admin-auth: valida ID token e o documento admins/{uid} (fetch simulado)', async () => {
  const { authorizeAdminRequest } = await import('../functions/admin-auth.js');
  const env = { FIREBASE_PROJECT_ID: 'p', FIREBASE_API_KEY: 'k' };
  const original = globalThis.fetch;
  const answer = (lookup, adminDoc) => { globalThis.fetch = async (url) => (String(url).includes('accounts:lookup') ? lookup : adminDoc); };
  const req = { headers: { authorization: 'Bearer tok' } };
  try {
    assert.equal(await authorizeAdminRequest({ headers: {} }, env), 'unauthenticated');
    answer({ ok: false, status: 400 }, null);
    assert.equal(await authorizeAdminRequest(req, env), 'unauthenticated');
    answer({ ok: true, status: 200, json: async () => ({ users: [{ localId: 'u1' }] }) }, { ok: false, status: 404 });
    assert.equal(await authorizeAdminRequest(req, env), 'forbidden');
    answer({ ok: true, status: 200, json: async () => ({ users: [{ localId: 'u1' }] }) }, { ok: true, status: 200 });
    assert.equal(await authorizeAdminRequest(req, env), 'authorized');
    answer({ ok: false, status: 500 }, null);
    await assert.rejects(authorizeAdminRequest(req, env));
    await assert.rejects(authorizeAdminRequest(req, {})); // sem configuração: erro (vira 503), nunca "authorized"
  } finally { globalThis.fetch = original; }
});

test('api/instagram-sync.ts não importa outro arquivo de api/ (na Vercel isso derruba a função ao carregar)', async () => {
  const source = await readFile(new URL('../api/instagram-sync.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from '\.\/[^']+'/);
});

// --- balanço diário (integração com a sincronização) ---
const D1 = Date.parse('2026-03-10T03:30:00Z'); // 00:30 em Brasília
const likesOf = (n) => ({ ...REEL, like_count: n });

test('balanço diário: referência no 1º sync do dia, saldo nos seguintes, sem duplicar em sincronizações repetidas', async () => {
  const db = fakeDb();
  await run(db, fakeFetch({ followers: 1000, media: [likesOf(10)], insight: () => views(100) }).impl, { now: D1 });
  assert.deepEqual([db.store.get('instagramMeta/profile').daily.followers, db.store.get('instagramMeta/profile').daily.likes], [0, 0]);
  const again = () => run(db, fakeFetch({ followers: 1125, media: [likesOf(40)], insight: () => views(160) }).impl, { now: D1 + 6 * 3600_000 });
  await again(); await again();
  const daily = db.store.get('instagramMeta/profile').daily;
  assert.deepEqual([daily.followers, daily.likes, daily.views, daily.day], [125, 30, 60, '2026-03-10']);
  assert.equal(db.store.get('instagramPrivate/daily').followers0, 1000); // referência intacta
  assert.equal(db.store.get('instagramPosts/1').likes, 40); // totais absolutos continuam sendo o valor atual
});

test('balanço diário: sincronização que falha não altera referências nem o saldo válido', async () => {
  const db = fakeDb();
  await run(db, fakeFetch({ followers: 1000, media: [likesOf(10)] }).impl, { now: D1 });
  await run(db, fakeFetch({ followers: 1050, media: [likesOf(20)] }).impl, { now: D1 + 3600_000 });
  const before = JSON.stringify([db.store.get('instagramMeta/profile').daily, db.store.get('instagramPrivate/daily')]);
  await assert.rejects(run(db, fakeFetch({ error: { code: 190 } }).impl, { now: D1 + 7200_000 }), { code: 'token_invalid' });
  await assert.rejects(run(db, fakeFetch({ insight: () => metaError(4) }).impl, { now: D1 + 7200_000 }), { code: 'rate_limited' });
  assert.equal(JSON.stringify([db.store.get('instagramMeta/profile').daily, db.store.get('instagramPrivate/daily')]), before);
  assert.equal(db.store.get('instagramMeta/profile').daily.followers, 50);
});

test('balanço diário: virada do dia em Brasília zera o saldo no 1º sync seguinte, mesmo sem cron à meia-noite', async () => {
  const db = fakeDb();
  await run(db, fakeFetch({ followers: 1000, media: [likesOf(10)] }).impl, { now: D1 });
  await run(db, fakeFetch({ followers: 1100, media: [likesOf(30)] }).impl, { now: Date.parse('2026-03-11T02:55:00Z') }); // 23:55 de 10/03
  assert.equal(db.store.get('instagramMeta/profile').daily.followers, 100);
  await run(db, fakeFetch({ followers: 1110, media: [likesOf(35)] }).impl, { now: Date.parse('2026-03-11T12:00:00Z') }); // 09:00 de 11/03 (cron não rodou)
  const daily = db.store.get('instagramMeta/profile').daily;
  assert.deepEqual([daily.day, daily.followers, daily.likes], ['2026-03-11', 0, 0]);
  await run(db, fakeFetch({ followers: 1112, media: [likesOf(36)] }).impl, { now: Date.parse('2026-03-11T15:00:00Z') });
  assert.deepEqual([db.store.get('instagramMeta/profile').daily.followers, db.store.get('instagramMeta/profile').daily.likes], [2, 1]);
});

test('vercel.json: sincronização à meia-noite de Brasília (03:00 UTC) além da das 09:00 UTC; missões intactas', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  const schedules = config.crons.filter((c) => c.path === '/api/instagram-sync').map((c) => c.schedule).sort();
  assert.deepEqual(schedules, ['0 3 * * *', '0 9 * * *']);
  assert.ok(config.crons.some((c) => c.path === '/api/missions-cron' && c.schedule === '0 3 * * *'));
});

test('Principal: widget do Instagram só lê o Firestore; o aviso "Em preparação" foi removido; demais widgets preservados', async () => {
  const home = await readFile(new URL('../components/admin/AdminHomePage.tsx', import.meta.url), 'utf8');
  const dashboard = await readFile(new URL('../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
  assert.match(home, /<InstagramWidget /);
  assert.match(home, /subscribeInstagramProfile/);
  assert.doesNotMatch(home, /graph\.instagram|fetch\(|api\/instagram-sync/); // nada de Meta nem de sync no widget
  for (const widget of ['FinanceWidget', 'TasksWidget', 'DeliveriesWidget']) assert.match(home, new RegExp(`<${widget} `));
  assert.doesNotMatch(dashboard, /Módulo em Prepara/);
  assert.doesNotMatch(dashboard, /SUBMÓDULOS EM BREVE/);
  assert.match(dashboard, /currentTab === 'home' && <AdminHomePage/);
});

// --- retrato diário de seguidores (base das metas de ganho de seguidores) ---
test('retrato diário: só o 1º sync de cada dia grava instagramStats; repetir, falhar ou rodar de novo no dia não altera', async () => {
  const db = fakeDb();
  await run(db, fakeFetch({ followers: 1000, media: [likesOf(10)] }).impl, { now: D1 });
  const first = db.store.get('instagramStats/2026-03-10');
  assert.deepEqual([first.day, first.followers, first.baselineAt, first.postsAt], ['2026-03-10', 1000, new Date(D1).toISOString(), new Date(D1).toISOString()]);
  assert.deepEqual(first.posts, { 1: [10, 2, 123] }); // retrato por publicação: [curtidas, comentários, views]
  await run(db, fakeFetch({ followers: 1125, media: [likesOf(40)] }).impl, { now: D1 + 6 * 3600_000 }); // mesmo dia
  await assert.rejects(run(db, fakeFetch({ error: { code: 190 } }).impl, { now: D1 + 7 * 3600_000 }), { code: 'token_invalid' });
  assert.equal(db.store.get('instagramStats/2026-03-10').followers, 1000); // retrato intacto
  assert.deepEqual(db.store.get('instagramStats/2026-03-10').posts, { 1: [10, 2, 123] }); // e o de publicações também (não é regravado com 40 curtidas)
  await run(db, fakeFetch({ followers: 1130, media: [likesOf(41)] }).impl, { now: Date.parse('2026-03-11T12:00:00Z') }); // 1º sync do dia 11
  assert.equal(db.store.get('instagramStats/2026-03-11').followers, 1130);
  assert.equal([...db.store.keys()].filter((k) => k.startsWith('instagramStats/')).length, 2);
});

test('retrato diário: referência do dia criada antes do recurso (sem retrato) ganha o retrato no próximo sync, com a referência e não o valor atual', async () => {
  const db = fakeDb();
  await run(db, fakeFetch({ followers: 1000, media: [likesOf(10)] }).impl, { now: D1 });
  db.store.delete('instagramStats/2026-03-10'); // como se o 1º sync do dia tivesse rodado antes do deploy que criou o retrato
  await run(db, fakeFetch({ followers: 1125, media: [likesOf(40)] }).impl, { now: D1 + 6 * 3600_000 });
  const created = db.store.get('instagramStats/2026-03-10');
  assert.deepEqual([created.day, created.followers, created.baselineAt], ['2026-03-10', 1000, new Date(D1).toISOString()]);
  assert.deepEqual(created.posts, { 1: [40, 2, 123] }); // sem retrato anterior: o das publicações nasce neste sync
});

// --- histórico diário do calendário (instagramMeta/day-AAAA-MM-DD) ---
test('calendário: cada sincronização grava o saldo do dia; o dia anterior fica preservado; falha não grava', async () => {
  const db = fakeDb();
  await run(db, fakeFetch({ followers: 1000, media: [likesOf(10)], insight: () => views(100) }).impl, { now: D1 });
  assert.deepEqual([db.store.get('instagramMeta/day-2026-03-10').followers, db.store.get('instagramMeta/day-2026-03-10').views], [0, 0]);
  await run(db, fakeFetch({ followers: 1500, media: [likesOf(40)], insight: () => views(1300) }).impl, { now: D1 + 6 * 3600_000 });
  const day10 = db.store.get('instagramMeta/day-2026-03-10');
  assert.deepEqual([day10.day, day10.followers, day10.views], ['2026-03-10', 500, 1200]);
  await assert.rejects(run(db, fakeFetch({ error: { code: 190 } }).impl, { now: D1 + 7 * 3600_000 }), { code: 'token_invalid' });
  assert.equal(db.store.get('instagramMeta/day-2026-03-10').followers, 500); // falha não altera
  await run(db, fakeFetch({ followers: 1450, media: [likesOf(41)], insight: () => views(1310) }).impl, { now: Date.parse('2026-03-11T12:00:00Z') });
  assert.equal(db.store.get('instagramMeta/day-2026-03-10').followers, 500); // virou o dia: o anterior fica como estava
  assert.equal(db.store.get('instagramMeta/day-2026-03-11').followers, 0);
  assert.equal([...db.store.keys()].filter((k) => k.startsWith('instagramMeta/day-')).length, 2);
});

test('página: calendário e filtro de período (padrão 30 dias) ligados; saldos têm erro próprio', async () => {
  const page = await readFile(new URL('../components/admin/AdminInstagramPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /useState<Period>\('30d'\)/);
  assert.match(page, /<InstagramCalendar /);
  assert.match(page, /subscribeInstagramDays\(setDays, \(\) => setDaysError\(true\)\)/);
  assert.match(page, /filterByPeriod\(current, period/);
});
