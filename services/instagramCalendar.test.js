import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonth, describeDay, formatBalance, shiftMonth } from './instagramCalendar.js';
import { filterByPeriod } from './instagramMetrics.js';

const post = (id, publishedAt, kind = 'image') => ({ id, publishedAt, kind });
const cellOf = (month, key) => month.weeks.flat().find((c) => c && c.key === key);

test('grade do mês: semanas de domingo a sábado, com células vazias antes do dia 1 e depois do último', () => {
  const month = buildMonth({ monthKey: '2026-10', posts: [], days: [], today: '2026-10-15' });
  assert.equal(month.weeks.length, 5);
  assert.ok(month.weeks.every((week) => week.length === 7));
  assert.deepEqual(month.weeks[0].map((c) => c && c.day), [null, null, null, null, 1, 2, 3]); // 01/10/2026 é quinta-feira
  assert.equal(month.weeks[4][6].day, 31);
  assert.equal(month.coverageStart, null);
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('feed e Reels pintam o dia; vários no mesmo dia são contados', () => {
  const posts = [
    post('a', '2026-10-05T15:00:00.000Z'),
    post('b', '2026-10-05T18:00:00.000Z', 'carousel'),
    post('c', '2026-10-06T15:00:00.000Z', 'reel'),
    post('d', '2026-10-07T15:00:00.000Z', 'video'), // vídeo de feed
  ];
  const month = buildMonth({ monthKey: '2026-10', posts, days: [], today: '2026-10-20' });
  assert.deepEqual([cellOf(month, '2026-10-05').feed, cellOf(month, '2026-10-05').total], [2, 2]);
  assert.deepEqual([cellOf(month, '2026-10-06').feed, cellOf(month, '2026-10-06').reels, cellOf(month, '2026-10-06').total], [0, 1, 1]); // só Reel: o dia também fica marcado
  assert.equal(cellOf(month, '2026-10-07').total, 1);
  assert.equal(cellOf(month, '2026-10-08').total, 0);
  const mixed = buildMonth({ monthKey: '2026-10', posts: [post('x', '2026-10-09T15:00:00.000Z'), post('y', '2026-10-09T16:00:00.000Z', 'reel')], days: [], today: '2026-10-20' });
  assert.equal(cellOf(mixed, '2026-10-09').total, 2); // feed + Reel no mesmo dia
});

test('fuso: publicação às 02:30 UTC ainda é o dia anterior em Brasília; datas inválidas são ignoradas', () => {
  const posts = [post('a', '2026-10-06T02:30:00.000Z'), post('b', 'lixo'), post('c', null)];
  const month = buildMonth({ monthKey: '2026-10', posts, days: [], today: '2026-10-20' });
  assert.equal(cellOf(month, '2026-10-05').total, 1);
  assert.equal(cellOf(month, '2026-10-06').total, 0);
  assert.equal(month.coverageStart, '2026-10-05');
});

test('saldos diários: positivo, negativo, zero e ausente (null, nunca 0); hoje, futuro e antes da cobertura', () => {
  const days = [
    { day: '2026-10-05', followers: 500, views: 12000 },
    { day: '2026-10-06', followers: -200, views: null },
    { day: '2026-10-07', followers: 0, views: 0 },
  ];
  const month = buildMonth({ monthKey: '2026-10', posts: [post('a', '2026-10-03T15:00:00.000Z')], days, today: '2026-10-10' });
  assert.deepEqual([cellOf(month, '2026-10-05').followers, cellOf(month, '2026-10-05').views], [500, 12000]);
  assert.deepEqual([cellOf(month, '2026-10-06').followers, cellOf(month, '2026-10-06').views], [-200, null]);
  assert.deepEqual([cellOf(month, '2026-10-07').followers, cellOf(month, '2026-10-07').views], [0, 0]);
  assert.deepEqual([cellOf(month, '2026-10-08').followers, cellOf(month, '2026-10-08').views], [null, null]);
  assert.equal(cellOf(month, '2026-10-10').isToday, true);
  assert.equal(cellOf(month, '2026-10-11').future, true);
  assert.equal(cellOf(month, '2026-10-02').beforeCoverage, true); // antes da publicação mais antiga conhecida
  assert.equal(cellOf(month, '2026-10-03').beforeCoverage, false);
});

test('textos: saldo compacto no quadradinho e completo na dica', () => {
  assert.equal(formatBalance(500), '+500');
  assert.equal(formatBalance(-200), '-200');
  assert.equal(formatBalance(12000), '+12k');
  assert.equal(formatBalance(3400), '+3,4k');
  assert.equal(formatBalance(987654), '+988k');
  assert.equal(formatBalance(-1500000), '-1,5M');
  assert.equal(formatBalance(999), '+999');
  assert.equal(formatBalance(1200, 'full'), '+1.200');
  const month = buildMonth({ monthKey: '2026-10', posts: [post('a', '2026-10-05T15:00:00.000Z')], days: [{ day: '2026-10-05', followers: 500, views: -3 }], today: '2026-10-10' });
  assert.equal(describeDay(cellOf(month, '2026-10-05')), '05/10/2026 · 1 publicação (1 no feed) · +500 seguidores · -3 visualizações');
  assert.equal(describeDay(cellOf(month, '2026-10-06')), '06/10/2026 · sem publicação');
  const both = buildMonth({ monthKey: '2026-10', posts: [post('x', '2026-10-09T15:00:00.000Z'), post('y', '2026-10-09T16:00:00.000Z', 'reel')], days: [], today: '2026-10-20' });
  assert.equal(describeDay(cellOf(both, '2026-10-09')), '09/10/2026 · 2 publicações (1 no feed + 1 Reel)');
});

test('filtro por período (cards): hoje, 7 dias, 30 dias e geral, por data de publicação em Brasília', () => {
  const now = Date.parse('2026-10-10T15:00:00Z'); // 12:00 de 10/10 em Brasília
  const posts = [
    post('hoje', '2026-10-10T13:00:00.000Z'),
    post('limite-hoje-madrugada', '2026-10-10T03:00:00.000Z'), // 00:00 de 10/10 em Brasília: ainda é hoje
    post('ontem-noite', '2026-10-10T02:59:00.000Z'), // 23:59 de 09/10
    post('6-dias', '2026-10-04T15:00:00.000Z'), // dentro de 7 dias (04/10 a 10/10)
    post('7-dias', '2026-10-03T15:00:00.000Z'), // fora dos 7 dias
    post('29-dias', '2026-09-11T15:00:00.000Z'), // dentro de 30 dias (11/09 a 10/10)
    post('30-dias', '2026-09-10T15:00:00.000Z'), // fora
    post('futuro', '2026-10-12T15:00:00.000Z'),
    post('sem-data', null),
  ];
  const ids = (period) => filterByPeriod(posts, period, now).map((p) => p.id);
  assert.deepEqual(ids('today'), ['hoje', 'limite-hoje-madrugada']);
  assert.deepEqual(ids('7d'), ['hoje', 'limite-hoje-madrugada', 'ontem-noite', '6-dias']);
  assert.deepEqual(ids('30d'), ['hoje', 'limite-hoje-madrugada', 'ontem-noite', '6-dias', '7-dias', '29-dias']);
  assert.equal(ids('all').length, posts.length); // geral inclui tudo, até sem data
  assert.deepEqual(filterByPeriod([], '30d', now), []);
});
