import React, { useEffect, useState } from 'react';
import { useAgentContent } from '../../services/agentService';
import { computeTimer, dueAlert, markFired, type AlertKey } from '../../services/agentContent.js';
import { useAgentPlayer } from './useAgentPlayer';
import { AlertOverlay, TimerBar } from '../publicSite/agente/AgentBits';
import { AgentFooter, AgentHeader, AgentScreens } from '../publicSite/agente/AgentScreens';
import { useSaved } from '../publicSite/agente/agenteShared';
import { resolveView, stepProgress, useViewTrail } from '../publicSite/agente/agenteView';
import { useEventActions } from '../publicSite/agente/useEventActions';

// Rota pública sem login. Para proteger depois, envolva <AgentApp /> em App.tsx (como o AdminApp com ProtectedAdminRoute)
// e restrinja a leitura de agentSteps/agentTracks em firestore.rules.

export const AgentApp: React.FC = () => {
  const { steps, tracks, tracksLoading, faq } = useAgentContent();
  const player = useAgentPlayer(tracks);
  const [saved, update] = useSaved();
  const { view, rawSetView, setView, goBack, goHome } = useViewTrail();
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

  const { startEvent, adjust, resetAll } = useEventActions(update, setNow, goHome);

  const progress = stepProgress(steps, saved.checks);
  const info = resolveView(view, steps, faq);
  const showMini = !!player.current && view !== 'music';

  return (
    <div className={`min-h-screen bg-[#070B14] text-white antialiased ${showMini ? 'pb-44' : 'pb-28'}`} style={{ WebkitTapHighlightColor: 'transparent' }}>
      <div className="sticky top-0 z-40 shadow-lg shadow-black/40">
        {event && timer && <TimerBar timer={timer} open={timerOpen} onToggle={() => setTimerOpen((o) => !o)} onAdjust={adjust} />}
        <AgentHeader view={view} title={info.title} onBack={goBack} />
      </div>

      <AgentScreens
        view={view} info={info} steps={steps} tracks={tracks} tracksLoading={tracksLoading} faq={faq} saved={saved} update={update}
        progress={progress} player={player} query={query} onQuery={setQuery} setView={setView} rawSetView={rawSetView} onStart={startEvent} onReset={resetAll}
      />

      <AgentFooter view={view} showMini={showMini} player={player} onOpenMusic={() => setView('music')} />

      {alertKey && <AlertOverlay alertKey={alertKey} onClose={() => setAlertKey(null)} />}
    </div>
  );
};
