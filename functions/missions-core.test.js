import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GOAL_METRICS, INSTAGRAM_METRICS, engagementInCycle, followersGain, instagramNote,
  addDays, buildNotifications, cycleArchiveRecord, cycleBounds, cycleChanged, dateKey, goalProgress, metricValue, missionNotificationIds,
  occurrenceNotificationIds, planOccurrences, recursOn, startOfDay,
  syncRecurringTasks, taskStreak, validateTask,
} from './missions-core.js';
import { buildRevenueEntries, monthTotals, monthKeyOf } from '../services/financeCalculations.js';
import { ledgerToOrders } from '../services/eventFinance.js';

const at = (iso) => new Date(iso);

test('dateKey usa o dia de Brasília, inclusive perto da meia-noite UTC', () => {
  assert.equal(dateKey(at('2026-10-02T02:59:59Z')), '2026-10-01'); // 23:59 em Brasília
  assert.equal(dateKey(at('2026-10-02T03:00:00Z')), '2026-10-02'); // 00:00 em Brasília
  assert.equal(startOfDay('2026-10-02').toISOString(), '2026-10-02T03:00:00.000Z');
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
});

test('recorrência diária, semanal com vários dias e mensal nas duas modalidades', () => {
  assert.ok(recursOn({ frequency: 'daily' }, '2026-10-02'));
  const weekly = { frequency: 'weekly', weekdays: [1, 3, 5] }; // seg, qua, sex
  assert.deepEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'].map((d) => recursOn(weekly, d)), [true, false, true, true]);
  const day5 = { frequency: 'monthly', monthDay: 5 };
  assert.ok(recursOn(day5, '2026-11-05') && !recursOn(day5, '2026-11-06'));
  const firstMonday = { frequency: 'monthly', monthNth: { week: 1, weekday: 1 } };
  assert.ok(recursOn(firstMonday, '2026-10-05') && !recursOn(firstMonday, '2026-10-12'));
  // ambas as modalidades: união das datas, sem duplicar quando coincidem
  const both = { frequency: 'monthly', monthDay: 5, monthNth: { week: 1, weekday: 1 } };
  assert.ok(recursOn(both, '2026-10-05')); // dia 5 e 1ª segunda ao mesmo tempo: uma ocorrência (a chave é a data)
  assert.ok(recursOn(both, '2026-11-05') && recursOn(both, '2026-11-02')); // dia 5 (qui) e 1ª segunda 02/11
  assert.ok(!recursOn(both, '2026-10-09'));
  const last = { frequency: 'monthly', monthNth: { week: -1, weekday: 5 } }; // última sexta
  assert.ok(recursOn(last, '2026-10-30') && !recursOn(last, '2026-10-23'));
  assert.ok(recursOn({ frequency: 'monthly', monthDay: 31 }, '2026-02-28')); // dia 31 cai no último dia do mês
});

test('validateTask rejeita configurações incompletas', () => {
  const ok = { title: 'x', difficulty: 3, time: '09:00', frequency: 'daily' };
  assert.deepEqual(validateTask(ok), []);
  assert.ok(validateTask({ ...ok, difficulty: 6 }).length);
  assert.ok(validateTask({ ...ok, time: '25:00' }).length);
  assert.ok(validateTask({ ...ok, frequency: 'weekly', weekdays: [] }).length);
  assert.ok(validateTask({ ...ok, frequency: 'monthly' }).length);
});

function memoryStore(tasks) {
  const occurrences = new Map();
  return {
    occurrences,
    listActiveTasks: async () => tasks.filter((t) => t.status === 'active').map((t) => ({ ...t })),
    listPendingOccurrences: async () => [...occurrences.values()].filter((o) => o.status === 'pending').map((o) => ({ ...o })),
    createOccurrenceIfAbsent: async (id, data) => { if (occurrences.has(id)) return false; occurrences.set(id, { id, ...data }); return true; },
    resolveOccurrence: async (id, patch) => Object.assign(occurrences.get(id), patch),
    updateTask: async (id, patch) => Object.assign(tasks.find((t) => t.id === id), patch),
  };
}

test('rotina da meia-noite: gera, não duplica, marca perdida e recupera após indisponibilidade', async () => {
  const task = { id: 't1', title: 'Treinar', difficulty: 2, time: '07:00', frequency: 'daily', status: 'active', startDate: '2026-10-01', lastGeneratedDate: '2026-09-30' };
  const store = memoryStore([task]);
  await syncRecurringTasks(store, at('2026-10-01T03:00:30Z')); // meia-noite de 01/10
  assert.equal(store.occurrences.get('t1_2026-10-01').status, 'pending');
  await syncRecurringTasks(store, at('2026-10-01T15:00:00Z')); // reabertura no mesmo dia
  assert.equal(store.occurrences.size, 1);

  store.occurrences.get('t1_2026-10-01').status = 'completed';
  await syncRecurringTasks(store, at('2026-10-02T03:00:30Z'));
  assert.equal(store.occurrences.get('t1_2026-10-02').status, 'pending');

  // sistema fora do ar nos dias 03 e 04; volta no dia 05: 02, 03 e 04 perdidas, 05 pendente
  await syncRecurringTasks(store, at('2026-10-05T12:00:00Z'));
  assert.deepEqual(['02', '03', '04', '05'].map((d) => store.occurrences.get(`t1_2026-10-${d}`).status), ['missed', 'missed', 'missed', 'pending']);
  assert.equal(store.occurrences.size, 5);
});

test('pausa: pendente vira ignorada (não quebra sequência) e retomada não gera backlog', async () => {
  const task = { id: 't1', title: 'Ler', difficulty: 1, time: '20:00', frequency: 'daily', status: 'active', startDate: '2026-10-01', lastGeneratedDate: '2026-09-30' };
  const store = memoryStore([task]);
  await syncRecurringTasks(store, at('2026-10-01T12:00:00Z'));
  task.status = 'paused';
  await syncRecurringTasks(store, at('2026-10-02T12:00:00Z'));
  assert.equal(store.occurrences.get('t1_2026-10-01').status, 'skipped');
  await syncRecurringTasks(store, at('2026-10-04T12:00:00Z')); // pausada: nada novo
  assert.equal(store.occurrences.size, 1);
  task.status = 'active';
  task.lastGeneratedDate = addDays('2026-10-05', -1); // o que setTaskStatus('active') faz
  await syncRecurringTasks(store, at('2026-10-05T12:00:00Z'));
  assert.equal(store.occurrences.size, 2);
  assert.equal(store.occurrences.get('t1_2026-10-05').status, 'pending');
  assert.equal(planOccurrences({ ...task, lastGeneratedDate: '2026-10-05' }, '2026-10-05').length, 0);
});

test('edição de recorrência: ocorrência já gerada é preservada e não há duplicata', async () => {
  const task = { id: 't1', title: 'Pagar', difficulty: 3, time: '10:00', frequency: 'daily', status: 'active', startDate: '2026-10-01', lastGeneratedDate: '2026-09-30' };
  const store = memoryStore([task]);
  await syncRecurringTasks(store, at('2026-10-01T12:00:00Z'));
  Object.assign(task, { frequency: 'weekly', weekdays: [4], time: '11:00', lastGeneratedDate: '2026-09-30' }); // 01/10 é quinta; updateTask reposiciona
  await syncRecurringTasks(store, at('2026-10-01T13:00:00Z'));
  assert.equal(store.occurrences.size, 1);
  assert.equal(store.occurrences.get('t1_2026-10-01').time, '10:00'); // snapshot anterior mantido
});

test('sequência: perdida quebra, dia sem tarefa é neutro, hoje pendente não conta nem quebra', () => {
  const o = (date, status) => ({ date, status });
  assert.equal(taskStreak([o('2026-10-01', 'completed'), o('2026-10-02', 'completed'), o('2026-10-03', 'pending')], '2026-10-03'), 2);
  assert.equal(taskStreak([o('2026-10-01', 'completed'), o('2026-10-02', 'missed'), o('2026-10-03', 'completed')], '2026-10-03'), 1);
  assert.equal(taskStreak([o('2026-10-01', 'completed'), o('2026-10-03', 'completed')], '2026-10-04'), 2); // dia 02 sem tarefas
  assert.equal(taskStreak([o('2026-10-01', 'completed'), o('2026-10-02', 'completed'), o('2026-10-02', 'missed')], '2026-10-03'), 0);
  assert.equal(taskStreak([o('2026-10-01', 'completed'), o('2026-10-02', 'skipped')], '2026-10-02'), 1);
  assert.equal(taskStreak([o('2026-09-20', 'completed'), o('2026-10-02', 'completed')], '2026-10-02', '2026-10-01'), 1);
});

test('ciclos de metas: diário, semanal e mensal com limites configuráveis', () => {
  const now = at('2026-10-08T15:00:00Z'); // quinta 08/10
  assert.equal(cycleBounds('daily', now).key, '2026-10-08');
  assert.equal(cycleBounds('weekly', now).key, '2026-10-05'); // segunda
  assert.equal(cycleBounds('weekly', now, { weekStartsOn: 0 }).key, '2026-10-04'); // domingo
  const month = cycleBounds('monthly', now);
  assert.deepEqual([month.startKey, month.endKey], ['2026-10-01', '2026-11-01']);
  const custom = cycleBounds('monthly', now, { monthStartDay: 15 });
  assert.deepEqual([custom.startKey, custom.endKey], ['2026-09-15', '2026-10-15']);
  const year = cycleBounds('monthly', at('2026-01-03T15:00:00Z'), { monthStartDay: 15 });
  assert.deepEqual([year.startKey, year.endKey], ['2025-12-15', '2026-01-15']);
  assert.equal(cycleBounds('daily', at('2026-10-09T03:00:00Z')).key, '2026-10-09'); // 00:00 de Brasília já é o novo ciclo
});

test('metas automáticas: contagem por documento e data do evento; vendido difere de concluído', () => {
  const bounds = cycleBounds('weekly', at('2026-10-08T15:00:00Z'));
  const day = (d) => new Date(`2026-10-${d}T15:00:00Z`);
  const data = {
    orders: [
      { id: 'a', status: 'completed', totalPaid: 30, paidAt: day('06'), completedAt: day('07') },
      { id: 'b', status: 'completed', totalPaid: 70, paidAt: day('01'), completedAt: day('08') }, // vendido na semana anterior, concluído nesta
      { id: 'c', status: 'recording', totalPaid: 60, paidAt: day('07') }, // vendido, não concluído
      { id: 'd', status: 'completed', totalPaid: 0, completedAt: day('08'), scriptId: 's1' }, // produção interna
      { id: 'e', status: 'completed', totalPaid: 50, paidAt: day('20'), completedAt: day('20') }, // fora do ciclo
    ],
    scripts: [
      { id: 's1', createdAt: day('06'), readyAt: day('07'), publicationStatus: 'published', publishedAt: day('08') },
      { id: 's2', createdAt: day('02'), readyAt: day('06') },
      { id: 's3', createdAt: day('06') },
    ],
    missions: [{ id: 'm1', status: 'completed', completedAt: day('07') }, { id: 'm2', status: 'pending' }],
    occurrences: [{ date: '2026-10-07', status: 'completed' }, { date: '2026-10-08', status: 'completed' }],
  };
  data.revenueEntries = buildRevenueEntries(data.orders).entries; // o mesmo cálculo do Financeiro
  const value = (m) => metricValue(m, bounds, data, '2026-10-08');
  assert.equal(value('revenue_completed'), 100); // a + b + d(0)
  assert.equal(value('services_sold'), 2); // a, c (b foi paga antes; d é interno)
  assert.equal(value('scripts_created'), 2);
  assert.equal(value('scripts_ready'), 2);
  assert.equal(value('content_published'), 1);
  assert.equal(value('missions_completed'), 1);
  assert.equal(value('task_streak'), 2);
  assert.equal(value('revenue_completed'), 100); // recalcular não muda: idempotente
});

test('progresso exibido para no alvo e preserva o valor real', () => {
  assert.deepEqual(goalProgress(7, 5), { actual: 7, shown: 5, percent: 100, reached: true });
  assert.deepEqual(goalProgress(2, 5), { actual: 2, shown: 2, percent: 40, reached: false });
});

test('notificações têm ID determinístico por evento', () => {
  const now = at('2026-10-08T15:00:00Z');
  const input = {
    missions: [
      { id: 'm1', title: 'A', status: 'pending', dueAt: at('2026-10-09T01:00:00Z') },
      { id: 'm2', title: 'B', status: 'pending', dueAt: at('2026-10-07T01:00:00Z') },
      { id: 'm3', title: 'C', status: 'pending', dueAt: at('2026-11-07T01:00:00Z') },
      { id: 'm4', title: 'D', status: 'pending' },
    ],
    occurrences: [
      { id: 't_2026-10-08', taskId: 't', date: '2026-10-08', time: '09:00', title: 'T', status: 'pending' },
      { id: 't_2026-10-07', taskId: 't', date: '2026-10-07', time: '09:00', title: 'T', status: 'missed' },
    ],
    goals: [
      { id: 'g1', title: 'G', target: 5, cycleKey: '2026-10-05', progress: { actual: 4, reached: false } },
      { id: 'g2', title: 'H', target: 5, cycleKey: '2026-10-05', progress: { actual: 5, reached: true } },
    ],
  };
  const ids = buildNotifications(input, now).map((n) => n.id).sort();
  assert.deepEqual(ids, ['goal_done_g2_2026-10-05', 'goal_near_g1_2026-10-05', 'mission_due_soon_m1', 'mission_overdue_m2', 'task_missed_t_2026-10-07', 'task_today_t_2026-10-08']);
  assert.deepEqual(buildNotifications(input, now).map((n) => n.id).sort(), ids);
});

// ---------------------------------------------------------------- correções da revisão técnica

test('task_streak respeita os limites do ciclo (cenário da revisão: era 3, o correto é 0)', () => {
  const closed = cycleBounds('weekly', at('2026-10-08T15:00:00Z')); // 05/10 a 11/10
  const occ = [['2026-10-05', 'completed'], ['2026-10-06', 'completed'], ['2026-10-07', 'missed'],
    ['2026-10-12', 'completed'], ['2026-10-13', 'completed'], ['2026-10-14', 'completed']].map(([date, status]) => ({ date, status }));
  const data = { orders: [], scripts: [], missions: [], occurrences: occ };
  // ciclo encerrado avaliado tarde: ocorrências posteriores ao fim não entram e o "hoje" é o último dia do ciclo
  assert.equal(metricValue('task_streak', closed, data, '2026-10-14'), 0);
  // ciclo encerrado em que a sequência termina no último dia
  const clean = { ...data, occurrences: [['2026-10-09', 'completed'], ['2026-10-10', 'completed'], ['2026-10-11', 'completed'], ['2026-10-12', 'completed']].map(([date, status]) => ({ date, status })) };
  assert.equal(metricValue('task_streak', closed, clean, '2026-10-14'), 3); // 09, 10 e 11; o dia 12 é do ciclo seguinte
});

test('task_streak em ciclo em andamento usa hoje e só conta a partir do início do ciclo', () => {
  const bounds = cycleBounds('weekly', at('2026-10-08T15:00:00Z')); // 05/10 a 11/10
  const o = (date, status) => ({ date, status });
  const data = { orders: [], scripts: [], missions: [], occurrences: [o('2026-10-02', 'completed'), o('2026-10-03', 'completed'), o('2026-10-05', 'completed'), o('2026-10-06', 'completed'), o('2026-10-07', 'completed'), o('2026-10-08', 'pending')] };
  assert.equal(metricValue('task_streak', bounds, data, '2026-10-08'), 3); // 02 e 03 são do ciclo anterior; hoje pendente não conta
  assert.equal(metricValue('task_streak', bounds, { ...data, occurrences: [...data.occurrences, o('2026-10-09', 'completed')] }, '2026-10-08'), 3); // futuro é ignorado
});

test('task_streak: limites de data — último dia incluído, dia seguinte (fim exclusivo) excluído', () => {
  const bounds = cycleBounds('daily', at('2026-10-08T15:00:00Z')); // só 08/10
  const o = (date, status) => ({ date, status });
  const value = (list, today) => metricValue('task_streak', bounds, { orders: [], scripts: [], missions: [], occurrences: list }, today);
  assert.equal(value([o('2026-10-07', 'completed'), o('2026-10-08', 'completed')], '2026-10-08'), 1); // dia anterior ao início fica fora
  assert.equal(value([o('2026-10-08', 'completed'), o('2026-10-09', 'missed')], '2026-10-09'), 1); // dia 09 já é outro ciclo
  assert.equal(value([o('2026-10-08', 'missed')], '2026-10-09'), 0);
});

test('cycleChanged detecta virada do período e mudança de limites com a mesma data de início', () => {
  const now = at('2026-10-05T15:00:00Z'); // segunda
  const weekly = cycleBounds('weekly', now);
  const goal = { cycleKey: weekly.key, cycleEnd: weekly.end };
  assert.equal(cycleChanged(goal, weekly), false);
  assert.equal(cycleChanged(goal, cycleBounds('daily', now)), true); // mesma chave (05/10), fim diferente
  assert.equal(cycleChanged(goal, cycleBounds('weekly', now, { weekStartsOn: 0 })), true);
  assert.equal(cycleChanged(goal, cycleBounds('weekly', at('2026-10-12T15:00:00Z'))), true);
});

test('registro de ciclo: normal e interrompido por reconfiguração preservam o resultado', () => {
  const bounds = cycleBounds('weekly', at('2026-10-08T15:00:00Z'));
  const goal = { id: 'g1', title: 'Roteiros', period: 'weekly', metric: 'scripts_ready', source: 'auto', target: 5, cycleKey: bounds.key, cycleEnd: bounds.end };
  const closed = cycleArchiveRecord(goal, 6, at('2026-10-13T03:00:00Z'));
  assert.deepEqual([closed.startKey, closed.endKey, closed.value, closed.reached, closed.endedEarly], ['2026-10-05', '2026-10-11', 6, true, undefined]);
  const early = cycleArchiveRecord(goal, 2, at('2026-10-08T15:00:00Z'), { endedEarly: true });
  assert.deepEqual([early.endKey, early.value, early.reached, early.endedEarly], ['2026-10-08', 2, false, true]);
});

test('IDs de aviso ligados a missão e ocorrência são os mesmos gerados por buildNotifications', () => {
  const now = at('2026-10-08T15:00:00Z');
  const made = buildNotifications({
    missions: [{ id: 'm1', title: 'A', status: 'pending', dueAt: at('2026-10-07T01:00:00Z') }, { id: 'm2', title: 'B', status: 'pending', dueAt: at('2026-10-09T01:00:00Z') }],
    occurrences: [{ id: 'k_2026-10-08', taskId: 'k', date: '2026-10-08', time: '09:00', title: 'T', status: 'pending' }, { id: 'k_2026-10-07', taskId: 'k', date: '2026-10-07', time: '09:00', title: 'T', status: 'missed' }],
  }, now).map((n) => n.id);
  for (const id of made) {
    const related = [...missionNotificationIds('m1'), ...missionNotificationIds('m2'), ...occurrenceNotificationIds('k_2026-10-08'), ...occurrenceNotificationIds('k_2026-10-07')];
    assert.ok(related.includes(id), id);
  }
  assert.deepEqual(missionNotificationIds('x'), ['mission_overdue_x', 'mission_due_soon_x']);
});

// ------------------------------------------------ meta de faturamento = Financeiro

const revenueOf = (orders, ledger, period, now) => {
  const entries = buildRevenueEntries([...orders, ...ledgerToOrders(ledger)]).entries;
  return { entries, goal: metricValue('revenue_completed', cycleBounds(period, now), { orders, scripts: [], missions: [], occurrences: [], revenueEntries: entries }, dateKey(now)) };
};

test('faturamento da meta usa a regra do Financeiro: pedido de evento vem do livro (parcelas e ajustes), não do pedido', () => {
  const day = (d) => new Date(`2026-10-${d}T15:00:00Z`);
  const orders = [
    { id: 'v1', status: 'completed', totalPaid: 30, completedAt: day('06') },
    // evento com livro: o pedido em si (R$ 800) NÃO conta; contam a entrada, o restante e o ajuste do livro
    { id: 'ev1', status: 'completed', totalPaid: 800, completedAt: day('07'), eventLedger: { entry: 300, final: 500 } },
  ];
  const ledger = [
    { id: 'l1', orderId: 'ev1', kind: 'entry', type: 'revenue', amount: 300, date: day('01'), clientId: 'c', serviceId: 's' }, // outra semana
    { id: 'l2', orderId: 'ev1', kind: 'final', type: 'revenue', amount: 500, date: day('07'), clientId: 'c', serviceId: 's' },
    { id: 'l3', orderId: 'ev1', kind: 'adjrev', type: 'revenue', amount: -50, date: day('08'), clientId: 'c', serviceId: 's', seq: 1 },
    { id: 'l4', orderId: 'ev1', kind: 'cost', type: 'expense', amount: 200, date: day('07'), clientId: 'c', serviceId: 's' }, // despesa não é faturamento
  ];
  const { entries, goal } = revenueOf(orders, ledger, 'weekly', at('2026-10-08T15:00:00Z')); // semana 05–11/10
  assert.equal(goal, 30 + 500 - 50);
  // igual ao total do Financeiro para o mesmo recorte de datas (todo o mês, pois a entrada de 01/10 é da semana anterior)
  assert.equal(metricValue('revenue_completed', cycleBounds('monthly', at('2026-10-08T15:00:00Z')), { revenueEntries: entries }, '2026-10-08'), monthTotals(entries, monthKeyOf(day('07'))).total);
});

test('faturamento da meta: pedido antigo sem completedAt cai em eventDate/paidAt e valor cai em servicePrice + rushFee, como no Financeiro', () => {
  const day = (d) => new Date(`2026-10-${d}T15:00:00Z`);
  const orders = [
    { id: 'old1', status: 'completed', servicePrice: 40, rushFee: 10, eventDate: day('06') }, // sem completedAt nem totalPaid
    { id: 'old2', status: 'completed', totalPaid: 25, paidAt: day('07') }, // só paidAt
    { id: 'none', status: 'completed', totalPaid: 99 }, // sem nenhuma data: fora (o Financeiro também avisa "sem data")
    { id: 'dup', status: 'completed', totalPaid: 15, completedAt: day('08') },
    { id: 'dup', status: 'completed', totalPaid: 15, completedAt: day('08') }, // mesmo id: uma vez só
    { id: 'open', status: 'delivery', totalPaid: 70, completedAt: day('08') }, // não concluído
  ];
  assert.equal(revenueOf(orders, [], 'weekly', at('2026-10-08T15:00:00Z')).goal, 50 + 25 + 15);
});

test('faturamento da meta respeita os limites do ciclo (início inclusivo, fim exclusivo, fuso de Brasília)', () => {
  const bounds = cycleBounds('daily', at('2026-10-08T15:00:00Z')); // 08/10 03:00Z até 09/10 03:00Z
  const orders = [
    { id: 'a', status: 'completed', totalPaid: 10, completedAt: at('2026-10-08T03:00:00Z') }, // 00:00 de 08/10: dentro
    { id: 'b', status: 'completed', totalPaid: 20, completedAt: at('2026-10-09T02:59:59Z') }, // 23:59 de 08/10: dentro
    { id: 'c', status: 'completed', totalPaid: 40, completedAt: at('2026-10-09T03:00:00Z') }, // 00:00 de 09/10: fora
    { id: 'd', status: 'completed', totalPaid: 80, completedAt: at('2026-10-08T02:59:59Z') }, // 23:59 de 07/10: fora
  ];
  const entries = buildRevenueEntries(orders).entries;
  assert.equal(metricValue('revenue_completed', bounds, { revenueEntries: entries }, '2026-10-08'), 30);
});

// ------------------------------------------------ metas do Instagram

const igDay = (d, h = 15) => new Date(`2026-10-${d}T${String(h).padStart(2, '0')}:00:00Z`);
const igPost = (id, day, likes, comments, views) => ({ id, publishedAt: igDay(day).toISOString(), likes, comments, views });

// post: [id, dia da publicação, curtidas, comentários, views]; snap: retrato diário por publicação
const post = (id, published, likes, comments, views) => ({ id, publishedAt: published, likes, comments, views });
const snap = (day, posts) => ({ day, followers: 1000, posts });
const ig = (over) => ({ followers: 1500, syncedAt: '2026-10-08T12:00:00.000Z', posts: [], stats: [], ...over });

test('Instagram: curtidas/comentários/views = ganho de cada publicação no ciclo, inclusive posts antigos; post novo conta desde 0', () => {
  const bounds = cycleBounds('weekly', at('2026-10-08T15:00:00Z')); // 05–11/10
  const data = ig({
    posts: [
      post('antigo', '2026-09-20T12:00:00.000Z', 1150, 130, 40000), // ganhou 150 / 30 / 5000 no ciclo
      post('novo', '2026-10-07T12:00:00.000Z', 80, 8, 900), // feito no ciclo: tudo é do ciclo
      post('depois', '2026-10-12T12:00:00.000Z', 999, 99, 9999), // depois do ciclo: fora
      post('semBase', '2026-08-01T12:00:00.000Z', 500, 50, 5000), // antigo e fora do retrato: ganho desconhecido, fica de fora
      post('oculto', '2026-09-01T12:00:00.000Z', null, null, null), // métrica indisponível: fora, nunca vira 0
      { id: 'semdata', publishedAt: null, likes: 5, comments: 5, views: 5 },
    ],
    stats: [snap('2026-10-05', { antigo: [1000, 100, 35000], oculto: [10, 1, 100] })],
  });
  const value = (m) => metricValue(m, bounds, { instagram: data }, '2026-10-08');
  assert.deepEqual(['ig_posts', 'ig_likes', 'ig_comments', 'ig_views'].map(value), [1, 150 + 80, 30 + 8, 5000 + 900]);
  const e = engagementInCycle('ig_likes', bounds, data, '2026-10-08');
  assert.deepEqual([e.from, e.partial, e.pending], ['2026-10-05', false, false]);
  assert.equal(metricValue('ig_likes', bounds, {}, '2026-10-08'), 0); // sem dados do Instagram
});

test('Instagram: engajamento com base parcial (1º retrato depois do início) e pendente (sem retrato por publicação)', () => {
  const bounds = cycleBounds('weekly', at('2026-10-08T15:00:00Z'));
  const posts = [post('antigo', '2026-09-20T12:00:00.000Z', 1150, 130, 40000), post('novo', '2026-10-06T12:00:00.000Z', 80, 8, 900)];
  const partial = ig({ posts, stats: [snap('2026-10-07', { antigo: [1100, 120, 38000] })] });
  assert.equal(metricValue('ig_views', bounds, { instagram: partial }, '2026-10-08'), 2000 + 900);
  assert.deepEqual([engagementInCycle('ig_views', bounds, partial, '2026-10-08').partial, engagementInCycle('ig_views', bounds, partial, '2026-10-08').from], [true, '2026-10-07']);
  // retrato só de seguidores (sem posts por publicação) não serve de base de engajamento
  const pending = ig({ posts, stats: [{ day: '2026-10-05', followers: 1000 }] });
  const e = engagementInCycle('ig_likes', bounds, pending, '2026-10-08');
  assert.deepEqual([e.value, e.pending, e.from], [80, true, null]); // só o post novo, até o 1º retrato
  assert.match(instagramNote('ig_likes', bounds, { instagram: pending }, '2026-10-08'), /depois do primeiro retrato/);
  assert.match(instagramNote('ig_likes', bounds, { instagram: partial }, '2026-10-08'), /Publicações antigas contam desde 07\/10/);
});

test('Instagram: ciclo encerrado usa o retrato do dia seguinte como fim; sem ele, o último retrato do ciclo; limites de data respeitados', () => {
  const bounds = cycleBounds('weekly', at('2026-10-08T15:00:00Z')); // 05–11/10
  const posts = [post('antigo', '2026-09-20T12:00:00.000Z', 9999, 99, 99999), post('novo', '2026-10-06T12:00:00.000Z', 9999, 99, 99999)]; // valores atuais não valem
  const stats = [snap('2026-10-05', { antigo: [1000, 0, 0] }), snap('2026-10-09', { antigo: [1100, 0, 0], novo: [60, 0, 0] }), snap('2026-10-12', { antigo: [1200, 0, 0], novo: [70, 0, 0] })];
  assert.equal(metricValue('ig_likes', bounds, { instagram: ig({ posts, stats }) }, '2026-10-14'), (1200 - 1000) + 70);
  assert.equal(metricValue('ig_likes', bounds, { instagram: ig({ posts, stats: stats.slice(0, 2) }) }, '2026-10-14'), (1100 - 1000) + 60); // sem retrato do dia 12
  // início inclusivo / fim exclusivo da data de publicação (fuso de Brasília): 05/10 00:00 entra; 12/10 00:00 não
  const edge = ig({ posts: [post('a', '2026-10-05T03:00:00.000Z', 1, 0, 0), post('b', '2026-10-12T03:00:00.000Z', 2, 0, 0), post('c', '2026-10-05T02:59:59.000Z', 4, 0, 0)], stats: [snap('2026-10-05', { c: [3, 0, 0] })] });
  assert.equal(metricValue('ig_likes', bounds, { instagram: edge }, '2026-10-08'), 1 + (4 - 3));
});

test('progresso exibido nunca é negativo (ganho de seguidores pode ser negativo); o valor real é preservado', () => {
  assert.deepEqual(goalProgress(-20, 100), { actual: -20, shown: 0, percent: 0, reached: false });
});

test('Instagram: ganho de seguidores = atual − retrato do 1º dia do ciclo; parcial quando o 1º retrato é posterior; ciclo encerrado usa o retrato seguinte', () => {
  const bounds = cycleBounds('weekly', at('2026-10-08T15:00:00Z')); // 05–11/10
  const stats = [{ day: '2026-10-04', followers: 900 }, { day: '2026-10-05', followers: 1000 }, { day: '2026-10-06', followers: 1020 }, { day: '2026-10-12', followers: 1100 }];
  const ig = { followers: 1060, syncedAt: 'x', posts: [], stats };
  assert.equal(metricValue('ig_followers_gain', bounds, { instagram: ig }, '2026-10-08'), 60); // em andamento: atual − 1000
  assert.equal(metricValue('ig_followers_gain', bounds, { instagram: ig }, '2026-10-14'), 100); // encerrado: retrato de 12/10 − 1000
  const late = { ...ig, stats: [{ day: '2026-10-07', followers: 1030 }] };
  assert.equal(metricValue('ig_followers_gain', bounds, { instagram: late }, '2026-10-08'), 30);
  assert.equal(followersGain(bounds, late, '2026-10-08').partial, true);
  assert.equal(followersGain(bounds, ig, '2026-10-08').partial, false);
  // perdeu seguidores: valor negativo (a meta mostra 0% no progresso, o real fica preservado)
  assert.equal(metricValue('ig_followers_gain', bounds, { instagram: { ...ig, followers: 980 } }, '2026-10-08'), -20);
  // sem retrato no ciclo: 0 (e a observação avisa)
  const none = { ...ig, stats: [{ day: '2026-10-01', followers: 800 }] };
  assert.equal(metricValue('ig_followers_gain', bounds, { instagram: none }, '2026-10-08'), 0);
});

test('Instagram: observação informa frescor, base parcial e ausência de sincronização; outras metas não têm observação', () => {
  const bounds = cycleBounds('weekly', at('2026-10-08T15:00:00Z'));
  const base = { followers: 1000, syncedAt: '2026-10-08T12:00:00.000Z', posts: [], stats: [] };
  assert.match(instagramNote('ig_likes', bounds, { instagram: { ...base } }, '2026-10-08'), /Dados do Instagram de 08\/10 às 09:00/);
  assert.match(instagramNote('ig_followers_gain', bounds, { instagram: base }, '2026-10-08'), /Aguardando o primeiro retrato/);
  assert.match(instagramNote('ig_followers_gain', bounds, { instagram: { ...base, stats: [{ day: '2026-10-07', followers: 990 }] } }, '2026-10-08'), /Contando desde 07\/10/);
  assert.match(instagramNote('ig_likes', bounds, { instagram: { ...base, syncedAt: null } }, '2026-10-08'), /ainda não sincronizado/);
  assert.match(instagramNote('ig_likes', bounds, {}, '2026-10-08'), /ainda não sincronizado/);
  assert.equal(instagramNote('revenue_completed', bounds, {}, '2026-10-08'), null);
  assert.ok(INSTAGRAM_METRICS.every((m) => Object.hasOwn(GOAL_METRICS, m)));
});
