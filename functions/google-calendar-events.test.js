import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  GoogleCalendarError, addCalendarEventGuest, buildStandaloneEvent, calendarEventId, createCalendarEvent, deleteCalendarEvent, isCrmEventId, listCalendarEvents,
  normalizeEvent, resetTokenCache, updateCalendarEvent,
} from './google-calendar.js';

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const env = { GOOGLE_CALENDAR_ID: 'agenda@group.calendar.google.com', GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'sa@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }) };
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** fetch falso: responde o token e delega o resto a `handler(url, init)`; guarda as chamadas à agenda. */
function fakeFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes('oauth2.googleapis.com')) return json(200, { access_token: 'tok', expires_in: 3600 });
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : undefined });
    return handler(calls[calls.length - 1], calls.length);
  };
  return { fetchImpl, calls };
}
test.beforeEach(() => resetTokenCache());

const timed = { id: 'e1', summary: 'Reunião', location: 'Sala 1', description: 'Cliente: Maria', start: { dateTime: '2026-10-10T14:30:00-03:00' }, end: { dateTime: '2026-10-10T15:30:00-03:00' }, htmlLink: 'https://cal/e1' };

test('cor do evento é opcional: só IDs 1 a 11 da paleta; sem cor nada é enviado (criação e edição)', () => {
  const base = { title: 'A', date: '2026-10-12', startTime: '20:00', endTime: '20:15' };
  assert.equal(buildStandaloneEvent({ ...base, colorId: '5' }).colorId, '5');
  assert.equal(buildStandaloneEvent({ ...base, colorId: '10' }, { patch: true }).colorId, '10');
  assert.equal('colorId' in buildStandaloneEvent(base), false);
  assert.equal('colorId' in buildStandaloneEvent(base, { patch: true }), false);
  for (const colorId of ['0', '12', 'abacate', '']) assert.throws(() => buildStandaloneEvent({ ...base, colorId }), (e) => e.code === 'invalid_event');
});

test('normalizeEvent: horário em Brasília, dia inteiro com fim inclusivo, evento do CRM identificado pelo ID', () => {
  assert.deepEqual(normalizeEvent(timed), { id: 'e1', title: 'Reunião', description: 'Cliente: Maria', location: 'Sala 1', allDay: false, startKey: '2026-10-10', startTime: '14:30', endKey: '2026-10-10', endTime: '15:30', htmlLink: 'https://cal/e1', crm: false, transparent: false });
  const utc = normalizeEvent({ id: 'u', start: { dateTime: '2026-10-11T01:30:00Z' }, end: { dateTime: '2026-10-11T02:30:00Z' } }); // 22:30 do dia 10 em Brasília
  assert.deepEqual([utc.startKey, utc.startTime, utc.title], ['2026-10-10', '22:30', '(Sem título)']);
  const allDay = normalizeEvent({ id: 'a', summary: 'Feriado', start: { date: '2026-10-12' }, end: { date: '2026-10-13' } });
  assert.deepEqual([allDay.allDay, allDay.startKey, allDay.endKey, allDay.startTime], [true, '2026-10-12', '2026-10-12', null]);
  assert.equal(normalizeEvent({ id: 'm', start: { date: '2026-10-12' }, end: { date: '2026-10-15' } }).endKey, '2026-10-14');
  assert.equal(isCrmEventId(calendarEventId('pedido1')), true);
  assert.equal(normalizeEvent({ ...timed, id: calendarEventId('pedido1') }).crm, true);
  assert.equal(isCrmEventId('abc123'), false);
});

test('buildStandaloneEvent: valida título, data, horários e monta corpo com fuso; patch usa null para limpar e trocar o tipo', () => {
  const ok = { title: ' Reunião ', date: '2026-10-10', startTime: '09:00', endTime: '10:30', location: ' Sala ', description: '' };
  assert.deepEqual(buildStandaloneEvent(ok), { summary: 'Reunião', location: 'Sala', description: undefined, start: { dateTime: '2026-10-10T09:00:00', timeZone: 'America/Sao_Paulo' }, end: { dateTime: '2026-10-10T10:30:00', timeZone: 'America/Sao_Paulo' } });
  const patch = buildStandaloneEvent({ ...ok, location: '' }, { patch: true });
  assert.equal(patch.location, null);
  assert.equal(patch.start.date, null);
  assert.deepEqual(buildStandaloneEvent({ title: 'Dia', date: '2026-12-31', allDay: true }).end, { date: '2027-01-01' });
  assert.deepEqual(buildStandaloneEvent({ title: 'Dia', date: '2026-10-10', allDay: true }, { patch: true }).start, { date: '2026-10-10', dateTime: null, timeZone: null });
  for (const bad of [{ ...ok, title: ' ' }, { ...ok, date: '10/10/2026' }, { ...ok, date: '2026-02-31' }, { ...ok, startTime: '9h' }, { ...ok, endTime: '09:00' }, { ...ok, endTime: '08:00' }, { ...ok, description: 'x'.repeat(8001) }, null]) {
    assert.throws(() => buildStandaloneEvent(bad), (e) => e instanceof GoogleCalendarError && e.code === 'invalid_event');
  }
  // eventos independentes não carregam nada do formulário comercial
  assert.deepEqual(Object.keys(buildStandaloneEvent(ok)).sort(), ['description', 'end', 'location', 'start', 'summary']);
});

test('listCalendarEvents: consulta o período em Brasília, pagina, ignora cancelados e marca truncamento', async () => {
  const { fetchImpl, calls } = fakeFetch((call, n) => json(200, n === 1
    ? { items: [timed, { id: 'x', status: 'cancelled' }], nextPageToken: 'p2' }
    : { items: [{ id: 'e2', summary: 'B', start: { date: '2026-10-11' }, end: { date: '2026-10-12' } }] }));
  const result = await listCalendarEvents({ from: '2026-10-01', to: '2026-10-31', q: 'Maria', env, fetchImpl });
  assert.deepEqual(result.events.map((e) => e.id), ['e1', 'e2']);
  assert.equal(result.truncated, false);
  const url = new URL(calls[0].url);
  assert.equal(url.searchParams.get('timeMin'), '2026-10-01T03:00:00.000Z');
  assert.equal(url.searchParams.get('timeMax'), '2026-11-01T03:00:00.000Z');
  assert.equal(url.searchParams.get('q'), 'Maria');
  assert.equal(url.searchParams.get('singleEvents'), 'true');
  assert.equal(new URL(calls[1].url).searchParams.get('pageToken'), 'p2');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer tok');

  const endless = fakeFetch(() => json(200, { items: [timed], nextPageToken: 'more' }));
  const truncated = await listCalendarEvents({ from: '2026-10-01', to: '2026-10-31', env, fetchImpl: endless.fetchImpl });
  assert.equal(truncated.truncated, true);
  assert.equal(endless.calls.length, 5); // limite de páginas por consulta
});

test('listCalendarEvents: período inválido ou grande demais é recusado sem chamar o Google; erros viram códigos claros', async () => {
  const { fetchImpl, calls } = fakeFetch(() => json(200, { items: [] }));
  for (const range of [{ from: '2026-10-31', to: '2026-10-01' }, { from: 'x', to: '2026-10-01' }, { from: '2025-01-01', to: '2026-10-01' }]) {
    await assert.rejects(listCalendarEvents({ ...range, env, fetchImpl }), (e) => e.code === 'invalid_range');
  }
  assert.equal(calls.length, 0);
  await assert.rejects(listCalendarEvents({ from: '2026-10-01', to: '2026-10-02', env: {}, fetchImpl }), (e) => e.code === 'not_configured');
  for (const [status, code] of [[403, 'permission'], [429, 'rate_limited'], [503, 'unavailable'], [404, 'calendar_not_found']]) {
    await assert.rejects(listCalendarEvents({ from: '2026-10-01', to: '2026-10-02', env, fetchImpl: fakeFetch(() => json(status, {})).fetchImpl }), (e) => e.code === code);
  }
  await assert.rejects(listCalendarEvents({ from: '2026-10-01', to: '2026-10-02', env, fetchImpl: fakeFetch(() => { throw new Error('rede'); }).fetchImpl }), (e) => e.code === 'unavailable');
});

test('criar: POST com o corpo validado e retorna só o que o Google confirmou; falha do Google não vira sucesso', async () => {
  const { fetchImpl, calls } = fakeFetch(() => json(200, timed));
  const created = await createCalendarEvent({ input: { title: 'Reunião', date: '2026-10-10', startTime: '14:30', endTime: '15:30' }, env, fetchImpl });
  assert.equal(created.id, 'e1');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].body.summary, 'Reunião');
  assert.equal(calls[0].body.id, undefined); // ID gerado pelo Google: nunca colide com o ID determinístico dos pedidos
  await assert.rejects(createCalendarEvent({ input: { title: '' }, env, fetchImpl }), (e) => e.code === 'invalid_event');
  assert.equal(calls.length, 1);
  await assert.rejects(createCalendarEvent({ input: { title: 'x', date: '2026-10-10', startTime: '09:00', endTime: '10:00' }, env, fetchImpl: fakeFetch(() => json(500, {})).fetchImpl }), (e) => e.code === 'unavailable');
});

test('editar: PATCH no evento (preserva os demais campos do Google), ID validado e 404 explícito', async () => {
  const { fetchImpl, calls } = fakeFetch(() => json(200, timed));
  const input = { title: 'Reunião', date: '2026-10-10', startTime: '14:30', endTime: '15:30' };
  await updateCalendarEvent({ id: 'e1', input, env, fetchImpl });
  assert.equal(calls[0].init.method, 'PATCH');
  assert.match(calls[0].url, /\/events\/e1$/);
  await assert.rejects(updateCalendarEvent({ id: '../x', input, env, fetchImpl }), (e) => e.code === 'invalid_event');
  await assert.rejects(updateCalendarEvent({ id: 'e1', input, env, fetchImpl: fakeFetch(() => json(404, {})).fetchImpl }), (e) => e.code === 'event_not_found');
  assert.equal(calls.length, 1);
});

test('convidado: lê os convidados atuais e regrava com o novo (preserva os demais); o Google envia o convite (sendUpdates=all)', async () => {
  const { fetchImpl, calls } = fakeFetch((call) => (call.init.method === 'GET' ? json(200, { id: 'e1', attendees: [{ email: 'agente@x.com', responseStatus: 'accepted' }] }) : json(200, { id: 'e1' })));
  assert.deepEqual(await addCalendarEventGuest({ id: 'e1', email: ' Cliente@Exemplo.com ', env, fetchImpl }), { id: 'e1', added: true });
  assert.deepEqual(calls.map((c) => c.init.method), ['GET', 'PATCH']);
  assert.match(calls[1].url, /\/events\/e1\?sendUpdates=all$/);
  assert.deepEqual(calls[1].body, { attendees: [{ email: 'agente@x.com', responseStatus: 'accepted' }, { email: 'Cliente@Exemplo.com' }] });
  assert.deepEqual(Object.keys(calls[1].body), ['attendees']); // título, horário e descrição não são tocados
});

test('convidado: quem já está no evento não é reenviado; recusas do Google viram erro claro (nunca sucesso)', async () => {
  const already = fakeFetch(() => json(200, { id: 'e1', attendees: [{ email: 'cliente@exemplo.com' }] }));
  assert.deepEqual(await addCalendarEventGuest({ id: 'e1', email: 'Cliente@exemplo.com', env, fetchImpl: already.fetchImpl }), { id: 'e1', added: false });
  assert.equal(already.calls.length, 1);

  const refused = fakeFetch((call) => (call.init.method === 'GET' ? json(200, { id: 'e1' }) : json(403, { error: { errors: [{ reason: 'forbiddenForServiceAccounts' }] } })));
  await assert.rejects(addCalendarEventGuest({ id: 'e1', email: 'a@b.com', env, fetchImpl: refused.fetchImpl }), (e) => e instanceof GoogleCalendarError && e.code === 'guests_not_allowed');
  const forbidden = fakeFetch((call) => (call.init.method === 'GET' ? json(200, { id: 'e1' }) : json(403, {})));
  await assert.rejects(addCalendarEventGuest({ id: 'e1', email: 'a@b.com', env, fetchImpl: forbidden.fetchImpl }), (e) => e.code === 'permission');
  await assert.rejects(addCalendarEventGuest({ id: 'sumiu', email: 'a@b.com', env, fetchImpl: fakeFetch(() => json(404, {})).fetchImpl }), (e) => e.code === 'event_not_found');

  const untouched = fakeFetch(() => json(200, {}));
  for (const email of ['', 'sem-arroba', 'a b@c.com', undefined]) await assert.rejects(addCalendarEventGuest({ id: 'e1', email, env, fetchImpl: untouched.fetchImpl }), (e) => e.code === 'invalid_guest');
  assert.equal(untouched.calls.length, 0);
});

test('excluir: só conclui com confirmação do Google (204/410); falhas propagam e 404 é erro', async () => {
  const ok = fakeFetch(() => json(204, null));
  assert.deepEqual(await deleteCalendarEvent({ id: 'e1', env, fetchImpl: ok.fetchImpl }), { id: 'e1' });
  assert.equal(ok.calls[0].init.method, 'DELETE');
  assert.deepEqual(await deleteCalendarEvent({ id: 'e1', env, fetchImpl: fakeFetch(() => json(410, {})).fetchImpl }), { id: 'e1' }); // já excluído na agenda
  for (const [status, code] of [[404, 'event_not_found'], [403, 'permission'], [503, 'unavailable']]) {
    await assert.rejects(deleteCalendarEvent({ id: 'e1', env, fetchImpl: fakeFetch(() => json(status, {})).fetchImpl }), (e) => e.code === code);
  }
  await assert.rejects(deleteCalendarEvent({ id: 'e1', env, fetchImpl: fakeFetch(() => { throw new Error('rede'); }).fetchImpl }), (e) => e.code === 'unavailable');
  await assert.rejects(deleteCalendarEvent({ id: 'a/b', env, fetchImpl: ok.fetchImpl }), (e) => e.code === 'invalid_event');
});
