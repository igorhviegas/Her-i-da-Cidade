import React from 'react';
import { cardClass, ghostBtn, inputClass, labelClass, primaryBtn } from '../financeFormat';
import type { StockForm, StockMode } from './stockPageHelpers';

function formTitle(mode: StockMode): string {
  return mode.kind === 'new' ? 'Novo material' : mode.kind === 'edit' ? `Editar ${mode.material.name}` : mode.kind === 'entry' ? `Entrada de ${mode.material.name}` : `Ajustar saldo de ${mode.material.name}`;
}

interface StockMaterialFormProps {
  mode: StockMode;
  form: StockForm;
  setForm: React.Dispatch<React.SetStateAction<StockForm>>;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

export const StockMaterialForm: React.FC<StockMaterialFormProps> = ({ mode, form, setForm, saving, onSubmit, onCancel }) => {
  const showMaterialFields = mode.kind === 'new' || mode.kind === 'edit';
  const set = (patch: Partial<StockForm>) => setForm((f) => ({ ...f, ...patch }));
  return (
    <form onSubmit={onSubmit} className={`${cardClass} space-y-3`}>
      <h3 className="text-sm font-bold text-white">{formTitle(mode)}</h3>
      {showMaterialFields && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Nome *<input required value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Categoria *<input required value={form.category} onChange={(e) => set({ category: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Unidade de medida *<input required value={form.unit} onChange={(e) => set({ unit: e.target.value })} className={inputClass} placeholder="unidade, pacote…" /></label>
          <label className={labelClass}>Consumo padrão por evento *<input required type="number" inputMode="numeric" min="0" step="1" value={form.defaultPerEvent} onChange={(e) => set({ defaultPerEvent: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Limite mínimo de reposição *<input required type="number" inputMode="numeric" min="0" step="1" value={form.minLevel} onChange={(e) => set({ minLevel: e.target.value })} className={inputClass} /></label>
          {mode.kind === 'new' && <label className={labelClass}>Saldo inicial<input type="number" inputMode="numeric" min="0" step="1" value={form.initialBalance} onChange={(e) => set({ initialBalance: e.target.value })} className={inputClass} /></label>}
          <label className={`${labelClass} sm:col-span-2`}>Descrição<input value={form.description} onChange={(e) => set({ description: e.target.value })} className={inputClass} placeholder="Opcional" /></label>
          <label className="flex items-center gap-2 text-xs font-semibold text-white/70"><input type="checkbox" checked={form.active} onChange={(e) => set({ active: e.target.checked })} />Ativo (aparece no consumo dos eventos)</label>
        </div>
      )}
      {mode.kind === 'entry' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>Quantidade *<input required type="number" inputMode="numeric" min="1" step="1" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Data *<input required type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Observação<input value={form.note} onChange={(e) => set({ note: e.target.value })} className={inputClass} placeholder="Ex.: compra na loja X" /></label>
        </div>
      )}
      {mode.kind === 'adjust' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>Saldo contado * <span className="font-normal text-white/40">(atual: {mode.material.balance})</span><input required type="number" inputMode="numeric" min="0" step="1" value={form.newBalance} onChange={(e) => set({ newBalance: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Data *<input required type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} className={inputClass} /></label>
          <label className={labelClass}>Motivo *<input required value={form.note} onChange={(e) => set({ note: e.target.value })} className={inputClass} placeholder="Ex.: contagem do inventário" /></label>
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Salvando…' : 'Salvar'}</button>
        <button type="button" disabled={saving} className={ghostBtn} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
};
