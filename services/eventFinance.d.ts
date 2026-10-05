export const LEDGER_COLLECTION: string;
export const EVENT_EXPENSE_CATEGORY: string;
export const LEDGER_KINDS: LedgerKind[];
export function ledgerIdsFor(orderId: string, eventLedger?: { seq?: number } | null): string[];
export const LEDGER_LABELS: Record<LedgerKind, string>;
export type LedgerKind = 'entry' | 'final' | 'cost' | 'adjrev' | 'adjcost';
export interface EventLedger { entry: number; final?: number; cost?: number; adj?: number; adjCost?: number; seq?: number }
export class EventFinanceError extends Error { code: 'incomplete'; constructor(code: 'incomplete', message: string); }
export interface LedgerRecord {
  orderId: string; kind: LedgerKind; type: 'revenue' | 'expense'; amount: number; date: any;
  clientId: string; serviceId: string; childName: string; category?: string; seq?: number;
}
export const ledgerId: (orderId: string, kind: LedgerKind, seq?: number) => string;
export function planEntry(orderId: string, order: any, date: any): LedgerRecord;
export function planCompletion(orderId: string, order: any, booked: { bookedRevenue?: number; final?: boolean; cost?: boolean }, date: any): LedgerRecord[];
export function planAdjustments(orderId: string, order: any, form: { totalValue?: number; entryValue?: number; cost?: number | null }, date: any): { records: LedgerRecord[]; next: EventLedger | undefined };
export function ledgerToOrders(docs: Array<LedgerRecord & { id: string }>): any[];
