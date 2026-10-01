import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Loader2, Plus, Search } from 'lucide-react';
import { getClientById } from '../../services/clientsService';
import { listOrders } from '../../services/ordersService';
import { getServiceById } from '../../services/servicesService';
import type { Client, Order, Service } from '../../types';
import { CreateOrderModal } from './CreateOrderModal';

type OrderView = { order: Order; client?: Client | null; service?: Service | null };
const COLUMNS = [
  { status: 'scheduled', label: 'AGENDADO', accent: 'border-blue-400' },
  { status: 'recording', label: 'GRAVAR', accent: 'border-amber-400' },
  { status: 'editing', label: 'EDITAR', accent: 'border-violet-400' },
  { status: 'delivery', label: 'ENTREGAR', accent: 'border-emerald-400' },
] as const;

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof (value as any)?.toDate === 'function') return (value as any).toDate();
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value: unknown): string | null {
  const date = toDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date) : null;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function deadlineState(value: unknown): 'overdue' | 'soon' | 'normal' {
  const date = toDate(value);
  if (!date) return 'normal';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  return days < 0 ? 'overdue' : days <= 2 ? 'soon' : 'normal';
}

function dueTime(order: Order): number {
  return toDate(order.internalDueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
}

export const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [totalOrderCount, setTotalOrderCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [success, setSuccess] = useState('');

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allOrders = await listOrders();
      setTotalOrderCount(allOrders.length);
      const visibleOrders = allOrders.filter((order) => order.status !== 'completed');
      const clientIds = [...new Set(visibleOrders.map((order) => order.clientId).filter(Boolean))];
      const serviceIds = [...new Set(visibleOrders.map((order) => order.serviceId).filter(Boolean))];
      const [clients, services] = await Promise.all([
        Promise.all(clientIds.map((id) => getClientById(id))),
        Promise.all(serviceIds.map((id) => getServiceById(id))),
      ]);
      const clientsById = new Map(clientIds.map((id, index) => [id, clients[index]]));
      const servicesById = new Map(serviceIds.map((id, index) => [id, services[index]]));
      setOrders(visibleOrders.map((order) => ({
        order,
        client: clientsById.get(order.clientId),
        service: servicesById.get(order.serviceId),
      })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os pedidos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  useEffect(() => {
    if (!success) return;
    const timer = window.setTimeout(() => setSuccess(''), 4500);
    return () => window.clearTimeout(timer);
  }, [success]);

  const handleOrderCreated = async () => {
    setCreateOpen(false);
    setSuccess('Pedido criado com sucesso.');
    await loadOrders();
  };

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return orders.filter(({ client, service }) => !term ||
      (client?.name || '').toLocaleLowerCase('pt-BR').includes(term) ||
      (service?.title || '').toLocaleLowerCase('pt-BR').includes(term));
  }, [orders, search]);

  return (
    <section className="animate-in fade-in duration-200 space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-400">Central do Herói</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Pedidos</h2>
          <p className="mt-1 text-sm text-white/50">Acompanhe cada pedido por etapa de produção.</p>
        </div>
        <div className="flex flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <label className="relative block sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente ou serviço"
              aria-label="Buscar pedidos por cliente ou serviço"
              className="w-full rounded-xl border border-white/10 bg-[#0D1527] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-blue-500/60"
            />
          </label>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/15 transition-colors hover:bg-blue-500"
          >
            <Plus className="h-4 w-4" /> Novo Pedido
          </button>
        </div>
      </div>

      {success && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{success}</div>}

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" /> Não foi possível carregar os pedidos. {error}
        </div>
      )}

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
        <div className="-mx-4 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="grid min-w-max grid-cols-4 gap-3 lg:min-w-0 lg:gap-4">
            {COLUMNS.map((column) => {
              const columnOrders = filteredOrders
                .filter(({ order }) => order.status === column.status)
                .sort((a, b) => dueTime(a.order) - dueTime(b.order));
              return (
                <section key={column.status} aria-label={column.label} className="w-[min(78vw,290px)] lg:w-auto lg:min-w-0">
                  <header className={`mb-3 flex items-center justify-between border-t-2 ${column.accent} rounded-t-sm bg-[#0B1120] px-3 py-3`}>
                    <h3 className="text-xs font-extrabold tracking-[0.12em] text-white/80">{column.label}</h3>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/65">{columnOrders.length}</span>
                  </header>
                  <div className="space-y-2.5">
                    {columnOrders.map(({ order, client, service }) => {
                      const state = deadlineState(order.internalDueDate);
                      const internalDate = formatDate(order.internalDueDate);
                      const eventDate = formatDate(order.eventDate);
                      return (
                        <article key={order.id} className={`rounded-xl border bg-[#0D1527] p-3.5 shadow-lg ${state === 'overdue' ? 'border-red-500/45' : state === 'soon' ? 'border-amber-400/35' : 'border-white/10'}`}>
                          <h4 className="truncate text-sm font-bold text-white">{client?.name || 'Cliente não encontrado'}</h4>
                          <p className="mt-0.5 truncate text-xs text-white/55">{service?.title || 'Serviço não encontrado'}</p>
                          {(eventDate || internalDate) && (
                            <div className="mt-3 space-y-1 border-t border-white/5 pt-2.5 text-[11px]">
                              {eventDate && <p className="text-white/55">Evento/entrega: <span className="text-white/80">{eventDate}</span></p>}
                              {internalDate && <p className={state === 'overdue' ? 'font-semibold text-red-300' : state === 'soon' ? 'font-semibold text-amber-200' : 'text-white/55'}>
                                Interno: <span>{internalDate}{state === 'overdue' ? ' · Vencido' : state === 'soon' ? ' · Próximo' : ''}</span>
                              </p>}
                            </div>
                          )}
                          <p className="mt-3 text-sm font-extrabold text-emerald-300">{formatMoney(order.totalPaid)}</p>
                        </article>
                      );
                    })}
                    {columnOrders.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/30">Nenhum pedido nesta etapa</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      ) : null}

      {createOpen && <CreateOrderModal onClose={() => setCreateOpen(false)} onCreated={handleOrderCreated} />}
    </section>
  );
};
