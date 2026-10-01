export const ORDER_COUNTER_COLLECTION: 'systemCounters';
export const ORDER_COUNTER_DOCUMENT_ID: 'globalOrderSequence';
export interface OrderNumberAllocation {
  orderNumber: number;
  orderNumberDisplay: string;
}
export interface OrderNumberTransaction {
  get(reference: any): Promise<any>;
  set(reference: any, value: any): any;
}
export function nextOrderNumber(lastIssued: number): OrderNumberAllocation;
export function formatOrderNumber(orderNumber: number): string;
export function allocateOrderNumber(
  transaction: OrderNumberTransaction,
  counterRef: any,
  updatedAt: any,
  orderId: string,
): Promise<OrderNumberAllocation>;
