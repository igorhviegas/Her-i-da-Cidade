import { createHash } from 'node:crypto';
import { taskReminderSupported } from './missions-core.js';

// Lembretes da Alexa para missões e tarefas recorrentes. A Alexa só permite CRIAR lembretes dentro de uma conversa com a skill
// (o token da requisição é a única credencial aceita), então o CRM só marca "alexaReminder" e esta sincronização, disparada por voz
// ("sincronizar lembretes"), cria, atualiza e remove os lembretes de forma idempotente.

export const REMINDERS_SCOPE = 'alexa::alerts:reminders:skill:readwrite';
export const REMINDERS_COLLECTION = 'alexaReminders';
const TIME_ZONE = 'America/Sao_Paulo';
const LOCALE = 'pt-BR';
const TZ_OFFSET_MS = -3 * 3600000; // Brasil sem horário de verão (mesma premissa de missions-core)
const API_HOSTS = ['https://api.amazonalexa.com', 'https://api.eu.amazonalexa.com', 'https://api.fe.amazon.com'];
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

const pad = (n) => String(n).padStart(2, '0');

/** Instante → data/hora local de Brasília no formato da API (YYYY-MM-DDThh:mm:ss.SSS), sem offset. */
export function localDateTime(date) {
  const s = new Date(date.getTime() + TZ_OFFSET_MS);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}T${pad(s.getUTCHours())}:${pad(s.getUTCMinutes())}:${pad(s.getUTCSeconds())}.000`;
}

/** "Alerta de missão: <nome>." (sem duplicar a pontuação final do nome). */
export function reminderText(title) {
  const name = String(title ?? '').trim().replace(/[.!?…]+$/, '');
  return `Alerta de missão: ${name}.`;
}

const body = (text, trigger, now) => ({
  requestTime: localDateTime(now),
  trigger: { ...trigger, timeZoneId: TIME_ZONE },
  alertInfo: { spokenInfo: { content: [{ locale: LOCALE, text }] } },
  pushNotification: { status: 'ENABLED' },
});

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Lembrete desejado para uma missão: só se marcada, pendente e com prazo futuro (horário passado nunca é agendado;
 * a API rejeitaria TRIGGER_SCHEDULED_TIME_IN_PAST). Retorna null quando não deve existir lembrete.
 */
export function missionReminder(mission, now) {
  const dueAt = toDate(mission.dueAt);
  if (mission.alexaReminder !== true || mission.status !== 'pending' || !dueAt || dueAt.getTime() <= now.getTime()) return null;
  const text = reminderText(mission.title);
  const scheduledTime = localDateTime(dueAt);
  return { key: `mission_${mission.id}`, text, sig: `${text}|${scheduledTime}`, body: body(text, { type: 'SCHEDULED_ABSOLUTE', scheduledTime }, now) };
}

/** Lembrete recorrente (RRULE) para tarefa ativa marcada e de frequência suportada (diária, semanal, mensal em dia fixo ≤ 28). */
export function taskReminder(task, now) {
  if (task.alexaReminder !== true || task.status !== 'active' || !taskReminderSupported(task) || !/^\d{2}:\d{2}$/.test(task.time ?? '')) return null;
  const [h, m] = task.time.split(':').map(Number);
  const at = `BYHOUR=${h};BYMINUTE=${m};BYSECOND=0;INTERVAL=1;`;
  const rule = task.frequency === 'daily' ? `FREQ=DAILY;${at}`
    : task.frequency === 'weekly' ? `FREQ=WEEKLY;BYDAY=${[...task.weekdays].sort().map((d) => RRULE_DAYS[d]).join(',')};${at}`
    : `FREQ=MONTHLY;BYMONTHDAY=${task.monthDay};${at}`;
  const text = reminderText(task.title);
  return {
    key: `task_${task.id}`, text, sig: `${text}|${rule}`,
    body: body(text, { type: 'SCHEDULED_ABSOLUTE', recurrence: { startDateTime: localDateTime(now), recurrenceRules: [rule] } }, now),
  };
}

/**
 * Compara o desejado com o que já foi criado (mapeamento salvo) e decide: criar o que falta, atualizar o que mudou
 * (nome ou horário/recorrência) e remover o que não deve mais existir (desmarcado, concluído, passado, pausado ou excluído).
 */
export function planReminderSync(desired, existing) {
  const have = new Map(existing.map((item) => [item.key, item]));
  const want = new Map(desired.map((item) => [item.key, item]));
  return {
    create: desired.filter((item) => !have.has(item.key)),
    update: desired.filter((item) => have.has(item.key) && have.get(item.key).sig !== item.sig).map((item) => ({ ...item, alertToken: have.get(item.key).alertToken })),
    remove: existing.filter((item) => !want.has(item.key)),
    unchanged: desired.filter((item) => have.has(item.key) && have.get(item.key).sig === item.sig).length,
  };
}

export class ReminderApiError extends Error {
  constructor(status, code) { super(`Reminders API ${status}${code ? ` ${code}` : ''}`); this.status = status; this.code = code; }
}

/** Cliente fino da Reminders API. O host precisa ser um dos três oficiais (o token nunca vai para outro destino). */
export function createRemindersClient({ endpoint, token, fetchImpl = fetch }) {
  if (!API_HOSTS.includes(endpoint) || !token) throw new ReminderApiError(0, 'missing_api_access');
  const call = async (method, path, payload) => {
    const res = await fetchImpl(`${endpoint}/v1/alerts/reminders${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) { const data = await res.json().catch(() => ({})); throw new ReminderApiError(res.status, data?.code); }
    return res.status === 204 ? {} : res.json().catch(() => ({}));
  };
  return {
    create: async (payload) => (await call('POST', '', payload)).alertToken,
    update: (alertToken, payload) => call('PUT', `/${encodeURIComponent(alertToken)}`, payload),
    remove: (alertToken) => call('DELETE', `/${encodeURIComponent(alertToken)}`),
  };
}

const userHashOf = (userId) => createHash('sha256').update(userId).digest('hex').slice(0, 24);

/**
 * Lê missões/tarefas marcadas, compara com os lembretes já criados para este usuário Alexa e aplica o plano.
 * Cada item falha isoladamente (o mapeamento só é gravado depois de a Alexa confirmar), então repetir a sincronização é seguro.
 * Retorna { created, updated, removed, unchanged, failed, permissionDenied }.
 */
export async function syncReminders({ database, client, userId, now = new Date(), logger = console }) {
  const userHash = userHashOf(userId);
  const [missionsSnap, tasksSnap, existingSnap] = await Promise.all([
    database.collection('missions').where('alexaReminder', '==', true).where('status', '==', 'pending').get(),
    database.collection('recurringTasks').where('alexaReminder', '==', true).where('status', '==', 'active').get(),
    database.collection(REMINDERS_COLLECTION).where('userHash', '==', userHash).get(),
  ]);
  const desired = [
    ...missionsSnap.docs.map((d) => missionReminder({ id: d.id, ...d.data() }, now)),
    ...tasksSnap.docs.map((d) => taskReminder({ id: d.id, ...d.data() }, now)),
  ].filter(Boolean);
  const existing = existingSnap.docs.map((d) => ({ docId: d.id, ...d.data() }));
  const plan = planReminderSync(desired, existing);
  const docFor = (key) => database.collection(REMINDERS_COLLECTION).doc(`${userHash}_${key}`);
  const result = { created: 0, updated: 0, removed: 0, unchanged: plan.unchanged, failed: 0, permissionDenied: false };

  const run = async (label, work) => {
    try { await work(); } catch (error) {
      if (error instanceof ReminderApiError && (error.status === 401 || error.status === 403) && error.code !== 'MAX_REMINDERS_EXCEEDED') result.permissionDenied = true;
      result.failed += 1;
      logger.error(`[Alexa] Falha ao ${label} lembrete.`, { error: error instanceof Error ? error.message : String(error) });
    }
  };
  const save = (item, alertToken) => docFor(item.key).set({ userHash, key: item.key, alertToken, sig: item.sig, text: item.text, updatedAt: now });

  for (const item of plan.create) await run('criar', async () => { await save(item, await client.create(item.body)); result.created += 1; });
  for (const item of plan.update) {
    await run('atualizar', async () => {
      const response = await client.update(item.alertToken, item.body);
      // O usuário apagou o lembrete no app da Alexa: recria em vez de falhar.
      await save(item, response?.notFound ? await client.create(item.body) : item.alertToken);
      result.updated += 1;
    });
  }
  for (const item of plan.remove) {
    await run('remover', async () => { await client.remove(item.alertToken); await docFor(item.key).delete(); result.removed += 1; });
  }
  return result;
}
