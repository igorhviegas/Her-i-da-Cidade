export const TIME_ZONE: string;
export const EVENT_DURATION_MINUTES: number;
export const TANGERINE_COLOR_ID: string;
export const BANANA_COLOR_ID: string;
export const BASIL_COLOR_ID: string;
export class GoogleCalendarError extends Error { code: string; detail?: unknown; constructor(code: string, detail?: unknown); }
export function eventDateKey(value: unknown): string | null;
export function eventTimes(dateKey: string, time: string, minutes?: number): { start: string; end: string };
export function eventTitle(order: unknown, client: unknown): string;
export function whatsappMessage(order: unknown, client: unknown): string;
export function whatsappPhone(client: unknown): string | null;
export function whatsappLink(order: unknown, client: unknown): string | null;
export function eventDescription(order: unknown, client: unknown): string;
export function buildCalendarEvent(order: unknown, client: unknown): {
  status: 'confirmed'; colorId: string; summary: string; location: string; description: string;
  start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string };
};
export function calendarEventId(orderId: string): string;
export function getAccessToken(opts?: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: number }): Promise<string>;
export function resetTokenCache(): void;
export function syncOrderToCalendar(opts: { orderId: string; order: unknown; client: unknown; env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: number }): Promise<{ eventId: string; htmlLink?: string; created: boolean; calendarId: string }>;
export interface CalendarEvent {
  id: string; title: string; description: string; location: string; allDay: boolean;
  startKey: string; startTime: string | null; endKey: string; endTime: string | null; htmlLink: string | null; crm: boolean; transparent: boolean;
}
export interface CalendarEventInput { title: string; date: string; allDay?: boolean; startTime?: string; endTime?: string; location?: string; description?: string; /** ID da paleta de eventos do Google ('1' a '11'). */ colorId?: string }
type CalendarCtx = { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: number };
export function isCrmEventId(id: string): boolean;
export function normalizeEvent(item: unknown): CalendarEvent | null;
export function buildStandaloneEvent(input: unknown, opts?: { patch?: boolean }): Record<string, unknown>;
export function listCalendarEvents(opts: { from: string; to: string; q?: string } & CalendarCtx): Promise<{ events: CalendarEvent[]; truncated: boolean }>;
export function createCalendarEvent(opts: { input: CalendarEventInput } & CalendarCtx): Promise<CalendarEvent>;
export function updateCalendarEvent(opts: { id: string; input: CalendarEventInput } & CalendarCtx): Promise<CalendarEvent>;
export function deleteCalendarEvent(opts: { id: string } & CalendarCtx): Promise<{ id: string }>;
export function addDayKey(key: string, amount: number): string;
