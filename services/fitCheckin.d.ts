export type CheckinKind = 'gym' | 'functional';
export const CHECKIN_KINDS: Record<CheckinKind, string>;
export interface Checkin { id: string; kind: CheckinKind; day: string; durationMin?: number; note?: string; workoutName?: string; exercisesDone?: number; exercisesTotal?: number }
export function isDay(value: unknown): value is string;
export function checkinId(kind: CheckinKind, day: string): string;
export function normalizeCheckin(input: { kind: unknown; day: unknown; durationMin?: unknown; note?: unknown }): { value: { kind: CheckinKind; day: string; durationMin?: number; note?: string } } | { error: string };
export function normalizeWeight(input: { day: unknown; kg: unknown }): { value: { day: string; kg: number } } | { error: string };
export function mondayOf(day: string): string;
export function weeklyCounts(checkins: Pick<Checkin, 'kind' | 'day'>[], endDay: string, weeks: number): { weekStart: string; gym: number; functional: number; total: number }[];
