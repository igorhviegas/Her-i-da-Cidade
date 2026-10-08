// Treino na academia (puro, sem React/Firebase): checklist de exercícios, timer por exercício e cronômetro do treino.
// A sessão é um objeto simples (cabe no localStorage) e todo tempo é calculado a partir de carimbos (ms), então recarregar a página
// ou bloquear a tela não perde o cronômetro nem o timer: o que passou enquanto isso é contado ao voltar.

/** Move o item de `index` uma posição (-1 sobe, +1 desce); nas pontas devolve a mesma lista. */
export function moveItem(list, index, delta) {
  const next = index + delta;
  if (index < 0 || index >= list.length || next < 0 || next >= list.length) return list;
  const copy = [...list];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  return copy;
}

/** Sessão a partir do plano e da biblioteca de exercícios (exercício apagado da biblioteca sai do treino). */
export function startSession(plan, exercisesById, now) {
  const items = plan.exerciseIds
    .filter((id) => exercisesById.has(id))
    .map((id) => { const ex = exercisesById.get(id); return { id, name: ex.name, category: ex.category, timerSec: ex.timerSec ?? null, done: false, timerEndsAt: null }; });
  return { planId: plan.id, planName: plan.name, startedAt: now, items };
}

const update = (session, id, change) => ({ ...session, items: session.items.map((item) => (item.id === id ? { ...item, ...change(item) } : item)) });

/**
 * Marca/desmarca. Exercício com timer só pode ser marcado pelo próprio timer (ao terminar): o clique em um exercício com timer
 * ainda não feito não faz nada. Desmarcar sempre é permitido.
 */
export function toggleItem(session, id) {
  return update(session, id, (item) => (item.done ? { done: false, timerEndsAt: null } : item.timerSec ? {} : { done: true }));
}

/** Inicia o timer pré-definido do exercício (não faz nada sem timer, se já está feito ou se já está rodando). */
export function startTimer(session, id, now) {
  return update(session, id, (item) => (item.timerSec && !item.done && item.timerEndsAt === null ? { timerEndsAt: now + item.timerSec * 1000 } : {}));
}

export const cancelTimer = (session, id) => update(session, id, (item) => (item.done ? {} : { timerEndsAt: null }));

/** Conclui os exercícios cujo timer já acabou. `finished` traz os ids que acabaram agora (para avisar com som/vibração). */
export function tickSession(session, now) {
  const finished = session.items.filter((item) => !item.done && item.timerEndsAt !== null && item.timerEndsAt <= now).map((item) => item.id);
  if (!finished.length) return { session, finished };
  return { session: { ...session, items: session.items.map((item) => (finished.includes(item.id) ? { ...item, done: true, timerEndsAt: null } : item)) }, finished };
}

/** Troca a ordem de um exercício na sessão. Um timer em andamento continua valendo. */
export function moveSessionItem(session, id, delta) {
  const index = session.items.findIndex((item) => item.id === id);
  const items = moveItem(session.items, index, delta);
  return items === session.items ? session : { ...session, items };
}

export const timerRemainingSec = (item, now) => (item.timerEndsAt === null ? null : Math.max(0, Math.ceil((item.timerEndsAt - now) / 1000)));
export const elapsedSec = (session, now) => Math.max(0, Math.floor((now - session.startedAt) / 1000));

/** Resumo para o check-in: exercícios feitos/total e duração em minutos (mínimo 1). */
export function summarizeSession(session, now) {
  return { exercisesDone: session.items.filter((item) => item.done).length, exercisesTotal: session.items.length, durationMin: Math.max(1, Math.round(elapsedSec(session, now) / 60)) };
}

/** 75 -> "01:15"; 3725 -> "1:02:05". */
export function formatClock(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  const mm = String(m).padStart(2, '0'); const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Valida os dados de um exercício da biblioteca. timerSec: segundos (5–3.600) ou ausente quando não há timer. */
export function normalizeExercise({ name, category, timerSec }) {
  const cleanName = String(name ?? '').trim();
  const cleanCategory = String(category ?? '').trim();
  if (!cleanName || cleanName.length > 80) return { error: 'Informe o nome do exercício (até 80 caracteres).' };
  if (!cleanCategory || cleanCategory.length > 40) return { error: 'Informe a categoria (até 40 caracteres), por exemplo Perna, Costas ou Abdômen.' };
  const seconds = timerSec === '' || timerSec == null || timerSec === false ? null : Number(timerSec);
  if (seconds !== null && !(Number.isInteger(seconds) && seconds >= 5 && seconds <= 3600)) return { error: 'O timer deve ter de 5 a 3.600 segundos.' };
  return { value: { name: cleanName, category: cleanCategory, timerSec: seconds } };
}

/** Valida um plano de treino: nome e lista de exercícios sem repetição (até 60). */
export function normalizeWorkout({ name, exerciseIds }) {
  const cleanName = String(name ?? '').trim();
  if (!cleanName || cleanName.length > 60) return { error: 'Informe o nome do treino (até 60 caracteres), por exemplo Treino A.' };
  const ids = [...new Set(Array.isArray(exerciseIds) ? exerciseIds.filter((id) => typeof id === 'string' && id) : [])];
  if (ids.length > 60) return { error: 'Um treino aceita até 60 exercícios.' };
  return { value: { name: cleanName, exerciseIds: ids } };
}
