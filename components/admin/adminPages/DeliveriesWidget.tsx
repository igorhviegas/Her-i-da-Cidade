import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { subscribeActiveOrders } from '../../../services/ordersService';
import { getClientById } from '../../../services/clientsService';
import { getServiceById } from '../../../services/servicesService';
import { deliveriesToday } from '../../../services/homeToday.js';
import { formatOrderReference } from '../../../services/orderReference.js';
import type { Client, Order, Service } from '../../../types';
import { Widget, Loading, Empty, ErrorState, type Load } from './homeWidgetParts';

// Etapas do Kanban (mesmos nomes de AdminOrdersPage). Só "Entregar" está pronto; as anteriores ainda precisam de atenção.
const STAGE_LABELS: Record<string, string> = { scheduled: 'Agendado', recording: 'Gravar', editing: 'Editar', delivery: 'Pronto para entregar' };

function addLookups<T>(current: Map<string, T | null>, ids: string[], values: (T | null)[]): Map<string, T | null> {
  return new Map([...current, ...ids.map((id, i) => [id, values[i]] as const)]);
}

export const DeliveriesWidget: React.FC<{ now: Date; onOpenOrder: (id: string) => void; onOpen: () => void }> = ({ now, onOpenOrder, onOpen }) => {
  const [state, setState] = useState<Load<Order[]>>({ status: 'loading' });
  const [names, setNames] = useState<{ clients: Map<string, Client | null>; services: Map<string, Service | null> }>({ clients: new Map(), services: new Map() });
  useEffect(() => subscribeActiveOrders(
    (orders) => setState({ status: 'ready', data: orders }),
    () => setState({ status: 'error' }),
  ), []);

  const rows = useMemo<{ order: Order; attention: boolean }[]>(() => (state.status === 'ready' ? deliveriesToday(state.data, now) : []), [state, now]);
  const lookupKey = rows.map(({ order }) => `${order.clientId}|${order.serviceId}`).join();
  useEffect(() => {
    // Só busca nome/serviço dos pedidos de hoje que ainda não foram buscados.
    const missingClients: string[] = Array.from(new Set<string>(rows.map(({ order }) => order.clientId))).filter((id) => !!id && !names.clients.has(id));
    const missingServices: string[] = Array.from(new Set<string>(rows.map(({ order }) => order.serviceId))).filter((id) => !!id && !names.services.has(id));
    if (!missingClients.length && !missingServices.length) return;
    let cancelled = false;
    void Promise.all([
      Promise.all(missingClients.map((id) => getClientById(id).catch(() => null))),
      Promise.all(missingServices.map((id) => getServiceById(id).catch(() => null))),
    ]).then(([clients, services]) => {
      if (cancelled) return;
      setNames((current) => ({
        clients: addLookups(current.clients, missingClients, clients),
        services: addLookups(current.services, missingServices, services),
      }));
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey]);

  const attentionCount = rows.filter((row) => row.attention).length;
  const reference = (order: Order): string => formatOrderReference(order, state.status === 'ready' ? state.data : []);

  return (
    <Widget title="Entregas de hoje" subtitle="Pedidos em andamento com prazo de entrega ao cliente hoje. Em amarelo: ainda não estão em Entregar." icon={ClipboardList} tone="bg-emerald-500/10 text-emerald-300" onOpen={onOpen} openLabel="Abrir Pedidos">
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorState />}
      {state.status === 'ready' && (rows.length === 0 ? <Empty>Nenhuma entrega prevista para hoje.</Empty> : (
        <>
          <p className="mb-3 text-xs text-white/55">
            {rows.length} {rows.length === 1 ? 'entrega' : 'entregas'}
            {attentionCount > 0 && <> · <span className="font-semibold text-amber-300">{attentionCount} {attentionCount === 1 ? 'precisa de atenção' : 'precisam de atenção'}</span></>}
          </p>
          <ul className="space-y-2">
            {rows.slice(0, 5).map(({ order, attention }) => {
              const client = names.clients.get(order.clientId);
              const service = names.services.get(order.serviceId);
              return (
                <li key={order.id}>
                  <button type="button" onClick={() => onOpenOrder(order.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors hover:bg-white/5 ${attention ? 'border-amber-400/40 bg-amber-400/5' : 'border-white/10'}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-white">{client?.name ?? 'Cliente'}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${attention ? 'bg-amber-400/15 text-amber-200' : 'bg-emerald-400/15 text-emerald-200'}`}>
                        {STAGE_LABELS[order.status] ?? order.status}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-white/50">{service?.title ?? 'Serviço'} · Pedido {reference(order)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {rows.length > 5 && <p className="mt-2 text-[11px] text-white/40">+ {rows.length - 5} no Kanban</p>}
        </>
      ))}
    </Widget>
  );
};
