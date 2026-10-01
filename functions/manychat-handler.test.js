import test from 'node:test';
import assert from 'node:assert/strict';
import { handleManyChatOrderRequest } from './manychat-handler.js';

const SECRET = 'unit-test-secret';
const validBody = {
  eventType: 'payment.paid',
  customer: { name: 'Contato', whatsapp: '+55 31 99999-0000' },
  childName: 'Criança',
};

function makeRequest(overrides = {}) {
  return {
    method: 'POST',
    rawBody: Buffer.from(JSON.stringify(validBody)),
    body: structuredClone(validBody),
    is: (type) => type === 'application/json',
    get: (header) => header === 'authorization' ? `Bearer ${SECRET}` : undefined,
    ...overrides,
  };
}

function makeResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function callHandler(req, database = null) {
  const res = makeResponse();
  await handleManyChatOrderRequest(req, res, { database, secret: SECRET });
  return res;
}

function fakeDatabase({ serviceExists = true, servicePrice = 'Apenas R$ 30', failOrderWrite = false } = {}) {
  const writes = [];
  const reads = [];
  let shouldFailOrderWrite = failOrderWrite;
  const serviceData = {
    title: 'Vídeo Especial de Aniversário',
    price: servicePrice,
    active: true,
    category: 'Pronta entrega',
    generateOrder: true,
    productionType: 'immediate',
    initialStatus: 'completed',
    autoComplete: true,
  };
  let generatedId = 0;
  const database = {
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
      const stagedWrites = [];
      const transaction = {
        async get(reference) {
          reads.push(reference.collectionName);
          if (reference.collectionName === 'services' && reference.id === '1') {
            return { exists: serviceExists, data: () => serviceData };
          }
          return { exists: false, data: () => undefined };
        },
        set(reference, value) {
          if (shouldFailOrderWrite && reference.collectionName === 'orders') throw new Error('simulated order write failure');
          stagedWrites.push({ reference, value });
        },
      };
      const result = await callback(transaction);
      writes.push(...stagedWrites);
      return result;
    },
  };
  return { database, writes, reads, setFailOrderWrite: (value) => { shouldFailOrderWrite = value; } };
}

test('HTTP guards return distinct method, content, size, auth and contract responses', async () => {
  const method = await callHandler(makeRequest({ method: 'GET' }));
  assert.equal(method.statusCode, 405);

  const content = await callHandler(makeRequest({ is: () => false }));
  assert.equal(content.statusCode, 415);

  const large = await callHandler(makeRequest({ rawBody: Buffer.alloc(256 * 1024 + 1) }));
  assert.equal(large.statusCode, 413);

  const auth = await callHandler(makeRequest({ get: () => 'Bearer wrong' }));
  assert.equal(auth.statusCode, 401);

  const invalid = await callHandler(makeRequest({ body: { ...validBody, purchaseId: 'not-supported' } }));
  assert.equal(invalid.statusCode, 400);
  assert.match(invalid.body.details.join(' '), /purchaseId/);
});

test('contract rejects unsupported service fields and wrong payment event', async () => {
  const wrongEvent = await callHandler(makeRequest({ body: { ...validBody, eventType: 'payment.pending' } }));
  assert.equal(wrongEvent.statusCode, 400);
  assert.match(wrongEvent.body.details.join(' '), /payment.paid/);

  const missingChild = await callHandler(makeRequest({ body: { eventType: 'payment.paid', customer: validBody.customer } }));
  assert.equal(missingChild.statusCode, 400);
  assert.match(missingChild.body.details.join(' '), /childName/);
});

test('successful request atomically creates a completed order using its document ID without a counter', async () => {
  const { database, writes, reads } = fakeDatabase();
  const response = await callHandler(makeRequest(), database);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ok, true);
  assert.equal(response.body.technicalPurchaseId, response.body.orderId);

  const orderWrite = writes.find(({ reference }) => reference.collectionName === 'orders');
  const clientWrite = writes.find(({ reference }) => reference.collectionName === 'clients' && reference.id !== 'whatsapp_5531999990000');
  const indexWrite = writes.find(({ reference }) => reference.collectionName === 'clients' && reference.id === 'whatsapp_5531999990000');
  assert.equal(orderWrite.reference.id, response.body.orderId);
  assert.equal(orderWrite.value.status, 'delivery');
  assert.equal(orderWrite.value.content, 'Aniversariante: Criança');
  assert.equal(orderWrite.value.servicePrice, 30);
  assert.equal(orderWrite.value.totalPaid, 30);
  assert.equal(orderWrite.value.orderNumber, undefined);
  assert.equal(orderWrite.value.orderNumberDisplay, undefined);
  assert.equal(orderWrite.value.technicalPurchaseId, orderWrite.reference.id);
  assert.equal(orderWrite.value.completedAt, undefined);
  assert.ok(clientWrite);
  assert.ok(indexWrite);
  assert.deepEqual(writes.map(({ reference }) => reference.collectionName).sort(), ['clients', 'clients', 'orders']);
  assert.equal(reads.includes('systemCounters'), false);
});

test('repeated payloads remain separate requests with distinct Firestore IDs and no counter access', async () => {
  const { database, writes, reads } = fakeDatabase();
  const first = await callHandler(makeRequest(), database);
  const second = await callHandler(makeRequest(), database);
  assert.equal(first.statusCode, 200);
  assert.equal(second.statusCode, 200);
  assert.notEqual(first.body.orderId, second.body.orderId);
  assert.notEqual(first.body.technicalPurchaseId, second.body.technicalPurchaseId);
  assert.equal(writes.filter(({ reference }) => reference.collectionName === 'orders').length, 2);
  assert.equal(reads.includes('systemCounters'), false);
});

test('invalid service returns 422 and does not write a counter or order', async () => {
  const { database, writes } = fakeDatabase({ serviceExists: false });
  const response = await callHandler(makeRequest(), database);
  assert.equal(response.statusCode, 422);
  assert.equal(writes.length, 0);
});

test('ambiguous catalog price returns 422 without writing records', async () => {
  const { database, writes } = fakeDatabase({ servicePrice: 'A partir de R$ 30' });
  const response = await callHandler(makeRequest(), database);
  assert.equal(response.statusCode, 422);
  assert.equal(writes.length, 0);
});

test('unexpected database failure returns retry-sensitive 500 guidance', async () => {
  const { database } = fakeDatabase();
  database.runTransaction = async () => { throw new Error('simulated'); };
  const response = await callHandler(makeRequest(), database);
  assert.equal(response.statusCode, 500);
  assert.match(response.body.error.message, /Verifique o CRM antes de reenviar/);
});

test('failed order write atomically discards client and index writes', async () => {
  const { database, setFailOrderWrite } = fakeDatabase({ failOrderWrite: true });
  const failed = await callHandler(makeRequest(), database);
  assert.equal(failed.statusCode, 500);
  setFailOrderWrite(false);
  const next = await callHandler(makeRequest(), database);
  assert.equal(next.statusCode, 200);
  assert.equal(next.body.orderId, next.body.technicalPurchaseId);
});
