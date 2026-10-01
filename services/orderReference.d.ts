export interface OrderReferenceInput {
  id?: string;
  orderNumberDisplay?: string;
}

/** Formats a label for display; it must never be used as a document key. */
export function formatOrderReference(order: OrderReferenceInput, orders?: OrderReferenceInput[]): string;
