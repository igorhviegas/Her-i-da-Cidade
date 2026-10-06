import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Copy, Loader2, MessageCircle, Pencil, Plus, RefreshCw, Search, Trash2, Tv, X, CalendarPlus } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { getClientById, normalizeWhatsApp } from '../../services/clientsService';
import { deleteOrder, listOrders, updateOrder } from '../../services/ordersService';
import { sendOrderToGoogleCalendar } from '../../services/googleCalendarService';
import { getContentScriptsByIds } from '../../services/contentScriptsService';
import { getServiceById } from '../../services/servicesService';
import { formatOrderReference, extractBirthdayPerson } from '../../services/orderReference.js';
import { buildDeliveryWhatsAppUrl } from '../../services/digitalDelivery.js';
import { getServiceColor, type ServiceColor } from '../../services/serviceColors.js';
import type { Client, ContentScript, Order, OrderStatus, Service } from '../../types';
import { CreateOrderModal } from './CreateOrderModal';
import { EditOrderModal } from './EditOrderModal';
import { StockConsumptionModal } from './StockConsumptionModal';
import { useAuth } from '../../context/AuthContext';
import { isPresentialService } from '../../services/stockCalculations.js';
import type { ConsumptionLine } from '../../services/stockService';
import { TeleprompterModal } from './TeleprompterModal';
import { getTeleprompterText } from '../../services/teleprompter.js';

type OrderView = { order: Order; client?: Client | null; service?: Service | null; script?: ContentScript | null };
const COLUMNS = [
  { status: 'delivery', label: 'ENTREGAR', accent: 'border-emerald-400' },
  { status: 'recording', label: 'GRAVAR', accent: 'border-amber-400' },
  { status: 'editing', label: 'EDITAR', accent: 'border-violet-400' },
  { status: 'scheduled', label: 'AGENDADO', accent: 'border-blue-400' },
  { status: 'completed', label: 'CONCLUÍDO', accent: 'border-slate-400' },
] as const;

// Classes estáticas (o Tailwind precisa enxergá-las por completo): fundo do card e título do serviço.
const SERVICE_COLOR_CLASSES: Record<ServiceColor, { card: string; title: string }> = {
  red: { card: 'bg-gradient-to-b from-red-500/10 to-red-500/10', title: 'text-red-300' },
  yellow: { card: 'bg-gradient-to-b from-yellow-400/10 to-yellow-400/10', title: 'text-yellow-300' },
  blue: { card: 'bg-gradient-to-b from-blue-500/10 to-blue-500/10', title: 'text-blue-300' },
  purple: { card: 'bg-gradient-to-b from-purple-500/10 to-purple-500/10', title: 'text-purple-300' },
  green: { card: 'bg-gradient-to-b from-green-500/10 to-green-500/10', title: 'text-green-300' },
};

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
  const [refreshing, setRefreshing] = useState(false);
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
  const [calendarState, setCalendarState] = useState<{ orderId: string; kind: 'sending' | 'ok' | 'error'; message: string; link?: string | null } | null>(null);
  const [teleprompterView, setTeleprompterView] = useState<OrderView | null>(null);
  const [consumptionView, setConsumptionView] = useState<OrderView | null>(null);
  const { adminData } = useAuth();
  // Conclusão excepcional com estoque insuficiente: só admin/superadmin (as regras do Firestore validam o mesmo critério).
  const canOverrideStock = adminData?.role === 'admin' || adminData?.role === 'superadmin';
  const [completedOpen, setCompletedOpen] = useState(false);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrderStatus | null>(null);
  const allOrderRecords = useMemo(() => [...orders, ...completedOrders].map(({ order }) => order), [orders, completedOrders]);

  const loadOrders = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!silent) setLoading(true);
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

  // Atualização manual (útil no app da tela inicial do iPhone, sem pull-to-refresh).
  // Silenciosa: mantém o Kanban na tela enquanto os dados são relidos do Firestore.
  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try { await loadOrders({ silent: true }); } finally { setRefreshing(false); }
  };

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

  /** Evento sem custo informado não pode ser concluído: avisa e abre "Editar pedido" no pedido. */
  const requireEventCost = (view: OrderView): boolean => {
    if (view.order.eventDraft) {
      window.alert('Complete os dados do evento em "Editar pedido" antes de concluir.');
      setSelectedOrder(view);
      setEditOrderOpen(true);
      return false;
    }
    if (!view.order.eventForm || typeof view.order.eventForm.cost === 'number') return true;
    window.alert('Informe o custo do evento em "Editar pedido" antes de concluir. Ele é obrigatório para lançar a despesa no Financeiro.');
    setSelectedOrder(view);
    setEditOrderOpen(true);
    return false;
  };

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    if (updatingOrderId) return false;
    const orderView = [...orders, ...completedOrders].find(({ order }) => order.id === orderId);
    if (!orderView || orderView.order.status === status) return false;
    if (status === 'completed' && !requireEventCost(orderView)) return false;
    // Evento presencial: a conclusão passa pela conferência de materiais (a baixa de estoque é feita junto, em updateOrder).
    if (status === 'completed' && isPresentialService(orderView.service)) { setOrderActionError(''); setConsumptionView(orderView); return false; }
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
      return true;
    } catch (actionError) {
      setOrderActionError(actionError instanceof Error ? actionError.message : 'Não foi possível atualizar o pedido.');
      return false;
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const confirmConsumption = async (lines: ConsumptionLine[], { allowShortage }: { allowShortage: boolean }) => {
    if (!consumptionView) return;
    const orderId = consumptionView.order.id;
    await updateOrder(orderId, { status: 'completed', materialConsumption: lines, allowStockShortage: allowShortage });
    setConsumptionView(null);
    setSelectedOrder((current) => (current?.order.id === orderId ? null : current));
    setSuccess(allowShortage ? 'Evento concluído com pendências de estoque (veja Financeiro → Estoque).' : 'Evento concluído e materiais baixados do estoque.');
    await loadOrders();
  };

  /** Envio manual ao Google Agenda: só mostra sucesso depois da confirmação do servidor/Google. */
  const handleSendToCalendar = async (orderId: string) => {
    if (calendarState?.kind === 'sending') return;
    setCalendarState({ orderId, kind: 'sending', message: '' });
    try {
      const result = await sendOrderToGoogleCalendar(orderId);
      setCalendarState({
        orderId, kind: 'ok', link: result.htmlLink,
        message: `${result.created ? 'Evento criado' : 'Evento atualizado'} no Google Agenda.${result.persisted ? '' : ' O vínculo não pôde ser salvo no pedido; um novo envio atualizará este mesmo evento.'}`,
      });
      if (result.persisted) {
        setSelectedOrder((current) => (current?.order.id === orderId
          ? { ...current, order: { ...current.order, googleCalendar: { eventId: current.order.googleCalendar?.eventId ?? '', calendarId: current.order.googleCalendar?.calendarId ?? '', htmlLink: result.htmlLink ?? undefined, syncedAt: new Date() } } }
          : current));
      }
    } catch (error) {
      setCalendarState({ orderId, kind: 'error', message: error instanceof Error ? error.message : 'Não foi possível enviar ao Google Agenda.' });
    }
  };

  const handleSendToEditing = async () => {
    if (!teleprompterView) return;
    if (await handleStatusChange(teleprompterView.order.id, 'editing')) setTeleprompterView(null);
  };

  const handleCompleteOrder = async (view: OrderView) => {
    if (updatingOrderId || deletingOrderId) return;
    const childName = extractBirthdayPerson(view.order);
    const label = [view.client?.name, childName].filter(Boolean).join(' · ') || 'este pedido';
    if (!requireEventCost(view)) return;
    if (isPresentialService(view.service)) { setConsumptionView(view); return; }
    if (!window.confirm(`Concluir o pedido de ${label}? Ele sairá do Kanban e irá para os pedidos concluídos. Nenhuma mensagem será enviada.`)) return;
    await handleStatusChange(view.order.id, 'completed');
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
    return completedOrders.filter(({ order, client, service, script }) => {
      const birthday = extractBirthdayPerson(order);
      return !term ||
        (client?.name || '').toLocaleLowerCase('pt-BR').includes(term) ||
        (service?.title || '').toLocaleLowerCase('pt-BR').includes(term) ||
        (script?.title || '').toLocaleLowerCase('pt-BR').includes(term) ||
        (birthday || '').toLocaleLowerCase('pt-BR').includes(term);
    });
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
      ...(order.eventForm ? { eventForm: order.eventForm, childName: order.childName } : {}),
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
            onClick={() => void handleRefresh()}
            disabled={refreshing || loading}
            aria-label="Atualizar pedidos"
            title="Atualizar pedidos"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#0D1527] px-3.5 py-2.5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-60 sm:min-h-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="sm:hidden">{refreshing ? 'Atualizando…' : 'Atualizar'}</span>
          </button>
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
                      const childName = extractBirthdayPerson(order);
                      // Vídeo Chamada agendada pelo site para outro número: a mensagem do dia vai para o número da chamada, não para o de contato.
                      const deliveryUrl = buildDeliveryWhatsAppUrl(order.videoCall?.callWhatsapp ?? client?.whatsapp, order, service);
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
              {filteredCompletedOrders.map(({ order, client, service, script }) => {
                const birthdayPerson = extractBirthdayPerson(order);
                return (
                  <button key={order.id} type="button" onClick={() => { setSelectedOrder({ order, client, service, script }); setEditOrderOpen(false); setOrderActionError(''); }} className="rounded-xl border border-white/10 bg-[#0D1527] p-3.5 text-left transition-colors hover:border-emerald-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/35">Pedido {formatOrderReference(order, allOrderRecords)}</span>
                    <span className="block truncate text-sm font-bold text-white">{client?.name || 'Cliente não encontrado'}</span>
                    <span className="mt-0.5 block truncate text-xs text-white/50">{service?.title || 'Serviço não encontrado'}</span>
                    {birthdayPerson && (
                      <span className="mt-0.5 block truncate text-xs text-white/60">
                        Aniversariante: <span className="font-medium text-white/80">{birthdayPerson}</span>
                      </span>
                    )}
                    {order.scriptId && <span className="mt-1 block truncate text-[11px] text-blue-200/75">Roteiro: {script?.title || 'Roteiro não encontrado'}</span>}
                    <span className="mt-2 block text-xs font-semibold text-emerald-300">Concluído · {formatMoney(order.totalPaid)}</span>
                  </button>
                );
              })}
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
        const event = order.eventForm;
        const titleColor = (() => { const c = getServiceColor(service); return c ? SERVICE_COLOR_CLASSES[c].title : 'text-white'; })();
        const technicalRows: Array<[string, string]> = [
          ['Referência do pedido', formatOrderReference(order, allOrderRecords)],
          ['ID do documento', order.id],
        ];
        const detailRows: Array<[string, string]> = event ? [
          ['Cliente', client?.name || 'Cliente não encontrado'],
          ['WhatsApp', client?.whatsapp || '—'],
          ['Nome da criança', order.childName || '—'],
          ['#formulário', event.formType],
          ['Serviço', service?.title || 'Serviço não encontrado'],
          ['Data do evento', displayDate(order.eventDate)],
          ['Horário de início', event.eventTime],
          ['Local', event.location],
          ['Autorização de uso de imagem', event.imageAuthorization ? 'Sim' : 'Não'],
          ['Teia extra', event.extraWeb ? String(event.extraWeb) : 'Não'],
          ['Valor total', formatMoney(event.totalValue)],
          ['Valor de entrada', formatMoney(event.entryValue)],
          ['Custo', typeof event.cost === 'number' ? formatMoney(event.cost) : '—'],
          ['Observações', event.observations || '—'],
        ] : [
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
        const calendar = calendarState?.orderId === order.id ? calendarState : null;
        const syncedAt = toDate(order.googleCalendar?.syncedAt);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingOrderId) setSelectedOrder(null); }}>
            <section role="dialog" aria-modal="true" aria-labelledby="order-details-title" className="my-auto max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0D1527] shadow-2xl">
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
                {event && (
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
                    {calendar && calendar.kind !== 'sending' && (
                      <p role={calendar.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-2.5 text-xs ${calendar.kind === 'ok' ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200' : 'border-red-500/25 bg-red-500/10 text-red-200'}`}>
                        {calendar.message}{calendar.kind === 'ok' && calendar.link && <> <a href={calendar.link} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Abrir no Google Agenda</a></>}
                      </p>
                    )}
                  </div>
                )}

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
      })()}
      {consumptionView && (
        <StockConsumptionModal
          title={[consumptionView.client?.name, extractBirthdayPerson(consumptionView.order), consumptionView.service?.title].filter(Boolean).join(' · ')}
          canOverride={canOverrideStock}
          onConfirm={confirmConsumption}
          onClose={() => setConsumptionView(null)}
        />
      )}
      {teleprompterView && (
        <TeleprompterModal
          title={[teleprompterView.client?.name, teleprompterView.service?.title].filter(Boolean).join(' · ')}
          text={getTeleprompterText(teleprompterView) || ''}
          canSendToEditing={(orders.find(({ order }) => order.id === teleprompterView.order.id)?.order.status ?? teleprompterView.order.status) !== 'editing'}
          sending={updatingOrderId === teleprompterView.order.id}
          error={orderActionError}
          onBack={() => setTeleprompterView(null)}
          onSendToEditing={() => void handleSendToEditing()}
        />
      )}
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
