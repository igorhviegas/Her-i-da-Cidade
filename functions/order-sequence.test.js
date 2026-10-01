import test from 'node:test';
import assert from 'node:assert/strict';
import { allocateOrderNumber, formatOrderNumber, nextOrderNumber } from './order-sequence.js';

test('increments a fresh or existing sequence', () => {
  assert.deepEqual(nextOrderNumber(0), { orderNumber: 1, orderNumberDisplay: '0001' });
  assert.deepEqual(nextOrderNumber(41), { orderNumber: 42, orderNumberDisplay: '0042' });
});

test('pads display values to four digits and grows without truncation', () => {
  assert.equal(formatOrderNumber(1), '0001');
  assert.equal(formatOrderNumber(9999), '9999');
  assert.equal(formatOrderNumber(10000), '10000');
});

test('rejects invalid counters and order numbers', () => {
  for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1, NaN]) {
    assert.throws(() => nextOrderNumber(value));
  }
  for (const value of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => formatOrderNumber(value));
  }
});

function createMemoryTransactionRunner() {
  let lastIssued = 0;
  let lastOrderId = null;
  let version = 0;
  let commitQueue = Promise.resolve();

  async function runTransaction(callback) {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const observedVersion = version;
      const writes = [];
      const transaction = {
        async get() {
          const snapshotValue = lastIssued;
          return {
            exists: snapshotValue > 0,
            data: () => ({ lastIssued: snapshotValue, lastOrderId }),
            get: (field) => field === 'lastIssued' ? snapshotValue : field === 'lastOrderId' ? lastOrderId : undefined,
          };
        },
        set(_reference, value) { writes.push(value); },
      };
      const result = await callback(transaction);
      let release;
      const previousCommit = commitQueue;
      commitQueue = new Promise((resolve) => { release = resolve; });
      await previousCommit;
      if (observedVersion === version) {
        const counterWrite = writes.at(-1);
        if (!counterWrite) throw new Error('A transação não reservou o contador.');
        lastIssued = counterWrite.lastIssued;
        lastOrderId = counterWrite.lastOrderId;
        version += 1;
        release();
        return result;
      }
      release();
    }
    throw new Error('Transação excedeu o limite de tentativas.');
  }

  return { runTransaction, getLastIssued: () => lastIssued, getLastOrderId: () => lastOrderId };
}

test('concurrent transactions reserve unique sequence numbers', async () => {
  const store = createMemoryTransactionRunner();
  const assigned = await Promise.all(Array.from({ length: 40 }, (_, index) => store.runTransaction(
    (transaction) => allocateOrderNumber(transaction, 'systemCounters/globalOrderSequence', 'timestamp', `order-${index}`),
  )));
  const numbers = assigned.map(({ orderNumber }) => orderNumber).sort((a, b) => a - b);
  assert.deepEqual(numbers, Array.from({ length: 40 }, (_, index) => index + 1));
  assert.equal(store.getLastIssued(), 40);
  assert.match(store.getLastOrderId(), /^order-\d+$/);
});

test('legacy sequence helper records the supplied order ID with the allocated value', async () => {
  const store = createMemoryTransactionRunner();
  const allocated = [];
  for (const [index, _channel] of ['legacy-client', 'legacy-backend', 'legacy-retry'].entries()) {
    allocated.push(await store.runTransaction((transaction) =>
      allocateOrderNumber(transaction, 'systemCounters/globalOrderSequence', 'timestamp', `order-${allocated.length}`)));
    assert.equal(store.getLastOrderId(), `order-${index}`);
  }
  assert.deepEqual(allocated.map(({ orderNumberDisplay }) => orderNumberDisplay), ['0001', '0002', '0003']);
});

test('a rejected operation before allocation does not consume a number', async () => {
  const store = createMemoryTransactionRunner();
  await assert.rejects(store.runTransaction(async () => {
    throw new Error('validation failed');
  }), /validation failed/);
  assert.equal(store.getLastIssued(), 0);
  const allocation = await store.runTransaction((transaction) =>
    allocateOrderNumber(transaction, 'systemCounters/globalOrderSequence', 'timestamp', 'order-1'));
  assert.equal(allocation.orderNumber, 1);
});
