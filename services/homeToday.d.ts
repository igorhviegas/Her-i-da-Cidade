export interface DeliveryToday { order: any; attention: boolean; }
export function deliveriesToday(activeOrders: any[], now?: Date): DeliveryToday[];
export interface TodayItem { key: string; title: string; time: string; status: string; }
export function tasksToday(occurrences: any[], missions: any[], now?: Date): { items: TodayItem[]; completed: number; pending: number; missed: number };
