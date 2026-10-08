import { useEffect, useMemo, useState } from 'react';
import { subscribeCompletedOrders, listFixedExpenses } from '../../../services/financeService';
import { activateXp, loadProfileCounts, previewBaseline } from '../../../services/xpService';
import {
  buildRevenueEntries, editingCostForMonth, eventCostForMonth, expensesForMonth, monthKeyOf, shiftMonth, type FixedExpense,
} from '../../../services/financeCalculations.js';
import { formatMoney } from '../financeFormat';

const HIDDEN_KEY = 'hdc.finance.revenueHidden'; // o mesmo do indicador de faturamento no topo do painel
const readHidden = () => { try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; } };

/** Total de gastos desde o primeiro mês com registro: despesas fixas + custo de edição + despesa de evento (mesma base do Financeiro). */
function totalExpenses(entries: ReturnType<typeof buildRevenueEntries>['entries'], costs: ReturnType<typeof buildRevenueEntries>['costs'], fixed: FixedExpense[], now: Date) {
  const nowKey = monthKeyOf(now);
  const first = [...entries.map((e) => e.monthKey), ...costs.map((c) => c.monthKey), ...fixed.map((f) => f.startMonth).filter(Boolean)].sort()[0];
  let total = 0;
  for (let key = first ?? nowKey; key <= nowKey; key = shiftMonth(key, 1)) {
    total += expensesForMonth(fixed, key).total + editingCostForMonth(entries, key).total + eventCostForMonth(costs, key).total;
  }
  return total;
}

/** Contagens do perfil + faturamento/gastos/pedidos totais. */
export function useProfileData() {
  const [counts, setCounts] = useState<Awaited<ReturnType<typeof loadProfileCounts>> | null>(null);
  const [orders, setOrders] = useState<unknown[] | null>(null);
  const [fixed, setFixed] = useState<FixedExpense[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    loadProfileCounts().then(setCounts).catch((e) => setLoadError(e?.message ?? 'Falha ao carregar o perfil.'));
    listFixedExpenses().then(setFixed).catch((e) => setLoadError(e?.message ?? 'Falha ao carregar os gastos.'));
    return subscribeCompletedOrders(setOrders, (e) => setLoadError(e.message));
  }, []);

  const finance = useMemo(() => {
    if (!orders || !fixed) return null;
    const { entries, costs } = buildRevenueEntries(orders);
    return {
      revenue: entries.reduce((sum, e) => sum + e.value, 0),
      // pedido de evento tem várias linhas no livro, e ajustes de receita não são pedido: conta pedidos distintos
      orders: new Set(entries.filter((e) => e.order?.ledgerKind !== 'adjrev').map((e) => e.order?.orderId || e.order?.id)).size,
      expenses: totalExpenses(entries, costs, fixed, new Date()),
    };
  }, [orders, fixed]);

  return { counts, finance, loadError, setLoadError };
}

/** Preferência de ocultar valores (compartilhada com o indicador do topo) e o formatador que a respeita. */
export function useHiddenMoney() {
  const [hidden, setHidden] = useState(readHidden);
  const toggleHidden = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, next ? '1' : '0'); } catch { /* vale só nesta sessão */ }
  };
  const money = (value: number | undefined) => (value === undefined ? '…' : hidden ? 'R$ ••••' : formatMoney(value));
  return { hidden, toggleHidden, money };
}

/** Pré-visualização e ativação única do XP inicial. */
export function useXpActivation(setLoadError: (message: string | null) => void) {
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewBaseline>> | null>(null);
  const [activating, setActivating] = useState(false);

  const startActivation = async () => {
    setActivating(true); setLoadError(null);
    try { setPreview(await previewBaseline()); } catch (e) { setLoadError(e?.message ?? 'Falha ao calcular o XP inicial.'); } finally { setActivating(false); }
  };
  const confirmActivation = async () => {
    if (!preview) return;
    setActivating(true); setLoadError(null);
    try { await activateXp(preview); setPreview(null); } catch (e) { setLoadError(e?.message ?? 'Falha ao gravar o XP inicial (as regras do Firestore já foram publicadas?).'); } finally { setActivating(false); }
  };

  return { preview, setPreview, activating, startActivation, confirmActivation };
}
