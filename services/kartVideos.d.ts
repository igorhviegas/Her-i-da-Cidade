export type KartVideoKind = 'tip' | 'race';
export interface KartVideo { id: string; title: string; youtubeId: string; kind: KartVideoKind; order: number; active: boolean }
export const KART_VIDEO_KINDS: Record<KartVideoKind, string>;
export function youtubeId(input: unknown): string;
