import React from 'react';
import type { FixedExpense } from '../../../services/financeCalculations.js';
import { cardClass, ghostBtn, inputClass, labelClass, MONTH_NAMES, monthLabel, primaryBtn } from '../financeFormat';

export const CATEGORIES = ['Despesas fixas', 'Funcionários', 'Automações', 'Ferramentas e sistemas', 'Assinaturas', 'Outros custos operacionais'];
export type ExpenseMode = 'new' | { id: string; kind: 'info' | 'default' | 'adjust' | 'deactivate' };
export interface ExpenseFormState { name: string; category: string; amount: string; description: string; startMonth: string; oneTime: boolean }

function modeInfo(mode: ExpenseMode, expenses: FixedExpense[]) {
  const editing = mode && mode !== 'new' ? expenses.find((e) => e.id === mode.id) : null;
  const kind = mode && mode !== 'new' ? mode.kind : null;
  const needsInfo = mode === 'new' || kind === 'info';
  const needsAmount = mode === 'new' || kind === 'default' || kind === 'adjust';
  return { editing, kind, needsInfo, needsAmount };
}

function formTitle(mode: ExpenseMode, editing: FixedExpense | null | undefined, monthKey: string): string {
  const kind = mode && mode !== 'new' ? mode.kind : null;
  return mode === 'new' ? 'Nova despesa' : kind === 'info' ? `Editar ${editing?.name}` : kind === 'default' ? `Novo valor padrão de ${editing?.name}` : kind === 'adjust' ? `Ajustar ${editing?.name} em ${monthLabel(monthKey)}` : `Desativar ${editing?.name}`;
}

interface FieldsProps {
  form: ExpenseFormState;
  setForm: (form: ExpenseFormState) => void;
}

const InfoFields: React.FC<FieldsProps> = ({ form, setForm }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    <label className={labelClass}>Nome *<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
    <label className={labelClass}>Categoria *<input required list="expense-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass} /></label>
    <datalist id="expense-categories">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
    <label className={`${labelClass} sm:col-span-2`}>Descrição<input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputClass} placeholder="Opcional" /></label>
  </div>
);

const AmountFields: React.FC<FieldsProps & { mode: ExpenseMode }> = ({ mode, form, setForm }) => (
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
);

interface ExpenseFormProps extends FieldsProps {
  mode: ExpenseMode;
  expenses: FixedExpense[];
  monthKey: string;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ mode, expenses, monthKey, form, setForm, saving, onSubmit, onCancel }) => {
  const { editing, kind, needsInfo, needsAmount } = modeInfo(mode, expenses);
  return (
    <form onSubmit={onSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="text-sm font-bold text-white">
        {formTitle(mode, editing, monthKey)}
      </h3>
      {kind === 'default' && <p className="text-xs text-white/55">Vale a partir de {monthLabel(monthKey)}; meses anteriores mantêm o valor antigo.</p>}
      {kind === 'adjust' && <p className="text-xs text-white/55">Vale somente para {monthLabel(monthKey)}; os demais meses não mudam.</p>}
      {kind === 'deactivate' && <p className="text-xs text-white/55">A despesa deixa de compor os meses a partir de {monthLabel(monthKey)}. O histórico anterior é preservado. Para retomar o custo depois, cadastre uma nova despesa.</p>}
      {needsInfo && <InfoFields form={form} setForm={setForm} />}
      {needsAmount && <AmountFields mode={mode} form={form} setForm={setForm} />}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Salvando…' : kind === 'deactivate' ? 'Confirmar desativação' : 'Salvar'}</button>
        <button type="button" disabled={saving} className={ghostBtn} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
};
