import test from 'node:test';
import assert from 'node:assert/strict';
import { handleManyChatOrderRequest, resolveInitialStatus, SERVICE_PROFILES, validateManyChatPayload } from './manychat-handler.js';
import { resolveInitialStatus as frontendResolveInitialStatus } from '../services/orderInitialStatus.js';

const SECRET = 'unit-test-secret';
const customer = { name: 'Contato', whatsapp: '+55 31 99999-0000' };

const CATALOG = {
  '1': { title: 'Vídeo Especial de Aniversário', price: 'Apenas R$ 30', category: 'Pronta entrega', active: true, generateOrder: true, productionType: 'immediate', initialStatus: 'delivery' },
  '2': { title: 'Vídeo Chamada ao Vivo', price: '15 minutos R$ 75', category: 'Ao Vivo', active: true, generateOrder: true, productionType: 'scheduled', initialStatus: 'scheduled' },
  '3': { title: 'Vídeo Personalizado', price: 'A partir de R$ 60', category: 'Exclusivo', active: true, generateOrder: true, productionType: 'recording', initialStatus: 'recording', defaultDeliveryDays: 10 },
  '4': { title: 'Vídeo Convite', price: 'A partir de R$ 65', category: 'Exclusivo', active: true, generateOrder: true, productionType: 'recording', initialStatus: 'recording' },
  '5': { title: 'Vídeo Temático', price: 'Apenas R$ 20', category: 'Pronta Entrega', active: true, generateOrder: true, productionType: 'immediate', initialStatus: 'delivery' },
};

/** Firestore falso com estado. As transações são serializadas, como o resultado observável das transações reais (conflito → nova tentativa). */
function fakeDatabase(overrides = {}) {
  const store = new Map();
  const catalog = structuredClone(CATALOG);
  for (const [id, patch] of Object.entries(overrides)) catalog[id] = patch === null ? undefined : { ...catalog[id], ...patch };
  for (const [id, data] of Object.entries(catalog)) if (data) store.set(`services/${id}`, data);
  let generatedId = 0;
  let queue = Promise.resolve();
  const snapshot = (path) => {
    const data = store.get(path);
    return { exists: data !== undefined, data: () => data, get: (field) => data?.[field] };
  };
  const database = {
    store,
    collection(name) {
      return {
        doc(id) {
          const docId = id || `${name}-generated-${++generatedId}`;
          return { collectionName: name, id: docId, path: `${name}/${docId}`, get: async () => snapshot(`${name}/${docId}`) };
        },
        where() { return this; },
        limit() { return this; },
        async get() { return { docs: [] }; },
      };
    },
    runTransaction(callback) {
      const run = queue.then(async () => {
        const staged = [];
        const transaction = {
          async get(reference) { await Promise.resolve(); return snapshot(reference.path); },
          set(reference, value) { staged.push({ reference, value }); },
        };
        const result = await callback(transaction);
        for (const { reference, value } of staged) store.set(reference.path, value);
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
    docs: (name) => [...store.entries()].filter(([path]) => path.startsWith(`${name}/`)).map(([, value]) => value),
  };
  return database;
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
  return { res, database, order: database.docs('orders')[0] };
}

const base = (service, extra = {}) => ({ eventType: 'payment.paid', service, customer, ...extra });

// ---------- Preços e prazos por modalidade ----------

for (const [slug, serviceId, table] of [
  ['custom-video', '3', { '7_days': 60, '4_days': 75, '2_days': 85 }],
  ['invite-video', '4', { '7_days': 65, '4_days': 80, '2_days': 95 }],
]) {
  for (const [modality, price] of Object.entries(table)) {
    test(`${slug} ${modality}: preço R$ ${price} e prazo contratado, sem depender de amountPaid`, async () => {
      const { res, order } = await post(base(slug, { modality }));
      assert.equal(res.statusCode, 200);
      assert.equal(order.serviceId, serviceId);
      assert.equal(order.servicePrice, price);
      assert.equal(order.totalPaid, price);
      assert.equal(order.rushFee, 0);
      const days = Number.parseInt(modality, 10);
      assert.equal(order.deliveryDays, days); // sobrepõe o prazo padrão do serviço (10 dias no Personalizado de teste)
      assert.equal(order.customerDueDate.toDate().getTime() - order.paidAt.toDate().getTime(), days * 86400000);
      assert.equal(order.internalDueDate.toDate().getTime(), order.customerDueDate.toDate().getTime() - 86400000);
      assert.equal(order.source, 'manychat');
    });
  }
}

test('modalidade inválida, ausente ou preço enviado pelo ManyChat: 400 sem criar nada', async () => {
  const cases = [
    base('custom-video'),
    base('custom-video', { modality: '3_days' }),
    base('custom-video', { modality: 7 }),
    base('custom-video', { modality: '__proto__' }),
    base('invite-video', { modality: '' }),
    base('custom-video', { modality: '7_days', amountPaid: 60 }),
    base('invite-video', { modality: '7_days', amountPaid: '65,00' }),
    base('live-call', { modality: '7_days' }),
    base('themed-video', { childName: 'Ana', modality: '7_days' }),
  ];
  for (const body of cases) {
    const { res, database } = await post(body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(database.store.size, 5, 'só o catálogo de teste existe'); // nenhum cliente, índice, pedido ou pagamento
  }
});

test('campos opcionais do Personalizado e do Convite continuam funcionando', async () => {
  const { res, order } = await post(base('custom-video', { modality: '4_days', childName: 'Davi', details: 'Escovar os dentes', eventDate: '2026-11-10' }));
  assert.equal(res.statusCode, 200);
  assert.equal(order.status, 'recording');
  assert.equal(order.productionType, 'recording');
  assert.equal(order.content, 'Aniversariante: Davi\nDetalhes: Escovar os dentes');
  assert.equal(order.eventDate.toDate().toISOString(), '2026-11-10T15:00:00.000Z');
  const invite = await post(base('invite-video', { modality: '2_days' }));
  assert.equal(invite.order.content, 'Pedido recebido via ManyChat.');
  assert.equal(invite.order.eventDate, undefined);
});

// ---------- Chamada ao Vivo ----------

test('Chamada ao Vivo: R$ 75 fixo, sem data de agendamento, registra a data do pagamento', async () => {
  const { res, order } = await post(base('live-call'));
  assert.equal(res.statusCode, 200);
  assert.equal(order.serviceId, '2');
  assert.equal(order.servicePrice, 75);
  assert.equal(order.totalPaid, 75);
  assert.equal(order.status, 'scheduled');
  assert.equal(order.eventDate, undefined);
  assert.ok(Math.abs(order.paidAt.toDate().getTime() - Date.now()) < 5000);
  assert.equal(order.deliveryDays, undefined);

  const withOptional = await post(base('live-call', { childName: 'Lia', details: 'Falar do aniversário' }));
  assert.equal(withOptional.res.statusCode, 200);
  assert.equal(withOptional.order.content, 'Aniversariante: Lia\nDetalhes: Falar do aniversário');
});

test('Chamada ao Vivo não aceita mais eventDate nem amountPaid', async () => {
  for (const extra of [{ eventDate: '2026-11-21' }, { amountPaid: 75 }]) {
    const { res, database } = await post(base('live-call', extra));
    assert.equal(res.statusCode, 400);
    assert.match(res.body.details.join(' '), /Campos não aceitos/);
    assert.equal(database.docs('orders').length, 0);
  }
});

// ---------- Status inicial / configuração do serviço ----------

test('serviços imediatos iniciam em Entregar quando configurados assim; a configuração manda', async () => {
  for (const [slug, id, extra] of [['themed-video', '5', { childName: 'Helena' }], ['birthday-video', '1', { childName: 'Lucas' }]]) {
    const { res, order } = await post(base(slug, extra));
    assert.equal(res.statusCode, 200);
    assert.equal(order.status, 'delivery');
    assert.equal(order.completedAt, undefined);
    assert.equal(order.productionType, 'immediate');
    // Mesmo serviço imediato, configurado como Concluído: o pedido nasce Concluído (nada é imposto no código).
    const done = await post(base(slug, extra), fakeDatabase({ [id]: { initialStatus: 'completed' } }));
    assert.equal(done.order.status, 'completed');
    assert.ok(done.order.completedAt);
  }
  const catalogPrice = await post(base('themed-video', { childName: 'Helena' }));
  assert.equal(catalogPrice.order.servicePrice, 20);
  assert.equal(catalogPrice.order.content, 'Aniversariante: Helena');
});

test('conclusão automática não força o status inicial; só é alternativa quando não há status configurado', async () => {
  const configured = await post(base('themed-video', { childName: 'Ana' }), fakeDatabase({ '5': { initialStatus: 'delivery', autoComplete: true } }));
  assert.equal(configured.order.status, 'delivery');
  const fallback = await post(base('themed-video', { childName: 'Ana' }), fakeDatabase({ '5': { initialStatus: undefined, autoComplete: true } }));
  assert.equal(fallback.order.status, 'completed');
  const none = await post(base('themed-video', { childName: 'Ana' }), fakeDatabase({ '5': { initialStatus: undefined, autoComplete: false } }));
  assert.equal(none.res.statusCode, 422);
});

test('o status inicial de cada serviço segue o que está configurado', async () => {
  for (const status of ['scheduled', 'recording', 'editing', 'delivery', 'completed']) {
    const { order } = await post(base('invite-video', { modality: '7_days' }), fakeDatabase({ '4': { initialStatus: status } }));
    assert.equal(order.status, status);
  }
});

test('o status inicial do CRM manual e o do ManyChat usam a mesma regra', () => {
  for (const service of [
    {}, { initialStatus: 'delivery' }, { initialStatus: 'completed', autoComplete: true }, { autoComplete: true },
    { initialStatus: 'delivery', autoComplete: true }, { initialStatus: 'invalid' }, { initialStatus: 'invalid', autoComplete: true }, null,
  ]) {
    assert.equal(resolveInitialStatus(service), frontendResolveInitialStatus(service), JSON.stringify(service));
  }
});

test('serviço ausente ou mal configurado no CRM retorna 422 sem criar registros', async () => {
  for (const [id, patch, slug, extra] of [
    ['3', null, 'custom-video', { modality: '7_days' }],
    ['3', { active: false }, 'custom-video', { modality: '7_days' }],
    ['3', { generateOrder: false }, 'custom-video', { modality: '7_days' }],
    ['3', { productionType: undefined }, 'custom-video', { modality: '7_days' }],
    ['4', { initialStatus: undefined, autoComplete: false }, 'invite-video', { modality: '7_days' }],
    ['4', { title: 'Outro serviço' }, 'invite-video', { modality: '7_days' }],
    ['2', { active: false }, 'live-call', {}],
    ['5', { price: 'Sob consulta' }, 'themed-video', { childName: 'Ana' }],
  ]) {
    const database = fakeDatabase({ [id]: patch });
    const { res } = await post(base(slug, extra), database);
    assert.equal(res.statusCode, 422, `${slug} ${JSON.stringify(patch)}`);
    assert.equal(database.docs('orders').length, 0);
  }
});

test('preço do catálogo não interfere nos serviços com tabela ou preço fixo', async () => {
  const { res, order } = await post(base('live-call'), fakeDatabase({ '2': { price: 'Sob consulta' }, '3': { price: 'Sob consulta' } }));
  assert.equal(res.statusCode, 200);
  assert.equal(order.servicePrice, 75);
  const custom = await post(base('custom-video', { modality: '7_days' }), fakeDatabase({ '3': { price: 'Sob consulta' } }));
  assert.equal(custom.order.servicePrice, 60);
});

test('prazo padrão do serviço continua valendo onde não há modalidade', async () => {
  const { order } = await post(base('live-call'), fakeDatabase({ '2': { defaultDeliveryDays: 3 } }));
  assert.equal(order.deliveryDays, 3);
});

// ---------- Contrato original do aniversário ----------

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

test('payloads inválidos retornam 400 e não gravam nada', async () => {
  const cases = [
    base('invite-video', { modality: '7_days', eventDate: '2026-02-31' }),
    base('invite-video', { modality: '7_days', serviceId: '1' }),
    base('themed-video', { childName: 'Ana', amountPaid: 1 }),
    base('themed-video'),
    base('unknown-service'),
    base(['custom-video']),
    base('custom-video', { modality: '7_days', customer: { name: 'X', whatsapp: '123' } }),
    { ...base('themed-video', { childName: 'Ana' }), eventType: 'payment.pending' },
  ];
  for (const body of cases) {
    const { res, database } = await post(body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(database.docs('orders').length, 0);
  }
});

// ---------- Sem deduplicação (decisão de negócio) ----------

test('paymentId não faz parte do contrato; repetições criam pedidos separados (duplicatas são removidas manualmente)', async () => {
  const { res: rejected } = await post(base('themed-video', { childName: 'Ana', paymentId: 'abc-123-xyz' }));
  assert.equal(rejected.statusCode, 400);
  assert.match(rejected.body.details.join(' '), /paymentId/);

  const database = fakeDatabase();
  const body = base('invite-video', { modality: '7_days' });
  const first = await post(body, database);
  const second = await post(structuredClone(body), database);
  assert.equal(first.res.statusCode, 200);
  assert.equal(second.res.statusCode, 200);
  assert.deepEqual(Object.keys(first.res.body).sort(), ['ok', 'orderId', 'technicalPurchaseId']);
  assert.notEqual(first.res.body.orderId, second.res.body.orderId);
  assert.equal(database.docs('orders').length, 2);
  assert.equal(database.docs('clients').filter((c) => c.recordType !== 'whatsapp-index').length, 1);
});

test('compras simultâneas do mesmo cliente reaproveitam o cadastro por WhatsApp', async () => {
  const database = fakeDatabase();
  const results = await Promise.all(Array.from({ length: 4 }, () => post(base('live-call'), database)));
  assert.ok(results.every(({ res }) => res.statusCode === 200));
  assert.equal(database.docs('orders').length, 4);
  assert.equal(database.docs('clients').filter((c) => c.recordType !== 'whatsapp-index').length, 1);
});

test('todos os perfis têm serviceId único; tabelas e preços conforme as regras comerciais', () => {
  const ids = Object.values(SERVICE_PROFILES).map((profile) => profile.serviceId);
  assert.equal(new Set(ids).size, ids.length);
  const prices = (slug) => Object.fromEntries(Object.entries(SERVICE_PROFILES[slug].tiers).map(([key, { days, price }]) => [key, [days, price]]));
  assert.deepEqual(prices('custom-video'), { '7_days': [7, 60], '4_days': [4, 75], '2_days': [2, 85] });
  assert.deepEqual(prices('invite-video'), { '7_days': [7, 65], '4_days': [4, 80], '2_days': [2, 95] });
  assert.equal(SERVICE_PROFILES['live-call'].price, 75);
  assert.equal(validateManyChatPayload(null).errors.length, 1);
});
