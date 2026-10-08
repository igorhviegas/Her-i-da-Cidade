import type { Firestore, Transaction } from 'firebase/firestore';
import type { ConsumptionLine } from './stockCalculations';
export const STOCK_MATERIALS: string;
export const STOCK_MOVEMENTS: string;
export const STOCK_CONSUMPTIONS: string;
export const STOCK_PENDINGS: string;
export const MISSIONS: string;
export function pendingId(orderId: string, cycle: number, materialId: string): string;
export interface MovementRequest { materialId: string; type: string; quantity: number; orderId?: string; note?: string; movementId?: string; date?: Date; extra?: Record<string, unknown> }
export interface Prepared { apply(): void }
export function prepareMovements(tx: Transaction, firestore: Firestore, requests: MovementRequest[], options?: { actor?: string | null; allowInactiveMaterials?: boolean }): Promise<Prepared & { results: unknown[] }>;
export function prepareOrderConsumption(tx: Transaction, firestore: Firestore, args: { orderId: string; lines: ConsumptionLine[]; actor: string | null; date?: Date; allowShortage?: boolean }): Promise<Prepared>;
export function prepareOrderReversal(tx: Transaction, firestore: Firestore, args: { orderId: string; actor: string | null; date?: Date }): Promise<Prepared>;
