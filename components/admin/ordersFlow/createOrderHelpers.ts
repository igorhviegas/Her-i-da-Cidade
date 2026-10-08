import type { Order, OrderStatus, ProductionType, Service } from '../../../types';
import { isPresentialService } from '../../../services/stockCalculations.js';
import { resolveInitialStatus } from '../../../services/orderInitialStatus.js';

export interface CreateOrderInitialValues {
  name: string;
  whatsapp: string;
  serviceId: string;
  eventDate?: Date;
  deliveryDays?: number;
  content: string;
  servicePrice: number;
  rushFee: number;
  totalPaid: number;
  /** Duplicação de pedido de evento: pré-preenche o formulário manual (nenhum lançamento financeiro é copiado). */
  eventForm?: Order['eventForm'];
  childName?: string;
}

export const statusLabels: Record<OrderStatus, string> = {
  scheduled: 'Agendado', recording: 'Gravar', editing: 'Editar', delivery: 'Entregar', completed: 'Concluído imediatamente',
};
export const productionLabels: Record<ProductionType, string> = {
  scheduled: 'Agendado', recording: 'Gravação', editing: 'Edição', immediate: 'Imediato',
};

export function dateFromInput(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function formatShortDate(value: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(value);
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function dateInput(value?: Date): string {
  if (!value || Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

/** Obtém o valor anunciado quando existe; serviços "sob consulta" iniciam em branco. */
export function priceFromService(value: string): string {
  const currencyAmount = value.match(/R\$\s*([\d.,]+)/i)?.[1];
  const amount = currencyAmount || value.match(/[\d.,]+/)?.[0];
  if (!amount) return '';
  const normalized = amount.includes(',')
    ? amount.replace(/\./g, '').replace(',', '.')
    : amount;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : '';
}

export function inputAmount(value: string): number | null {
  if (!value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
export const labelClass = 'block text-xs font-semibold text-white/70';

/** Estado derivado do serviço escolhido: evento presencial, configuração de pedido e status inicial. */
export function deriveServiceState(selectedService: Service | undefined) {
  // Eventos presenciais usam o formulário manual de evento (entrada na criação; 2ª parcela e despesa na conclusão).
  const isEvent = isPresentialService(selectedService);
  const serviceConfigured = Boolean(
    selectedService && selectedService.generateOrder === true && selectedService.productionType &&
    (selectedService.initialStatus || selectedService.autoComplete),
  );
  const initialStatus: OrderStatus | null = selectedService ? resolveInitialStatus(selectedService) : null;
  return { isEvent, serviceConfigured, initialStatus };
}

export function computeTotal(totalPaid: string, servicePrice: string, rushFee: string): number {
  return totalPaid.trim() ? inputAmount(totalPaid) ?? 0 : (inputAmount(servicePrice) ?? 0) + (inputAmount(rushFee) ?? 0);
}

export function buildDeliveryOptions(selectedService: Service | undefined): number[] {
  const deliveryOptions = [7, 4, 2];
  if (selectedService?.defaultDeliveryDays && !deliveryOptions.includes(selectedService.defaultDeliveryDays)) {
    deliveryOptions.push(selectedService.defaultDeliveryDays);
  }
  return deliveryOptions;
}

/** Mostra o erro do formulário e interrompe a validação (retorna undefined). */
export function fail(setFormError: (message: string) => void, message: string): undefined {
  setFormError(message);
  return undefined;
}
