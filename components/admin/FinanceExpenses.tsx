import React, { useState } from 'react';
import { Plus, Receipt } from 'lucide-react';
import { currentDefaultAmount, expensesForMonth, type FixedExpense } from '../../services/financeCalculations.js';
import {
  createFixedExpense, deactivateFixedExpense, setFixedExpenseAdjustment, setFixedExpenseAmountFrom, updateFixedExpenseInfo,
} from '../../services/financeService';
import { cardClass, ghostBtn, inputClass, labelClass, formatMoney, MONTH_NAMES, monthLabel, primaryBtn } from './financeFormat';

const CATEGORIES = ['Despesas fixas', 'Funcionários', 'Automações', 'Ferramentas e sistemas', 'Assinaturas', 'Outros custos operacionais'];
type Mode = 'new' | { id: string; kind: 'info' | 'default' | 'adjust' | 'deactivate' };

const parseAmount = (v: string) => (v.trim() === '' ? NaN : Number(v.replace(',', '.')));

export const FinanceExpenses: React.FC<{ expenses: FixedExpense[]; videoCost: { items: unknown[]; total: number }; eventCost: { items: unknown[]; total: number }; monthKey: string; onChanged: () => Promise<void> | void }> = ({ expenses, videoCost, eventCost, monthKey, onChanged }) => {
  const [mode, setMode] = useState<Mode | null>(null);
  const [form, setForm] = useState({ name: '', category: CATEGORIES[0], amount: '', description: '', startMonth: monthKey, oneTime: false });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const { items, total: fixedTotal } = expensesForMonth(expenses, monthKey);
  const total = fixedTotal + videoCost.total + eventCost.total;
  const inactive = expenses.filter((e) => e.active === false);

  const open = (next: Mode, expense?: FixedExpense) => {
    setFeedback(null); setMode(next);
    setForm({
      name: expense?.name ?? '', category: expense?.category ?? CATEGORIES[0], description: expense?.description ?? '', startMonth: monthKey, oneTime: false,
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

  const editing = mode && mode !== 'new' ? expenses.find((e) => e.id === mode.id) : null;
  const kind = mode && mode !== 'new' ? mode.kind : null;
  const needsInfo = mode === 'new' || kind === 'info';
  const needsAmount = mode === 'new' || kind === 'default' || kind === 'adjust';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Total de despesas ·{monthLabel(monthKey)}</p>
          <p className="text-2xl font-extrabold text-white">{formatMoney(total)}</p>
        </div>
        <button type="button" className={primaryBtn} onClick={() => open('new')}><Plus className="h-4 w-4" />Nova despesa</button>
      </div>

      {feedback && <p role="status" className={`rounded-xl border p-3 text-xs font-medium ${feedback.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>{feedback.text}</p>}

      {mode && (
        <form onSubmit={submit} className={`${cardClass} space-y-3`}>
          <h3 className="text-sm font-bold text-white">
            {mode === 'new' ? 'Nova despesa' : kind === 'info' ? `Editar ${editing?.name}` : kind === 'default' ? `Novo valor padrão de ${editing?.name}` : kind === 'adjust' ? `Ajustar ${editing?.name} em ${monthLabel(monthKey)}` : `Desativar ${editing?.name}`}
          </h3>
          {kind === 'default' && <p className="text-xs text-white/55">Vale a partir de {monthLabel(monthKey)}; meses anteriores mantêm o valor antigo.</p>}
          {kind === 'adjust' && <p className="text-xs text-white/55">Vale somente para {monthLabel(monthKey)}; os demais meses não mudam.</p>}
          {kind === 'deactivate' && <p className="text-xs text-white/55">A despesa deixa de compor os meses a partir de {monthLabel(monthKey)}. O histórico anterior é preservado. Para retomar o custo depois, cadastre uma nova despesa.</p>}
          {needsInfo && (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={labelClass}>Nome *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
              <label className={labelClass}>Categoria *<input required list="expense-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} /></label>
              <datalist id="expense-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              <label className={`${labelClass} sm:col-span-2`}>Descrição<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Opcional" /></label>
            </div>
          )}
          {needsAmount && (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className={labelClass}>{mode === 'new' && !form.oneTime ? 'Valor mensal *' : 'Valor *'}<input required type="number" inputMode="decimal" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputClass} placeholder="0,00" /></label>
              {mode === 'new' && (
                <>
                  <label className="flex items-center gap-2 text-xs font-medium text-white/70 sm:col-span-3"><input type="checkbox" checked={form.oneTime} onChange={(e) => setForm({ ...form, oneTime: e.target.checked })} />Despesa única (conta apenas no mês escolhido, sem repetir)</label>
                  <label className={labelClass}>{form.oneTime ? 'Mês *' : 'Mês de início *'}
                    <select value={form.startMonth.slice(5)} onChange={(e) => setForm({ ...form, startMonth: `${form.startMonth.slice(0, 4)}-${e.target.value}` })} className={inputClass}>
                      {MONTH_NAMES.map((name, i) => <option key={name} value={String(i + 1).padStart(2, '0')}>{name}</option>)}
                    </select>
                  </label>
                  <label className={labelClass}>Ano *<input required type="number" min="2000" max="2100" value={form.startMonth.slice(0, 4)} onChange={(e) => setForm({ ...form, startMonth: `${e.target.value}-${form.startMonth.slice(5)}` })} className={inputClass} /></label>
                </>
              )}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Salvando…' : kind === 'deactivate' ? 'Confirmar desativação' : 'Salvar'}</button>
            <button type="button" disabled={saving} className={ghostBtn} onClick={() => setMode(null)}>Cancelar</button>
          </div>
        </form>
      )}

      {items.length === 0 && videoCost.items.length === 0 && eventCost.items.length === 0 ? (
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
                <button type="button" className={ghostBtn} onClick={() => open({ id: expense.id, kind: 'info' }, expense)}>Editar</button>
                <button type="button" className={ghostBtn} onClick={() => open({ id: expense.id, kind: 'default' }, expense)}>Novo valor padrão</button>
                <button type="button" className={ghostBtn} onClick={() => open({ id: expense.id, kind: 'adjust' }, expense)}>Ajustar este mês</button>
                {adjusted && <button type="button" className={ghostBtn} disabled={saving} onClick={() => run(() => setFixedExpenseAdjustment(expense.id, monthKey, null), 'Ajuste removido.')}>Remover ajuste</button>}
                <button type="button" className={`${ghostBtn} hover:!text-red-300`} onClick={() => open({ id: expense.id, kind: 'deactivate' }, expense)}>Desativar</button>
              </div>
            </div>
          ))}
        </div>
      )}

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
