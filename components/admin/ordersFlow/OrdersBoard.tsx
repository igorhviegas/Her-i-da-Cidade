import React from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import type { OrderStatus } from '../../../types';
import type { OrderView } from '../orders/orderView';
import { OrdersKanban } from '../orders/OrdersKanban';
import type { OrderCardContext } from '../orders/OrderCard';

interface OrdersBoardProps extends OrderCardContext {
  loading: boolean;
  error: string | null;
  totalOrderCount: number;
  orders: OrderView[];
  filteredOrders: OrderView[];
  draggingOrderId: string | null;
  dragOverStatus: OrderStatus | null;
  handleDropOrder: (event: React.DragEvent, status: OrderStatus) => void;
}

/** Corpo da página: carregando, estados vazios ou o Kanban. */
export const OrdersBoard: React.FC<OrdersBoardProps> = ({ loading, error, totalOrderCount, orders, filteredOrders, draggingOrderId, dragOverStatus, handleDropOrder, ...cardContext }) => (
  <>
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
        {...cardContext}
      />
    ) : null}
  </>
);
