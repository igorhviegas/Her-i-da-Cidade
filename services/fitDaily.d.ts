export interface FitDailyRow { day: string; steps?: number; walkRunKm?: number; cyclingKm?: number; activeKcal?: number; basalKcal?: number; exerciseMin?: number; weightKg?: number; updatedAt?: Date }
export interface FitDay { day: string; row: FitDailyRow | null }
export interface FitSummary {
  latestSteps: { day: string; value: number } | null;
  avgSteps: number | null;
  totalKm: number | null;
  daysWithData: number;
  weight: { day: string; value: number; change: number | null } | null;
}
export function dayKey(date: Date): string;
export function lastDays(rows: FitDailyRow[], endDay: string, count: number): FitDay[];
export function series(days: FitDay[], field: keyof Omit<FitDailyRow, 'day' | 'updatedAt'>): (number | null)[];
export function average(values: (number | null)[]): number | null;
export function movingAverage(values: (number | null)[], window?: number): (number | null)[];
export function summarize(days: FitDay[]): FitSummary;
