export type PostKind = 'image' | 'video' | 'reel' | 'carousel' | 'other';
export type MetricKey = 'likes' | 'comments' | 'views';
export interface InstagramPost {
  id: string; caption: string; kind: PostKind; thumbnailUrl: string | null; permalink: string | null;
  publishedAt: string | null; likes: number | null; comments: number | null; views: number | null;
  viewsStale?: boolean; syncedAt?: string;
}
export function metricOrNull(value: unknown): number | null;
export function normalizeMedia(raw: Record<string, unknown>, views?: number | null): InstagramPost;
export function totalFor(posts: InstagramPost[], key: MetricKey): { total: number; counted: number };
export function sortPosts(posts: InstagramPost[], key: MetricKey | 'recent'): InstagramPost[];
export function topPost(posts: InstagramPost[], key: MetricKey): InstagramPost | null;
export function currentPosts(posts: InstagramPost[], syncedAt: string | undefined): InstagramPost[];
export function formatDateTime(value: unknown): string;
export const PERIODS: { id: 'today' | '7d' | '30d' | 'all'; label: string }[];
export function filterByPeriod(posts: InstagramPost[], period: 'today' | '7d' | '30d' | 'all', nowMs: number): InstagramPost[];
