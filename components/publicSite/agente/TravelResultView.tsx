import React from 'react';
import { Copy, MessageCircle, Pencil, TriangleAlert, Undo2, X } from 'lucide-react';
import type { TravelResult } from '../../../services/travelService';
import { formatBRL, formatKm, legKey, parseKm, whatsAppLink, type TravelSummary, type TravelSummaryDay, type TravelSummaryLeg } from '../../../services/travelCost.js';
import { btn, card, dayLabel, heading } from './travelShared';

export interface KmEditor {
  editing: { key: string; value: string } | null;
  setEditing: (editing: { key: string; value: string } | null) => void;
  saveKm: () => void;
  restoreKm: (key: string) => void;
}

interface LegRowProps { leg: TravelSummaryLeg; day: number; index: number; many: boolean; mapKm: number; editor: KmEditor }

const LegRow: React.FC<LegRowProps> = ({ leg, day: d, index: i, many, mapKm, editor }) => {
  const { editing, setEditing, saveKm, restoreKm } = editor;
  const key = legKey(d, i);
  return (
    <li className="py-2.5 text-[15px]">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">{leg.from} → {leg.to}</span>
        {editing?.key === key ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <input
              autoFocus value={editing.value} inputMode="decimal" aria-label={`Km do trecho ${leg.from} para ${leg.to}`}
              onChange={(e) => setEditing({ key, value: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') saveKm(); if (e.key === 'Escape') setEditing(null); }}
              className="h-11 w-20 rounded-xl border border-blue-400 bg-[#070B14] px-3 text-right text-base font-bold text-white focus:outline-none"
            />
            <button onClick={saveKm} disabled={parseKm(editing.value) === null} className={`${btn} h-11 rounded-xl bg-blue-600 px-3 text-sm font-bold disabled:opacity-40`}>OK</button>
            <button onClick={() => setEditing(null)} aria-label="Cancelar ajuste" className={`${btn} flex h-11 w-9 items-center justify-center rounded-xl text-white/50`}><X className="h-4 w-4" /></button>
          </span>
        ) : (
          <button onClick={() => setEditing({ key, value: String(leg.km).replace('.', ',') })} aria-label={`Ajustar km de ${leg.from} para ${leg.to}${many ? ` no dia ${d + 1}` : ''}`} className={`${btn} flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-bold tabular-nums ${leg.adjusted ? 'bg-amber-400/15 text-amber-200' : 'text-white'}`}>
            {formatKm(leg.km)}<Pencil className="h-3.5 w-3.5 text-white/40" />
          </button>
        )}
      </div>
      {leg.adjusted && editing?.key !== key && (
        <p className="mt-1 flex items-center justify-end gap-2 text-xs text-amber-200">
          Ajustado (mapa: {formatKm(mapKm)})
          <button onClick={() => restoreKm(key)} className={`${btn} inline-flex items-center gap-1 rounded-lg border border-white/15 px-2 py-1 font-semibold text-white/70`}><Undo2 className="h-3 w-3" />Restaurar</button>
        </p>
      )}
    </li>
  );
};

interface TripDayCardProps { day: TravelSummaryDay; index: number; many: boolean; isLast: boolean; result: TravelResult; editor: KmEditor }

const TripDayCard: React.FC<TripDayCardProps> = ({ day, index: d, many, isLast, result, editor }) => (
  <div className={card}>
    <span className={heading}>{many ? `Dia ${dayLabel(day.date, d)} · trechos usados` : 'Trechos usados'}</span>
    <ul className="divide-y divide-white/10">
      {day.legs.map((leg, i) => <LegRow key={legKey(d, i)} leg={leg} day={d} index={i} many={many} mapKm={result.days[d].legs[i].km} editor={editor} />)}
    </ul>
    <p className="mt-2 border-t border-white/10 pt-3 text-right text-lg font-black tabular-nums">{many ? 'Subtotal' : 'Total'}: {formatKm(day.totalKm)}</p>
    {isLast && <p className="mt-1 text-xs text-white/40">Se o trajeto real foi outro, toque no km do trecho para corrigir. O texto do WhatsApp avisa que foi ajustado.</p>}
  </div>
);

const ResolvedAddresses: React.FC<{ result: TravelResult; many: boolean }> = ({ result, many }) => (
  <div className={card}>
    <span className={heading}>Endereços entendidos pelo mapa</span>
    <div className="space-y-4">
      {result.days.map((day, d) => day.resolved.length > 0 && (
        <div key={d}>
          {many && <p className="mb-1 text-xs font-bold uppercase tracking-widest text-blue-300">Dia {dayLabel(day.date, d)}</p>}
          <ul className="space-y-3">
            {day.resolved.map((point) => (
              <li key={point.label} className="text-[15px]">
                <p className="font-bold">{point.label}{!point.precise && <span className="ml-2 text-amber-300">⚠ confira</span>}</p>
                <p className="text-white/70">{point.address}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
    <p className="mt-3 text-xs text-white/40">Se algum estiver diferente do evento, corrija o endereço (inclua bairro e cidade) e calcule de novo.</p>
  </div>
);

const ConfirmNotice: React.FC<{ onAck: () => void }> = ({ onAck }) => (
  <div role="alert" className="space-y-3 rounded-2xl border-2 border-amber-400 bg-amber-500/15 px-4 py-4">
    <p className="flex items-start gap-3 text-[15px] font-bold text-amber-100"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />O mapa não achou o número exato de algum endereço. A distância pode estar aproximada.</p>
    <button onClick={onAck} className={`${btn} h-12 w-full rounded-xl bg-amber-400 text-sm font-black uppercase text-black`}>Conferi, mostrar valor</button>
  </div>
);

interface TotalsCardProps { summary: TravelSummary; result: TravelResult; text: string; many: boolean; copied: boolean; onCopy: () => void }

const TotalsCard: React.FC<TotalsCardProps> = ({ summary, result, text, many, copied, onCopy }) => (
  <div className={`${card} space-y-1 text-[15px]`}>
    {many && <p className="text-white/60">{summary.days.length} dias · {summary.eventCount} eventos · {formatKm(summary.totalKm)} no total</p>}
    <p>Deslocamento: {formatKm(summary.totalKm)} × {formatBRL(summary.kmRate)} = <b>{formatBRL(summary.travelCost)}</b></p>
    <p>Cachês: {summary.eventCount} × {formatBRL(summary.eventFee)} = <b>{formatBRL(summary.feesTotal)}</b></p>
    <p className="pt-2 text-xl font-black text-emerald-300">TOTAL A RECEBER: {formatBRL(summary.total)}</p>
    <div className="flex gap-2 pt-3">
      <button onClick={onCopy} className={`${btn} flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-bold`}><Copy className="h-5 w-5" />{copied ? 'Copiado!' : 'Copiar texto'}</button>
      {result.whatsappBase && <a href={whatsAppLink(result.whatsappBase, text)} target="_blank" rel="noopener noreferrer" className={`${btn} flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-sm font-black text-[#04210F]`}><MessageCircle className="h-5 w-5" />WhatsApp</a>}
    </div>
    <pre className="mt-3 whitespace-pre-wrap rounded-xl bg-[#070B14] p-3 font-sans text-sm text-white/70">{text}</pre>
  </div>
);

interface TravelResultViewProps {
  result: TravelResult;
  summary: TravelSummary;
  text: string;
  many: boolean;
  editor: KmEditor;
  acked: boolean;
  onAck: () => void;
  copied: boolean;
  onCopy: () => void;
}

/** Trechos (com ajuste de km), endereços entendidos, totais e texto do WhatsApp. */
export const TravelResultView: React.FC<TravelResultViewProps> = ({ result, summary, text, many, editor, acked, onAck, copied, onCopy }) => (
  <>
    {summary.days.map((day, d) => <TripDayCard key={d} day={day} index={d} many={many} isLast={d === summary.days.length - 1} result={result} editor={editor} />)}

    {result.days.some((day) => day.resolved.length > 0) && <ResolvedAddresses result={result} many={many} />}

    {result.needsConfirmation && !acked ? <ConfirmNotice onAck={onAck} /> : <TotalsCard summary={summary} result={result} text={text} many={many} copied={copied} onCopy={onCopy} />}
    <p className="px-1 text-center text-xs text-white/40">Calculado em {new Date(result.calculatedAt).toLocaleString('pt-BR')}. O mapa pode sugerir um trajeto diferente do seu aplicativo; confira os trechos.</p>
  </>
);
