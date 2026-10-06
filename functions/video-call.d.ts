import type { VideoCallConfig } from './video-call-config.js';

export type { VideoCallConfig };
export interface PublicVideoCallConfig { price: number; priceLabel: string; durationMinutes: number; paymentDeadlineHours: number; texts: { info: string; confirm: string; security: string } }
export const VIDEO_CALL_CONFIG: VideoCallConfig;
export const SLOTS: string;
export const PENDING: string;
export class VideoCallError extends Error { code: string; constructor(code: string, message: string) }
export function loadVideoCallConfig(database: any): Promise<VideoCallConfig>;
export function publicConfig(config: VideoCallConfig): PublicVideoCallConfig;
export function slotId(date: string, time: string): string;
export function candidateSlots(nowMs: number, config?: VideoCallConfig): { date: string; time: string }[];
export function hasCalendarConflict(events: any[], date: string, time: string, minutes?: number): boolean;
export function getAvailability(opts: { database: any; nowMs?: number; config?: VideoCallConfig; listEvents?: (o: any) => Promise<{ events: any[] }>; ctx?: any }): Promise<{ days: { date: string; times: string[] }[]; config: VideoCallConfig }>;
export function normalizePhone(ddi: unknown, number: unknown): { e164: string; ddi: string; phone: string } | null;
export function validateBookingInput(input: any): { form?: any; errors?: string[] };
export function bookingWhatsAppUrl(baseUrl: unknown, message: string): string | null;
export function createVideoCallBooking(opts: { database: any; input: any; nowMs?: number; config?: VideoCallConfig; listEvents?: any; createEvent?: any; ctx?: any; logger?: any }): Promise<{ orderId: string; date: string; time: string; whatsappUrl: string | null }>;
export function markVideoCallEventPaid(opts: { database: any; orderId: string; updateEvent?: any; addGuest?: any; ctx?: any }): Promise<boolean>;
export function expireUnpaidBookings(opts: { database: any; nowMs?: number; config?: VideoCallConfig; deleteEvent?: any; ctx?: any; logger?: any }): Promise<number>;
