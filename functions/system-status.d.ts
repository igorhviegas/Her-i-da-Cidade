export const STATUS_COLLECTION: string;
export interface RunInfo { ok: boolean; detail?: string | null; extra?: Record<string, unknown>; now?: Date }
export function recordRun(getDb: unknown, job: string, info: RunInfo): Promise<void>;
export class StatusCheckError extends Error { code: 'permission' | 'unavailable'; constructor(code: 'permission' | 'unavailable'); }
export function latestBackup(body: unknown): { latestAt: string; count: number } | null;
export function checkBackups(opts: { getToken: () => Promise<{ token: string; projectId: string }>; fetchImpl?: typeof fetch }): Promise<{ latestAt: string | null; count: number }>;
