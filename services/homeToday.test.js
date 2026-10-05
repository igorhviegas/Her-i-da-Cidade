import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveriesToday, tasksToday } from './homeToday.js';

// Quinta 01/10/2026 12:00 em Brasília
const NOW = new Date('2026-10-01T15:00:00Z');
const at = (iso) => new Date(iso);

test('entregas de hoje: só em andamento com prazo do cliente hoje (Brasília); atenção antes de "Entregar"', () => {
  const orders = [
    { id: 'a', status: 'delivery', customerDueDate: at('2026-10-01T22:00:00Z') }, // 19:00 BRT hoje
    { id: 'b', status: 'editing', customerDueDate: { toDate: () => at('2026-10-01T03:00:00Z') } }, // 00:00 BRT hoje
    { id: 'c', status: 'editing', customerDueDate: at('2026-10-02T02:59:00Z') }, // 23:59 BRT hoje
    { id: 'd', status: 'editing', customerDueDate: at('2026-10-02T03:00:00Z') }, // amanhã 00:00 BRT
    { id: 'e', status: 'editing', customerDueDate: at('2026-10-01T02:59:00Z') }, // ontem 23:59 BRT
    { id: 'f', status: 'completed', customerDueDate: at('2026-10-01T15:00:00Z') },
    { id: 'g', status: 'recording' },
  ];
  const result = deliveriesToday(orders, NOW);
  assert.deepEqual(result.map((r) => [r.order.id, r.attention]), [['b', true], ['c', true], ['a', false]]);
});

test('tarefas de hoje: ocorrências do dia + missões com prazo hoje, com contagens; ignora ignoradas e outros dias', () => {
  const occurrences = [
    { id: 'o1', taskId: 't', date: '2026-10-01', time: '14:00', title: 'Postar', status: 'pending' },
    { id: 'o2', taskId: 't2', date: '2026-10-01', time: '08:00', title: 'Backup', status: 'completed' },
    { id: 'o3', taskId: 't3', date: '2026-10-01', time: '07:00', title: 'Pausada', status: 'skipped' },
    { id: 'o4', taskId: 't', date: '2026-09-30', time: '14:00', title: 'Ontem', status: 'missed' },
  ];
  const missions = [
    { id: 'm1', title: 'Pagar conta', status: 'pending', dueAt: at('2026-10-02T02:59:59.999Z') }, // fim do dia
    { id: 'm2', title: 'Ligar', status: 'completed', dueAt: at('2026-10-01T18:30:00Z') }, // 15:30
    { id: 'm3', title: 'Amanhã', status: 'pending', dueAt: at('2026-10-03T02:59:59.999Z') },
    { id: 'm4', title: 'Sem prazo', status: 'pending' },
  ];
  const r = tasksToday(occurrences, missions, NOW);
  assert.deepEqual(r.items.map((i) => [i.title, i.time, i.status]), [
    ['Backup', '08:00', 'completed'], ['Postar', '14:00', 'pending'], ['Ligar', '15:30', 'completed'], ['Pagar conta', '', 'pending'],
  ]);
  assert.deepEqual([r.completed, r.pending, r.missed], [2, 2, 0]);
});
