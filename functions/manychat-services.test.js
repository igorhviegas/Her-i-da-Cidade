import test from 'node:test';
import assert from 'node:assert/strict';
import { handleManyChatOrderRequest, SERVICE_PROFILES, validateManyChatPayload } from './manychat-handler.js';

const SECRET = 'unit-test-secret';
const customer = { name: 'Contato', whatsapp: '+55 31 99999-0000' };

const CATALOG = {
  '1': { title: 'Vídeo Especial de Aniversário', price: 'Apenas R$ 30', category: 'Pronta entrega', active: true, generateOrder: true, productionType: 'immediate', initialStatus: 'completed', autoComplete: true },
  '2': { title: 'Vídeo Chamada ao Vivo', price: '15 minutos R$ 75', category: 'Ao Vivo', active: true, generateOrder: true, productionType: 'scheduled', initialStatus: 'scheduled' },
  '3': { title: 'Vídeo Personalizado', price: 'A partir de R$ 60', category: 'Exclusivo', active: true, generateOrder: true, productionType: 'recording', initialStatus: 'recording', defaultDeliveryDays: 7 },
  '4': { title: 'Vídeo Convite', price: 'A partir de R$ 65', category: 'Exclusivo', active: true, generateOrder: true, productionType: 'recording', initialStatus: 'recording' },
  '5': { title: 'Vídeo Temático', price: 'Apenas R$ 20', category: 'Pronta Entrega', active: true, generateOrder: true, productionType: 'immediate', initialStatus: 'completed', autoComplete: true },
};

function fakeDatabase(overrides = {}) {
  const writes = [];
  let generatedId = 0;
  const catalog = structuredClone(CATALOG);
  for (const [id, patch] of Object.entries(overrides)) catalog[id] = patch === null ? undefined : { ...catalog[id], ...patch };
  return {
    writes,
    collection(name) {
      return {
        doc(id) {
          const reference = { collectionName: name, id: id || `${name}-generated-${++generatedId}` };
          reference.get = async () => ({ exists: false });
          return reference;
        },
        where() { return this; },
        limit() { return this; },
        async get() { return { docs: [] }; },
      };
    },
    async runTransaction(callback) {
      const staged = [];
      const transaction = {
        async get(reference) {
          if (reference.collectionName === 'services') {
            const data = catalog[reference.id];
            return { exists: Boolean(data), data: () => data };
          }
          return { exists: false, data: () => undefined };
        },
        set(reference, value) { staged.push({ reference, value }); },
      };
      const result = await callback(transaction);
      writes.push(...staged);
      return result;
    },
  };
}

async function post(body, database = fakeDatabase()) {
  const res = {
    statusCode: 200, body: undefined,
    set() { return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  await handleManyChatOrderRequest({
    method: 'POST',
    rawBody: Buffer.from(JSON.stringify(body)),
    body,
    is: (type) => type === 'application/json',
    get: (header) => header === 'authorization' ? `Bearer ${SECRET}` : undefined,
  }, res, { database, secret: SECRET, logger: { error() {} } });
  return { res, order: database.writes.find(({ reference }) => reference.collectionName === 'orders')?.value, writes: database.writes };
}

const base = (service, extra = {}) => ({ eventType: 'payment.paid', service, customer, ...extra });

test('Vídeo Temático: preço do catálogo, nasce em Entregar e guarda o nome da criança', async () => {
  const { res, order } = await post(base('themed-video', { childName: 'Helena' }));
  assert.equal(res.statusCode, 200);
  assert.equal(order.serviceId, '5');
  assert.equal(order.status, 'delivery');
  assert.equal(order.servicePrice, 20);
  assert.equal(order.totalPaid, 20);
  assert.equal(order.content, 'Aniversariante: Helena');
  assert.equal(order.source, 'manychat');
  assert.equal(order.completedAt, undefined);
});

test('Vídeo Personalizado: valor pago vem do payload, status e prazo da configuração do serviço', async () => {
  const { res, order } = await post(base('custom-video', { amountPaid: '85,50', details: 'Escovar os dentes', childName: 'Davi' }));
  assert.equal(res.statusCode, 200);
  assert.equal(order.serviceId, '3');
  assert.equal(order.status, 'recording');
  assert.equal(order.productionType, 'recording');
  assert.equal(order.servicePrice, 85.5);
  assert.equal(order.totalPaid, 85.5);
  assert.equal(order.content, 'Aniversariante: Davi\nDetalhes: Escovar os dentes');
  assert.equal(order.deliveryDays, 7);
  assert.ok(order.customerDueDate && order.internalDueDate);
});

test('Vídeo Convite: nome da criança é opcional e não bloqueia o pedido', async () => {
  const { res, order } = await post(base('invite-video', { amountPaid: 65, eventDate: '2026-11-20' }));
  assert.equal(res.statusCode, 200);
  assert.equal(order.serviceId, '4');
  assert.equal(order.status, 'recording');
  assert.equal(order.content, 'Pedido recebido via ManyChat.');
  assert.equal(order.eventDate.toDate().toISOString(), '2026-11-20T15:00:00.000Z');
  assert.equal(order.deliveryDays, undefined);
});

test('Vídeo Chamada ao Vivo: exige data e entra em Agendado', async () => {
  const missing = await post(base('live-call', { amountPaid: 75 }));
  assert.equal(missing.res.statusCode, 400);
  assert.match(missing.res.body.details.join(' '), /eventDate/);
  assert.equal(missing.writes.length, 0);

  const { res, order } = await post(base('live-call', { amountPaid: 75, eventDate: '2026-11-21T16:30:00-03:00' }));
  assert.equal(res.statusCode, 200);
  assert.equal(order.serviceId, '2');
  assert.equal(order.status, 'scheduled');
  assert.equal(order.eventDate.toDate().toISOString(), '2026-11-21T19:30:00.000Z');
});

test('payloads inválidos retornam 400 e não gravam nada', async () => {
  const cases = [
    base('custom-video'),                                          // sem amountPaid
    base('custom-video', { amountPaid: 0 }),
    base('custom-video', { amountPaid: -5 }),
    base('custom-video', { amountPaid: 'abc' }),
    base('custom-video', { amountPaid: 999999 }),
    base('invite-video', { amountPaid: 65, eventDate: '2026-02-31' }),
    base('invite-video', { amountPaid: 65, serviceId: '1' }),     // campo não aceito
    base('themed-video', { childName: 'Ana', amountPaid: 1 }),    // preço de catálogo não vem do payload
    base('themed-video'),                                          // sem childName
    base('unknown-service', { amountPaid: 10 }),
    base(['custom-video'], { amountPaid: 10 }),
    base('custom-video', { amountPaid: 10, customer: { name: 'X', whatsapp: '123' } }),
  ];
  for (const body of cases) {
    const { res, writes } = await post(body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(writes.length, 0);
  }
});

test('serviço ausente ou mal configurado no CRM retorna 422 sem criar registros', async () => {
  for (const [id, patch, slug, extra] of [
    ['3', null, 'custom-video', { amountPaid: 60 }],
    ['3', { active: false }, 'custom-video', { amountPaid: 60 }],
    ['3', { generateOrder: false }, 'custom-video', { amountPaid: 60 }],
    ['4', { initialStatus: undefined, autoComplete: false }, 'invite-video', { amountPaid: 65 }],
    ['4', { title: 'Outro serviço' }, 'invite-video', { amountPaid: 65 }],
    ['5', { price: 'Sob consulta' }, 'themed-video', { childName: 'Ana' }],
  ]) {
    const { res, writes } = await post(base(slug, extra), fakeDatabase({ [id]: patch }));
    assert.equal(res.statusCode, 422, `${slug} ${JSON.stringify(patch)}`);
    assert.equal(writes.length, 0);
  }
});

test('contrato original do aniversário continua igual, com ou sem o campo service', async () => {
  const legacy = await post({ eventType: 'payment.paid', customer, childName: 'Lucas' });
  const explicit = await post(base('birthday-video', { childName: 'Lucas' }));
  for (const { res, order } of [legacy, explicit]) {
    assert.equal(res.statusCode, 200);
    assert.equal(order.serviceId, '1');
    assert.equal(order.status, 'delivery');
    assert.equal(order.content, 'Aniversariante: Lucas');
    assert.equal(order.totalPaid, 30);
  }
  assert.equal((await post({ eventType: 'payment.paid', customer, childName: 'Lucas', amountPaid: 5 })).res.statusCode, 400);
});

test('requisições repetidas continuam gerando pedidos separados (sem deduplicação nesta etapa)', async () => {
  const database = fakeDatabase();
  const body = base('invite-video', { amountPaid: 65 });
  const first = await post(body, database);
  const second = await post(body, database);
  assert.notEqual(first.res.body.orderId, second.res.body.orderId);
  assert.equal(database.writes.filter(({ reference }) => reference.collectionName === 'orders').length, 2);
});

test('todos os perfis têm slug único e serviceId único', () => {
  const ids = Object.values(SERVICE_PROFILES).map((profile) => profile.serviceId);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(validateManyChatPayload(null).errors.length, 1);
});
