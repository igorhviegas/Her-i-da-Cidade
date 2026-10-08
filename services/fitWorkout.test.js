import test from 'node:test';
import assert from 'node:assert/strict';
import { cancelTimer, elapsedSec, formatClock, moveItem, moveSessionItem, normalizeExercise, normalizeWorkout, startSession, startTimer, summarizeSession, tickSession, timerRemainingSec, toggleItem } from './fitWorkout.js';

const exercises = new Map([
  ['supino', { id: 'supino', name: 'Supino reto', category: 'Peito', timerSec: null }],
  ['prancha', { id: 'prancha', name: 'Prancha', category: 'Abdômen', timerSec: 60 }],
  ['agacho', { id: 'agacho', name: 'Agachamento', category: 'Perna', timerSec: null }],
]);
const plan = { id: 'a', name: 'Treino A', exerciseIds: ['supino', 'prancha', 'apagado', 'agacho'] };
const T0 = 1_000_000;

test('moveItem: sobe e desce; nas pontas e com índice inválido devolve a mesma lista', () => {
  assert.deepEqual(moveItem(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(['a', 'b', 'c'], 1, 1), ['a', 'c', 'b']);
  const list = ['a', 'b'];
  assert.equal(moveItem(list, 0, -1), list);
  assert.equal(moveItem(list, 1, 1), list);
  assert.equal(moveItem(list, 5, 1), list);
});

test('startSession: respeita a ordem do plano, ignora exercício apagado da biblioteca e começa tudo pendente', () => {
  const s = startSession(plan, exercises, T0);
  assert.deepEqual(s.items.map((i) => i.id), ['supino', 'prancha', 'agacho']);
  assert.equal(s.startedAt, T0);
  assert.ok(s.items.every((i) => i.done === false && i.timerEndsAt === null));
  assert.equal(s.items[1].timerSec, 60);
});

test('exercício sem timer marca e desmarca no clique; com timer o clique não marca (só o timer conclui)', () => {
  let s = startSession(plan, exercises, T0);
  s = toggleItem(s, 'supino');
  assert.equal(s.items[0].done, true);
  s = toggleItem(s, 'supino');
  assert.equal(s.items[0].done, false);
  assert.deepEqual(toggleItem(s, 'prancha'), s); // clique em exercício com timer pendente: sem mudança
});

test('timer: inicia com o tempo pré-definido, não reinicia nem inicia sem timer, conclui sozinho ao acabar e pode ser cancelado', () => {
  let s = startSession(plan, exercises, T0);
  assert.equal(startTimer(s, 'supino', T0).items[0].timerEndsAt, null); // sem timer
  s = startTimer(s, 'prancha', T0 + 5000);
  assert.equal(s.items[1].timerEndsAt, T0 + 65000);
  assert.equal(startTimer(s, 'prancha', T0 + 30000).items[1].timerEndsAt, T0 + 65000); // já rodando: não reinicia
  assert.equal(timerRemainingSec(s.items[1], T0 + 5000), 60);
  assert.equal(timerRemainingSec(s.items[1], T0 + 64500), 1);
  assert.equal(timerRemainingSec(s.items[0], T0), null);
  let tick = tickSession(s, T0 + 64999);
  assert.deepEqual(tick.finished, []);
  assert.equal(tick.session, s); // nada mudou
  tick = tickSession(s, T0 + 65000);
  assert.deepEqual(tick.finished, ['prancha']);
  assert.equal(tick.session.items[1].done, true);
  assert.equal(tick.session.items[1].timerEndsAt, null);
  assert.deepEqual(tickSession(tick.session, T0 + 99999).finished, []); // não avisa duas vezes
  const cancelled = cancelTimer(s, 'prancha');
  assert.equal(cancelled.items[1].timerEndsAt, null);
  assert.equal(cancelled.items[1].done, false);
  assert.equal(toggleItem(tick.session, 'prancha').items[1].done, false); // desmarcar um timer feito é permitido
});

test('voltar depois de muito tempo (tela bloqueada) conclui o timer vencido no primeiro tick', () => {
  const s = startTimer(startSession(plan, exercises, T0), 'prancha', T0);
  assert.deepEqual(tickSession(s, T0 + 3_600_000).finished, ['prancha']);
});

test('moveSessionItem: alterna a ordem na sessão, preserva timer em andamento e estado dos itens', () => {
  let s = startTimer(toggleItem(startSession(plan, exercises, T0), 'supino'), 'prancha', T0);
  s = moveSessionItem(s, 'agacho', -1);
  assert.deepEqual(s.items.map((i) => i.id), ['supino', 'agacho', 'prancha']);
  assert.equal(s.items[2].timerEndsAt, T0 + 60000);
  assert.equal(s.items[0].done, true);
  assert.equal(moveSessionItem(s, 'supino', -1), s); // já é o primeiro
  assert.equal(moveSessionItem(s, 'inexistente', 1), s);
});

test('cronômetro e resumo: tempo desde o início, feitos/total e duração em minutos (mínimo 1)', () => {
  const s = toggleItem(startSession(plan, exercises, T0), 'supino');
  assert.equal(elapsedSec(s, T0 + 75_400), 75);
  assert.equal(elapsedSec(s, T0 - 5000), 0);
  assert.deepEqual(summarizeSession(s, T0 + 45 * 60_000), { exercisesDone: 1, exercisesTotal: 3, durationMin: 45 });
  assert.equal(summarizeSession(s, T0 + 10_000).durationMin, 1);
  assert.equal(formatClock(75), '01:15');
  assert.equal(formatClock(3725), '1:02:05');
  assert.equal(formatClock(-3), '00:00');
});

test('normalizeExercise: nome, categoria e timer opcional (5–3.600 s, inteiro)', () => {
  assert.deepEqual(normalizeExercise({ name: '  Prancha ', category: ' Abdômen ', timerSec: 60 }), { value: { name: 'Prancha', category: 'Abdômen', timerSec: 60 } });
  assert.deepEqual(normalizeExercise({ name: 'Supino', category: 'Peito', timerSec: '' }).value.timerSec, null);
  assert.deepEqual(normalizeExercise({ name: 'Supino', category: 'Peito' }).value.timerSec, null);
  for (const bad of [{ name: '', category: 'X' }, { name: 'X', category: '' }, { name: 'x'.repeat(81), category: 'X' }, { name: 'X', category: 'c'.repeat(41) }, { name: 'X', category: 'Y', timerSec: 4 }, { name: 'X', category: 'Y', timerSec: 3601 }, { name: 'X', category: 'Y', timerSec: 30.5 }, { name: 'X', category: 'Y', timerSec: 'abc' }]) {
    assert.ok('error' in normalizeExercise(bad), JSON.stringify(bad));
  }
});

test('normalizeWorkout: nome obrigatório, ids sem repetição, até 60 exercícios', () => {
  assert.deepEqual(normalizeWorkout({ name: ' Treino A ', exerciseIds: ['a', 'b', 'a', '', 5] }), { value: { name: 'Treino A', exerciseIds: ['a', 'b'] } });
  assert.deepEqual(normalizeWorkout({ name: 'B', exerciseIds: 'x' }), { value: { name: 'B', exerciseIds: [] } });
  assert.ok('error' in normalizeWorkout({ name: ' ', exerciseIds: [] }));
  assert.ok('error' in normalizeWorkout({ name: 'n'.repeat(61), exerciseIds: [] }));
  assert.ok('error' in normalizeWorkout({ name: 'A', exerciseIds: Array.from({ length: 61 }, (_, i) => `e${i}`) }));
});
