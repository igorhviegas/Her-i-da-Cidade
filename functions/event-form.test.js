import test from 'node:test';
import assert from 'node:assert/strict';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { EventFormError, depositMissionId, submitEventForm, syncEventFormHolds } from './event-form.js';
import { bookingKey, handleManyChatOrderRequest } from './manychat-handler.js';

// Firestore em memória, só com o que o formulário usa (transações serializadas).
function fakeDatabase(seed = {}) {
  const docs = new Map(Object.entries(seed));
  let ids = 0;
  const isDelete = (v) => v instanceof FieldValue && v.isEqual(FieldValue.delete());
  const snap = (path) => ({ exists: docs.has(path), id: path.split('/')[1], ref: ref(path), data: () => docs.get(path), get: (f) => docs.get(path)?.[f] });
  const write = (path, values, merge) => {
    const next = merge ? { ...docs.get(path) } : {};
    for (const [k, v] of Object.entries(values)) { if (isDelete(v)) Reflect.deleteProperty(next, k); else next[k] = v; }
    docs.set(path, next);
  };
  const ref = (path) => ({
    path, id: path.split('/')[1], get: async () => snap(path),
    update: async (v) => write(path, v, true), delete: async () => docs.delete(path),
    create: async (v) => { if (docs.has(path)) throw new Error('ALREADY_EXISTS'); write(path, v, false); },
  });
  const query = (name, filters) => ({
    where: (f, op, v) => query(name, [...filters, [f, v]]),
    limit: () => query(name, filters),
    get: async () => ({ docs: [...docs.keys()].filter((p) => p.startsWith(`${name}/`) && filters.every(([f, v]) => docs.get(p)[f] === v)).map(snap) }),
  });
  return {
    docs,
    collection: (name) => ({ doc: (id) => ref(`${name}/${id ?? `auto${++ids}`}`), where: (f, op, v) => query(name, [[f, v]]) }),
    async runTransaction(fn) {
      const writes = [];
      const result = await fn({
        get: async (r) => snap(r.path), set: (r, v) => writes.push(() => write(r.path, v, false)),
        update: (r, v) => writes.push(() => write(r.path, v, true)), delete: (r) => writes.push(() => docs.delete(r.path)),
      });
      writes.forEach((w) => w());
      return result;
    },
  };
}

const NOW = Date.parse('2026-10-16T12:00:00-03:00');
const DAY = 86_400_000;
const SERVICE = { title: 'Serviços Presenciais', active: true, generateOrder: true, productionType: 'scheduled', initialStatus: 'scheduled', whatsappUrl: 'https://wa.me/5531999044206' };
const input = (over = {}) => ({
  packageId: 'aniversario', childName: 'Miguel', eventDate: '2026-11-22', eventTime: '14:00', location: 'Rua 3, 60, Vila Alpina, Betim/MG',
  responsibleName: 'Kemily Caires', cpf: '529.982.247-25', ddi: '55', whatsapp: '(31) 99999-0001', email: 'k@x.com', extraWeb: 1,
  birthdayVideo: false, inviteVideo: false, imageAuthorization: 'yes', acceptTerms: true, termsVersion: '3', ...over,
});
const quiet = { error() {} };
const submit = (database, over, extra = {}) => submitEventForm({ database, input: input(over), nowMs: NOW, syncCalendar: async () => ({ eventId: 'evt1', calendarId: 'cal', htmlLink: null }), logger: quiet, ...extra });
const orderOf = (db) => [...db.docs].find(([p]) => p.startsWith('orders/'));

test('envio cria rascunho aguardando sinal com número sequencial a partir de 215', async () => {
  const db = fakeDatabase({ 'services/6': SERVICE });
  const result = await submit(db);
  assert.equal(result.label, 'A215');
  assert.match(result.whatsappUrl, /A215/);
  const [, order] = orderOf(db);
  assert.equal(order.eventDraft, true);
  assert.equal(order.paymentPending, true);
  assert.equal(order.eventForm.formType, 'A215 · Aniversário Espetacular');
  assert.equal(order.eventForm.totalValue, 0); // sem orçamento: o dono confere o valor
  assert.equal(order.eventFormSite.cpf, '52998224725');
  assert.equal(db.docs.get('siteConfig/eventFormCounter').next, 216);
  assert.deepEqual(order.googleCalendar.eventId, 'evt1');

  await assert.rejects(submit(db), (e) => e instanceof EventFormError && e.code === 'already_pending' && /A215/.test(e.message));
  assert.equal((await submit(db, { whatsapp: '(31) 98888-0002' })).label, 'A216');
});

test('orçamento do link define o valor quando pacote e data batem; falha da agenda não perde o formulário', async () => {
  const db = fakeDatabase({ 'services/6': SERVICE, 'eventQuotes/abc123def456': { packageId: 'aniversario', date: '2026-11-22', location: 'x', total: 847, createdAtMs: NOW } });
  await submit(db, { quoteId: 'abc123def456' }, { syncCalendar: async () => { throw Object.assign(new Error('x'), { code: 'unavailable' }); } });
  const [, order] = orderOf(db);
  assert.equal(order.eventForm.totalValue, 862); // 847 + teia extra
  assert.equal(order.eventForm.entryValue, 431);
  assert.equal(order.googleCalendar, undefined);
  assert.ok(db.docs.get('eventQuotes/abc123def456').usedByOrderId);
});

test('sem sinal: missão no 3º dia, exclusão 3 dias depois de concluída', async () => {
  const db = fakeDatabase({ 'services/6': SERVICE });
  await submit(db);
  const [path] = orderOf(db);
  const orderId = path.split('/')[1];
  const deleted = [];
  const run = (ms) => syncEventFormHolds({ database: db, nowMs: ms, deleteEvent: async ({ id }) => deleted.push(id), logger: quiet });

  assert.equal((await run(NOW + 2 * DAY)).reminders, 0);
  assert.equal((await run(NOW + 3 * DAY)).reminders, 1);
  assert.equal(db.docs.get(`missions/${depositMissionId(orderId)}`).status, 'pending');
  assert.equal((await run(NOW + 10 * DAY)).expired, 0); // missão não concluída: nada é apagado

  db.docs.get(`missions/${depositMissionId(orderId)}`).status = 'completed';
  db.docs.get(`missions/${depositMissionId(orderId)}`).completedAt = Timestamp.fromMillis(NOW + 4 * DAY);
  assert.equal((await run(NOW + 6 * DAY)).expired, 0);
  assert.equal((await run(NOW + 7 * DAY)).expired, 1);
  assert.equal(db.docs.has(path), false);
  assert.equal(db.docs.has(`eventFormPending/${bookingKey('5531999990001')}`), false);
  assert.deepEqual(deleted, ['evt1']);
});

test('sinal pago pelo ManyChat confirma o formulário (sem rascunho novo) e a missão pendente some', async () => {
  const db = fakeDatabase({ 'services/6': SERVICE });
  await submit(db);
  const [path] = orderOf(db);
  await syncEventFormHolds({ database: db, nowMs: NOW + 3 * DAY, logger: quiet });

  const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, setHeader() {}, set() { return this; } };
  let confirmed = null;
  await handleManyChatOrderRequest(
    { method: 'POST', rawBody: Buffer.from('{}'), is: () => true, get: (h) => (h === 'authorization' ? 'Bearer s' : undefined), body: { eventType: 'payment.paid', service: 'presential-event', customer: { name: 'Kemily', whatsapp: '31999990001' } } },
    res, { database: db, secret: 's', logger: { ...console, info() {}, warn() {}, error() {} }, onBookingConfirmed: (id) => { confirmed = id; } },
  );
  assert.equal(res.statusCode < 300, true, JSON.stringify(res.body));
  assert.equal(confirmed, path.split('/')[1]);
  assert.equal(db.docs.get(path).paymentPending, undefined);
  assert.equal(db.docs.get(path).eventDraft, true); // o dono ainda confere os valores em "Editar pedido"
  assert.equal([...db.docs.keys()].filter((p) => p.startsWith('orders/')).length, 1);

  assert.equal((await syncEventFormHolds({ database: db, nowMs: NOW + 4 * DAY, logger: quiet })).cleared, 1);
});

test('usa a configuração do CRM: preço do adicional, prazo do sinal e versão dos termos', async () => {
  const config = { addonPrices: { extraWeb: 25 }, depositDays: 5, termsVersion: '4', terms: { 4: '## 1. Teste\nItem.' } };
  const db = fakeDatabase({ 'services/6': SERVICE, 'siteConfig/eventForm': config, 'eventQuotes/abc123def456': { packageId: 'aniversario', date: '2026-11-22', location: 'x', total: 847, createdAtMs: NOW } });
  await assert.rejects(submit(db), (e) => e.code === 'terms_changed');
  const result = await submit(db, { termsVersion: '4', quoteId: 'abc123def456', extraChildren: [{ name: 'Ana', age: '3' }] });
  assert.equal(result.termsVersion, '4');
  const [path, order] = orderOf(db);
  assert.equal(order.eventForm.totalValue, 882); // 847 + teia a R$ 25 + certificado da irmã R$ 10
  assert.equal(order.childName, 'Miguel e Ana');
  assert.equal(order.eventFormSite.termsVersion, '4');
  const run = (ms) => syncEventFormHolds({ database: db, nowMs: ms, logger: quiet });
  assert.equal((await run(NOW + 4 * DAY)).reminders, 0);
  assert.equal((await run(NOW + 5 * DAY)).reminders, 1);
  assert.match(db.docs.get(`missions/${depositMissionId(path.split('/')[1])}`).description, /Sem sinal em 5 dias/);
});

test('numeração: segue o contador antigo e aceita a correção do dono (mesmo para trás)', async () => {
  const legacy = fakeDatabase({ 'services/6': SERVICE, 'counters/eventForm': { next: 216 } });
  assert.equal((await submit(legacy)).label, 'A216');
  const fixed = fakeDatabase({ 'services/6': SERVICE, 'counters/eventForm': { next: 216 }, 'siteConfig/eventFormCounter': { next: 215 } });
  assert.equal((await submit(fixed)).label, 'A215');
  assert.equal(fixed.docs.get('siteConfig/eventFormCounter').next, 216);
});
