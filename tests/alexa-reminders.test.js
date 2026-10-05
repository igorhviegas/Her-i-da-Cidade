import test from 'node:test';
import assert from 'node:assert/strict';
import { createRemindersClient, localDateTime, missionReminder, planReminderSync, reminderText, syncReminders, taskReminder } from '../functions/alexa-reminders.js';
import { handleAlexaEnvelope } from '../functions/missions-alexa.js';
import { taskReminderSupported } from '../functions/missions-core.js';

// Segunda 05/10/2026 12:00 em Brasília (15:00 UTC)
const NOW = new Date('2026-10-05T15:00:00Z');
const USER = 'amzn1.ask.account.TESTUSER';
const quiet = { warn() {}, error() {} };

/** Firestore mínimo em memória: coleções com where(==) encadeado, get(), doc().set()/delete(). */
function fakeDb(seed = {}) {
  const data = { missions: new Map(), recurringTasks: new Map(), alexaReminders: new Map() };
  for (const [name, docs] of Object.entries(seed)) for (const [id, value] of Object.entries(docs)) data[name].set(id, value);
  const collection = (name) => {
    const filters = [];
    const api = {
      where: (field, _op, value) => { filters.push([field, value]); return api; },
      get: async () => ({ docs: [...data[name]].filter(([, v]) => filters.every(([f, val]) => v[f] === val)).map(([id, v]) => ({ id, data: () => v })) }),
      doc: (id) => ({ set: async (value) => { data[name].set(id, value); }, delete: async () => { data[name].delete(id); } }),
    };
    return api;
  };
  return { data, collection };
}

/** Reminders API falsa: guarda os lembretes por alertToken e registra as chamadas. */
function fakeApi({ missingOnUpdate = false } = {}) {
  const alerts = new Map();
  const calls = [];
  let n = 0;
  return {
    alerts, calls,
    create: async (body) => { const token = `alert-${++n}`; alerts.set(token, body); calls.push(['create', token]); return token; },
    update: async (token, body) => { calls.push(['update', token]); if (missingOnUpdate) return { notFound: true }; alerts.set(token, body); return {}; },
    remove: async (token) => { calls.push(['remove', token]); alerts.delete(token); return {}; },
  };
}

const sync = (database, client) => syncReminders({ database, client, userId: USER, now: NOW, logger: quiet });
const spoken = (body) => body.alertInfo.spokenInfo.content[0].text;
const mission = (extra = {}) => ({ title: 'Recolher roupas no varal', status: 'pending', dueAt: new Date('2026-10-05T21:00:00Z'), alexaReminder: true, ...extra }); // 18:00 BRT

test('texto falado: "Alerta de missão: <nome>." sem duplicar a pontuação', () => {
  assert.equal(reminderText('Recolher roupas no varal'), 'Alerta de missão: Recolher roupas no varal.');
  assert.equal(reminderText('  Pagar conta!  '), 'Alerta de missão: Pagar conta.');
});

test('fuso: o instante UTC vira horário de Brasília (America/Sao_Paulo), inclusive na virada do dia', () => {
  assert.equal(localDateTime(new Date('2026-10-05T21:00:00Z')), '2026-10-05T18:00:00.000');
  assert.equal(localDateTime(new Date('2026-10-06T02:30:00Z')), '2026-10-05T23:30:00.000');
  assert.equal(localDateTime(new Date('2026-10-06T03:00:00Z')), '2026-10-06T00:00:00.000');
  const r = missionReminder({ id: 'm1', ...mission() }, NOW);
  assert.equal(r.body.trigger.scheduledTime, '2026-10-05T18:00:00.000');
  assert.equal(r.body.trigger.timeZoneId, 'America/Sao_Paulo');
  assert.equal(r.body.alertInfo.spokenInfo.content[0].locale, 'pt-BR');
});

test('1. missão sem a opção marcada: nenhum lembrete é criado', async () => {
  const db = fakeDb({ missions: { m1: mission({ alexaReminder: false }), m2: { ...mission(), alexaReminder: undefined } } });
  const api = fakeApi();
  const r = await sync(db, api);
  assert.deepEqual(api.calls, []);
  assert.equal(r.created, 0);
  assert.equal(db.data.alexaReminders.size, 0);
});

test('2. missão com a opção marcada: lembrete criado com nome e horário corretos; repetir não duplica', async () => {
  const db = fakeDb({ missions: { m1: mission() } });
  const api = fakeApi();
  const first = await sync(db, api);
  assert.equal(first.created, 1);
  const [body] = api.alerts.values();
  assert.equal(spoken(body), 'Alerta de missão: Recolher roupas no varal.');
  assert.equal(body.trigger.scheduledTime, '2026-10-05T18:00:00.000');

  const again = await sync(db, api);
  assert.deepEqual([again.created, again.updated, again.removed, again.unchanged], [0, 0, 0, 1]);
  assert.equal(api.alerts.size, 1);
  assert.equal(api.calls.length, 1);
});

test('3. editar o horário atualiza o mesmo lembrete (sem duplicar)', async () => {
  const db = fakeDb({ missions: { m1: mission() } });
  const api = fakeApi();
  await sync(db, api);
  db.data.missions.set('m1', mission({ dueAt: new Date('2026-10-05T22:30:00Z') })); // 19:30 BRT
  const r = await sync(db, api);
  assert.deepEqual([r.created, r.updated, r.removed], [0, 1, 0]);
  assert.equal(api.alerts.size, 1);
  assert.equal([...api.alerts.values()][0].trigger.scheduledTime, '2026-10-05T19:30:00.000');
});

test('4. editar o nome atualiza o texto do lembrete', async () => {
  const db = fakeDb({ missions: { m1: mission() } });
  const api = fakeApi();
  await sync(db, api);
  db.data.missions.set('m1', mission({ title: 'Guardar roupas' }));
  const r = await sync(db, api);
  assert.equal(r.updated, 1);
  assert.equal(spoken([...api.alerts.values()][0]), 'Alerta de missão: Guardar roupas.');
});

test('5. desmarcar a opção remove o lembrete; concluir a missão também', async () => {
  const db = fakeDb({ missions: { m1: mission(), m2: mission({ title: 'Outra' }) } });
  const api = fakeApi();
  await sync(db, api);
  assert.equal(api.alerts.size, 2);
  db.data.missions.set('m1', mission({ alexaReminder: false }));
  db.data.missions.set('m2', mission({ title: 'Outra', status: 'completed' }));
  const r = await sync(db, api);
  assert.equal(r.removed, 2);
  assert.equal(api.alerts.size, 0);
  assert.equal(db.data.alexaReminders.size, 0);
});

test('6. excluir a missão remove o lembrete associado na próxima sincronização', async () => {
  const db = fakeDb({ missions: { m1: mission() } });
  const api = fakeApi();
  await sync(db, api);
  db.data.missions.delete('m1');
  const r = await sync(db, api);
  assert.equal(r.removed, 1);
  assert.equal(api.alerts.size, 0);
});

test('horário passado nunca é agendado, e um lembrete já existente cujo prazo passou é removido', async () => {
  const db = fakeDb({ missions: { past: mission({ dueAt: new Date('2026-10-05T14:00:00Z') }), nodue: mission({ dueAt: undefined }) } });
  const api = fakeApi();
  assert.equal((await sync(db, api)).created, 0);

  db.data.missions.set('later', mission());
  await sync(db, api);
  assert.equal(api.alerts.size, 1);
  const afterDue = await syncReminders({ database: db, client: api, userId: USER, now: new Date('2026-10-05T21:30:00Z'), logger: quiet });
  assert.equal(afterDue.removed, 1);
});

test('7. tarefas recorrentes: diária, semanal e mensal em dia fixo viram regras de recorrência; não suportadas e pausadas ficam de fora', () => {
  const base = { id: 't', title: 'Postar vídeo', time: '09:05', status: 'active', alexaReminder: true, weekdays: [], monthDay: null, monthNth: null };
  const rule = (extra) => taskReminder({ ...base, ...extra }, NOW)?.body.trigger.recurrence;

  assert.deepEqual(rule({ frequency: 'daily' }).recurrenceRules, ['FREQ=DAILY;BYHOUR=9;BYMINUTE=5;BYSECOND=0;INTERVAL=1;']);
  assert.deepEqual(rule({ frequency: 'weekly', weekdays: [3, 1] }).recurrenceRules, ['FREQ=WEEKLY;BYDAY=MO,WE;BYHOUR=9;BYMINUTE=5;BYSECOND=0;INTERVAL=1;']);
  assert.deepEqual(rule({ frequency: 'monthly', monthDay: 15 }).recurrenceRules, ['FREQ=MONTHLY;BYMONTHDAY=15;BYHOUR=9;BYMINUTE=5;BYSECOND=0;INTERVAL=1;']);
  assert.equal(rule({ frequency: 'daily' }).startDateTime, '2026-10-05T12:00:00.000');
  assert.equal(taskReminder({ ...base, frequency: 'daily' }, NOW).body.trigger.timeZoneId, 'America/Sao_Paulo');

  assert.equal(taskReminder({ ...base, frequency: 'monthly', monthNth: { week: 2, weekday: 1 } }, NOW), null); // n-ésimo dia da semana
  assert.equal(taskReminder({ ...base, frequency: 'monthly', monthDay: 31 }, NOW), null); // cai no último dia do mês no CRM
  assert.equal(taskReminder({ ...base, frequency: 'monthly', monthDay: 10, monthNth: { week: 1, weekday: 1 } }, NOW), null); // união das duas
  assert.equal(taskReminder({ ...base, frequency: 'daily', status: 'paused' }, NOW), null);
  assert.equal(taskReminder({ ...base, frequency: 'daily', alexaReminder: false }, NOW), null);
  assert.equal(taskReminderSupported({ frequency: 'weekly', weekdays: [] }), false);
});

test('7b. tarefa recorrente: criar, pausar remove, editar horário atualiza (um único lembrete por tarefa)', async () => {
  const task = { title: 'Backup', time: '08:00', frequency: 'daily', weekdays: [], monthDay: null, monthNth: null, status: 'active', alexaReminder: true };
  const db = fakeDb({ recurringTasks: { t1: task } });
  const api = fakeApi();
  assert.equal((await sync(db, api)).created, 1);
  db.data.recurringTasks.set('t1', { ...task, time: '07:30' });
  assert.equal((await sync(db, api)).updated, 1);
  assert.match([...api.alerts.values()][0].trigger.recurrence.recurrenceRules[0], /BYHOUR=7;BYMINUTE=30/);
  db.data.recurringTasks.set('t1', { ...task, status: 'paused' });
  assert.equal((await sync(db, api)).removed, 1);
  assert.equal(api.alerts.size, 0);
});

test('lembrete apagado no app da Alexa é recriado na atualização; falha de um item não impede os outros', async () => {
  const db = fakeDb({ missions: { m1: mission() } });
  const api = fakeApi();
  await sync(db, api);
  db.data.missions.set('m1', mission({ title: 'Novo nome' }));
  const missing = fakeApi({ missingOnUpdate: true });
  const r = await sync(db, missing);
  assert.deepEqual([r.updated, r.failed], [1, 0]);
  assert.equal(missing.calls.at(-1)[0], 'create');

  const flaky = { ...fakeApi(), create: async (body) => { if (spoken(body).includes('Ruim')) throw new Error('boom'); return 'ok-token'; } };
  const db2 = fakeDb({ missions: { a: mission({ title: 'Ruim' }), b: mission({ title: 'Boa' }) } });
  const r2 = await sync(db2, flaky);
  assert.deepEqual([r2.created, r2.failed], [1, 1]);
  assert.equal(db2.data.alexaReminders.size, 1); // só o confirmado pela Alexa é salvo, então a repetição tenta o outro de novo
});

test('planReminderSync: separa criar, atualizar, remover e inalterado', () => {
  const d = (key, sig) => ({ key, sig });
  const plan = planReminderSync([d('a', '1'), d('b', '2'), d('c', '3')], [{ key: 'b', sig: '2', alertToken: 'tb' }, { key: 'c', sig: 'x', alertToken: 'tc' }, { key: 'z', sig: '9', alertToken: 'tz' }]);
  assert.deepEqual([plan.create.map((i) => i.key), plan.update.map((i) => [i.key, i.alertToken]), plan.remove.map((i) => i.key), plan.unchanged], [['a'], [['c', 'tc']], ['z'], 1]);
});

test('cliente da Reminders API: rotas, cabeçalho e proteção do token (só hosts oficiais)', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push([init.method, url, init.headers.Authorization]); return { ok: true, status: 201, json: async () => ({ alertToken: 'tok/1' }) }; };
  const client = createRemindersClient({ endpoint: 'https://api.amazonalexa.com', token: 'T', fetchImpl });
  assert.equal(await client.create({ a: 1 }), 'tok/1');
  await client.update('tok/1', {});
  await client.remove('tok/1');
  assert.deepEqual(seen, [
    ['POST', 'https://api.amazonalexa.com/v1/alerts/reminders', 'Bearer T'],
    ['PUT', 'https://api.amazonalexa.com/v1/alerts/reminders/tok%2F1', 'Bearer T'],
    ['DELETE', 'https://api.amazonalexa.com/v1/alerts/reminders/tok%2F1', 'Bearer T'],
  ]);
  assert.throws(() => createRemindersClient({ endpoint: 'https://evil.example.com', token: 'T', fetchImpl }));
  assert.throws(() => createRemindersClient({ endpoint: 'https://api.amazonalexa.com', token: '', fetchImpl }));
});

// ---------------------------------------------------------------- intent da skill

const SKILL = 'amzn1.ask.skill.test';
const config = { skillId: SKILL, allowedUserIds: [USER] };
const envelope = ({ granted = true, withToken = true } = {}) => ({
  session: { application: { applicationId: SKILL }, user: { userId: USER } },
  context: { System: {
    user: { userId: USER, permissions: granted ? { scopes: { 'alexa::alerts:reminders:skill:readwrite': { status: 'GRANTED' } } } : {} },
    ...(withToken ? { apiEndpoint: 'https://api.amazonalexa.com', apiAccessToken: 'TOKEN' } : {}),
  } },
  request: { type: 'IntentRequest', requestId: 'r1', intent: { name: 'SincronizarLembretesIntent', slots: {} } },
});

test('intent "sincronizar lembretes": pede permissão quando falta, e sincroniza usando o token da requisição', async () => {
  const db = fakeDb({ missions: { m1: mission() } });
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push([init.method, url, init.headers.Authorization]); return { ok: true, status: 201, json: async () => ({ alertToken: 'a1' }) }; };
  const run = (env) => handleAlexaEnvelope(env, { database: db, config, now: NOW, logger: quiet, fetchImpl });

  const denied = await run(envelope({ granted: false }));
  assert.deepEqual(denied.response.card, { type: 'AskForPermissionsConsent', permissions: ['alexa::alerts:reminders:skill:readwrite'] });
  assert.equal(calls.length, 0);

  const ok = await run(envelope());
  assert.match(ok.response.outputSpeech.text, /criei 1 lembrete/);
  assert.deepEqual(calls, [['POST', 'https://api.amazonalexa.com/v1/alerts/reminders', 'Bearer TOKEN']]);
  assert.match((await run(envelope())).response.outputSpeech.text, /já estão em dia/);

  const forbidden = async () => ({ ok: false, status: 403, json: async () => ({ code: 'ACCESS_DENIED' }) });
  const db2 = fakeDb({ missions: { m1: mission() } });
  const r = await handleAlexaEnvelope(envelope(), { database: db2, config, now: NOW, logger: quiet, fetchImpl: forbidden });
  assert.equal(r.response.card.type, 'AskForPermissionsConsent');
  assert.equal(db2.data.alexaReminders.size, 0);
});
