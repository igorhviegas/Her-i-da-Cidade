export const TERMS_VERSION: string;
export const PROVIDER: { tradeName: string; legalName: string; cnpj: string; city: string };
export const DEPOSIT_DAYS: number;
export const RESCHEDULE_NOTICE_DAYS: number;
export const CREDIT_MONTHS: number;
export const WAIT_MINUTES: number;
export interface TermsData { number?: string; packageTitle?: string; duration?: string; date?: string; time?: string; location?: string; name?: string; cpf?: string; whatsapp?: string; email?: string }
export function termsSections(data?: TermsData): { title: string; items: string[] }[];
