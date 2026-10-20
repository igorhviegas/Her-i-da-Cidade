import test from 'node:test';
import assert from 'node:assert/strict';
import { handleManyChatOrderRequest } from './manychat-handler.js';
import { dateKey, addDays } from './missions-core.js';

const SECRET = 'unit-test-secret';
const customer = { name: 'Contato', whatsapp: '+55 31 99999-0000' };
const today = dateKey(new Date());
const SERVICES = {
  '1': { title: 'Vídeo Especial de Aniversário', price: 'Apenas R$ 30', active: true, generateOrder: true, productionType: 'immediate', initialStatus: 'completed' },
  '2': { title: 'Vídeo Chamada ao Vivo', price: '15 minutos R$ 75', active: true, generateOrder: true, productionType: 'scheduled', initialStatus: 'scheduled' },
};

/** Firestore falso: serviços, parceiras (consultadas por couponCode) e o que a transação grava. */
function fakeDatabase(partners = [], { failPartners = false } = {}) {
  const store = new Map(Object.entries(SERVICES).map(([id, data]) => [`services/${id}`, data]));
  let generated = 0;
  const snapshot = (path) => { const data = store.get(path); return { exists: data !== undefined, data: () => data, get: (field) => data?.[field] }; };
  return {
    store,
    collection(name) {
      const filters = [];
      const ref = {
        doc(id) { const docId = id || `${name}-${++generated}`; return { id: docId, path: `${name}/${docId}`, get: async () => snapshot(`${name}/${docId}`) }; },
        where(field, _op, value) { filters.push([field, value]); return ref; },
        limit() { return ref; },
        async get() {
          if (name !== 'collabPartners') return { docs: [] };
          if (failPartners) throw new Error('offline');
          const docs = partners.filter((p) => filters.every(([field, value]) => p[field] === value)).map((p) => ({ id: p.id, data: () => p }));
          return { docs };
        },
      };
      return ref;
    },
    async runTransaction(callback) {
      const staged = [];
      const result = await callback({
        async get(reference) { return snapshot(reference.path); },
        set(reference, value) { staged.push([reference.path, value]); },
        update(reference, value) { staged.push([reference.path, { ...store.get(reference.path), ...value }]); },
      });
      for (const [path, value] of staged) store.set(path, value);
      return result;
    },
    orders() { return [...store.entries()].filter(([path]) => path.startsWith('orders/')).map(([, value]) => value); },
  };
}

async function post(body, database) {
  const res = { statusCode: 200, body: undefined, set() { return this; }, status(code) { this.statusCode = code; return this; }, json(payload) { this.body = payload; return this; } };
  await handleManyChatOrderRequest({
    method: 'POST', rawBody: Buffer.from(JSON.stringify(body)), body, is: (type) => type === 'application/json',
    get: (header) => (header === 'authorization' ? `Bearer ${SECRET}` : undefined),
  }, res, { database, secret: SECRET, logger: { error() {} } });
  return { res, order: database.orders()[0] };
}

const mari = { id: 'p1', name: 'Mariana', couponCode: 'MARI5', status: 'published', reelPublishedAt: addDays(today, -3) };
const birthday = (coupon) => ({ eventType: 'payment.paid', service: 'birthday-video', customer, childName: 'Theo', ...(coupon === undefined ? {} : { coupon }) });

test('cupom válido: valor pago com R$ 5 a menos, comissão de R$ 3 gravada no pedido', async () => {
  const { res, order } = await post(birthday(' mari5 '), fakeDatabase([mari]));
  assert.equal(res.statusCode, 200);
  assert.equal(order.servicePrice, 30);
  assert.equal(order.totalPaid, 25);
  assert.deepEqual(order.collab, { code: 'MARI5', partnerId: 'p1', discount: 5, commission: 3 });
  assert.match(order.content, /Cupom: MARI5$/);
});

test('sem cupom ou cupom vazio: pedido igual ao de antes', async () => {
  for (const coupon of [undefined, '', '   ', null]) {
    const { res, order } = await post(birthday(coupon), fakeDatabase([mari]));
    assert.equal(res.statusCode, 200);
    assert.equal(order.totalPaid, 30);
    assert.equal(order.collab, undefined);
    assert.doesNotMatch(order.content, /Cupom/);
  }
});

test('cupom desconhecido ou vencido não recusa o pagamento: grava com aviso', async () => {
  const unknown = await post(birthday('NAOEXISTE'), fakeDatabase([mari]));
  assert.equal(unknown.res.statusCode, 200);
  assert.deepEqual(unknown.order.collab, { code: 'NAOEXISTE', partnerId: null, discount: 5, commission: 0, warning: 'unknown' });
  assert.equal(unknown.order.totalPaid, 25);

  const expired = await post(birthday('MARI5'), fakeDatabase([{ ...mari, reelPublishedAt: addDays(today, -40) }]));
  assert.equal(expired.order.collab.warning, 'expired');
  assert.equal(expired.order.collab.commission, 3);

  const offline = await post(birthday('MARI5'), fakeDatabase([mari], { failPartners: true }));
  assert.equal(offline.res.statusCode, 200);
  assert.equal(offline.order.collab.warning, 'unknown');

  const twins = await post(birthday('MARI5'), fakeDatabase([mari, { ...mari, id: 'p2' }]));
  assert.equal(twins.order.collab.partnerId, null);
});

test('cupom no contrato antigo (sem service) e tipo inválido', async () => {
  const legacy = await post({ eventType: 'payment.paid', customer, childName: 'Theo', coupon: 'MARI5' }, fakeDatabase([mari]));
  assert.equal(legacy.res.statusCode, 200);
  assert.equal(legacy.order.totalPaid, 25);
  const invalid = await post(birthday({ code: 'MARI5' }), fakeDatabase([mari]));
  assert.equal(invalid.res.statusCode, 400);
  assert.match(invalid.res.body.details.join(' '), /coupon/);
});

test('vídeo chamada pré-agendada: a confirmação aplica o desconto sobre o valor da reserva', async () => {
  const database = fakeDatabase([mari]);
  database.store.set('videoCallPending/553199990000', { orderId: 'booked' });
  database.store.set('orders/booked', { serviceId: '2', status: 'scheduled', paymentPending: true, servicePrice: 80, totalPaid: 0 });
  const { res } = await post({ eventType: 'payment.paid', service: 'live-call', customer, coupon: 'MARI5' }, database);
  assert.equal(res.body.confirmedBooking, true);
  const order = database.store.get('orders/booked');
  assert.equal(order.totalPaid, 75);
  assert.equal(order.collab.partnerId, 'p1');
});
