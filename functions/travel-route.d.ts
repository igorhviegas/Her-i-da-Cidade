import type { TravelDayKm, TravelDefault, TravelInput } from '../services/travelCost.js';

export type TravelErrorCode = 'not_configured' | 'stop_not_configured' | 'address_not_found' | 'invalid_date' | 'events_unavailable' | 'no_route' | 'auth' | 'rate_limited' | 'unavailable' | 'api_error';
export class TravelRouteError extends Error { code: TravelErrorCode; detail?: unknown; constructor(code: TravelErrorCode, opts?: { label?: string; detail?: unknown }); }

export interface TravelConfig {
  apiKey: string; accessCode: string; whatsappNumber: string;
  defaults: { start: TravelDefault; stop: TravelDefault | null; end: TravelDefault };
}
export function readTravelConfig(env?: Record<string, string | undefined>): TravelConfig | null;
export function codeMatches(provided: unknown, expected: string): boolean;
export function geocodeAddress(address: string, opts: { apiKey: string; fetchImpl?: typeof fetch; label?: string }): Promise<{ formatted: string; lat: number; lng: number; placeId: string; precise: boolean }>;
export function computeLegsMeters(points: { lat: number; lng: number }[], opts: { apiKey: string; fetchImpl?: typeof fetch }): Promise<number[]>;
export interface TravelDayResult extends TravelDayKm {
  /** Endereço entendido pelo Google para cada ponto digitado pelo agente neste dia. */
  resolved: { label: string; address: string; precise: boolean }[];
}
export interface TravelResult {
  days: TravelDayResult[];
  kmRate: number;
  eventFee: number;
  needsConfirmation: boolean;
  /** Base do link wa.me do destinatário (sem texto); null se o número não estiver configurado. */
  whatsappBase: string | null;
  calculatedAt: string;
}
export function calculateTravel(opts: { input: TravelInput; config: TravelConfig; fetchImpl?: typeof fetch; now?: Date }): Promise<TravelResult>;

export interface TravelDayEvent { time: string; location: string; formType: string }
export function listDayEvents(opts: { date: string; listOrdersBetween: (start: Date, end: Date) => Promise<any[]> }): Promise<TravelDayEvent[]>;
