// Cálculo de deslocamento dos eventos (sem Firebase/React; testado em Node). Usado pelo servidor (functions/travel-route.js)
// e pela tela do agente. Aqui não existe nenhum endereço: os padrões ficam só no servidor (docs/deslocamento.md).
//
// Cada dia é uma viagem própria: início -> [parada] -> evento 1 -> ... -> evento N -> [parada] -> destino final.
// O cálculo soma os dias (semana, fim de semana) em um total só.

import { isValidDateInput, money, roundMoney } from './eventForm.js';

export const DEFAULT_KM_RATE = 1.9;
export const DEFAULT_EVENT_FEE = 115;
/** Routes API (Essentials) aceita 10 pontos intermediários: eventos + as 2 passagens pela parada. */
export const MAX_EVENTS = 8;
export const MAX_DAYS = 7;
export const MAX_TOTAL_EVENTS = 24;
export const MIN_ADDRESS_LENGTH = 5;
export const MAX_ADDRESS_LENGTH = 200;
export const MAX_KM_RATE = 100;
export const MAX_EVENT_FEE = 100000;
export const MAX_LEG_KM = 2000;

const clean = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();
// eslint-disable-next-line no-control-regex
const hasControlChars = (text) => /[\u0000-\u001f\u007f]/.test(String(text ?? '').replace(/[\t\r\n]/g, ' '));

function validAddress(raw, label) {
  const text = clean(raw);
  if (hasControlChars(raw)) return { error: `${label}: o endereço tem caracteres inválidos.` };
  if (text.length < MIN_ADDRESS_LENGTH) return { error: `${label}: informe o endereço completo (rua, número, bairro e cidade).` };
  if (text.length > MAX_ADDRESS_LENGTH) return { error: `${label}: o endereço é longo demais.` };
  return { value: text };
}

/** Um dia: events (1 a MAX_EVENTS), start/end/stop e date (opcional, 'YYYY-MM-DD'). Ver validateTravelInput. */
function validateDay(raw, number, many) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const prefix = many ? `Dia ${number}: ` : '';
  const say = (text) => (prefix ? prefix + text : text.charAt(0).toUpperCase() + text.slice(1)); // "Dia 2: informe…" / "Informe…"
  if (!Array.isArray(input.events) || input.events.length === 0) return { error: say('informe pelo menos um evento.') };
  if (input.events.length > MAX_EVENTS) return { error: say(`o limite é de ${MAX_EVENTS} eventos por dia.`) };
  const events = [];
  for (let i = 0; i < input.events.length; i += 1) {
    const result = validAddress(input.events[i], `${prefix}Evento ${i + 1}`);
    if (result.error) return result;
    events.push(result.value);
  }
  const optional = (value, label) => {
    if (value === undefined || value === null || value === '' || value === true) return { value: null };
    if (typeof value !== 'string') return { error: `${prefix}${label}: endereço inválido.` };
    return validAddress(value, `${prefix}${label}`);
  };
  const start = optional(input.start, 'Ponto de partida');
  if (start.error) return start;
  const end = optional(input.end, 'Destino final');
  if (end.error) return end;
  let stop = { value: null }; // null = padrão
  let useStop = true;
  if (input.stop === null || input.stop === false) useStop = false;
  else { stop = optional(input.stop, 'Parada'); if (stop.error) return stop; }
  const date = input.date === undefined || input.date === null || input.date === '' ? '' : input.date;
  if (date && (typeof date !== 'string' || !isValidDateInput(date))) return { error: say('informe uma data válida.') };
  return { value: { date, events, start: start.value, end: end.value, useStop, stop: stop.value } };
}

/**
 * Valida o corpo da requisição. Retorna { error } ou { value: { days, kmRate, eventFee } }.
 * - days: de 1 a MAX_DAYS viagens (cada uma com events, start, stop, end, date). Sem `days`, o próprio corpo é um dia só.
 *   - events: endereços na ordem em que serão percorridos (1 a MAX_EVENTS por dia, MAX_TOTAL_EVENTS no total).
 *   - start / end: ausente ou '' = endereço padrão; texto = outro endereço só para este dia.
 *   - stop: null/false = sem parada; ausente, '' ou true = parada padrão; texto = outra parada.
 *   - date: opcional, só para o texto do WhatsApp.
 * - kmRate / eventFee: valor por km e cachê por evento (número ou texto "1,90").
 */
export function validateTravelInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  const rawDays = Array.isArray(input.days) ? input.days : [input];
  if (rawDays.length === 0) return { error: 'Informe pelo menos um dia.' };
  if (rawDays.length > MAX_DAYS) return { error: `O limite é de ${MAX_DAYS} dias por cálculo.` };
  const days = [];
  for (let i = 0; i < rawDays.length; i += 1) {
    const result = validateDay(rawDays[i], i + 1, rawDays.length > 1);
    if (result.error) return result;
    days.push(result.value);
  }
  if (days.reduce((sum, day) => sum + day.events.length, 0) > MAX_TOTAL_EVENTS) return { error: `O limite é de ${MAX_TOTAL_EVENTS} eventos por cálculo.` };
  const kmRate = money(input.kmRate);
  if (kmRate === null || kmRate > MAX_KM_RATE) return { error: 'Informe um valor por km válido.' };
  const eventFee = money(input.eventFee);
  if (eventFee === null || eventFee > MAX_EVENT_FEE) return { error: 'Informe um cachê por evento válido.' };
  return { value: { days, kmRate, eventFee } };
}

/**
 * Sequência de pontos da rota de um dia. `defaults` = { start, stop?, end } com { label, address } (só no servidor).
 * Cada ponto: { role, label, address, custom }. `custom` = digitado pelo agente (o servidor mostra o endereço entendido).
 */
export function buildSequence(day, defaults) {
  const point = (role, label, custom, fallback) => (custom || fallback ? { role, label: custom ? label : fallback.label, address: custom ?? fallback.address, custom: !!custom } : null);
  const start = point('start', 'Ponto de partida', day.start, defaults.start);
  const end = point('end', 'Destino final', day.end, defaults.end ?? defaults.start);
  const stop = day.useStop ? point('stop', 'Parada', day.stop, defaults.stop) : null;
  if (day.useStop && !stop) return null; // parada padrão não configurada
  const events = day.events.map((address, i) => ({ role: 'event', label: `Evento ${i + 1}`, address, custom: true }));
  return [start, ...(stop ? [stop] : []), ...events, ...(stop ? [{ ...stop }] : []), end];
}

/** Metros -> km com 1 casa (é o que o agente vê, e o total soma exatamente o que está na tela). */
export const metersToKm = (meters) => Math.round((Number(meters) || 0) / 100) / 10;

/** Km digitado pelo agente ("12,5") -> número com 1 casa; null se vazio, negativo ou absurdo. */
export function parseKm(text) {
  const typed = String(text ?? '').trim().replace(',', '.');
  if (!typed) return null;
  const value = Number(typed);
  return Number.isFinite(value) && value >= 0 && value <= MAX_LEG_KM ? Math.round(value * 10) / 10 : null;
}

const sumKm = (values) => Math.round(values.reduce((sum, km) => sum + km * 10, 0)) / 10;

/** Chave do ajuste manual do trecho `leg` do dia `day` (índices de 0). */
export const legKey = (day, leg) => `${day}:${leg}`;

/**
 * Resumo da viagem toda. `days` = [{ date, legs: [{ from, to, km }], eventCount }]; `overrides` = { [legKey]: km } com km corrigidos
 * à mão (o trecho sai marcado `adjusted`). Total de km = soma dos trechos já arredondados (fecha com a conta que o agente faz de cabeça).
 */
export function summarizeTrip({ days, kmRate, eventFee }, overrides = {}) {
  const rows = days.map((day, d) => {
    const legs = day.legs.map((leg, i) => {
      const km = overrides[legKey(d, i)];
      const adjusted = Number.isFinite(km) && km >= 0;
      return { from: leg.from, to: leg.to, km: adjusted ? Math.round(km * 10) / 10 : leg.km, ...(adjusted ? { adjusted: true } : {}) };
    });
    return { date: day.date ?? '', legs, totalKm: sumKm(legs.map((leg) => leg.km)), eventCount: day.eventCount };
  });
  const totalKm = sumKm(rows.map((day) => day.totalKm));
  const eventCount = rows.reduce((sum, day) => sum + day.eventCount, 0);
  const travelCost = roundMoney(totalKm * kmRate);
  const feesTotal = roundMoney(eventCount * eventFee);
  return { days: rows, totalKm, eventCount, kmRate, eventFee, travelCost, feesTotal, total: roundMoney(travelCost + feesTotal) };
}

/** 'YYYY-MM-DD' do dia seguinte (sem passar por fuso); '' se a data for inválida. */
export function nextDateKey(key) {
  if (!isValidDateInput(key)) return '';
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

const spaceOnly = (text) => text.replace(/\s/g, ' '); // o Intl separa "R$" e o número com espaço sem quebra
export const formatKm = (km) => `${spaceOnly(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(km))} km`;
export const formatBRL = (value) => spaceOnly(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0));

/** 'YYYY-MM-DD' -> 'DD/MM/AAAA' (sem passar por Date, que mudaria o dia conforme o fuso); '' se inválida. */
export function formatDateKey(key) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key ?? '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

/**
 * Texto pronto para colar no WhatsApp (negrito com *). Só rótulos dos pontos, nunca endereços.
 * `trip` = resultado de summarizeTrip. As datas dos dias abrem o texto; trechos corrigidos à mão levam "(ajustado)".
 * Com mais de um dia, cada dia vem com o seu subtotal antes do total geral.
 */
export function travelWhatsAppText(trip) {
  const many = trip.days.length > 1;
  const dates = trip.days.map((day) => formatDateKey(day.date)).filter(Boolean);
  const legLines = (day) => day.legs.map((leg) => `• ${leg.from} → ${leg.to}: ${formatKm(leg.km)}${leg.adjusted ? ' (ajustado)' : ''}`);
  const body = many
    ? trip.days.flatMap((day, i) => [
      '', `*Dia ${formatDateKey(day.date) || i + 1}*`, ...legLines(day),
      `*Subtotal:* ${formatKm(day.totalKm)} · ${day.eventCount} ${day.eventCount === 1 ? 'evento' : 'eventos'}`,
    ])
    : ['', '*Trechos*', ...legLines(trip.days[0])];
  return [
    ...(dates.length ? [`*${many ? 'Datas' : 'Data'}:* ${dates.join(', ')}`] : []),
    '*Deslocamento e cachês*',
    ...body,
    '',
    `*Total:* ${formatKm(trip.totalKm)}`,
    `*Deslocamento:* ${formatKm(trip.totalKm)} × ${formatBRL(trip.kmRate)} = ${formatBRL(trip.travelCost)}`,
    `*Cachês:* ${trip.eventCount} × ${formatBRL(trip.eventFee)} = ${formatBRL(trip.feesTotal)}`,
    '',
    `*TOTAL A RECEBER: ${formatBRL(trip.total)}*`,
  ].join('\n');
}

/** Número de WhatsApp (com ou sem 55) -> base do link wa.me, sem texto; null se o número for inválido. */
export function whatsAppBase(number) {
  let digits = String(number ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return /^55\d{10,11}$/.test(digits) ? `https://wa.me/${digits}` : null;
}

/** Base do link + texto pré-preenchido (o texto é montado na tela, depois dos ajustes). */
export const whatsAppLink = (base, text) => `${base}?text=${encodeURIComponent(text)}`;
