export const BUSINESS_TIME_ZONE: string;
export function wallTime(ms: number, timeZone?: string): { date: string; time: string };
export function zonedInstant(date: string, time: string, timeZone?: string): number;
export function isValidTimeZone(timeZone: unknown): boolean;
export function localSlot(date: string, time: string, timeZone: string): { date: string; time: string; same: boolean };
