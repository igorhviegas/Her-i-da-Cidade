import React from 'react';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import type { Asset, FixedExpense, RevenueEntry } from '../../../services/financeCalculations.js';
import { FinanceExpenses } from '../FinanceExpenses';
import { FinanceAssets } from '../FinanceAssets';
import { FinanceStock } from '../FinanceStock';
import { FinanceLeaderboard } from '../FinanceLeaderboard';
import { ghostBtn, inputClass, labelClass, MONTH_NAMES } from '../financeFormat';

export type FinanceTab = 'summary' | 'statement' | 'expenses' | 'assets' | 'stock' | 'leaderboard';
export const TABS: { id: FinanceTab; label: string }[] = [
  { id: 'summary', label: 'Resumo' }, { id: 'statement', label: 'Extrato' }, { id: 'expenses', label: 'Despesas' }, { id: 'assets', label: 'Patrimônio' }, { id: 'stock', label: 'Estoque' }, { id: 'leaderboard', label: 'Leaderboard' },
];

interface FinanceHeaderProps {
  monthKey: string;
  years: number[];
  loading: boolean;
  onMonthKey: (monthKey: string) => void;
  onRefresh: () => void;
}

export const FinanceHeader: React.FC<FinanceHeaderProps> = ({ monthKey, years, loading, onMonthKey, onRefresh }) => (
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="text-2xl font-extrabold tracking-tight text-white">Financeiro</h2>
      <p className="text-sm text-white/55">Faturamento = serviços concluídos pelo valor do pedido, na data do evento (pagos ou não).</p>
    </div>
    <div className="flex items-end gap-2">
      <label className={labelClass}>Mês
        <select value={monthKey.slice(5)} onChange={(e) => onMonthKey(`${monthKey.slice(0, 4)}-${e.target.value}`)} className={inputClass}>
          {MONTH_NAMES.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
        </select>
      </label>
      <label className={labelClass}>Ano
        <select value={monthKey.slice(0, 4)} onChange={(e) => onMonthKey(`${e.target.value}-${monthKey.slice(5)}`)} className={inputClass}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <button type="button" onClick={onRefresh} disabled={loading} aria-label="Atualizar despesas e patrimônio" className={`${ghostBtn} mb-0.5 h-[42px]`}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
    </div>
  </div>
);

interface FinanceStatusProps {
  error: string | null;
  loading: boolean;
  hasData: boolean;
  hasOrders: boolean;
  onRetry: () => void;
}

export const FinanceStatus: React.FC<FinanceStatusProps> = ({ error, loading, hasData, hasOrders, onRetry }) => (
  <>
    {error && (
      <div className="flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300" role="alert">
        <AlertCircle className="h-4 w-4 shrink-0" /><span className="flex-1">{error}</span>
        <button type="button" className={ghostBtn} onClick={onRetry}>Tentar novamente</button>
      </div>
    )}
    {(loading && !hasData || (hasData && !hasOrders)) && <div className="flex items-center justify-center gap-2 py-16 text-sm text-white/50"><Loader2 className="h-4 w-4 animate-spin" />Carregando dados financeiros…</div>}
  </>
);

interface FinanceOtherTabsProps {
  tab: FinanceTab;
  expenses: FixedExpense[];
  assets: Asset[];
  videoCost: React.ComponentProps<typeof FinanceExpenses>['videoCost'];
  eventCost: React.ComponentProps<typeof FinanceExpenses>['eventCost'];
  monthKey: string;
  onChanged: () => Promise<void>;
  entries: RevenueEntry[];
  nameOf: (id: string) => string;
}

export const FinanceOtherTabs: React.FC<FinanceOtherTabsProps> = ({ tab, expenses, assets, videoCost, eventCost, monthKey, onChanged, entries, nameOf }) => (
  <>
    {tab === 'expenses' && <FinanceExpenses expenses={expenses} videoCost={videoCost} eventCost={eventCost} monthKey={monthKey} onChanged={onChanged} />}
    {tab === 'assets' && <FinanceAssets assets={assets} onChanged={onChanged} />}
    {tab === 'stock' && <FinanceStock />}
    {tab === 'leaderboard' && <FinanceLeaderboard entries={entries} nameOf={nameOf} />}
  </>
);
