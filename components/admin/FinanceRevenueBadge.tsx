import React, { useEffect, useState } from 'react';
import { Coins, Eye, EyeOff } from 'lucide-react';
import { subscribeCompletedOrders } from '../../services/financeService';
import { buildRevenueEntries, monthKeyOf, monthTotals } from '../../services/financeCalculations.js';
import { formatMoney } from './financeFormat';

const HIDDEN_KEY = 'hdc.finance.revenueHidden';
const readHidden = () => { try { return localStorage.getItem(HIDDEN_KEY) === '1'; } catch { return false; } };

/** Faturamento do mês atual (serviços concluídos) no topo do CRM; ocultar é só visual e persiste no aparelho. */
export const FinanceRevenueBadge: React.FC = () => {
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [hidden, setHidden] = useState(readHidden);

  useEffect(() => subscribeCompletedOrders(
    (orders) => { setTotal(monthTotals(buildRevenueEntries(orders).entries, monthKeyOf(new Date())).total); setFailed(false); },
    () => setFailed(true),
  ), []);

  const toggle = () => {
    const next = !hidden;
    setHidden(next);
    try { localStorage.setItem(HIDDEN_KEY, next ? '1' : '0'); } catch { /* sem persistência disponível */ }
  };

  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 py-1 pl-2 pr-1" title="Faturamento do mês atual (serviços concluídos, pagos ou não)">
      <Coins className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-hidden />
      <span className="whitespace-nowrap text-xs font-bold tabular-nums text-white/90" aria-live="polite">
        {failed ? '—' : total === null ? '…' : hidden ? 'R$ ••••' : formatMoney(total)}
      </span>
      <button type="button" onClick={toggle} aria-label={hidden ? 'Mostrar faturamento' : 'Ocultar faturamento'} aria-pressed={hidden}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white">
        {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};
