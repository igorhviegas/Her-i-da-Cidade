import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '../../lib/router';
import { listAssets, listFixedExpenses, subscribeCompletedOrders } from '../../services/financeService';
import {
  buildRevenueEntries, dailyRevenue, editingCostForMonth, eventCostForMonth, expensesForMonth, monthKeyOf, monthTotals, patrimonySummary, revenueSeries, serviceRanking, shiftMonth, topDay, variationPct,
} from '../../services/financeCalculations.js';
import type { Order } from '../../types';
import { FinanceStatementTab } from './adminPages/FinanceStatementTab';
import { FinanceReportsTab } from './adminPages/FinanceReportsTab';
import { FinanceSummaryTab } from './adminPages/FinanceSummaryTab';
import { FinanceHeader, FinanceOtherTabs, FinanceStatus, TABS, type FinanceTab } from './adminPages/FinanceChrome';
import { useFinanceStatement, useMonthSelection, useNameLookups, type Loaded } from './adminPages/financePageHooks';

export const AdminFinancePage: React.FC = () => {
  const { navigate } = useRouter();
  const [data, setData] = useState<Loaded | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<FinanceTab>('summary');
  const { monthKey, setMonthKey, selectedDay, setSelectedDay } = useMonthSelection(() => monthKeyOf(new Date()));

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
  const { clients, services } = useNameLookups(entries, costs);

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

  const { statement, statementRows, search, setSearch, newestFirst, setNewestFirst, kindFilter, setKindFilter } = useFinanceStatement({ data, entries, costs, monthKey, clients, services });

  const serviceName = useCallback((id: string) => services.get(id)?.title || (services.has(id) ? 'Serviço removido' : 'Carregando…'), [services]);
  // Serviços mais pedidos no mês-calendário vigente (independe do filtro de mês da página); mesma base dos rankings.
  const topServices = useMemo(() => serviceRanking(entries, 'month', 'count', new Date()).slice(0, 8).map((r) => ({ id: r.serviceId, label: serviceName(r.serviceId), count: r.count })), [entries, serviceName]);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <FinanceHeader monthKey={monthKey} years={years} loading={loading} onMonthKey={setMonthKey} onRefresh={() => void loadCollections()} />

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} type="button" onClick={() => setTab(t.id)}
            className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === t.id ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{t.label}</button>
        ))}
      </div>

      <FinanceStatus error={error} loading={loading} hasData={!!data} hasOrders={!!orders} onRetry={() => void loadCollections()} />

      {data && view && (
        <>
          {undated > 0 && (
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              {undated} pedido(s) concluído(s) sem nenhuma data registrada ficam fora do faturamento mensal.
            </p>
          )}

          {tab === 'summary' && <FinanceSummaryTab view={view} monthKey={monthKey} selectedDay={selectedDay} onSelectDay={setSelectedDay} clients={clients} services={services} topServices={topServices} />}

          {tab === 'statement' && statement && (
            <FinanceStatementTab statement={statement} rows={statementRows} monthKey={monthKey} search={search} onSearch={setSearch} newestFirst={newestFirst} onToggleNewestFirst={() => setNewestFirst((v) => !v)}
              kindFilter={kindFilter} onKindFilter={setKindFilter} onOpenOrders={() => navigate('/admin/pedidos')} />
          )}

          {tab === 'reports' && <FinanceReportsTab entries={entries} costs={costs} expenses={data.expenses} clients={clients} services={services} />}

          <FinanceOtherTabs tab={tab} expenses={data.expenses} assets={data.assets} videoCost={view.editing} eventCost={view.eventCost} monthKey={monthKey} onChanged={reloadCollections} entries={entries} nameOf={serviceName} />
        </>
      )}
    </div>
  );
};
