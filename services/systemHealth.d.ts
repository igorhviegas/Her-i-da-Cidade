export type HealthLevel = 'ok' | 'warn' | 'error' | 'unknown';
export interface HealthRow { id: string; label: string; level: HealthLevel; detail: string }
export interface SystemStatusDoc { job?: string; ok?: boolean; lastRunAt?: string; lastOkAt?: string; detail?: string | null; latestAt?: string | null; count?: number }
export function agoLabel(ms: number): string;
export function buildHealth(input: {
  status?: { missions?: SystemStatusDoc; backup?: SystemStatusDoc };
  instagram?: { syncedAt?: string; lastError?: { code: string } | null; tokenExpiresAt?: string | null } | null;
  reviewsOk?: boolean | null;
  now?: number;
}): { rows: HealthRow[]; overall: HealthLevel };
