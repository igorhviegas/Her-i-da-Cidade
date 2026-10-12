export const DEFAULT_THANK_YOU_VIDEO_URL: string;
export const CLIENTS_FEATURED_MAX: number;
export interface ClientsConfig {
  videoUrl: string;
  poster: string;
  orientation: 'horizontal' | 'vertical';
  featuredIds: string[];
}
export function resolveClientsConfig(raw: unknown): ClientsConfig;
export function pickFeaturedVideos<T extends { id: string; title: string; active?: boolean; featured?: boolean; order?: number; publishedAt?: string }>(
  videos: readonly T[] | null | undefined,
  limit?: number,
  ids?: readonly string[],
): T[];
export type ThankYouVideo =
  | { kind: 'youtube'; embedUrl: string; poster: string }
  | { kind: 'file'; src: string };
export function parseThankYouVideo(value: unknown): ThankYouVideo | null;
export function parsePoster(value: unknown): string | null;
