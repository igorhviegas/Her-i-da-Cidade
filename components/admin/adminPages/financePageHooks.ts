import { useEffect, useMemo, useState } from 'react';
import { getClientById } from '../../../services/clientsService';
import { getServiceById } from '../../../services/servicesService';
import { extractBirthdayPerson } from '../../../services/orderReference.js';
import { buildStatement, type Asset, type FixedExpense, type RevenueEntry } from '../../../services/financeCalculations.js';
import type { Client, Service } from '../../../types';

export type Lookup<T> = Map<string, T | null>;
export interface Loaded { expenses: FixedExpense[]; assets: Asset[] }

/** Nomes de clientes/serviços: busca apenas ids ainda não conhecidos. */
export function useNameLookups(entries: RevenueEntry[], costs: RevenueEntry[]) {
  const [clients, setClients] = useState<Lookup<Client>>(new Map());
  const [services, setServices] = useState<Lookup<Service>>(new Map());

  useEffect(() => {
    const missing = (ids: (string | undefined)[], known: Lookup<unknown>) => [...new Set(ids.filter((id): id is string => !!id && !known.has(id)))];
    const withCosts = [...entries, ...costs];
    const newClients = missing(withCosts.map((e) => e.order.clientId), clients);
    const newServices = missing(withCosts.map((e) => e.order.serviceId), services);
    if (newClients.length) void Promise.all(newClients.map((id) => getClientById(id).catch(() => null))).then((r) => setClients((prev) => new Map([...prev, ...newClients.map((id, i) => [id, r[i]] as const)])));
    if (newServices.length) void Promise.all(newServices.map((id) => getServiceById(id).catch(() => null))).then((r) => setServices((prev) => new Map([...prev, ...newServices.map((id, i) => [id, r[i]] as const)])));
  }, [entries, costs, clients, services]);

  return { clients, services };
}

/** Mês selecionado e o dia destacado no gráfico diário (zera ao trocar de mês). */
export function useMonthSelection(initialMonthKey: () => string) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  useEffect(() => { setSelectedDay(null); }, [monthKey]);
  return { monthKey, setMonthKey, selectedDay, setSelectedDay };
}

interface StatementInput {
  data: Loaded | null;
  entries: RevenueEntry[];
  costs: RevenueEntry[];
  monthKey: string;
  clients: Lookup<Client>;
  services: Lookup<Service>;
}

/** Extrato do mês + pesquisa, ordenação e filtro de entradas/saídas. */
export function useFinanceStatement({ data, entries, costs, monthKey, clients, services }: StatementInput) {
  const [search, setSearch] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);
  const [kindFilter, setKindFilter] = useState<'all' | 'in' | 'out'>('all');

  const statement = useMemo(() => (data ? buildStatement(entries, data.expenses, monthKey, costs) : null), [data, entries, costs, monthKey]);
  const statementRows = useMemo(() => {
    if (!statement) return [];
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return statement.rows
      .filter((r) => kindFilter === 'all' || r.kind === kindFilter)
      .map((r) => ({ r, client: r.entry ? clients.get(r.entry.order.clientId) : undefined, service: r.entry ? services.get(r.entry.order.serviceId) : undefined, child: r.entry ? extractBirthdayPerson(r.entry.order) as string | null : null }))
      .filter(({ r, client, service, child }) => !term || [client?.name, service?.title, child, r.entry?.orderId, r.expense?.name, r.expense?.category].some((v) => (v || '').toLocaleLowerCase('pt-BR').includes(term)))
      .sort((x, y) => (newestFirst ? -1 : 1) * (x.r.date.getTime() - y.r.date.getTime()));
  }, [statement, clients, services, search, newestFirst, kindFilter]);

  return { statement, statementRows, search, setSearch, newestFirst, setNewestFirst, kindFilter, setKindFilter };
}
