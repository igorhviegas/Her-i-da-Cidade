export interface AgentItem { id: string; text: string; heading?: boolean; note?: boolean }
export interface AgentStep {
  id: string; order: number; title: string; kicker?: string; description?: string;
  /** Alerta destacado no topo da etapa (ex.: voltagem). Vazio = sem alerta. */
  alert?: string; highlight?: boolean; startButton?: boolean; active: boolean; items: AgentItem[];
}
export interface AgentTrack { id: string; order: number; title: string; url: string; active: boolean }
export type AlertKey = 'm30' | 'm5';
export interface FiredAlerts { m30?: boolean; m5?: boolean }

export const EVENT_DURATION_MS: number;
export const ALERT_30_MS: number;
export const ALERT_5_MS: number;
export function computeTimer(event: { startedAt: number; adjustMs?: number }, now: number): { elapsedMs: number; remainingMs: number; finished: boolean };
export function formatClock(ms: number): string;
export function dueAlert(remainingMs: number, fired?: FiredAlerts): AlertKey | null;
export function markFired(fired: FiredAlerts | undefined, alert: AlertKey): FiredAlerts;
export function resetFired(remainingMs: number, fired?: FiredAlerts): FiredAlerts;
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[];
export function sortByOrder<T extends { order?: number }>(list: T[]): T[];
export function newId(): string;
export const TIMER_ALERTS: Record<AlertKey, { title: string; tone: 'amber' | 'red'; items: string[] }>;
export const DEFAULT_AGENT_STEPS: AgentStep[];

export interface AgentFaqItem { id: string; question: string; answer: string }
export interface AgentFaqCategory { id: string; order: number; title: string; active: boolean; items: AgentFaqItem[] }
export const SUPPORT_WHATSAPP_URL: string;
export const DEFAULT_AGENT_FAQ: AgentFaqCategory[];
