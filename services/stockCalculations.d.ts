export type MovementType = 'purchase' | 'consumption' | 'adjustment_in' | 'adjustment_out' | 'reversal';
export interface StockMaterial {
  id: string; name: string; category: string; unit: string; balance: number; defaultPerEvent: number; minLevel: number;
  active: boolean; description?: string; openMissionId?: string; lastMovementId?: string;
}
export interface StockMovement {
  id: string; materialId: string; materialName: string; unit: string; type: MovementType; quantity: number; delta: number;
  balanceAfter: number; date: any; note: string; orderId?: string; requested?: number; shortfall?: number; createdBy?: string | null; createdAt?: any;
}
export interface ConsumptionLine { materialId: string; quantity: number }
export interface Shortage { materialId: string; name: string; required: number; available: number; missing: number }
export const PRESENTIAL_CATEGORY: string;
export const MOVEMENT_TYPES: MovementType[];
export const MOVEMENT_LABELS: Record<MovementType, string>;
export class StockError extends Error { code: string; details: Shortage[]; constructor(code: string, message: string, details?: Shortage[]) }
export function isPresentialService(service: { category?: string } | null | undefined): boolean;
export function movementSign(type: MovementType): 1 | -1;
export function validateMaterialInput(input: Record<string, any>): string[];
export function isLowStock(material: { active?: boolean; balance: number; minLevel: number }): boolean;
export function consumptionMovementId(orderId: string, cycle: number, materialId: string): string;
export function reversalMovementId(orderId: string, cycle: number, materialId: string): string;
export function normalizeLines(lines: ConsumptionLine[]): ConsumptionLine[];
export function defaultConsumptionLines(materials: StockMaterial[]): ConsumptionLine[];
export function findShortages(materialsById: Map<string, { name?: string; balance?: number }>, requests: ConsumptionLine[]): Shortage[];
export function describeShortages(shortages: Shortage[]): string;
export function lowStockMission(material: { name: string; unit: string; minLevel: number }, balance: number): { title: string; description: string };
