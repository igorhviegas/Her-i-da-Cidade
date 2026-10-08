import React from 'react';
import { extractBirthdayPerson, formatOrderReference } from '../../../services/orderReference.js';
import type { Order } from '../../../types';
import { formatMoney } from './orderView';
import type { OrderView } from './orderView';

interface CompletedOrdersProps {
  search: string;
  completedOrders: OrderView[];
  filteredCompletedOrders: OrderView[];
  completedOpen: boolean;
  setCompletedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  allOrderRecords: Order[];
  setSelectedOrder: (view: OrderView) => void;
  setEditOrderOpen: (open: boolean) => void;
  setOrderActionError: (message: string) => void;
}

export const CompletedOrders: React.FC<CompletedOrdersProps> = ({
  search,
  completedOrders,
  filteredCompletedOrders,
  completedOpen,
  setCompletedOpen,
  allOrderRecords,
  setSelectedOrder,
  setEditOrderOpen,
  setOrderActionError,
}) => {
  return (
    <section className="space-y-3 border-t border-white/10 pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-white">Pedidos concluídos ({search.trim() ? `${filteredCompletedOrders.length} de ${completedOrders.length}` : completedOrders.length})</h3>
          <p className="mt-0.5 text-xs text-white/45">Ficam fora das colunas do Kanban. Se necessário, abra um pedido para reabri-lo em outra etapa.</p>
        </div>
        <button type="button" onClick={() => setCompletedOpen((open) => !open)} aria-expanded={completedOpen} className="min-h-10 shrink-0 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/75 hover:bg-white/5">
          {completedOpen ? 'Ver menos' : 'Ver mais'}
        </button>
      </div>
      {!completedOpen ? null : filteredCompletedOrders.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {filteredCompletedOrders.map(({ order, client, service, script }) => {
            const birthdayPerson = extractBirthdayPerson(order);
            return (
              <button key={order.id} type="button" onClick={() => { setSelectedOrder({ order, client, service, script }); setEditOrderOpen(false); setOrderActionError(''); }} className="rounded-xl border border-white/10 bg-[#0D1527] p-3.5 text-left transition-colors hover:border-emerald-400/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-white/35">Pedido {formatOrderReference(order, allOrderRecords)}</span>
                <span className="block truncate text-sm font-bold text-white">{client?.name || 'Cliente não encontrado'}</span>
                <span className="mt-0.5 block truncate text-xs text-white/50">{service?.title || 'Serviço não encontrado'}</span>
                {birthdayPerson && (
                  <span className="mt-0.5 block truncate text-xs text-white/60">
                    Aniversariante: <span className="font-medium text-white/80">{birthdayPerson}</span>
                  </span>
                )}
                {order.scriptId && <span className="mt-1 block truncate text-[11px] text-blue-200/75">Roteiro: {script?.title || 'Roteiro não encontrado'}</span>}
                <span className="mt-2 block text-xs font-semibold text-emerald-300">Concluído · {formatMoney(order.totalPaid)}</span>
              </button>
            );
          })}
        </div>
      ) : <p className="rounded-xl border border-white/10 bg-[#0D1527] p-4 text-center text-xs text-white/45">Nenhum pedido concluído corresponde à busca.</p>}
    </section>
  );
};
