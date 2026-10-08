export interface ChecklistItem { id: string; text: string; done: boolean }
export const EVENT_MISSION_TITLE: string;
export const EVENT_MISSION_SOURCE: string;
export const EVENT_CHECKLIST_ITEMS: string[];
export function eventMissionId(orderId: string): string;
export function cleanChecklist(items: unknown): ChecklistItem[];
export function orderEventSlot(order: unknown): { key: string; dueAt: Date } | null;
export function buildEventMission(order: unknown, now: Date): Record<string, unknown> | null;
export function eventMissionPatch(mission: unknown, order: unknown): Record<string, unknown> | null;
export function syncEventMissions(store: unknown, now?: Date): Promise<{ created: number; updated: number }>;
