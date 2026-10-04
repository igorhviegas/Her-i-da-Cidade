export class InstagramSyncError extends Error { code: string; meta: { status?: number; metaCode?: number } }
export const MANUAL_COOLDOWN_MS: number;
export const LOCK_TTL_MS: number;
export const PROFILE_PATH: string;
export const LOCK_PATH: string;
export const DAILY_PATH: string;
export const POSTS_COLLECTION: string;
export type SyncResult =
  | { status: 'completed'; posts: number; warning: string | null }
  | { status: 'running' }
  | { status: 'cooldown'; afterFailure: boolean };
export function runInstagramSync(opts: { db: any; fetchImpl?: typeof fetch; env?: Record<string, string | undefined>; now?: number; manual?: boolean }): Promise<SyncResult>;
