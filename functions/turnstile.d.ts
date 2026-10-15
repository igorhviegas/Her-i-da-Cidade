export function clientIp(headers?: Record<string, string | string[] | undefined>): string;
export type TurnstileResult =
  | { ok: true; skipped?: true; unavailable?: true }
  | { ok: false; reason: 'missing_token' | 'invalid'; codes?: string[] };
export function verifyTurnstile(opts: { token: unknown; secret?: string; ip?: string; fetchImpl?: typeof fetch }): Promise<TurnstileResult>;
