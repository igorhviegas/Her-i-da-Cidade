import test from 'node:test';
import assert from 'node:assert/strict';
import { handleReviews } from '../api/reviews.ts';

const response = () => ({ statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const ENV = { GOOGLE_MAPS_API_KEY: 'chave', GOOGLE_PLACE_ID: 'ChIJteste' };
const call = async (req, deps) => { const res = response(); await handleReviews(req, res, deps); return res; };
const google = (status, body, seen = {}) => async (url, init) => { seen.url = String(url); seen.headers = init.headers; return { ok: status === 200, status, json: async () => body }; };

const PLACE = {
  rating: 4.9, userRatingCount: 361, googleMapsUri: 'https://maps.google.com/?cid=1',
  reviews: [
    { name: 'places/p/reviews/a', rating: 5, relativePublishTimeDescription: '2 meses atrás', text: { text: ' Ótimo! ' }, authorAttribution: { displayName: 'Ana', photoUri: 'https://x/a.jpg' } },
    { name: 'places/p/reviews/b', rating: 5, authorAttribution: { displayName: 'Sem texto' } },
    { name: 'places/p/reviews/c', rating: 4, text: { text: 'Bom' }, authorAttribution: { displayName: '' } },
  ],
};

test('só GET, e só com chave e Place ID no servidor; nada vai ao Google antes disso', async () => {
  const never = async () => { throw new Error('não deveria chamar o Google'); };
  assert.equal((await call({ method: 'POST' }, { env: ENV, fetchImpl: never })).statusCode, 405);
  const semConfig = await call({ method: 'GET' }, { env: { GOOGLE_MAPS_API_KEY: 'chave' }, fetchImpl: never });
  assert.deepEqual([semConfig.statusCode, semConfig.headers['cache-control']], [503, 'no-store']);
});

test('sucesso: manda chave só no header, devolve nota, total e avaliações com texto, e fica em cache', async () => {
  const seen = {};
  const res = await call({ method: 'GET' }, { env: ENV, fetchImpl: google(200, PLACE, seen) });
  assert.equal(res.statusCode, 200);
  assert.match(seen.url, /^https:\/\/places\.googleapis\.com\/v1\/places\/ChIJteste\?languageCode=pt-BR$/);
  assert.equal(seen.headers['X-Goog-Api-Key'], 'chave');
  assert.deepEqual(res.body, {
    rating: 4.9, count: 361, url: 'https://maps.google.com/?cid=1',
    reviews: [{ id: 'places/p/reviews/a', author: 'Ana', rating: 5, comment: 'Ótimo!', avatar: 'https://x/a.jpg', when: '2 meses atrás' }],
  });
  assert.match(res.headers['cache-control'], /s-maxage=86400/);
});

test('falha do Google vira 502 com só o código, sem cache e sem vazar detalhe', async () => {
  for (const [status, code] of [[403, 'auth'], [404, 'not_found'], [429, 'rate_limited'], [500, 'api_error']]) {
    const res = await call({ method: 'GET' }, { env: ENV, fetchImpl: google(status, { error: { message: 'SEGREDO-DA-CHAVE' } }) });
    assert.deepEqual([res.statusCode, res.headers['cache-control'], res.body, JSON.stringify(res.body).includes('SEGREDO')], [502, 'no-store', { ok: false, error: { code } }, false]);
  }
  const offline = await call({ method: 'GET' }, { env: ENV, fetchImpl: async () => { throw new Error('rede'); } });
  assert.deepEqual([offline.statusCode, offline.body.error.code], [502, 'unavailable']);
});
