import { toDate } from '../../../services/financeCalculations.js';
import type { MovementType, StockMaterial, StockMovement } from '../../../services/stockService';

export type StockMode = { kind: 'new' } | { kind: 'edit' | 'entry' | 'adjust'; material: StockMaterial };
export const blank = { name: '', category: 'Eventos presenciais', unit: 'unidade', defaultPerEvent: '0', minLevel: '0', initialBalance: '0', description: '', active: true, quantity: '', newBalance: '', note: '', date: '' };
export type StockForm = typeof blank;
export interface StockFilters { materialId: string; type: '' | MovementType; from: string; to: string; order: string }

export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const dayStart = (v: string) => new Date(`${v}T00:00:00`);
const dayEnd = (v: string) => new Date(`${v}T23:59:59.999`);
export const int = (v: string) => (v.trim() === '' ? NaN : Number(v));

function matchesIdentity(m: StockMovement, filters: StockFilters) {
  return (!filters.materialId || m.materialId === filters.materialId) && (!filters.type || m.type === filters.type)
    && (!filters.order || (m.orderId ?? '').toLowerCase().includes(filters.order.trim().toLowerCase()));
}

function matchesPeriod(at: ReturnType<typeof toDate>, filters: StockFilters) {
  return (!filters.from || (at && at >= dayStart(filters.from))) && (!filters.to || (at && at <= dayEnd(filters.to)));
}

/** Filtros do histórico de movimentações (material, tipo, pedido e período). */
export function matchesMovementFilters(m: StockMovement, filters: StockFilters) {
  return matchesIdentity(m, filters) && matchesPeriod(toDate(m.date), filters);
}
