import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_DAYS, MAX_EVENTS, MAX_TOTAL_EVENTS, buildSequence, formatBRL, formatDateKey, legKey, metersToKm, nextDateKey, parseKm, summarizeTrip, travelWhatsAppText,
  validateTravelInput, whatsAppBase, whatsAppLink,
} from './travelCost.js';

const defaults = { start: { label: 'Casa A', address: 'addr-start' }, stop: { label: 'Casa B', address: 'addr-stop' }, end: { label: 'Casa A', address: 'addr-start' } };
const base = { events: ['Rua das Flores 10, Betim', 'Av. Brasil 200, Contagem'], kmRate: '1,90', eventFee: '115' };
const day = (over = {}) => validateTravelInput({ ...base, ...over }).value.days[0];
const labels = (seq) => seq.map((p) => p.label);

test('validação: eventos, endereços, valores e limites', () => {
  assert.deepEqual(validateTravelInput(base).value, {
    days: [{ date: '', events: base.events, start: null, end: null, useStop: true, stop: null }], kmRate: 1.9, eventFee: 115,
  });
  assert.match(validateTravelInput({ ...base, events: [] }).error, /^Informe pelo menos um evento/);
  assert.match(validateTravelInput({ ...base, events: ['ab'] }).error, /Evento 1/);
  assert.match(validateTravelInput({ ...base, events: Array(MAX_EVENTS + 1).fill('Rua das Flores 10') }).error, /limite/);
  assert.match(validateTravelInput({ ...base, events: ['Rua A 10, Betim', 'x'.repeat(201)] }).error, /Evento 2.*longo/);
  assert.match(validateTravelInput({ ...base, kmRate: '' }).error, /valor por km/);
  assert.match(validateTravelInput({ ...base, kmRate: '-1' }).error, /valor por km/);
  assert.match(validateTravelInput({ ...base, eventFee: 'abc' }).error, /cachê/);
  assert.match(validateTravelInput({ ...base, start: 42 }).error, /Ponto de partida/);
  assert.match(validateTravelInput({ ...base, date: '2026-02-31' }).error, /data válida/);
  assert.match(validateTravelInput(undefined).error, /pelo menos um evento/);
});

test('vários dias: cada dia validado com o seu número; limites de dias e de eventos no total', () => {
  const dia = (over = {}) => ({ date: '2026-10-10', events: ['Rua das Flores 10, Betim'], ...over });
  const ok = validateTravelInput({ days: [dia(), dia({ date: '2026-10-11', stop: false, start: 'Rua Nova 1, Betim' })], kmRate: '1,9', eventFee: '115' }).value;
  assert.deepEqual(ok.days.map((d) => [d.date, d.useStop, d.start]), [['2026-10-10', true, null], ['2026-10-11', false, 'Rua Nova 1, Betim']]);
  assert.match(validateTravelInput({ days: [dia(), dia({ events: [] })], kmRate: 1, eventFee: 1 }).error, /^Dia 2: informe pelo menos um evento/);
  assert.match(validateTravelInput({ days: [dia({ events: ['ab'] }), dia()], kmRate: 1, eventFee: 1 }).error, /^Dia 1: Evento 1/);
  assert.match(validateTravelInput({ days: [dia(), dia({ date: '31/10/2026' })], kmRate: 1, eventFee: 1 }).error, /^Dia 2: informe uma data válida/);
  assert.match(validateTravelInput({ days: [], kmRate: 1, eventFee: 1 }).error, /pelo menos um dia/);
  assert.match(validateTravelInput({ days: Array(MAX_DAYS + 1).fill(dia()), kmRate: 1, eventFee: 1 }).error, /dias por cálculo/);
  const cheio = () => dia({ events: Array(MAX_EVENTS).fill('Rua das Flores 10, Betim') });
  assert.equal(validateTravelInput({ days: Array(MAX_TOTAL_EVENTS / MAX_EVENTS).fill(cheio()), kmRate: 1, eventFee: 1 }).error, undefined);
  assert.match(validateTravelInput({ days: [...Array(MAX_TOTAL_EVENTS / MAX_EVENTS).fill(cheio()), dia()], kmRate: 1, eventFee: 1 }).error, /eventos por cálculo/);
});

test('parada: ausente/true = padrão, false/null = sem parada, texto = outra parada', () => {
  assert.equal(day().useStop, true);
  assert.equal(day({ stop: true }).useStop, true);
  assert.equal(day({ stop: false }).useStop, false);
  assert.equal(day({ stop: null }).useStop, false);
  assert.deepEqual([day({ stop: 'Rua da Parada 5, Betim' }).useStop, day({ stop: 'Rua da Parada 5, Betim' }).stop], [true, 'Rua da Parada 5, Betim']);
});

test('rota: início → parada → eventos → parada → destino (parada opcional)', () => {
  const comParada = buildSequence(day({ events: [...base.events, 'Rua Três 30, Betim'] }), defaults);
  assert.deepEqual(labels(comParada), ['Casa A', 'Casa B', 'Evento 1', 'Evento 2', 'Evento 3', 'Casa B', 'Casa A']);
  assert.deepEqual(comParada.map((p) => p.custom), [false, false, true, true, true, false, false]);
  const semParada = buildSequence(day({ stop: false }), defaults);
  assert.deepEqual(labels(semParada), ['Casa A', 'Evento 1', 'Evento 2', 'Casa A']);
  assert.equal(semParada[0].address, 'addr-start');
});

test('rota: outro início/destino/parada só neste dia; parada padrão ausente invalida', () => {
  const seq = buildSequence(day({ start: 'Rua Nova 1, Betim', end: 'Rua Fim 2, Betim', stop: 'Rua Parada 3, Betim' }), defaults);
  assert.deepEqual([seq[0].address, seq[1].address, seq.at(-1).address], ['Rua Nova 1, Betim', 'Rua Parada 3, Betim', 'Rua Fim 2, Betim']);
  assert.equal(seq[0].custom, true);
  assert.equal(buildSequence(day(), { start: defaults.start, stop: null }), null);
  assert.equal(buildSequence(day({ stop: false }), { start: defaults.start }).at(-1).address, 'addr-start'); // destino padrão = partida
});

const dia = (date, legs, eventCount) => ({ date, legs: legs.map((km, i) => ({ from: `P${i}`, to: `P${i + 1}`, km })), eventCount });

test('km: metros viram km com 1 casa; resumo de um dia soma os trechos como aparecem', () => {
  assert.equal(metersToKm(12340), 12.3);
  assert.equal(metersToKm(12350), 12.4);
  assert.equal(metersToKm(0), 0);
  const trip = summarizeTrip({ days: [dia('2026-10-10', [12.3, 5, 17.6], 3)], kmRate: 1.9, eventFee: 115 });
  assert.deepEqual(trip.days[0].legs.map((l) => l.km), [12.3, 5, 17.6]);
  assert.deepEqual([trip.totalKm, trip.travelCost, trip.eventCount, trip.feesTotal, trip.total], [34.9, 66.31, 3, 345, 411.31]); // 34,9 × 1,90
});

test('vários dias: o total soma os km e os cachês de todos os dias; subtotal por dia', () => {
  const trip = summarizeTrip({ days: [dia('2026-10-10', [10, 5.5, 10], 2), dia('2026-10-11', [20.2, 8, 20.2], 3)], kmRate: 2, eventFee: 100 });
  assert.deepEqual(trip.days.map((d) => [d.totalKm, d.eventCount]), [[25.5, 2], [48.4, 3]]);
  assert.equal(trip.totalKm, 73.9);
  assert.equal(trip.travelCost, 147.8);
  assert.deepEqual([trip.eventCount, trip.feesTotal, trip.total], [5, 500, 647.8]);
});

test('ajuste manual de km: por dia e trecho; refaz subtotais, total e valores', () => {
  const input = { days: [dia('2026-10-10', [12.3, 5, 17.6], 3), dia('2026-10-11', [10, 10], 1)], kmRate: 1.9, eventFee: 115 };
  const base = summarizeTrip(input);
  assert.deepEqual(summarizeTrip(input, {}), base); // sem ajustes: idêntico ao calculado
  const adjusted = summarizeTrip(input, { [legKey(0, 1)]: 8.2, [legKey(1, 0)]: 0 });
  assert.deepEqual(adjusted.days[0].legs.map((l) => [l.km, !!l.adjusted]), [[12.3, false], [8.2, true], [17.6, false]]);
  assert.deepEqual(adjusted.days[1].legs.map((l) => [l.km, !!l.adjusted]), [[0, true], [10, false]]);
  assert.deepEqual([adjusted.days[0].totalKm, adjusted.days[1].totalKm, adjusted.totalKm], [38.1, 10, 48.1]);
  assert.equal(adjusted.travelCost, 91.39); // 48,1 × 1,90
  assert.equal(base.totalKm, 54.9); // o resumo original não é alterado
  assert.equal(summarizeTrip(input, { [legKey(0, 0)]: 12.3 }).days[0].legs[0].adjusted, true); // mesmo valor, mas marcado como ajustado pelo agente
});

test('km digitado: vírgula ou ponto, 1 casa, recusa vazio, negativo, texto e absurdo', () => {
  assert.equal(parseKm('12,5'), 12.5);
  assert.equal(parseKm(' 7.25 '), 7.3);
  assert.equal(parseKm('0'), 0);
  for (const bad of ['', '  ', '-1', 'abc', '3001', null, undefined]) assert.equal(parseKm(bad), null, String(bad));
});

test('datas: formato brasileiro sem fuso e dia seguinte', () => {
  assert.equal(formatDateKey('2026-02-03'), '03/02/2026');
  assert.equal(formatDateKey('07/10/2026'), '');
  assert.equal(formatDateKey(undefined), '');
  assert.equal(nextDateKey('2026-10-10'), '2026-10-11');
  assert.equal(nextDateKey('2026-10-31'), '2026-11-01');
  assert.equal(nextDateKey('2026-12-31'), '2027-01-01');
  assert.equal(nextDateKey('2026-02-31'), '');
  assert.equal(nextDateKey(''), '');
});

test('texto do WhatsApp (1 dia): data abre o texto, trechos, totais e valor final, sem endereços', () => {
  const trip = summarizeTrip({ days: [{ date: '2026-10-07', legs: [{ from: 'Casa A', to: 'Evento 1', km: 10 }, { from: 'Evento 1', to: 'Casa A', km: 10 }], eventCount: 1 }], kmRate: 1.9, eventFee: 115 });
  assert.equal(travelWhatsAppText(trip), [
    '*Data:* 07/10/2026', '*Deslocamento e cachês*', '', '*Trechos*', '• Casa A → Evento 1: 10,0 km', '• Evento 1 → Casa A: 10,0 km', '',
    '*Total:* 20,0 km', '*Deslocamento:* 20,0 km × R$ 1,90 = R$ 38,00', '*Cachês:* 1 × R$ 115,00 = R$ 115,00', '', '*TOTAL A RECEBER: R$ 153,00*',
  ].join('\n'));
  const semData = travelWhatsAppText(summarizeTrip({ days: [{ ...trip.days[0], date: '' }], kmRate: 1.9, eventFee: 115 }));
  assert.equal(semData.split('\n')[0], '*Deslocamento e cachês*');
  assert.equal(formatBRL(1234.5), 'R$ 1.234,50');
});

test('texto do WhatsApp (vários dias): datas no início, cada dia com subtotal e o total geral; "(ajustado)" no trecho corrigido', () => {
  const input = {
    days: [
      { date: '2026-10-10', legs: [{ from: 'Casa A', to: 'Evento 1', km: 10 }, { from: 'Evento 1', to: 'Casa A', km: 10 }], eventCount: 1 },
      { date: '2026-10-11', legs: [{ from: 'Casa A', to: 'Evento 1', km: 20 }, { from: 'Evento 1', to: 'Evento 2', km: 5 }, { from: 'Evento 2', to: 'Casa A', km: 20 }], eventCount: 2 },
    ],
    kmRate: 2, eventFee: 100,
  };
  assert.equal(travelWhatsAppText(summarizeTrip(input, { [legKey(1, 1)]: 7 })), [
    '*Datas:* 10/10/2026, 11/10/2026', '*Deslocamento e cachês*',
    '', '*Dia 10/10/2026*', '• Casa A → Evento 1: 10,0 km', '• Evento 1 → Casa A: 10,0 km', '*Subtotal:* 20,0 km · 1 evento',
    '', '*Dia 11/10/2026*', '• Casa A → Evento 1: 20,0 km', '• Evento 1 → Evento 2: 7,0 km (ajustado)', '• Evento 2 → Casa A: 20,0 km', '*Subtotal:* 47,0 km · 2 eventos',
    '', '*Total:* 67,0 km', '*Deslocamento:* 67,0 km × R$ 2,00 = R$ 134,00', '*Cachês:* 3 × R$ 100,00 = R$ 300,00', '', '*TOTAL A RECEBER: R$ 434,00*',
  ].join('\n'));
  const semDatas = travelWhatsAppText(summarizeTrip({ ...input, days: input.days.map((d) => ({ ...d, date: '' })) }));
  assert.equal(semDatas.split('\n')[0], '*Deslocamento e cachês*');
  assert.ok(semDatas.includes('*Dia 2*'));
});

test('link do WhatsApp: base aceita número com ou sem DDI e recusa inválido; texto vai codificado', () => {
  assert.equal(whatsAppBase('(31) 91234-5678'), 'https://wa.me/5531912345678');
  assert.equal(whatsAppBase('5531912345678'), 'https://wa.me/5531912345678');
  assert.equal(whatsAppBase(''), null);
  assert.equal(whatsAppBase('123'), null);
  assert.equal(whatsAppLink('https://wa.me/5531912345678', 'oi mundo'), 'https://wa.me/5531912345678?text=oi%20mundo');
});
