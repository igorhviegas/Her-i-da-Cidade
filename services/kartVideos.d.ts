export type KartVideoKind = 'tip' | 'race';
export interface KartVideo { id: string; title: string; youtubeId: string; kind: KartVideoKind; order: number; active: boolean; /** Corrida a que o vídeo pertence (opcional, só faz sentido em 'race'). */ raceId?: string }
export const KART_VIDEO_KINDS: Record<KartVideoKind, string>;
export function youtubeId(input: unknown): string;
export function videosByRace(videos: KartVideo[] | null | undefined): Map<string, KartVideo>;
