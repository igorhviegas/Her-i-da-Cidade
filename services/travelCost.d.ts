export const DEFAULT_KM_RATE: number;
export const DEFAULT_EVENT_FEE: number;
export const MAX_EVENTS: number;
export const MIN_ADDRESS_LENGTH: number;
export const MAX_ADDRESS_LENGTH: number;
export const MAX_KM_RATE: number;
export const MAX_EVENT_FEE: number;
export const MAX_LEG_KM: number;

export interface TravelInput {
  events: string[];
  /** Outro endereço de partida/destino só neste cálculo; null = padrão. */
  start: string | null;
  end: string | null;
  useStop: boolean;
  /** Outra parada só neste cálculo; null = parada padrão (quando useStop). */
  stop: string | null;
  kmRate: number;
  eventFee: number;
}
export function validateTravelInput(body: unknown): { error: string; value?: undefined } | { value: TravelInput; error?: undefined };

export interface TravelDefault { label: string; address: string }
export interface TravelPoint { role: 'start' | 'stop' | 'event' | 'end'; label: string; address: string; custom: boolean }
export function buildSequence(input: TravelInput, defaults: { start: TravelDefault; stop?: TravelDefault | null; end?: TravelDefault | null }): TravelPoint[] | null;

export interface TravelLeg { from: string; to: string; km: number; /** Km corrigido à mão. */ adjusted?: boolean }
export interface TravelSummary { legs: TravelLeg[]; totalKm: number; kmRate: number; travelCost: number; eventCount: number; eventFee: number; feesTotal: number; total: number }
export function metersToKm(meters: number): number;
export function parseKm(text: unknown): number | null;
export function summarizeTravel(opts: { legs: { from: string; to: string; meters: number; adjusted?: boolean }[]; kmRate: number; eventFee: number; eventCount: number }): TravelSummary;
export function applyKmOverrides(summary: TravelSummary, overrides?: Record<number, number>): TravelSummary;
export function formatKm(km: number): string;
export function formatBRL(value: number): string;
export function formatDateKey(key: string | null | undefined): string;
export function travelWhatsAppText(summary: TravelSummary, opts?: { date?: string }): string;
export function whatsAppBase(number: unknown): string | null;
export function whatsAppLink(base: string, text: string): string;
