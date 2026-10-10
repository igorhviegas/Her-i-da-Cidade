import type { Comparison } from './kartCompare.js';
import type { KartRace } from './kart.js';

export const SHARE_URL: string;
export const STORY_MAX_ROWS: number;
export interface StoryRow { rank: number; name: string; value: string; sub: string; medal: 1 | 2 | 3 | null }
export interface StoryList { kind: 'list'; kicker: string; title: string; subtitle: string; rows: StoryRow[]; footnote: string }
export interface StoryTable { kind: 'table'; kicker: string; title: string; subtitle: string; columns: { name: string; color: string }[]; rows: { label: string; values: string[]; best: number[] }[]; lines: string[]; footnote: string }
export type StorySpec = StoryList | StoryTable;

export interface RankingLine { rank: number; name: string; races: number; wins: number; podiums: number; big: string }
export function rankingStory(args: { mode: 'points' | 'laps'; periodLabel: string; lines: RankingLine[] }): StoryList;
export function raceStory(args: { race: KartRace; title: string; subtitle: string }): StoryList;
export function compareStory(args: { comparison: Comparison; colors: string[]; periodLabel: string }): StoryTable;
