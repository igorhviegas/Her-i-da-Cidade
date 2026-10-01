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
