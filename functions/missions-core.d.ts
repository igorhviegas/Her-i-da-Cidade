export type Frequency = 'daily' | 'weekly' | 'monthly';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type GoalMetric = 'revenue_completed' | 'services_sold' | 'scripts_created' | 'scripts_ready' | 'content_published' | 'missions_completed' | 'task_streak';
export interface TaskRecurrence { frequency: Frequency; weekdays?: number[]; monthDay?: number | null; monthNth?: { week: number; weekday: number } | null; }
export interface OccurrenceLike { id?: string; taskId?: string; date: string; status: string; [key: string]: any; }
export interface CycleBounds { key: string; startKey: string; endKey: string; start: Date; end: Date; }
export interface GoalProgress { actual: number; shown: number; percent: number; reached: boolean; }
export const GOAL_METRICS: Record<GoalMetric, string>;
export function dateKey(date: Date): string;
export function parseDateKey(key: string): { year: number; month: number; day: number } | null;
export function startOfDay(key: string): Date;
export function endOfDay(key: string): Date;
export function addDays(key: string, amount: number): string;
export function weekdayOf(key: string): number;
export function recursOn(task: TaskRecurrence, key: string): boolean;
export function validateTask(input: any): string[];
export function planOccurrences(task: any, today: string): { date: string; status: 'pending' | 'missed' }[];
export function occurrenceId(taskId: string, date: string): string;
export function occurrenceDueAt(date: string, time: string): Date;
export function syncRecurringTasks(store: any, now?: Date): Promise<{ created: any[]; resolved: any[] }>;
export function taskStreak(occurrences: OccurrenceLike[], today: string, since?: string | null): number;
export function cycleBounds(period: GoalPeriod, now: Date, config?: { weekStartsOn?: number; monthStartDay?: number }): CycleBounds;
export function metricValue(metric: GoalMetric, bounds: { start: Date; end: Date }, data: { orders: any[]; scripts: any[]; missions: any[]; occurrences: any[] }, today: string): number;
export function goalProgress(actual: number, target: number): GoalProgress;
export function validateGoal(input: any): string[];
export function buildNotifications(data: { missions?: any[]; occurrences?: any[]; goals?: any[] }, now?: Date): { id: string; type: string; title: string; body: string; refType: string; refId: string }[];
export function cycleChanged(goal: { cycleKey: string; cycleEnd: any }, bounds: CycleBounds): boolean;
export function cycleArchiveRecord(goal: any, value: number, now: Date, options?: { endedEarly?: boolean }): Record<string, any>;
export function missionNotificationIds(missionId: string): string[];
export function occurrenceNotificationIds(occurrenceId: string): string[];
