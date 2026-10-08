export const ORDER_COUNTER_COLLECTION: 'systemCounters';
export const ORDER_COUNTER_DOCUMENT_ID: 'globalOrderSequence';
export interface OrderNumberAllocation {
  orderNumber: number;
  orderNumberDisplay: string;
}
export interface OrderNumberTransaction {
  get(reference: unknown): Promise<unknown>;
  set(reference: unknown, value: unknown): unknown;
}
export function nextOrderNumber(lastIssued: number): OrderNumberAllocation;
export function formatOrderNumber(orderNumber: number): string;
export function allocateOrderNumber(
  transaction: OrderNumberTransaction,
  counterRef: unknown,
  updatedAt: unknown,
  orderId: string,
): Promise<OrderNumberAllocation>;
