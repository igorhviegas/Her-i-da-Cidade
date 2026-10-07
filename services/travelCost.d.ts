export const DEFAULT_KM_RATE: number;
export const DEFAULT_EVENT_FEE: number;
export const MAX_EVENTS: number;
export const MAX_DAYS: number;
export const MAX_TOTAL_EVENTS: number;
export const MIN_ADDRESS_LENGTH: number;
export const MAX_ADDRESS_LENGTH: number;
export const MAX_KM_RATE: number;
export const MAX_EVENT_FEE: number;
export const MAX_LEG_KM: number;

/** Um dia (viagem própria) já validado. */
export interface TravelDayInput {
  /** 'YYYY-MM-DD' ou '' (só para o texto do WhatsApp). */
  date: string;
  events: string[];
  /** Outro endereço de partida/destino só neste dia; null = padrão. */
  start: string | null;
  end: string | null;
  useStop: boolean;
  /** Outra parada só neste dia; null = parada padrão (quando useStop). */
  stop: string | null;
}
export interface TravelInput { days: TravelDayInput[]; kmRate: number; eventFee: number }
export function validateTravelInput(body: unknown): { error: string; value?: undefined } | { value: TravelInput; error?: undefined };

export interface TravelDefault { label: string; address: string }
export interface TravelPoint { role: 'start' | 'stop' | 'event' | 'end'; label: string; address: string; custom: boolean }
export function buildSequence(day: TravelDayInput, defaults: { start: TravelDefault; stop?: TravelDefault | null; end?: TravelDefault | null }): TravelPoint[] | null;

export interface TravelLegKm { from: string; to: string; km: number }
/** Dia como o servidor devolve (km por trecho já arredondado). */
export interface TravelDayKm { date: string; legs: TravelLegKm[]; eventCount: number }
export interface TravelSummaryLeg extends TravelLegKm { /** Km corrigido à mão. */ adjusted?: boolean }
export interface TravelSummaryDay { date: string; legs: TravelSummaryLeg[]; totalKm: number; eventCount: number }
export interface TravelSummary { days: TravelSummaryDay[]; totalKm: number; eventCount: number; kmRate: number; eventFee: number; travelCost: number; feesTotal: number; total: number }
export function metersToKm(meters: number): number;
export function parseKm(text: unknown): number | null;
export function legKey(day: number, leg: number): string;
export function summarizeTrip(trip: { days: TravelDayKm[]; kmRate: number; eventFee: number }, overrides?: Record<string, number>): TravelSummary;
export function nextDateKey(key: string): string;
export function formatKm(km: number): string;
export function formatBRL(value: number): string;
export function formatDateKey(key: string | null | undefined): string;
export function travelWhatsAppText(trip: TravelSummary): string;
export function whatsAppBase(number: unknown): string | null;
export function whatsAppLink(base: string, text: string): string;
