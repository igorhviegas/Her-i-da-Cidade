import type { ScriptProductionStatus, ScriptPublicationStatus } from '../../../types';
import { toDate } from './scriptsHelpers';

export const productionOptions: Array<[ScriptProductionStatus, string]> = [
  ['draft', 'Rascunho'],
  ['ready', 'Pronto para gravar'],
  ['in_production', 'Em produção'],
  ['produced', 'Produzido'],
];
export const publicationOptions: Array<[ScriptPublicationStatus, string]> = [
  ['unpublished', 'Não publicado'],
  ['published', 'Publicado'],
];
export const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
export const labelClass = 'block text-xs font-semibold text-white/70';

export function dateInput(value: unknown): string {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDate(value: unknown): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—';
}

export function dateFromInput(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function todayInput(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
