import test from 'node:test';
import assert from 'node:assert/strict';
import { GoogleSyncError, mergeDailyMetrics, normalizeReview, runGoogleSync } from './google-business.js';

const ENV = { GOOGLE_BUSINESS_CLIENT_ID: 'id', GOOGLE_BUSINESS_CLIENT_SECRET: 'sec', GOOGLE_BUSINESS_REFRESH_TOKEN: 'ref', GOOGLE_BUSINESS_ACCOUNT_ID: '1', GOOGLE_BUSINESS_LOCATION_ID: '2' };

function fakeDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const doc = (path) => ({
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    set: async (data, opts) => { store.set(path, opts?.merge ? { ...store.get(path), ...data } : data); },
  });
  return { store, doc, batch: () => { const ops = []; return { set: (ref, data) => ops.push([ref, data]), commit: async () => { for (const [ref, data] of ops) await ref.set(data); } }; } };
}

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });

function fakeFetch({ reviews, metrics, tokenStatus = 200, metricsStatus = 200 } = {}) {
  const calls = [];
  const fn = async (url) => {
    calls.push(String(url));
    if (String(url).includes('oauth2.googleapis.com')) return tokenStatus === 200 ? json({ access_token: 'tok' }) : json({ error: 'invalid_grant' }, 400);
    if (String(url).includes('mybusiness.googleapis.com')) return json(reviews);
    return metricsStatus === 200 ? json(metrics) : json({ error: { status: 'PERMISSION_DENIED' } }, metricsStatus);
  };
  fn.calls = calls;
  return fn;
}

const reviewsBody = {
  averageRating: 5, totalReviewCount: 404,
  reviews: [
    { reviewId: 'a', reviewer: { displayName: 'Camila' }, starRating: 'FIVE', comment: 'Ótimo!', createTime: '2026-10-10T10:00:00Z', updateTime: '2026-10-10T10:00:00Z' },
    { reviewId: 'b', reviewer: { displayName: 'Rui' }, starRating: 'FOUR', createTime: '2026-10-09T10:00:00Z', reviewReply: { comment: 'Obrigado!', updateTime: '2026-10-09T12:00:00Z' } },
    { reviewId: 'c', starRating: 'STAR_RATING_UNSPECIFIED' },
  ],
};
const metricsBody = {
  multiDailyMetricTimeSeries: [{ dailyMetricTimeSeries: [
    { dailyMetric: 'CALL_CLICKS', timeSeries: { datedValues: [{ date: { year: 2026, month: 11, day: 2 }, value: '3' }, { date: { year: 2026, month: 11, day: 3 } }] } },
    { dailyMetric: 'BUSINESS_IMPRESSIONS_MOBILE_MAPS', timeSeries: { datedValues: [{ date: { year: 2026, month: 11, day: 2 }, value: '10' }] } },
    { dailyMetric: 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', timeSeries: { datedValues: [{ date: { year: 2026, month: 11, day: 2 }, value: '5' }] } },
  ] }],
};

test('normalizeReview: nota, resposta e avaliação sem nota válida', () => {
  assert.equal(normalizeReview(reviewsBody.reviews[0]).rating, 5);
  assert.equal(normalizeReview(reviewsBody.reviews[0]).replied, false);
  assert.deepEqual([normalizeReview(reviewsBody.reviews[1]).replied, normalizeReview(reviewsBody.reviews[1]).reply], [true, 'Obrigado!']);
  assert.equal(normalizeReview(reviewsBody.reviews[1]).reviewer, 'Rui');
  assert.equal(normalizeReview(reviewsBody.reviews[2]), null);
});

test('mergeDailyMetrics: soma impressões, dia sem valor vale 0 e ordena', () => {
  assert.deepEqual(mergeDailyMetrics(metricsBody), [
    { date: '2026-11-02', impressions: 15, calls: 3, website: 0, directions: 0 },
    { date: '2026-11-03', impressions: 0, calls: 0, website: 0, directions: 0 },
  ]);
  assert.deepEqual(mergeDailyMetrics(null), []);
});

test('sincroniza avaliações e desempenho; perfil conta as não respondidas', async () => {
  const db = fakeDb();
  const out = await runGoogleSync({ db, fetchImpl: fakeFetch({ reviews: reviewsBody, metrics: metricsBody }), env: ENV, now: Date.parse('2026-11-04T12:00:00Z') });
  assert.deepEqual([out.status, out.reviews, out.metrics], ['completed', 2, 2]);
  assert.equal(db.store.get('googleReviews/a').syncedAt, '2026-11-04T12:00:00.000Z');
  const profile = db.store.get('googleMeta/profile');
  assert.deepEqual([profile.rating, profile.total, profile.loaded, profile.unanswered, profile.lastError], [5, 404, 2, 1, null]);
  assert.equal(db.store.get('googleMeta/daily').days.length, 2);
});

test('falha nas métricas não perde as avaliações', async () => {
  const db = fakeDb();
  const out = await runGoogleSync({ db, fetchImpl: fakeFetch({ reviews: reviewsBody, metricsStatus: 403 }), env: ENV, now: 1_800_000_000_000 });
  assert.deepEqual([out.status, out.metricsError], ['completed', 'permission']);
  assert.equal(db.store.has('googleReviews/a'), true);
  assert.equal(db.store.has('googleMeta/daily'), false);
});

test('sem configuração ou com token recusado: erro com código e perfil registra a falha', async () => {
  const db = fakeDb();
  await assert.rejects(runGoogleSync({ db, fetchImpl: fakeFetch(), env: {}, now: 1 }), (e) => e instanceof GoogleSyncError && e.code === 'not_configured');
  assert.equal(db.store.get('googleMeta/profile').lastError.code, 'not_configured');
  await assert.rejects(runGoogleSync({ db: fakeDb(), fetchImpl: fakeFetch({ tokenStatus: 400 }), env: ENV, now: 1 }), (e) => e.code === 'token_invalid');
});

test('sincronização manual respeita o intervalo mínimo de 60 s', async () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const db = fakeDb({ 'googleMeta/profile': { lastAttemptAt: new Date(now - 30_000).toISOString(), lastError: null } });
  const fetchImpl = fakeFetch({ reviews: reviewsBody, metrics: metricsBody });
  assert.equal((await runGoogleSync({ db, fetchImpl, env: ENV, now, manual: true })).status, 'cooldown');
  assert.equal(fetchImpl.calls.length, 0);
  assert.equal((await runGoogleSync({ db, fetchImpl, env: ENV, now: now + 60_000, manual: true })).status, 'completed');
});
