import {
  collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, type Transaction,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import {
  addDays, buildNotifications, cycleArchiveRecord, cycleBounds, cycleChanged, dateKey, goalProgress, metricValue, missionNotificationIds,
  occurrenceNotificationIds, syncRecurringTasks, taskReminderSupported, validateGoal, validateTask,
  type GoalMetric, type GoalPeriod, type GoalProgress, type Frequency,
} from '../functions/missions-core.js';
import { cleanChecklist, type ChecklistItem } from '../functions/event-missions.js';
import { ORDERS_COLLECTION } from './ordersService';
import { CONTENT_SCRIPTS_COLLECTION } from './contentScriptsService';
import { activityRefs, prepareActivityLog } from './activityLog';

export const MISSIONS_COLLECTION = 'missions';
export const TASKS_COLLECTION = 'recurringTasks';
export const OCCURRENCES_COLLECTION = 'taskOccurrences';
export const GOALS_COLLECTION = 'goals';
export const GOAL_CYCLES_COLLECTION = 'goalCycles';
export const NOTIFICATIONS_COLLECTION = 'notifications';
const GAMIFICATION_CONFIG = ['siteConfig', 'gamification'] as const;
const HISTORY_DAYS = 30;

export interface Mission { id: string; title: string; description: string; dueAt?: Date; difficulty: number; status: 'pending' | 'completed'; source?: string; createdAt?: Date; completedAt?: Date; checklist?: ChecklistItem[]; orderState?: 'active' | 'deleted'; alexaReminder?: boolean; }
export interface RecurringTask { id: string; title: string; description: string; difficulty: number; time: string; frequency: Frequency; weekdays: number[]; monthDay: number | null; monthNth: { week: number; weekday: number } | null; status: 'active' | 'paused'; startDate: string; lastGeneratedDate?: string; alexaReminder?: boolean; }
export interface TaskOccurrence { id: string; taskId: string; date: string; time: string; title: string; description: string; difficulty: number; status: 'pending' | 'completed' | 'missed' | 'skipped'; dueAt?: Date; completedAt?: Date; }
export interface Goal { id: string; title: string; description: string; period: GoalPeriod; target: number; source: 'manual' | 'auto'; metric?: GoalMetric; progress: number; status: 'active' | 'paused'; weekStartsOn: number; monthStartDay: number; cycleKey: string; cycleStart: Date; cycleEnd: Date; completedAt?: Date; }
export interface GoalCycle { id: string; goalId: string; title: string; startKey: string; endKey: string; target: number; value: number; reached: boolean; }
export interface GoalView extends Goal { actual: number; view: GoalProgress; }
export interface AppNotification { id: string; type: string; title: string; body: string; refType: string; refId: string; dismissed: boolean; createdAt?: Date; }

export type MissionInput = { title: string; description: string; dueAt: Date | null; difficulty: number; checklist?: ChecklistItem[]; alexaReminder?: boolean };
export type TaskInput = Omit<RecurringTask, 'id' | 'status' | 'startDate' | 'lastGeneratedDate'>;
export type GoalInput = Pick<Goal, 'title' | 'description' | 'period' | 'target' | 'source' | 'metric' | 'weekStartsOn' | 'monthStartDay'>;

function firestore() {
  if (!db) throw new Error('Firestore não inicializado.');
  return db;
}

/** Converte Timestamps do Firestore em Date. */
function mapDoc<T>(id: string, data: Record<string, any>): T {
  const out: Record<string, any> = { id };
  for (const [key, value] of Object.entries(data)) out[key] = typeof value?.toDate === 'function' ? value.toDate() : value;
  return out as T;
}
const mapAll = <T,>(snapshot: { docs: { id: string; data(): Record<string, any> }[] }) => snapshot.docs.map((d) => mapDoc<T>(d.id, d.data()));
const thirtyDaysAgo = (now: Date) => new Date(now.getTime() - HISTORY_DAYS * 86400000);

// ------------------------------------------------------------- atividades (gamificação futura)

// O registro em activityLog é gravado na mesma transação da conclusão (functions/activity-log.js): ou grava os dois, ou nenhum.

/** Dificuldade (1–5) por tipo de atividade: `service_<serviceId>` e `script_created`. */
export async function getActivityDifficulties(): Promise<Record<string, number>> {
  const snapshot = await getDoc(doc(firestore(), ...GAMIFICATION_CONFIG));
  return (snapshot.data()?.difficulties as Record<string, number>) || {};
}

export async function setActivityDifficulty(key: string, difficulty: number): Promise<void> {
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 5) throw new Error('A dificuldade deve ser de 1 a 5.');
  await setDoc(doc(firestore(), ...GAMIFICATION_CONFIG), { difficulties: { [key]: difficulty }, updatedAt: serverTimestamp() }, { merge: true });
}

// ------------------------------------------------------------------------------- missões

function cleanMission(input: MissionInput): MissionInput {
  const title = input.title.trim();
  if (!title) throw new Error('Informe o título da missão.');
  if (!Number.isInteger(input.difficulty) || input.difficulty < 1 || input.difficulty > 5) throw new Error('A dificuldade deve ser de 1 a 5.');
  return { title, description: input.description.trim(), dueAt: input.dueAt, difficulty: input.difficulty, checklist: cleanChecklist(input.checklist), alexaReminder: input.alexaReminder === true && !!input.dueAt };
}

/** Pendentes + concluídas nos últimos 30 dias. Concluídas mais antigas continuam no banco (gamificação), só não são exibidas. */
export async function listMissions(now = new Date()): Promise<{ pending: Mission[]; history: Mission[] }> {
  const col = collection(firestore(), MISSIONS_COLLECTION);
  const [pending, history] = await Promise.all([
    getDocs(query(col, where('status', '==', 'pending'))),
    getDocs(query(col, where('completedAt', '>=', thirtyDaysAgo(now)))),
  ]);
  return {
    pending: mapAll<Mission>(pending),
    history: mapAll<Mission>(history).sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime()),
  };
}

export async function createMission(input: MissionInput): Promise<void> {
  const clean = cleanMission(input);
  await setDoc(doc(collection(firestore(), MISSIONS_COLLECTION)), {
    title: clean.title, description: clean.description, difficulty: clean.difficulty, status: 'pending', source: 'crm',
    ...(clean.dueAt ? { dueAt: clean.dueAt } : {}), ...(clean.checklist!.length ? { checklist: clean.checklist } : {}), alexaReminder: clean.alexaReminder, createdAt: serverTimestamp(),
  });
}

export async function updateMission(id: string, input: MissionInput): Promise<void> {
  const clean = cleanMission(input);
  await updateDoc(doc(firestore(), MISSIONS_COLLECTION, id), {
    title: clean.title, description: clean.description, difficulty: clean.difficulty, dueAt: clean.dueAt ?? deleteField(), checklist: clean.checklist!.length ? clean.checklist : deleteField(), alexaReminder: clean.alexaReminder, updatedAt: serverTimestamp(),
  });
}

/** Marca/desmarca um item lendo o checklist salvo (transação), então dois cliques rápidos ou outra aba não sobrescrevem os demais itens. */
export async function toggleChecklistItem(missionId: string, itemId: string, done: boolean): Promise<void> {
  const ref = doc(firestore(), MISSIONS_COLLECTION, missionId);
  await runTransaction(firestore(), async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Missão não encontrada.');
    const checklist = cleanChecklist(snapshot.data().checklist).map((item) => (item.id === itemId ? { ...item, done } : item));
    transaction.update(ref, { checklist, updatedAt: serverTimestamp() });
  });
}

/** Avisos ainda abertos entre os IDs informados (leitura; chamar antes das escritas da transação). */
async function openNotices(transaction: Transaction, ids: string[]) {
  const refs = ids.map((id) => doc(firestore(), NOTIFICATIONS_COLLECTION, id));
  const snapshots = await Promise.all(refs.map((ref) => transaction.get(ref)));
  return refs.filter((_, index) => snapshots[index].exists() && snapshots[index].data()!.dismissed === false);
}
const dismissNotices = (transaction: Transaction, refs: ReturnType<typeof doc>[]) => refs.forEach((ref) => transaction.update(ref, { dismissed: true, dismissedAt: serverTimestamp() }));

/** Conclui a missão, registra a atividade e descarta os avisos dela na mesma transação. */
export async function completeMission(id: string): Promise<void> {
  const ref = doc(firestore(), MISSIONS_COLLECTION, id);
  const completedAt = new Date();
  await runTransaction(firestore(), async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Missão não encontrada.');
    if (snapshot.data().status !== 'pending') throw new Error('Esta missão já foi concluída.');
    const refs = activityRefs(firestore(), 'mission', id);
    const record = await prepareActivityLog(transaction, refs, { type: 'mission', refId: id, occurredAt: completedAt, difficulty: snapshot.data().difficulty });
    const notices = await openNotices(transaction, missionNotificationIds(id));
    transaction.update(ref, { status: 'completed', completedAt, updatedAt: serverTimestamp() });
    if (record) transaction.set(refs.logRef, record);
    dismissNotices(transaction, notices);
  });
}

/** Excluir a missão descarta os avisos dela; o registro de atividade (se já concluída) permanece. */
export async function deleteMission(id: string): Promise<void> {
  const ref = doc(firestore(), MISSIONS_COLLECTION, id);
  await runTransaction(firestore(), async (transaction) => {
    const notices = await openNotices(transaction, missionNotificationIds(id));
    transaction.delete(ref);
    dismissNotices(transaction, notices);
  });
}

// ------------------------------------------------------------------- tarefas recorrentes

function cleanTask(input: TaskInput): TaskInput {
  const errors = validateTask(input);
  if (errors.length) throw new Error(errors.join(' '));
  const clean: TaskInput = {
    title: input.title.trim(), description: input.description.trim(), difficulty: input.difficulty, time: input.time, frequency: input.frequency,
    weekdays: input.frequency === 'weekly' ? [...new Set(input.weekdays)].sort() : [],
    monthDay: input.frequency === 'monthly' ? input.monthDay : null,
    monthNth: input.frequency === 'monthly' ? input.monthNth : null,
  };
  // Só frequências que a Alexa sabe repetir ganham lembrete (ver taskReminderSupported).
  return { ...clean, alexaReminder: input.alexaReminder === true && taskReminderSupported(clean) };
}

export async function listTasks(): Promise<RecurringTask[]> {
  return mapAll<RecurringTask>(await getDocs(collection(firestore(), TASKS_COLLECTION)))
    .sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title));
}

/** `lastGeneratedDate` = ontem faz a próxima sincronização avaliar hoje com a recorrência vigente (sem duplicar: ID da ocorrência é determinístico). */
export async function createTask(input: TaskInput, now = new Date()): Promise<void> {
  const today = dateKey(now);
  await setDoc(doc(collection(firestore(), TASKS_COLLECTION)), {
    ...cleanTask(input), status: 'active', startDate: today, lastGeneratedDate: addDays(today, -1), createdAt: serverTimestamp(),
  });
  await runClientSync(now);
}

/** Vale para ocorrências futuras; as já geradas (histórico e a de hoje) mantêm o snapshot original. */
export async function updateTask(id: string, input: TaskInput, now = new Date()): Promise<void> {
  await updateDoc(doc(firestore(), TASKS_COLLECTION, id), { ...cleanTask(input), lastGeneratedDate: addDays(dateKey(now), -1), updatedAt: serverTimestamp() });
  await runClientSync(now);
}

/** Pausar não apaga nada; ao retomar não há backlog dos dias pausados. */
export async function setTaskStatus(id: string, status: 'active' | 'paused', now = new Date()): Promise<void> {
  await updateDoc(doc(firestore(), TASKS_COLLECTION, id), {
    status, ...(status === 'active' ? { lastGeneratedDate: addDays(dateKey(now), -1) } : {}), updatedAt: serverTimestamp(),
  });
  if (status === 'active') await runClientSync(now);
}

/** Exclui a tarefa e as ocorrências pendentes (e os avisos delas); concluídas e perdidas ficam no histórico (com título e dificuldade copiados). */
export async function deleteTask(id: string): Promise<void> {
  const pending = await getDocs(query(collection(firestore(), OCCURRENCES_COLLECTION), where('taskId', '==', id), where('status', '==', 'pending')));
  await runTransaction(firestore(), async (transaction) => {
    const notices = (await Promise.all(pending.docs.map((d) => openNotices(transaction, occurrenceNotificationIds(d.id))))).flat();
    pending.docs.forEach((d) => transaction.delete(d.ref));
    transaction.delete(doc(firestore(), TASKS_COLLECTION, id));
    dismissNotices(transaction, notices);
  });
}

export async function listOccurrencesSince(startKey: string): Promise<TaskOccurrence[]> {
  return mapAll<TaskOccurrence>(await getDocs(query(collection(firestore(), OCCURRENCES_COLLECTION), where('date', '>=', startKey))));
}

export async function completeOccurrence(id: string): Promise<void> {
  const ref = doc(firestore(), OCCURRENCES_COLLECTION, id);
  const completedAt = new Date();
  await runTransaction(firestore(), async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error('Ocorrência não encontrada.');
    if (snapshot.data().status !== 'pending') throw new Error('Esta ocorrência não está mais pendente.');
    const refs = activityRefs(firestore(), 'task_occurrence', id);
    const record = await prepareActivityLog(transaction, refs, {
      type: 'task_occurrence', refId: id, occurredAt: completedAt, difficulty: snapshot.data().difficulty, meta: { taskId: snapshot.data().taskId },
    });
    const notices = await openNotices(transaction, occurrenceNotificationIds(id));
    transaction.update(ref, { status: 'completed', completedAt });
    if (record) transaction.set(refs.logRef, record);
    dismissNotices(transaction, notices);
  });
}

/** Mesma rotina da função agendada, executada ao abrir o CRM (catch-up se a função não rodou). */
async function syncTasks(now: Date) {
  const col = (name: string) => collection(firestore(), name);
  return syncRecurringTasks({
    listActiveTasks: async () => mapAll<any>(await getDocs(query(col(TASKS_COLLECTION), where('status', '==', 'active')))),
    listPendingOccurrences: async () => mapAll<any>(await getDocs(query(col(OCCURRENCES_COLLECTION), where('status', '==', 'pending')))),
    createOccurrenceIfAbsent: (id: string, data: Record<string, unknown>) => runTransaction(firestore(), async (transaction) => {
      const ref = doc(firestore(), OCCURRENCES_COLLECTION, id);
      if ((await transaction.get(ref)).exists()) return false;
      transaction.set(ref, data);
      return true;
    }),
    resolveOccurrence: (id: string, patch: Record<string, unknown>) => updateDoc(doc(firestore(), OCCURRENCES_COLLECTION, id), patch),
    updateTask: (id: string, patch: Record<string, unknown>) => updateDoc(doc(firestore(), TASKS_COLLECTION, id), patch),
  }, now);
}

// ------------------------------------------------------------------------------- metas

export async function createGoal(input: GoalInput, now = new Date()): Promise<void> {
  const errors = validateGoal(input);
  if (errors.length) throw new Error(errors.join(' '));
  const bounds = cycleBounds(input.period, now, input);
  await setDoc(doc(collection(firestore(), GOALS_COLLECTION)), {
    title: input.title.trim(), description: input.description.trim(), period: input.period, target: input.target, source: input.source,
    ...(input.source === 'auto' ? { metric: input.metric } : {}), progress: 0, status: 'active',
    weekStartsOn: input.weekStartsOn, monthStartDay: input.monthStartDay,
    cycleKey: bounds.key, cycleStart: bounds.start, cycleEnd: bounds.end, createdAt: serverTimestamp(),
  });
}

/**
 * Edição de título, alvo, origem e limites do ciclo. Se o ciclo salvo deixa de valer (mudou o período ou os limites), o ciclo em
 * andamento com progresso é arquivado em goalCycles (fim = hoje, marcado como interrompido) na mesma operação que reposiciona
 * a meta; o novo ciclo recomeça do zero, como na virada normal. Sem mudança de ciclo, o progresso é preservado.
 */
export async function updateGoal(goal: GoalView, input: GoalInput, now = new Date()): Promise<void> {
  const errors = validateGoal(input);
  if (errors.length) throw new Error(errors.join(' '));
  const bounds = cycleBounds(input.period, now, input);
  const moved = cycleChanged(goal, bounds);
  const batch = writeBatch(firestore());
  if (moved && goal.actual > 0) {
    batch.set(doc(firestore(), GOAL_CYCLES_COLLECTION, `${goal.id}_${goal.cycleKey}_${now.getTime()}`), cycleArchiveRecord(goal, goal.actual, now, { endedEarly: true }));
  }
  batch.update(doc(firestore(), GOALS_COLLECTION, goal.id), {
    title: input.title.trim(), description: input.description.trim(), period: input.period, target: input.target, source: input.source,
    metric: input.source === 'auto' ? input.metric : deleteField(), weekStartsOn: input.weekStartsOn, monthStartDay: input.monthStartDay,
    ...(moved ? { cycleKey: bounds.key, cycleStart: bounds.start, cycleEnd: bounds.end, progress: 0, completedAt: deleteField() } : {}),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

export const setGoalStatus = (id: string, status: 'active' | 'paused') => updateDoc(doc(firestore(), GOALS_COLLECTION, id), { status });
export const setGoalProgress = (id: string, progress: number) => {
  if (!Number.isFinite(progress) || progress < 0) throw new Error('O progresso deve ser zero ou maior.');
  return updateDoc(doc(firestore(), GOALS_COLLECTION, id), { progress, updatedAt: serverTimestamp() });
};
export const deleteGoal = (id: string) => deleteDoc(doc(firestore(), GOALS_COLLECTION, id));

export async function listGoalCycles(goalId: string): Promise<GoalCycle[]> {
  const result = mapAll<GoalCycle>(await getDocs(query(collection(firestore(), GOAL_CYCLES_COLLECTION), where('goalId', '==', goalId))));
  return result.sort((a, b) => b.startKey.localeCompare(a.startKey));
}

async function loadMetricData(since: Date) {
  const col = (name: string) => collection(firestore(), name);
  const range = async (name: string, field: string) => mapAll<any>(await getDocs(query(col(name), where(field, '>=', since))));
  const merge = (...lists: any[][]) => [...new Map(lists.flat().map((item) => [item.id, item])).values()];
  const [completedOrders, paidOrders, created, ready, published, missions, occurrences] = await Promise.all([
    range(ORDERS_COLLECTION, 'completedAt'), range(ORDERS_COLLECTION, 'paidAt'),
    range(CONTENT_SCRIPTS_COLLECTION, 'createdAt'), range(CONTENT_SCRIPTS_COLLECTION, 'readyAt'), range(CONTENT_SCRIPTS_COLLECTION, 'publishedAt'),
    range(MISSIONS_COLLECTION, 'completedAt'), listOccurrencesSince(dateKey(since)),
  ]);
  return { orders: merge(completedOrders, paidOrders), scripts: merge(created, ready, published), missions, occurrences };
}

/**
 * Carrega as metas, fecha ciclos vencidos (histórico em goalCycles) e calcula o valor atual.
 * O valor automático é sempre recalculado a partir dos dados com a data do evento, então atrasar este passo nunca perde contagem.
 */
export async function loadGoals(now = new Date()): Promise<GoalView[]> {
  const goals = mapAll<Goal>(await getDocs(collection(firestore(), GOALS_COLLECTION))).sort((a, b) => a.title.localeCompare(b.title));
  if (!goals.length) return [];
  const today = dateKey(now);
  const boundsOf = (g: Goal, at: Date) => cycleBounds(g.period, at, g);
  const since = new Date(Math.min(...goals.map((g) => Math.min(g.cycleStart.getTime(), boundsOf(g, now).start.getTime()))));
  const data = await loadMetricData(since);
  const valueIn = (g: Goal, bounds: { start: Date; end: Date }) => (g.source === 'manual' ? g.progress : metricValue(g.metric!, bounds, data, today));

  const views: GoalView[] = [];
  for (const stored of goals) {
    let goal = stored;
    const current = boundsOf(goal, now);
    if (goal.cycleKey !== current.key) {
      const closed = { start: goal.cycleStart, end: goal.cycleEnd };
      const value = valueIn(goal, closed);
      const batch = writeBatch(firestore());
      batch.set(doc(firestore(), GOAL_CYCLES_COLLECTION, `${goal.id}_${goal.cycleKey}`), cycleArchiveRecord(goal, value, now));
      batch.update(doc(firestore(), GOALS_COLLECTION, goal.id), { cycleKey: current.key, cycleStart: current.start, cycleEnd: current.end, progress: 0, completedAt: deleteField() });
      await batch.commit();
      goal = { ...goal, cycleKey: current.key, cycleStart: current.start, cycleEnd: current.end, progress: 0, completedAt: undefined };
    }
    const actual = valueIn(goal, { start: goal.cycleStart, end: goal.cycleEnd });
    const view = goalProgress(actual, goal.target);
    if (view.reached && !goal.completedAt && goal.status === 'active') {
      const goalRef = doc(firestore(), GOALS_COLLECTION, goal.id);
      const cycleId = `${goal.id}_${goal.cycleKey}`;
      await runTransaction(firestore(), async (transaction) => {
        const refs = activityRefs(firestore(), 'goal_completed', cycleId);
        const record = await prepareActivityLog(transaction, refs, { type: 'goal_completed', refId: cycleId, occurredAt: now, meta: { goalId: goal.id } });
        transaction.update(goalRef, { completedAt: now });
        if (record) transaction.set(refs.logRef, record);
      });
      goal = { ...goal, completedAt: now };
    }
    views.push({ ...goal, actual, view });
  }
  return views;
}

// -------------------------------------------------------------------------- notificações

export function subscribeNotifications(onChange: (items: AppNotification[]) => void): () => void {
  return onSnapshot(
    query(collection(firestore(), NOTIFICATIONS_COLLECTION), where('dismissed', '==', false)),
    (snapshot) => onChange(mapAll<AppNotification>(snapshot).sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))),
    (error) => console.error('[missionsService] notificações indisponíveis', error),
  );
}

export const dismissNotification = (id: string) => updateDoc(doc(firestore(), NOTIFICATIONS_COLLECTION, id), { dismissed: true, dismissedAt: serverTimestamp() });
export async function dismissAllNotifications(items: AppNotification[]): Promise<void> {
  const batch = writeBatch(firestore());
  items.forEach((n) => batch.update(doc(firestore(), NOTIFICATIONS_COLLECTION, n.id), { dismissed: true, dismissedAt: serverTimestamp() }));
  await batch.commit();
}

let syncing: Promise<void> | null = null;

/** Sincroniza tarefas e cria avisos ausentes (ID determinístico; avisos descartados nunca reaparecem). Chamadas simultâneas compartilham a execução. */
export function runClientSync(now = new Date()): Promise<void> {
  syncing ??= (async () => {
    try {
      await syncTasks(now);
      const [missionsSnap, recent, goals] = await Promise.all([
        getDocs(query(collection(firestore(), MISSIONS_COLLECTION), where('status', '==', 'pending'))),
        listOccurrencesSince(addDays(dateKey(now), -1)),
        loadGoals(now),
      ]);
      const candidates = buildNotifications({
        missions: mapAll<Mission>(missionsSnap), occurrences: recent,
        goals: goals.filter((g) => g.status === 'active').map((g) => ({ id: g.id, title: g.title, target: g.target, cycleKey: g.cycleKey, progress: g.view })),
      }, now);
      for (const { id, ...fields } of candidates) {
        const ref = doc(firestore(), NOTIFICATIONS_COLLECTION, id);
        await runTransaction(firestore(), async (transaction) => {
          if (!(await transaction.get(ref)).exists()) transaction.set(ref, { ...fields, dismissed: false, createdAt: now });
        });
      }
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

