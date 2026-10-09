import { useMemo, useState } from 'react';
import { toDate } from '../orders/orderView';
import type { OrderView } from '../orders/orderView';

/** Criação de pedido e "Duplicar pedido" (valores iniciais derivados do pedido de origem). */
export const useOrderCreation = (loadOrders: (options?: { silent?: boolean }) => Promise<void>, setSuccess: (message: string) => void) => {
  const [createOpen, setCreateOpen] = useState(false);
  const [duplicateSource, setDuplicateSource] = useState<OrderView | null>(null);

  const handleOrderCreated = async (_order?: unknown, warning?: string) => {
    setCreateOpen(false);
    setDuplicateSource(null);
    setSuccess(warning ?? 'Pedido criado com sucesso.');
    void loadOrders({ silent: true });
  };

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

  return { createOpen, setCreateOpen, setDuplicateSource, duplicateInitialValues, handleOrderCreated };
};
