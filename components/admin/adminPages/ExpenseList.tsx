import React from 'react';
import { Receipt } from 'lucide-react';
import { currentDefaultAmount, type FixedExpense } from '../../../services/financeCalculations.js';
import { setFixedExpenseAdjustment } from '../../../services/financeService';
import { cardClass, ghostBtn, formatMoney, monthLabel } from '../financeFormat';
import type { ExpenseMode } from './ExpenseForm';

interface AutoCost { items: unknown[]; total: number }

interface ExpenseListProps {
  items: { expense: FixedExpense; amount: number; adjusted: boolean }[];
  videoCost: AutoCost;
  eventCost: AutoCost;
  monthKey: string;
  saving: boolean;
  onOpen: (next: ExpenseMode, expense?: FixedExpense) => void;
  onRun: (action: () => Promise<void>, success: string) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ items, videoCost, eventCost, monthKey, saving, onOpen, onRun }) => (
  items.length === 0 && videoCost.items.length === 0 && eventCost.items.length === 0 ? (
    <div className={`${cardClass} text-center`}><Receipt className="mx-auto h-8 w-8 text-white/20" /><p className="mt-3 text-sm text-white/45">Nenhuma despesa em {monthLabel(monthKey)}.</p></div>
  ) : (
    <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-[#0D1527]">
      {videoCost.items.length > 0 && (
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Custo de edição — Vídeo personalizado</p>
            <p className="text-xs text-white/50">Edição de vídeos · automático: {videoCost.items.length} vídeo{videoCost.items.length === 1 ? '' : 's'} concluído{videoCost.items.length === 1 ? '' : 's'} no mês</p>
          </div>
          <p className="shrink-0 text-sm font-extrabold text-white">{formatMoney(videoCost.total)}</p>
        </div>
      )}
      {eventCost.items.length > 0 && (
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">Despesa evento</p>
            <p className="text-xs text-white/50">Custo de eventos · automático: {eventCost.items.length} evento{eventCost.items.length === 1 ? '' : 's'} concluído{eventCost.items.length === 1 ? '' : 's'} no mês</p>
          </div>
          <p className="shrink-0 text-sm font-extrabold text-white">{formatMoney(eventCost.total)}</p>
        </div>
      )}
      {items.map(({ expense, amount, adjusted }) => (
        <div key={expense.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{expense.name}</p>
              <p className="text-xs text-white/50">{expense.category}{expense.description ? ` · ${expense.description}` : ''}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-extrabold text-white">{formatMoney(amount)}</p>
              {adjusted && <p className="text-[10px] font-semibold text-amber-300">Ajuste do mês · padrão {formatMoney(currentDefaultAmount(expense))}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className={ghostBtn} onClick={() => onOpen({ id: expense.id, kind: 'info' }, expense)}>Editar</button>
            <button type="button" className={ghostBtn} onClick={() => onOpen({ id: expense.id, kind: 'default' }, expense)}>Novo valor padrão</button>
            <button type="button" className={ghostBtn} onClick={() => onOpen({ id: expense.id, kind: 'adjust' }, expense)}>Ajustar este mês</button>
            {adjusted && <button type="button" className={ghostBtn} disabled={saving} onClick={() => onRun(() => setFixedExpenseAdjustment(expense.id, monthKey, null), 'Ajuste removido.')}>Remover ajuste</button>}
            <button type="button" className={`${ghostBtn} hover:!text-red-300`} onClick={() => onOpen({ id: expense.id, kind: 'deactivate' }, expense)}>Desativar</button>
          </div>
        </div>
      ))}
    </div>
  )
);
