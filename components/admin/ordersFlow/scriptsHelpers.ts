import { logger } from '../../../lib/logger.js';
import type { ScriptProductionStatus, ScriptPublicationStatus } from '../../../types';

export const productionLabels: Record<ScriptProductionStatus, string> = {
  draft: 'Rascunho', ready: 'Pronto para gravar', in_production: 'Em produção', produced: 'Produzido',
};
export const publicationLabels: Record<ScriptPublicationStatus, string> = {
  unpublished: 'Não publicado', published: 'Publicado',
};
export const productionStyles: Record<ScriptProductionStatus, string> = {
  draft: 'border-slate-400/20 bg-slate-400/10 text-slate-200',
  ready: 'border-blue-400/20 bg-blue-400/10 text-blue-200',
  in_production: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  produced: 'border-violet-400/20 bg-violet-400/10 text-violet-200',
};

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') return (value as { toDate?: () => Date }).toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: unknown): string {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date) : '—';
}

export function logScriptOperationError(operation: string, error: unknown): void {
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`[AdminScriptsPage] Falha na operação: ${operation}`, { error, stack });
}
