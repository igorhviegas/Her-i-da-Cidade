import { useState } from 'react';
import type React from 'react';
import { deleteOrder } from '../../../services/ordersService';
import type { Client, Order, Service } from '../../../types';
import type { OrderView } from '../orders/orderView';

interface UseOrderDeleteArgs {
  setOrders: React.Dispatch<React.SetStateAction<OrderView[]>>;
  setCompletedOrders: React.Dispatch<React.SetStateAction<OrderView[]>>;
  setTotalOrderCount: React.Dispatch<React.SetStateAction<number>>;
  setSelectedOrder: React.Dispatch<React.SetStateAction<OrderView | null>>;
  setOrderActionError: (message: string) => void;
  setSuccess: (message: string) => void;
}

export const useOrderDelete = ({ setOrders, setCompletedOrders, setTotalOrderCount, setSelectedOrder, setOrderActionError, setSuccess }: UseOrderDeleteArgs) => {
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);

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

  return { deletingOrderId, handleDeleteOrder };
};

interface UseOrderSavedArgs {
  orders: OrderView[];
  completedOrders: OrderView[];
  setOrders: React.Dispatch<React.SetStateAction<OrderView[]>>;
  setCompletedOrders: React.Dispatch<React.SetStateAction<OrderView[]>>;
  setSelectedOrder: React.Dispatch<React.SetStateAction<OrderView | null>>;
  setEditOrderOpen: (open: boolean) => void;
  setSuccess: (message: string) => void;
}

export const useOrderSaved = ({ orders, completedOrders, setOrders, setCompletedOrders, setSelectedOrder, setEditOrderOpen, setSuccess }: UseOrderSavedArgs) => {
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

  return { handleOrderSaved };
};
