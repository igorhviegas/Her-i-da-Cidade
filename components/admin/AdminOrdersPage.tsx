import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { deleteOrder, updateOrder } from '../../services/ordersService';
import { extractBirthdayPerson } from '../../services/orderReference.js';
import type { Client, Order, OrderStatus, Service } from '../../types';
import { CreateOrderModal } from './CreateOrderModal';
import { EditOrderModal } from './EditOrderModal';
import { StockConsumptionModal } from './StockConsumptionModal';
import { useAuth } from '../../context/AuthContext';
import { isPresentialService } from '../../services/stockCalculations.js';
import type { ConsumptionLine } from '../../services/stockService';
import { TeleprompterModal } from './TeleprompterModal';
import { getTeleprompterText } from '../../services/teleprompter.js';
import { STATUS_LABELS, toDate } from './orders/orderView';
import type { OrderView } from './orders/orderView';
import { useOrdersData } from './orders/useOrdersData';
import { useOrderCalendar } from './orders/useOrderCalendar';
import { OrdersToolbar } from './orders/OrdersToolbar';
import { OrdersKanban } from './orders/OrdersKanban';
import { CompletedOrders } from './orders/CompletedOrders';
import { OrderDetailsModal } from './orders/OrderDetailsModal';

export const AdminOrdersPage: React.FC = () => {
  const { search: routeSearch, navigate } = useRouter();
  const { orders, setOrders, completedOrders, setCompletedOrders, totalOrderCount, setTotalOrderCount, loading, error, loadOrders } = useOrdersData();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<OrderView | null>(null);
  const [success, setSuccess] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderView | null>(null);
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [orderActionError, setOrderActionError] = useState('');
  const [teleprompterView, setTeleprompterView] = useState<OrderView | null>(null);
  const [consumptionView, setConsumptionView] = useState<OrderView | null>(null);
  const { adminData } = useAuth();
  // Conclusão excepcional com estoque insuficiente: só admin/superadmin (as regras do Firestore validam o mesmo critério).
  const canOverrideStock = adminData?.role === 'admin' || adminData?.role === 'superadmin';
  const [completedOpen, setCompletedOpen] = useState(false);
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrderStatus | null>(null);
  const allOrderRecords = useMemo(() => [...orders, ...completedOrders].map(({ order }) => order), [orders, completedOrders]);
  const { calendarState, handleSendToCalendar } = useOrderCalendar(setSelectedOrder);

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
      <OrdersToolbar search={search} setSearch={setSearch} refreshing={refreshing} loading={loading} handleRefresh={handleRefresh} setCreateOpen={setCreateOpen} />

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
        <OrdersKanban
          filteredOrders={filteredOrders}
          draggingOrderId={draggingOrderId}
          dragOverStatus={dragOverStatus}
          handleDropOrder={handleDropOrder}
          allOrderRecords={allOrderRecords}
          updatingOrderId={updatingOrderId}
          deletingOrderId={deletingOrderId}
          calendarState={calendarState}
          setSelectedOrder={setSelectedOrder}
          setEditOrderOpen={setEditOrderOpen}
          setOrderActionError={setOrderActionError}
          setDraggingOrderId={setDraggingOrderId}
          setDragOverStatus={setDragOverStatus}
          setTeleprompterView={setTeleprompterView}
          handleSendToCalendar={handleSendToCalendar}
          handleCompleteOrder={handleCompleteOrder}
        />
      ) : null}

      {!loading && !error && completedOrders.length > 0 && (
        <CompletedOrders
          search={search}
          completedOrders={completedOrders}
          filteredCompletedOrders={filteredCompletedOrders}
          completedOpen={completedOpen}
          setCompletedOpen={setCompletedOpen}
          allOrderRecords={allOrderRecords}
          setSelectedOrder={setSelectedOrder}
          setEditOrderOpen={setEditOrderOpen}
          setOrderActionError={setOrderActionError}
        />
      )}

      {createOpen && <CreateOrderModal onClose={() => setCreateOpen(false)} onCreated={handleOrderCreated} />}
      {duplicateInitialValues && <CreateOrderModal initialValues={duplicateInitialValues} onClose={() => setDuplicateSource(null)} onCreated={handleOrderCreated} />}
      {selectedOrder && (
        <OrderDetailsModal
          selectedOrder={selectedOrder}
          allOrderRecords={allOrderRecords}
          updatingOrderId={updatingOrderId}
          deletingOrderId={deletingOrderId}
          orderActionError={orderActionError}
          calendarState={calendarState}
          setSelectedOrder={setSelectedOrder}
          setEditOrderOpen={setEditOrderOpen}
          setDuplicateSource={setDuplicateSource}
          setTeleprompterView={setTeleprompterView}
          setOrderActionError={setOrderActionError}
          handleStatusChange={handleStatusChange}
          handleSendToCalendar={handleSendToCalendar}
          handleDeleteOrder={handleDeleteOrder}
        />
      )}
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
