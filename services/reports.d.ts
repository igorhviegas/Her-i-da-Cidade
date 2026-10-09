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

export type Preset = 'month' | '90d' | 'year' | 'all';
export const PRESETS: Preset[];
export function presetRange(preset: Preset, now?: Date): PeriodRange;

export interface ServiceProfitRow { serviceId: string; count: number; revenue: number; cost: number; margin: number; marginPct: number | null; marginPerOrder: number | null }
export function serviceProfitability(entries: RevenueEntry[], costs: RevenueEntry[], range: PeriodRange): ServiceProfitRow[];
export interface EventProfitRow { orderId: string; serviceId?: string; clientId?: string; childName?: string; revenue: number; cost: number; date: Date; margin: number; marginPct: number | null }
export function eventProfitability(entries: RevenueEntry[], costs: RevenueEntry[], range: PeriodRange): { rows: EventProfitRow[]; totals: { count: number; revenue: number; cost: number; margin: number; marginPct: number | null } };

export interface LateDelivery { order: any; lateDays: number; leadDays: number | null }
export function deliveryPerformance(orders: any[], range: PeriodRange): {
  delivered: number; onTime: number; onTimeRate: number | null; avgLateDays: number | null; avgLeadDays: number | null; late: LateDelivery[];
};
export const ACTIVE_STAGES: string[];
export function activeHealth(active: any[], now?: Date): { total: number; byStatus: Record<string, number>; overdue: { order: any; lateDays: number }[]; dueSoon: number };
