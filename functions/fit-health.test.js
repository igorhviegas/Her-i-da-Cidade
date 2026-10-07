import test from 'node:test';
import assert from 'node:assert/strict';
import { describeInvalidPayload, parseHealthExport, writeFitDaily } from './fit-health.js';

// Mesma forma do export real do Health Auto Export (v2, resumo diário, só iPhone), com valores fictícios.
const m = (name, units, data) => ({ name, units, data: data.map(([date, qty]) => ({ date: `${date} 00:00:00 -0300`, qty, source: 'iPhone' })) });
const payload = (...metrics) => ({ data: { metrics } });
const sample = payload(
  m('walking_step_length', 'cm', [['2026-10-01', 68.41666666666667]]),
  m('step_count', 'count', [['2026-10-01', 7240], ['2026-10-02', 6670], ['2026-10-03', 0]]),
  m('walking_running_distance', 'km', [['2026-10-01', 5.5176059397868809], ['2026-10-02', 4.876169212293199]]),
  m('flights_climbed', 'count', [['2026-10-01', 3]]),
  m('weight_body_mass', 'kg', [['2026-10-03', 72.123]]),
  m('walking_speed', 'km/hr', [['2026-10-01', 4.6]]),
);

test('export real: guarda só o que o Fit usa, no dia local, arredondado; o resto é descartado', () => {
  const { days, stats, workouts } = parseHealthExport(sample);
  assert.deepEqual(days, {
    '2026-10-01': { steps: 7240, walkRunKm: 5.518 },
    '2026-10-02': { steps: 6670, walkRunKm: 4.876 },
    '2026-10-03': { steps: 0, weightKg: 72.12 }, // zero é dado; dia sem registro continua sem o campo
  });
  assert.deepEqual(stats, { accepted: 6, ignoredMetrics: 3, invalid: 0 });
  assert.equal(workouts, 0);
});

test('o dia vem do texto da data (local), sem converter para UTC', () => {
  const late = { data: { metrics: [{ name: 'step_count', units: 'count', data: [{ date: '2026-10-07 00:00:00 +0900', qty: 10 }, { date: '2026-10-08 00:00:00 -1200', qty: 20 }] }] } };
  assert.deepEqual(Object.keys(parseHealthExport(late).days), ['2026-10-07', '2026-10-08']);
});

test('converte unidades conhecidas e descarta o que não entende, sem adivinhar', () => {
  const { days, stats } = parseHealthExport(payload(
    m('walking_running_distance', 'mi', [['2026-10-01', 1]]),
    m('active_energy', 'kJ', [['2026-10-01', 418.4]]),
    m('weight_body_mass', 'lb', [['2026-10-01', 150]]),
    m('basal_energy_burned', 'furlongs', [['2026-10-01', 5]]),
  ));
  assert.deepEqual(days['2026-10-01'], { walkRunKm: 1.609, activeKcal: 100, weightKg: 68.04 });
  assert.equal(stats.invalid, 1);
});

test('registro inválido é descartado: data fora do padrão, qty não numérico, valor implausível ou métrica diária não resumida', () => {
  const bad = {
    data: { metrics: [
      { name: 'step_count', units: 'count', data: [
        { date: '2026-10-01T00:00:00Z', qty: 5 },
        { date: '2026-10-02 00:00:00 -0300', qty: '5' },
        { date: '2026-10-03 00:00:00 -0300', qty: -1 },
        { date: '2026-10-04 00:00:00 -0300', qty: 999999 },
        { date: '2026-10-05 13:00:00 -0300', qty: 100 }, // por hora: a métrica diária precisa vir resumida
        { date: '2026-10-06 00:00:00 -0300', qty: null },
        null,
      ] },
      { name: 'weight_body_mass', units: 'kg', data: [{ date: '2026-10-01 07:00:00 -0300', qty: 5 }] },
      { name: 'step_count', units: 'count', data: 'x' },
    ] },
  };
  const { days, stats } = parseHealthExport(bad);
  assert.deepEqual(days, {});
  assert.deepEqual(stats, { accepted: 0, ignoredMetrics: 0, invalid: 9 });
});

test('duas entradas do mesmo dia: somáveis ficam com a maior (não conta duas vezes), peso fica com a última pesagem', () => {
  const { days } = parseHealthExport({ data: { metrics: [
    { name: 'step_count', units: 'count', data: [{ date: '2026-10-01 00:00:00 -0300', qty: 100, source: 'iPhone' }, { date: '2026-10-01 00:00:00 -0300', qty: 130, source: 'Apple Watch' }] },
    { name: 'weight_body_mass', units: 'kg', data: [{ date: '2026-10-01 20:00:00 -0300', qty: 71 }, { date: '2026-10-01 07:00:00 -0300', qty: 72 }] },
  ] } });
  assert.deepEqual(days['2026-10-01'], { steps: 130, weightKg: 71 });
});

test('corpo que não é export do app devolve null; treinos são só contados (formato ainda não validado)', () => {
  for (const body of [null, undefined, 'x', {}, { data: {} }, { data: { metrics: 'x' } }]) assert.equal(parseHealthExport(body), null);
  assert.equal(parseHealthExport({ data: { metrics: [], workouts: [{ id: 'a' }, { id: 'b' }] } }).workouts, 2);
});

test('envio simples de um dia (Atalho do iPhone): mesmos campos e limites; texto numérico com vírgula vale; o resto é descartado e contado', () => {
  const { days, stats } = parseHealthExport({ day: '2026-10-07', steps: 2431, walkRunKm: '1,8', weightKg: '72.0', cadence: 90, heartRate: 70 });
  assert.deepEqual(days, { '2026-10-07': { steps: 2431, walkRunKm: 1.8, weightKg: 72 } });
  assert.deepEqual(stats, { accepted: 3, ignoredMetrics: 2, invalid: 0 });
  // inválidos: fora do plausível, texto não numérico, vazio, nulo, negativo, peso absurdo
  const bad = parseHealthExport({ day: '2026-10-07', steps: 999999, walkRunKm: 'abc', cyclingKm: '', weightKg: 5, activeKcal: null, exerciseMin: -1 });
  assert.deepEqual(bad.days, {});
  assert.equal(bad.stats.invalid, 6);
  assert.deepEqual(parseHealthExport({ day: '2026-10-07', steps: 0 }).days, { '2026-10-07': { steps: 0 } }); // zero é dado
});

test('envio simples: dia inválido ou ausente não é um payload (null); o formato do app continua valendo', () => {
  for (const day of ['2026-02-31', '07/10/2026', '2026-10-07T00:00:00Z', '', 20261007, undefined]) assert.equal(parseHealthExport({ day, steps: 1 }), null);
  assert.equal(parseHealthExport([]), null);
  assert.equal(parseHealthExport({ day: '2026-10-07' }).stats.accepted, 0); // só o dia: nada a gravar
  assert.equal(parseHealthExport(sample).stats.accepted, 6); // export do app inalterado
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
  assert.deepEqual(writes[0].data, { steps: 0, day: 'd0', source: 'health-auto-export', updatedAt: now });
  assert.deepEqual(writes[0].options, { merge: true });
});

test('describeInvalidPayload: diz só nome e tipo dos campos, nunca o valor, e aponta o day no tipo errado', () => {
  const wrongType = describeInvalidPayload({ day: 20261007, steps: 2431, weightKg: '72 kg' });
  assert.match(wrongType.message, /"day" precisa ser texto.*recebido: número/);
  assert.deepEqual(wrongType.received, { day: 'número', steps: 'número', weightKg: 'texto' });
  assert.doesNotMatch(JSON.stringify(wrongType), /20261007|2431|72 kg/); // nenhum valor de saúde na resposta
  assert.match(describeInvalidPayload({ day: '07/10/2026' }).message, /recebido: texto fora do formato/);
  assert.match(describeInvalidPayload({ steps: 1 }).message, /Faltou o campo "day"/);
  assert.match(describeInvalidPayload({ data: {} }).message, /data\.metrics/);
  assert.deepEqual(describeInvalidPayload(null), { message: 'O corpo precisa ser um JSON (objeto).', received: 'nulo' });
  assert.equal(describeInvalidPayload([1]).received, 'lista');
  assert.equal(Object.keys(describeInvalidPayload(Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, i]))).received).length, 20); // limita o tamanho
});
