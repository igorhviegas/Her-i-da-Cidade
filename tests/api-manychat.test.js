import test from 'node:test';
import assert from 'node:assert/strict';
import {
  handleManyChatWebhook,
  parseServiceAccountCredentials,
} from '../api/manychat.ts';
import { handleManyChatOrderRequest } from '../functions/manychat-handler.js';

const TEST_SECRET = 'vercel-test-secret-12345';

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    headersSent: false,
    set(name, value) {
      this.headers[name.toLowerCase()] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      this.headersSent = true;
      return this;
    },
  };
}

function createMockRequest({
  method = 'POST',
  body = {},
  headers = {},
  rawBody = null,
} = {}) {
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }
  if (!normalizedHeaders['content-type']) {
    normalizedHeaders['content-type'] = 'application/json';
  }

  const jsonBuffer = Buffer.from(JSON.stringify(body));

  return {
    method,
    headers: normalizedHeaders,
    body,
    rawBody: rawBody || jsonBuffer,
    get(name) {
      return normalizedHeaders[name.toLowerCase()];
    },
    is(type) {
      return (normalizedHeaders['content-type'] || '').includes(type);
    },
  };
}

function createFakeFirestore({ serviceExists = true, servicePrice = 'Apenas R$ 30', failOrderWrite = false } = {}) {
  const writes = [];
  let generatedId = 0;
  const serviceData = {
    title: 'Vídeo Especial de Aniversário',
    price: servicePrice,
    active: true,
    category: 'Pronta entrega',
    generateOrder: true,
    productionType: 'immediate',
    initialStatus: 'delivery',
    autoComplete: false,
  };

  return {
    writes,
    collection(name) {
      return {
        doc(id) {
          const docId = id || `${name}-doc-${++generatedId}`;
          return {
            collectionName: name,
            id: docId,
            async get() {
              if (name === 'services' && id === '1') {
                return { exists: serviceExists, data: () => ({ ...serviceData }) };
              }
              return { exists: false, data: () => undefined };
            },
          };
        },
        where() { return this; },
        limit() { return this; },
        async get() { return { docs: [] }; },
      };
    },
    async runTransaction(updateFunction) {
      const transaction = {
        async get(ref) {
          return ref.get();
        },
        set(ref, data) {
          if (ref.collectionName === 'orders' && failOrderWrite) {
            throw new Error('Simulated Firestore write failure');
          }
          writes.push({ action: 'set', collection: ref.collectionName, id: ref.id, data });
        },
      };
      return updateFunction(transaction);
    },
  };
}

test('parseServiceAccountCredentials: converts literal \\n to actual newlines', () => {
  const rawJsonWithEscapedNewlines = JSON.stringify({
    project_id: 'test-project',
    client_email: 'test@test-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\\n-----END PRIVATE KEY-----\\n',
  });

  const parsed = parseServiceAccountCredentials(rawJsonWithEscapedNewlines);
  assert.equal(parsed.projectId, 'test-project');
  assert.equal(parsed.clientEmail, 'test@test-project.iam.gserviceaccount.com');
  assert.ok(parsed.privateKey.includes('\n'));
  assert.ok(!parsed.privateKey.includes('\\n'));
  assert.ok(parsed.privateKey.startsWith('-----BEGIN PRIVATE KEY-----'));
  assert.ok(parsed.privateKey.endsWith('-----END PRIVATE KEY-----\n'));
});

test('parseServiceAccountCredentials: accepts Base64 encoded JSON and strips outer quotes', () => {
  const rawJson = JSON.stringify({
    project_id: 'base64-project',
    client_email: 'b64@example.com',
    private_key: '-----BEGIN PRIVATE KEY-----\\nMIIB\\n-----END PRIVATE KEY-----\\n',
  });

  const base64String = Buffer.from(rawJson).toString('base64');
  const wrappedInQuotes = `"${base64String}"`;

  const parsed = parseServiceAccountCredentials(wrappedInQuotes);
  assert.equal(parsed.projectId, 'base64-project');
  assert.equal(parsed.clientEmail, 'b64@example.com');
  assert.ok(parsed.privateKey.includes('\n'));
});

test('parseServiceAccountCredentials: throws on invalid JSON or corrupt Base64', () => {
  assert.throws(
    () => parseServiceAccountCredentials('not a valid json {'),
    /Falha ao decodificar JSON/
  );
});

test('parseServiceAccountCredentials: throws on missing required fields', () => {
  assert.throws(
    () => parseServiceAccountCredentials(JSON.stringify({ client_email: 'a@b.com', private_key: 'pk' })),
    /Campo obrigatório project_id ausente/
  );

  assert.throws(
    () => parseServiceAccountCredentials(JSON.stringify({ project_id: 'p', private_key: 'pk' })),
    /Campo obrigatório client_email ausente/
  );

  assert.throws(
    () => parseServiceAccountCredentials(JSON.stringify({ project_id: 'p', client_email: 'a@b.com' })),
    /Campo obrigatório private_key ausente/
  );
});

test('GET request returns 405 without attempting to connect to database or checking secret', async () => {
  const originalSecret = process.env.MANYCHAT_WEBHOOK_SECRET;
  delete process.env.MANYCHAT_WEBHOOK_SECRET;

  try {
    const req = createMockRequest({ method: 'GET' });
    const res = createMockResponse();

    await handleManyChatWebhook(req, res);

    assert.equal(res.statusCode, 405);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error.code, 'method_not_allowed');
    assert.deepEqual(res.body.allowedMethods, ['POST']);
  } finally {
    if (originalSecret) process.env.MANYCHAT_WEBHOOK_SECRET = originalSecret;
  }
});

test('returns 500 when MANYCHAT_WEBHOOK_SECRET is not configured', async () => {
  const originalSecret = process.env.MANYCHAT_WEBHOOK_SECRET;
  delete process.env.MANYCHAT_WEBHOOK_SECRET;

  try {
    const req = createMockRequest({
      method: 'POST',
      body: { eventType: 'payment.paid' },
    });
    const res = createMockResponse();

    await handleManyChatWebhook(req, res);

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.ok, false);
    assert.equal(res.body.error.code, 'server_misconfigured');
  } finally {
    if (originalSecret) process.env.MANYCHAT_WEBHOOK_SECRET = originalSecret;
  }
});

test('returns 401 when Authorization header is missing or wrong', async () => {
  const fakeDb = createFakeFirestore();
  const req = createMockRequest({
    method: 'POST',
    headers: { authorization: 'Bearer wrong-secret' },
    body: {
      eventType: 'payment.paid',
      customer: { name: 'Maria Silva', whatsapp: '31988887777' },
      childName: 'Lucas',
    },
  });
  const res = createMockResponse();

  await handleManyChatOrderRequest(req, res, { database: fakeDb, secret: TEST_SECRET });

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'unauthorized');
});

test('returns 400 on payload validation errors (missing fields, wrong eventType, invalid whatsapp)', async () => {
  const fakeDb = createFakeFirestore();
  const resMissingChild = createMockResponse();
  const reqMissingChild = createMockRequest({
    method: 'POST',
    headers: { authorization: `Bearer ${TEST_SECRET}` },
    body: {
      eventType: 'payment.paid',
      customer: { name: 'Maria Silva', whatsapp: '31988887777' },
    },
  });

  await handleManyChatOrderRequest(reqMissingChild, resMissingChild, { database: fakeDb, secret: TEST_SECRET });
  assert.equal(resMissingChild.statusCode, 400);
  assert.equal(resMissingChild.body.error.code, 'validation_error');

  const resWrongEvent = createMockResponse();
  const reqWrongEvent = createMockRequest({
    method: 'POST',
    headers: { authorization: `Bearer ${TEST_SECRET}` },
    body: {
      eventType: 'payment.pending',
      customer: { name: 'Maria Silva', whatsapp: '31988887777' },
      childName: 'Lucas',
    },
  });

  await handleManyChatOrderRequest(reqWrongEvent, resWrongEvent, { database: fakeDb, secret: TEST_SECRET });
  assert.equal(resWrongEvent.statusCode, 400);
  assert.equal(resWrongEvent.body.error.code, 'validation_error');
});

test('successfully processes valid order with Firestore automatic ID without sequence counter', async () => {
  const fakeDb = createFakeFirestore();
  const req = createMockRequest({
    method: 'POST',
    headers: { authorization: `Bearer ${TEST_SECRET}` },
    body: {
      eventType: 'payment.paid',
      customer: { name: 'João Santos', whatsapp: '(31) 98765-4321' },
      childName: 'Pedro',
    },
  });
  const res = createMockResponse();

  await handleManyChatOrderRequest(req, res, { database: fakeDb, secret: TEST_SECRET });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.ok(res.body.orderId);
  assert.equal(res.body.orderId, res.body.technicalPurchaseId);

  // Valida que escreveu client, whatsapp index e order
  const orderWrite = fakeDb.writes.find(w => w.collection === 'orders');
  assert.ok(orderWrite);
  assert.equal(orderWrite.data.status, 'delivery');
  assert.equal(orderWrite.data.servicePrice, 30);
  assert.equal(orderWrite.data.totalPaid, 30);
  assert.equal(orderWrite.data.productionType, 'immediate');
  assert.equal(orderWrite.data.source, 'manychat');
  assert.equal(orderWrite.data.content, 'Aniversariante: Pedro');
  assert.equal(orderWrite.data.orderNumber, undefined);
  assert.equal(orderWrite.data.orderNumberDisplay, undefined);

  // Valida que nenhuma coleção de contador foi consultada ou gravada
  const counterWrite = fakeDb.writes.find(w => w.collection === 'systemCounters');
  assert.equal(counterWrite, undefined);
});

test('returns 500 when Firestore transaction encounters unexpected error', async () => {
  const fakeDb = createFakeFirestore({ failOrderWrite: true });
  const req = createMockRequest({
    method: 'POST',
    headers: { authorization: `Bearer ${TEST_SECRET}` },
    body: {
      eventType: 'payment.paid',
      customer: { name: 'João Santos', whatsapp: '(31) 98765-4321' },
      childName: 'Pedro',
    },
  });
  const res = createMockResponse();

  await handleManyChatOrderRequest(req, res, {
    database: fakeDb,
    secret: TEST_SECRET,
    logger: { error: () => {} },
  });

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'internal_error');
});

test('returns 422 if service 1 does not exist in catalog', async () => {
  const fakeDb = createFakeFirestore({ serviceExists: false });
  const req = createMockRequest({
    method: 'POST',
    headers: { authorization: `Bearer ${TEST_SECRET}` },
    body: {
      eventType: 'payment.paid',
      customer: { name: 'João Santos', whatsapp: '(31) 98765-4321' },
      childName: 'Pedro',
    },
  });
  const res = createMockResponse();

  await handleManyChatOrderRequest(req, res, { database: fakeDb, secret: TEST_SECRET });

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error.code, 'service_not_found');
});
