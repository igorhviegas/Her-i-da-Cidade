export const LEDGER_COLLECTION: string;
export const EVENT_EXPENSE_CATEGORY: string;
export const LEDGER_KINDS: LedgerKind[];
export const LEDGER_LABELS: Record<LedgerKind, string>;
export type LedgerKind = 'entry' | 'final' | 'cost';
export class EventFinanceError extends Error { code: 'incomplete'; constructor(code: 'incomplete', message: string); }
export interface LedgerRecord {
  orderId: string; kind: LedgerKind; type: 'revenue' | 'expense'; amount: number; date: any;
  clientId: string; serviceId: string; childName: string; category?: string;
}
export const ledgerId: (orderId: string, kind: LedgerKind) => string;
export function planEntry(orderId: string, order: any, date: any): LedgerRecord;
export function planCompletion(orderId: string, order: any, booked: { bookedEntry?: number; final?: boolean; cost?: boolean }, date: any): LedgerRecord[];
export function ledgerToOrders(docs: Array<LedgerRecord & { id: string }>): any[];
