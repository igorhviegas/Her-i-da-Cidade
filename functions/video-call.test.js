import test from 'node:test';
import assert from 'node:assert/strict';
import { FieldValue } from 'firebase-admin/firestore';
import { VIDEO_CALL_CONFIG, VideoCallError, candidateSlots, createVideoCallBooking, getAvailability, hasCalendarConflict } from './video-call.js';
import { handleManyChatOrderRequest } from './manychat-handler.js';

const at = (iso) => Date.parse(`${iso}-03:00`);
const NOW = at('2026-10-06T12:00:00'); // terça-feira
const keys = (nowMs) => candidateSlots(nowMs).map((s) => `${s.date} ${s.time}`);

// ---- Firestore em memória: transações serializadas (o Firestore reexecuta a que perde a disputa, com o mesmo efeito) ----
function fakeDatabase(seed = {}) {
  const docs = new Map(Object.entries(seed));
  let ids = 0;
  let queue = Promise.resolve();
  const isDelete = (v) => v instanceof FieldValue && v.isEqual(FieldValue.delete());
  const snapshotOf = (path) => {
    const data = docs.get(path);
    return { exists: data !== undefined, id: path.split('/')[1], ref: refOf(path), data: () => data, get: (field) => data?.[field] };
  };
  const apply = (path, values, merge) => {
    const next = merge ? { ...docs.get(path) } : {};
    for (const [k, v] of Object.entries(values)) isDelete(v) ? delete next[k] : (next[k] = v);
    docs.set(path, next);
  };
  const refOf = (path) => ({
    path, id: path.split('/')[1],
    get: async () => snapshotOf(path),
    update: async (values) => { if (!docs.has(path)) throw new Error('not found'); apply(path, values, true); },
  });
  const query = (name, field, op, value) => {
    const run = async () => ({ docs: [...docs.keys()].filter((p) => p.startsWith(`${name}/`) && (op === '>=' ? docs.get(p)[field] >= value : docs.get(p)[field] === value)).map(snapshotOf) });
    return { get: run, limit: () => ({ get: run }) };
  };
  return {
    docs,
    collection: (name) => ({ doc: (id) => refOf(`${name}/${id ?? `auto${++ids}`}`), where: (field, op, value) => query(name, field, op, value) }),
    runTransaction(fn) {
      const run = queue.then(async () => {
        const writes = [];
        const result = await fn({
          get: async (ref) => snapshotOf(ref.path),
          set: (ref, values) => writes.push(() => apply(ref.path, values, false)),
          update: (ref, values) => writes.push(() => apply(ref.path, values, true)),
          delete: (ref) => writes.push(() => docs.delete(ref.path)),
        });
        writes.forEach((write) => write());
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
    count: (prefix) => [...docs.keys()].filter((p) => p.startsWith(prefix)).length,
  };
}

const SERVICE = { title: 'Vídeo Chamada ao Vivo', active: true, generateOrder: true, productionType: 'scheduled', initialStatus: 'scheduled', whatsappUrl: 'https://wa.me/5531999044206?text=Ol%C3%A1' };
const seeded = () => fakeDatabase({ 'services/2': SERVICE });
const form = (over = {}) => ({ slot: { date: '2026-10-12', time: '20:00' }, name: 'Maria', whatsapp: '(31) 99999-0001', childName: 'Davi', childAge: '5 anos', theme: 'Aniversário', details: 'Gosta de dinossauros', ...over });
const noEvents = async () => ({ events: [] });
const quietLogger = { error() {} };
const book = (database, input, extra = {}) => createVideoCallBooking({ database, input, nowMs: NOW, listEvents: noEvents, createEvent: async () => ({ id: 'evt1', htmlLink: 'https://cal/evt1' }), ctx: { env: { GOOGLE_CALENDAR_ID: 'agenda@x' } }, logger: quietLogger, ...extra });

// ---- disponibilidade: regras fixas ----

test('só segunda, quarta e sábado, com os horários configurados (3 por dia)', () => {
  const days = new Map();
  for (const s of candidateSlots(NOW)) days.set(s.date, [...(days.get(s.date) ?? []), s.time]);
  const expected = { 1: ['19:30', '20:00', '20:30'], 3: ['19:30', '20:00', '20:30'], 6: ['09:30', '10:00', '10:30'] };
  assert.ok(days.size > 10);
  for (const [date, times] of days) assert.deepEqual(times, expected[new Date(`${date}T12:00:00Z`).getUTCDay()], date);
  for (const weekday of [1, 3, 6]) assert.ok([...days.keys()].some((d) => new Date(`${d}T12:00:00Z`).getUTCDay() === weekday));
  assert.equal(VIDEO_CALL_CONFIG.durationMinutes, 15);
});

test('antecedência mínima de 24 h considera data e hora: exatamente 24 h vale, menos não', () => {
  // quarta 07/10 19:30 é o primeiro horário elegível; "agora" varia ao redor das 24 h antes dele
  assert.ok(keys(at('2026-10-06T19:30:00')).includes('2026-10-07 19:30'), 'exatamente 24 h');
  assert.ok(keys(at('2026-10-06T19:00:00')).includes('2026-10-07 19:30'), 'mais de 24 h');
  const under = keys(at('2026-10-06T19:31:00'));
  assert.ok(!under.includes('2026-10-07 19:30'), 'menos de 24 h');
  assert.ok(under.includes('2026-10-07 20:00'));
  assert.ok(!keys(at('2026-10-06T21:00:00')).includes('2026-10-07 20:30'));
});

test('antecedência máxima de 30 dias: o dia +30 entra, o +31 não', () => {
  const now = at('2026-10-03T12:00:00'); // sábado; +30 = segunda 02/11
  const list = keys(now);
  assert.ok(list.includes('2026-11-02 20:30'));
  assert.ok(!list.includes('2026-11-04 19:30'));
  assert.ok(list.every((k) => k.slice(0, 10) <= '2026-11-02'));
});

test('conflito com a agenda: sobreposição bloqueia, horário encostado não', () => {
  const ev = (startTime, endTime, extra = {}) => ({ allDay: false, startKey: '2026-10-12', startTime, endKey: '2026-10-12', endTime, ...extra });
  assert.equal(hasCalendarConflict([ev('19:45', '20:15')], '2026-10-12', '20:00'), true);
  assert.equal(hasCalendarConflict([ev('19:45', '20:15')], '2026-10-12', '19:30'), false);
  assert.equal(hasCalendarConflict([ev('19:45', '20:15')], '2026-10-12', '20:30'), false);
  assert.equal(hasCalendarConflict([ev('19:00', '21:00')], '2026-10-12', '20:30'), true);
  assert.equal(hasCalendarConflict([ev(null, null, { allDay: true })], '2026-10-12', '20:00'), false);
});

test('getAvailability remove horários ocupados no Google e reservas do próprio sistema', async () => {
  const database = seeded();
  await book(database, form()); // reserva 12/10 20:00
  const listEvents = async () => ({ events: [{ allDay: false, startKey: '2026-10-12', startTime: '19:30', endKey: '2026-10-12', endTime: '19:45' }] });
  const { days } = await getAvailability({ database, nowMs: NOW, listEvents });
  assert.deepEqual(days.find((d) => d.date === '2026-10-12').times, ['20:30']);
  assert.deepEqual(days.find((d) => d.date === '2026-10-14').times, ['19:30', '20:00', '20:30']);
});

test('falha do Google ao listar propaga: nunca oferece horário às cegas', async () => {
  await assert.rejects(getAvailability({ database: seeded(), nowMs: NOW, listEvents: async () => { throw new Error('google fora'); } }), /google fora/);
});

// ---- pedido ----

test('reserva cria pedido aguardando pagamento com todos os dados, trava e vínculo do evento', async () => {
  const database = seeded();
  let created;
  const result = await book(database, form(), { createEvent: async (args) => { created = args; return { id: 'evt1', htmlLink: 'https://cal/evt1' }; } });
  const order = database.docs.get(`orders/${result.orderId}`);
  assert.equal(order.serviceId, '2');
  assert.equal(order.paymentPending, true);
  assert.equal(order.status, 'scheduled');
  assert.equal(order.paidAt, undefined);
  assert.equal(order.totalPaid, 0);
  assert.equal(order.servicePrice, 75);
  assert.equal(order.childName, 'Davi');
  assert.deepEqual([order.videoCall.date, order.videoCall.time, order.videoCall.durationMinutes, order.videoCall.childAge, order.videoCall.theme, order.videoCall.details], ['2026-10-12', '20:00', 15, '5 anos', 'Aniversário', 'Gosta de dinossauros']);
  assert.match(order.content, /12\/10\/2026 às 20:00/);
  assert.equal(order.googleCalendar.eventId, 'evt1');
  assert.equal(order.googleCalendar.calendarId, 'agenda@x');
  assert.deepEqual([created.input.date, created.input.startTime, created.input.endTime], ['2026-10-12', '20:00', '20:15']);
  assert.match(created.input.description, /Davi/);
  const client = database.docs.get(`clients/${order.clientId}`);
  assert.deepEqual([client.name, client.whatsappNormalized], ['Maria', '5531999990001']);
  assert.equal(result.whatsappUrl, SERVICE.whatsappUrl);
});

test('cliente existente (índice de WhatsApp) é reaproveitado', async () => {
  const database = fakeDatabase({ 'services/2': SERVICE, 'clients/whatsapp_5531999990001': { clientId: 'c9', recordType: 'whatsapp-index' }, 'clients/c9': { name: 'Maria Antiga', whatsappNormalized: '5531999990001' } });
  const { orderId } = await book(database, form());
  assert.equal(database.docs.get(`orders/${orderId}`).clientId, 'c9');
  assert.equal(database.count('clients/'), 2);
});

test('dados obrigatórios, horário fora da regra e horário já ocupado no Google são recusados sem gravar nada', async () => {
  const database = seeded();
  await assert.rejects(book(database, form({ childName: '' })), (e) => e.code === 'validation_error');
  await assert.rejects(book(database, form({ whatsapp: '123' })), (e) => e.code === 'validation_error');
  await assert.rejects(book(database, form({ slot: { date: '2026-10-13', time: '20:00' } })), (e) => e.code === 'slot_unavailable'); // terça
  await assert.rejects(book(database, form({ slot: { date: '2026-10-12', time: '21:00' } })), (e) => e.code === 'slot_unavailable');
  await assert.rejects(book(database, form({ slot: { date: '2026-10-07', time: '19:30' } }), { nowMs: at('2026-10-06T19:31:00') }), (e) => e.code === 'slot_unavailable'); // < 24 h
  await assert.rejects(book(database, form(), { listEvents: async () => ({ events: [{ allDay: false, startKey: '2026-10-12', startTime: '20:00', endKey: '2026-10-12', endTime: '20:30' }] }) }), (e) => e.code === 'slot_unavailable');
  assert.equal(database.count('orders/'), 0);
  assert.equal(database.count('videoCallSlots/'), 0);
});

test('serviço mal configurado no CRM bloqueia a reserva', async () => {
  const database = fakeDatabase({ 'services/2': { ...SERVICE, active: false } });
  await assert.rejects(book(database, form()), (e) => e.code === 'service_unavailable');
  assert.equal(database.count('orders/'), 0);
});

// ---- concorrência ----

test('duas reservas simultâneas do mesmo horário: só uma vence', async () => {
  const database = seeded();
  let events = 0;
  const createEvent = async () => { events += 1; return { id: `evt${events}` }; };
  const results = await Promise.allSettled([
    book(database, form({ whatsapp: '31999990001' }), { createEvent }),
    book(database, form({ whatsapp: '31999990002', name: 'Joana' }), { createEvent }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), ['fulfilled', 'rejected']);
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, 'slot_unavailable');
  assert.equal(database.count('orders/'), 1);
  assert.equal(database.count('videoCallSlots/'), 1);
  assert.equal(events, 1);
});

test('mesmo WhatsApp não acumula pré-agendamentos abertos', async () => {
  const database = seeded();
  await book(database, form());
  await assert.rejects(book(database, form({ slot: { date: '2026-10-14', time: '19:30' } })), (e) => e.code === 'already_pending');
});

test('trava órfã (pedido excluído no CRM) libera o horário sozinha', async () => {
  const database = seeded();
  const { orderId } = await book(database, form());
  database.docs.delete(`orders/${orderId}`);
  const { days } = await getAvailability({ database, nowMs: NOW, listEvents: noEvents });
  assert.ok(days.find((d) => d.date === '2026-10-12').times.includes('20:00'));
  await book(database, form({ whatsapp: '31999990009' })); // e pode ser reservado de novo
  assert.equal(database.count('orders/'), 1);
});

// ---- Google falhando ----

test('se o evento não for criado no Google, a reserva é desfeita e o erro é propagado', async () => {
  const database = seeded();
  await assert.rejects(book(database, form(), { createEvent: async () => { throw new Error('google recusou'); } }), /google recusou/);
  assert.equal(database.count('orders/'), 0);
  assert.equal(database.count('videoCallSlots/'), 0);
  assert.equal(database.count('videoCallPending/'), 0);
  await book(database, form()); // horário e WhatsApp seguem livres
  assert.equal(database.count('orders/'), 1);
});

// ---- pagamento pelo ManyChat ----

const SECRET = 's3cret';
async function payment(database, body) {
  const res = { headers: {}, set() { return this; }, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  const req = { method: 'POST', body, rawBody: Buffer.from('{}'), is: () => true, get: (h) => (h === 'authorization' ? `Bearer ${SECRET}` : undefined) };
  await handleManyChatOrderRequest(req, res, { database, secret: SECRET, logger: quietLogger });
  return res;
}
const paid = (whatsapp) => ({ eventType: 'payment.paid', service: 'live-call', customer: { name: 'Maria', whatsapp }, childName: 'Davi' });

test('payment.paid do ManyChat confirma o pré-agendamento do mesmo WhatsApp, sem criar outro pedido', async () => {
  const database = seeded();
  const { orderId } = await book(database, form());
  const res = await payment(database, paid('+55 31 99999-0001'));
  assert.equal(res.statusCode, 200);
  assert.deepEqual([res.body.orderId, res.body.confirmedBooking], [orderId, true]);
  const order = database.docs.get(`orders/${orderId}`);
  assert.equal('paymentPending' in order, false);
  assert.ok(order.paidAt);
  assert.equal(order.totalPaid, 75);
  assert.equal(order.videoCall.time, '20:00');
  assert.equal(database.count('orders/'), 1);
  assert.equal(database.count('videoCallSlots/'), 1); // o horário continua ocupado
});

test('payment.paid sem pré-agendamento segue o fluxo antigo (cria o pedido já pago)', async () => {
  const database = seeded();
  const res = await payment(database, paid('+55 31 98888-0000'));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.confirmedBooking, undefined);
  const order = database.docs.get(`orders/${res.body.orderId}`);
  assert.ok(order.paidAt);
  assert.equal(order.paymentPending, undefined);
});

test('VideoCallError carrega o código', () => assert.equal(new VideoCallError('x', 'm').code, 'x'));
