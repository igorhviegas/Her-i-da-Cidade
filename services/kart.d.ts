export interface KartPilot { id: string; name: string; aliases: string[]; active: boolean }
export interface KartResult { pilotId: string; name: string; pos: number; racePos: number | null; bestLapMs: number | null; laps: number }
export interface KartRace {
  id: string;
  /** 'YYYY-MM-DD' */
  date: string;
  /** Ex.: 'Bateria 16:50' */
  heat: string;
  weather: 'dry' | 'rain';
  /** Sessão fora do campeonato (ex.: ir sozinho bater a melhor volta): não pontua, mas conta para o recorde de volta. */
  extra?: boolean;
  results: KartResult[];
}
export interface TimingRow { racePos: number | null; kart: string; name: string; bestLapMs: number | null; laps: number }
export interface TimingReport { date: string; heat: string; time: string; rows: TimingRow[] }

export const MIN_OFFICIAL_PILOTS: number;
export function norm(s: unknown): string;
export function parseLap(text: unknown): number | null;
export function parseLapInput(text: unknown): number | null;
export function formatLap(ms: number | null | undefined): string;
/** null = o texto não é um relatório de cronometragem. */
export function parseTimingReport(text: unknown): TimingReport | null;
export function matchPilot<P extends { id: string; name: string; aliases?: string[] }>(pdfName: string, pilots: P[]): P | null;
export function pointsFor(pos: number): number;
export function buildResults(rows: TimingRow[], pilots: Pick<KartPilot, 'id' | 'name' | 'aliases'>[]): { results: KartResult[]; outsiders: string[] };
export function isOfficial(race: { results?: unknown[] }): boolean;
