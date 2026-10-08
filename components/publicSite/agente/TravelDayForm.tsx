import React, { useState } from 'react';
import { ArrowDown, ArrowUp, CalendarDays, KeyRound, Loader2, Plus, Trash2, X } from 'lucide-react';
import { fetchDayEvents } from '../../../services/travelService';
import { MAX_EVENTS, formatDateKey } from '../../../services/travelCost.js';
import { moveItem } from '../../../services/agentContent.js';
import { btn, card, field, heading, smallBtn, type DayDraft } from './travelShared';

const AddressChoice: React.FC<{ label: string; value: string | null; onChange: (value: string | null) => void }> = ({ label, value, onChange }) => (
  <div>
    <span className={heading}>{label}</span>
    {value === null ? (
      <div className="flex items-center gap-2">
        <p className={`${card} flex-1 py-3.5 text-[15px] text-white/70`}>Endereço padrão</p>
        <button onClick={() => onChange('')} className={smallBtn}>Usar outro</button>
      </div>
    ) : (
      <div className="space-y-2">
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="Rua, número, bairro e cidade" aria-label={label} className={field} />
        <button onClick={() => onChange(null)} className={smallBtn}>Voltar ao padrão</button>
      </div>
    )}
  </div>
);

const STOP_CHOICES: [DayDraft['stopMode'], string][] = [['default', 'Padrão'], ['none', 'Sem parada'], ['custom', 'Outra']];

/** Formulário de um dia: data, partida, parada, eventos (digitados ou importados) e destino final. */
export const DayForm: React.FC<{
  index: number; day: DayDraft; many: boolean; code: string;
  onChange: (changes: Partial<DayDraft>) => void; onRemove: () => void; onError: (error: unknown) => void;
}> = ({ index, day, many, code, onChange, onRemove, onError }) => {
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState('');
  const edit = (changes: Partial<DayDraft>) => { setNotice(''); onChange(changes); };
  const setEvent = (i: number, value: string) => edit({ events: day.events.map((e, n) => (n === i ? value : e)) });

  /** Preenche os eventos com os cadastrados na data deste dia (ordem de horário). Só traz horário, local e tipo. */
  const importEvents = async () => {
    setImporting(true); setNotice('');
    try {
      const found = await fetchDayEvents(code, day.date);
      const label = formatDateKey(day.date);
      if (found.length === 0) { setNotice(`Nenhum evento cadastrado em ${label}.`); return; }
      if (day.events.some((e) => e.trim()) && !window.confirm(`Substituir os eventos digitados pelos ${found.length} cadastrados em ${label}?`)) return;
      const used = found.slice(0, MAX_EVENTS);
      onChange({ events: used.map((event) => event.location) });
      setNotice(`${used.length === 1 ? '1 evento importado' : `${used.length} eventos importados`} de ${label}, em ordem de horário: ${used.map((event) => `${event.time}${event.formType ? ` ${event.formType}` : ''}`).join(' · ')}.${found.length > used.length ? ` Havia ${found.length}; o limite é ${MAX_EVENTS} por dia.` : ''} Confira a ordem e os endereços.`);
    } catch (e) { onError(e); } finally { setImporting(false); }
  };

  return (
    <div className={`${card} space-y-4`}>
      {many && (
        <div className="flex items-center justify-between">
          <p className="text-lg font-black">Dia {index + 1}</p>
          <button onClick={onRemove} aria-label={`Remover dia ${index + 1}`} className={`${btn} flex h-10 items-center gap-1.5 rounded-xl border border-red-400/30 px-3 text-xs font-bold text-red-300`}><Trash2 className="h-4 w-4" />Remover dia</button>
        </div>
      )}

      <div>
        <label className="block"><span className={heading}>Data dos eventos{many ? ` (dia ${index + 1})` : ''}</span><input type="date" value={day.date} onChange={(e) => edit({ date: e.target.value })} className={field} /></label>
        <button disabled={!day.date || importing} onClick={importEvents} className={`${btn} mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-blue-400/40 bg-blue-600/15 text-sm font-bold text-blue-100 disabled:opacity-40`}>
          {importing ? <><Loader2 className="h-4 w-4 animate-spin" />Buscando...</> : <><CalendarDays className="h-4 w-4" />Importar eventos do dia</>}
        </button>
        {notice && <p role="status" className="mt-2 rounded-xl bg-white/5 px-3 py-2.5 text-[13px] leading-snug text-white/70">{notice}</p>}
      </div>

      <AddressChoice label="Ponto de partida" value={day.start} onChange={(start) => edit({ start })} />

      <div>
        <span className={heading}>Parada (ida e volta)</span>
        <div className="flex gap-2" role="group" aria-label="Parada">
          {STOP_CHOICES.map(([mode, label]) => (
            <button key={mode} onClick={() => edit({ stopMode: mode })} aria-pressed={day.stopMode === mode} className={`${btn} h-12 flex-1 rounded-xl border text-sm font-bold ${day.stopMode === mode ? 'border-blue-400 bg-blue-600/25 text-white' : 'border-white/10 text-white/60'}`}>{label}</button>
          ))}
        </div>
        {day.stopMode === 'custom' && <input value={day.stopAddress} onChange={(e) => edit({ stopAddress: e.target.value })} placeholder="Rua, número, bairro e cidade" aria-label="Endereço da parada" className={`${field} mt-2`} />}
      </div>

      <div>
        <span className={heading}>Eventos (na ordem do trajeto)</span>
        <ol className="space-y-2">
          {day.events.map((address, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <input value={address} onChange={(e) => setEvent(i, e.target.value)} placeholder={`Evento ${i + 1}: rua, número, bairro e cidade`} aria-label={`Endereço do evento ${i + 1}${many ? ` do dia ${index + 1}` : ''}`} className={`${field} min-w-0 flex-1`} />
              <div className="flex shrink-0 flex-col">
                <button disabled={i === 0} onClick={() => edit({ events: moveItem(day.events, i, -1) })} aria-label={`Subir evento ${i + 1}`} className={`${btn} flex h-7 w-9 items-center justify-center rounded-t-lg bg-white/10 disabled:opacity-25`}><ArrowUp className="h-4 w-4" /></button>
                <button disabled={i === day.events.length - 1} onClick={() => edit({ events: moveItem(day.events, i, 1) })} aria-label={`Descer evento ${i + 1}`} className={`${btn} flex h-7 w-9 items-center justify-center rounded-b-lg bg-white/10 disabled:opacity-25`}><ArrowDown className="h-4 w-4" /></button>
              </div>
              <button disabled={day.events.length === 1} onClick={() => edit({ events: day.events.filter((_, n) => n !== i) })} aria-label={`Remover evento ${i + 1}`} className={`${btn} flex h-12 w-10 shrink-0 items-center justify-center rounded-xl text-white/50 disabled:opacity-25`}><X className="h-5 w-5" /></button>
            </li>
          ))}
        </ol>
        <button disabled={day.events.length >= MAX_EVENTS} onClick={() => edit({ events: [...day.events, ''] })} className={`${btn} mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 text-sm font-bold text-white/70 disabled:opacity-30`}><Plus className="h-4 w-4" />Adicionar evento</button>
      </div>

      <AddressChoice label="Destino final" value={day.end} onChange={(end) => edit({ end })} />
    </div>
  );
};

interface CodeGateProps { error: string; onSave: (code: string) => void }

/** Tela do código de acesso (fica salvo no aparelho). */
export const CodeGate: React.FC<CodeGateProps> = ({ error, onSave }) => {
  const [codeInput, setCodeInput] = useState('');
  return (
    <div className={`${card} space-y-3`}>
      <p className="flex items-center gap-2 text-lg font-bold"><KeyRound className="h-5 w-5 text-blue-300" />Código de acesso</p>
      <p className="text-sm text-white/60">Digite o código do cálculo de deslocamento. Ele fica salvo neste aparelho.</p>
      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      <input type="password" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} placeholder="Código" aria-label="Código de acesso" autoComplete="off" className={field} />
      <button disabled={!codeInput.trim()} onClick={() => { onSave(codeInput.trim()); setCodeInput(''); }} className={`${btn} h-14 w-full rounded-2xl bg-blue-600 text-base font-bold disabled:opacity-40`}>Salvar código</button>
    </div>
  );
};
