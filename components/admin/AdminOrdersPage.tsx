import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { updateOrder } from '../../services/ordersService';
import { extractBirthdayPerson } from '../../services/orderReference.js';
import { useAuth } from '../../context/AuthContext';
import { isPresentialService } from '../../services/stockCalculations.js';
import type { ConsumptionLine } from '../../services/stockService';
import { useOrdersData } from './orders/useOrdersData';
import { useOrderCalendar } from './orders/useOrderCalendar';
import { OrdersToolbar } from './orders/OrdersToolbar';
import { CompletedOrders } from './orders/CompletedOrders';
import type { OrderView } from './orders/orderView';
import { OrdersBoard } from './ordersFlow/OrdersBoard';
import { OrdersModals } from './ordersFlow/OrdersModals';
import { useOrderCreation } from './ordersFlow/useOrderCreation';
import { useOrderDelete, useOrderSaved } from './ordersFlow/useOrderEdits';
import { useOrderSelection } from './ordersFlow/useOrderSelection';
import { useOrderStatus } from './ordersFlow/useOrderStatus';
import { useOrdersFilters } from './ordersFlow/useOrdersFilters';
import { useManualRefresh, useOrderDrag, useSuccessMessage, useTeleprompterFlow } from './ordersFlow/useOrdersPageUi';

export const AdminOrdersPage: React.FC = () => {
  const { orders, setOrders, completedOrders, setCompletedOrders, totalOrderCount, setTotalOrderCount, loading, error, loadOrders } = useOrdersData();
  const { adminData } = useAuth();
  // Conclusão excepcional com estoque insuficiente: só admin/superadmin (as regras do Firestore validam o mesmo critério).
  const canOverrideStock = adminData?.role === 'admin' || adminData?.role === 'superadmin';
  const [completedOpen, setCompletedOpen] = useState(false);
  const { success, setSuccess } = useSuccessMessage();
  const { refreshing, handleRefresh } = useManualRefresh(loading, loadOrders);
  const { search, setSearch, filteredOrders, filteredCompletedOrders } = useOrdersFilters(orders, completedOrders);
  const { createOpen, setCreateOpen, setDuplicateSource, duplicateInitialValues, handleOrderCreated } = useOrderCreation(loadOrders, setSuccess);
  const { selectedOrder, setSelectedOrder, editOrderOpen, setEditOrderOpen, orderActionError, setOrderActionError } = useOrderSelection(orders, completedOrders, loading);
  const allOrderRecords = useMemo(() => [...orders, ...completedOrders].map(({ order }) => order), [orders, completedOrders]);
  const { calendarState, handleSendToCalendar } = useOrderCalendar(setSelectedOrder);
  const { deletingOrderId, handleDeleteOrder } = useOrderDelete({ setOrders, setCompletedOrders, setTotalOrderCount, setSelectedOrder, setOrderActionError, setSuccess });
  const { handleOrderSaved } = useOrderSaved({ orders, completedOrders, setOrders, setCompletedOrders, setSelectedOrder, setEditOrderOpen, setSuccess });
  const { updatingOrderId, consumptionView, setConsumptionView, requireEventCost, handleStatusChange } = useOrderStatus({ orders, completedOrders, loadOrders, setSelectedOrder, setEditOrderOpen, setOrderActionError, setSuccess });
  const { teleprompterView, setTeleprompterView, handleSendToEditing } = useTeleprompterFlow(handleStatusChange);
  const { draggingOrderId, setDraggingOrderId, dragOverStatus, setDragOverStatus, handleDropOrder } = useOrderDrag(handleStatusChange);

  const confirmConsumption = async (lines: ConsumptionLine[], { allowShortage }: { allowShortage: boolean }) => {
    if (!consumptionView) return;
    const orderId = consumptionView.order.id;
    await updateOrder(orderId, { status: 'completed', materialConsumption: lines, allowStockShortage: allowShortage });
    setConsumptionView(null);
    setSelectedOrder((current) => (current?.order.id === orderId ? null : current));
    setSuccess(allowShortage ? 'Evento concluído com pendências de estoque (veja Financeiro → Estoque).' : 'Evento concluído e materiais baixados do estoque.');
    await loadOrders();
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

  return (
    <section className="animate-in fade-in duration-200 space-y-5">
      <OrdersToolbar search={search} setSearch={setSearch} refreshing={refreshing} loading={loading} handleRefresh={handleRefresh} setCreateOpen={setCreateOpen} />

      {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{success}</div>}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> Não foi possível carregar os pedidos. {error}
        </div>
      )}

      <OrdersBoard
        loading={loading}
        error={error}
        totalOrderCount={totalOrderCount}
        orders={orders}
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

      <OrdersModals
        orders={orders}
        allOrderRecords={allOrderRecords}
        calendarState={calendarState}
        canOverrideStock={canOverrideStock}
        updatingOrderId={updatingOrderId}
        deletingOrderId={deletingOrderId}
        orderActionError={orderActionError}
        selectedOrder={selectedOrder}
        editOrderOpen={editOrderOpen}
        createOpen={createOpen}
        duplicateInitialValues={duplicateInitialValues}
        consumptionView={consumptionView}
        teleprompterView={teleprompterView}
        setCreateOpen={setCreateOpen}
        setDuplicateSource={setDuplicateSource}
        setSelectedOrder={setSelectedOrder}
        setEditOrderOpen={setEditOrderOpen}
        setOrderActionError={setOrderActionError}
        setTeleprompterView={setTeleprompterView}
        setConsumptionView={setConsumptionView}
        handleOrderCreated={handleOrderCreated}
        handleOrderSaved={handleOrderSaved}
        handleStatusChange={handleStatusChange}
        handleSendToCalendar={handleSendToCalendar}
        handleDeleteOrder={handleDeleteOrder}
        handleSendToEditing={handleSendToEditing}
        confirmConsumption={confirmConsumption}
      />
    </section>
  );
};
