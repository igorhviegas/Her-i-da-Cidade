export const ORDER_COUNTER_COLLECTION = 'systemCounters';
export const ORDER_COUNTER_DOCUMENT_ID = 'globalOrderSequence';

export function nextOrderNumber(lastIssued) {
  if (!Number.isSafeInteger(lastIssued) || lastIssued < 0 || lastIssued >= Number.MAX_SAFE_INTEGER) {
    throw new Error('O contador sequencial está inválido.');
  }
  const orderNumber = lastIssued + 1;
  return { orderNumber, orderNumberDisplay: formatOrderNumber(orderNumber) };
}

export function formatOrderNumber(orderNumber) {
  if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) {
    throw new Error('O número sequencial do pedido está inválido.');
  }
  return String(orderNumber).padStart(4, '0');
}

/**
 * Reads and advances the one CRM-wide counter inside the caller's transaction.
 * Both Firebase Web and Admin snapshots are supported here.
 */
export async function allocateOrderNumber(transaction, counterRef, updatedAt, orderId) {
  if (typeof orderId !== 'string' || !orderId.trim() || orderId.includes('/')) {
    throw new Error('É necessário informar um ID válido para o pedido ao reservar a numeração.');
  }
  const snapshot = await transaction.get(counterRef);
  const exists = typeof snapshot.exists === 'function' ? snapshot.exists() : snapshot.exists;
  const lastIssued = exists
    ? (typeof snapshot.get === 'function' ? snapshot.get('lastIssued') : snapshot.data()?.lastIssued)
    : 0;
  const allocation = nextOrderNumber(lastIssued);
  transaction.set(counterRef, { lastIssued: allocation.orderNumber, lastOrderId: orderId, updatedAt });
  return allocation;
}
