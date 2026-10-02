export function resolveNavOrder<T extends string>(defaultIds: readonly T[], saved: unknown): T[];
export function moveNavItem<T extends string>(order: readonly T[], id: T, targetId: T, position?: 'before' | 'after'): T[];
export function shiftNavItem<T extends string>(order: readonly T[], id: T, delta: -1 | 1): T[];
