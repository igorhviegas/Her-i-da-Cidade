export const ACTIVITY_LOG_COLLECTION: 'activityLog';
export const GAMIFICATION_CONFIG_PATH: ['siteConfig', 'gamification'];
export function activityLogId(type: string, refId: string): string;
export interface ActivityRecord { type: string; refId: string; difficulty: number | null; difficultyKey: string | null; occurredAt: Date; meta?: Record<string, unknown>; }
export function prepareActivityLog(
  tx: { get(reference: unknown): Promise<unknown> },
  refs: { logRef: unknown; configRef?: unknown },
  spec: { type: string; refId: string; occurredAt: Date; difficulty?: number | null; difficultyKey?: string | null; meta?: Record<string, unknown> },
): Promise<ActivityRecord | null>;
