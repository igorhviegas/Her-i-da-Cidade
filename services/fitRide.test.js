import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, kmByDay, summarizeRide, summarizeRides } from './fitRide.js';

// Saída do fit-file-parser (mode 'list') reproduzindo as peculiaridades dos FIT reais do MyWhoosh, com valores fictícios.
const T0 = Date.UTC(2026, 9, 7, 20, 4, 27);
const at = (s) => new Date(T0 + s * 1000);
function parsed({ seconds = 100, stopped = [], overrides = {}, session = {} } = {}) {
  const records = Array.from({ length: seconds }, (_, i) => ({
    timestamp: at(i), heart_rate: 0, power: 0, position_lat: 24.8, position_long: 55.3, altitude: 3,
    speed: stopped.includes(i) ? 0 : 7, cadence: stopped.includes(i) ? 0 : 90, distance: i * 7,
  }));
  return {
    file_ids: [{ type: 'activity', manufacturer: 'mywhoosh', product: 3570, serial_number: 3313379353, time_created: at(0) }],
    sessions: [{ start_time: at(0), timestamp: at(0), total_elapsed_time: seconds, total_timer_time: seconds, sport: 'cycling', sub_sport: 'virtual_activity', total_distance: (seconds - 1) * 7, avg_speed: 0, avg_heart_rate: 0, avg_power: 0, total_calories: 0, ...session }],
    records, ...overrides,
  };
}

test('resumo recalculado dos registros: ignora o avg_speed 0 da sessão, FC/potência/GPS e usa tempo em movimento', () => {
  const { id, ride } = summarizeRide(parsed({ seconds: 100, stopped: [10, 11, 12, 13, 14] }));
  assert.equal(id, 'mywhoosh_3313379353_20261007T200427Z');
  assert.deepEqual(ride, {
    source: 'mywhoosh', sourceKey: id, sport: 'cycling', virtual: true, startedAt: at(0),
    durationSec: 100, movingSec: 94, // o último registro não tem intervalo; 5 s parado
    distanceKm: 0.693, avgSpeedKmh: 26.54, maxSpeedKmh: 25.2, avgCadenceRpm: 90, // 693 m / 94 s em movimento (a sessão dizia avg_speed 0)
  });
  assert.equal('heartRate' in ride || 'power' in ride || 'calories' in ride || 'lat' in ride, false);
});

test('a identidade é fabricante + série + time_created: mesmo arquivo = mesmo id; outro treino do mesmo aparelho = outro id', () => {
  const a = summarizeRide(parsed());
  const again = summarizeRide(parsed());
  const other = parsed();
  other.file_ids[0].time_created = at(3600);
  assert.equal(a.id, again.id);
  assert.notEqual(a.id, summarizeRide(other).id);
});

test('pausa longa entre registros não conta como movimento; sem cadência a média é omitida', () => {
  const p = parsed({ seconds: 4 });
  p.records[2].timestamp = at(60); p.records[3].timestamp = at(61); // buraco de 59 s
  p.records.forEach((r) => { r.cadence = 0; });
  const { ride } = summarizeRide(p);
  assert.equal(ride.movingSec, 12); // 0→1: 1 s; 1→60: o buraco de 59 s conta só 10 s; 60→61: 1 s
  assert.equal('avgCadenceRpm' in ride, false);
});

test('rejeita o que não é pedalada utilizável, com mensagem clara', () => {
  assert.match(summarizeRide(null).error, /não é uma atividade/);
  assert.match(summarizeRide(parsed({ session: { sport: 'running' } })).error, /Só pedaladas/);
  assert.match(summarizeRide(parsed({ overrides: { file_ids: [{ manufacturer: 'mywhoosh' }] } })).error, /identificar o treino/);
  assert.match(summarizeRide(parsed({ overrides: { records: [] } })).error, /registros/);
  assert.match(summarizeRide(parsed({ seconds: 5, stopped: [0, 1, 2, 3, 4] })).error, /movimento/);
});

test('kmByDay e summarizeRides: dia sem pedalada é null; velocidade média ponderada pelo tempo em movimento', () => {
  const rides = [
    { startedAt: new Date('2026-10-07T20:00:00Z'), distanceKm: 4, movingSec: 600 },
    { startedAt: new Date('2026-10-07T23:00:00Z'), distanceKm: 1, movingSec: 600 },
    { startedAt: new Date('2026-10-05T12:00:00Z'), distanceKm: 10, movingSec: 1800 },
  ];
  const dayOf = (d) => d.toISOString().slice(0, 10);
  assert.deepEqual(kmByDay(['2026-10-05', '2026-10-06', '2026-10-07'], rides, dayOf), [10, null, 5]);
  const s = summarizeRides(rides);
  assert.equal(s.count, 3); assert.equal(s.km, 15);
  assert.equal(s.avgSpeedKmh, 15 / (3000 / 3600)); // 18 km/h, não a média simples das médias
  assert.equal(summarizeRides([]).avgSpeedKmh, null);
});

test('formatDuration', () => {
  assert.equal(formatDuration(625), '10min 25s');
  assert.equal(formatDuration(80), '1min 20s');
  assert.equal(formatDuration(3725), '1h 02min');
});
