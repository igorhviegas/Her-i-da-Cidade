import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowDownRight, ArrowUpRight, Loader2, RefreshCw, Search, TrendingUp } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { getClientById } from '../../services/clientsService';
import { getServiceById } from '../../services/servicesService';
import { extractBirthdayPerson } from '../../services/orderReference.js';
import { LEDGER_LABELS, type LedgerKind } from '../../services/eventFinance.js';
import { listAssets, listFixedExpenses, subscribeCompletedOrders } from '../../services/financeService';
import {
  buildRevenueEntries, buildStatement, dailyRevenue, editingCostForMonth, eventCostForMonth, expensesForMonth, monthKeyOf, monthTotals, patrimonySummary, revenueSeries, serviceRanking, shiftMonth, topDay, variationPct,
  type Asset, type FixedExpense,
} from '../../services/financeCalculations.js';
import type { Client, Order, Service } from '../../types';
import { DailyCompass, MonthlyBars, ServiceBars } from './FinanceCharts';
import { FinanceLeaderboard } from './FinanceLeaderboard';
import { FinanceExpenses } from './FinanceExpenses';
import { FinanceAssets } from './FinanceAssets';
import { FinanceStock } from './FinanceStock';
import { cardClass, formatDate, formatMoney, ghostBtn, inputClass, labelClass, MONTH_NAMES, monthLabel } from './financeFormat';

type FinanceTab = 'summary' | 'statement' | 'expenses' | 'assets' | 'stock' | 'leaderboard';
const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'summary', label: 'Resumo' }, { id: 'statement', label: 'Extrato' }, { id: 'expenses', label: 'Despesas' }, { id: 'assets', label: 'Patrimônio' }, { id: 'stock', label: 'Estoque' }, { id: 'leaderboard', label: 'Leaderboard' },
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
  const [kindFilter, setKindFilter] = useState<'all' | 'in' | 'out'>('all');

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

  const { entries, undated, costs } = useMemo(() => buildRevenueEntries(orders ?? []), [orders]);

  // Nomes de clientes/serviços: busca apenas ids ainda não conhecidos.
  useEffect(() => {
    const missing = (ids: (string | undefined)[], known: Lookup<unknown>) => [...new Set(ids.filter((id): id is string => !!id && !known.has(id)))];
    const withCosts = [...entries, ...costs];
    const newClients = missing(withCosts.map((e) => e.order.clientId), clients);
    const newServices = missing(withCosts.map((e) => e.order.serviceId), services);
    if (newClients.length) void Promise.all(newClients.map((id) => getClientById(id).catch(() => null))).then((r) => setClients((prev) => new Map([...prev, ...newClients.map((id, i) => [id, r[i]] as const)])));
    if (newServices.length) void Promise.all(newServices.map((id) => getServiceById(id).catch(() => null))).then((r) => setServices((prev) => new Map([...prev, ...newServices.map((id, i) => [id, r[i]] as const)])));
  }, [entries, costs, clients, services]);

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
    const fixedTotal = expensesForMonth(data.expenses, monthKey).total;
    const editing = editingCostForMonth(entries, monthKey);
    const eventCost = eventCostForMonth(costs, monthKey);
    const expenseTotal = fixedTotal + editing.total + eventCost.total;
    const days = dailyRevenue(entries, monthKey);
    const monthEntries = entries.filter((e) => e.monthKey === monthKey);
    return {
      current, previous, fixedTotal, editing, eventCost, expenseTotal, days, monthEntries, top: topDay(days), variation: variationPct(current.total, previous.total),
      series: revenueSeries(entries, monthKey, 12), patrimony: patrimonySummary(data.assets),
    };
  }, [data, orders, entries, costs, monthKey]);

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

  const serviceName = useCallback((id: string) => services.get(id)?.title || (services.has(id) ? 'Serviço removido' : 'Carregando…'), [services]);
  // Serviços mais pedidos no mês-calendário vigente (independe do filtro de mês da página); mesma base dos rankings.
  const topServices = useMemo(() => serviceRanking(entries, 'month', 'count', new Date()).slice(0, 8).map((r) => ({ id: r.serviceId, label: serviceName(r.serviceId), count: r.count })), [entries, serviceName]);

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
                <Kpi label="Despesas do mês" value={formatMoney(view.expenseTotal)} tone="text-red-300"
                  hint={`Fixas ${formatMoney(view.fixedTotal)} · Edição de vídeos ${formatMoney(view.editing.total)} · Eventos ${formatMoney(view.eventCost.total)}`} />
                <Kpi label="Resultado operacional estimado" value={formatMoney(view.current.total - view.expenseTotal)} tone={view.current.total - view.expenseTotal >= 0 ? 'text-white' : 'text-red-300'} hint="Faturamento − despesas" />
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

              <section className={cardClass}>
                <h3 className="mb-4 text-sm font-bold text-white">Serviços mais pedidos · {monthLabel(monthKeyOf(new Date()))}</h3>
                <ServiceBars rows={topServices} />
              </section>
            </div>
          )}

          {tab === 'statement' && statement && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className={`${labelClass} min-w-[200px] flex-1`}>Pesquisar
                  <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cliente, criança, serviço ou despesa" className={`${inputClass} pl-9`} /></span>
                </label>
                <button type="button" className={`${ghostBtn} h-[42px]`} onClick={() => setNewestFirst((v) => !v)}>Data: {newestFirst ? 'mais recentes' : 'mais antigas'}</button>
              </div>
              <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
                {([['all', 'Todos'], ['in', 'Entradas'], ['out', 'Saídas']] as const).map(([id, label]) => (
                  <button key={id} role="tab" aria-selected={kindFilter === id} type="button" onClick={() => setKindFilter(id)}
                    className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${kindFilter === id ? (id === 'in' ? 'bg-emerald-600 text-white' : id === 'out' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white') : 'text-white/60 hover:text-white'}`}>{label}</button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Kpi label="Entradas" value={formatMoney(statement.totalIn)} tone="text-emerald-300" />
                <Kpi label="Saídas" value={formatMoney(statement.totalOut)} tone="text-red-300" />
                <Kpi label="Saldo do mês" value={formatMoney(statement.balance)} tone={statement.balance >= 0 ? 'text-white' : 'text-red-300'} />
              </div>
              {statementRows.length === 0 ? (
                <div className={`${cardClass} text-center text-sm text-white/45`}>{search ? 'Nenhum lançamento encontrado para a pesquisa.' : `Nenhum lançamento em ${monthLabel(monthKey)}.`}</div>
              ) : (
                <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
                  {statementRows.map(({ r, client, service, child }) => {
                    const out = r.kind === 'out';
                    const who = child ? `${child} · ` : '';
                    const title = r.source === 'expense' ? r.expense!.name : `${who}${client?.name || `Pedido ${r.entry!.orderId.slice(0, 6)}`}`;
                    const subtitle = r.source === 'expense' ? `Despesa · ${r.expense!.category}` : r.source === 'editing' ? 'Custo de edição — Vídeo personalizado' : r.source === 'eventCost' ? LEDGER_LABELS[(r.entry?.order.ledgerKind ?? 'cost') as LedgerKind] : `${service?.title || 'Serviço não encontrado'}${r.entry?.order.ledgerKind ? ` · ${LEDGER_LABELS[r.entry.order.ledgerKind as LedgerKind]}` : ''}`;
                    return (
                      <div key={r.id} className={`flex items-center justify-between gap-3 p-4 ${out ? 'bg-red-500/10' : ''}`}>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-white/45">{formatDate(r.date)} · {out ? <span className="text-red-300/90">Saída</span> : <span className="text-emerald-300/80">Entrada</span>}</p>
                          <p className="truncate text-sm font-bold text-white">{title}</p>
                          <p className="truncate text-xs text-white/55">{subtitle}</p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1.5">
                          <p className={`text-sm font-extrabold ${out ? 'text-red-300' : 'text-emerald-300'}`}>{out ? '− ' : '+ '}{formatMoney(Math.abs(r.amount))}</p>
                          {r.entry && <button type="button" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300" onClick={() => navigate('/admin/pedidos')}>Ver pedidos</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'expenses' && <FinanceExpenses expenses={data.expenses} videoCost={view.editing} eventCost={view.eventCost} monthKey={monthKey} onChanged={reloadCollections} />}
          {tab === 'assets' && <FinanceAssets assets={data.assets} onChanged={reloadCollections} />}
          {tab === 'stock' && <FinanceStock />}
          {tab === 'leaderboard' && <FinanceLeaderboard entries={entries} nameOf={serviceName} />}
        </>
      )}
    </div>
  );
};
