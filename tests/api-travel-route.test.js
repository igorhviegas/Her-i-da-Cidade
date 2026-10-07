import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTravelRoute } from '../api/travel-route.ts';
import { TravelRouteError } from '../functions/travel-route.js';

const response = () => ({ statusCode: 200, headers: {}, body: undefined, setHeader(n, v) { this.headers[n.toLowerCase()] = v; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });
const ENV = { GOOGLE_MAPS_API_KEY: 'k', TRAVEL_ACCESS_CODE: 'codigo-secreto', TRAVEL_START_ADDRESS: 'SECRETO' };
const body = { events: ['Rua das Flores 10, Betim'], kmRate: '1,90', eventFee: '115' };
const post = (over = {}, code = 'codigo-secreto') => ({ method: 'POST', headers: code === null ? {} : { 'x-travel-code': code }, body: { ...body, ...over } });
const call = async (req, deps = {}) => { const res = response(); await handleTravelRoute(req, res, { env: ENV, ...deps }); return res; };
const never = async () => { throw new Error('não deveria chamar o Google'); };

test('somente POST, servidor configurado e código correto; nada vai ao Google antes disso', async () => {
  assert.equal((await call({ method: 'GET', headers: {} }, { calculate: never })).statusCode, 405);
  assert.equal((await call(post(), { env: {}, calculate: never })).statusCode, 503);
  assert.equal((await call(post({}, null), { calculate: never })).statusCode, 401);
  const errado = await call(post({}, 'outro'), { calculate: never });
  assert.deepEqual([errado.statusCode, errado.body.error.code, errado.headers['cache-control']], [401, 'unauthorized', 'no-store']);
});

test('entrada inválida é recusada (400) sem chamar o Google', async () => {
  for (const over of [{ events: [] }, { events: ['ab'] }, { kmRate: '' }, { eventFee: '-5' }]) {
    const res = await call(post(over), { calculate: never });
    assert.deepEqual([res.statusCode, res.body.error.code], [400, 'invalid_request']);
  }
});

test('sucesso: usa a entrada validada e devolve o resultado', async () => {
  let received;
  const calculate = async (args) => { received = args; return { summary: { total: 1 }, whatsapp: { text: 't', url: null } }; };
  const res = await call(post({ stop: false }), { calculate });
  assert.deepEqual(res.body, { ok: true, summary: { total: 1 }, whatsapp: { text: 't', url: null } });
  assert.deepEqual([received.input.events, received.input.useStop, received.input.kmRate, received.input.eventFee], [['Rua das Flores 10, Betim'], false, 1.9, 115]);
});

test('erros do Google viram status e mensagem próprios; falha inesperada não vaza detalhes', async () => {
  const fail = (code) => async () => { throw new TravelRouteError(code, { label: 'Evento 1', detail: 'segredo-interno' }); };
  const erro = await call(post(), { calculate: fail('address_not_found') });
  assert.deepEqual([erro.statusCode, erro.body.error.code], [422, 'address_not_found']);
  assert.match(erro.body.error.message, /Evento 1/);
  const cota = await call(post(), { calculate: fail('rate_limited') });
  assert.equal(cota.statusCode, 429);
  assert.equal(JSON.stringify(cota.body).includes('segredo-interno'), false);
  const inesperado = await call(post(), { calculate: async () => { throw new Error('chave K vazou'); } });
  assert.deepEqual([inesperado.statusCode, inesperado.body.error.code], [500, 'internal_error']);
  assert.equal(JSON.stringify(inesperado.body).includes('vazou'), false);
});
