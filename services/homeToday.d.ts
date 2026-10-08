export interface DeliveryToday { order: unknown; attention: boolean; }
export function deliveriesToday(activeOrders: unknown[], now?: Date): DeliveryToday[];
export interface TodayItem { key: string; title: string; time: string; status: string; }
export function tasksToday(occurrences: unknown[], missions: unknown[], now?: Date): { items: TodayItem[]; completed: number; pending: number; missed: number };
