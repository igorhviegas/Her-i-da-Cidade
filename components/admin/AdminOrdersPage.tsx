import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Loader2, MessageCircle, Plus, Search, X } from 'lucide-react';
import { getClientById, normalizeWhatsApp } from '../../services/clientsService';
import { completeOrder, listOrders, updateOrder } from '../../services/ordersService';
import { getServiceById } from '../../services/servicesService';
import type { Client, Order, OrderStatus, Service } from '../../types';
import { CreateOrderModal } from './CreateOrderModal';

type OrderView = { order: Order; client?: Client | null; service?: Service | null };
const COLUMNS = [
  { status: 'scheduled', label: 'AGENDADO', accent: 'border-blue-400' },
  { status: 'recording', label: 'GRAVAR', accent: 'border-amber-400' },
  { status: 'editing', label: 'EDITAR', accent: 'border-violet-400' },
  { status: 'delivery', label: 'ENTREGAR', accent: 'border-emerald-400' },
] as const;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as any)?.toDate === 'function') return (value as any).toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: unknown): string | null {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date) : null;
}

const STATUS_FLOW: OrderStatus[] = ['scheduled', 'recording', 'editing', 'delivery', 'completed'];
const STATUS_LABELS: Record<OrderStatus, string> = {
  scheduled: 'Agendado', recording: 'Gravar', editing: 'Editar', delivery: 'Entregar', completed: 'Concluído',
};

function displayDate(value: unknown): string {
  return formatDate(value) || '—';
}

function displayDays(value: number | undefined): string {
  return value === undefined ? 'Sem prazo' : `${value} ${value === 1 ? 'dia corrido' : 'dias corridos'}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function deadlineState(value: unknown): 'overdue' | 'soon' | 'normal' {
  const date = toDate(value);
  if (!date) return 'normal';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  return days < 0 ? 'overdue' : days <= 2 ? 'soon' : 'normal';
}

function dueTime(order: Order): number {
  return toDate(order.internalDueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
}

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderView | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState(false);
  const [orderActionError, setOrderActionError] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allOrders = await listOrders();
      setTotalOrderCount(allOrders.length);
      const visibleOrders = allOrders.filter((order) => order.status !== 'completed');
      const clientIds = [...new Set(visibleOrders.map((order) => order.clientId).filter(Boolean))];
      const serviceIds = [...new Set(visibleOrders.map((order) => order.serviceId).filter(Boolean))];
      const [clients, services] = await Promise.all([
        Promise.all(clientIds.map((id) => getClientById(id))),
        Promise.all(serviceIds.map((id) => getServiceById(id))),
      ]);
      const clientsById = new Map(clientIds.map((id, index) => [id, clients[index]]));
      const servicesById = new Map(serviceIds.map((id, index) => [id, services[index]]));
      setOrders(visibleOrders.map((order) => ({
        order,
        client: clientsById.get(order.clientId),
        service: servicesById.get(order.serviceId),
      })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 4500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const handleOrderCreated = async () => {
    setCreateOpen(false);
    setSuccess('Pedido criado com sucesso.');
    await loadOrders();
  };

  const handleStatusChange = async (status: OrderStatus) => {
    if (!selectedOrder || updatingOrder) return;
    setUpdatingOrder(true);
    setOrderActionError('');
    try {
      if (status === 'completed') {
        await completeOrder(selectedOrder.order.id);
        setSelectedOrder(null);
        setSuccess('Pedido marcado como concluído.');
      } else {
        await updateOrder(selectedOrder.order.id, { status });
        setSelectedOrder((current) => current ? { ...current, order: { ...current.order, status } } : current);
        setSuccess(`Pedido movido para ${STATUS_LABELS[status].toLocaleLowerCase('pt-BR')}.`);
      }
      await loadOrders();
    } catch (actionError) {
      setOrderActionError(actionError instanceof Error ? actionError.message : 'Não foi possível atualizar o pedido.');
    } finally {
      setUpdatingOrder(false);
    }
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return orders.filter(({ client, service }) => !term ||
      (client?.name || '').toLocaleLowerCase('pt-BR').includes(term) ||
      (service?.title || '').toLocaleLowerCase('pt-BR').includes(term));
  }, [orders, search]);

  return (
    <section className="animate-in fade-in duration-200 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Central do Herói</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Pedidos</h2>
          <p className="mt-1 text-sm text-white/50">Acompanhe cada pedido por etapa de produção.</p>
        </div>
        <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <label className="relative block sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente ou serviço"
              aria-label="Buscar pedidos por cliente ou serviço"
              className="w-full rounded-xl border border-white/10 bg-[#0D1527] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-blue-500/60"
            />
          </label>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" /> Novo Pedido
          </button>
        </div>
      </div>

      {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{success}</div>}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> Não foi possível carregar os pedidos. {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-52 items-center justify-center gap-3 text-sm text-white/55">
          <Loader2 className="h-5 w-5 animate-spin text-blue-400" /> Carregando pedidos...
        </div>
      ) : !error && totalOrderCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#0D1527]/60 px-5 py-14 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-white/30" />
          <p className="mt-3 text-base font-semibold text-white">Você ainda não possui pedidos.</p>
          <p className="mt-1 text-sm text-white/45">Quando houver pedidos, eles aparecerão organizados por etapa.</p>
        </div>
      ) : !error && orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#0D1527]/60 px-5 py-10 text-center text-sm text-white/50">
          Não há pedidos em andamento.
        </div>
      ) : !error && filteredOrders.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-[#0D1527] p-5 text-center text-sm text-white/55">Nenhum pedido encontrado para essa busca.</p>
      ) : !error ? (
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="grid min-w-max grid-cols-4 gap-3 lg:min-w-0 lg:gap-4">
            {COLUMNS.map((column) => {
              const columnOrders = filteredOrders
                .filter(({ order }) => order.status === column.status)
                .sort((a, b) => dueTime(a.order) - dueTime(b.order));
              return (
                <section key={column.status} aria-label={column.label} className="w-[min(78vw,290px)] lg:w-auto lg:min-w-0">
                  <header className={`mb-3 flex items-center justify-between border-t-2 ${column.accent} rounded-t-sm bg-[#0B1120] px-3 py-3`}>
                    <h3 className="text-xs font-extrabold tracking-[0.12em] text-white/80">{column.label}</h3>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/65">{columnOrders.length}</span>
                  </header>
                  <div className="space-y-2.5">
                    {columnOrders.map(({ order, client, service }) => {
                      const state = deadlineState(order.internalDueDate);
                      const internalDate = formatDate(order.internalDueDate);
                      const eventDate = formatDate(order.eventDate);
                      return (
                        <article
                          key={order.id}
                          role="button"
                          tabIndex={0}
                          aria-haspopup="dialog"
                          onClick={() => { setSelectedOrder({ order, client, service }); setOrderActionError(''); }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              setSelectedOrder({ order, client, service });
                              setOrderActionError('');
                            }
                          }}
                          className={`cursor-pointer rounded-xl border bg-[#0D1527] p-3.5 shadow-lg outline-none transition-colors hover:border-blue-400/50 focus-visible:ring-2 focus-visible:ring-blue-400 ${state === 'overdue' ? 'border-red-500/45' : state === 'soon' ? 'border-amber-400/35' : 'border-white/10'}`}
                        >
                          <h4 className="truncate text-sm font-bold text-white">{client?.name || 'Cliente não encontrado'}</h4>
                          <p className="mt-0.5 truncate text-xs text-white/55">{service?.title || 'Serviço não encontrado'}</p>
                          {(eventDate || internalDate) && (
                            <div className="mt-3 space-y-1 border-t border-white/5 pt-2.5 text-[11px]">
                              {eventDate && <p className="text-white/55">Evento/entrega: <span className="text-white/80">{eventDate}</span></p>}
                              {internalDate && <p className={state === 'overdue' ? 'font-semibold text-red-300' : state === 'soon' ? 'font-semibold text-amber-200' : 'text-white/55'}>
                                Interno: <span>{internalDate}{state === 'overdue' ? ' · Vencido' : state === 'soon' ? ' · Próximo' : ''}</span>
                              </p>}
                            </div>
                          )}
                          <p className="mt-3 text-sm font-extrabold text-emerald-300">{formatMoney(order.totalPaid)}</p>
                        </article>
                      );
                    })}
                    {columnOrders.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/30">Nenhum pedido nesta etapa</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {createOpen && <CreateOrderModal onClose={() => setCreateOpen(false)} onCreated={handleOrderCreated} />}
      {selectedOrder && (() => {
        const { order, client, service } = selectedOrder;
        const currentStatusIndex = STATUS_FLOW.indexOf(order.status);
        const previousStatus = currentStatusIndex > 0 ? STATUS_FLOW[currentStatusIndex - 1] : null;
        const nextStatus = currentStatusIndex >= 0 && currentStatusIndex < STATUS_FLOW.length - 1 ? STATUS_FLOW[currentStatusIndex + 1] : null;
        let whatsappUrl: string | null = null;
        if (client?.whatsapp) {
          try {
            const phone = normalizeWhatsApp(client.whatsapp);
            const message = `Olá, ${client.name}! Estou entrando em contato sobre seu pedido de ${service?.title || 'serviço'} na Central do Herói.`;
            whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
          } catch {
            whatsappUrl = null;
          }
        }
        const detailRows: Array<[string, string]> = [
          ['Cliente', client?.name || 'Cliente não encontrado'],
          ['WhatsApp', client?.whatsapp || '—'],
          ['Serviço', service?.title || 'Serviço não encontrado'],
          ['Status', STATUS_LABELS[order.status] || order.status],
          ['Data do pagamento', displayDate(order.paidAt)],
          ['Data do evento/entrega', displayDate(order.eventDate)],
          ['Prazo contratado', displayDays(order.deliveryDays)],
          ['Prazo do cliente', displayDate(order.customerDueDate)],
          ['Prazo interno', displayDate(order.internalDueDate)],
          ['Valor do serviço', formatMoney(order.servicePrice)],
          ['Taxa de urgência', formatMoney(order.rushFee)],
          ['Total pago', formatMoney(order.totalPaid)],
        ];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingOrder) setSelectedOrder(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="order-details-title" className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
              <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0D1527]/95 px-5 py-4 backdrop-blur sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300">Detalhes do pedido</p>
                  <h2 id="order-details-title" className="mt-1 truncate text-lg font-bold text-white">{client?.name || 'Cliente não encontrado'}</h2>
                  <p className="mt-0.5 truncate text-sm text-white/50">{service?.title || 'Serviço não encontrado'}</p>
                </div>
                <button type="button" onClick={() => setSelectedOrder(null)} disabled={updatingOrder} aria-label="Fechar detalhes" className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
              </header>

              <div className="space-y-5 p-5 sm:p-6">
                {orderActionError && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">{orderActionError}</p>}
                <dl className="grid gap-3 sm:grid-cols-2">
                  {detailRows.map(([label, value]) => (
                    <div key={label} className="min-w-0 rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-3">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">{label}</dt>
                      <dd className={`mt-1 break-words text-sm ${label === 'Total pago' ? 'font-extrabold text-emerald-300' : 'text-white/85'}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="rounded-xl border border-white/8 bg-white/[0.025] px-3.5 py-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Conteúdo</h3>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/85">{order.content || '—'}</p>
                </div>

                <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:flex-wrap sm:justify-between">
                  {whatsappUrl ? (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20">
                      <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                    </a>
                  ) : <span className="text-xs text-white/40">WhatsApp indisponível para este cliente.</span>}
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                    <button type="button" onClick={() => previousStatus && void handleStatusChange(previousStatus)} disabled={!previousStatus || updatingOrder} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3.5 py-2.5 text-sm font-semibold text-white/75 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-35">
                      {updatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowLeft className="h-4 w-4" />} Voltar status
                    </button>
                    {nextStatus ? (
                      <button type="button" onClick={() => void handleStatusChange(nextStatus)} disabled={updatingOrder} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                        Avançar para {STATUS_LABELS[nextStatus]} <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <button type="button" onClick={() => void handleStatusChange('completed')} disabled={updatingOrder} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                        {updatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Concluir pedido
                      </button>
                    )}
                    {order.status !== 'completed' && (
                      <button type="button" onClick={() => void handleStatusChange('completed')} disabled={updatingOrder} className="rounded-xl border border-emerald-500/25 px-3.5 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-50">Marcar como concluído</button>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      })()}
    </section>
  );
};
