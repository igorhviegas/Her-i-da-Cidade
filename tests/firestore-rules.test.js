import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { doc, getDoc, runTransaction, serverTimestamp, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';

const projectId = 'demo-heroi-da-cidade';
const counterPath = 'systemCounters/globalOrderSequence';
let env;

before(async () => {
  const rules = await readFile(new URL('../firestore.rules', import.meta.url), 'utf8');
  env = await initializeTestEnvironment({ projectId, firestore: { rules } });
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'admins/admin-user'), { enabled: true });
  });
});

after(async () => { await env?.cleanup(); });

function orderData(overrides = {}) {
  return {
    clientId: 'client-fake',
    serviceId: 'service-fake',
    status: 'recording',
    content: 'conteúdo fictício',
    servicePrice: 0,
    rushFee: 0,
    totalPaid: 0,
    productionType: 'recording',
    source: 'manual',
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

async function seedNumberedOrder(orderId, number) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'orders', orderId), orderData({
      orderNumber: number,
      orderNumberDisplay: String(number).padStart(4, '0'),
      createdAt: new Date(),
    }));
  });
}

async function seedCounter(lastIssued = 1, lastOrderId = 'seeded-numbered-order') {
  await seedNumberedOrder(lastOrderId, lastIssued);
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), counterPath), {
      lastIssued,
      lastOrderId,
      updatedAt: new Date(),
    });
  });
}

test('admin can create a new schema-valid order without sequence fields or counter', async () => {
  const db = env.authenticatedContext('admin-user').firestore();
  await assertSucceeds(setDoc(doc(db, 'orders/new-unsequenced'), orderData()));
  assert.equal((await getDoc(doc(db, counterPath))).exists(), false);
});

test('legacy numbered creation succeeds only when the matching counter is initialized atomically', async () => {
  const db = env.authenticatedContext('admin-user').firestore();
  const orderRef = doc(db, 'orders/first-numbered-order');
  const counterRef = doc(db, counterPath);
  await assertSucceeds(runTransaction(db, async (transaction) => {
    transaction.set(orderRef, orderData({ orderNumber: 1, orderNumberDisplay: '0001' }));
    transaction.set(counterRef, { lastIssued: 1, lastOrderId: orderRef.id, updatedAt: serverTimestamp() });
  }));
});

test('rejects numbered creation without the counter and rejects inconsistent numbering', async () => {
  const db = env.authenticatedContext('admin-user').firestore();
  await assertFails(setDoc(doc(db, 'orders/number-without-counter'), orderData({ orderNumber: 1, orderNumberDisplay: '0001' })));
  const orderRef = doc(db, 'orders/inconsistent-number');
  const counterRef = doc(db, counterPath);
  await assertFails(runTransaction(db, async (transaction) => {
    transaction.set(orderRef, orderData({ orderNumber: 1, orderNumberDisplay: '0002' }));
    transaction.set(counterRef, { lastIssued: 1, lastOrderId: orderRef.id, updatedAt: serverTimestamp() });
  }));
});

test('existing sequential numbers cannot be changed or removed; operational edits remain allowed', async () => {
  await seedNumberedOrder('immutable-numbered-order', 7);
  const db = env.authenticatedContext('admin-user').firestore();
  const ref = doc(db, 'orders/immutable-numbered-order');
  await assertSucceeds(updateDoc(ref, { status: 'editing' }));
  await assertFails(updateDoc(ref, { orderNumber: 8, orderNumberDisplay: '0008' }));
  await assertFails(updateDoc(ref, { orderNumber: null, orderNumberDisplay: null }));
});

test('historical orders without sequence fields remain editable but cannot acquire a number', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'orders/historical-order'), orderData({ createdAt: new Date() }));
  });
  const db = env.authenticatedContext('admin-user').firestore();
  const ref = doc(db, 'orders/historical-order');
  await assertSucceeds(updateDoc(ref, { status: 'delivery' }));
  await assertFails(updateDoc(ref, { orderNumber: 8, orderNumberDisplay: '0008' }));
});

test('counter is admin-only, increments only with the matching next order, and rejects arbitrary changes', async () => {
  await seedCounter();
  const adminDb = env.authenticatedContext('admin-user').firestore();
  const counterRef = doc(adminDb, counterPath);
  assert.equal((await assertSucceeds(getDoc(counterRef))).exists(), true);
  await assertFails(getDoc(doc(env.authenticatedContext('other-user').firestore(), counterPath)));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), counterPath)));

  const nextOrder = doc(adminDb, 'orders/counter-next-order');
  await assertSucceeds(runTransaction(adminDb, async (transaction) => {
    transaction.set(nextOrder, orderData({ orderNumber: 2, orderNumberDisplay: '0002' }));
    transaction.update(counterRef, { lastIssued: 2, lastOrderId: nextOrder.id, updatedAt: serverTimestamp() });
  }));

  await assertFails(runTransaction(adminDb, async (transaction) => {
    const arbitraryOrder = doc(adminDb, 'orders/counter-arbitrary-jump');
    transaction.set(arbitraryOrder, orderData({ orderNumber: 4, orderNumberDisplay: '0004' }));
    transaction.update(counterRef, { lastIssued: 4, lastOrderId: arbitraryOrder.id, updatedAt: serverTimestamp() });
  }));
  await assertFails(runTransaction(adminDb, async (transaction) => {
    transaction.update(counterRef, { lastIssued: 3, lastOrderId: 'counter-missing-order', updatedAt: serverTimestamp() });
  }));
  await assertFails(runTransaction(adminDb, async (transaction) => {
    const decrementOrder = doc(adminDb, 'orders/counter-decrement-order');
    transaction.set(decrementOrder, orderData({ orderNumber: 1, orderNumberDisplay: '0001' }));
    transaction.update(counterRef, { lastIssued: 1, lastOrderId: decrementOrder.id, updatedAt: serverTimestamp() });
  }));
  await assertFails(runTransaction(adminDb, async (transaction) => {
    const jumpOrder = doc(adminDb, 'orders/counter-second-jump');
    transaction.set(jumpOrder, orderData({ orderNumber: 4, orderNumberDisplay: '0004' }));
    transaction.update(counterRef, { lastIssued: 4, lastOrderId: jumpOrder.id, updatedAt: serverTimestamp() });
  }));
  await assertFails(deleteDoc(counterRef));
});

test('users without admin authorization cannot create or edit orders', async () => {
  const regularDb = env.authenticatedContext('other-user').firestore();
  const anonymousDb = env.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(regularDb, 'orders/unauthorized'), orderData()));
  await assertFails(setDoc(doc(anonymousDb, 'orders/anonymous'), orderData()));
  await assertFails(updateDoc(doc(regularDb, 'orders/historical-order'), { status: 'completed' }));
  await assertFails(getDoc(doc(regularDb, 'orders/historical-order')));
  await assertFails(getDoc(doc(anonymousDb, 'orders/historical-order')));
  await assertFails(updateDoc(doc(anonymousDb, 'orders/historical-order'), { status: 'completed' }));
});

test('finance collections (fixedExpenses, assets) are admin-only and cannot be deleted', async () => {
  const adminDb = env.authenticatedContext('admin-user').firestore();
  const regularDb = env.authenticatedContext('other-user').firestore();
  const anonymousDb = env.unauthenticatedContext().firestore();
  for (const path of ['fixedExpenses/exp-1', 'assets/asset-1']) {
    await assertSucceeds(setDoc(doc(adminDb, path), { name: 'fictício' }));
    await assertSucceeds(getDoc(doc(adminDb, path)));
    await assertSucceeds(updateDoc(doc(adminDb, path), { name: 'editado' }));
    await assertFails(deleteDoc(doc(adminDb, path)));
    await assertFails(getDoc(doc(regularDb, path)));
    await assertFails(getDoc(doc(anonymousDb, path)));
    await assertFails(setDoc(doc(regularDb, path), { name: 'x' }));
  }
});

test('orderImports: admin cria uma vez por PDF; ninguém altera, apaga ou lê sem ser admin', async () => {
  const adminDb = env.authenticatedContext('admin-user').firestore();
  const path = 'orderImports/' + 'a'.repeat(64);
  await assertSucceeds(setDoc(doc(adminDb, path), { orderId: 'o1', createdAt: serverTimestamp() }));
  await assertSucceeds(getDoc(doc(adminDb, path)));
  await assertFails(setDoc(doc(adminDb, path), { orderId: 'o2', createdAt: serverTimestamp() })); // sobrescrever = update
  await assertFails(deleteDoc(doc(adminDb, path)));
  await assertFails(getDoc(doc(env.authenticatedContext('other-user').firestore(), path)));
  await assertFails(setDoc(doc(env.unauthenticatedContext().firestore(), 'orderImports/' + 'b'.repeat(64)), { orderId: 'o3' }));
});

// ---- Livro de lançamentos dos eventos (financeEntries) ----
const ledgerData = (orderId, kind, over = {}) => ({
  orderId, kind, type: kind === 'cost' || kind === 'adjcost' ? 'expense' : 'revenue', amount: 500, date: serverTimestamp(), createdAt: serverTimestamp(), ...over,
});
const ledgerPath = (orderId, kind) => `financeEntries/evt-${orderId}-${kind}`;

test('financeEntries: lançamento nasce junto do pedido, uma única vez, com ID determinístico', async () => {
  const adminDb = env.authenticatedContext('admin-user').firestore();
  await assertSucceeds(runTransaction(adminDb, async (tx) => {
    tx.set(doc(adminDb, 'orders/ev1'), orderData());
    tx.set(doc(adminDb, ledgerPath('ev1', 'entry')), ledgerData('ev1', 'entry'));
  }));
  await assertSucceeds(getDoc(doc(adminDb, ledgerPath('ev1', 'entry'))));
  // mesma chave de novo = sobrescrita (update): negada, então reabrir/concluir de novo/repetir nunca duplica nem altera
  await assertFails(setDoc(doc(adminDb, ledgerPath('ev1', 'entry')), ledgerData('ev1', 'entry', { amount: 999 })));
  await assertFails(updateDoc(doc(adminDb, ledgerPath('ev1', 'entry')), { amount: 1 }));
  // 2ª parcela e despesa na conclusão (pedido já existe)
  await assertSucceeds(setDoc(doc(adminDb, ledgerPath('ev1', 'final')), ledgerData('ev1', 'final')));
  await assertSucceeds(setDoc(doc(adminDb, ledgerPath('ev1', 'cost')), ledgerData('ev1', 'cost', { amount: 150 })));
});

test('financeEntries: ID fora do padrão, tipo incoerente, valor negativo, sem pedido ou sem ser admin são recusados', async () => {
  const adminDb = env.authenticatedContext('admin-user').firestore();
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), 'orders/ev2'), { status: 'recording' }); });
  await assertFails(setDoc(doc(adminDb, 'financeEntries/qualquer-id'), ledgerData('ev2', 'entry')));
  await assertFails(setDoc(doc(adminDb, ledgerPath('ev2', 'entry')), ledgerData('ev2', 'entry', { type: 'expense' })));
  await assertFails(setDoc(doc(adminDb, ledgerPath('ev2', 'entry')), ledgerData('ev2', 'entry', { amount: -1 })));
  await assertFails(setDoc(doc(adminDb, ledgerPath('ev2', 'entry')), ledgerData('ev2', 'entry', { createdAt: new Date(0) })));
  await assertFails(setDoc(doc(adminDb, ledgerPath('sem-pedido', 'entry')), ledgerData('sem-pedido', 'entry')));
  const other = env.authenticatedContext('other-user').firestore();
  await assertFails(setDoc(doc(other, ledgerPath('ev2', 'entry')), ledgerData('ev2', 'entry')));
  await assertSucceeds(setDoc(doc(adminDb, ledgerPath('ev2', 'entry')), ledgerData('ev2', 'entry')));
  await assertFails(getDoc(doc(other, ledgerPath('ev2', 'entry'))));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), ledgerPath('ev2', 'entry'))));
});

test('financeEntries: só pode ser apagado na mesma transação que exclui o pedido de origem', async () => {
  const adminDb = env.authenticatedContext('admin-user').firestore();
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'orders/ev3'), { status: 'completed' });
    await setDoc(doc(context.firestore(), ledgerPath('ev3', 'entry')), { orderId: 'ev3', kind: 'entry', type: 'revenue', amount: 500 });
  });
  await assertFails(deleteDoc(doc(adminDb, ledgerPath('ev3', 'entry')))); // pedido continua existindo
  await assertSucceeds(runTransaction(adminDb, async (tx) => {
    tx.delete(doc(adminDb, 'orders/ev3'));
    tx.delete(doc(adminDb, ledgerPath('ev3', 'entry')));
  }));
});

test('financeEntries: ajustes têm ID com sequência, valor com sinal (nunca zero) e também são imutáveis', async () => {
  const adminDb = env.authenticatedContext('admin-user').firestore();
  await env.withSecurityRulesDisabled(async (context) => { await setDoc(doc(context.firestore(), 'orders/ev4'), { status: 'completed' }); });
  const adj = (kind, seq, over = {}) => ledgerData('ev4', kind, { seq, amount: -200, ...over });
  const path = (kind, seq) => `financeEntries/evt-ev4-${kind}-${seq}`;
  await assertSucceeds(setDoc(doc(adminDb, path('adjrev', 1)), adj('adjrev', 1)));
  await assertSucceeds(setDoc(doc(adminDb, path('adjcost', 1)), adj('adjcost', 1, { amount: 50 })));
  await assertSucceeds(setDoc(doc(adminDb, path('adjrev', 2)), adj('adjrev', 2, { amount: 120 })));
  await assertFails(setDoc(doc(adminDb, path('adjrev', 1)), adj('adjrev', 1, { amount: 999 }))); // mesma chave = sobrescrita
  await assertFails(updateDoc(doc(adminDb, path('adjrev', 1)), { amount: 1 }));
  await assertFails(setDoc(doc(adminDb, path('adjrev', 3)), adj('adjrev', 3, { amount: 0 }))); // ajuste zero
  await assertFails(setDoc(doc(adminDb, path('adjrev', 4)), adj('adjrev', 3))); // ID não bate com a sequência
  await assertFails(setDoc(doc(adminDb, 'financeEntries/evt-ev4-adjrev'), adj('adjrev', 5))); // sem sequência no ID
  const { seq: _omitted, ...withoutSeq } = adj('adjrev', 6);
  await assertFails(setDoc(doc(adminDb, path('adjrev', 6)), withoutSeq)); // ajuste sem seq
  await assertFails(setDoc(doc(adminDb, path('adjrev', 7)), adj('adjrev', 7, { type: 'expense' }))); // tipo incoerente
  await assertFails(setDoc(doc(adminDb, 'financeEntries/evt-ev4-entry'), ledgerData('ev4', 'entry', { amount: -5 }))); // entrada continua >= 0
});

test('admin desativado (active: false) perde leitura e escrita; ativo ou sem o campo continuam valendo', async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'admins/active-admin'), { role: 'admin', active: true });
    await setDoc(doc(adminDb, 'admins/disabled-admin'), { role: 'admin', active: false });
    await setDoc(doc(adminDb, 'orders/deactivation-probe'), { status: 'completed' });
  });
  const disabled = env.authenticatedContext('disabled-admin').firestore();
  const active = env.authenticatedContext('active-admin').firestore();
  const legacy = env.authenticatedContext('admin-user').firestore(); // documento sem o campo active

  await assertFails(getDoc(doc(disabled, 'orders/deactivation-probe')));
  await assertFails(getDoc(doc(disabled, 'admins/disabled-admin'))); // nem o próprio documento
  await assertFails(setDoc(doc(disabled, 'services/s-disabled'), { title: 'x' }));
  await assertSucceeds(getDoc(doc(active, 'orders/deactivation-probe')));
  await assertSucceeds(setDoc(doc(active, 'services/s-active'), { title: 'x' }));
  await assertSucceeds(getDoc(doc(legacy, 'orders/deactivation-probe')));
});
