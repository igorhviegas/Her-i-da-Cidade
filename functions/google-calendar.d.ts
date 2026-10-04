export const TIME_ZONE: string;
export const EVENT_DURATION_MINUTES: number;
export const TANGERINE_COLOR_ID: string;
export class GoogleCalendarError extends Error { code: string; detail?: unknown; constructor(code: string, detail?: unknown); }
export function eventDateKey(value: unknown): string | null;
export function eventTimes(dateKey: string, time: string, minutes?: number): { start: string; end: string };
export function eventTitle(order: any, client: any): string;
export function whatsappMessage(order: any, client: any): string;
export function whatsappPhone(client: any): string | null;
export function whatsappLink(order: any, client: any): string | null;
export function eventDescription(order: any, client: any): string;
export function buildCalendarEvent(order: any, client: any): {
  status: 'confirmed'; colorId: string; summary: string; location: string; description: string;
  start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string };
};
export function calendarEventId(orderId: string): string;
export function getAccessToken(opts?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: number }): Promise<string>;
export function resetTokenCache(): void;
export function syncOrderToCalendar(opts: { orderId: string; order: any; client: any; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: number }): Promise<{ eventId: string; htmlLink?: string; created: boolean; calendarId: string }>;
