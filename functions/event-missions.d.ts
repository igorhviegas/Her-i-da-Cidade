export interface ChecklistItem { id: string; text: string; done: boolean }
export const EVENT_MISSION_TITLE: string;
export const EVENT_MISSION_SOURCE: string;
export const EVENT_CHECKLIST_ITEMS: string[];
export function eventMissionId(orderId: string): string;
export function cleanChecklist(items: unknown): ChecklistItem[];
export function orderEventSlot(order: any): { key: string; dueAt: Date } | null;
export function buildEventMission(order: any, now: Date): Record<string, any> | null;
export function eventMissionPatch(mission: any, order: any): Record<string, any> | null;
export function syncEventMissions(store: any, now?: Date): Promise<{ created: number; updated: number }>;
