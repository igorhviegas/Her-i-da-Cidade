import React from 'react';
import { extractBirthdayPerson } from '../../../services/orderReference.js';
import { getTeleprompterText } from '../../../services/teleprompter.js';
import type { Client, Order, OrderStatus, Service } from '../../../types';
import type { ConsumptionLine } from '../../../services/stockService';
import { CreateOrderModal } from '../CreateOrderModal';
import { EditOrderModal } from '../EditOrderModal';
import { StockConsumptionModal } from '../StockConsumptionModal';
import { TeleprompterModal } from '../TeleprompterModal';
import { OrderDetailsModal } from '../orders/OrderDetailsModal';
import type { CalendarState } from '../orders/useOrderCalendar';
import type { OrderView } from '../orders/orderView';

type CreateInitialValues = React.ComponentProps<typeof CreateOrderModal>['initialValues'];

interface OrdersModalsProps {
  orders: OrderView[];
  allOrderRecords: Order[];
  calendarState: CalendarState;
  canOverrideStock: boolean;
  updatingOrderId: string | null;
  deletingOrderId: string | null;
  orderActionError: string;
  selectedOrder: OrderView | null;
  editOrderOpen: boolean;
  createOpen: boolean;
  duplicateInitialValues: CreateInitialValues;
  consumptionView: OrderView | null;
  teleprompterView: OrderView | null;
  setCreateOpen: (open: boolean) => void;
  setDuplicateSource: (view: OrderView | null) => void;
  setSelectedOrder: (view: OrderView | null) => void;
  setEditOrderOpen: (open: boolean) => void;
  setOrderActionError: (message: string) => void;
  setTeleprompterView: (view: OrderView | null) => void;
  setConsumptionView: (view: OrderView | null) => void;
  handleOrderCreated: () => Promise<void>;
  handleOrderSaved: (order: Order, client: Client, service: Service) => void;
  handleStatusChange: (orderId: string, status: OrderStatus) => Promise<boolean>;
  handleSendToCalendar: (orderId: string) => Promise<void>;
  handleDeleteOrder: (view: OrderView) => Promise<void>;
  handleSendToEditing: () => Promise<void>;
  confirmConsumption: (lines: ConsumptionLine[], options: { allowShortage: boolean }) => Promise<void>;
}

type PostOrderModalsProps = Pick<OrdersModalsProps, 'orders' | 'canOverrideStock' | 'updatingOrderId' | 'orderActionError' | 'consumptionView' | 'teleprompterView' | 'setTeleprompterView' | 'setConsumptionView' | 'handleSendToEditing' | 'confirmConsumption'>;

/** Conferência de materiais (eventos presenciais) e teleprompter. */
const PostOrderModals: React.FC<PostOrderModalsProps> = ({ orders, canOverrideStock, updatingOrderId, orderActionError, consumptionView, teleprompterView, setTeleprompterView, setConsumptionView, handleSendToEditing, confirmConsumption }) => (
  <>
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
  </>
);

export const OrdersModals: React.FC<OrdersModalsProps> = ({
  orders,
  allOrderRecords,
  calendarState,
  canOverrideStock,
  updatingOrderId,
  deletingOrderId,
  orderActionError,
  selectedOrder,
  editOrderOpen,
  createOpen,
  duplicateInitialValues,
  consumptionView,
  teleprompterView,
  setCreateOpen,
  setDuplicateSource,
  setSelectedOrder,
  setEditOrderOpen,
  setOrderActionError,
  setTeleprompterView,
  setConsumptionView,
  handleOrderCreated,
  handleOrderSaved,
  handleStatusChange,
  handleSendToCalendar,
  handleDeleteOrder,
  handleSendToEditing,
  confirmConsumption,
}) => (
  <>
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
    <PostOrderModals
      orders={orders}
      canOverrideStock={canOverrideStock}
      updatingOrderId={updatingOrderId}
      orderActionError={orderActionError}
      consumptionView={consumptionView}
      teleprompterView={teleprompterView}
      setTeleprompterView={setTeleprompterView}
      setConsumptionView={setConsumptionView}
      handleSendToEditing={handleSendToEditing}
      confirmConsumption={confirmConsumption}
    />
    {selectedOrder && editOrderOpen && (
      <EditOrderModal
        order={selectedOrder.order}
        client={selectedOrder.client}
        service={selectedOrder.service}
        onClose={() => setEditOrderOpen(false)}
        onSaved={handleOrderSaved}
      />
    )}
  </>
);
