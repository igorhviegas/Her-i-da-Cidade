import { useEffect, useState } from 'react';
import { useRouter } from '../../../lib/router';
import type { OrderView } from '../orders/orderView';

/** Pedido aberto nos detalhes (inclusive via ?orderId= da URL), edição aberta e erro de ação. */
export const useOrderSelection = (orders: OrderView[], completedOrders: OrderView[], loading: boolean) => {
  const { search: routeSearch, navigate } = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<OrderView | null>(null);
  const [editOrderOpen, setEditOrderOpen] = useState(false);
  const [orderActionError, setOrderActionError] = useState('');

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

  return { selectedOrder, setSelectedOrder, editOrderOpen, setEditOrderOpen, orderActionError, setOrderActionError };
};
