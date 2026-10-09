import type { KartRace } from './kart.js';
import type { KartScope } from './kartRanking.js';

export const MAX_COMPARE: number;
export interface ComparePilot { pilotId: string; name: string; races: number; wins: number; podiums: number; points: number; pointsPerRace: number | null; avgPos: number | null; bestLapMs: number | null }
export interface CompareDuel { a: string; b: string; aWins: number; bWins: number; together: number }
export interface CommonRace { raceId: string; number: number; date: string; positions: (number | null)[] }
export type CompareMetric = 'points' | 'races' | 'wins' | 'podiums' | 'pointsPerRace' | 'avgPos' | 'bestLapMs';
export interface Comparison { pilots: ComparePilot[]; duels: CompareDuel[]; common: CommonRace[]; together: number; best: Record<CompareMetric, string[]> }
export function comparePilots(races: KartRace[], pilotIds: string[], names?: Map<string, string>, scope?: KartScope): Comparison;
