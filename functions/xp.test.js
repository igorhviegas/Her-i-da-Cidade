import test from 'node:test';
import assert from 'node:assert/strict';
import { FIT_EVENT_TYPES, buildBaseline, checkinXp, eventReward, igXpDelta, levelCost, levelInfo, levelStart, orderXp, rideXp, stepsXp, totalXp, xpOfEvent } from './xp.js';

test('curva ×1,25: nível 1 custa 500, cada nível custa 25% a mais; acumulado bate com a soma', () => {
  assert.equal(levelCost(1), 500);
  assert.equal(levelCost(2), 625);
  assert.equal(levelStart(1), 0);
  let sum = 0;
  for (let n = 1; n <= 30; n += 1) { assert.ok(Math.abs(levelStart(n) - sum) < 1e-6 * Math.max(1, sum)); sum += levelCost(n); }
});

test('levelInfo: nível 1 sem XP; fronteiras exatas; sem limite máximo', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(499).level, 1);
  assert.equal(levelInfo(500).level, 2);
  assert.equal(levelInfo(levelStart(40)).level, 40);
  assert.equal(levelInfo(levelStart(40) - 1).level, 39);
  assert.ok(levelInfo(1e15).level > 100);
  assert.equal(levelInfo(NaN).level, 1);
  const info = levelInfo(6_787_100); // só os seguidores atuais (678.710 × 10)
  assert.equal(info.level, 37);
  assert.ok(info.percent >= 0 && info.percent < 100);
  assert.ok(Math.abs(info.left - (info.nextAt - info.xp)) < 1e-6);
});

test('XP por evento: pedido = valor × 10, missão/tarefa/roteiro pela dificuldade, meta pelo período, conteúdo 2.000', () => {
  assert.equal(orderXp(75), 750);
  assert.equal(xpOfEvent({ type: 'order_completed', meta: { value: 75 } }), 750);
  assert.equal(xpOfEvent({ type: 'order_completed' }), 0);
  assert.equal(xpOfEvent({ type: 'mission', difficulty: 5 }), 1000);
  assert.equal(xpOfEvent({ type: 'task_occurrence', difficulty: 1 }), 100);
  assert.equal(xpOfEvent({ type: 'script_ready', difficulty: null }), 0);
  assert.equal(xpOfEvent({ type: 'goal_completed', meta: { period: 'monthly' } }), 5000);
  assert.equal(xpOfEvent({ type: 'goal_completed', meta: { period: 'weekly' } }), 1000);
  assert.equal(xpOfEvent({ type: 'goal_completed', meta: { period: 'daily' } }), 100);
  assert.equal(xpOfEvent({ type: 'goal_completed' }), 0);
  assert.equal(xpOfEvent({ type: 'content_published' }), 2000);
  assert.equal(xpOfEvent({ type: 'instagram', xp: 42 }), 42);
});

test('baseline: soma as categorias reais; pedidos internos e não concluídos ficam de fora; Instagram conta 100%', () => {
  const baseline = buildBaseline({
    orders: [{ id: 'a', status: 'completed', totalPaid: 75 }, { id: 'b', status: 'completed', totalPaid: 0, scriptId: 's1' }, { id: 'c', status: 'editing', totalPaid: 99 }, { id: 'd', status: 'completed', servicePrice: 60, rushFee: 10 }],
    scripts: [{ id: 's1', publicationStatus: 'published', readyAt: 1 }, { id: 's2', publicationStatus: 'unpublished' }],
    ig: { followers: 678710, posts: [{ views: 100, likes: 10, comments: 2 }, { views: null, likes: 5, comments: null }] },
    missions: [{ difficulty: 3 }], occurrences: [{ difficulty: 1 }],
    goalCycles: [{ reached: true, period: 'weekly' }, { reached: false, period: 'monthly' }], goals: [{ completedAt: 1, period: 'daily' }], scriptDifficulty: 2,
  });
  assert.deepEqual(baseline.categories.orders, { count: 2, xp: 750 + 700 });
  assert.equal(baseline.categories.content.xp, 2000);
  assert.deepEqual(baseline.categories.views, { count: 100, xp: 100 });
  assert.deepEqual(baseline.categories.likes, { count: 15, xp: 30 });
  assert.deepEqual(baseline.categories.comments, { count: 2, xp: 6 });
  assert.equal(baseline.categories.followers.xp, 6_787_100);
  assert.equal(baseline.categories.missions.xp, 600);
  assert.equal(baseline.categories.scripts.xp, 250);
  assert.equal(baseline.categories.goals.xp, 1100);
  assert.equal(baseline.total, Object.values(baseline.categories).reduce((s, c) => s + c.xp, 0));
  assert.deepEqual(baseline.counted, { orders: ['a', 'd'], scripts: ['s1'] });
  assert.equal(buildBaseline({}).total, 0);
});

test('total: sem baseline = null; eventos anteriores ao baseline e já contados nele não somam de novo', () => {
  assert.equal(totalXp(null, []), null);
  const at = new Date('2026-10-10T12:00:00Z');
  const baseline = { at, total: 1000, counted: { orders: ['old'], scripts: ['s1'] } };
  const events = [
    { type: 'mission', difficulty: 3, occurredAt: new Date('2026-10-09T00:00:00Z'), refId: 'm0' }, // antes: já no baseline
    { type: 'mission', difficulty: 3, occurredAt: new Date('2026-10-11T00:00:00Z'), refId: 'm1' }, // +500
    { type: 'order_completed', meta: { value: 50 }, occurredAt: new Date('2026-10-11T00:00:00Z'), refId: 'old' }, // pedido antigo reaberto: não paga de novo
    { type: 'order_completed', meta: { value: 50 }, occurredAt: new Date('2026-10-11T00:00:00Z'), refId: 'new' }, // +500
    { type: 'content_published', occurredAt: new Date('2026-10-11T00:00:00Z'), refId: 's1' }, // já no baseline
    { type: 'content_published', occurredAt: { toDate: () => new Date('2026-10-12T00:00:00Z') }, refId: 's2' }, // +2000 (Timestamp)
  ];
  assert.deepEqual(totalXp(baseline, events), { baseline: 1000, events: 3000, total: 4000 });
});

test('Instagram: só o que subiu conta; sincronizar de novo sem mudança não gera XP; 678.710 → 678.900 = +190 seguidores', () => {
  const prev = { p1: { views: 100, likes: 10, comments: 1 } };
  const posts = [{ id: 'p1', views: 150, likes: 12, comments: 1 }, { id: 'p2', views: 20, likes: 3, comments: 0 }];
  assert.deepEqual(igXpDelta({ prev, posts, followers: 678900, followersHigh: 678710 }), { xp: 50 + 4 + 20 + 6 + 0 + 1900, followersHigh: 678900 });
  assert.equal(igXpDelta({ prev: { p1: posts[0], p2: posts[1] }, posts, followers: 678900, followersHigh: 678900 }).xp, 0);
});

test('Instagram: queda não tira XP, seguidor que cai e volta não paga duas vezes, métrica ausente nunca vira 0', () => {
  const prev = { p1: { views: 100, likes: 10, comments: 1 } };
  const drop = igXpDelta({ prev, posts: [{ id: 'p1', views: 80, likes: null, comments: 0 }], followers: 678000, followersHigh: 678710 });
  assert.deepEqual(drop, { xp: 0, followersHigh: 678710 });
  assert.equal(igXpDelta({ prev, posts: [], followers: 678710, followersHigh: drop.followersHigh }).xp, 0);
  assert.equal(igXpDelta({ prev, posts: [], followers: 678720, followersHigh: drop.followersHigh }).xp, 100);
  assert.deepEqual(igXpDelta({ prev: {}, posts: [], followers: 5, followersHigh: null }), { xp: 0, followersHigh: 5 }); // 1ª vez: só fixa a referência
  assert.equal(igXpDelta({ prev: { p1: { views: null } }, posts: [{ id: 'p1', views: 7 }], followers: null, followersHigh: null }).xp, 7);
});

test('aviso de ganho: XP e valores reais do Financeiro; Instagram, eventos antigos e já contados não avisam', () => {
  const baseline = { at: new Date('2026-10-10T12:00:00Z'), total: 0, counted: { orders: ['old'] } };
  const after = new Date('2026-10-11T00:00:00Z');
  assert.deepEqual(eventReward(baseline, { type: 'order_completed', refId: 'a', occurredAt: after, meta: { value: 60, revenue: 60, cost: 25 } }), { xp: 600, revenue: 60, cost: 25 });
  assert.deepEqual(eventReward(baseline, { type: 'mission', refId: 'm', occurredAt: after, difficulty: 2 }), { xp: 250, revenue: 0, cost: 0 }); // missão não mexe no Financeiro
  assert.deepEqual(eventReward(baseline, { type: 'order_completed', refId: 'b', occurredAt: after, meta: { value: 300, revenue: 150, cost: 40 } }), { xp: 3000, revenue: 150, cost: 40 }); // evento: só a 2ª parcela e a despesa
  assert.equal(eventReward(baseline, { type: 'instagram', refId: 'd', occurredAt: after, xp: 999 }), null);
  assert.equal(eventReward(baseline, { type: 'order_completed', refId: 'old', occurredAt: after, meta: { value: 60 } }), null);
  assert.equal(eventReward(baseline, { type: 'mission', refId: 'm0', occurredAt: new Date('2026-10-09T00:00:00Z'), difficulty: 2 }), null);
  assert.equal(eventReward(baseline, { type: 'order_completed', refId: 'z', occurredAt: after, meta: { value: 0 } }), null); // pedido interno sem valor
  assert.equal(eventReward(null, { type: 'mission', difficulty: 2, occurredAt: after }), null);
});

test('Fit: passos 1 XP a cada 10 (teto de 20.000 passos), bike 50 XP/km, check-in 500; entradas ruins valem 0', () => {
  assert.equal(stepsXp(8000), 800);
  assert.equal(stepsXp(19), 1);
  assert.equal(stepsXp(9), 0);
  assert.equal(stepsXp(20000), 2000);
  assert.equal(stepsXp(120000), 2000); // teto diário
  for (const bad of [0, -5, NaN, null, undefined, 'x']) { assert.equal(stepsXp(bad), 0); assert.equal(rideXp(bad), 0); }
  assert.equal(rideXp(4.448), 222);
  assert.equal(rideXp(20), 1000);
  assert.equal(rideXp(0.019), 0);
  assert.equal(checkinXp(), 500);
});

test('Fit: o evento carrega o XP congelado (xpOfEvent o devolve), só vale depois da linha de base e abre a janelinha de ganho', () => {
  assert.deepEqual(FIT_EVENT_TYPES, ['fit_ride', 'fit_steps', 'fit_checkin']);
  const baseline = { at: new Date('2026-10-01T00:00:00Z'), total: 1000 };
  const ride = { type: 'fit_ride', refId: 'mywhoosh_1_20261007T200427Z', xp: 222, occurredAt: new Date('2026-10-08T12:00:00Z') };
  assert.equal(xpOfEvent(ride), 222);
  assert.deepEqual(totalXp(baseline, [ride, { type: 'fit_checkin', refId: 'gym_2026-10-07', xp: 500, occurredAt: new Date('2026-10-08T13:00:00Z') }]), { baseline: 1000, events: 722, total: 1722 });
  assert.deepEqual(eventReward(baseline, ride), { xp: 222, revenue: 0, cost: 0 });
  assert.equal(totalXp(baseline, [{ ...ride, occurredAt: new Date('2026-09-30T12:00:00Z') }]).events, 0); // antes da linha de base não conta
});
