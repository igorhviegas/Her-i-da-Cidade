import React from 'react';
import { displayDate, STATUS_LABELS } from './orderView';
import type { OrderView } from './orderView';

/** Pedidos anteriores do cliente: data do pedido, tipo de serviço e conteúdo solicitado. */
export const ClientHistoryList: React.FC<{ views: OrderView[] }> = ({ views }) => (
  views.length === 0 ? <p className="text-sm text-white/45">Nenhum outro pedido deste cliente.</p> : (
    <ul className="space-y-2">
      {views.map(({ order, service }) => (
        <li key={order.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
            <span className="font-bold text-white/85">{service?.title || 'Serviço não encontrado'}</span>
            <span className="text-white/45">{displayDate(order.createdAt ?? order.paidAt)} · {STATUS_LABELS[order.status]}</span>
          </div>
          <p className="mt-1.5 whitespace-pre-wrap break-words text-xs text-white/70">{order.content?.trim() || '—'}</p>
        </li>
      ))}
    </ul>
  )
);
