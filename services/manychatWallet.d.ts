import type { RevenueEntry } from './financeCalculations';

export interface WalletOp { id: string; day: string; phone: string; cost: number; type: string; flow: string }
export interface WalletDayDoc { day: string; phone: string; ops: Record<string, { c: number; t: string; f: string }> }
export interface SpendRow { phone: string; client: { id: string; name: string } | null; total: number; count: number; orders: { id: string; serviceId: string; value: number }[] }
export interface ServiceSpend { serviceId: string; orders: number; revenue: number; spend: number }

export function parseWalletRows(rows: Record<string, string>[]): WalletOp[];
export function phoneKey(phone: string): string;
export function groupByDayPhone(ops: WalletOp[]): Map<string, WalletDayDoc>;
export function expandDocs(docs: WalletDayDoc[]): WalletOp[];
export function spendByMonth(ops: WalletOp[], year: string | number): { monthKey: string; total: number; count: number }[];
export function spendByDay(ops: WalletOp[], monthKey: string): { day: number; total: number; count: number }[];
export function spendByWeek(ops: WalletOp[], monthKey: string): { from: number; to: number; total: number; count: number }[];
export function linkSpend(input: { ops: WalletOp[]; monthKey: string; entries: RevenueEntry[]; clients: { id: string; name: string; whatsappNormalized?: string }[] }): {
  rows: SpendRow[]; services: ServiceSpend[]; spendSold: number; spendNoSale: number;
};

export interface SpendSnapshot {
  total: number; count: number; spendSold: number; spendNoSale: number;
  services: Record<string, { spend: number; revenue: number; orders: number }>;
  clients: Record<string, { total: number; count: number }>;
}
export function changePct(prev: number | null | undefined, cur: number): number | null;
export function snapshotSpend(input: { ops: WalletOp[]; monthKey: string; link: ReturnType<typeof linkSpend> }): SpendSnapshot;
export function importFreshness(lastDay: string | null, monthKey: string, now?: Date): { upToDate: boolean; lastDay: string | null; expected: string };
