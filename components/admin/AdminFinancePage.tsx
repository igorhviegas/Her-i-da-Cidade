import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Loader2, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { getClientById } from '../../services/clientsService';
import { getServiceById } from '../../services/servicesService';
import { extractBirthdayPerson } from '../../services/orderReference.js';
import { listAssets, listFixedExpenses, subscribeCompletedOrders } from '../../services/financeService';
import {
  buildRevenueEntries, dailyRevenue, expensesForMonth, monthKeyOf, monthTotals, patrimonySummary, revenueSeries, shiftMonth, topDay, variationPct,
  type Asset, type FixedExpense,
} from '../../services/financeCalculations.js';
import type { Client, Order, Service } from '../../types';
import { DailyCompass, MonthlyBars } from './FinanceCharts';
import { FinanceExpenses } from './FinanceExpenses';
import { FinanceAssets } from './FinanceAssets';
import { FinanceStock } from './FinanceStock';
import { cardClass, formatDate, formatMoney, ghostBtn, inputClass, labelClass, MONTH_NAMES, monthLabel } from './financeFormat';

type FinanceTab = 'summary' | 'statement' | 'expenses' | 'assets' | 'stock';
const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'summary', label: 'Resumo' }, { id: 'statement', label: 'Extrato' }, { id: 'expenses', label: 'Despesas fixas' }, { id: 'assets', label: 'Patrimônio' }, { id: 'stock', label: 'Estoque' },
];

interface Loaded { expenses: FixedExpense[]; assets: Asset[] }
type Lookup<T> = Map<string, T | null>;

const Kpi: React.FC<{ label: string; value: string; hint?: React.ReactNode; tone?: string }> = ({ label, value, hint, tone = 'text-white' }) => (
  <div className={cardClass}>
    <p className="text-[11px] font-semibold uppercase tracking-wider text-white/50">{label}</p>
    <p className={`mt-1 text-xl font-extrabold tabular-nums sm:text-2xl ${tone}`}>{value}</p>
    {hint && <p className="mt-1 text-xs text-white/50">{hint}</p>}
  </div>
);

export const AdminFinancePage: React.FC = () => {
  const { navigate } = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [clients, setClients] = useState<Lookup<Client>>(new Map());
  const [services, setServices] = useState<Lookup<Service>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FinanceTab>('summary');
  const [monthKey, setMonthKey] = useState(() => monthKeyOf(new Date()));
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [newestFirst, setNewestFirst] = useState(true);

  // Despesas e patrimônio: leitura sob demanda (poucos documentos).
  const loadCollections = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [expenses, assets] = await Promise.all([listFixedExpenses(), listAssets()]);
      setData({ expenses, assets });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar os dados financeiros.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadCollections(); }, [loadCollections]);

  // Pedidos concluídos: tempo real (compartilhado com o indicador do topo).
  useEffect(() => subscribeCompletedOrders(
    (list) => { setOrders(list); setError(null); },
    (e) => setError(e.message || 'Não foi possível carregar os pedidos.'),
  ), []);

  const { entries, undated } = useMemo(() => buildRevenueEntries(orders ?? []), [orders]);

  // Nomes de clientes/serviços: busca apenas ids ainda não conhecidos.
  useEffect(() => {
    const missing = (ids: (string | undefined)[], known: Lookup<unknown>) => [...new Set(ids.filter((id): id is string => !!id && !known.has(id)))];
    const newClients = missing(entries.map((e) => e.order.clientId), clients);
    const newServices = missing(entries.map((e) => e.order.serviceId), services);
    if (newClients.length) void Promise.all(newClients.map((id) => getClientById(id).catch(() => null))).then((r) => setClients((prev) => new Map([...prev, ...newClients.map((id, i) => [id, r[i]] as const)])));
    if (newServices.length) void Promise.all(newServices.map((id) => getServiceById(id).catch(() => null))).then((r) => setServices((prev) => new Map([...prev, ...newServices.map((id, i) => [id, r[i]] as const)])));
  }, [entries, clients, services]);

  useEffect(() => { setSelectedDay(null); }, [monthKey]);

  const reloadCollections = useCallback(async () => {
    const [expenses, assets] = await Promise.all([listFixedExpenses(), listAssets()]);
    setData({ expenses, assets });
  }, []);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    const first = Math.min(current, ...entries.map((e) => e.revenueDate.getFullYear()), Number(monthKey.slice(0, 4)));
    return Array.from({ length: current + 1 - first + 1 }, (_, i) => first + i);
  }, [entries, monthKey]);

  const view = useMemo(() => {
    if (!data || !orders) return null;
    const current = monthTotals(entries, monthKey);
    const previous = monthTotals(entries, shiftMonth(monthKey, -1));
    const expenseTotal = expensesForMonth(data.expenses, monthKey).total;
    const days = dailyRevenue(entries, monthKey);
    const monthEntries = entries.filter((e) => e.monthKey === monthKey);
    return {
      current, previous, expenseTotal, days, monthEntries, top: topDay(days), variation: variationPct(current.total, previous.total),
      series: revenueSeries(entries, monthKey, 12), patrimony: patrimonySummary(data.assets),
    };
  }, [data, orders, entries, monthKey]);

  const statementRows = useMemo(() => {
    if (!data || !view) return [];
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return view.monthEntries
      .map((e) => ({ e, client: clients.get(e.order.clientId), service: services.get(e.order.serviceId), child: extractBirthdayPerson(e.order) as string | null }))
      .filter(({ e, client, service, child }) => !term || [client?.name, service?.title, child, e.orderId].some((v) => (v || '').toLocaleLowerCase('pt-BR').includes(term)))
      .sort((a, b) => (newestFirst ? -1 : 1) * (a.e.revenueDate.getTime() - b.e.revenueDate.getTime()));
  }, [data, view, clients, services, search, newestFirst]);

  const statementTotal = statementRows.reduce((sum, row) => sum + row.e.value, 0);
  const selectedEntries = selectedDay ? view?.days[selectedDay - 1]?.entries ?? [] : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">Financeiro</h2>
          <p className="text-sm text-white/55">Faturamento = serviços concluídos pelo valor do pedido, na data do evento (pagos ou não).</p>
        </div>
        <div className="flex items-end gap-2">
          <label className={labelClass}>Mês
            <select value={monthKey.slice(5)} onChange={(e) => setMonthKey(`${monthKey.slice(0, 4)}-${e.target.value}`)} className={inputClass}>
              {MONTH_NAMES.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
            </select>
          </label>
          <label className={labelClass}>Ano
            <select value={monthKey.slice(0, 4)} onChange={(e) => setMonthKey(`${e.target.value}-${monthKey.slice(5)}`)} className={inputClass}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void loadCollections()} disabled={loading} aria-label="Atualizar despesas e patrimônio" className={`${ghostBtn} mb-0.5 h-[42px]`}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300" role="alert">
          <AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
          <button type="button" className={ghostBtn} onClick={() => void loadCollections()}>Tentar novamente</button>
        </div>
      )}
      {(loading && !data || (data && !orders)) && <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando dados financeiros…</div>}

      {data && view && (
        <>
          {undated > 0 && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {undated} pedido(s) concluído(s) sem nenhuma data registrada ficam fora do faturamento mensal.
            </p>
          )}

          {tab === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                <Kpi label={`Faturamento · ${MONTH_NAMES[Number(monthKey.slice(5)) - 1]}`} value={formatMoney(view.current.total)} hint={`${view.current.count} serviço${view.current.count === 1 ? '' : 's'} concluído${view.current.count === 1 ? '' : 's'}`} tone="text-emerald-300" />
                <Kpi label="Mês anterior" value={formatMoney(view.previous.total)} hint={monthLabel(shiftMonth(monthKey, -1))} />
                <Kpi label="Variação" value={view.variation === null ? '—' : `${view.variation > 0 ? '+' : ''}${view.variation.toFixed(1).replace('.', ',')}%`}
                  tone={view.variation === null ? 'text-white/60' : view.variation >= 0 ? 'text-emerald-300' : 'text-red-300'}
                  hint={view.variation === null ? 'Sem base de comparação' : view.variation >= 0 ? <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3 w-3" />vs. mês anterior</span> : <span className="inline-flex items-center gap-1"><ArrowDownRight className="h-3 w-3" />vs. mês anterior</span>} />
                <Kpi label="Despesas fixas" value={formatMoney(view.expenseTotal)} />
                <Kpi label="Resultado operacional estimado" value={formatMoney(view.current.total - view.expenseTotal)} tone={view.current.total - view.expenseTotal >= 0 ? 'text-white' : 'text-red-300'} hint="Faturamento − despesas fixas" />
                <Kpi label="Patrimônio ativo" value={formatMoney(view.patrimony.currentTotal)} hint={`${view.patrimony.activeCount} iten${view.patrimony.activeCount === 1 ? '' : 's'}`} />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <section className={cardClass}>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white"><TrendingUp className="h-4 w-4 text-blue-400" />Evolução mensal (12 meses)</h3>
                  <MonthlyBars series={view.series} selected={monthKey} />
                </section>
                <section className={cardClass}>
                  <h3 className="mb-1 text-sm font-bold text-white">Faturamento diário · {monthLabel(monthKey)}</h3>
                  {view.current.total === 0 ? <p className="py-10 text-center text-sm text-white/45">Nenhum serviço concluído neste mês.</p> : (
                    <>
                      <p className="mb-2 text-xs text-white/50">Maior dia: <span className="font-semibold text-amber-300">dia {view.top?.day} · {formatMoney(view.top?.total ?? 0)}</span></p>
                      <DailyCompass days={view.days} topDay={view.top?.day ?? null} selectedDay={selectedDay} onSelect={setSelectedDay} monthTotal={view.current.total} />
                      {selectedDay && (
                        <ul className="mt-3 space-y-1.5 rounded-xl bg-black/20 p-3 text-xs text-white/70">
                          {selectedEntries.length === 0 ? <li>Nenhum serviço no dia {selectedDay}.</li> : selectedEntries.map((e) => (
                            <li key={e.orderId} className="flex justify-between gap-3"><span className="truncate">{clients.get(e.order.clientId)?.name || 'Cliente'} · {services.get(e.order.serviceId)?.title || 'Serviço'}</span><span className="shrink-0 font-semibold">{formatMoney(e.value)}</span></li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </section>
              </div>
            </div>
          )}

          {tab === 'statement' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className={`${labelClass} min-w-[200px] flex-1`}>Pesquisar
                  <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, criança ou serviço" className={`${inputClass} pl-9`} /></span>
                </label>
                <button type="button" className={`${ghostBtn} h-[42px]`} onClick={() => setNewestFirst((v) => !v)}>Data do evento: {newestFirst ? 'mais recentes' : 'mais antigos'}</button>
              </div>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/70">
                <span><strong className="text-white">{statementRows.length}</strong> serviço{statementRows.length === 1 ? '' : 's'} concluído{statementRows.length === 1 ? '' : 's'}</span>
                <span>Total do período: <strong className="text-emerald-300">{formatMoney(statementTotal)}</strong></span>
              </div>
              {statementRows.length === 0 ? (
                <div className={`${cardClass} text-center text-sm text-white/45`}>{search ? 'Nenhum serviço encontrado para a pesquisa.' : `Nenhum serviço concluído em ${monthLabel(monthKey)}.`}</div>
              ) : (
                <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
                  {statementRows.map(({ e, client, service, child }) => (
                    <div key={e.orderId} className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-white/45">{formatDate(e.revenueDate)} · <span className="text-emerald-300/80">Concluído</span></p>
                        <p className="truncate text-sm font-bold text-white">{child ? `${child} · ` : ''}{client?.name || `Pedido ${e.orderId.slice(0, 6)}`}</p>
                        <p className="truncate text-xs text-white/55">{service?.title || 'Serviço não encontrado'}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <p className="text-sm font-extrabold text-white">{formatMoney(e.value)}</p>
                        <button type="button" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300" onClick={() => navigate('/admin/pedidos')}>Ver pedidos</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'expenses' && <FinanceExpenses expenses={data.expenses} monthKey={monthKey} onChanged={reloadCollections} />}
          {tab === 'assets' && <FinanceAssets assets={data.assets} onChanged={reloadCollections} />}
          {tab === 'stock' && <FinanceStock />}
        </>
      )}
    </div>
  );
};
