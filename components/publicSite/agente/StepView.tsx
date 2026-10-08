import React from 'react';
import { ChevronLeft, ChevronRight, TriangleAlert } from 'lucide-react';
import type { AgentStep } from '../../../services/agentService';
import { btn, type Saved } from './agenteShared';

export const StepView: React.FC<{
  step: AgentStep; saved: Saved; update: (fn: (s: Saved) => Saved) => void; eventRunning: boolean; onStart: () => void;
  prev?: AgentStep; next?: AgentStep; go: (id: string) => void;
}> = ({ step, saved, update, eventRunning, onStart, prev, next, go }) => (
  <>
    <div>
      <h2 className="text-2xl font-extrabold leading-tight">{step.title}</h2>
      {step.description && <p className="mt-1 text-[15px] text-white/60">{step.description}</p>}
    </div>
    {step.alert && (
      <div role="alert" className="flex items-start gap-3 rounded-2xl border-2 border-red-400 bg-red-600/25 px-4 py-4">
        <TriangleAlert className="mt-0.5 h-7 w-7 shrink-0 text-red-300" />
        <p className="text-lg font-extrabold leading-snug text-red-100">{step.alert}</p>
      </div>
    )}
    {step.highlight && <div className="rounded-xl bg-amber-400/15 px-4 py-2 text-center text-xs font-black uppercase tracking-widest text-amber-300">Momento importante</div>}
    <ul className="space-y-2">
      {step.items.map((item) => {
        if (item.heading) return <li key={item.id} className="pt-3 text-xs font-bold uppercase tracking-widest text-blue-300">{item.text}</li>;
        const key = `${step.id}:${item.id}`;
        const checked = !!saved.checks[key];
        return (
          <li key={item.id}>
            <button
              onClick={() => update((s) => ({ ...s, checks: { ...s.checks, [key]: !checked } }))}
              role="checkbox" aria-checked={checked}
              className={`${btn} flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left ${checked ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-[#0D1527]'}`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-lg font-black ${checked ? 'border-emerald-400 bg-emerald-400 text-[#04210F]' : 'border-white/30'}`}>{checked ? '✓' : ''}</span>
              <span className={`text-[17px] font-semibold leading-snug ${checked ? 'text-white/45 line-through' : ''}`}>{item.text}</span>
            </button>
            {item.note && (
              <textarea
                value={saved.notes[key] ?? ''}
                onChange={(e) => update((s) => ({ ...s, notes: { ...s.notes, [key]: e.target.value } }))}
                placeholder="Anotação (opcional)"
                rows={2}
                className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-base text-white placeholder:text-white/30 focus:border-blue-400 focus:outline-none"
              />
            )}
          </li>
        );
      })}
    </ul>
    {step.startButton && !eventRunning && (
      <button onClick={onStart} className={`${btn} w-full rounded-2xl bg-emerald-500 px-6 py-6 text-xl font-black uppercase tracking-wide text-[#04210F]`}>Iniciar evento</button>
    )}
    <div className="flex gap-3 pt-2">
      <button disabled={!prev} onClick={() => prev && go(prev.id)} className={`${btn} flex h-14 flex-1 items-center justify-center gap-1 rounded-2xl bg-white/10 text-sm font-bold disabled:opacity-30`}><ChevronLeft className="h-5 w-5" />Anterior</button>
      <button disabled={!next} onClick={() => next && go(next.id)} className={`${btn} flex h-14 flex-1 items-center justify-center gap-1 rounded-2xl bg-blue-600 text-sm font-bold disabled:opacity-30`}>Próxima<ChevronRight className="h-5 w-5" /></button>
    </div>
  </>
);
