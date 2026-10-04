import type { InstagramPost } from './instagramMetrics.js';
export interface DailyRef { l: number | null; v: number | null }
export interface DailyState { day: string; baselineAt: string; followers0: number | null; refs: Record<string, DailyRef>; updatedAt: string }
export interface DailySummary { day: string; baselineAt: string; updatedAt: string; followers: number | null; likes: number | null; views: number | null; viewsPartial: boolean }
export const dayOf: (ms: number) => string;
export function applyDaily(input: { prev: DailyState | null; nowMs: number; followers: number | null | undefined; posts: InstagramPost[] }): { state: DailyState; summary: DailySummary };
export function describeDelta(summary: DailySummary | null | undefined, key: 'followers' | 'likes' | 'views', today: string): { kind: 'up' | 'down' | 'zero' | 'pending' | 'unavailable'; text: string; since: string | null };
