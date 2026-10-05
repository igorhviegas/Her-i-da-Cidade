import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import {
  GoogleCalendarError, buildCalendarEvent, calendarEventId, eventDateKey, eventDescription, eventTimes, eventTitle, getAccessToken,
  resetTokenCache, syncOrderToCalendar, whatsappLink, whatsappMessage,
} from './google-calendar.js';

const client = { name: 'Maria Silva', whatsapp: '(31) 99904-4206', whatsappNormalized: '5531999044206' };
const order = () => ({
  childName: 'Pedro', eventDate: new Date('2026-10-10T15:00:00Z'), // 12:00 em Brasília
  eventForm: { formType: 'Aniversário', eventTime: '14:30', location: 'Rua das Flores, 10 - BH', imageAuthorization: true, extraWeb: 2, totalValue: 1000, entryValue: 500, cost: 150, observations: 'Bolo às 16h' },
});

test('título no formato Evento {#formulário}: {Cliente} - {criança}', () => {
  assert.equal(eventTitle(order(), client), 'Evento Aniversário: Maria Silva - Pedro');
});

test('data/horário: início do formulário, fim = +1h (inclusive virando o dia), fuso de Brasília', () => {
  const event = buildCalendarEvent(order(), client);
  assert.deepEqual(event.start, { dateTime: '2026-10-10T14:30:00', timeZone: 'America/Sao_Paulo' });
  assert.deepEqual(event.end, { dateTime: '2026-10-10T15:30:00', timeZone: 'America/Sao_Paulo' });
  assert.equal(event.location, 'Rua das Flores, 10 - BH');
  assert.deepEqual(eventTimes('2026-12-31', '23:30'), { start: '2026-12-31T23:30:00', end: '2027-01-01T00:30:00' });
});

test('a data não desloca por fuso: meio-dia local de qualquer fuso cai no mesmo dia em Brasília', () => {
  assert.equal(eventDateKey(new Date('2026-10-10T12:00:00Z')), '2026-10-10');
  assert.equal(eventDateKey(new Date('2026-10-10T15:00:00Z')), '2026-10-10');
  assert.equal(eventDateKey({ toDate: () => new Date('2026-10-10T23:00:00Z') }), '2026-10-10');
  assert.equal(eventDateKey(null), null);
});

test('descrição enxuta: só contato, autorização de imagem, teia extra, observações e link de WhatsApp (com emojis)', () => {
  const text = eventDescription(order(), client);
  const lines = text.split('\n');
  assert.deepEqual(lines.slice(0, 5), [
    '👤 Cliente: Maria Silva', '📱 WhatsApp: (31) 99904-4206', '📸 Autorização do uso de imagem: Sim', '🕸️ Teia extra: 2', '📝 Observações: Bolo às 16h',
  ]);
  assert.equal(lines[5], '');
  assert.equal(lines[6], '💬 Abrir conversa com a mensagem pronta:');
  assert.equal(lines[7], whatsappLink(order(), client));
  assert.equal(lines.length, 8);
  for (const omitted of ['Valor', 'Custo', 'Local', 'Horário', 'Data do evento', 'Nome da criança', 'Formulário']) assert.ok(!text.includes(omitted), `não deveria conter: ${omitted}`);
  const none = { ...order(), eventForm: { ...order().eventForm, extraWeb: 0, imageAuthorization: false, observations: '' } };
  const plain = eventDescription(none, client);
  assert.ok(plain.includes('🕸️ Teia extra: Não') && plain.includes('imagem: Não') && plain.includes('📝 Observações: —'));
  assert.ok(eventDescription(order(), { name: 'X', whatsapp: '123' }).includes('Link indisponível'));
});

test('evento criado na cor Tangerina (colorId 6)', () => {
  assert.equal(buildCalendarEvent(order(), client).colorId, '6');
});

test('mensagem de WhatsApp: texto exato, campos substituídos, URL codificada preservando emoji, acento e quebra de linha', () => {
  const message = whatsappMessage(order(), client);
  assert.equal(message, [
    'Hoje é um dia espetacular!!🤩', '',
    'Olá Maria Silva, bom dia! Aqui é o Vitor, tudo bem?', '',
    'Sou o Agente que acompanhará o Homem Aranha para o aniversário do Pedro! 🕸️🕷️ Me confirme alguns dados, por gentileza:', '',
    'O horário de início da nossa participação será às 14:30 e o endereço é no: Rua das Flores, 10 - BH', '',
    'Qualquer coisa que precisar, estou a disposição! Pode me mandar mensagem ou me ligar! 🫡', '',
    'Te enviaremos mensagem assim que chegarmos!😉',
  ].join('\n'));
  const url = new URL(whatsappLink(order(), client));
  assert.equal(url.pathname, '/5531999044206');
  assert.equal(url.searchParams.get('text'), message); // decodifica de volta ao texto original
  assert.ok(whatsappLink(order(), client).includes('%0A%0A') && !/\s/.test(whatsappLink(order(), client)));
  assert.equal(whatsappLink(order(), { name: 'X', whatsapp: '123' }), null);
  assert.ok(eventDescription(order(), { name: 'X', whatsapp: '123' }).includes('Link indisponível'));
});

test('pedido sem dados mínimos não gera evento', () => {
  const broken = (patch) => () => buildCalendarEvent({ ...order(), eventForm: { ...order().eventForm, ...patch } }, client);
  assert.throws(broken({ eventTime: '' }), (e) => e.code === 'invalid_order');
  assert.throws(broken({ formType: '' }), (e) => e.code === 'invalid_order');
  assert.throws(() => buildCalendarEvent({ ...order(), eventDate: undefined }, client), (e) => e.code === 'invalid_order');
  assert.throws(() => buildCalendarEvent({ ...order(), eventForm: undefined }, client), (e) => e.code === 'invalid_order');
});

test('ID do evento é determinístico e usa só o alfabeto aceito pelo Google (a-v, 0-9)', () => {
  assert.equal(calendarEventId('pedido1'), calendarEventId('pedido1'));
  assert.notEqual(calendarEventId('pedido1'), calendarEventId('pedido2'));
  assert.match(calendarEventId('Qualquer/ID Ç'), /^[a-v0-9]{5,1024}$/);
});

// ---- autenticação e chamadas (fetch simulado; a API real do Google NÃO é exercitada aqui) ----
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const ENV = { GOOGLE_CALENDAR_ID: 'agenda@group.calendar.google.com', GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'svc@proj.iam.gserviceaccount.com', private_key: pem }) };
const reply = (status, body = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function fakeGoogle(handlers) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
    if (String(url).startsWith('https://oauth2.googleapis.com/token')) return handlers.token?.(init) ?? reply(200, { access_token: 'tok-1', expires_in: 3600 });
    return handlers.calendar(init, calls.filter((c) => !c.url.includes('oauth2')).length);
  };
  return { fetchImpl, calls };
}

test('token: JWT RS256 assinado com a chave da conta de serviço, escopo de eventos, cacheado até perto de expirar', async () => {
  resetTokenCache();
  const google = fakeGoogle({});
  assert.equal(await getAccessToken({ env: ENV, fetchImpl: google.fetchImpl, now: 1_000_000 }), 'tok-1');
  assert.equal(await getAccessToken({ env: ENV, fetchImpl: google.fetchImpl, now: 2_000_000 }), 'tok-1');
  assert.equal(google.calls.length, 1); // segunda chamada veio do cache
  const assertion = new URLSearchParams(google.calls[0].body).get('assertion');
  const [h, p, s] = assertion.split('.');
  assert.ok(createVerify('RSA-SHA256').update(`${h}.${p}`).verify(publicKey, s, 'base64url'));
  const claims = JSON.parse(Buffer.from(p, 'base64url'));
  assert.deepEqual([claims.iss, claims.scope, claims.aud], ['svc@proj.iam.gserviceaccount.com', 'https://www.googleapis.com/auth/calendar.events', 'https://oauth2.googleapis.com/token']);
  resetTokenCache();
});

test('credenciais ausentes, inválidas ou recusadas viram erros claros, sem vazar a chave', async () => {
  resetTokenCache();
  await assert.rejects(getAccessToken({ env: {} }), (e) => e.code === 'not_configured');
  await assert.rejects(getAccessToken({ env: { GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY: '{nao e json' } }), (e) => e.code === 'invalid_credentials');
  await assert.rejects(getAccessToken({ env: { GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY: JSON.stringify({ client_email: 'a@b.c', private_key: 'lixo' }) } }), (e) => e.code === 'invalid_credentials');
  const refused = fakeGoogle({ token: () => reply(400, { error: 'invalid_grant' }) });
  await assert.rejects(getAccessToken({ env: ENV, fetchImpl: refused.fetchImpl }), (e) => e.code === 'auth' && !e.message.includes('PRIVATE'));
  await assert.rejects(getAccessToken({ env: ENV, fetchImpl: async () => { throw new Error('rede'); } }), (e) => e.code === 'unavailable');
  resetTokenCache();
});

test('primeiro envio: PUT no ID determinístico dá 404 e então cria com esse mesmo ID', async () => {
  resetTokenCache();
  const google = fakeGoogle({ calendar: (init, n) => (n === 1 ? reply(404) : reply(200, { id: calendarEventId('o1'), htmlLink: 'https://calendar.google.com/e/1' })) });
  const result = await syncOrderToCalendar({ orderId: 'o1', order: order(), client, env: ENV, fetchImpl: google.fetchImpl });
  assert.deepEqual(result, { eventId: calendarEventId('o1'), htmlLink: 'https://calendar.google.com/e/1', created: true, calendarId: ENV.GOOGLE_CALENDAR_ID });
  const [put, post] = google.calls.filter((c) => !c.url.includes('oauth2'));
  assert.equal(put.method, 'PUT'); assert.ok(put.url.endsWith(`/events/${calendarEventId('o1')}`));
  assert.equal(post.method, 'POST'); assert.equal(JSON.parse(post.body).id, calendarEventId('o1'));
  assert.equal(JSON.parse(post.body).summary, 'Evento Aniversário: Maria Silva - Pedro');
  assert.equal(put.headers.Authorization, 'Bearer tok-1');
  resetTokenCache();
});

test('reenvio: atualiza o mesmo evento (um único PUT, sem criar outro)', async () => {
  resetTokenCache();
  const google = fakeGoogle({ calendar: () => reply(200, { id: calendarEventId('o1'), htmlLink: 'L' }) });
  const result = await syncOrderToCalendar({ orderId: 'o1', order: order(), client, env: ENV, fetchImpl: google.fetchImpl });
  assert.equal(result.created, false);
  assert.deepEqual(google.calls.filter((c) => !c.url.includes('oauth2')).map((c) => c.method), ['PUT']);
  resetTokenCache();
});

test('corrida: se o POST der 409 (já criado), atualiza esse evento em vez de duplicar', async () => {
  resetTokenCache();
  const google = fakeGoogle({ calendar: (init, n) => (n === 1 ? reply(404) : n === 2 ? reply(409) : reply(200, { id: calendarEventId('o1') })) });
  const result = await syncOrderToCalendar({ orderId: 'o1', order: order(), client, env: ENV, fetchImpl: google.fetchImpl });
  assert.equal(result.created, false);
  assert.deepEqual(google.calls.filter((c) => !c.url.includes('oauth2')).map((c) => c.method), ['PUT', 'POST', 'PUT']);
  resetTokenCache();
});

test('falhas: permissão, agenda inexistente, autenticação, limite, indisponibilidade; nunca "sucesso" sem confirmação do Google', async () => {
  const run = async (calendar, extra = {}) => {
    resetTokenCache();
    const google = fakeGoogle({ calendar, ...extra });
    return syncOrderToCalendar({ orderId: 'o1', order: order(), client, env: ENV, fetchImpl: google.fetchImpl });
  };
  await assert.rejects(run(() => reply(403)), (e) => e.code === 'permission');
  await assert.rejects(run(() => reply(401)), (e) => e.code === 'auth');
  await assert.rejects(run(() => reply(429)), (e) => e.code === 'rate_limited');
  await assert.rejects(run(() => reply(503)), (e) => e.code === 'unavailable');
  await assert.rejects(run((_i, n) => reply(404)), (e) => e.code === 'calendar_not_found'); // PUT 404 e POST 404
  await assert.rejects(run(() => reply(200, {})), (e) => e.code === 'api_error'); // 200 sem id não é confirmação
  await assert.rejects(run(() => { throw new Error('rede'); }), (e) => e.code === 'unavailable');
  resetTokenCache();
  await assert.rejects(syncOrderToCalendar({ orderId: 'o1', order: order(), client, env: { ...ENV, GOOGLE_CALENDAR_ID: '' } }), (e) => e instanceof GoogleCalendarError && e.code === 'not_configured');
  await assert.rejects(syncOrderToCalendar({ orderId: 'o1', order: { ...order(), childName: '' }, client, env: ENV }), (e) => e.code === 'invalid_order');
});
