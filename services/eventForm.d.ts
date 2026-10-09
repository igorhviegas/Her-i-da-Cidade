export interface EventFormValues {
  childName: string;
  /** 'YYYY-MM-DD' (só no retorno da validação; no pedido a data fica em `eventDate`). */
  eventDate: string;
  eventTime: string;
  location: string;
  imageAuthorization: boolean;
  extraWeb: 0 | 1 | 2;
  totalValue: number;
  entryValue: number;
  /** null = ainda não informado (obrigatório só para concluir). */
  cost: number | null;
  observations: string;
  formType: string;
  birthDate: string;
  pcd: boolean | null;
}
export interface EventFormInput {
  childName: string; eventDate: string; eventTime: string; location: string; imageAuthorization: '' | 'yes' | 'no';
  extraWeb: string; totalValue: string; entryValue: string; cost: string; observations: string; formType: string;
  /** Opcionais: 'YYYY-MM-DD' ou ''; '' | 'yes' | 'no'. */
  birthDate?: string; pcd?: '' | 'yes' | 'no';
}
export const EXTRA_WEB_OPTIONS: number[];
export function roundMoney(value: number): number;
/** Valor monetário digitado ("1,90" ou 1.9) -> número em centavos; null se vazio, negativo ou inválido. */
export function money(text: string | number | null | undefined): number | null;
export function defaultEntry(total: number): number;
export function isValidDateInput(value: string): boolean;
export function isValidTimeInput(value: string): boolean;
export function validateEventForm(form: EventFormInput): { error: string; value?: undefined } | { value: EventFormValues; error?: undefined };
export function eventContentSummary(event: { formType: string; childName: string; eventTime: string; location: string; observations?: string }): string;
