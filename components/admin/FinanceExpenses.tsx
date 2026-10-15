import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { creditExpensesForMonth, currentDefaultAmount, expensesForMonth, type FixedExpense } from '../../services/financeCalculations.js';
import {
  createFixedExpense, deactivateFixedExpense, setFixedExpenseAdjustment, setFixedExpenseAmountFrom, updateFixedExpenseInfo,
} from '../../services/financeService';
import { cardClass, formatMoney, monthLabel, primaryBtn } from './financeFormat';
import { CATEGORIES, ExpenseForm, PAYMENT_METHODS, type ExpenseFormState, type ExpenseMode } from './adminPages/ExpenseForm';
import { ExpenseList } from './adminPages/ExpenseList';

const parseAmount = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

export const FinanceExpenses: React.FC<{ expenses: FixedExpense[]; videoCost: { items: unknown[]; total: number }; eventCost: { items: unknown[]; total: number }; monthKey: string; onChanged: () => Promise<void> | void }> = ({ expenses, videoCost, eventCost, monthKey, onChanged }) => {
  const [mode, setMode] = useState<ExpenseMode | null>(null);
  const [form, setForm] = useState<ExpenseFormState>({ name: '', category: CATEGORIES[0], amount: '', description: '', paymentMethod: 'pix', startMonth: monthKey, oneTime: false });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [method, setMethod] = useState<'all' | 'pix' | 'credit'>('all');
  const { items: allItems, total: fixedTotal } = expensesForMonth(expenses, monthKey);
  const creditTotal = creditExpensesForMonth(expenses, monthKey);
  const pixTotal = fixedTotal - creditTotal + videoCost.total + eventCost.total; // edição e eventos são sempre Pix
  const total = method === 'credit' ? creditTotal : method === 'pix' ? pixTotal : creditTotal + pixTotal;
  const items = method === 'all' ? allItems : allItems.filter(({ expense }) => (expense.paymentMethod ?? 'pix') === method);
  const noAuto = { items: [], total: 0 };
  const inactive = expenses.filter((e) => e.active === false);

  const open = (next: ExpenseMode, expense?: FixedExpense) => {
    setFeedback(null); setMode(next);
    setForm({
      name: expense?.name ?? '', category: expense?.category ?? CATEGORIES[0], description: expense?.description ?? '', paymentMethod: expense?.paymentMethod ?? 'pix', startMonth: monthKey, oneTime: false,
      amount: expense ? String(expense.adjustments?.[monthKey] ?? currentDefaultAmount(expense)) : '',
    });
  };

  const run = async (action: () => Promise<void>, success: string) => {
    setSaving(true); setFeedback(null);
    try { await action(); await onChanged(); setMode(null); setFeedback({ ok: true, text: success }); }
    catch (e) { setFeedback({ ok: false, text: e instanceof Error ? e.message : 'Não foi possível salvar.' }); }
    finally { setSaving(false); }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!mode) return;
    const amount = parseAmount(form.amount);
    if (mode === 'new') return run(() => createFixedExpense({ ...form, amount }), 'Despesa cadastrada.');
    const id = mode.id;
    if (mode.kind === 'info') return run(() => updateFixedExpenseInfo(id, form), 'Despesa atualizada.');
    if (mode.kind === 'default') return run(() => setFixedExpenseAmountFrom(id, monthKey, amount), `Novo valor padrão a partir de ${monthLabel(monthKey)}.`);
    if (mode.kind === 'adjust') return run(() => setFixedExpenseAdjustment(id, monthKey, amount), `Ajuste aplicado somente em ${monthLabel(monthKey)}.`);
    return run(() => deactivateFixedExpense(id, monthKey), `Despesa desativada a partir de ${monthLabel(monthKey)}.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Total de despesas{method === 'all' ? '' : ` no ${PAYMENT_METHODS[method]}`} ·{monthLabel(monthKey)}</p>
          <p className="text-2xl font-extrabold text-white">{formatMoney(total)}</p>
          <p className="text-xs text-white/50">Pix: {formatMoney(pixTotal)} · Crédito: {formatMoney(creditTotal)}</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1" role="group" aria-label="Forma de pagamento">
          {(['all', 'pix', 'credit'] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
              className={`rounded-lg px-3 py-2 text-xs font-semibold sm:py-1.5 transition ${method === m ? 'bg-blue-600 text-white' : 'text-white/60 hover:text-white'}`}>{m === 'all' ? 'Todas' : PAYMENT_METHODS[m]}</button>
          ))}
        </div>
        <button type="button" className={primaryBtn} onClick={() => open('new')}><Plus className="h-4 w-4" />Nova despesa</button>
      </div>

      {feedback && <p role="status" className={`rounded-xl border p-3 text-xs font-medium ${feedback.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{feedback.text}</p>}

      {mode && <ExpenseForm mode={mode} expenses={expenses} monthKey={monthKey} form={form} setForm={setForm} saving={saving} onSubmit={submit} onCancel={() => setMode(null)} />}

      <ExpenseList items={items} videoCost={method === 'credit' ? noAuto : videoCost} eventCost={method === 'credit' ? noAuto : eventCost} monthKey={monthKey} saving={saving} onOpen={open} onRun={(action, success) => void run(action, success)} />

      {inactive.length > 0 && (
        <details className={cardClass}>
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-white/55">Despesas inativas ({inactive.length})</summary>
          <ul className="mt-3 space-y-1.5 text-sm text-white/65">
            {inactive.map((e) => <li key={e.id}>{e.name} · {e.category} · {formatMoney(currentDefaultAmount(e))}/mês · inativa desde {e.deactivatedFrom ? monthLabel(e.deactivatedFrom) : '—'}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
};
