export type PackageId = 'aniversario' | 'visita' | 'vip';
export interface EventPackage { id: PackageId; title: string; duration: string; durationMinutes: number; items: string[] }
export interface QuoteConfig {
  bases: { aniversario: number; visita: number };
  agentFee: number; kmMultiplier: number; tierKm: number; tierFee: number;
  minimums: Record<string, Record<string, number>>;
  dateExtras: Record<string, number>;
}
export interface QuoteResult {
  packageId: PackageId; km: number; base: number; dateExtra: number; tier: number; companyFee: number; agentFee: number; travel: number;
  subtotal: number; rounded: number; minimum: number; minimumCity: string; total: number; entry: number;
}
export const PACKAGES: EventPackage[];
export function packageById(id: string): EventPackage | null;
export const DEFAULT_QUOTE_CONFIG: QuoteConfig;
export function normalizeCity(value: unknown): string;
export function normalizeQuoteConfig(saved: unknown): QuoteConfig;
export function distanceFee(km: number, rules: { tierKm: number; tierFee: number }): number;
export function roundPrice(value: number): number;
export function computeQuote(input: { packageId: string; km: number; date?: string; city?: string; companyBase?: unknown }, config?: QuoteConfig): QuoteResult | { error: string };
export function formatBrl(value: number): string;
export function quoteMessage(input: { packageId: string; date?: string; total: number; link?: string; pack?: EventPackage }): string;
