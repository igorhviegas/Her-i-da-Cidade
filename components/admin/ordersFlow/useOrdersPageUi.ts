import { useEffect, useState } from 'react';
import type React from 'react';
import type { OrderStatus } from '../../../types';
import type { OrderView } from '../orders/orderView';

/** Mensagem de sucesso que some sozinha depois de alguns segundos. */
export const useSuccessMessage = () => {
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 4500);
    return () => window.clearTimeout(timer);
  }, [success]);

  return { success, setSuccess };
};

// Atualização manual (útil no app da tela inicial do iPhone, sem pull-to-refresh).
// Silenciosa: mantém o Kanban na tela enquanto os dados são relidos do Firestore.
export const useManualRefresh = (loading: boolean, loadOrders: (options?: { silent?: boolean }) => Promise<void>) => {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try { await loadOrders({ silent: true }); } finally { setRefreshing(false); }
  };

  return { refreshing, handleRefresh };
};

type StatusChangeHandler = (orderId: string, status: OrderStatus) => Promise<boolean>;

export const useTeleprompterFlow = (handleStatusChange: StatusChangeHandler) => {
  const [teleprompterView, setTeleprompterView] = useState<OrderView | null>(null);

  const handleSendToEditing = async () => {
    if (!teleprompterView) return;
    if (await handleStatusChange(teleprompterView.order.id, 'editing')) setTeleprompterView(null);
  };

  return { teleprompterView, setTeleprompterView, handleSendToEditing };
};

export const useOrderDrag = (handleStatusChange: StatusChangeHandler) => {
  const [draggingOrderId, setDraggingOrderId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<OrderStatus | null>(null);

  const handleDropOrder = (event: React.DragEvent, status: OrderStatus) => {
    event.preventDefault();
    const orderId = event.dataTransfer.getData('text/plain') || draggingOrderId;
    setDragOverStatus(null);
    setDraggingOrderId(null);
    if (orderId) void handleStatusChange(orderId, status);
  };

  return { draggingOrderId, setDraggingOrderId, dragOverStatus, setDragOverStatus, handleDropOrder };
};
