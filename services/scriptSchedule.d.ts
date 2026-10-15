export interface SchedulableScript { publicationStatus: string; publishedAt?: unknown; plannedPublishAt?: unknown }
export function scriptPublishTime(script: SchedulableScript): number | null;
export function sortByPublishDate<T extends SchedulableScript>(scripts: T[], newestFirst?: boolean): T[];
export function scriptCalendarPlans(scripts: Array<SchedulableScript & { id: string; title: string }>): import('./instagramPlanning.js').Plan[];
