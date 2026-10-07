export interface ServiceFaqItem {
  id: string;
  title: string;
  content: string;
}
export function slugify(value: unknown): string;
export function normalizeFaq(raw: unknown): ServiceFaqItem[];
export function findServiceBySlug<T extends { title: string }>(services: readonly T[] | null | undefined, slug: string): T | null;
