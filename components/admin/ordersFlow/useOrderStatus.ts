import { useState } from 'react';
import type React from 'react';
import type { OrderStatus } from '../../../types';
import { updateOrder } from '../../../services/ordersService';
import { isPresentialService } from '../../../services/stockCalculations.js';
import { STATUS_LABELS } from '../orders/orderView';
import type { OrderView } from '../orders/orderView';

interface UseOrderStatusArgs {
  orders: OrderView[];
  completedOrders: OrderView[];
  loadOrders: (options?: { silent?: boolean }) => Promise<void>;
  setOrders: React.Dispatch<React.SetStateAction<OrderView[]>>;
  setCompletedOrders: React.Dispatch<React.SetStateAction<OrderView[]>>;
  setSelectedOrder: React.Dispatch<React.SetStateAction<OrderView | null>>;
  setEditOrderOpen: (open: boolean) => void;
  setOrderActionError: (message: string) => void;
  setSuccess: (message: string) => void;
}

/** Mudança de status do pedido (com a conferência de materiais dos eventos presenciais). */
export const useOrderStatus = ({ orders, completedOrders, loadOrders, setOrders, setCompletedOrders, setSelectedOrder, setEditOrderOpen, setOrderActionError, setSuccess }: UseOrderStatusArgs) => {
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [consumptionView, setConsumptionView] = useState<OrderView | null>(null);

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

  /**
   * Reflete a mudança na hora (o card troca de coluna sem esperar o Firestore) e reconcilia em segundo plano, sem spinner:
   * campos calculados no servidor (datas de conclusão, custo de edição) chegam na releitura silenciosa.
   */
  const applyStatusLocally = (orderId: string, status: OrderStatus) => {
    const source = [...orders, ...completedOrders].find(({ order }) => order.id === orderId);
    if (source) {
      const updated: OrderView = { ...source, order: { ...source.order, status, ...(status === 'completed' ? { completedAt: new Date() } : {}) } };
      setOrders((current) => [...current.filter(({ order }) => order.id !== orderId), ...(status === 'completed' ? [] : [updated])]);
      setCompletedOrders((current) => [...current.filter(({ order }) => order.id !== orderId), ...(status === 'completed' ? [updated] : [])]);
    }
    void loadOrders({ silent: true });
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
      applyStatusLocally(orderId, status);
      return true;
    } catch (actionError) {
      setOrderActionError(actionError instanceof Error ? actionError.message : 'Não foi possível atualizar o pedido.');
      return false;
    } finally {
      setUpdatingOrderId(null);
    }
  };

  return { updatingOrderId, consumptionView, setConsumptionView, requireEventCost, handleStatusChange, applyStatusLocally };
};
