import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_EVENTS, buildSequence, formatBRL, metersToKm, summarizeTravel, travelWhatsAppText, validateTravelInput, whatsAppLink } from './travelCost.js';

const defaults = { start: { label: 'Casa A', address: 'addr-start' }, stop: { label: 'Casa B', address: 'addr-stop' }, end: { label: 'Casa A', address: 'addr-start' } };
const base = { events: ['Rua das Flores 10, Betim', 'Av. Brasil 200, Contagem'], kmRate: '1,90', eventFee: '115' };
const input = (over = {}) => validateTravelInput({ ...base, ...over }).value;
const labels = (seq) => seq.map((p) => p.label);

test('validação: eventos, endereços, valores e limites', () => {
  assert.deepEqual(input(), { events: base.events, start: null, end: null, useStop: true, stop: null, kmRate: 1.9, eventFee: 115 });
  assert.match(validateTravelInput({ ...base, events: [] }).error, /pelo menos um evento/);
  assert.match(validateTravelInput({ ...base, events: ['ab'] }).error, /Evento 1/);
  assert.match(validateTravelInput({ ...base, events: Array(MAX_EVENTS + 1).fill('Rua das Flores 10') }).error, /limite/);
  assert.match(validateTravelInput({ ...base, events: ['Rua A 10, Betim', 'x'.repeat(201)] }).error, /Evento 2.*longo/);
  assert.match(validateTravelInput({ ...base, kmRate: '' }).error, /valor por km/);
  assert.match(validateTravelInput({ ...base, kmRate: '-1' }).error, /valor por km/);
  assert.match(validateTravelInput({ ...base, eventFee: 'abc' }).error, /cachê/);
  assert.match(validateTravelInput({ ...base, start: 42 }).error, /Ponto de partida/);
  assert.match(validateTravelInput(undefined).error, /pelo menos um evento/);
});

test('parada: ausente/true = padrão, false/null = sem parada, texto = outra parada', () => {
  assert.equal(input().useStop, true);
  assert.equal(input({ stop: true }).useStop, true);
  assert.equal(input({ stop: false }).useStop, false);
  assert.equal(input({ stop: null }).useStop, false);
  assert.deepEqual([input({ stop: 'Rua da Parada 5, Betim' }).useStop, input({ stop: 'Rua da Parada 5, Betim' }).stop], [true, 'Rua da Parada 5, Betim']);
});

test('rota: início → parada → eventos → parada → destino (parada opcional)', () => {
  const comParada = buildSequence(input({ events: [...base.events, 'Rua Três 30, Betim'] }), defaults);
  assert.deepEqual(labels(comParada), ['Casa A', 'Casa B', 'Evento 1', 'Evento 2', 'Evento 3', 'Casa B', 'Casa A']);
  assert.deepEqual(comParada.map((p) => p.custom), [false, false, true, true, true, false, false]);
  const semParada = buildSequence(input({ stop: false }), defaults);
  assert.deepEqual(labels(semParada), ['Casa A', 'Evento 1', 'Evento 2', 'Casa A']);
  assert.equal(semParada[0].address, 'addr-start');
});

test('rota: outro início/destino/parada só neste cálculo; parada padrão ausente invalida', () => {
  const seq = buildSequence(input({ start: 'Rua Nova 1, Betim', end: 'Rua Fim 2, Betim', stop: 'Rua Parada 3, Betim' }), defaults);
  assert.deepEqual(seq.map((p) => p.address).filter((a, i) => i === 0 || i === seq.length - 1 || i === 1), ['Rua Nova 1, Betim', 'Rua Parada 3, Betim', 'Rua Fim 2, Betim']);
  assert.equal(seq[0].custom, true);
  assert.equal(buildSequence(input(), { start: defaults.start, stop: null }), null);
  assert.equal(buildSequence(input({ stop: false }), { start: defaults.start }).at(-1).address, 'addr-start'); // destino padrão = partida
});

test('km: trechos arredondados a 1 casa e o total soma o que aparece', () => {
  assert.equal(metersToKm(12340), 12.3);
  assert.equal(metersToKm(12350), 12.4);
  assert.equal(metersToKm(0), 0);
  const summary = summarizeTravel({
    legs: [{ from: 'A', to: 'B', meters: 12340 }, { from: 'B', to: 'C', meters: 5040 }, { from: 'C', to: 'A', meters: 17640 }],
    kmRate: 1.9, eventFee: 115, eventCount: 3,
  });
  assert.deepEqual(summary.legs.map((l) => l.km), [12.3, 5, 17.6]);
  assert.equal(summary.totalKm, 34.9);
  assert.equal(summary.travelCost, 66.31); // 34,9 × 1,90
  assert.equal(summary.feesTotal, 345);
  assert.equal(summary.total, 411.31);
});

test('texto do WhatsApp: trechos, totais e valor final, sem endereços', () => {
  const summary = summarizeTravel({ legs: [{ from: 'Casa A', to: 'Evento 1', meters: 10000 }, { from: 'Evento 1', to: 'Casa A', meters: 10000 }], kmRate: 1.9, eventFee: 115, eventCount: 1 });
  const text = travelWhatsAppText(summary);
  assert.equal(text, [
    '*Deslocamento e cachês*', '', '*Trechos*', '• Casa A → Evento 1: 10,0 km', '• Evento 1 → Casa A: 10,0 km', '',
    '*Total:* 20,0 km', '*Deslocamento:* 20,0 km × R$ 1,90 = R$ 38,00', '*Cachês:* 1 × R$ 115,00 = R$ 115,00', '', '*TOTAL A RECEBER: R$ 153,00*',
  ].join('\n'));
  assert.equal(formatBRL(1234.5), 'R$ 1.234,50');
});

test('link do WhatsApp: aceita número com ou sem DDI, recusa inválido', () => {
  assert.equal(whatsAppLink('(31) 91234-5678', 'oi mundo'), 'https://wa.me/5531912345678?text=oi%20mundo');
  assert.equal(whatsAppLink('5531912345678', 'x'), 'https://wa.me/5531912345678?text=x');
  assert.equal(whatsAppLink('', 'x'), null);
  assert.equal(whatsAppLink('123', 'x'), null);
});
