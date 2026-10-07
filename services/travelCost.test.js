import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_EVENTS, applyKmOverrides, buildSequence, formatBRL, formatDateKey, metersToKm, parseKm, summarizeTravel, travelWhatsAppText, validateTravelInput, whatsAppBase, whatsAppLink } from './travelCost.js';

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

test('data abre o texto do WhatsApp; sem data (ou inválida) o texto não tem a linha', () => {
  const summary = summarizeTravel({ legs: [{ from: 'Casa A', to: 'Evento 1', meters: 10000 }], kmRate: 1.9, eventFee: 115, eventCount: 1 });
  const lines = travelWhatsAppText(summary, { date: '2026-10-07' }).split('\n');
  assert.deepEqual(lines.slice(0, 3), ['*Data:* 07/10/2026', '*Deslocamento e cachês*', '']);
  assert.equal(travelWhatsAppText(summary).split('\n')[0], '*Deslocamento e cachês*');
  assert.equal(travelWhatsAppText(summary, { date: '' }).split('\n')[0], '*Deslocamento e cachês*');
  assert.equal(formatDateKey('2026-02-03'), '03/02/2026');
  assert.equal(formatDateKey('07/10/2026'), '');
  assert.equal(formatDateKey(undefined), '');
});

test('km digitado: vírgula ou ponto, 1 casa, recusa vazio, negativo, texto e absurdo', () => {
  assert.equal(parseKm('12,5'), 12.5);
  assert.equal(parseKm(' 7.25 '), 7.3);
  assert.equal(parseKm('0'), 0);
  for (const bad of ['', '  ', '-1', 'abc', '3001', null, undefined]) assert.equal(parseKm(bad), null, String(bad));
});

test('ajuste manual de km: refaz total, valores e texto; só os trechos corrigidos levam "(ajustado)"', () => {
  const base = summarizeTravel({
    legs: [{ from: 'A', to: 'B', meters: 12340 }, { from: 'B', to: 'C', meters: 5040 }, { from: 'C', to: 'A', meters: 17640 }],
    kmRate: 1.9, eventFee: 115, eventCount: 3,
  });
  assert.deepEqual(applyKmOverrides(base, {}), base); // sem ajustes: idêntico ao calculado
  const adjusted = applyKmOverrides(base, { 1: 8.2, 2: 0 });
  assert.deepEqual(adjusted.legs.map((l) => l.km), [12.3, 8.2, 0]);
  assert.deepEqual(adjusted.legs.map((l) => !!l.adjusted), [false, true, true]);
  assert.equal(adjusted.totalKm, 20.5);
  assert.equal(adjusted.travelCost, 38.95); // 20,5 × 1,90
  assert.equal(adjusted.total, 383.95);
  assert.equal(base.totalKm, 34.9); // o resumo original não é alterado
  const text = travelWhatsAppText(adjusted);
  assert.ok(text.includes('• B → C: 8,2 km (ajustado)'));
  assert.ok(text.includes('• A → B: 12,3 km\n'));
  assert.equal(applyKmOverrides(base, { 0: 12.3 }).legs[0].adjusted, true); // mesmo valor, mas marcado como ajustado pelo agente
});

test('link do WhatsApp: base aceita número com ou sem DDI e recusa inválido; texto vai codificado', () => {
  assert.equal(whatsAppBase('(31) 91234-5678'), 'https://wa.me/5531912345678');
  assert.equal(whatsAppBase('5531912345678'), 'https://wa.me/5531912345678');
  assert.equal(whatsAppBase(''), null);
  assert.equal(whatsAppBase('123'), null);
  assert.equal(whatsAppLink('https://wa.me/5531912345678', 'oi mundo'), 'https://wa.me/5531912345678?text=oi%20mundo');
});
