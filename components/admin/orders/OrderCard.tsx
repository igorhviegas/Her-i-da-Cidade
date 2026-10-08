import React from 'react';
import { CalendarPlus, CheckCircle2, Loader2, MessageCircle, Pencil, Tv } from 'lucide-react';
import { buildDeliveryWhatsAppUrl } from '../../../services/digitalDelivery.js';
import { extractBirthdayPerson, formatOrderReference } from '../../../services/orderReference.js';
import { getServiceColor } from '../../../services/serviceColors.js';
import { getTeleprompterText } from '../../../services/teleprompter.js';
import type { Order, OrderStatus } from '../../../types';
import { SERVICE_COLOR_CLASSES, deadlineState, formatDate, formatMoney } from './orderView';
import type { OrderView } from './orderView';
import type { CalendarState } from './useOrderCalendar';

/** Estado e ações da página que o card (e as colunas do Kanban) precisam. */
export interface OrderCardContext {
  allOrderRecords: Order[];
  updatingOrderId: string | null;
  deletingOrderId: string | null;
  calendarState: CalendarState;
  setSelectedOrder: (view: OrderView) => void;
  setEditOrderOpen: (open: boolean) => void;
  setOrderActionError: (message: string) => void;
  setDraggingOrderId: (id: string | null) => void;
  setDragOverStatus: (status: OrderStatus | null) => void;
  setTeleprompterView: (view: OrderView) => void;
  handleSendToCalendar: (orderId: string) => Promise<void>;
  handleCompleteOrder: (view: OrderView) => Promise<void>;
}

export const OrderCard: React.FC<OrderView & OrderCardContext> = ({
  order,
  client,
  service,
  script,
  allOrderRecords,
  updatingOrderId,
  deletingOrderId,
  calendarState,
  setSelectedOrder,
  setEditOrderOpen,
  setOrderActionError,
  setDraggingOrderId,
  setDragOverStatus,
  setTeleprompterView,
  handleSendToCalendar,
  handleCompleteOrder,
}) => {
  const state = deadlineState(order.internalDueDate);
  const internalDate = formatDate(order.internalDueDate);
  const eventDate = formatDate(order.eventDate);
  const childName = extractBirthdayPerson(order);
  // Vídeo Chamada agendada pelo site para outro número: a mensagem do dia vai para o número da chamada, não para o de contato.
  const deliveryUrl = buildDeliveryWhatsAppUrl(order.videoCall?.callWhatsapp ? `+${order.videoCall.callWhatsapp}` : client?.whatsapp, order, service);
  const serviceColor = getServiceColor(service);
  const colorClasses = serviceColor ? SERVICE_COLOR_CLASSES[serviceColor] : null;
  const completing = updatingOrderId === order.id;
  return (
    <article
      key={order.id}
      role="button"
      tabIndex={0}
      draggable={updatingOrderId !== order.id}
      aria-haspopup="dialog"
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', order.id);
        setDraggingOrderId(order.id);
      }}
      onDragEnd={() => { setDraggingOrderId(null); setDragOverStatus(null); }}
      onClick={() => { setSelectedOrder({ order, client, service, script }); setEditOrderOpen(false); setOrderActionError(''); }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setSelectedOrder({ order, client, service, script });
          setOrderActionError('');
        }
      }}
      className={`cursor-pointer rounded-xl border bg-[#0D1527] ${colorClasses?.card ?? ''} p-3.5 shadow-lg outline-none transition-colors hover:border-blue-400/50 focus-visible:ring-2 focus-visible:ring-blue-400 ${order.scriptId ? 'ring-1 ring-inset ring-blue-400/10' : ''} ${state === 'overdue' ? 'border-red-500/45' : state === 'soon' ? 'border-amber-400/35' : 'border-white/10'}`}
    >
      <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/35">Pedido {formatOrderReference(order, allOrderRecords)}</p>
      <h4 className="truncate text-sm font-bold text-white">{client?.name || 'Cliente não encontrado'}</h4>
      <p className={`mt-0.5 truncate text-xs ${colorClasses ? `font-semibold ${colorClasses.title}` : 'text-white/55'}`}>{service?.title || 'Serviço não encontrado'}</p>
      {childName && <p className="mt-0.5 truncate text-xs text-white/70">Criança: <span className="font-semibold text-white/90">{childName}</span></p>}
      {order.scriptId && <p className="mt-1 truncate text-[11px] text-blue-200/75"><span className="mr-1 rounded bg-blue-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Roteiro</span>{script?.title || 'Roteiro não encontrado'}</p>}
      {(eventDate || internalDate) && (
        <div className="mt-3 space-y-1 border-t border-white/5 pt-2.5 text-[11px]">
          {eventDate && <p className="text-white/55">Evento/entrega: <span className="text-white/80">{eventDate}</span></p>}
          {internalDate && <p className={state === 'overdue' ? 'font-semibold text-red-300' : state === 'soon' ? 'font-semibold text-amber-200' : 'text-white/55'}>
            Interno: <span>{internalDate}{state === 'overdue' ? ' · Vencido' : state === 'soon' ? ' · Próximo' : ''}</span>
          </p>}
        </div>
      )}
      {order.paymentPending && order.videoCall && <p className="mt-3 text-xs font-bold text-amber-300">⏳ Aguardando pagamento · Chamada {order.videoCall.date.split('-').reverse().join('/')} às {order.videoCall.time}</p>}
      {order.eventDraft ? <p className="mt-3 text-xs font-bold text-amber-300">⚠ Dados do evento pendentes</p> : order.paymentPending ? null : <p className="mt-3 text-sm font-extrabold text-emerald-300">{formatMoney(order.totalPaid)}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {order.eventDraft ? (
          <button
            type="button"
            draggable={false}
            onClick={(event) => { event.stopPropagation(); setSelectedOrder({ order, client, service, script }); setOrderActionError(''); setEditOrderOpen(true); }}
            onKeyDown={(event) => event.stopPropagation()}
            className="inline-flex min-h-11 flex-[2_1_130px] items-center justify-center gap-2 rounded-lg border border-blue-400/40 bg-blue-500/15 px-3 text-xs font-bold text-blue-100 hover:bg-blue-500/25"
          >
            <Pencil className="h-4 w-4 shrink-0" /> Completar cadastro
          </button>
        ) : order.eventForm ? (
          <button
            type="button"
            draggable={false}
            disabled={calendarState?.kind === 'sending' || Boolean(updatingOrderId || deletingOrderId)}
            onClick={(event) => { event.stopPropagation(); void handleSendToCalendar(order.id); }}
            onKeyDown={(event) => event.stopPropagation()}
            className="inline-flex min-h-11 flex-[2_1_130px] items-center justify-center gap-2 rounded-lg border border-orange-500/30 bg-orange-500/15 px-3 text-xs font-bold text-orange-100 hover:bg-orange-500/25 disabled:opacity-60"
          >
            {calendarState?.orderId === order.id && calendarState.kind === 'sending' ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <CalendarPlus className="h-4 w-4 shrink-0" />}
            {calendarState?.orderId === order.id && calendarState.kind === 'sending' ? 'Enviando…' : 'Enviar para Google Agenda'}
          </button>
        ) : (deliveryUrl ? (
          <a
            href={deliveryUrl}
            target="_blank"
            rel="noopener noreferrer"
            draggable={false}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="inline-flex min-h-11 flex-[2_1_130px] items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-100 hover:bg-emerald-500/25"
          >
            <MessageCircle className="h-4 w-4 shrink-0" /> Enviar pelo WhatsApp
          </a>
        ) : order.status === 'delivery' ? <p className="w-full text-[11px] text-white/35">WhatsApp indisponível</p> : null)}
        {order.eventForm && calendarState?.orderId === order.id && calendarState.kind !== 'sending' && (
          <p role={calendarState.kind === 'error' ? 'alert' : 'status'} className={`w-full text-[11px] ${calendarState.kind === 'ok' ? 'text-emerald-300' : 'text-red-300'}`}>{calendarState.message}</p>
        )}
        {getTeleprompterText({ order, service, script }) !== null && (
          <button
            type="button"
            draggable={false}
            title="Abrir teleprompter"
            aria-label="Abrir teleprompter"
            onClick={(event) => { event.stopPropagation(); setOrderActionError(''); setTeleprompterView({ order, client, service, script }); }}
            onKeyDown={(event) => event.stopPropagation()}
            className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <Tv className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          draggable={false}
          disabled={Boolean(updatingOrderId || deletingOrderId)}
          onClick={(event) => { event.stopPropagation(); void handleCompleteOrder({ order, client, service, script }); }}
          onKeyDown={(event) => event.stopPropagation()}
          className="inline-flex min-h-11 flex-[1_1_90px] items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {completing ? 'Concluindo…' : 'Concluir'}
        </button>
      </div>
    </article>
  );
};
