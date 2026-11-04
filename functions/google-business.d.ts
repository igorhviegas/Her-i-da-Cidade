export const PROFILE_PATH: string;
export const DAILY_PATH: string;
export const REVIEWS_COLLECTION: string;
export const MANUAL_COOLDOWN_MS: number;
export class GoogleSyncError extends Error {
  code: string;
  meta: Record<string, unknown>;
  constructor(code: string, meta?: Record<string, unknown>);
}
export interface NormalizedReview { id: string; reviewer: string; rating: number; comment: string; createdAt: string | null; updatedAt: string | null; replied: boolean; reply: string | null; repliedAt: string | null }
export interface DailyMetric { date: string; impressions: number; calls: number; website: number; directions: number }
export function normalizeReview(raw: unknown): NormalizedReview | null;
export function mergeDailyMetrics(body: unknown): DailyMetric[];
export function runGoogleSync(args: { db: any; fetchImpl?: typeof fetch; env?: Record<string, string | undefined>; now?: number; manual?: boolean }): Promise<{ status: 'completed' | 'cooldown'; afterFailure?: boolean; reviews?: number; metrics?: number; metricsError?: string | null }>;
