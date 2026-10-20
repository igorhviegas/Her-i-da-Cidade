import type { InstagramPost } from './instagramMetrics.js';
import type { Service } from '../types';

export type ClarimTemplate = 'cover' | 'events' | 'performance' | 'news' | 'classifieds';
export type AdFormat = 'square' | 'story' | 'wide';
export type PageStatus = 'approved' | 'pending' | 'review';

export interface Period { start: string; end: string }
export interface PhotoRef { path: string; x: number; y: number; zoom: number }
export interface AdRef { serviceId: string; format: AdFormat | null }
export interface Approval { by: string; at: Date | null; hash: string }

export interface ClarimPage {
  id?: string;
  template: ClarimTemplate;
  order: number;
  fields: Record<string, string>;
  photos: Record<string, PhotoRef>;
  ads: Record<string, AdRef | null>;
  sources: string[];
  services: string[];
  approval: Approval | null;
}

export interface EventCandidate { orderId: string; day: string; weekday: string; eligible: boolean; reason: string }
export interface ViewGain { post: InstagramPost; published: string; gain: number; partial: boolean }
export interface StatsDay { day: string; followers?: number | null; posts?: Record<string, Array<number | null>> }
export interface AdSlot { w: number; h: number; accepts: AdFormat[] }

export function previousWeek(todayKey: string): Period;
export function periodLabel(period: Period): string;
export function editionTitle(period: Period): string;
export function longDate(key: string): string;
export function weekdayName(key: string): string;
export function toDate(value: unknown): Date | null;
export function inPeriod(key: string | null, period: Period): boolean;

export const TEXT_LIMITS: Record<'kicker' | 'headline' | 'deck' | 'body' | 'caption' | 'teaser' | 'quote', number>;
export const TEMPLATES: Array<{ id: ClarimTemplate; label: string; description: string }>;
export function templateLabel(id: string): string;
export const AD_SLOTS: Record<'cover' | 'events' | 'news' | 'newsNotice', AdSlot>;
export const CLASSIFIEDS_MIN: number;
export const CLASSIFIEDS_MAX: number;
export const EVENTS_MAX_PHOTOS: number;
export function newPage(template: ClarimTemplate, order: number): ClarimPage;

export function eventCandidates(orders: Array<Record<string, any>>, period: Period): EventCandidate[];
export function revokedSources(sourceIds: string[], orders: Array<Record<string, any>>, period: Period): string[];
export const REVOKED_ISSUE: string;
export function consentIssues(page: ClarimPage, orders: Array<Record<string, any>>, period: Period): string[];
export function eventsHeadline(n: number): string;

export function viewGains(posts: InstagramPost[], stats: StatsDay[], period: Period, todayKey: string): ViewGain[];
export function reelCode(url: string | null | undefined): string;
export function videoTitle(caption: string | null | undefined): string;
export function shortDate(key: string): string;
export function videosPublished(posts: InstagramPost[], period: Period): number;
export function followersSummary(profile: { followers?: number | null } | null, stats: StatsDay[], period: Period, todayKey: string): { followers: number | null; gain: number | null; partial: boolean };
export function compactNumber(n: number | null | undefined): string;

export function serviceFormats(service: Pick<Service, 'art'> | null | undefined): AdFormat[];
export function pickAdFormat(slot: AdSlot, available: AdFormat[], preferred?: AdFormat | null): AdFormat | null;

export function fitLines(text: string, opts: { maxWidth: number; maxLines: number; maxSize: number; minSize: number }, measure: (text: string, size: number) => number): { size: number; lines: string[] } | null;

export function pageHash(page: Pick<ClarimPage, 'template' | 'fields' | 'photos' | 'ads' | 'sources' | 'services'>): string;
export function pageStatus(page: ClarimPage, issues: string[]): PageStatus;
export const PAGE_STATUS_LABEL: Record<PageStatus, string>;
export function pageIssues(page: ClarimPage): string[];
export function pageFileName(editionNumber: number, pageNumber: number, template: ClarimTemplate): string;
