export interface OrderReferenceInput {
  id?: string;
  orderNumberDisplay?: string;
}

export interface BirthdayPersonInput {
  content?: string;
  childName?: string;
  [key: string]: unknown;
}

/** Formats a label for display; it must never be used as a document key. */
export function formatOrderReference(order: OrderReferenceInput, orders?: OrderReferenceInput[]): string;

/** Extrai com segurança o nome do aniversariante; retorna null se ausente ou inválido. */
export function extractBirthdayPerson(order: BirthdayPersonInput | null | undefined): string | null;
