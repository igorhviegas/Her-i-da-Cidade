export interface ScheduleBuffers { first: number; next: number; after: number }
export const DEFAULT_BUFFERS: ScheduleBuffers;
export interface ScheduleStop { label: string; start: number; end: number }
export interface ScheduleRow extends ScheduleStop { travel: number; leaveAt: number; slack: number | null; ok: boolean }
export interface DayPlan { rows: ScheduleRow[]; homeAt: number; vitorAt: number | null; feasible: boolean }
export function parseTime(text: string): number | null;
export function formatTime(minutes: number): string;
export function planDay(stops: ScheduleStop[], legs: { minutes: number }[], buffers?: ScheduleBuffers): DayPlan;
export function arrivalMessage(opts: { venueLabel?: string; arrivalAt: number; now?: number }): string;
export const PACKAGE_MINUTES: Record<string, number>;
