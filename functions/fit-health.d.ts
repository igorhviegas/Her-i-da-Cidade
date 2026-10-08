export interface FitDailyFields { steps?: number; walkRunKm?: number; cyclingKm?: number; activeKcal?: number; basalKcal?: number; exerciseMin?: number; weightKg?: number; }
export interface DailyPushResult { days: Record<string, FitDailyFields>; stats: { accepted: number; ignoredFields: number; invalid: number } }
export const FIT_DAILY_SOURCE: 'atalho-ios';
export function parseDailyPush(body: unknown): DailyPushResult | null;
export function writeFitDaily(database: unknown, uid: string, days: Record<string, FitDailyFields>, now?: Date): Promise<number>;
export function describeInvalidPayload(body: unknown): { message: string; received: string | Record<string, string>; dayShape?: string };
