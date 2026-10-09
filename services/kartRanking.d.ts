import type { KartRace } from './kart.js';

export const RECENT_RACES: number;
export type KartScope = { type: 'recent' } | { type: 'all' } | { type: 'year'; year: number };
export type NumberedRace = KartRace & { number: number };

export interface StandingRow { rank: number; pilotId: string; name: string; points: number; races: number; wins: number; podiums: number; bestLapMs: number | null }
export interface LapRow { rank: number; pilotId: string; name: string; bestLapMs: number; races: number; extras: number; wins: number; podiums: number; raceId: string; date: string; rain: boolean; extra: boolean }
export interface HistoryRow { raceId: string; number: number; date: string; heat: string; weather: 'dry' | 'rain'; pos: number; points: number; bestLapMs: number | null; field: number }
export interface ExtraRow { raceId: string; date: string; heat: string; weather: 'dry' | 'rain'; bestLapMs: number | null; field: number }
export interface PilotProfile { medal: 1 | 2 | 3 | null; recent: StandingRow | null; overall: StandingRow | null; history: HistoryRow[]; extras: ExtraRow[]; record: { raceId: string; date: string; bestLapMs: number; extra: boolean } | null; recentPoints: number; recentRaces: number }

export function extraRaces(races: KartRace[]): KartRace[];
export function officialRaces(races: KartRace[]): NumberedRace[];
export function raceYears(races: KartRace[]): number[];
export function racesInScope(races: KartRace[], scope?: KartScope): NumberedRace[];
export function standings(races: KartRace[], scope?: KartScope): StandingRow[];
export function lapRanking(races: KartRace[], scope?: KartScope): LapRow[];
export function trackRecord(races: KartRace[], scope?: KartScope): LapRow | null;
export function pilotProfile(pilotId: string, races: KartRace[]): PilotProfile;
export function recentForm(pilotId: string, races: KartRace[]): { raceId: string; number: number; points: number | null; pos: number | null }[];
