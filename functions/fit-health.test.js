import test from 'node:test';
import assert from 'node:assert/strict';
import { describeInvalidPayload, parseDailyPush, writeFitDaily } from './fit-health.js';

test('envio de um dia: aceita número ou texto numérico (vírgula do pt-BR), arredonda e descarta campo desconhecido, contando', () => {
  const { days, stats } = parseDailyPush({ day: '2026-10-07', steps: 2431, walkRunKm: '1,8', weightKg: '72.123', cadence: 90, heartRate: 70 });
  assert.deepEqual(days, { '2026-10-07': { steps: 2431, walkRunKm: 1.8, weightKg: 72.12 } });
  assert.deepEqual(stats, { accepted: 3, ignoredFields: 2, invalid: 0 });
  assert.deepEqual(parseDailyPush({ day: '2026-10-07', steps: 0 }).days, { '2026-10-07': { steps: 0 } }); // zero é dado
  assert.deepEqual(parseDailyPush({ day: '2026-10-07', steps: 5, walkRunKm: 5.5176059397868809 }).days['2026-10-07'], { steps: 5, walkRunKm: 5.518 });
});

test('valor fora do plausível, texto não numérico, vazio, nulo ou negativo é descartado e contado, sem adivinhar', () => {
  const bad = parseDailyPush({ day: '2026-10-07', steps: 999999, walkRunKm: 'abc', cyclingKm: '', weightKg: 5, activeKcal: null, exerciseMin: -1 });
  assert.deepEqual(bad.days, {});
  assert.equal(bad.stats.invalid, 6);
  assert.equal(parseDailyPush({ day: '2026-10-07', weightKg: 520 }).stats.invalid, 1);
});

test('corpo sem day válido não é um envio (null); só o day não grava nada', () => {
  for (const body of [null, undefined, 'x', [], {}, { steps: 1 }, { day: 20261007, steps: 1 }, { day: '', steps: 1 }, { day: '2026-02-31', steps: 1 }]) assert.equal(parseDailyPush(body), null, JSON.stringify(body));
  assert.deepEqual(parseDailyPush({ day: '2026-10-07' }), { days: {}, stats: { accepted: 0, ignoredFields: 0, invalid: 0 } });
});

test('day tolerante: ignora marcas invisíveis do iOS e espaços, aceita hora e DD/MM/AAAA; o que não é data continua recusado', () => {
  const ok = (day) => parseDailyPush({ day, steps: 5 })?.days;
  const expected = { '2026-10-07': { steps: 5 } };
  for (const day of ['2026-10-07', '2026-10-07\n', ' 2026-10-07 ', '‎2026-10-07‏', '⁦2026-10-07⁩', '﻿2026-10-07', '2026-10-07 19:06', '2026-10-07T19:06:00-03:00', '07/10/2026', '07/10/2026 19:06', '07/10/2026, 19:06']) {
    assert.deepEqual(ok(day), expected, JSON.stringify(day));
  }
  for (const day of ['31/02/2026', '2026-13-01', '2026-02-30', 'abc', '2026-10-0', '7/10/2026', '2026/10/07', '12026-10-07', '2026-10-07x']) assert.equal(ok(day), undefined, JSON.stringify(day));
});

test('writeFitDaily: um doc por dia em users/{uid}/fitDaily, merge, em lotes; reenvio cai no mesmo caminho', async () => {
  const writes = []; let commits = 0;
  const database = {
    collection: (c) => ({ doc: (id) => ({ collection: (sub) => ({ doc: (day) => ({ path: `${c}/${id}/${sub}/${day}` }) }) }) }),
    batch: () => ({ set: (ref, data, options) => writes.push({ ref, data, options }), commit: async () => { commits += 1; } }),
  };
  const now = new Date('2026-10-08T12:00:00Z');
  const days = Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`d${i}`, { steps: i }]));
  assert.equal(await writeFitDaily(database, 'uid123', days, now), 401);
  assert.equal(commits, 2); // 400 + 1
  assert.equal(writes[0].ref.path, 'users/uid123/fitDaily/d0');
  assert.deepEqual(writes[0].data, { steps: 0, day: 'd0', source: 'atalho-ios', updatedAt: now });
  assert.deepEqual(writes[0].options, { merge: true });
});

test('describeInvalidPayload: diz só nome e tipo dos campos, nunca o valor, e aponta o day no tipo errado', () => {
  const wrongType = describeInvalidPayload({ day: 20261007, steps: 2431, weightKg: '72 kg' });
  assert.match(wrongType.message, /"day" precisa ser texto.*recebido: número/);
  assert.deepEqual(wrongType.received, { day: 'número', steps: 'número', weightKg: 'texto' });
  assert.doesNotMatch(JSON.stringify(wrongType), /20261007|2431|72 kg/); // nenhum valor de saúde na resposta
  assert.match(describeInvalidPayload({ day: '07-10' }).message, /recebido: texto fora do formato/);
  assert.match(describeInvalidPayload({ steps: 1 }).message, /Faltou o campo "day"/);
  assert.deepEqual(describeInvalidPayload(null), { message: 'O corpo precisa ser um JSON (objeto).', received: 'nulo' });
  assert.equal(describeInvalidPayload([1]).received, 'lista');
  assert.equal(Object.keys(describeInvalidPayload(Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]))).received).length, 20); // limita o tamanho
});

test('describeInvalidPayload: dayShape mostra a forma do texto (e caracteres invisíveis), não o valor', () => {
  const d = describeInvalidPayload({ day: '2031/11/09‎', steps: 1 });
  assert.equal(d.dayShape, '9999/99/99<U+200E>');
  assert.doesNotMatch(JSON.stringify(d), /2031|11\/09/);
  assert.equal('dayShape' in describeInvalidPayload({ day: 5 }), false); // só para texto
  assert.equal(describeInvalidPayload({ day: 'x'.repeat(100) }).dayShape.length, 40);
});
