export const DEFAULT_PHONE_COUNTRY: string;
export const PHONE_COUNTRIES: { iso: string; ddi: string }[];
export function ddiOf(iso: string): string;
export function flagEmoji(iso: string): string;
export function phoneCountryOptions(locale?: string): { iso: string; ddi: string; name: string; flag: string; label: string }[];
