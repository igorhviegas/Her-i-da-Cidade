import { randomUUID } from 'node:crypto';

/** Backend-generated request identity; it is not a payment deduplication key. */
export function createTechnicalPurchaseId() {
  return randomUUID();
}
