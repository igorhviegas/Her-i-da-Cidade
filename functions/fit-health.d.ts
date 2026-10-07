export interface FitDailyFields { steps?: number; walkRunKm?: number; cyclingKm?: number; activeKcal?: number; basalKcal?: number; exerciseMin?: number; weightKg?: number; }
export interface HealthExportResult { days: Record<string, FitDailyFields>; stats: { accepted: number; ignoredMetrics: number; invalid: number }; workouts: number; }
export const FIT_DAILY_SOURCE: 'health-auto-export';
export function parseHealthExport(body: unknown): HealthExportResult | null;
export function writeFitDaily(database: any, uid: string, days: Record<string, FitDailyFields>, now?: Date): Promise<number>;
export function describeInvalidPayload(body: unknown): { message: string; received: string | Record<string, string>; dayShape?: string };
