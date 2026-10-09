import React from 'react';
import { ChevronDown, Minus, Plus, RotateCcw, Search, SkipBack, SkipForward, Pause, Play, TriangleAlert, X } from 'lucide-react';
import type { AgentFaqCategory, AgentFaqItem } from '../../../services/agentService';
import { TIMER_ALERTS, computeTimer, formatClock, type AlertKey } from '../../../services/agentContent.js';
import { btn, type Player } from './agenteShared';

export const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-4 text-[15px] leading-relaxed text-white/80">
    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-white/40">{title}</p>{children}
  </div>
);

export const TimerBar: React.FC<{ timer: ReturnType<typeof computeTimer>; open: boolean; onToggle: () => void; onAdjust: (min: number) => void }> = ({ timer, open, onToggle, onAdjust }) => {
  const { remainingMs, elapsedMs, finished } = timer;
  const tone = finished ? 'bg-red-600 animate-pulse' : remainingMs <= 5 * 60_000 ? 'bg-red-700' : remainingMs <= 30 * 60_000 ? 'bg-amber-600' : 'bg-blue-800';
  const adj = (m: number, label?: string) => (
    <button key={m} onClick={() => onAdjust(m)} className={`${btn} flex h-11 min-w-0 flex-1 items-center justify-center gap-0.5 rounded-xl bg-black/25 text-sm font-bold`}>
      {m < 0 ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}{label ?? Math.abs(m)}
    </button>
  );
  return (
    <div className={`${tone} px-3 py-2 text-white`}>
      <div className="flex items-center gap-2">
        <button onClick={onToggle} aria-expanded={open} className={`${btn} min-w-0 flex-1 text-left`}>
          <span className="block text-[10px] font-bold uppercase tracking-widest text-white/70">{finished ? 'Evento encerrado' : 'Restante'}</span>
          <span className="block text-3xl font-black leading-none tabular-nums">{finished ? `+${formatClock(remainingMs)}` : formatClock(remainingMs)}</span>
          <span className="mt-0.5 block text-[11px] text-white/70">Decorrido {formatClock(elapsedMs)} <ChevronDown className={`inline h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} /></span>
        </button>
      </div>
      {open && (
        <div className="mt-2">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-white/70">Ajustar tempo (minutos)</p>
          <div className="flex gap-1.5">{adj(-10)}{adj(-5)}{adj(-1)}{adj(1)}{adj(5)}{adj(10)}</div>
        </div>
      )}
    </div>
  );
};

export const FaqItemCard: React.FC<{ item: AgentFaqItem; label?: string }> = ({ item, label }) => (
  <details className="group rounded-2xl border border-white/10 bg-[#0D1527]">
    <summary className="flex min-h-[3.5rem] cursor-pointer list-none items-center gap-3 px-4 py-3 text-[17px] font-bold leading-snug [&::-webkit-details-marker]:hidden">
      <span className="flex-1">{label && <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-widest text-blue-300">{label}</span>}{item.question}</span>
      <ChevronDown className="h-5 w-5 shrink-0 text-white/40 transition-transform group-open:rotate-180" />
    </summary>
    <p className="whitespace-pre-line border-t border-white/10 px-4 py-4 text-[16px] leading-relaxed text-white/80">{item.answer}</p>
  </details>
);

export const FaqView: React.FC<{ category: AgentFaqCategory }> = ({ category }) => (
  category.items.length === 0 ? (
    <p className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-6 text-center text-white/60">Nenhuma pergunta cadastrada ainda.</p>
  ) : (
    <div className="space-y-2">{category.items.map((item) => <FaqItemCard key={item.id} item={item} />)}</div>
  )
);

export const FaqResults: React.FC<{ results: { category: AgentFaqCategory; item: AgentFaqItem }[] }> = ({ results }) => (
  results.length === 0 ? (
    <p className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-6 text-center text-white/60">Nada encontrado. Tente outra palavra ou fale com o Vitor pelo botão verde.</p>
  ) : (
    <div className="space-y-2">{results.map(({ category, item }) => <FaqItemCard key={item.id} item={item} label={category.title} />)}</div>
  )
);

export const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
    <input
      type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
      className="h-14 w-full rounded-2xl border border-white/10 bg-[#0D1527] pl-12 pr-12 text-base text-white placeholder:text-white/35 focus:border-blue-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
    />
    {value && <button onClick={() => onChange('')} aria-label="Limpar busca" className={`${btn} absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/60`}><X className="h-5 w-5" /></button>}
  </div>
);

export const RestartButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} aria-label="Voltar ao início (sem tocar)" title="Voltar ao início (sem tocar)" className={`${btn} flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-pink-400/50 bg-pink-500/15 text-pink-200`}><RotateCcw className="h-5 w-5" /></button>
);

export const PlayerButtons: React.FC<{ player: Player; size: 'sm' | 'lg' }> = ({ player, size }) => {
  const side = size === 'lg' ? 'h-16 w-16' : 'h-12 w-12';
  const main = size === 'lg' ? 'h-24 w-24' : 'h-14 w-14';
  const icon = size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button onClick={player.prev} aria-label="Música anterior" className={`${btn} ${side} flex items-center justify-center rounded-full bg-white/10`}><SkipBack className={icon} /></button>
      <button onClick={player.toggle} aria-label={player.playing ? 'Pausar' : 'Tocar'} className={`${btn} ${main} flex items-center justify-center rounded-full bg-pink-500 text-white shadow-lg shadow-pink-500/30`}>
        {player.playing ? <Pause className={size === 'lg' ? 'h-10 w-10' : 'h-6 w-6'} fill="currentColor" /> : <Play className={size === 'lg' ? 'h-10 w-10' : 'h-6 w-6'} fill="currentColor" />}
      </button>
      <button onClick={player.next} aria-label="Próxima música" className={`${btn} ${side} flex items-center justify-center rounded-full bg-white/10`}><SkipForward className={icon} /></button>
    </div>
  );
};

export const AlertOverlay: React.FC<{ alertKey: AlertKey; onClose: () => void }> = ({ alertKey, onClose }) => {
  const alert = TIMER_ALERTS[alertKey];
  const red = alert.tone === 'red';
  return (
    <div role="alertdialog" aria-modal className={`fixed inset-0 z-[100] flex flex-col justify-center overflow-y-auto px-5 py-8 ${red ? 'bg-red-700' : 'bg-amber-600'}`}>
      <TriangleAlert className="mx-auto h-16 w-16 text-white" />
      <h2 className="mt-3 text-center text-3xl font-black leading-tight text-white">{alert.title}</h2>
      <ul className="mx-auto mt-6 w-full max-w-md space-y-3">
        {alert.items.map((text) => <li key={text} className="rounded-2xl bg-black/25 px-4 py-3.5 text-lg font-bold leading-snug text-white">{text}</li>)}
      </ul>
      <button onClick={onClose} className={`${btn} mx-auto mt-8 w-full max-w-md rounded-2xl bg-white px-6 py-5 text-xl font-black uppercase text-black`}>Entendi</button>
    </div>
  );
};
