import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('./ordersService.ts', import.meta.url), 'utf8');
const manualCreation = source.slice(source.indexOf('export async function createOrder'), source.indexOf('/** Cria uma única produção interna'));
const scriptCreation = source.slice(source.indexOf('export async function createRecordingOrderFromScript'), source.indexOf('export async function getOrderById'));

test('manual creation uses a generated Firestore document ID and does not read the sequence counter', () => {
  assert.match(manualCreation, /doc\(collection\(db, ORDERS_COLLECTION\)\)/);
  assert.match(manualCreation, /await setDoc\(reference/);
  assert.match(manualCreation, /id: reference\.id/);
  assert.doesNotMatch(manualCreation, /allocateOrderNumber|ORDER_COUNTER|runTransaction/);
});

test('script production keeps its atomic order-script transaction without sequence allocation', () => {
  assert.match(scriptCreation, /orderRef = doc\(collection\(firestore, ORDERS_COLLECTION\)\)/);
  assert.match(scriptCreation, /runTransaction\(firestore/);
  assert.match(scriptCreation, /transaction\.set\(orderRef/);
  assert.match(scriptCreation, /transaction\.update\(scriptRef/);
  assert.match(scriptCreation, /orderId: orderRef\.id/);
  assert.doesNotMatch(scriptCreation, /allocateOrderNumber|ORDER_COUNTER/);
});

const financeSource = await readFile(new URL('./financeService.ts', import.meta.url), 'utf8');
test('financeiro usa um único listener compartilhado de pedidos concluídos (tempo real)', () => {
  assert.match(financeSource, /onSnapshot\(\s*query\(collection\(firestore, "orders"\), where\("status", "==", "completed"\)\)/);
  assert.match(financeSource, /collection\(firestore, LEDGER_COLLECTION\)/); // livro de lançamentos de eventos no mesmo listener compartilhado
  assert.match(financeSource, /listeners\.size === 0/);
});
