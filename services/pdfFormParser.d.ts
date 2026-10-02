export type Confidence = 'high' | 'medium' | 'low';
export interface ParsedField { value: string; label: string; confidence: Confidence; parsed?: string; notes: string[] }
export interface ParsedForm {
  fields: Partial<Record<'childName' | 'clientName' | 'whatsapp' | 'eventDate' | 'eventTime' | 'address' | 'age' | 'extras', ParsedField>>;
  others: { label: string; value: string }[];
  childrenCount: number;
  warnings: string[];
}
export const FIELD_DEFS: { key: string; label: string; keywords: string[] }[];
export function normalizeLabel(s: string): string;
export function classifyLabel(label: string): { key: string; level: Confidence } | null;
export function parseDate(text: string, today?: Date): { iso: string; ambiguous: boolean } | null;
export function parseTime(text: string): string | null;
export function normalizeWhatsApp(text: string): string | null;
export function extractPairs(text: string): { label: string; value: string }[];
export function parseFormText(text: string, options?: { ocr?: boolean; today?: Date }): ParsedForm;
export function buildOrderContent(parsed: ParsedForm): string;
export function toOrderFormValues(parsed: ParsedForm): { name: string; whatsapp: string; eventDate: string; content: string };
export function importFingerprint(text: string): Promise<string>;
