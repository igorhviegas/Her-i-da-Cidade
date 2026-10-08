import React from 'react';
import type { OrderStatus } from '../../../types';
import { COLUMNS, dueTime } from './orderView';
import type { OrderView } from './orderView';
import { OrderCard } from './OrderCard';
import type { OrderCardContext } from './OrderCard';

interface OrdersKanbanProps extends OrderCardContext {
  filteredOrders: OrderView[];
  draggingOrderId: string | null;
  dragOverStatus: OrderStatus | null;
  handleDropOrder: (event: React.DragEvent, status: OrderStatus) => void;
}

export const OrdersKanban: React.FC<OrdersKanbanProps> = ({
  filteredOrders,
  draggingOrderId,
  dragOverStatus,
  handleDropOrder,
  ...cardContext
}) => {
  const { setDragOverStatus } = cardContext;
  return (
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
                {columnOrders.map(({ order, client, service, script }) => (
                  <OrderCard key={order.id} order={order} client={client} service={service} script={script} {...cardContext} />
                ))}
                {columnOrders.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/30">{column.status === 'completed' ? 'Solte aqui para concluir; ele sairá do Kanban.' : 'Nenhum pedido nesta etapa'}</p>}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};
