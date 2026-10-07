export const BASELINE_PATH: ['xpBaseline', 'main'];
export const ORDER_XP_PER_REAL: number;
export const CONTENT_PUBLISHED_XP: number;
export const DIFFICULTY_XP: Record<number, number>;
export const GOAL_XP: Record<string, number>;
export const INSTAGRAM_XP: { views: number; likes: number; comments: number; followers: number };
export const LEVEL_BASE: number;
export const LEVEL_GROWTH: number;
export function levelCost(level: number): number;
export function levelStart(level: number): number;
export interface LevelInfo { level: number; xp: number; into: number; need: number; left: number; percent: number; nextAt: number }
export function levelInfo(totalXp: number): LevelInfo;
export function orderXp(value: unknown): number;
export function xpOfEvent(event: { type?: string; xp?: number; difficulty?: number | null; meta?: Record<string, any> }): number;
export interface XpBaseline { at: any; total: number; categories?: Record<string, { count: number; xp: number }>; counted?: { orders?: string[]; scripts?: string[] }; ig?: { followers: number } }
export function totalXp(baseline: XpBaseline | null | undefined, events: any[]): { baseline: number; events: number; total: number } | null;
export function buildBaseline(input: Record<string, any>): { categories: Record<string, { count: number; xp: number }>; total: number; counted: { orders: string[]; scripts: string[] }; ig: { followers: number } };
export function igXpDelta(input: { prev: Record<string, any>; posts: any[]; followers: unknown; followersHigh: unknown }): { xp: number; followersHigh: number | null };
