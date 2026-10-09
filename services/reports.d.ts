import type { RevenueEntry } from './financeCalculations.js';

export type Granularity = 'day' | 'week' | 'month';
export const GRANULARITIES: Granularity[];
export interface PeriodRange { start: Date; end: Date }
export function periodRange(granularity: Granularity, anchor: Date): PeriodRange;
export function shiftPeriod(granularity: Granularity, anchor: Date, delta: number): Date;

export interface PeriodTotals { revenue: number; count: number; ticket: number | null; editingCost: number; eventCost: number; variableCost: number; result: number }
export function periodTotals(entries: RevenueEntry[], costs: RevenueEntry[], range: PeriodRange): PeriodTotals;
export function dailyBreakdown(entries: RevenueEntry[], range: PeriodRange): { date: Date; revenue: number; count: number }[];
export interface ServiceBreakdownRow { serviceId: string; count: number; revenue: number; share: number }
export function serviceBreakdown(entries: RevenueEntry[], range: PeriodRange): ServiceBreakdownRow[];
export function periodEntries(entries: RevenueEntry[], range: PeriodRange): RevenueEntry[];

export interface SeasonMonth { month: number; avgRevenue: number | null; avgOrders: number | null; samples: number; index: number | null; level: 'strong' | 'medium' | 'weak' | null }
export interface Seasonality { months: SeasonMonth[]; matrix: { year: number; months: (number | null)[] }[]; monthsAnalyzed: number }
export function seasonality(entries: RevenueEntry[], now?: Date): Seasonality;

export interface ClientRetentionRow { clientId: string; orders: number; revenue: number; firstDate: Date; lastDate: Date; dates: Date[] }
export interface ClientRetention {
  clients: number; returning: number; returnRate: number | null; avgLtv: number | null; avgOrders: number | null; medianGapDays: number | null;
  top: ClientRetentionRow[]; winback: ClientRetentionRow[];
}
export function clientRetention(entries: RevenueEntry[], now?: Date): ClientRetention;
