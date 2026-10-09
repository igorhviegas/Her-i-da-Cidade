import React from 'react';
import { defaultEntry, roundMoney, type EventFormInput } from '../../services/eventForm.js';
import type { Order } from '../../types';

/** Estado do formulário manual de evento (strings dos inputs). `entryTouched`: a entrada foi editada à mão e não segue mais os 50%. */
export interface EventFormState extends EventFormInput { entryTouched: boolean }

export const emptyEventForm = (): EventFormState => ({
  childName: '', eventDate: '', eventTime: '', location: '', imageAuthorization: '', extraWeb: '0',
  totalValue: '', entryValue: '', cost: '', observations: '', formType: '', birthDate: '', pcd: '', entryTouched: false,
});

function dateInput(value: any): string {
  const date: Date | null = value instanceof Date ? value : typeof value?.toDate === 'function' ? value.toDate() : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Preenche o formulário a partir de um pedido de evento existente (edição ou duplicação). A entrada salva é preservada. */
export function eventFormFromOrder(order: Pick<Order, 'eventForm' | 'childName' | 'eventDate'>): EventFormState {
  const f = order.eventForm;
  if (!f) return emptyEventForm();
  return {
    childName: order.childName ?? '', eventDate: dateInput(order.eventDate), eventTime: f.eventTime, location: f.location,
    imageAuthorization: f.imageAuthorization ? 'yes' : 'no', extraWeb: String(f.extraWeb), totalValue: String(f.totalValue),
    entryValue: String(f.entryValue), cost: f.cost === null || f.cost === undefined ? '' : String(f.cost), observations: f.observations, formType: f.formType,
    birthDate: f.birthDate ?? '', pcd: f.pcd === true ? 'yes' : f.pcd === false ? 'no' : '',
    entryTouched: roundMoney(f.entryValue) !== defaultEntry(f.totalValue),
  };
}

const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
const labelClass = 'block text-xs font-semibold text-white/70';

/**
 * Campos do evento (o cliente e o WhatsApp ficam na seção "Cliente" do modal). Valor de entrada: acompanha 50% do total
 * enquanto não for editado; depois de editado à mão, mantém o valor até o usuário clicar em "Recalcular 50%".
 */
export const EventOrderFields: React.FC<{ value: EventFormState; onChange: (next: EventFormState) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const set = (patch: Partial<EventFormState>) => onChange({ ...value, ...patch });
  const half = (totalValue: string) => (totalValue.trim() && Number.isFinite(Number(totalValue)) && Number(totalValue) >= 0 ? String(defaultEntry(Number(totalValue))) : '');
  const setTotal = (totalValue: string) => set(value.entryTouched ? { totalValue } : { totalValue, entryValue: half(totalValue) });
  const recalc = () => set({ entryTouched: false, entryValue: half(value.totalValue) });

  return (
    <>
      <section className="space-y-3 border-t border-white/10 pt-4">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Evento</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Nome da criança *<input required value={value.childName} onChange={(e) => set({ childName: e.target.value })} disabled={disabled} className={inputClass} placeholder="Aniversariante" /></label>
          <label className={labelClass}>#formulário *<input required value={value.formType} onChange={(e) => set({ formType: e.target.value })} disabled={disabled} className={inputClass} placeholder="Ex.: Aniversário" /></label>
          <label className={labelClass}>Data do evento *<input required type="date" value={value.eventDate} onChange={(e) => set({ eventDate: e.target.value })} disabled={disabled} className={inputClass} /></label>
          <label className={labelClass}>Horário de início *<input required type="time" value={value.eventTime} onChange={(e) => set({ eventTime: e.target.value })} disabled={disabled} className={inputClass} /></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={labelClass}>Data de nascimento<input type="date" value={value.birthDate ?? ''} onChange={(e) => set({ birthDate: e.target.value })} disabled={disabled} className={inputClass} /></label>
          <label className={labelClass}>Necessidade especial (PCD/PNE)
            <select value={value.pcd ?? ''} onChange={(e) => set({ pcd: e.target.value as '' | 'yes' | 'no' })} disabled={disabled} className={inputClass}>
              <option value="">Não informado</option><option value="no">Não</option><option value="yes">Sim</option>
            </select>
          </label>
        </div>
        <label className={labelClass}>Local *<input required value={value.location} onChange={(e) => set({ location: e.target.value })} disabled={disabled} className={inputClass} placeholder="Endereço ou local do evento" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className={labelClass} disabled={disabled}>
            <legend>Autorização de uso de imagem *</legend>
            <div className="mt-1.5 flex gap-4 rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white">
              <label className="flex items-center gap-2"><input type="radio" name="image-auth" required checked={value.imageAuthorization === 'yes'} onChange={() => set({ imageAuthorization: 'yes' })} />Sim</label>
              <label className="flex items-center gap-2"><input type="radio" name="image-auth" checked={value.imageAuthorization === 'no'} onChange={() => set({ imageAuthorization: 'no' })} />Não</label>
            </div>
          </fieldset>
          <label className={labelClass}>Teia extra
            <select value={value.extraWeb} onChange={(e) => set({ extraWeb: e.target.value })} disabled={disabled} className={inputClass}>
              <option value="0">Não</option><option value="1">1</option><option value="2">2</option>
            </select>
          </label>
        </div>
        <label className={labelClass}>Observações<textarea rows={3} value={value.observations} onChange={(e) => set({ observations: e.target.value })} disabled={disabled} className={`${inputClass} resize-y`} placeholder="Informações adicionais" /></label>
      </section>

      <section className="space-y-3 border-t border-white/10 pt-4">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Valores</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={labelClass}>Valor total *<input required type="number" min="0" step="0.01" value={value.totalValue} onChange={(e) => setTotal(e.target.value)} disabled={disabled} className={inputClass} placeholder="0,00" /></label>
          <label className={labelClass}>Valor de entrada *<input required type="number" min="0" step="0.01" value={value.entryValue} onChange={(e) => set({ entryValue: e.target.value, entryTouched: true })} disabled={disabled} className={inputClass} placeholder="50% do total" /></label>
          <label className={labelClass}>Custo<input type="number" min="0" step="0.01" value={value.cost} onChange={(e) => set({ cost: e.target.value })} disabled={disabled} className={inputClass} placeholder="Informar até concluir" /></label>
        </div>
        <p className="text-[11px] text-white/45">
          O custo pode ficar em branco, mas é obrigatório para concluir o pedido. A entrada acompanha 50% do total até ser editada.{' '}
          {value.entryTouched && <button type="button" onClick={recalc} disabled={disabled} className="font-semibold text-blue-300 underline hover:text-blue-200">Recalcular 50%</button>}
        </p>
      </section>
    </>
  );
};
