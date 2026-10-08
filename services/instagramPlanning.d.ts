export type FormatId = 'reels' | 'story' | 'feed' | 'carousel' | 'live' | 'other';
export type CampaignStatus = 'planning' | 'active' | 'completed' | 'archived';
export type StepStatus = 'pending' | 'doing' | 'done';
export interface Option<T extends string = string> { id: T; label: string }
export interface CampaignStep { id: string; title: string; offset: number; status: StepStatus; notes: string; missionId?: string }
export interface Campaign { id: string; title: string; category: string; launchDate: string; status: CampaignStatus; notes: string; steps: CampaignStep[] }
export type CampaignInput = Omit<Campaign, 'id'>;
export interface Plan { id: string; date: string; title: string; format: FormatId; notes?: string }
export type PlanInput = Omit<Plan, 'id'>;
export type ResolvedStep = CampaignStep & { date: string | null; index: number };
export interface DayStep { campaignId: string; campaignTitle: string; stepId: string | null; title: string; status: StepStatus | null; offset: number; launch: boolean }
export interface DayEntries { plans: Plan[]; steps: DayStep[] }
export interface CampaignSpan { campaignId: string; title: string; start: string; end: string }

export const FORMATS: Option<FormatId>[];
export const CATEGORIES: Option[];
export const CAMPAIGN_STATUSES: Option<CampaignStatus>[];
export const STEP_STATUSES: Option<StepStatus>[];
export const MAX_OFFSET: number;
export const TASK_DIFFICULTY: number;
export const DEFAULT_TEMPLATES: Record<string, [string, number][]>;
export const formatLabel: (id: string) => string;
export const categoryLabel: (id: string) => string;
export const campaignStatusLabel: (id: string) => string;
export const stepStatusLabel: (id: string) => string;
export const isDayKey: (value: unknown) => boolean;
export function stepDate(launchDate: string, offset: number): string | null;
export const shortDate: (key: string, todayKey?: string) => string;
export const fullDate: (key: string) => string;
export function describeOffset(offset: number): string;
export const makeStepId: (random?: () => number) => string;
export function buildTemplateSteps(template: ([string, number] | { title: string; offset: number })[] | undefined, newId?: () => string): CampaignStep[];
export function templateFor(category: string, custom?: Record<string, { title: string; offset: number }[]>): [string, number][];
export function validateCampaign(input: Partial<CampaignInput> | null | undefined): string[];
export function validatePlan(input: Partial<PlanInput> | null | undefined): string[];
export function cleanSteps(steps: CampaignStep[]): CampaignStep[];
export function resolveSteps(campaign: Pick<Campaign, 'launchDate' | 'steps'>): ResolvedStep[];
export function campaignSpan(campaign: Pick<Campaign, 'launchDate' | 'steps'>): { start: string; end: string } | null;
export function campaignProgress(campaign: Pick<Campaign, 'launchDate' | 'steps'>): { done: number; total: number; next: ResolvedStep | null };
export function calendarEntries(input: { plans?: Plan[]; campaigns?: Campaign[] }): { byDay: Map<string, DayEntries>; spans: CampaignSpan[] };
export function campaignsOnDay(spans: CampaignSpan[], key: string): string[];
export const taskDueAt: (date: string) => Date;
export const missionIdFor: (campaignId: string, stepId: string) => string;
export function taskFromStep(campaign: Pick<Campaign, 'title' | 'launchDate'>, step: Pick<CampaignStep, 'title' | 'offset' | 'notes'>): { title: string; description: string; difficulty: number; dueAt: Date };
export function taskDueChanges(before: Pick<Campaign, 'launchDate' | 'steps'>, after: Pick<Campaign, 'launchDate' | 'steps'>): { missionId: string; dueAt: Date }[];
export function offsetFrom(direction: 'before' | 'on' | 'after', days: string): number;
export function splitOffset(offset: number): { direction: 'before' | 'on' | 'after'; days: string };
export function daysUntil(todayKey: string, key: string): number | null;
