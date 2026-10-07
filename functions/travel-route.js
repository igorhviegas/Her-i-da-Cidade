// Cálculo de deslocamento dos eventos: Geocoding API + Routes API do Google. Só servidor (docs/deslocamento.md).
// Fica fora de api/ pelo mesmo motivo de firebase-admin.js. Sem dependências novas: usa fetch.
//
// Os endereços padrão (partida, parada, destino) e o número de WhatsApp vêm de variáveis de ambiente e nunca são
// devolvidos ao navegador: a resposta só tem rótulos, metros por trecho e o endereço que o Google entendeu para o que o
// agente digitou.

import { createHash, timingSafeEqual } from 'node:crypto';
import { buildSequence, metersToKm, whatsAppBase } from '../services/travelCost.js';
import { isValidDateInput } from '../services/eventForm.js';
import { orderEventSlot } from './event-missions.js';
import { endOfDay, startOfDay } from './missions-core.js';

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const TIMEOUT_MS = 8000;

const MESSAGES = {
  not_configured: 'O cálculo de deslocamento ainda não foi configurado no servidor.',
  stop_not_configured: 'A parada padrão não está configurada no servidor. Remova a parada ou informe outro endereço.',
  address_not_found: 'Não encontrei o endereço de {label}. Confira rua, número, bairro e cidade.',
  invalid_date: 'Informe uma data válida.',
  events_unavailable: 'Não foi possível consultar os eventos cadastrados agora. Tente novamente.',
  no_route: 'O Google não encontrou uma rota entre os pontos informados. Confira os endereços.',
  auth: 'O Google recusou a chave configurada no servidor.',
  rate_limited: 'O limite diário de consultas foi atingido ou o Google limitou as requisições. Tente novamente mais tarde.',
  unavailable: 'Não foi possível falar com o Google agora. Tente novamente.',
  api_error: 'O Google recusou a consulta.',
};

export class TravelRouteError extends Error {
  constructor(code, { label, detail } = {}) {
    super((MESSAGES[code] ?? MESSAGES.api_error).replace('{label}', label ?? 'um dos pontos'));
    this.name = 'TravelRouteError'; this.code = code; this.detail = detail;
  }
}

/** Configuração do servidor, ou null se faltar o essencial (chave, código de acesso, endereço de partida). */
export function readTravelConfig(env = process.env) {
  const text = (name) => String(env[name] ?? '').trim();
  const apiKey = text('GOOGLE_MAPS_API_KEY');
  const accessCode = text('TRAVEL_ACCESS_CODE');
  const startAddress = text('TRAVEL_START_ADDRESS');
  if (!apiKey || !accessCode || !startAddress) return null;
  const stopAddress = text('TRAVEL_STOP_ADDRESS');
  const endAddress = text('TRAVEL_END_ADDRESS');
  return {
    apiKey,
    accessCode,
    whatsappNumber: text('TRAVEL_WHATSAPP_NUMBER'),
    defaults: {
      start: { label: text('TRAVEL_START_LABEL') || 'Ponto de partida', address: startAddress },
      stop: stopAddress ? { label: text('TRAVEL_STOP_LABEL') || 'Parada', address: stopAddress } : null,
      end: { label: text('TRAVEL_END_LABEL') || text('TRAVEL_START_LABEL') || 'Destino final', address: endAddress || startAddress },
    },
  };
}

/** Comparação em tempo constante (hash dos dois lados para igualar o tamanho). */
export function codeMatches(provided, expected) {
  if (typeof provided !== 'string' || !provided || !expected) return false;
  const hash = (value) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

async function request(fetchImpl, url, init) {
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new TravelRouteError('unavailable');
  }
  const body = await response.json().catch(() => null);
  return { response, body };
}

function httpError(response, body) {
  const detail = body?.error?.status ?? body?.status ?? response.status; // só para o log do servidor
  if (response.status === 401 || response.status === 403) return new TravelRouteError('auth', { detail });
  if (response.status === 429) return new TravelRouteError('rate_limited', { detail });
  if (response.status >= 500) return new TravelRouteError('unavailable', { detail });
  return new TravelRouteError('api_error', { detail });
}

/**
 * Endereço -> coordenadas. `precise` = o Google achou o número exato (ou interpolou na rua) sem correspondência parcial;
 * senão o agente precisa conferir o endereço entendido antes de usar o valor.
 */
export async function geocodeAddress(address, { apiKey, fetchImpl = fetch, label }) {
  const url = `${GEOCODE_URL}?${new URLSearchParams({ address, components: 'country:BR', region: 'br', language: 'pt-BR', key: apiKey })}`;
  const { response, body } = await request(fetchImpl, url, { method: 'GET' });
  const status = body?.status;
  if (status === 'ZERO_RESULTS') throw new TravelRouteError('address_not_found', { label });
  if (status === 'OVER_QUERY_LIMIT' || status === 'OVER_DAILY_LIMIT') throw new TravelRouteError('rate_limited', { detail: status });
  if (status === 'REQUEST_DENIED') throw new TravelRouteError('auth', { detail: body?.error_message ?? status });
  if (!response.ok) throw httpError(response, body);
  const result = status === 'OK' ? body.results?.[0] : null;
  const location = result?.geometry?.location;
  if (!result || !Number.isFinite(location?.lat) || !Number.isFinite(location?.lng)) throw new TravelRouteError('api_error', { detail: status });
  const precise = !result.partial_match && ['ROOFTOP', 'RANGE_INTERPOLATED'].includes(result.geometry.location_type);
  return { formatted: result.formatted_address ?? '', lat: location.lat, lng: location.lng, placeId: result.place_id ?? '', precise };
}

/** Distância (metros) de cada trecho de uma rota por `points` ({lat,lng}), em uma única chamada. Mantém a ordem recebida. */
export async function computeLegsMeters(points, { apiKey, fetchImpl = fetch }) {
  const waypoint = (p) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const { response, body } = await request(fetchImpl, ROUTES_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'routes.legs.distanceMeters' },
    body: JSON.stringify({
      origin: waypoint(points[0]),
      destination: waypoint(points[points.length - 1]),
      intermediates: points.slice(1, -1).map(waypoint),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE', // sem trânsito em tempo real: resultado estável e faixa Essentials (mais barata)
      units: 'METRIC',
    }),
  });
  if (!response.ok) throw httpError(response, body);
  const legs = body?.routes?.[0]?.legs;
  if (!Array.isArray(legs) || legs.length === 0) throw new TravelRouteError('no_route');
  if (legs.length !== points.length - 1) throw new TravelRouteError('api_error', { detail: 'legs' });
  return legs.map((leg) => Number(leg.distanceMeters ?? 0)); // campo ausente = 0 m (trecho entre pontos muito próximos)
}

/**
 * Calcula o deslocamento de um ou mais dias (cada dia é uma viagem própria; uma consulta de rota por dia).
 * `input` = resultado de validateTravelInput. Devolve o que a tela precisa: por dia, os trechos em km e os endereços
 * entendidos (só dos digitados); e avisos e a base do link do WhatsApp. O total, os ajustes de km do agente e o texto
 * são montados na tela (summarizeTrip).
 */
export async function calculateTravel({ input, config, fetchImpl = fetch, now = new Date() }) {
  const sequences = input.days.map((day) => buildSequence(day, config.defaults));
  if (sequences.some((sequence) => !sequence)) throw new TravelRouteError('stop_not_configured');
  const many = input.days.length > 1;
  const creds = { apiKey: config.apiKey, fetchImpl };

  // Cada endereço distinto é consultado uma vez em todos os dias (padrões, parada na ida e na volta, mesmo local em dois dias).
  const firstUse = new Map(); // endereço -> rótulo do primeiro ponto que o usa (para a mensagem de erro)
  sequences.forEach((sequence, d) => sequence.forEach((p) => {
    if (!firstUse.has(p.address)) firstUse.set(p.address, many ? `${p.label} (dia ${d + 1})` : p.label);
  }));
  const geocoded = new Map();
  await Promise.all([...firstUse].map(async ([address, label]) => { geocoded.set(address, await geocodeAddress(address, { ...creds, label })); }));
  const placeOf = (point) => geocoded.get(point.address);

  const days = await Promise.all(sequences.map(async (sequence, d) => {
    // Pontos consecutivos no mesmo lugar não vão para a rota: o trecho vale 0 km.
    const sameSpot = (a, b) => a.lat === b.lat && a.lng === b.lng;
    const routePoints = [placeOf(sequence[0])];
    const legMeters = new Array(sequence.length - 1).fill(0);
    const routeLegOf = []; // índice do trecho da sequência -> índice do trecho na rota
    for (let i = 1; i < sequence.length; i += 1) {
      const previous = routePoints[routePoints.length - 1];
      const current = placeOf(sequence[i]);
      if (!sameSpot(previous, current)) { routePoints.push(current); routeLegOf[i - 1] = routePoints.length - 2; }
    }
    if (routePoints.length > 1) {
      const meters = await computeLegsMeters(routePoints, creds);
      routeLegOf.forEach((routeLeg, i) => { legMeters[i] = meters[routeLeg]; });
    }
    return {
      date: input.days[d].date,
      eventCount: input.days[d].events.length,
      legs: legMeters.map((meters, i) => ({ from: sequence[i].label, to: sequence[i + 1].label, km: metersToKm(meters) })),
      resolved: sequence
        .filter((p, i) => p.custom && (p.role !== 'stop' || sequence.findIndex((q) => q.role === 'stop') === i)) // a parada repetida aparece uma vez
        .map((p) => ({ label: p.label, address: placeOf(p).formatted, precise: placeOf(p).precise })),
    };
  }));
  return {
    days,
    kmRate: input.kmRate,
    eventFee: input.eventFee,
    needsConfirmation: days.some((day) => day.resolved.some((p) => !p.precise)),
    whatsappBase: whatsAppBase(config.whatsappNumber),
    calculatedAt: now.toISOString(),
  };
}

/**
 * Eventos cadastrados num dia (Brasília), para o agente importar os endereços. Mesma regra do check list do evento:
 * pedido com formulário de evento completo (rascunhos do ManyChat ficam de fora), data e horário válidos.
 * Devolve só horário, local e tipo, em ordem de horário: nunca nome da criança, cliente, telefone ou ID do pedido.
 * `listOrdersBetween(inicio, fim)` devolve os pedidos com eventDate no intervalo (Firestore no servidor, falso nos testes).
 */
export async function listDayEvents({ date, listOrdersBetween }) {
  if (!isValidDateInput(date)) throw new TravelRouteError('invalid_date');
  const orders = await listOrdersBetween(startOfDay(date), endOfDay(date));
  return orders
    .filter((order) => orderEventSlot(order)?.key === date && String(order.eventForm.location ?? '').trim())
    .map((order) => ({ time: order.eventForm.eventTime, location: String(order.eventForm.location).trim().replace(/\s+/g, ' '), formType: String(order.eventForm.formType ?? '').trim() }))
    .sort((a, b) => a.time.localeCompare(b.time) || a.location.localeCompare(b.location));
}
