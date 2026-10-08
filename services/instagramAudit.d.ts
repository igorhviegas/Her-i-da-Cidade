import type { InstagramPost } from './instagramMetrics.js';

export type CheckStatus = 'PASS' | 'WARN' | 'FAIL';
export interface CaptionCheck { label: string; status: CheckStatus; detail: string }
export interface CaptionLint {
  chars: number; visible: string; truncated: boolean; tags: string[]; asks: string[];
  checks: CaptionCheck[]; verdict: 'READY' | 'REVIEW' | 'FIX';
}
export interface AuditItem { post: InstagramPost; multiple: number }
export interface AuditGroup { key: string; n: number; multiple: number; small: boolean }
export interface PostsAudit {
  metric: 'views' | 'likes'; n: number; median: number | null; enough: boolean;
  top: AuditItem[]; bottom: AuditItem[]; groups: { kind: AuditGroup[]; ask: AuditGroup[] };
}
export const CAPTION_LIMIT: number;
export const FEED_CUT: number;
export const HASHTAG_CAP: number;
export const MIN_POSTS: number;
export const MIN_GROUP: number;
export function lintCaption(text: string | null | undefined, cut?: number): CaptionLint;
export function auditPosts(posts: InstagramPost[]): PostsAudit;
