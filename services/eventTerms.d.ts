export const TERMS_VERSION: string;
export const PROVIDER: { tradeName: string; legalName: string; cnpj: string; city: string };
export const DEPOSIT_DAYS: number;
export const TERMS_FIELDS: Record<string, string>;
export const TERMS_TEMPLATE: string;
export const BUILTIN_TERMS: Record<string, string>;
export interface TermsSection { title: string; items: string[] }
export interface TermsData { packageTitle?: string; duration?: string; date?: string; time?: string; location?: string; name?: string; cpf?: string; whatsapp?: string; email?: string }
export function parseTerms(text: string): TermsSection[];
export function unknownTermsFields(text: string): string[];
export function termsSections(data?: TermsData, options?: { text?: string; depositDays?: number }): TermsSection[];
