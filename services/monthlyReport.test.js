import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRevenueEntries } from './financeCalculations.js';
import { clientsInMonth, defaultReportMonth, fitMonth, instagramMonth, isMonthKey, monthRange } from './monthlyReport.js';

test('isMonthKey aceita só AAAA-MM com mês de 01 a 12 (o valor vem da URL do aviso)', () => {
  for (const ok of ['2026-09', '2027-12', '2026-01']) assert.equal(isMonthKey(ok), true);
  for (const bad of ['2026-13', '2026-00', '2026-9', '26-09', '2026-09-01', ' 2026-09', 'abcd-09', '', null, undefined, 202609]) assert.equal(isMonthKey(bad), false);
});

const at = (iso) => new Date(`${iso}T12:00:00`);
const order = (id, clientId, date, over = {}) => ({ id, status: 'completed', clientId, serviceId: 's1', totalPaid: 100, completedAt: at(date), ...over });

test('defaultReportMonth é o mês anterior (inclusive na virada do ano) e monthRange cobre o mês inteiro', () => {
  assert.equal(defaultReportMonth(at('2026-10-01')), '2026-09');
  assert.equal(defaultReportMonth(at('2026-01-15')), '2025-12');
  assert.deepEqual(monthRange('2026-02'), { start: new Date(2026, 1, 1), end: new Date(2026, 2, 1) });
});

test('clientsInMonth: novos (1ª compra no mês) e recorrentes; ajuste de receita e outros meses não contam', () => {
  const { entries } = buildRevenueEntries([
    order('a0', 'ana', '2026-08-10'), order('a1', 'ana', '2026-09-05'), // ana: já era cliente
    order('b1', 'bia', '2026-09-12'), order('b2', 'bia', '2026-09-20'), // bia: nova, 2 pedidos no mês
    order('c1', 'caio', '2026-10-02'), // outro mês
    { id: 'evt-e1-adjrev-1', orderId: 'e1', ledger: true, ledgerKind: 'adjrev', status: 'completed', clientId: 'duda', serviceId: 'p', totalPaid: 50, completedAt: at('2026-09-15') }, // só ajuste: não é cliente atendido
  ]);
  assert.deepEqual(clientsInMonth(entries, monthRange('2026-09')), { served: 2, newClients: 1, returning: 1 });
  assert.deepEqual(clientsInMonth([], monthRange('2026-09')), { served: 0, newClients: 0, returning: 0 });
});

test('instagramMonth: soma os saldos diários do mês, conta e destaca as publicações do mês; sem dado vira null', () => {
  const days = [{ day: '2026-09-03', followers: 5, likes: 10, views: 100 }, { day: '2026-09-04', followers: -2, likes: null, views: 50 }, { day: '2026-10-01', followers: 99, likes: 99, views: 99 }];
  const post = (id, publishedAt, likes) => ({ id, publishedAt, likes, comments: 2, views: 10 });
  const posts = [post('1', '2026-09-10T15:00:00.000Z', 30), post('2', '2026-09-20T15:00:00.000Z', 50), post('3', '2026-10-02T15:00:00.000Z', 999)];
  const r = instagramMonth(posts, days, '2026-09');
  assert.deepEqual([r.daysWithData, r.followersGain, r.likesGain, r.viewsGain, r.posts, r.postLikes, r.postComments, r.top.id], [2, 3, 10, 150, 2, 80, 4, '2']);
  assert.deepEqual(instagramMonth([], [], '2026-09'), { daysWithData: 0, followersGain: null, likesGain: null, viewsGain: null, posts: 0, postLikes: 0, postComments: 0, top: null });
});

test('fitMonth: médias só dos dias com registro, peso manual vale mais que o do atalho, check-ins e pedaladas do mês; mês vazio = sem dados', () => {
  const daily = [{ day: '2026-09-01', steps: 8000, walkRunKm: 5, weightKg: 80 }, { day: '2026-09-02', steps: 6000, walkRunKm: 4 }, { day: '2026-09-30', steps: 10000, weightKg: 79 }, { day: '2026-10-01', steps: 1 }];
  const weights = [{ day: '2026-09-30', kg: 78.5 }];
  const checkins = [{ kind: 'gym', day: '2026-09-03' }, { kind: 'gym', day: '2026-09-10' }, { kind: 'functional', day: '2026-09-11' }, { kind: 'gym', day: '2026-10-01' }];
  const rides = [{ startedAt: new Date(2026, 8, 5, 10), distanceKm: 20, movingSec: 3600 }, { startedAt: new Date(2026, 8, 25, 10), distanceKm: 30, movingSec: 3600 }, { startedAt: new Date(2026, 9, 2, 10), distanceKm: 99, movingSec: 1 }];
  const r = fitMonth({ daily, weights, checkins, rides }, '2026-09');
  assert.deepEqual([r.daysWithData, r.avgSteps, r.totalKm, r.gym, r.functional, r.hasData], [3, 8000, 9, 2, 1, true]);
  assert.deepEqual([r.weight.value, r.weight.change], [78.5, -1.5]);
  assert.deepEqual([r.rides.count, r.rides.km, r.rides.avgSpeedKmh], [2, 50, 25]);
  const empty = fitMonth({}, '2026-09');
  assert.deepEqual([empty.hasData, empty.avgSteps, empty.weight, empty.rides.count], [false, null, null, 0]);
});
