import type { RevenueEntry } from './financeCalculations.js';
import type { FitDailyRow } from './fitDaily.js';
import type { Checkin } from './fitCheckin.js';
import type { DailySummary } from './instagramDaily.js';
import type { InstagramPost } from './instagramMetrics.js';
import type { PeriodRange } from './reports.js';

export function isMonthKey(value: unknown): value is string;
export function defaultReportMonth(now?: Date): string;
export function monthRange(monthKey: string): PeriodRange;
export function clientsInMonth(entries: RevenueEntry[], range: PeriodRange): { served: number; newClients: number; returning: number };

export interface InstagramMonth {
  daysWithData: number; followersGain: number | null; likesGain: number | null; viewsGain: number | null;
  posts: number; postLikes: number; postComments: number; top: InstagramPost | null;
}
export function instagramMonth(posts: InstagramPost[], days: DailySummary[], monthKey: string): InstagramMonth;

export interface FitMonth {
  daysWithData: number; avgSteps: number | null; totalKm: number | null; weight: { day: string; value: number; change: number | null } | null;
  gym: number; functional: number; rides: { count: number; km: number; movingSec: number; avgSpeedKmh: number | null }; hasData: boolean;
}
export function fitMonth(input: { daily?: FitDailyRow[]; weights?: { day: string; kg: number }[]; checkins?: Checkin[]; rides?: { startedAt: Date; distanceKm: number; movingSec: number }[] }, monthKey: string): FitMonth;
