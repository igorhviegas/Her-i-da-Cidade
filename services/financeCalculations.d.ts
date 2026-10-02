export interface RevenueEntry { orderId: string; order: any; eventDate: Date; value: number; monthKey: string; dayKey: string; }
export interface DayRevenue { day: number; total: number; count: number; entries: RevenueEntry[]; }
export interface FixedExpense {
  id: string; name: string; category: string; description?: string; startMonth: string; active: boolean;
  deactivatedFrom?: string; amountHistory: Record<string, number>; adjustments?: Record<string, number>;
}
export interface Asset {
  id: string; name: string; category: string; acquisitionDate: any; acquisitionValue: number; currentValue: number;
  description?: string; status: 'active' | 'sold' | 'discarded'; statusChangedAt?: any;
  valueHistory?: { at: string; value: number }[];
}
export function toDate(value: unknown): Date | null;
export function monthKeyOf(date: Date): string;
export function dayKeyOf(date: Date): string;
export function daysInMonth(monthKey: string): number;
export function shiftMonth(monthKey: string, delta: number): string;
export function orderValue(order: { totalPaid?: number; servicePrice?: number; rushFee?: number }): number;
export function buildRevenueEntries(orders: any[]): { entries: RevenueEntry[]; withoutEventDate: number };
export function monthTotals(entries: RevenueEntry[], monthKey: string): { total: number; count: number };
export function revenueSeries(entries: RevenueEntry[], endMonthKey: string, n?: number): { monthKey: string; total: number; count: number }[];
export function dailyRevenue(entries: RevenueEntry[], monthKey: string): DayRevenue[];
export function topDay(days: DayRevenue[]): DayRevenue | null;
export function variationPct(current: number, previous: number): number | null;
export function isExpenseInMonth(expense: Partial<FixedExpense>, monthKey: string): boolean;
export function expenseAmountForMonth(expense: Partial<FixedExpense>, monthKey: string): number;
export function expensesForMonth(expenses: FixedExpense[], monthKey: string): { items: { expense: FixedExpense; amount: number; adjusted: boolean }[]; total: number };
export function currentDefaultAmount(expense: Partial<FixedExpense>): number;
export function patrimonySummary(assets: Asset[]): { activeCount: number; currentTotal: number; acquisitionTotal: number };
export function financeMetrics(entries: RevenueEntry[], expenses: FixedExpense[], monthKey: string, monthlyGoal?: number | null): {
  recordMonth: { monthKey: string; total: number } | null; cumulative: number; evolutionPct: number | null;
  goalStreak: number; operatingMarginPct: number | null; servicesCount: number;
};
