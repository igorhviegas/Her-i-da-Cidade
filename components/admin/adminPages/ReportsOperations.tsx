import React, { useEffect, useMemo, useState } from 'react';
import type { Client, Order, Service } from '../../../types';
import type { RevenueEntry } from '../../../services/financeCalculations.js';
import { toDate } from '../../../services/financeCalculations.js';
import { subscribeActiveOrders } from '../../../services/ordersService';
import { ACTIVE_STAGES, activeHealth, deliveryPerformance, presetRange, type Preset } from '../../../services/reports.js';
import { cardClass, formatDate } from '../financeFormat';
import { Kpi } from './FinanceKpi';
import { useNameLookups, type Lookup } from './financePageHooks';
import { PresetChips } from './ReportsPresets';

const STAGE_LABEL: Record<string, string> = { scheduled: 'Agendado', recording: 'Gravação', editing: 'Edição', delivery: 'Entrega' };
const pct = (value: number | null) => (value === null ? '—' : `${Math.round(value * 100)}%`);
const days = (value: number | null) => (value === null ? '—' : `${value.toFixed(1).replace('.', ',')} dias`);
const asEntries = (orders: Order[]) => orders.map((order) => ({ order })) as unknown as RevenueEntry[]; // useNameLookups só lê order.clientId/serviceId

interface Props { completed: Order[]; clients: Lookup<Client>; services: Lookup<Service> }

type OrderLine = { order: Order; lateDays: number };
const LateList: React.FC<{ rows: OrderLine[]; clients: Props['clients']; services: Props['services']; empty: string; suffix: string }> = ({ rows, clients, services, empty, suffix }) => {
  if (rows.length === 0) return <p className="text-sm text-white/45">{empty}</p>;
  const serviceName = (id: string) => services.get(id)?.title || (services.has(id) ? 'Serviço removido' : 'Carregando…');
  const clientName = (id: string) => clients.get(id)?.name || (clients.has(id) ? 'Cliente removido' : 'Carregando…');
  return (
    <ul className="divide-y divide-white/5 text-sm">
      {rows.map(({ order, lateDays }) => {
        const due = toDate(order.customerDueDate);
        return (
          <li key={order.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0"><span className="block truncate font-semibold text-white">{serviceName(order.serviceId)}</span><span className="block truncate text-xs text-white/50">{clientName(order.clientId)}{due ? ` · prazo ${formatDate(due)}` : ''}</span></span>
            <span className="shrink-0 text-xs font-semibold text-red-300">{lateDays} {lateDays === 1 ? 'dia' : 'dias'} {suffix}</span>
          </li>
        );
      })}
    </ul>
  );
};

export const ReportsOperations: React.FC<Props> = ({ completed, clients: pageClients, services: pageServices }) => {
  const [active, setActive] = useState<Order[] | null>(null);
  const [error, setError] = useState(false);
  const [preset, setPreset] = useState<Preset>('month');

  useEffect(() => subscribeActiveOrders((orders) => { setActive(orders); setError(false); }, () => setError(true)), []);

  const health = useMemo(() => (active ? activeHealth(active) : null), [active]);
  const delivery = useMemo(() => deliveryPerformance(completed, presetRange(preset)), [completed, preset]);
  // Nomes dos pedidos em andamento; os que a página já conhece não são buscados de novo.
  const known = useMemo(() => ({ clients: pageClients, services: pageServices }), [pageClients, pageServices]);
  const activeNames = useNameLookups(useMemo(() => asEntries(active ?? []), [active]), [], known);
  const clients = useMemo(() => new Map([...pageClients, ...activeNames.clients]), [pageClients, activeNames.clients]);
  const services = useMemo(() => new Map([...pageServices, ...activeNames.services]), [pageServices, activeNames.services]);

  return (
    <div className="space-y-5">
      <div className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-white">Agora, em andamento</h3>
        {error && <p className="text-sm text-red-300">Não foi possível carregar os pedidos em andamento.</p>}
        {!error && !health && <p className="text-sm text-white/45">Carregando…</p>}
        {health && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Kpi label="Em andamento" value={String(health.total)} />
              <Kpi label="Atrasados" value={String(health.overdue.length)} tone={health.overdue.length ? 'text-red-300' : 'text-emerald-300'} hint="Prazo ao cliente vencido" />
              <Kpi label="Vencem em 2 dias" value={String(health.dueSoon)} tone={health.dueSoon ? 'text-amber-200' : 'text-white'} hint="Inclui hoje" />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {ACTIVE_STAGES.map((stage) => <span key={stage} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/70">{STAGE_LABEL[stage]}: <b className="text-white">{health.byStatus[stage]}</b></span>)}
            </div>
            <LateList rows={health.overdue} clients={clients} services={services} empty="Nenhum pedido atrasado agora." suffix="de atraso" />
          </div>
        )}
      </div>

      <PresetChips value={preset} onChange={setPreset} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Entregues" value={String(delivery.delivered)} hint="Com prazo ao cliente" />
        <Kpi label="No prazo" value={pct(delivery.onTimeRate)} tone={delivery.onTimeRate === null ? 'text-white' : delivery.onTimeRate >= 0.9 ? 'text-emerald-300' : 'text-amber-200'} hint={`${delivery.onTime} de ${delivery.delivered}`} />
        <Kpi label="Atraso médio" value={days(delivery.avgLateDays)} hint="Só dos que atrasaram" />
        <Kpi label="Tempo até entregar" value={days(delivery.avgLeadDays)} hint="Do pagamento à conclusão" />
      </div>
      <div className={cardClass}>
        <h3 className="mb-3 text-sm font-bold text-white">Entregues com atraso no período</h3>
        <LateList rows={delivery.late} clients={clients} services={services} empty="Nenhuma entrega atrasada no período." suffix="depois do prazo" />
        <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/45">O tempo parado em cada etapa do Kanban ainda não é medido: o sistema não guardava a data de cada mudança de etapa. O prazo é comparado por dia, como no Kanban.</p>
      </div>
    </div>
  );
};
