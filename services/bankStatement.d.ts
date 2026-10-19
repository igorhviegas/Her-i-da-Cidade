export interface BankTransaction {
  id: string; date: string; monthKey: string; amount: number; kind: 'in' | 'out';
  title: string; description: string; balance: number | null; source: 'csv' | 'ofx'; category: string | null;
}
export interface CategoryTotal { category: string; total: number }
export interface BankTotals { totalIn: number; totalOut: number; balance: number; count: number; uncategorized: number; byCategory: { in: CategoryTotal[]; out: CategoryTotal[] } }
export const IN_CATEGORIES: string[];
export const OUT_CATEGORIES: string[];
export const UNCATEGORIZED: string;
export function parseMoney(raw: unknown): number | null;
export function parseCsvRows(rows: string[][]): BankTransaction[];
export function parseOfx(text: string): BankTransaction[];
export function parseStatement(text: string, csvRows: string[][]): BankTransaction[];
export function categoryKey(t: Pick<BankTransaction, 'kind' | 'title' | 'description'>): string;
export function ruleId(key: string): string;
export function planImport(items: BankTransaction[], existingIds: Set<string>, rules: Map<string, string>): { toWrite: BankTransaction[]; skipped: number; auto: number };
export function bankTotals(items: BankTransaction[]): BankTotals;
export interface BankCategorySettings { in: string[]; out: string[]; hidden: string[] }
export const DEFAULT_CATEGORY_SETTINGS: BankCategorySettings;
export function visibleItems(items: BankTransaction[], hidden?: string[], category?: string | null): BankTransaction[];
export function replaceCategory(list: string[], old: string, next: string | null): string[];
export type BankPeriodId = 'month' | 'year' | '12m' | 'all';
export interface BankRange { from: string; to: string; unit: 'day' | 'month' | 'year' }
export function bankPeriod(period: BankPeriodId, monthKey: string, now?: Date, items?: Pick<BankTransaction, 'date'>[]): BankRange;
export function bankSeries(items: BankTransaction[], range: BankRange): { key: string; in: number; out: number; count: number }[];
