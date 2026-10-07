import test from 'node:test';
import assert from 'node:assert/strict';
import { TravelRouteError, calculateTravel, codeMatches, computeLegsMeters, geocodeAddress, listDayEvents, readTravelConfig } from './travel-route.js';
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
  assert.equal(result.days.length, 1);
  const [dia] = result.days;
  assert.deepEqual(dia.legs.map((l) => `${l.from}>${l.to}`), ['Casa A>Casa B', 'Casa B>Evento 1', 'Evento 1>Evento 2', 'Evento 2>Casa B', 'Casa B>Casa A']);
  assert.deepEqual(dia.legs.map((l) => l.km), [1, 2, 3, 4, 5]);
  assert.deepEqual([dia.eventCount, result.kmRate, result.eventFee], [2, 2, 100]);
  assert.deepEqual(dia.resolved.map((p) => p.label), ['Evento 1', 'Evento 2']);
  assert.equal(result.needsConfirmation, false);
  assert.equal(result.whatsappBase, 'https://wa.me/5531912345678');
  assert.equal(result.calculatedAt, '2026-10-07T12:00:00.000Z');
  assert.equal(/SECRETO/.test(JSON.stringify(result)), false);
  const semNumero = readTravelConfig({ ...ENV, TRAVEL_WHATSAPP_NUMBER: '' });
  assert.equal((await calculateTravel({ input: input(), config: semNumero, fetchImpl: fakeGoogle().fetchImpl })).whatsappBase, null);
});

test('cálculo sem parada, com endereço digitado impreciso e com outra parada', async () => {
  const semParada = await calculateTravel({ input: input({ stop: false }), config, fetchImpl: fakeGoogle().fetchImpl });
  assert.deepEqual(semParada.days[0].legs.map((l) => `${l.from}>${l.to}`), ['Casa A>Evento 1', 'Evento 1>Evento 2', 'Evento 2>Casa A']);

  const vago = fakeGoogle({ geocode: { 'Evento dois 20': [4, 4, 'APPROXIMATE'] } });
  const impreciso = await calculateTravel({ input: input(), config, fetchImpl: vago.fetchImpl });
  assert.equal(impreciso.needsConfirmation, true);
  assert.deepEqual(impreciso.days[0].resolved.map((p) => p.precise), [true, false]);

  const outra = await calculateTravel({ input: input({ stop: 'Rua Outra 99' }), config, fetchImpl: fakeGoogle({ geocode: { 'Rua Outra 99': [9, 9] } }).fetchImpl });
  assert.deepEqual(outra.days[0].resolved.map((p) => p.label), ['Parada', 'Evento 1', 'Evento 2']);
});

test('vários dias: uma rota por dia, endereços repetidos consultados uma vez, cada dia parte do ponto de partida', async () => {
  const { fetchImpl, calls } = fakeGoogle({ geocode: { 'Evento três 30': [5, 5], 'Evento quatro 40': [6, 6] } });
  const dias = validateTravelInput({
    days: [
      { date: '2026-10-10', events: ['Evento um 10', 'Evento dois 20'] },
      { date: '2026-10-11', events: ['Evento dois 20', 'Evento três 30'], stop: false }, // repete o endereço do dia anterior, sem parada
      { date: '2026-10-12', events: ['Evento quatro 40'], start: 'Evento um 10' },
    ],
    kmRate: '2', eventFee: '100',
  }).value;
  const result = await calculateTravel({ input: dias, config, fetchImpl });
  assert.equal(calls.routes.length, 3);
  assert.deepEqual([...calls.geocode].sort(), ['Evento dois 20', 'Evento quatro 40', 'Evento três 30', 'Evento um 10', 'SECRETO-INICIO', 'SECRETO-PARADA']); // 6 consultas, sem repetir
  assert.deepEqual(result.days.map((d) => [d.date, d.eventCount, d.legs.length]), [['2026-10-10', 2, 5], ['2026-10-11', 2, 3], ['2026-10-12', 1, 4]]);
  assert.deepEqual(result.days[1].legs.map((l) => `${l.from}>${l.to}`), ['Casa A>Evento 1', 'Evento 1>Evento 2', 'Evento 2>Casa A']);
  assert.deepEqual(result.days.map((d) => d.legs[0].from), ['Casa A', 'Casa A', 'Ponto de partida']); // o dia 3 partiu de outro endereço
  assert.equal(/SECRETO/.test(JSON.stringify(result)), false);
});

test('vários dias: erro de endereço diz de qual dia; um dia impreciso pede conferência de tudo', async () => {
  const dias = (extra = {}) => validateTravelInput({ days: [{ events: ['Evento um 10'] }, { events: ['Evento dois 20'] }], kmRate: '2', eventFee: '100', ...extra }).value;
  const g = fakeGoogle({ geocode: { 'Evento dois 20': null } });
  await assert.rejects(() => calculateTravel({ input: dias(), config, fetchImpl: g.fetchImpl }), (e) => e.code === 'address_not_found' && /Evento 1 \(dia 2\)/.test(e.message));
  assert.equal(g.calls.routes.length, 0);
  const vago = fakeGoogle({ geocode: { 'Evento dois 20': [4, 4, 'APPROXIMATE'] } });
  const result = await calculateTravel({ input: dias(), config, fetchImpl: vago.fetchImpl });
  assert.equal(result.needsConfirmation, true);
  assert.deepEqual(result.days.map((d) => d.resolved.every((p) => p.precise)), [true, false]);
  const semParadaPadrao = readTravelConfig({ ...ENV, TRAVEL_STOP_ADDRESS: '' });
  await assert.rejects(() => calculateTravel({ input: dias({ days: [{ events: ['Evento um 10'], stop: false }, { events: ['Evento dois 20'] }] }), config: semParadaPadrao, fetchImpl: fakeGoogle().fetchImpl }), { code: 'stop_not_configured' });
});

test('pontos no mesmo lugar não vão para a rota e valem 0 km; tudo no mesmo lugar nem chama a rota', async () => {
  const mesmo = fakeGoogle({ geocode: { 'Evento um 10': [1, 1] } }); // evento 1 = partida
  const noMesmoLugar = await calculateTravel({ input: input({ stop: false, events: ['Evento um 10'] }), config, fetchImpl: mesmo.fetchImpl });
  assert.equal(mesmo.calls.routes.length, 0);
  assert.deepEqual(noMesmoLugar.days[0].legs.map((l) => l.km), [0, 0]);

  const parcial = fakeGoogle({ geocode: { 'Evento um 10': [2, 2] } }); // evento 1 = parada
  const result = await calculateTravel({ input: input(), config, fetchImpl: parcial.fetchImpl });
  assert.deepEqual(result.days[0].legs.map((l) => l.km), [1, 0, 2, 3, 4]); // Casa B → Evento 1 = 0 km; a rota teve 4 trechos
  assert.equal(parcial.calls.routes[0].body.intermediates.length, 3);
});

test('parada padrão sem configuração e endereço não encontrado interrompem sem valor', async () => {
  const semParadaPadrao = readTravelConfig({ ...ENV, TRAVEL_STOP_ADDRESS: '' });
  await assert.rejects(() => calculateTravel({ input: input(), config: semParadaPadrao, fetchImpl: fakeGoogle().fetchImpl }), { code: 'stop_not_configured' });
  const g = fakeGoogle({ geocode: { 'Evento dois 20': null } });
  await assert.rejects(() => calculateTravel({ input: input(), config, fetchImpl: g.fetchImpl }), (e) => e.code === 'address_not_found' && /Evento 2/.test(e.message));
  assert.equal(g.calls.routes.length, 0);
});

const at = (iso) => new Date(iso); // eventDate é gravado ao meio-dia
const evento = (over = {}, form = {}) => ({ id: 'o1', childName: 'Pedro', clientId: 'c1', eventDate: at('2026-10-10T15:00:00Z'), eventForm: { eventTime: '14:00', location: 'Rua A 10, Betim', formType: 'Aniversário', ...form }, ...over });

test('eventos do dia: só pedidos de evento completos do dia, em ordem de horário e sem dados pessoais', async () => {
  let bounds;
  const orders = [
    evento({ id: 'tarde' }, { eventTime: '16:30', location: '  Rua  B   20,\nContagem ' }),
    evento({ id: 'manha' }, { eventTime: '09:00', location: 'Rua C 30, BH', formType: '' }),
    evento({ id: 'rascunho', eventDraft: true }),
    evento({ id: 'outro-dia', eventDate: at('2026-10-11T15:00:00Z') }),
    evento({ id: 'sem-local' }, { location: '   ' }),
    evento({ id: 'sem-horario' }, { eventTime: '' }),
    { id: 'video', eventDate: at('2026-10-10T15:00:00Z'), childName: 'Ana' }, // pedido comum, sem formulário de evento
  ];
  const events = await listDayEvents({ date: '2026-10-10', listOrdersBetween: async (start, end) => { bounds = [start.toISOString(), end.toISOString()]; return orders; } });
  assert.deepEqual(events, [
    { time: '09:00', location: 'Rua C 30, BH', formType: '' },
    { time: '16:30', location: 'Rua B 20, Contagem', formType: 'Aniversário' },
  ]);
  assert.deepEqual(bounds, ['2026-10-10T03:00:00.000Z', '2026-10-11T02:59:59.999Z']); // o dia inteiro em Brasília (UTC-3)
  assert.equal(/Pedro|Ana|c1|tarde|manha/.test(JSON.stringify(events)), false);
});

test('eventos do dia: data inválida é recusada antes de consultar; sem eventos devolve lista vazia', async () => {
  const never = async () => { throw new Error('não deveria consultar'); };
  for (const date of ['', '2026-02-31', '10/10/2026', undefined]) await assert.rejects(() => listDayEvents({ date, listOrdersBetween: never }), { code: 'invalid_date' });
  assert.deepEqual(await listDayEvents({ date: '2026-10-10', listOrdersBetween: async () => [] }), []);
});
