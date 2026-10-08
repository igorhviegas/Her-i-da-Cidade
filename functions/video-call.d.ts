import type { VideoCallConfig } from './video-call-config.js';

export type { VideoCallConfig };
export interface PublicVideoCallConfig { price: number; priceLabel: string; durationMinutes: number; paymentDeadlineHours: number; texts: { info: string; confirm: string; security: string } }
export const VIDEO_CALL_CONFIG: VideoCallConfig;
export const SLOTS: string;
export const PENDING: string;
export class VideoCallError extends Error { code: string; constructor(code: string, message: string) }
export function loadVideoCallConfig(database: unknown): Promise<VideoCallConfig>;
export function publicConfig(config: VideoCallConfig): PublicVideoCallConfig;
export function slotId(date: string, time: string): string;
export function candidateSlots(nowMs: number, config?: VideoCallConfig): { date: string; time: string }[];
export function hasCalendarConflict(events: unknown[], date: string, time: string, minutes?: number): boolean;
export function getAvailability(opts: { database: unknown; nowMs?: number; config?: VideoCallConfig; listEvents?: (o: unknown) => Promise<{ events: unknown[] }>; ctx?: unknown }): Promise<{ days: { date: string; times: string[] }[]; config: VideoCallConfig }>;
export function normalizePhone(ddi: unknown, number: unknown): { e164: string; ddi: string; phone: string } | null;
export function validateBookingInput(input: unknown): { form?: unknown; errors?: string[] };
export function bookingWhatsAppUrl(baseUrl: unknown, message: string): string | null;
export function createVideoCallBooking(opts: { database: unknown; input: unknown; nowMs?: number; config?: VideoCallConfig; listEvents?: unknown; createEvent?: unknown; ctx?: unknown; logger?: unknown }): Promise<{ orderId: string; date: string; time: string; whatsappUrl: string | null }>;
export function markVideoCallEventPaid(opts: { database: unknown; orderId: string; updateEvent?: unknown; ctx?: unknown }): Promise<boolean>;
export function expireUnpaidBookings(opts: { database: unknown; nowMs?: number; config?: VideoCallConfig; deleteEvent?: unknown; ctx?: unknown; logger?: unknown }): Promise<number>;
