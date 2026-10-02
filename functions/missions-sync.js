import { Timestamp } from 'firebase-admin/firestore';
import { addDays, buildNotifications, dateKey, syncRecurringTasks } from './missions-core.js';

const toStored = (data) => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v instanceof Date ? Timestamp.fromDate(v) : v]));
const docs = (snapshot) => snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

/** Rotina da meia-noite (Brasília): gera ocorrências do dia, marca perdidas e cria avisos de missões/tarefas. */
export async function runMissionsSync(database, now = new Date()) {
  const store = {
    listActiveTasks: async () => docs(await database.collection('recurringTasks').where('status', '==', 'active').get()),
    listPendingOccurrences: async () => docs(await database.collection('taskOccurrences').where('status', '==', 'pending').get()),
    async createOccurrenceIfAbsent(id, data) {
      try { await database.collection('taskOccurrences').doc(id).create(toStored(data)); return true; }
      catch (error) { if (error?.code === 6 || /ALREADY_EXISTS/.test(String(error?.message))) return false; throw error; }
    },
    resolveOccurrence: (id, patch) => database.collection('taskOccurrences').doc(id).update(toStored(patch)),
    updateTask: (id, patch) => database.collection('recurringTasks').doc(id).update(toStored(patch)),
  };
  const result = await syncRecurringTasks(store, now);

  const [missions, recent] = await Promise.all([
    database.collection('missions').where('status', '==', 'pending').get().then(docs),
    database.collection('taskOccurrences').where('date', '>=', addDays(dateKey(now), -1)).get().then(docs),
  ]);
  let notified = 0;
  for (const item of buildNotifications({ missions, occurrences: recent }, now)) {
    const { id, ...fields } = item;
    try {
      await database.collection('notifications').doc(id).create({ ...fields, dismissed: false, createdAt: Timestamp.fromDate(now) });
      notified += 1;
    } catch (error) { if (!(error?.code === 6 || /ALREADY_EXISTS/.test(String(error?.message)))) throw error; }
  }
  return { created: result.created.length, resolved: result.resolved.length, notified };
}
