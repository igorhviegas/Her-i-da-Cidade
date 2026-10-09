export interface KartNextConfig { date: string; time?: string; place?: string; note?: string }
export interface UpcomingRace { date: string; time: string; place: string; note: string; days: number; countdown: string }
export function todayInBrazil(now?: Date): string;
export function daysUntil(date: string, today: string): number;
export function countdownLabel(days: number): string;
export function upcomingRace(config: KartNextConfig | null | undefined, today?: string): UpcomingRace | null;
