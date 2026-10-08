import type { InstagramPost } from './instagramMetrics.js';
import type { DailySummary } from './instagramDaily.js';
import type { CampaignSpan, DayEntries } from './instagramPlanning.js';
export interface CalendarCell {
  key: string; day: number; feed: number; reels: number; total: number; plans: DayEntries['plans']; steps: DayEntries['steps']; campaigns: string[]; followers: number | null; views: number | null;
  isToday: boolean; future: boolean; beforeCoverage: boolean;
}
export const monthKeyOf: (dayKey: string) => string;
export function shiftMonth(monthKey: string, delta: number): string;
export function postDay(post: Pick<InstagramPost, 'publishedAt'>): string | null;
export function buildMonth(input: { monthKey: string; posts: InstagramPost[]; days: Pick<DailySummary, 'day' | 'followers' | 'views'>[]; today: string; planning?: { byDay: Map<string, DayEntries>; spans: CampaignSpan[] } }): { weeks: (CalendarCell | null)[][]; coverageStart: string | null };
export function formatBalance(value: number, style?: 'compact' | 'full'): string;
export function describeDay(cell: CalendarCell): string;
