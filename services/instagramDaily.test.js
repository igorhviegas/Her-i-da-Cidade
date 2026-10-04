import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDaily, dayOf, describeDelta } from './instagramDaily.js';

const at = (iso) => Date.parse(iso); // horários em UTC; Brasília = UTC-3
const post = (id, likes, views, over = {}) => ({ id, likes, views, viewsStale: false, publishedAt: '2026-01-01T12:00:00.000Z', ...over });
const run = (prev, iso, followers, posts) => applyDaily({ prev, nowMs: at(iso), followers, posts });

test('dia: virada em Brasília (UTC-3), não em UTC', () => {
  assert.equal(dayOf(at('2026-03-10T02:59:59Z')), '2026-03-09'); // 23:59 em Brasília
  assert.equal(dayOf(at('2026-03-10T03:00:00Z')), '2026-03-10'); // 00:00 em Brasília
  assert.equal(dayOf(at('2026-03-10T23:30:00Z')), '2026-03-10'); // 20:30 em Brasília
});

test('seguidores: ganho, perda e zero; 1ª sincronização do dia vira a referência', () => {
  const first = run(null, '2026-03-10T03:30:00Z', 679458, [post('a', 10, 100)]);
  assert.equal(first.summary.followers, 0); // a referência é o próprio valor
  assert.equal(first.summary.baselineAt, '2026-03-10T03:30:00.000Z');
  assert.equal(run(first.state, '2026-03-10T15:00:00Z', 679583, [post('a', 10, 100)]).summary.followers, 125);
  assert.equal(run(first.state, '2026-03-10T15:00:00Z', 679426, [post('a', 10, 100)]).summary.followers, -32);
  assert.equal(run(first.state, '2026-03-10T15:00:00Z', 679458, [post('a', 10, 100)]).summary.followers, 0);
  assert.equal(run(first.state, '2026-03-10T15:00:00Z', null, [post('a', 10, 100)]).summary.followers, null); // sem dado: indisponível, nunca 0
});

test('curtidas e visualizações: saldo por publicação; sincronizações repetidas não duplicam', () => {
  const base = run(null, '2026-03-10T03:30:00Z', 100, [post('a', 10, 100), post('b', 5, 50)]);
  const second = run(base.state, '2026-03-10T10:00:00Z', 100, [post('a', 14, 130), post('b', 5, 50)]);
  assert.deepEqual([second.summary.likes, second.summary.views], [4, 30]);
  const third = run(second.state, '2026-03-10T11:00:00Z', 100, [post('a', 14, 130), post('b', 5, 50)]); // nada mudou
  assert.deepEqual([third.summary.likes, third.summary.views], [4, 30]);
  const fourth = run(third.state, '2026-03-10T12:00:00Z', 100, [post('a', 20, 150), post('b', 6, 50)]);
  assert.deepEqual([fourth.summary.likes, fourth.summary.views], [11, 50]); // sempre relativo à referência do dia
});

test('publicação nova no dia entra com referência 0; publicação que sai do conjunto não gera saldo falso', () => {
  const base = run(null, '2026-03-10T03:30:00Z', 100, [post('a', 10, 100), post('old', 1000, 9000)]);
  const next = run(base.state, '2026-03-10T15:00:00Z', 100, [
    post('new', 7, 70, { publishedAt: '2026-03-10T14:00:00.000Z' }), // publicada hoje (11:00 em Brasília)
    post('a', 10, 100),
    // 'old' saiu das últimas 100: não entra, e o total absoluto não vira saldo
  ]);
  assert.deepEqual([next.summary.likes, next.summary.views], [7, 70]);
  assert.deepEqual(Object.keys(next.state.refs).sort(), ['a', 'new']);
  // publicação antiga que aparece só agora (não nasceu hoje): referência tardia, saldo começa em 0
  const late = run(next.state, '2026-03-10T16:00:00Z', 100, [post('a', 10, 100), post('new', 7, 70, { publishedAt: '2026-03-10T14:00:00.000Z' }), post('ghost', 500, 800)]);
  assert.deepEqual([late.summary.likes, late.summary.views], [7, 70]);
});

test('métricas indisponíveis: nunca viram 0 nem saldo; valor desatualizado marca "parcial"', () => {
  const base = run(null, '2026-03-10T03:30:00Z', 100, [post('a', 10, null), post('b', 5, 50)]);
  assert.equal(base.summary.views, 0);
  const next = run(base.state, '2026-03-10T10:00:00Z', 100, [post('a', 12, 40), post('b', 5, 80, { viewsStale: true })]);
  assert.equal(next.summary.likes, 2);
  assert.equal(next.summary.views, 0); // 'a' sem referência de views passa a ter base agora (40); 'b' desatualizado fica de fora
  assert.equal(next.summary.viewsPartial, true);
  const none = run(null, '2026-03-10T10:00:00Z', 100, [post('a', null, null)]);
  assert.deepEqual([none.summary.likes, none.summary.views], [null, null]);
  assert.equal(run(null, '2026-03-10T10:00:00Z', 100, []).summary.likes, null);
});

test('virada do dia: nova referência no 1º sincronismo após a meia-noite (mesmo sem o cron); o saldo de ontem não acumula', () => {
  const d1 = run(null, '2026-03-10T03:30:00Z', 1000, [post('a', 10, 100)]);
  const evening = run(d1.state, '2026-03-11T02:50:00Z', 1100, [post('a', 40, 400)]); // 23:50 de 10/03 em Brasília
  assert.deepEqual([evening.summary.day, evening.summary.followers, evening.summary.likes], ['2026-03-10', 100, 30]);
  const nextDay = run(evening.state, '2026-03-11T11:00:00Z', 1110, [post('a', 45, 450)]); // 1º sync de 11/03 (08:00), sem cron à meia-noite
  assert.equal(nextDay.summary.day, '2026-03-11');
  assert.deepEqual([nextDay.summary.followers, nextDay.summary.likes, nextDay.summary.views], [0, 0, 0]); // zerou
  assert.equal(nextDay.summary.baselineAt, '2026-03-11T11:00:00.000Z');
  const later = run(nextDay.state, '2026-03-11T20:00:00Z', 1125, [post('a', 50, 500)]);
  assert.deepEqual([later.summary.followers, later.summary.likes, later.summary.views], [15, 5, 50]); // só o que aconteceu em 11/03
});

test('describeDelta: textos, sinais, zero neutro, pendente e indisponível', () => {
  const s = { day: '2026-03-10', baselineAt: '2026-03-10T03:30:00.000Z', followers: 125, likes: 2450, views: -3, viewsPartial: true };
  assert.deepEqual(describeDelta(s, 'followers', '2026-03-10'), { kind: 'up', text: '+125 seguidores hoje', since: null });
  assert.equal(describeDelta(s, 'likes', '2026-03-10').text, '+2.450 hoje');
  assert.deepEqual([describeDelta(s, 'views', '2026-03-10').kind, describeDelta(s, 'views', '2026-03-10').text], ['down', '-3 hoje · parcial']);
  assert.equal(describeDelta({ ...s, followers: -32 }, 'followers', '2026-03-10').text, '-32 seguidores hoje');
  assert.equal(describeDelta({ ...s, followers: 1 }, 'followers', '2026-03-10').text, '+1 seguidor hoje');
  assert.deepEqual(describeDelta({ ...s, followers: 0 }, 'followers', '2026-03-10').kind, 'zero');
  assert.equal(describeDelta({ ...s, likes: null }, 'likes', '2026-03-10').kind, 'unavailable');
  assert.equal(describeDelta(s, 'followers', '2026-03-11').kind, 'pending'); // já é outro dia e ainda não sincronizou
  assert.equal(describeDelta(undefined, 'followers', '2026-03-10').kind, 'unavailable');
  assert.equal(describeDelta({ ...s, baselineAt: '2026-03-10T17:05:00.000Z' }, 'likes', '2026-03-10').since, '14:05'); // referência tardia: informa o horário
});
