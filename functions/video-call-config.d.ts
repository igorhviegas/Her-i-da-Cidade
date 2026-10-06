export interface VideoCallConfig {
  profile: string; price: number; durationMinutes: number; minNoticeHours: number; maxAdvanceDays: number; paymentDeadlineHours: number; expireAfterHours: number;
  weekly: Record<number, string[]>; busyCalendarIds: string[];
  texts: { info: string; confirm: string; whatsapp: string };
}
export const VIDEO_CALL_CONFIG_PATH: [string, string];
export const DEFAULT_VIDEO_CALL_CONFIG: VideoCallConfig;
export function parseTimes(value: unknown): string[];
export function normalizeVideoCallConfig(raw: unknown): VideoCallConfig;
export function formatPrice(value: number): string;
export function fillText(template: string, config: VideoCallConfig, slot?: { date?: string; time?: string }): string;
