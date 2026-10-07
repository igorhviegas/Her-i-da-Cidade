export interface FitRide {
  source: string; sourceKey: string; sport: 'cycling'; virtual: boolean; startedAt: Date;
  durationSec: number; movingSec: number; distanceKm: number; avgSpeedKmh: number; maxSpeedKmh: number; avgCadenceRpm?: number;
}
export type StoredFitRide = FitRide & { id: string };
export function summarizeRide(parsed: unknown): { id: string; ride: FitRide } | { error: string };
export function kmByDay(days: string[], rides: Pick<FitRide, 'startedAt' | 'distanceKm'>[], dayOf: (date: Date) => string): (number | null)[];
export function summarizeRides(rides: Pick<FitRide, 'distanceKm' | 'movingSec'>[]): { count: number; km: number; movingSec: number; avgSpeedKmh: number | null };
export function formatDuration(totalSec: number): string;
