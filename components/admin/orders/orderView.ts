import type { Client, ContentScript, Order, OrderStatus, Service } from '../../../types';
import type { ServiceColor } from '../../../services/serviceColors.js';

export type OrderView = { order: Order; client?: Client | null; service?: Service | null; script?: ContentScript | null };
export const COLUMNS = [
  { status: 'delivery', label: 'ENTREGAR', accent: 'border-emerald-400' },
  { status: 'recording', label: 'GRAVAR', accent: 'border-amber-400' },
  { status: 'editing', label: 'EDITAR', accent: 'border-violet-400' },
  { status: 'scheduled', label: 'AGENDADO', accent: 'border-blue-400' },
  { status: 'completed', label: 'CONCLUÍDO', accent: 'border-slate-400' },
] as const;

// Classes estáticas (o Tailwind precisa enxergá-las por completo): fundo do card e título do serviço.
export const SERVICE_COLOR_CLASSES: Record<ServiceColor, { card: string; title: string }> = {
  red: { card: 'bg-gradient-to-b from-red-500/10 to-red-500/10', title: 'text-red-300' },
  yellow: { card: 'bg-gradient-to-b from-yellow-400/10 to-yellow-400/10', title: 'text-yellow-300' },
  blue: { card: 'bg-gradient-to-b from-blue-500/10 to-blue-500/10', title: 'text-blue-300' },
  purple: { card: 'bg-gradient-to-b from-purple-500/10 to-purple-500/10', title: 'text-purple-300' },
  green: { card: 'bg-gradient-to-b from-green-500/10 to-green-500/10', title: 'text-green-300' },
};

export function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as { toDate?: () => Date })?.toDate === 'function') return (value as { toDate?: () => Date }).toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDate(value: unknown): string | null {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date) : null;
}

export const STATUS_FLOW: OrderStatus[] = ['scheduled', 'recording', 'editing', 'delivery', 'completed'];
export const STATUS_LABELS: Record<OrderStatus, string> = {
  scheduled: 'Agendado', recording: 'Gravar', editing: 'Editar', delivery: 'Entregar', completed: 'Concluído',
};

export function displayDate(value: unknown): string {
  return formatDate(value) || '—';
}

export function displayDays(value: number | undefined): string {
  return value === undefined ? 'Sem prazo' : `${value} ${value === 1 ? 'dia corrido' : 'dias corridos'}`;
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function deadlineState(value: unknown): 'overdue' | 'soon' | 'normal' {
  const date = toDate(value);
  if (!date) return 'normal';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  return days < 0 ? 'overdue' : days <= 2 ? 'soon' : 'normal';
}

export function dueTime(order: Order): number {
  return (toDate(order.internalDueDate) ?? toDate(order.eventDate))?.getTime() ?? Number.POSITIVE_INFINITY;
}

/** Outros pedidos do mesmo cliente (concluídos ou não), do mais recente para o mais antigo. */
export function clientHistory(views: OrderView[], current: OrderView): OrderView[] {
  const { id, clientId } = current.order;
  const time = ({ order }: OrderView) => (toDate(order.createdAt) ?? toDate(order.paidAt))?.getTime() ?? 0;
  return views.filter(({ order }) => order.clientId === clientId && order.id !== id).sort((a, b) => time(b) - time(a));
}
