export interface VideoCallConfig { profile: string; durationMinutes: number; minNoticeHours: number; maxAdvanceDays: number; weekly: Record<number, string[]> }
export const VIDEO_CALL_CONFIG: VideoCallConfig;
export const SLOTS: string;
export const PENDING: string;
export class VideoCallError extends Error { code: string; constructor(code: string, message: string) }
export function slotId(date: string, time: string): string;
export function candidateSlots(nowMs: number, config?: VideoCallConfig): { date: string; time: string }[];
export function hasCalendarConflict(events: any[], date: string, time: string, minutes?: number): boolean;
export function getAvailability(opts: { database: any; nowMs?: number; config?: VideoCallConfig; listEvents?: (o: any) => Promise<{ events: any[] }>; ctx?: any }): Promise<{ days: { date: string; times: string[] }[] }>;
export function validateBookingInput(input: any): { form?: any; errors?: string[] };
export function createVideoCallBooking(opts: { database: any; input: any; nowMs?: number; config?: VideoCallConfig; listEvents?: any; createEvent?: any; ctx?: any; logger?: any }): Promise<{ orderId: string; date: string; time: string; whatsappUrl: string | null }>;
