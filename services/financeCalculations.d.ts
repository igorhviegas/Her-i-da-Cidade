export interface RevenueEntry { orderId: string; order: any; revenueDate: Date; value: number; monthKey: string; dayKey: string; }
export interface DayRevenue { day: number; total: number; count: number; entries: RevenueEntry[]; }
export interface FixedExpense {
  id: string; name: string; category: string; description?: string; startMonth: string; active: boolean;
  deactivatedFrom?: string; amountHistory: Record<string, number>; adjustments?: Record<string, number>;
}
export interface Asset {
  id: string; name: string; category: string; acquisitionDate: unknown; acquisitionValue: number; currentValue: number;
  description?: string; status: 'active' | 'sold' | 'discarded'; statusChangedAt?: unknown;
  valueHistory?: { at: string; value: number }[];
}
export function toDate(value: unknown): Date | null;
export function monthKeyOf(date: Date): string;
export function dayKeyOf(date: Date): string;
export function daysInMonth(monthKey: string): number;
export function shiftMonth(monthKey: string, delta: number): string;
export function orderValue(order: { totalPaid?: number; servicePrice?: number; rushFee?: number }): number;
export function buildRevenueEntries(orders: unknown[]): { entries: RevenueEntry[]; undated: number; costs: RevenueEntry[] };
export function eventCostForMonth(costs: RevenueEntry[], monthKey: string): { items: RevenueEntry[]; total: number };
export function monthTotals(entries: RevenueEntry[], monthKey: string): { total: number; count: number };
export function revenueSeries(entries: RevenueEntry[], endMonthKey: string, n?: number): { monthKey: string; total: number; count: number }[];
export function dailyRevenue(entries: RevenueEntry[], monthKey: string): DayRevenue[];
export function topDay(days: DayRevenue[]): DayRevenue | null;
export function variationPct(current: number, previous: number): number | null;
export const EDITING_COST: number;
export const CUSTOM_VIDEO_SERVICE_ID: string;
export function editingCostFields(serviceId: string | undefined, existingOrder?: { editingCost?: number } | null): { editingCost?: number };
export function editingCostForMonth(entries: RevenueEntry[], monthKey: string): { items: RevenueEntry[]; total: number };
export function isExpenseInMonth(expense: Partial<FixedExpense>, monthKey: string): boolean;
export function expenseAmountForMonth(expense: Partial<FixedExpense>, monthKey: string): number;
export function expensesForMonth(expenses: FixedExpense[], monthKey: string): { items: { expense: FixedExpense; amount: number; adjusted: boolean }[]; total: number };
export function currentDefaultAmount(expense: Partial<FixedExpense>): number;
export function patrimonySummary(assets: Asset[]): { activeCount: number; currentTotal: number; acquisitionTotal: number };
export function financeMetrics(entries: RevenueEntry[], expenses: FixedExpense[], monthKey: string, monthlyGoal?: number | null): {
  recordMonth: { monthKey: string; total: number } | null; cumulative: number; evolutionPct: number | null;
  goalStreak: number; operatingMarginPct: number | null; servicesCount: number;
};
export interface StatementRow { id: string; kind: 'in' | 'out'; source: 'order' | 'editing' | 'eventCost' | 'expense'; date: Date; amount: number; entry?: RevenueEntry; expense?: FixedExpense }
export function buildStatement(entries: RevenueEntry[], expenses: FixedExpense[], monthKey: string, costs?: RevenueEntry[]): { rows: StatementRow[]; totalIn: number; totalOut: number; balance: number };
export type RankingPeriod = 'all' | '30d' | '7d' | 'month';
export interface ServiceRankingRow { serviceId: string; count: number; revenue: number }
export const RANKING_PERIODS: RankingPeriod[];
export function entryInPeriod(entry: { revenueDate: Date; monthKey: string }, period: RankingPeriod, now?: Date): boolean;
export function serviceRanking(entries: RevenueEntry[], period: RankingPeriod, by?: 'count' | 'revenue', now?: Date): ServiceRankingRow[];
