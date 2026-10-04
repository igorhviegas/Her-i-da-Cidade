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
export interface CalendarEvent {
  id: string; title: string; description: string; location: string; allDay: boolean;
  startKey: string; startTime: string | null; endKey: string; endTime: string | null; htmlLink: string | null; crm: boolean;
}
export interface CalendarEventInput { title: string; date: string; allDay?: boolean; startTime?: string; endTime?: string; location?: string; description?: string }
type CalendarCtx = { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: number };
export function isCrmEventId(id: string): boolean;
export function normalizeEvent(item: any): CalendarEvent | null;
export function buildStandaloneEvent(input: any, opts?: { patch?: boolean }): Record<string, any>;
export function listCalendarEvents(opts: { from: string; to: string; q?: string } & CalendarCtx): Promise<{ events: CalendarEvent[]; truncated: boolean }>;
export function createCalendarEvent(opts: { input: CalendarEventInput } & CalendarCtx): Promise<CalendarEvent>;
export function updateCalendarEvent(opts: { id: string; input: CalendarEventInput } & CalendarCtx): Promise<CalendarEvent>;
export function deleteCalendarEvent(opts: { id: string } & CalendarCtx): Promise<{ id: string }>;
