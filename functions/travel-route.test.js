import test from 'node:test';
import assert from 'node:assert/strict';
import { TravelRouteError, calculateTravel, codeMatches, computeLegsMeters, geocodeAddress, readTravelConfig } from './travel-route.js';
import { validateTravelInput } from '../services/travelCost.js';

const ENV = {
  GOOGLE_MAPS_API_KEY: 'key-123', TRAVEL_ACCESS_CODE: 'codigo-secreto', TRAVEL_WHATSAPP_NUMBER: '(31) 91234-5678',
  TRAVEL_START_ADDRESS: 'SECRETO-INICIO', TRAVEL_STOP_ADDRESS: 'SECRETO-PARADA', TRAVEL_START_LABEL: 'Casa A', TRAVEL_STOP_LABEL: 'Casa B',
};
const config = readTravelConfig(ENV);
const input = (over = {}) => validateTravelInput({ events: ['Evento um 10', 'Evento dois 20'], kmRate: '2', eventFee: '100', ...over }).value;

/** Google falso: coordenadas por endereço; a rota devolve 1000 m × (nº do trecho + 1). */
function fakeGoogle({ geocode = {}, routeBody, routeStatus = 200 } = {}) {
  const calls = { geocode: [], routes: [] };
  const spots = { 'SECRETO-INICIO': [1, 1], 'SECRETO-PARADA': [2, 2], 'Evento um 10': [3, 3], 'Evento dois 20': [4, 4], ...geocode };
  const fetchImpl = async (url, init) => {
    if (String(url).startsWith('https://maps.googleapis.com/maps/api/geocode/json')) {
      const address = new URL(url).searchParams.get('address');
      calls.geocode.push(address);
      const spot = spots[address];
      const body = spot === null ? { status: 'ZERO_RESULTS', results: [] }
        : { status: 'OK', results: [{ formatted_address: `${address}, Brasil`, place_id: `p-${address}`, geometry: { location: { lat: spot[0], lng: spot[1] }, location_type: spot[2] ?? 'ROOFTOP' }, partial_match: spot[3] ?? false }] };
      return { ok: true, status: 200, json: async () => body };
    }
    const sent = JSON.parse(init.body);
    calls.routes.push({ headers: init.headers, body: sent });
    const count = (sent.intermediates?.length ?? 0) + 1;
    const body = routeBody ?? { routes: [{ legs: Array.from({ length: count }, (_, i) => ({ distanceMeters: 1000 * (i + 1) })) }] };
    return { ok: routeStatus === 200, status: routeStatus, json: async () => body };
  };
  return { fetchImpl, calls };
}

test('configuração: exige chave, código e endereço de partida; destino padrão = partida', () => {
  assert.equal(readTravelConfig({}), null);
  assert.equal(readTravelConfig({ ...ENV, TRAVEL_ACCESS_CODE: '' }), null);
  assert.equal(config.defaults.end.address, 'SECRETO-INICIO');
  assert.equal(config.defaults.stop.label, 'Casa B');
  assert.equal(readTravelConfig({ ...ENV, TRAVEL_STOP_ADDRESS: '' }).defaults.stop, null);
});

test('código de acesso: só o exato', () => {
  assert.equal(codeMatches('codigo-secreto', 'codigo-secreto'), true);
  assert.equal(codeMatches('codigo-secret', 'codigo-secreto'), false);
  assert.equal(codeMatches('', 'codigo-secreto'), false);
  assert.equal(codeMatches(undefined, 'codigo-secreto'), false);
  assert.equal(codeMatches(['codigo-secreto'], 'codigo-secreto'), false);
});

test('geocoding: endereço exato é preciso; parcial ou aproximado pede conferência; não encontrado e cota viram erro', async () => {
  const run = (geocode, address = 'Endereço X 1') => geocodeAddress(address, { apiKey: 'k', fetchImpl: fakeGoogle({ geocode: { [address]: geocode } }).fetchImpl, label: 'Evento 1' });
  assert.equal((await run([5, 5])).precise, true);
  assert.equal((await run([5, 5, 'RANGE_INTERPOLATED'])).precise, true);
  assert.equal((await run([5, 5, 'ROOFTOP', true])).precise, false);
  assert.equal((await run([5, 5, 'GEOMETRIC_CENTER'])).precise, false);
  assert.equal((await run([5, 5, 'APPROXIMATE'])).precise, false);
  await assert.rejects(() => run(null), (e) => e instanceof TravelRouteError && e.code === 'address_not_found' && /Evento 1/.test(e.message));
  const limited = async () => ({ ok: true, status: 200, json: async () => ({ status: 'OVER_QUERY_LIMIT' }) });
  await assert.rejects(() => geocodeAddress('x', { apiKey: 'k', fetchImpl: limited }), { code: 'rate_limited' });
  const denied = async () => ({ ok: true, status: 200, json: async () => ({ status: 'REQUEST_DENIED', error_message: 'segredo' }) });
  await assert.rejects(() => geocodeAddress('x', { apiKey: 'k', fetchImpl: denied }), (e) => e.code === 'auth' && !e.message.includes('segredo'));
  await assert.rejects(() => geocodeAddress('x', { apiKey: 'k', fetchImpl: async () => { throw new Error('rede'); } }), { code: 'unavailable' });
});

test('rota: uma chamada com ordem preservada, faixa Essentials e só o campo de distância', async () => {
  const { fetchImpl, calls } = fakeGoogle();
  const meters = await computeLegsMeters([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, { lat: 3, lng: 3 }], { apiKey: 'k', fetchImpl });
  assert.deepEqual(meters, [1000, 2000]);
  const [{ headers, body }] = calls.routes;
  assert.equal(headers['X-Goog-FieldMask'], 'routes.legs.distanceMeters');
  assert.equal(body.routingPreference, 'TRAFFIC_UNAWARE');
  assert.equal(body.travelMode, 'DRIVE');
  assert.equal(body.optimizeWaypointOrder, undefined);
  assert.deepEqual(body.intermediates, [{ location: { latLng: { latitude: 2, longitude: 2 } } }]);
  await assert.rejects(() => computeLegsMeters([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], { apiKey: 'k', fetchImpl: fakeGoogle({ routeBody: {} }).fetchImpl }), { code: 'no_route' });
  await assert.rejects(() => computeLegsMeters([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], { apiKey: 'k', fetchImpl: fakeGoogle({ routeStatus: 429, routeBody: {} }).fetchImpl }), { code: 'rate_limited' });
  await assert.rejects(() => computeLegsMeters([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], { apiKey: 'k', fetchImpl: fakeGoogle({ routeStatus: 403, routeBody: {} }).fetchImpl }), { code: 'auth' });
});

test('cálculo completo: trechos na ordem, parada consultada uma vez, endereços padrão nunca na resposta', async () => {
  const { fetchImpl, calls } = fakeGoogle();
  const result = await calculateTravel({ input: input(), config, fetchImpl, now: new Date('2026-10-07T12:00:00Z') });
  assert.equal(calls.routes.length, 1);
  assert.deepEqual([...calls.geocode].sort(), ['Evento dois 20', 'Evento um 10', 'SECRETO-INICIO', 'SECRETO-PARADA']); // 4 consultas para 6 pontos
  assert.deepEqual(result.summary.legs.map((l) => `${l.from}>${l.to}`), ['Casa A>Casa B', 'Casa B>Evento 1', 'Evento 1>Evento 2', 'Evento 2>Casa B', 'Casa B>Casa A']);
  assert.deepEqual(result.summary.legs.map((l) => l.km), [1, 2, 3, 4, 5]);
  assert.deepEqual([result.summary.totalKm, result.summary.travelCost, result.summary.feesTotal, result.summary.total], [15, 30, 200, 230]);
  assert.deepEqual(result.resolved.map((p) => p.label), ['Evento 1', 'Evento 2']);
  assert.equal(result.needsConfirmation, false);
  assert.equal(result.whatsappBase, 'https://wa.me/5531912345678');
  assert.equal(result.calculatedAt, '2026-10-07T12:00:00.000Z');
  assert.equal(/SECRETO/.test(JSON.stringify(result)), false);
  const semNumero = readTravelConfig({ ...ENV, TRAVEL_WHATSAPP_NUMBER: '' });
  assert.equal((await calculateTravel({ input: input(), config: semNumero, fetchImpl: fakeGoogle().fetchImpl })).whatsappBase, null);
});

test('cálculo sem parada, com endereço digitado impreciso e com outra parada', async () => {
  const semParada = await calculateTravel({ input: input({ stop: false }), config, fetchImpl: fakeGoogle().fetchImpl });
  assert.deepEqual(semParada.summary.legs.map((l) => `${l.from}>${l.to}`), ['Casa A>Evento 1', 'Evento 1>Evento 2', 'Evento 2>Casa A']);

  const vago = fakeGoogle({ geocode: { 'Evento dois 20': [4, 4, 'APPROXIMATE'] } });
  const impreciso = await calculateTravel({ input: input(), config, fetchImpl: vago.fetchImpl });
  assert.equal(impreciso.needsConfirmation, true);
  assert.deepEqual(impreciso.resolved.map((p) => p.precise), [true, false]);

  const outra = await calculateTravel({ input: input({ stop: 'Rua Outra 99' }), config, fetchImpl: fakeGoogle({ geocode: { 'Rua Outra 99': [9, 9] } }).fetchImpl });
  assert.deepEqual(outra.resolved.map((p) => p.label), ['Parada', 'Evento 1', 'Evento 2']);
});

test('pontos no mesmo lugar não vão para a rota e valem 0 km; tudo no mesmo lugar nem chama a rota', async () => {
  const mesmo = fakeGoogle({ geocode: { 'Evento um 10': [1, 1] } }); // evento 1 = partida
  const noMesmoLugar = await calculateTravel({ input: input({ stop: false, events: ['Evento um 10'] }), config, fetchImpl: mesmo.fetchImpl });
  assert.equal(mesmo.calls.routes.length, 0);
  assert.equal(noMesmoLugar.summary.totalKm, 0);

  const parcial = fakeGoogle({ geocode: { 'Evento um 10': [2, 2] } }); // evento 1 = parada
  const result = await calculateTravel({ input: input(), config, fetchImpl: parcial.fetchImpl });
  assert.deepEqual(result.summary.legs.map((l) => l.km), [1, 0, 2, 3, 4]); // Casa B → Evento 1 = 0 km; a rota teve 4 trechos
  assert.equal(parcial.calls.routes[0].body.intermediates.length, 3);
});

test('parada padrão sem configuração e endereço não encontrado interrompem sem valor', async () => {
  const semParadaPadrao = readTravelConfig({ ...ENV, TRAVEL_STOP_ADDRESS: '' });
  await assert.rejects(() => calculateTravel({ input: input(), config: semParadaPadrao, fetchImpl: fakeGoogle().fetchImpl }), { code: 'stop_not_configured' });
  const g = fakeGoogle({ geocode: { 'Evento dois 20': null } });
  await assert.rejects(() => calculateTravel({ input: input(), config, fetchImpl: g.fetchImpl }), (e) => e.code === 'address_not_found' && /Evento 2/.test(e.message));
  assert.equal(g.calls.routes.length, 0);
});
