import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Info, MessageCircle, Minus, Music, Pause, Play, Plus, Repeat1, RotateCcw, Route, Search, SkipBack, SkipForward, Timer, TriangleAlert, ChevronDown, X,
} from 'lucide-react';
import { useAgentContent, type AgentFaqCategory, type AgentFaqItem, type AgentStep } from '../../services/agentService';
import {
  SUPPORT_WHATSAPP_URL, TIMER_ALERTS, computeTimer, dueAlert, formatClock, groupTracks, markFired, matchesQuery, resetFired, searchFaq, type AlertKey, type FiredAlerts,
} from '../../services/agentContent.js';
import { useAgentPlayer } from './useAgentPlayer';
import { TravelCalculator } from './TravelCalculator';

// Rota pública sem login. Para proteger depois, envolva <AgentApp /> em App.tsx (como o AdminApp com ProtectedAdminRoute)
// e restrinja a leitura de agentSteps/agentTracks em firestore.rules.

interface EventState { startedAt: number; adjustMs: number; fired: FiredAlerts }
interface Saved { checks: Record<string, boolean>; notes: Record<string, string>; event: EventState | null }
const STORAGE_KEY = 'hdc.agente.v1';
const EMPTY: Saved = { checks: {}, notes: {}, event: null };

function load(): Saved {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }; } catch { return EMPTY; }
}

/** Estado do evento (checklist, anotações, timer) persistido no aparelho: o Safari pode recarregar a página com o app em segundo plano. */
function useSaved() {
  const [saved, setSaved] = useState<Saved>(load);
  const update = useCallback((fn: (s: Saved) => Saved) => setSaved((prev) => {
    const next = fn(prev);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* sem armazenamento: vale só nesta sessão */ }
    return next;
  }), []);
  return [saved, update] as const;
}

const btn = 'touch-manipulation select-none active:scale-[0.98] transition-transform';
const bigBtn = `${btn} flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-5 text-left`;

export const AgentApp: React.FC = () => {
  const { steps, tracks, tracksLoading, faq } = useAgentContent();
  const player = useAgentPlayer(tracks);
  const [saved, update] = useSaved();
  const [view, rawSetView] = useState('home'); // home | steps | music | travel | support | support:info | support:<categoria> | step:<id>
  // Histórico de telas: a seta de voltar retorna à tela de onde o agente veio (ex.: Início → Chegada → Início).
  const [trail, setTrail] = useState<string[]>([]);
  const setView = (next: string) => { setTrail((t) => [...t, view]); rawSetView(next); };
  const goBack = () => { rawSetView(trail[trail.length - 1] ?? 'home'); setTrail((t) => t.slice(0, -1)); };
  const [now, setNow] = useState(() => Date.now());
  const [alertKey, setAlertKey] = useState<AlertKey | null>(null);
  const [timerOpen, setTimerOpen] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => setQuery(''), [view]); // cada tela começa sem filtro

  const event = saved.event;
  const timer = event ? computeTimer(event, now) : null;

  // Relógio: recalcula a partir do horário real (não acumula), então não atrasa com a tela bloqueada.
  useEffect(() => {
    if (!event) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    tick();
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [!!event]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gatilhos de 30 e 5 minutos: disparam uma vez (o estado persiste) e abrem o alerta em tela cheia.
  useEffect(() => {
    if (!event || !timer) return;
    const due = dueAlert(timer.remainingMs, event.fired);
    if (!due) return;
    update((s) => s.event ? { ...s, event: { ...s.event, fired: markFired(s.event.fired, due) } } : s);
    setAlertKey(due);
    try { navigator.vibrate?.([400, 150, 400, 150, 400]); } catch { /* sem vibração (iOS) */ }
  }, [timer?.remainingMs, event?.fired.m30, event?.fired.m5]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mantém a tela acesa durante o evento (Safari 16.4+); sem suporte, segue sem.
  useEffect(() => {
    if (!event || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const request = () => { if (document.visibilityState === 'visible') navigator.wakeLock.request('screen').then((l) => { lock = l; }).catch(() => {}); };
    request();
    document.addEventListener('visibilitychange', request);
    return () => { document.removeEventListener('visibilitychange', request); lock?.release().catch(() => {}); };
  }, [!!event]); // eslint-disable-line react-hooks/exhaustive-deps

  const startEvent = () => {
    if (!window.confirm('Iniciar o evento agora? O timer de 1 hora começa neste momento.')) return;
    setNow(Date.now());
    update((s) => ({ ...s, event: { startedAt: Date.now(), adjustMs: 0, fired: {} } }));
  };
  const adjust = (minutes: number) => update((s) => {
    if (!s.event) return s;
    const adjustMs = s.event.adjustMs + minutes * 60_000;
    const remaining = computeTimer({ ...s.event, adjustMs }, Date.now()).remainingMs;
    return { ...s, event: { ...s.event, adjustMs, fired: resetFired(remaining, s.event.fired) } };
  });
  const resetAll = () => {
    if (window.confirm('Limpar checklist, anotações e timer para um novo evento?')) { update(() => EMPTY); setTrail([]); rawSetView('home'); }
  };

  const stepDone = (step: AgentStep) => step.items.filter((i) => !i.heading && saved.checks[`${step.id}:${i.id}`]).length;
  const stepTotal = (step: AgentStep) => step.items.filter((i) => !i.heading).length;
  const nextStep = steps.find((s) => stepDone(s) < stepTotal(s));
  const done = steps.reduce((n, s) => n + stepDone(s), 0);
  const total = steps.reduce((n, s) => n + stepTotal(s), 0);
  const activeStep = view.startsWith('step:') ? steps.find((s) => s.id === view.slice(5)) : undefined;
  const stepIndex = activeStep ? steps.indexOf(activeStep) : -1;
  const showMini = !!player.current && view !== 'music';
  const faqCategory = view.startsWith('support:') && view !== 'support:info' ? faq.find((c) => c.id === view.slice(8)) : undefined;

  const title = view === 'home' ? 'Agente HDC' : view === 'steps' ? 'Passo a passo' : view === 'music' ? 'Músicas' : view === 'travel' ? 'Deslocamento' : view === 'support' ? 'Suporte' : view === 'support:info' ? 'Informações importantes' : faqCategory?.title ?? activeStep?.kicker ?? 'Etapa';

  return (
    <div className={`min-h-screen bg-[#070B14] text-white antialiased ${showMini ? 'pb-44' : 'pb-28'}`} style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="sticky top-0 z-40 shadow-lg shadow-black/40">
        {event && timer && <TimerBar timer={timer} open={timerOpen} onToggle={() => setTimerOpen((o) => !o)} onAdjust={adjust} />}
        <header className="flex items-center gap-2 border-b border-white/10 bg-[#0B1120] px-3 py-2">
          {view !== 'home' ? (
            <button onClick={goBack} aria-label="Voltar" className={`${btn} flex h-12 w-12 items-center justify-center rounded-xl bg-white/5`}><ChevronLeft className="h-6 w-6" /></button>
          ) : <span className="flex h-12 w-12 items-center justify-center text-blue-400"><Timer className="h-6 w-6" /></span>}
          <h1 className="truncate text-lg font-extrabold tracking-tight">{title}</h1>
        </header>
      </div>

      <main className="mx-auto max-w-xl space-y-4 px-4 pt-4">
        {view === 'home' && (
          <>
            {event ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-200">
                <p className="font-bold">Evento em andamento</p>
                <p className="mt-0.5 text-emerald-200/70">O timer fica no topo em todas as telas.</p>
                <button onClick={() => { if (window.confirm('Encerrar o evento e parar o timer?')) update((s) => ({ ...s, event: null })); }} className={`${btn} mt-3 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-semibold text-white/80`}>Encerrar evento</button>
              </div>
            ) : (
              <button onClick={startEvent} className={`${btn} w-full rounded-2xl bg-emerald-500 px-6 py-8 text-2xl font-black uppercase tracking-wide text-[#04210F] shadow-lg shadow-emerald-500/30`}>Iniciar evento</button>
            )}
            {nextStep && (
              <button onClick={() => setView(`step:${nextStep.id}`)} className={`${bigBtn} border-blue-500/40 bg-blue-600/15`}>
                <ClipboardList className="h-7 w-7 shrink-0 text-blue-300" />
                <span className="min-w-0 flex-1"><span className="block text-[11px] font-bold uppercase tracking-widest text-blue-300">Continuar</span><span className="block truncate text-lg font-bold">{nextStep.title}</span></span>
                <ChevronRight className="h-5 w-5 text-white/40" />
              </button>
            )}
            <button onClick={() => setView('music')} className={bigBtn}>
              <Music className="h-7 w-7 shrink-0 text-pink-300" />
              <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Músicas</span><span className="block truncate text-sm text-white/50">{player.current ? `${player.playing ? '▶' : '❚❚'} ${player.current.title}` : `${tracks.length} na playlist`}</span></span>
              <ChevronRight className="h-5 w-5 text-white/40" />
            </button>
            <button onClick={() => setView('steps')} className={bigBtn}>
              <ClipboardList className="h-7 w-7 shrink-0 text-blue-300" />
              <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Passo a passo</span><span className="block text-sm text-white/50">{done} de {total} itens concluídos</span></span>
              <ChevronRight className="h-5 w-5 text-white/40" />
            </button>
            <button onClick={() => setView('travel')} className={bigBtn}>
              <Route className="h-7 w-7 shrink-0 text-emerald-300" />
              <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Deslocamento</span><span className="block text-sm text-white/50">Km da rota, cachês e texto do WhatsApp</span></span>
              <ChevronRight className="h-5 w-5 text-white/40" />
            </button>
            <button onClick={() => setView('support')} className={bigBtn}>
              <CircleHelp className="h-7 w-7 shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Suporte</span><span className="block text-sm text-white/50">Dúvidas, informações e ajuda</span></span>
              <ChevronRight className="h-5 w-5 text-white/40" />
            </button>
          </>
        )}

        {view === 'steps' && steps.map((step) => {
          const d = stepDone(step); const t = stepTotal(step);
          return (
            <button key={step.id} onClick={() => setView(`step:${step.id}`)} className={`${bigBtn} ${step.highlight ? 'border-amber-400/50 bg-amber-400/10' : ''}`}>
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ${d === t && t > 0 ? 'bg-emerald-500 text-[#04210F]' : 'bg-white/10 text-white/80'}`}>{d === t && t > 0 ? '✓' : `${d}/${t}`}</span>
              <span className="min-w-0 flex-1">
                {step.kicker && <span className="block text-[11px] font-bold uppercase tracking-widest text-white/40">{step.kicker}</span>}
                <span className="block text-lg font-bold leading-tight">{step.title}</span>
              </span>
              {step.alert && <TriangleAlert className="h-5 w-5 shrink-0 text-red-400" aria-label="Contém alerta" />}
            </button>
          );
        })}

        {activeStep && (
          <StepView
            step={activeStep}
            saved={saved}
            update={update}
            eventRunning={!!event}
            onStart={startEvent}
            prev={steps[stepIndex - 1]}
            next={steps[stepIndex + 1]}
            go={(id) => { rawSetView(`step:${id}`); window.scrollTo(0, 0); }}
          />
        )}

        {view === 'travel' && <TravelCalculator />}

        {view === 'music' && <MusicView player={player} tracks={tracks} loading={tracksLoading} query={query} onQuery={setQuery} />}

        {view === 'support' && (
          <>
            <SearchBox value={query} onChange={setQuery} placeholder="Buscar em todas as perguntas e respostas" />
            {query.trim() ? <FaqResults results={searchFaq(faq, query)} /> : <>
            <button onClick={() => setView('support:info')} className={bigBtn}>
              <Info className="h-7 w-7 shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1"><span className="block text-lg font-bold">Informações importantes</span><span className="block text-sm text-white/50">Duração, alertas e novo evento</span></span>
              <ChevronRight className="h-5 w-5 text-white/40" />
            </button>
            {faq.map((category) => (
              <button key={category.id} onClick={() => setView(`support:${category.id}`)} className={bigBtn}>
                <CircleHelp className="h-7 w-7 shrink-0 text-blue-300" />
                <span className="min-w-0 flex-1"><span className="block text-lg font-bold">{category.title}</span><span className="block text-sm text-white/50">{category.items.length} {category.items.length === 1 ? 'pergunta' : 'perguntas'}</span></span>
                <ChevronRight className="h-5 w-5 text-white/40" />
              </button>
            ))}
            <p className="px-1 pt-2 text-center text-sm text-white/40">Não achou? Toque no botão verde para falar com o Vitor.</p>
            </>}
          </>
        )}

        {view === 'support:info' && (
          <>
            <InfoCard title="Duração e chegada">O evento contratado dura <b>1 hora</b>. O agente chega ~<b>30 minutos antes</b> para preparar tudo.</InfoCard>
            <InfoCard title="Timer do evento">Toque em <b>Iniciar evento</b> quando a apresentação começar. Use <b>−5 / +5</b> no topo para ajustar se os pais pedirem para atrasar.</InfoCard>
            <InfoCard title="Alertas automáticos">Aos <b>30 min</b> restantes: combinar os parabéns com os responsáveis. Aos <b>5 min</b>: <b>ligar o distintivo</b> (sinal para o Homem-Aranha) e começar a guardar o material.</InfoCard>
            <InfoCard title="Voltagem">⚠️ Sempre confira a voltagem da tomada antes de ligar a caixa de som.</InfoCard>
            <button onClick={resetAll} className={`${btn} w-full rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm font-bold text-red-300`}>Novo evento (limpar checklist e timer)</button>
          </>
        )}

        {faqCategory && <FaqView category={faqCategory} />}
      </main>

      {showMini && player.current && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0B1120]/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="h-1 bg-white/10"><div className="h-full bg-pink-400" style={{ width: `${player.progress * 100}%` }} /></div>
          <div className="mx-auto flex max-w-xl items-center gap-2 px-3 py-2">
            <button onClick={() => setView('music')} className={`${btn} min-w-0 flex-1 px-2 text-left`}>
              <span className="block text-[10px] font-bold uppercase tracking-widest text-pink-300">{player.playing ? 'Tocando' : 'Pausado'}</span>
              <span className="block truncate text-base font-bold">{player.current.title}</span>
            </button>
            <PlayerButtons player={player} size="sm" />
          </div>
        </div>
      )}

      {view.startsWith('support') && <a
        href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label="Suporte urgente: WhatsApp do Vitor"
        className={`${btn} fixed right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-[#25D366] px-5 text-base font-black text-[#04210F] shadow-lg shadow-black/50 ${showMini ? 'bottom-24' : 'bottom-5'}`}
      >
        <MessageCircle className="h-6 w-6" />Vitor
      </a>}

      {alertKey && <AlertOverlay alertKey={alertKey} onClose={() => setAlertKey(null)} />}
    </div>
  );
};

// ---------------------------------------------------------------------------

type Player = ReturnType<typeof useAgentPlayer>;

const InfoCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-4 text-[15px] leading-relaxed text-white/80">
    <p className="mb-1 text-xs font-bold uppercase tracking-widest text-white/40">{title}</p>{children}
  </div>
);

const TimerBar: React.FC<{ timer: ReturnType<typeof computeTimer>; open: boolean; onToggle: () => void; onAdjust: (min: number) => void }> = ({ timer, open, onToggle, onAdjust }) => {
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

const StepView: React.FC<{
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

const FaqItemCard: React.FC<{ item: AgentFaqItem; label?: string }> = ({ item, label }) => (
  <details className="group rounded-2xl border border-white/10 bg-[#0D1527]">
    <summary className="flex min-h-[3.5rem] cursor-pointer list-none items-center gap-3 px-4 py-3 text-[17px] font-bold leading-snug [&::-webkit-details-marker]:hidden">
      <span className="flex-1">{label && <span className="mb-0.5 block text-[11px] font-bold uppercase tracking-widest text-blue-300">{label}</span>}{item.question}</span>
      <ChevronDown className="h-5 w-5 shrink-0 text-white/40 transition-transform group-open:rotate-180" />
    </summary>
    <p className="whitespace-pre-line border-t border-white/10 px-4 py-4 text-[16px] leading-relaxed text-white/80">{item.answer}</p>
  </details>
);

const FaqView: React.FC<{ category: AgentFaqCategory }> = ({ category }) => (
  category.items.length === 0 ? (
    <p className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-6 text-center text-white/60">Nenhuma pergunta cadastrada ainda.</p>
  ) : (
    <div className="space-y-2">{category.items.map((item) => <FaqItemCard key={item.id} item={item} />)}</div>
  )
);

const FaqResults: React.FC<{ results: { category: AgentFaqCategory; item: AgentFaqItem }[] }> = ({ results }) => (
  results.length === 0 ? (
    <p className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-6 text-center text-white/60">Nada encontrado. Tente outra palavra ou fale com o Vitor pelo botão verde.</p>
  ) : (
    <div className="space-y-2">{results.map(({ category, item }) => <FaqItemCard key={item.id} item={item} label={category.title} />)}</div>
  )
);

const SearchBox: React.FC<{ value: string; onChange: (v: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
    <input
      type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
      className="h-14 w-full rounded-2xl border border-white/10 bg-[#0D1527] pl-12 pr-12 text-base text-white placeholder:text-white/35 focus:border-blue-400 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
    />
    {value && <button onClick={() => onChange('')} aria-label="Limpar busca" className={`${btn} absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-white/60`}><X className="h-5 w-5" /></button>}
  </div>
);

const RestartButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button onClick={onClick} aria-label="Recomeçar do início" title="Recomeçar do início" className={`${btn} flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-pink-400/50 bg-pink-500/15 text-pink-200`}><RotateCcw className="h-5 w-5" /></button>
);

const PlayerButtons: React.FC<{ player: Player; size: 'sm' | 'lg' }> = ({ player, size }) => {
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

const MusicView: React.FC<{ player: Player; tracks: ReturnType<typeof useAgentContent>['tracks']; loading: boolean; query: string; onQuery: (v: string) => void }> = ({ player, tracks, loading, query, onQuery }) => {
  const groups = groupTracks<(typeof tracks)[number]>(tracks);
  const currentId = player.current?.id;
  // Grupos de efeitos abertos: tocar uma música com parent abre o grupo; tocar fora dele recolhe (a seta abre/fecha só para ver).
  const [open, setOpen] = useState<string[]>([]);
  useEffect(() => {
    const group = groups.find((g) => g.track.id === currentId || g.children.some((c) => c.id === currentId));
    setOpen(group && group.children.length > 0 ? [group.track.id] : []);
  }, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const searching = !!query.trim();
  const matches = tracks.filter((t) => matchesQuery(query, t.title));

  const renderRow = (track: (typeof tracks)[number], opts: { badge: React.ReactNode; child?: boolean; effects?: number; groupId?: string }) => {
    const active = currentId === track.id;
    const expanded = !!opts.groupId && open.includes(opts.groupId);
    return (
      <li key={track.id} className="flex items-center gap-2">
        <button
          onClick={() => { if (opts.groupId) setOpen((o) => (o.includes(opts.groupId!) ? o : [...o, opts.groupId!])); if (active) player.toggle(); else player.playTrack(track); }}
          className={`${btn} flex min-w-0 flex-1 items-center gap-4 rounded-2xl border px-4 ${opts.child ? 'py-3' : 'py-4'} text-left ${active ? 'border-pink-400 bg-pink-500/20' : 'border-white/10 bg-[#0D1527]'}`}
        >
          <span className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold ${opts.child ? 'h-8 w-8' : 'h-10 w-10'} ${active ? 'bg-pink-500' : 'bg-white/10 text-white/70'}`}>
            {active && player.playing ? <Pause className="h-4 w-4" fill="currentColor" /> : active ? <Play className="h-4 w-4" fill="currentColor" /> : opts.badge}
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate ${opts.child ? 'text-base' : 'text-[17px]'} ${active ? 'font-extrabold' : 'font-semibold'}`}>{track.title}</span>
            {!!opts.effects && <span className="block text-xs text-white/50">{opts.effects} {opts.effects === 1 ? 'efeito sonoro' : 'efeitos sonoros'}</span>}
          </span>
        </button>
        {((active && player.elapsed >= 1) || player.startedIds.includes(track.id)) && <RestartButton onClick={() => player.restart(track)} />}
        {!!opts.effects && (
          <button onClick={() => setOpen((o) => (o.includes(opts.groupId!) ? o.filter((id) => id !== opts.groupId) : [...o, opts.groupId!]))} aria-expanded={expanded} aria-label={expanded ? 'Recolher efeitos' : 'Mostrar efeitos'} className={`${btn} flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70`}>
            <ChevronDown className={`h-5 w-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </li>
    );
  };

  return (
    <>
      {tracks.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-6 text-center text-white/60">{loading ? 'Carregando playlist...' : 'Nenhuma música ativa na playlist.'}</p>
      ) : (
        <>
          <div className="space-y-4 rounded-3xl border border-white/10 bg-[#0D1527] px-4 py-5 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-pink-300">{player.current ? (player.playing ? 'Tocando agora' : 'Pausado') : 'Toque em play'}</p>
            <div className="flex min-h-[2.5rem] items-center justify-center gap-2">
              <p className="text-xl font-extrabold leading-tight">{player.current?.title ?? groups[0]?.track.title}</p>
              {player.current && player.elapsed >= 1 && <RestartButton onClick={() => player.restart(player.current!)} />}
            </div>
            <div className="flex justify-center"><PlayerButtons player={player} size="lg" /></div>
            <button onClick={player.toggleLoop} aria-pressed={player.loop} className={`${btn} mx-auto flex items-center gap-2 rounded-full border px-5 py-3 text-sm font-bold ${player.loop ? 'border-pink-400 bg-pink-500/25 text-pink-100' : 'border-white/15 text-white/60'}`}><Repeat1 className="h-5 w-5" />{player.loop ? 'Repetindo esta música' : 'Repetir música'}</button>
            {player.error && <p className="text-sm font-semibold text-red-300">{player.error}</p>}
          </div>
          <SearchBox value={query} onChange={onQuery} placeholder="Buscar música" />
          {searching && matches.length === 0 && <p className="rounded-2xl border border-white/10 bg-[#0D1527] px-5 py-6 text-center text-white/60">Nenhuma música encontrada.</p>}
          <ol className="space-y-2">
            {searching
              ? matches.map((track) => renderRow(track, { badge: <Music className="h-4 w-4" /> }))
              : groups.map(({ track, children }, i) => (
                <React.Fragment key={track.id}>
                  {renderRow(track, { badge: i + 1, effects: children.length, groupId: track.id })}
                  {children.length > 0 && open.includes(track.id) && (
                    <li><ol className="ml-5 space-y-2 border-l-2 border-pink-400/30 pl-3">{children.map((child) => renderRow(child, { badge: <Music className="h-4 w-4" />, child: true }))}</ol></li>
                  )}
                </React.Fragment>
              ))}
          </ol>
        </>
      )}
    </>
  );
};

const AlertOverlay: React.FC<{ alertKey: AlertKey; onClose: () => void }> = ({ alertKey, onClose }) => {
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
