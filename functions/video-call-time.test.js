import test from 'node:test';
import assert from 'node:assert/strict';
import { BUSINESS_TIME_ZONE, isValidTimeZone, localSlot, wallTime, zonedInstant } from './video-call-time.js';

const utc = (iso) => Date.parse(`${iso}Z`);

test('a agenda é a de Brasília: horário de parede vira o instante certo e volta igual', () => {
  assert.equal(BUSINESS_TIME_ZONE, 'America/Sao_Paulo');
  assert.equal(zonedInstant('2026-10-07', '20:00'), utc('2026-10-07T23:00:00'));
  assert.deepEqual(wallTime(utc('2026-10-07T23:00:00')), { date: '2026-10-07', time: '20:00' });
  assert.deepEqual(wallTime(utc('2026-10-08T02:30:00')), { date: '2026-10-07', time: '23:30' }); // ainda dia 7 em Brasília
});

test('nada de deslocamento fixo: a conversão segue as regras de cada fuso (horário de verão incluído)', () => {
  // Lisboa: +1 no verão, +0 no inverno
  assert.equal(zonedInstant('2026-07-01', '12:00', 'Europe/Lisbon'), utc('2026-07-01T11:00:00'));
  assert.equal(zonedInstant('2026-01-15', '12:00', 'Europe/Lisbon'), utc('2026-01-15T12:00:00'));
  // Brasília já teve horário de verão (UTC-2 em dez/2018): um "-03:00" fixo erraria aqui
  assert.equal(zonedInstant('2018-12-01', '12:00', 'America/Sao_Paulo'), utc('2018-12-01T14:00:00'));
  assert.equal(zonedInstant('2018-07-01', '12:00', 'America/Sao_Paulo'), utc('2018-07-01T15:00:00'));
});

test('cliente em Brasília (ou em fuso com o mesmo horário): nada a converter', () => {
  assert.deepEqual(localSlot('2026-10-07', '20:00', 'America/Sao_Paulo'), { date: '2026-10-07', time: '20:00', same: true });
  assert.equal(localSlot('2026-10-07', '20:00', 'America/Bahia').same, true);
  assert.equal(localSlot('2026-10-07', '20:00', 'America/Argentina/Buenos_Aires').same, true);
});

test('cliente em Lisboa: quarta 20:00 de Brasília; a diferença muda quando Portugal sai do horário de verão', () => {
  // até 25/10/2026 Lisboa está em UTC+1: 20:00 de Brasília já é meia-noite do dia seguinte lá (muda a data)
  assert.deepEqual(localSlot('2026-10-07', '20:00', 'Europe/Lisbon'), { date: '2026-10-08', time: '00:00', same: false });
  // depois de 25/10, UTC+0: o mesmo horário de Brasília cai às 23:00 do mesmo dia
  assert.deepEqual(localSlot('2026-10-28', '20:00', 'Europe/Lisbon'), { date: '2026-10-28', time: '23:00', same: false });
});

test('outros fusos: Nova York antes e depois do fim do horário de verão, Tóquio (dia seguinte) e Honolulu', () => {
  assert.deepEqual(localSlot('2026-10-28', '20:00', 'America/New_York'), { date: '2026-10-28', time: '19:00', same: false }); // EDT
  assert.deepEqual(localSlot('2026-11-04', '20:00', 'America/New_York'), { date: '2026-11-04', time: '18:00', same: false }); // EST (desde 01/11)
  assert.deepEqual(localSlot('2026-10-07', '20:00', 'Asia/Tokyo'), { date: '2026-10-08', time: '08:00', same: false });
  assert.deepEqual(localSlot('2026-10-10', '09:30', 'Pacific/Honolulu'), { date: '2026-10-10', time: '02:30', same: false });
  assert.deepEqual(localSlot('2026-10-10', '09:30', 'America/Los_Angeles'), { date: '2026-10-10', time: '05:30', same: false });
});

test('fuso precisa ser um identificador IANA de verdade; deslocamento sozinho não serve', () => {
  for (const ok of ['America/Sao_Paulo', 'Europe/Lisbon', 'America/Argentina/Buenos_Aires', 'UTC']) assert.equal(isValidTimeZone(ok), true, ok);
  for (const bad of ['-03:00', '+01:00', '', 'Marte/Fobos', 'America/Sao Paulo', 123, null, undefined, 'x'.repeat(80)]) assert.equal(isValidTimeZone(bad), false, String(bad));
});
