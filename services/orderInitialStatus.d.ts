import type { OrderStatus, ProductionType } from '../types';

export function resolveInitialStatus(service: { initialStatus?: OrderStatus | null; autoComplete?: boolean } | null | undefined): OrderStatus | null;
export function defaultInitialStatus(productionType: ProductionType | ''): OrderStatus | '';
