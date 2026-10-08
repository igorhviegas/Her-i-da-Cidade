import React from 'react';
import { CalendarPlus, Copy, Loader2, MessageCircle, Pencil, Trash2, Tv, X } from 'lucide-react';
import { getServiceColor } from '../../../services/serviceColors.js';
import { getTeleprompterText } from '../../../services/teleprompter.js';
import type { Order, OrderStatus } from '../../../types';
import { SERVICE_COLOR_CLASSES, STATUS_FLOW, STATUS_LABELS, toDate } from './orderView';
import type { OrderView } from './orderView';
import { buildContactWhatsappUrl, buildOrderRows } from './orderDetails';
import { ClientHistoryList } from './ClientHistoryList';
import type { CalendarState } from './useOrderCalendar';

interface OrderDetailsModalProps {
  selectedOrder: OrderView;
  allOrderRecords: Order[];
  /** Outros pedidos do mesmo cliente. */
  clientHistoryViews: OrderView[];
  updatingOrderId: string | null;
  deletingOrderId: string | null;
  orderActionError: string;
  calendarState: CalendarState;
  setSelectedOrder: (view: OrderView | null) => void;
  setEditOrderOpen: (open: boolean) => void;
  setDuplicateSource: (view: OrderView | null) => void;
  setTeleprompterView: (view: OrderView) => void;
  setOrderActionError: (message: string) => void;
  handleStatusChange: (orderId: string, status: OrderStatus) => Promise<boolean>;
  handleSendToCalendar: (orderId: string) => Promise<void>;
  handleDeleteOrder: (view: OrderView) => Promise<void>;
}

interface OrderDetailsHeaderProps {
  selectedOrder: OrderView;
  titleColor: string;
  isUpdatingSelectedOrder: boolean;
  updatingOrderId: string | null;
  deletingOrderId: string | null;
  setSelectedOrder: (view: OrderView | null) => void;
  setEditOrderOpen: (open: boolean) => void;
  setDuplicateSource: (view: OrderView | null) => void;
}

const OrderDetailsHeader: React.FC<OrderDetailsHeaderProps> = ({ selectedOrder, titleColor, isUpdatingSelectedOrder, updatingOrderId, deletingOrderId, setSelectedOrder, setEditOrderOpen, setDuplicateSource }) => {
  const { client, service } = selectedOrder;
  return (
    <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0D1527]/95 px-5 py-4 backdrop-blur sm:px-6">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300">Detalhes do pedido</p>
        <h2 id="order-details-title" className={`mt-1 break-words text-2xl font-extrabold leading-tight ${titleColor}`}>{client?.name || 'Cliente não encontrado'}</h2>
        <p className={`mt-0.5 break-words text-sm font-semibold ${titleColor}`}>{service?.title || 'Serviço não encontrado'}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button type="button" onClick={() => { setDuplicateSource(selectedOrder); setSelectedOrder(null); }} disabled={Boolean(updatingOrderId || deletingOrderId)} aria-label="Duplicar pedido" title="Duplicar pedido" className="rounded-lg border border-white/10 p-2 text-white/70 hover:bg-white/5 disabled:opacity-50">
          <Copy className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setEditOrderOpen(true)} disabled={Boolean(updatingOrderId || deletingOrderId)} aria-label="Editar pedido" title="Editar pedido" className="rounded-lg border border-blue-500/25 bg-blue-500/10 p-2 text-blue-200 hover:bg-blue-500/20 disabled:opacity-50">
          <Pencil className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setSelectedOrder(null)} disabled={isUpdatingSelectedOrder} aria-label="Fechar detalhes" title="Fechar" className="ml-2 rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
      </div>
    </header>
  );
};

interface OrderStatusSelectProps {
  order: Order;
  isUpdatingSelectedOrder: boolean;
  handleStatusChange: (orderId: string, status: OrderStatus) => Promise<boolean>;
}

const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({ order, isUpdatingSelectedOrder, handleStatusChange }) => (
  <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.04] px-3.5 py-3">
    <label htmlFor="order-status" className="block text-[10px] font-bold uppercase tracking-[0.12em] text-blue-200/75">Alterar status</label>
    <select
      id="order-status"
      value={order.status}
      disabled={isUpdatingSelectedOrder}
      onChange={(event) => void handleStatusChange(order.id, event.target.value as OrderStatus)}
      className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-blue-400/60 disabled:opacity-50 sm:max-w-xs"
    >
      {STATUS_FLOW.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
    </select>
    {isUpdatingSelectedOrder && <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-white/45"><Loader2 className="h-3.5 w-3.5 animate-spin" />Salvando</span>}
  </div>
);

const OrderCalendarMessage: React.FC<{ calendar: NonNullable<CalendarState> | null }> = ({ calendar }) => (
  <>
    {calendar && calendar.kind !== 'sending' && (
      <p role={calendar.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-2.5 text-xs ${calendar.kind === 'ok' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-200'}`}>
        {calendar.message}{calendar.kind === 'ok' && calendar.link && <> <a href={calendar.link} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Abrir no Google Agenda</a></>}
      </p>
    )}
  </>
);

interface OrderCalendarPanelProps {
  order: Order;
  calendar: NonNullable<CalendarState> | null;
  syncedAt: Date | null;
  updatingOrderId: string | null;
  deletingOrderId: string | null;
  handleSendToCalendar: (orderId: string) => Promise<void>;
}

const OrderCalendarPanel: React.FC<OrderCalendarPanelProps> = ({ order, calendar, syncedAt, updatingOrderId, deletingOrderId, handleSendToCalendar }) => (
  <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => void handleSendToCalendar(order.id)} disabled={calendar?.kind === 'sending' || Boolean(updatingOrderId || deletingOrderId)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-200 hover:bg-sky-500/20 disabled:opacity-50">
        {calendar?.kind === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
        {calendar?.kind === 'sending' ? 'Enviando…' : 'Enviar para Google Agenda'}
      </button>
      <span className="text-[11px] text-white/45">
        {syncedAt ? `Último envio: ${syncedAt.toLocaleString('pt-BR')}. Reenviar atualiza o mesmo evento.` : 'Ainda não enviado. Salve as alterações do pedido antes de enviar.'}
      </span>
    </div>
    <OrderCalendarMessage calendar={calendar} />
  </div>
);

interface OrderDetailsFooterProps {
  selectedOrder: OrderView;
  whatsappUrl: string | null;
  updatingOrderId: string | null;
  deletingOrderId: string | null;
  setOrderActionError: (message: string) => void;
  setTeleprompterView: (view: OrderView) => void;
  handleDeleteOrder: (view: OrderView) => Promise<void>;
}

const OrderDetailsFooter: React.FC<OrderDetailsFooterProps> = ({ selectedOrder, whatsappUrl, updatingOrderId, deletingOrderId, setOrderActionError, setTeleprompterView, handleDeleteOrder }) => {
  const { order } = selectedOrder;
  return (
    <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
      {getTeleprompterText(selectedOrder) !== null && (
        <button type="button" onClick={() => { setOrderActionError(''); setTeleprompterView(selectedOrder); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5">
          <Tv className="h-4 w-4" /> Teleprompter
        </button>
      )}
      {whatsappUrl ? (
        <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20">
          <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
        </a>
      ) : <span className="text-xs text-white/40">WhatsApp indisponível para este cliente.</span>}
      <button type="button" onClick={() => void handleDeleteOrder(selectedOrder)} disabled={Boolean(updatingOrderId || deletingOrderId)} aria-label="Excluir pedido" title="Excluir pedido" className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50 sm:ml-auto">
        {deletingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        <span>{deletingOrderId === order.id ? 'Excluindo…' : 'Excluir'}</span>
      </button>
    </div>
  );
};

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  selectedOrder,
  allOrderRecords,
  clientHistoryViews,
  updatingOrderId,
  deletingOrderId,
  orderActionError,
  calendarState,
  setSelectedOrder,
  setEditOrderOpen,
  setDuplicateSource,
  setTeleprompterView,
  setOrderActionError,
  handleStatusChange,
  handleSendToCalendar,
  handleDeleteOrder,
}) => {
  const { order, client, service } = selectedOrder;
  const isUpdatingSelectedOrder = updatingOrderId === order.id || deletingOrderId === order.id;
  const whatsappUrl = buildContactWhatsappUrl(client, service);
  const event = order.eventForm;
  const titleColor = (() => { const c = getServiceColor(service); return c ? SERVICE_COLOR_CLASSES[c].title : 'text-white'; })();
  const { technicalRows, detailRows } = buildOrderRows(selectedOrder, allOrderRecords);
  const calendar = calendarState?.orderId === order.id ? calendarState : null;
  const syncedAt = toDate(order.googleCalendar?.syncedAt);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingOrderId) setSelectedOrder(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="order-details-title" className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
        <OrderDetailsHeader selectedOrder={selectedOrder} titleColor={titleColor} isUpdatingSelectedOrder={isUpdatingSelectedOrder} updatingOrderId={updatingOrderId} deletingOrderId={deletingOrderId} setSelectedOrder={setSelectedOrder} setEditOrderOpen={setEditOrderOpen} setDuplicateSource={setDuplicateSource} />

        <div className="space-y-5 p-5 sm:p-6">
          {orderActionError && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">{orderActionError}</p>}
          <OrderStatusSelect order={order} isUpdatingSelectedOrder={isUpdatingSelectedOrder} handleStatusChange={handleStatusChange} />

          <dl className="grid gap-x-5 sm:grid-cols-2">
            {detailRows.map(([label, value]) => (
              <div key={label} className="min-w-0 border-b border-white/[0.07] py-2.5">
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">{label}</dt>
                <dd className={`mt-0.5 break-words text-sm ${label === 'Total pago' ? 'font-extrabold text-emerald-300' : 'text-white/85'}`}>{value}</dd>
              </div>
            ))}
          </dl>
          {order.eventDraft && (
            <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-100">
              Pedido recebido pelo ManyChat com cliente e WhatsApp. Faltam os dados do evento: use "Editar pedido" para completar. Nada foi lançado no Financeiro ainda.
            </p>
          )}
          {!event && (
            <div className="border-b border-white/[0.07] pb-3">
              <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Conteúdo</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/85">{order.content || '—'}</p>
            </div>
          )}
          {event && <OrderCalendarPanel order={order} calendar={calendar} syncedAt={syncedAt} updatingOrderId={updatingOrderId} deletingOrderId={deletingOrderId} handleSendToCalendar={handleSendToCalendar} />}

          <details open className="border-b border-white/[0.07] pb-3">
            <summary className="cursor-pointer select-none text-[10px] font-bold uppercase tracking-[0.12em] text-white/40 hover:text-white/60">Histórico do cliente ({clientHistoryViews.length})</summary>
            <div className="mt-2 max-h-72 overflow-y-auto pr-1"><ClientHistoryList views={clientHistoryViews} /></div>
          </details>

          <OrderDetailsFooter selectedOrder={selectedOrder} whatsappUrl={whatsappUrl} updatingOrderId={updatingOrderId} deletingOrderId={deletingOrderId} setOrderActionError={setOrderActionError} setTeleprompterView={setTeleprompterView} handleDeleteOrder={handleDeleteOrder} />

          <details className="group border-t border-white/[0.07] pt-3">
            <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-[0.12em] text-white/35 hover:text-white/60">Informações técnicas</summary>
            <dl className="mt-2 grid gap-x-5 sm:grid-cols-2">
              {technicalRows.map(([label, value]) => (
                <div key={label} className="min-w-0 py-1.5">
                  <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">{label}</dt>
                  <dd className="mt-0.5 break-all text-sm text-white/70">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </section>
    </div>
  );
};
