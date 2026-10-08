export interface Exercise { id: string; name: string; category: string; timerSec: number | null }
export interface Workout { id: string; name: string; exerciseIds: string[] }
export interface SessionItem { id: string; name: string; category: string; timerSec: number | null; done: boolean; timerEndsAt: number | null }
export interface Session { planId: string; planName: string; startedAt: number; items: SessionItem[] }
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[];
export function startSession(plan: Workout, exercisesById: Map<string, Exercise>, now: number): Session;
export function toggleItem(session: Session, id: string): Session;
export function startTimer(session: Session, id: string, now: number): Session;
export function cancelTimer(session: Session, id: string): Session;
export function tickSession(session: Session, now: number): { session: Session; finished: string[] };
export function moveSessionItem(session: Session, id: string, delta: -1 | 1): Session;
export function timerRemainingSec(item: SessionItem, now: number): number | null;
export function elapsedSec(session: Session, now: number): number;
export function summarizeSession(session: Session, now: number): { exercisesDone: number; exercisesTotal: number; durationMin: number };
export function formatClock(totalSec: number): string;
export function normalizeExercise(input: { name: unknown; category: unknown; timerSec?: unknown }): { value: { name: string; category: string; timerSec: number | null } } | { error: string };
export function normalizeWorkout(input: { name: unknown; exerciseIds: unknown }): { value: { name: string; exerciseIds: string[] } } | { error: string };
