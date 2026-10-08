import React from 'react';
import { Search } from 'lucide-react';
import { LEDGER_LABELS, type LedgerKind } from '../../../services/eventFinance.js';
import type { StatementRow } from '../../../services/financeCalculations.js';
import type { Client, Service } from '../../../types';
import { cardClass, formatDate, formatMoney, ghostBtn, inputClass, labelClass, monthLabel } from '../financeFormat';
import { Kpi } from './FinanceKpi';

export interface StatementItem {
  r: StatementRow;
  client: Client | null | undefined;
  service: Service | null | undefined;
  child: string | null;
}

export interface StatementData { rows: StatementRow[]; totalIn: number; totalOut: number; balance: number }

function statementTitle({ r, client, child }: StatementItem): string {
  const who = child ? `${child} · ` : '';
  return r.source === 'expense' ? r.expense.name : `${who}${client?.name || `Pedido ${r.entry.orderId.slice(0, 6)}`}`;
}

function statementSubtitle({ r, service }: StatementItem): string {
  return r.source === 'expense' ? `Despesa · ${r.expense.category}` : r.source === 'editing' ? 'Custo de edição — Vídeo personalizado' : r.source === 'eventCost' ? LEDGER_LABELS[(r.entry?.order.ledgerKind ?? 'cost') as LedgerKind] : `${service?.title || 'Serviço não encontrado'}${r.entry?.order.ledgerKind ? ` · ${LEDGER_LABELS[r.entry.order.ledgerKind as LedgerKind]}` : ''}`;
}

const StatementRowItem: React.FC<{ item: StatementItem; onOpenOrders: () => void }> = ({ item, onOpenOrders }) => {
  const { r } = item;
  const out = r.kind === 'out';
  const title = statementTitle(item);
  const subtitle = statementSubtitle(item);
  return (
    <div className={`flex items-center justify-between gap-3 p-4 ${out ? 'bg-red-500/10' : ''}`}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-white/45">{formatDate(r.date)} · {out ? <span className="text-red-300/90">Saída</span> : <span className="text-emerald-300/80">Entrada</span>}</p>
        <p className="truncate text-sm font-bold text-white">{title}</p>
        <p className="truncate text-xs text-white/55">{subtitle}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className={`text-sm font-extrabold ${out ? 'text-red-300' : 'text-emerald-300'}`}>{out ? '− ' : '+ '}{formatMoney(Math.abs(r.amount))}</p>
        {r.entry && <button type="button" className="text-[11px] font-semibold text-blue-400 hover:text-blue-300" onClick={onOpenOrders}>Ver pedidos</button>}
      </div>
    </div>
  );
};

interface FinanceStatementTabProps {
  statement: StatementData;
  rows: StatementItem[];
  monthKey: string;
  search: string;
  onSearch: (value: string) => void;
  newestFirst: boolean;
  onToggleNewestFirst: () => void;
  kindFilter: 'all' | 'in' | 'out';
  onKindFilter: (kind: 'all' | 'in' | 'out') => void;
  onOpenOrders: () => void;
}

export const FinanceStatementTab: React.FC<FinanceStatementTabProps> = ({ statement, rows, monthKey, search, onSearch, newestFirst, onToggleNewestFirst, kindFilter, onKindFilter, onOpenOrders }) => (
  <div className="space-y-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className={`${labelClass} min-w-[200px] flex-1`}>Pesquisar
        <span className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 mt-0.5 h-4 w-4 -translate-y-1/2 text-white/35" /><input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Cliente, criança, serviço ou despesa" className={`${inputClass} pl-9`} /></span>
      </label>
      <button type="button" className={`${ghostBtn} h-[42px]`} onClick={onToggleNewestFirst}>Data: {newestFirst ? 'mais recentes' : 'mais antigas'}</button>
    </div>
    <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="tablist">
      {([['all', 'Todos'], ['in', 'Entradas'], ['out', 'Saídas']] as const).map(([id, label]) => (
        <button key={id} role="tab" aria-selected={kindFilter === id} type="button" onClick={() => onKindFilter(id)}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${kindFilter === id ? (id === 'in' ? 'bg-emerald-600 text-white' : id === 'out' ? 'bg-red-600 text-white' : 'bg-blue-600 text-white') : 'text-white/60 hover:text-white'}`}>{label}</button>
      ))}
    </div>
    <div className="grid grid-cols-3 gap-3">
      <Kpi label="Entradas" value={formatMoney(statement.totalIn)} tone="text-emerald-300" />
      <Kpi label="Saídas" value={formatMoney(statement.totalOut)} tone="text-red-300" />
      <Kpi label="Saldo do mês" value={formatMoney(statement.balance)} tone={statement.balance >= 0 ? 'text-white' : 'text-red-300'} />
    </div>
    {rows.length === 0 ? (
      <div className={`${cardClass} text-center text-sm text-white/45`}>{search ? 'Nenhum lançamento encontrado para a pesquisa.' : `Nenhum lançamento em ${monthLabel(monthKey)}.`}</div>
    ) : (
      <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
        {rows.map((item) => <StatementRowItem key={item.r.id} item={item} onOpenOrders={onOpenOrders} />)}
      </div>
    )}
  </div>
);
