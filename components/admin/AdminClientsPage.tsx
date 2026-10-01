import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, CalendarDays, Search, Users } from 'lucide-react';
import { listClients } from '../../services/clientsService';
import { listOrders } from '../../services/ordersService';
import { getServiceById } from '../../services/servicesService';
import type { Client, Order, OrderStatus } from '../../types';
import { useRouter } from '../../lib/router';

type ClientRow = { client: Client; orders: Order[]; spent: number; lastOrder: Date | null };

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = typeof (value as any)?.toDate === 'function' ? (value as any).toDate() : new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: unknown): string {
  const date = asDate(value);
  return date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date) : '—';
}

function money(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function validPaidAmount(order: Order): number | null {
  return asDate(order.paidAt) && Number.isFinite(order.totalPaid) && order.totalPaid >= 0 ? order.totalPaid : null;
}

function compareClientNames(a: Client, b: Client): number {
  return a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id);
}

const statusNames: Record<OrderStatus, string> = {
  scheduled: 'Agendado', recording: 'Gravar', editing: 'Editar', delivery: 'Entregar', completed: 'Concluído',
};

export const AdminClientsPage: React.FC = () => {
  const { navigate } = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [serviceNames, setServiceNames] = useState<Map<string, string>>(new Map());
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'name' | 'orders' | 'spent' | 'last'>('name');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([listClients(), listOrders()])
      .then(async ([loadedClients, loadedOrders]) => {
        const ids = [...new Set(loadedOrders.map((order) => order.serviceId).filter(Boolean))];
        const services = await Promise.all(ids.map((id) => getServiceById(id)));
        if (!active) return;
        setClients(loadedClients);
        setOrders(loadedOrders);
        setServiceNames(new Map(ids.map((id, index) => [id, services[index]?.title || id])));
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar clientes.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const rows = useMemo<ClientRow[]>(() => {
    const ordersByClientId = new Map<string, Order[]>();
    for (const order of orders) {
      if (!order.clientId) continue;
      const associated = ordersByClientId.get(order.clientId) || [];
      associated.push(order);
      ordersByClientId.set(order.clientId, associated);
    }
    return clients.map((client) => {
    const clientOrders = ordersByClientId.get(client.id) || [];
    const ordered = [...clientOrders].sort((a, b) => (asDate(b.createdAt)?.getTime() ?? 0) - (asDate(a.createdAt)?.getTime() ?? 0) || a.id.localeCompare(b.id));
    const paidAmounts = clientOrders.map((order) => {
      const status = String(order.status).toLowerCase();
      return ['cancelled', 'canceled', 'cancelado', 'cancelada'].includes(status) ? null : validPaidAmount(order);
    });
    const spent = paidAmounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0);
    return { client, orders: ordered, spent, lastOrder: asDate(ordered[0]?.createdAt) };
    });
  }, [clients, orders]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const phoneTerm = term.replace(/\D/g, '');
    const filtered = rows.filter(({ client }) => !term || client.name.toLocaleLowerCase('pt-BR').includes(term) || client.whatsapp.toLocaleLowerCase('pt-BR').includes(term) || (phoneTerm.length > 0 && client.whatsappNormalized.includes(phoneTerm)));
    return filtered.sort((a, b) => {
      if (sort === 'orders') return b.orders.length - a.orders.length || compareClientNames(a.client, b.client);
      if (sort === 'spent') return b.spent - a.spent || compareClientNames(a.client, b.client);
      if (sort === 'last') return (b.lastOrder?.getTime() ?? 0) - (a.lastOrder?.getTime() ?? 0) || compareClientNames(a.client, b.client);
      return compareClientNames(a.client, b.client);
    });
  }, [rows, search, sort]);

  const selected = rows.find(({ client }) => client.id === selectedClientId) || null;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {selected ? (
        <>
          <button type="button" onClick={() => setSelectedClientId(null)} className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 hover:text-blue-200"><ArrowLeft className="h-4 w-4" /> Voltar aos clientes</button>
          <div className="mb-6 rounded-2xl border border-white/10 bg-[#0B1120] p-5 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-300">Perfil do cliente</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white">{selected.client.name}</h2>
            <p className="mt-1 text-sm text-white/60">{selected.client.whatsapp || 'WhatsApp não informado'}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <Metric label="Cadastrado em" value={formatDate(selected.client.createdAt)} />
              <Metric label="Pedidos" value={String(selected.orders.length)} />
              <Metric label="Total gasto" value={money(selected.spent)} />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1120]">
            <div className="border-b border-white/10 px-5 py-4"><h3 className="font-bold text-white">Histórico de pedidos</h3></div>
            {selected.orders.length === 0 ? <p className="p-8 text-center text-sm text-white/45">Este cliente ainda não possui pedidos.</p> : (
              <div className="divide-y divide-white/5">
                {selected.orders.map((order) => <button key={order.id} type="button" onClick={() => navigate(`/admin/pedidos?orderId=${encodeURIComponent(order.id)}`)} className="grid w-full gap-2 px-5 py-4 text-left transition-colors hover:bg-white/[0.03] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{serviceNames.get(order.serviceId) || `Serviço indisponível (${order.serviceId})`}</span><span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/45"><span>Pedido: {formatDate(order.createdAt)}</span>{order.paidAt && <span>Pago: {formatDate(order.paidAt)}</span>}{order.customerDueDate && <span>Prazo: {formatDate(order.customerDueDate)}</span>}</span></span>
                  <span className="flex items-center justify-between gap-4 sm:justify-end"><span className="text-sm font-bold text-emerald-300">{validPaidAmount(order) !== null ? money(validPaidAmount(order)!) : 'Pago não registrado'}</span><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/65">{statusNames[order.status] || order.status}</span></span>
                </button>)}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-400">Central do Herói</p><h2 className="mt-1 text-2xl font-extrabold tracking-tight text-white">Clientes</h2><p className="mt-1 text-sm text-white/55">Consulte clientes e o histórico comercial.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome ou WhatsApp" className="w-full rounded-xl border border-white/10 bg-[#0B1120] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-blue-500/60 sm:w-64" /></label>
              <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Ordenar clientes" className="rounded-xl border border-white/10 bg-[#0B1120] px-3 py-2.5 text-sm text-white outline-none focus:border-blue-500/60"><option value="name">Nome (A–Z)</option><option value="orders">Mais pedidos</option><option value="spent">Maior valor gasto</option><option value="last">Pedido mais recente</option></select>
            </div>
          </div>
          {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-200"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0B1120]">
            <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(140px,1fr)_120px_150px_150px] gap-4 border-b border-white/10 bg-white/[0.02] px-5 py-3 text-[10px] font-bold uppercase tracking-wider text-white/40 md:grid"><span>Cliente</span><span>WhatsApp</span><span>Pedidos</span><span>Total gasto</span><span>Último pedido</span></div>
            {loading ? <div className="p-12 text-center text-sm text-white/45">Carregando clientes…</div> : visibleRows.length === 0 ? <div className="p-12 text-center"><Users className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 text-sm text-white/45">{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}</p></div> : visibleRows.map((row) => (
              <button key={row.client.id} type="button" onClick={() => setSelectedClientId(row.client.id)} className="grid w-full gap-2 border-b border-white/5 px-5 py-4 text-left transition-colors last:border-0 hover:bg-white/[0.03] md:grid-cols-[minmax(0,1.5fr)_minmax(140px,1fr)_120px_150px_150px] md:items-center md:gap-4">
                <span className="truncate text-sm font-semibold text-white">{row.client.name}</span><span className="text-sm text-white/55">{row.client.whatsapp || '—'}</span><span className="text-xs text-white/45 md:text-sm md:text-white/65">{row.orders.length} pedidos</span><span className="text-sm font-semibold text-emerald-300">{money(row.spent)}</span><span className="inline-flex items-center gap-1.5 text-xs text-white/45"><CalendarDays className="h-3.5 w-3.5" />{row.lastOrder ? formatDate(row.lastOrder) : '—'}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">{label}</p><p className="mt-1 text-sm font-semibold text-white">{value}</p></div>;
