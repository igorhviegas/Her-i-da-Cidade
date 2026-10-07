// Cálculo de deslocamento dos eventos (sem Firebase/React; testado em Node). Usado pelo servidor (functions/travel-route.js)
// e pela tela do agente. Aqui não existe nenhum endereço: os padrões ficam só no servidor (docs/deslocamento.md).
//
// Rota: início -> [parada] -> evento 1 -> ... -> evento N -> [parada] -> destino final.

import { money, roundMoney } from './eventForm.js';

export const DEFAULT_KM_RATE = 1.9;
export const DEFAULT_EVENT_FEE = 115;
/** Routes API (Essentials) aceita 10 pontos intermediários: eventos + as 2 passagens pela parada. */
export const MAX_EVENTS = 8;
export const MIN_ADDRESS_LENGTH = 5;
export const MAX_ADDRESS_LENGTH = 200;
export const MAX_KM_RATE = 100;
export const MAX_EVENT_FEE = 100000;

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

/**
 * Valida o corpo da requisição. Retorna { error } ou { value }.
 * - events: lista de endereços de eventos, na ordem em que serão percorridos (1 a MAX_EVENTS).
 * - start / end: ausente ou '' = endereço padrão; texto = outro endereço só para este cálculo.
 * - stop: null/false = sem parada; ausente, '' ou true = parada padrão; texto = outra parada.
 * - kmRate / eventFee: valor por km e cachê por evento (número ou texto "1,90").
 */
export function validateTravelInput(body) {
  const input = body && typeof body === 'object' ? body : {};
  if (!Array.isArray(input.events) || input.events.length === 0) return { error: 'Informe pelo menos um evento.' };
  if (input.events.length > MAX_EVENTS) return { error: `O limite é de ${MAX_EVENTS} eventos por cálculo.` };
  const events = [];
  for (let i = 0; i < input.events.length; i += 1) {
    const result = validAddress(input.events[i], `Evento ${i + 1}`);
    if (result.error) return result;
    events.push(result.value);
  }
  const optional = (raw, label) => {
    if (raw === undefined || raw === null || raw === '' || raw === true) return { value: null };
    if (typeof raw !== 'string') return { error: `${label}: endereço inválido.` };
    return validAddress(raw, label);
  };
  const start = optional(input.start, 'Ponto de partida');
  if (start.error) return start;
  const end = optional(input.end, 'Destino final');
  if (end.error) return end;
  let stop = { value: null }; // null = padrão
  let useStop = true;
  if (input.stop === null || input.stop === false) useStop = false;
  else { stop = optional(input.stop, 'Parada'); if (stop.error) return stop; }
  const kmRate = money(input.kmRate);
  if (kmRate === null || kmRate > MAX_KM_RATE) return { error: 'Informe um valor por km válido.' };
  const eventFee = money(input.eventFee);
  if (eventFee === null || eventFee > MAX_EVENT_FEE) return { error: 'Informe um cachê por evento válido.' };
  return { value: { events, start: start.value, end: end.value, useStop, stop: stop.value, kmRate, eventFee } };
}

/**
 * Sequência de pontos da rota. `defaults` = { start, stop?, end } com { label, address } (só no servidor).
 * Cada ponto: { role, label, address, custom }. `custom` = digitado pelo agente (o servidor mostra o endereço entendido).
 */
export function buildSequence(input, defaults) {
  const point = (role, label, custom, fallback) => (custom || fallback ? { role, label: custom ? label : fallback.label, address: custom ?? fallback.address, custom: !!custom } : null);
  const start = point('start', 'Ponto de partida', input.start, defaults.start);
  const end = point('end', 'Destino final', input.end, defaults.end ?? defaults.start);
  const stop = input.useStop ? point('stop', 'Parada', input.stop, defaults.stop) : null;
  if (input.useStop && !stop) return null; // parada padrão não configurada
  const events = input.events.map((address, i) => ({ role: 'event', label: `Evento ${i + 1}`, address, custom: true }));
  return [start, ...(stop ? [stop] : []), ...events, ...(stop ? [{ ...stop }] : []), end];
}

/** Metros -> km com 1 casa (é o que o agente vê, e o total soma exatamente o que está na tela). */
export const metersToKm = (meters) => Math.round((Number(meters) || 0) / 100) / 10;

/**
 * Resumo do cálculo. `legs` = [{ from, to, meters }] na ordem da rota.
 * Total de km = soma dos trechos já arredondados (fecha com a conta que o agente faz de cabeça).
 */
export function summarizeTravel({ legs, kmRate, eventFee, eventCount }) {
  const rows = legs.map((leg) => ({ from: leg.from, to: leg.to, km: metersToKm(leg.meters) }));
  const totalKm = Math.round(rows.reduce((sum, row) => sum + row.km * 10, 0)) / 10;
  const travelCost = roundMoney(totalKm * kmRate);
  const feesTotal = roundMoney(eventCount * eventFee);
  return { legs: rows, totalKm, kmRate, travelCost, eventCount, eventFee, feesTotal, total: roundMoney(travelCost + feesTotal) };
}

const nbspToSpace = (text) => text.replace(/ /g, ' ');
export const formatKm = (km) => `${nbspToSpace(new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(km))} km`;
export const formatBRL = (value) => nbspToSpace(new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0));

/** Texto pronto para colar no WhatsApp (negrito com *). Só rótulos dos pontos, nunca endereços. */
export function travelWhatsAppText(summary) {
  return [
    '*Deslocamento e cachês*',
    '',
    '*Trechos*',
    ...summary.legs.map((leg) => `• ${leg.from} → ${leg.to}: ${formatKm(leg.km)}`),
    '',
    `*Total:* ${formatKm(summary.totalKm)}`,
    `*Deslocamento:* ${formatKm(summary.totalKm)} × ${formatBRL(summary.kmRate)} = ${formatBRL(summary.travelCost)}`,
    `*Cachês:* ${summary.eventCount} × ${formatBRL(summary.eventFee)} = ${formatBRL(summary.feesTotal)}`,
    '',
    `*TOTAL A RECEBER: ${formatBRL(summary.total)}*`,
  ].join('\n');
}

/** Número de WhatsApp (só dígitos, com 55) -> link wa.me com o texto; null se o número for inválido. */
export function whatsAppLink(number, text) {
  let digits = String(number ?? '').replace(/\D/g, '');
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (!/^55\d{10,11}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
