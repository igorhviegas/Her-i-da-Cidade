import type { CalendarEvent } from '../functions/google-calendar.js';
export type CalendarView = 'month' | 'week' | 'day';
export function eventsOnDay(events: CalendarEvent[], key: string): CalendarEvent[];
export function visibleRange(view: CalendarView, key: string): { from: string; to: string };
export function daysBetween(from: string, to: string): string[];
export function shiftDate(view: CalendarView, key: string, direction: -1 | 1): string;
