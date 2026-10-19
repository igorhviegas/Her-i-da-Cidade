export type ArtFormat = 'square' | 'story' | 'site' | 'wide';
export type BackgroundFormat = 'square' | 'story' | 'wide';
export interface RichRun { text: string; bold: boolean }

export const ART_FORMATS: ArtFormat[];
export const ART_BACKGROUND_SETS: { id: string; label: string }[];
export function backgroundKey(format: ArtFormat): BackgroundFormat;
export function backgroundSetUrls(id: string): Partial<Record<BackgroundFormat, string>>;
export function priceNumber(price: string | null | undefined): string;
export function wrapRich(text: string, maxWidth: number, measure: (text: string, bold: boolean) => number): RichRun[][];
export function splitTitle(title: string): string[];
export function normalizeArt(art: unknown): import('../types').ServiceArt | undefined;
