import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Copy, Loader2, MessageCircle, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { getClientById, normalizeWhatsApp } from '../../services/clientsService';
import { deleteOrder, listOrders, updateOrder } from '../../services/ordersService';
import { getContentScriptsByIds } from '../../services/contentScriptsService';
import { getServiceById } from '../../services/servicesService';
import { formatOrderReference } from '../../services/orderReference.js';
import { buildDeliveryWhatsAppUrl } from '../../services/digitalDelivery.js';
import type { Client, ContentScript, Order, OrderStatus, Service } from '../../types';
import { CreateOrderModal } from './CreateOrderModal';
import { EditOrderModal } from './EditOrderModal';

type OrderView = { order: Order; client?: Client | null; service?: Service | null; script?: ContentScript | null };
const COLUMNS = [
  { status: 'delivery', label: 'ENTREGAR', accent: 'border-emerald-400' },
  { status: 'recording', label: 'GRAVAR', accent: 'border-amber-400' },
  { status: 'editing', label: 'EDITAR', accent: 'border-violet-400' },
  { status: 'scheduled', label: 'AGENDADO', accent: 'border-blue-400' },
  { status: 'completed', label: 'CONCLUÍDO', accent: 'border-slate-400' },
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
  const { search: routeSearch, navigate } = useRouter();
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [completedOrders, setCompletedOrders] = useState<OrderView[]>([]);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<OrderView | null>(null);
  const [success, setSuccess] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderView | null>(null);
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [orderActionError, setOrderActionError] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrderStatus | null>(null);
  const allOrderRecords = useMemo(() => [...orders, ...completedOrders].map(({ order }) => order), [orders, completedOrders]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allOrders = await listOrders();
      setTotalOrderCount(allOrders.length);
      const clientIds = [...new Set(allOrders.map((order) => order.clientId).filter(Boolean))];
      const serviceIds = [...new Set(allOrders.map((order) => order.serviceId).filter(Boolean))];
      const scriptIds = [...new Set(allOrders.map((order) => order.scriptId).filter((id): id is string => Boolean(id)))];
      const [clients, services, scripts] = await Promise.all([
        Promise.all(clientIds.map((id) => getClientById(id))),
        Promise.all(serviceIds.map((id) => getServiceById(id))),
        getContentScriptsByIds(scriptIds),
      ]);
      const clientsById = new Map(clientIds.map((id, index) => [id, clients[index]]));
      const servicesById = new Map(serviceIds.map((id, index) => [id, services[index]]));
      const scriptsById = new Map(scripts.map((script) => [script.id, script]));
      const allOrderViews = allOrders.map((order) => ({
        order,
        client: clientsById.get(order.clientId),
        service: servicesById.get(order.serviceId),
        script: order.scriptId ? scriptsById.get(order.scriptId) || null : null,
      }));
      setOrders(allOrderViews.filter(({ order }) => order.status !== 'completed'));
      setCompletedOrders(allOrderViews.filter(({ order }) => order.status === 'completed'));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (loading) return;
    const orderId = new URLSearchParams(routeSearch).get('orderId');
    if (!orderId) return;
    const view = [...orders, ...completedOrders].find(({ order }) => order.id === orderId);
    if (!view) return;
    setSelectedOrder(view);
    setEditOrderOpen(false);
    setOrderActionError('');
    navigate('/admin/pedidos');
  }, [routeSearch, loading, orders, completedOrders, navigate]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 4500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const handleOrderCreated = async () => {
    setCreateOpen(false);
    setDuplicateSource(null);
    setSuccess('Pedido criado com sucesso.');
    await loadOrders();
  };

  const handleDeleteOrder = async (view: OrderView) => {
    const customerName = view.client?.name || 'este cliente';
    if (!window.confirm(`Excluir definitivamente o pedido de ${customerName}? O cadastro do cliente será mantido.`)) return;
    setDeletingOrderId(view.order.id);
    setOrderActionError('');
    try {
      await deleteOrder(view.order.id);
      setOrders((current) => current.filter(({ order }) => order.id !== view.order.id));
      setCompletedOrders((current) => current.filter(({ order }) => order.id !== view.order.id));
      setTotalOrderCount((current) => Math.max(0, current - 1));
      setSelectedOrder(null);
      setSuccess('Pedido excluído. O cadastro do cliente foi mantido.');
    } catch (deleteError) {
      setOrderActionError(deleteError instanceof Error ? deleteError.message : 'Não foi possível excluir o pedido.');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const handleOrderSaved = (order: Order, client: Client, service: Service) => {
    const existingView = [...orders, ...completedOrders].find(({ order: currentOrder }) => currentOrder.id === order.id);
    const updatedView: OrderView = { order, client, service, script: existingView?.script || null };
    setOrders((current) => {
      const others = current.filter(({ order: currentOrder }) => currentOrder.id !== order.id)
        .map((view) => view.client?.id === client.id ? { ...view, client } : view);
      return order.status === 'completed' ? others : [...others, updatedView];
    });
    setCompletedOrders((current) => {
      const others = current.filter(({ order: currentOrder }) => currentOrder.id !== order.id)
        .map((view) => view.client?.id === client.id ? { ...view, client } : view);
      return order.status === 'completed' ? [...others, updatedView] : others;
    });
    setSelectedOrder(updatedView);
    setEditOrderOpen(false);
    setSuccess('Pedido atualizado com sucesso.');
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    if (updatingOrderId) return;
    const orderView = [...orders, ...completedOrders].find(({ order }) => order.id === orderId);
    if (!orderView || orderView.order.status === status) return;
    setUpdatingOrderId(orderId);
    setOrderActionError('');
    try {
      await updateOrder(orderId, { status });
      setSelectedOrder((current) => current?.order.id === orderId
        ? status === 'completed' ? null : { ...current, order: { ...current.order, status } }
        : current);
      setSuccess(status === 'completed'
        ? 'Pedido marcado como concluído.'
        : `Pedido movido para ${STATUS_LABELS[status].toLocaleLowerCase('pt-BR')}.`);
      await loadOrders();
    } catch (actionError) {
      setOrderActionError(actionError instanceof Error ? actionError.message : 'Não foi possível atualizar o pedido.');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return orders.filter(({ client, service, script }) => !term ||
      (client?.name || '').toLocaleLowerCase('pt-BR').includes(term) ||
      (service?.title || '').toLocaleLowerCase('pt-BR').includes(term) ||
      (script?.title || '').toLocaleLowerCase('pt-BR').includes(term));
  }, [orders, search]);

  const filteredCompletedOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return completedOrders.filter(({ client, service, script }) => !term ||
      (client?.name || '').toLocaleLowerCase('pt-BR').includes(term) ||
      (service?.title || '').toLocaleLowerCase('pt-BR').includes(term) ||
      (script?.title || '').toLocaleLowerCase('pt-BR').includes(term));
  }, [completedOrders, search]);

  const duplicateInitialValues = useMemo(() => {
    if (!duplicateSource) return undefined;
    const { order, client } = duplicateSource;
    return {
      name: client?.name || '',
      whatsapp: client?.whatsapp || '',
      serviceId: order.serviceId,
      eventDate: toDate(order.eventDate) || undefined,
      deliveryDays: order.deliveryDays,
      content: order.content || '',
      servicePrice: order.servicePrice,
      rushFee: order.rushFee,
      totalPaid: order.totalPaid,
    };
  }, [duplicateSource]);

  const handleDropOrder = (event: React.DragEvent, status: OrderStatus) => {
    event.preventDefault();
    const orderId = event.dataTransfer.getData('text/plain') || draggingOrderId;
    setDragOverStatus(null);
    setDraggingOrderId(null);
    if (orderId) void handleStatusChange(orderId, status);
  };

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
          <div className="grid min-w-max grid-cols-5 gap-3 lg:min-w-0 lg:gap-3">
            {COLUMNS.map((column) => {
              const columnOrders = filteredOrders
                .filter(({ order }) => order.status === column.status)
                .sort((a, b) => dueTime(a.order) - dueTime(b.order));
              return (
                <section
                  key={column.status}
                  aria-label={column.label}
                  onDragOver={(event) => { event.preventDefault(); if (draggingOrderId) setDragOverStatus(column.status); }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverStatus(null); }}
                  onDrop={(event) => handleDropOrder(event, column.status)}
                  className={`w-[min(72vw,270px)] rounded-xl transition-colors lg:w-auto lg:min-w-0 ${dragOverStatus === column.status ? 'bg-blue-500/10 ring-1 ring-blue-400/50' : ''}`}
                >
                  <header className={`mb-3 flex items-center justify-between border-t-2 ${column.accent} rounded-t-sm bg-[#0B1120] px-3 py-3`}>
                    <h3 className="text-xs font-extrabold tracking-[0.12em] text-white/80">{column.label}</h3>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/65">{columnOrders.length}</span>
                  </header>
                  <div className="space-y-2.5">
                    {columnOrders.map(({ order, client, service, script }) => {
                      const state = deadlineState(order.internalDueDate);
                      const internalDate = formatDate(order.internalDueDate);
                      const eventDate = formatDate(order.eventDate);
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
                          className={`cursor-pointer rounded-xl border bg-[#0D1527] p-3.5 shadow-lg outline-none transition-colors hover:border-blue-400/50 focus-visible:ring-2 focus-visible:ring-blue-400 ${order.scriptId ? 'ring-1 ring-inset ring-blue-400/10' : ''} ${state === 'overdue' ? 'border-red-500/45' : state === 'soon' ? 'border-amber-400/35' : 'border-white/10'}`}
                        >
                          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/35">Pedido {formatOrderReference(order, allOrderRecords)}</p>
                          <h4 className="truncate text-sm font-bold text-white">{client?.name || 'Cliente não encontrado'}</h4>
                          <p className="mt-0.5 truncate text-xs text-white/55">{service?.title || 'Serviço não encontrado'}</p>
                          {order.scriptId && <p className="mt-1 truncate text-[11px] text-blue-200/75"><span className="mr-1 rounded bg-blue-400/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">Roteiro</span>{script?.title || 'Roteiro não encontrado'}</p>}
                          {(eventDate || internalDate) && (
                            <div className="mt-3 space-y-1 border-t border-white/5 pt-2.5 text-[11px]">
                              {eventDate && <p className="text-white/55">Evento/entrega: <span className="text-white/80">{eventDate}</span></p>}
                              {internalDate && <p className={state === 'overdue' ? 'font-semibold text-red-300' : state === 'soon' ? 'font-semibold text-amber-200' : 'text-white/55'}>
                                Interno: <span>{internalDate}{state === 'overdue' ? ' · Vencido' : state === 'soon' ? ' · Próximo' : ''}</span>
                              </p>}
                            </div>
                          )}
                          <p className="mt-3 text-sm font-extrabold text-emerald-300">{formatMoney(order.totalPaid)}</p>
                          {order.status === 'delivery' && (() => {
                            const deliveryUrl = buildDeliveryWhatsAppUrl(client?.whatsapp, order.content);
                            return deliveryUrl ? (
                              <a
                                href={deliveryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                draggable={false}
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                                className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 text-xs font-bold text-emerald-100 hover:bg-emerald-500/25"
                              >
                                <MessageCircle className="h-4 w-4" /> Enviar pelo WhatsApp
                              </a>
                            ) : <p className="mt-2 text-[11px] text-white/35">WhatsApp indisponível</p>;
                          })()}
                        </article>
                      );
                    })}
                    {columnOrders.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/30">{column.status === 'completed' ? 'Solte aqui para concluir; ele sairá do Kanban.' : 'Nenhum pedido nesta etapa'}</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && !error && completedOrders.length > 0 && (
        <section className="space-y-3 border-t border-white/10 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white">Pedidos concluídos ({search.trim() ? `${filteredCompletedOrders.length} de ${completedOrders.length}` : completedOrders.length})</h3>
              <p className="mt-0.5 text-xs text-white/45">Ficam fora das colunas do Kanban. Se necessário, abra um pedido para reabri-lo em outra etapa.</p>
            </div>
            <button type="button" onClick={() => setCompletedOpen((open) => !open)} aria-expanded={completedOpen} className="min-h-10 shrink-0 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 hover:bg-white/5">
              {completedOpen ? 'Ver menos' : 'Ver mais'}
            </button>
          </div>
          {!completedOpen ? null : filteredCompletedOrders.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCompletedOrders.map(({ order, client, service, script }) => (
                <button key={order.id} type="button" onClick={() => { setSelectedOrder({ order, client, service, script }); setEditOrderOpen(false); setOrderActionError(''); }} className="rounded-xl border border-white/10 bg-[#0D1527] p-3.5 text-left transition-colors hover:border-emerald-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/35">Pedido {formatOrderReference(order, allOrderRecords)}</span>
                  <span className="block truncate text-sm font-bold text-white">{client?.name || 'Cliente não encontrado'}</span>
                  <span className="mt-0.5 block truncate text-xs text-white/50">{service?.title || 'Serviço não encontrado'}</span>
                  {order.scriptId && <span className="mt-1 block truncate text-[11px] text-blue-200/75">Roteiro: {script?.title || 'Roteiro não encontrado'}</span>}
                  <span className="mt-2 block text-xs font-semibold text-emerald-300">Concluído · {formatMoney(order.totalPaid)}</span>
                </button>
              ))}
            </div>
          ) : <p className="rounded-xl border border-white/10 bg-[#0D1527] p-4 text-center text-xs text-white/45">Nenhum pedido concluído corresponde à busca.</p>}
        </section>
      )}

      {createOpen && <CreateOrderModal onClose={() => setCreateOpen(false)} onCreated={handleOrderCreated} />}
      {duplicateInitialValues && <CreateOrderModal initialValues={duplicateInitialValues} onClose={() => setDuplicateSource(null)} onCreated={handleOrderCreated} />}
      {selectedOrder && (() => {
        const { order, client, service } = selectedOrder;
        const isUpdatingSelectedOrder = updatingOrderId === order.id || deletingOrderId === order.id;
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
          ['Referência do pedido', formatOrderReference(order, allOrderRecords)],
          ['ID do documento', order.id],
          ['Cliente', client?.name || 'Cliente não encontrado'],
          ['WhatsApp', client?.whatsapp || '—'],
          ['Serviço', service?.title || 'Serviço não encontrado'],
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
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingOrderId) setSelectedOrder(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="order-details-title" className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
              <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-white/10 bg-[#0D1527]/95 px-5 py-4 backdrop-blur sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300">Detalhes do pedido</p>
                  <h2 id="order-details-title" className="mt-1 truncate text-lg font-bold text-white">{client?.name || 'Cliente não encontrado'}</h2>
                  <p className="mt-0.5 truncate text-sm text-white/50">{service?.title || 'Serviço não encontrado'}</p>
                </div>
                <button type="button" onClick={() => setSelectedOrder(null)} disabled={isUpdatingSelectedOrder} aria-label="Fechar detalhes" className="rounded-lg p-2 text-white/55 hover:bg-white/10 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
              </header>

              <div className="space-y-5 p-5 sm:p-6">
                {orderActionError && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200">{orderActionError}</p>}
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

                <dl className="grid gap-x-5 sm:grid-cols-2">
                  {detailRows.map(([label, value]) => (
                    <div key={label} className="min-w-0 border-b border-white/[0.07] py-2.5">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">{label}</dt>
                      <dd className={`mt-0.5 break-words text-sm ${label === 'Total pago' ? 'font-extrabold text-emerald-300' : 'text-white/85'}`}>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="border-b border-white/[0.07] pb-3">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Conteúdo</h3>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-white/85">{order.content || '—'}</p>
                </div>

                <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center">
                  <button type="button" onClick={() => setEditOrderOpen(true)} disabled={Boolean(updatingOrderId || deletingOrderId)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 px-4 py-2.5 text-sm font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-50">
                    <Pencil className="h-4 w-4" /> Editar pedido
                  </button>
                  <button type="button" onClick={() => { setDuplicateSource(selectedOrder); setSelectedOrder(null); }} disabled={Boolean(updatingOrderId || deletingOrderId)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/5 disabled:opacity-50">
                    <Copy className="h-4 w-4" /> Duplicar
                  </button>
                  <button type="button" onClick={() => void handleDeleteOrder(selectedOrder)} disabled={Boolean(updatingOrderId || deletingOrderId)} aria-label="Excluir pedido" title="Excluir pedido" className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/20 disabled:opacity-50 sm:ml-auto">
                    {deletingOrderId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span>{deletingOrderId === order.id ? 'Excluindo…' : 'Excluir'}</span>
                  </button>
                  {whatsappUrl ? (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20">
                      <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
                    </a>
                  ) : <span className="text-xs text-white/40">WhatsApp indisponível para este cliente.</span>}
                </div>
              </div>
            </section>
          </div>
        );
      })()}
      {selectedOrder && editOrderOpen && (
        <EditOrderModal
          order={selectedOrder.order}
          client={selectedOrder.client}
          service={selectedOrder.service}
          onClose={() => setEditOrderOpen(false)}
          onSaved={handleOrderSaved}
        />
      )}
    </section>
  );
};
