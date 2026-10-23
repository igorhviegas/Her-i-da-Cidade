import React, { useMemo, useState } from 'react';
import { Loader2, MessageCircle, TriangleAlert } from 'lucide-react';
import { fetchDayEta, type DayEta } from '../../services/travelService';
import { formatTime, renderMessage, parseTime, planDay } from '../../services/eventSchedule.js';
import { btn, card, field, heading, load, todayKey } from '../publicSite/agente/travelShared';

const EVENT_MINUTES = 60; // mesma duração do evento na Agenda (functions/google-calendar.js)

const whatsApp = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
const nowMinutes = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

/**
 * Previsão de chegada em casa (docs/deslocamento.md): eventos de hoje + trajeto do Google (casa → eventos → casa → casa do Vitor).
 * Gera a mensagem "chegamos no evento" para a esposa de cada um. Usa o mesmo código de acesso do Deslocamento.
 */
export const HomeEta: React.FC = () => {
  const [code] = useState(() => load().code);
  const [date, setDate] = useState(todayKey);
  const [eta, setEta] = useState<DayEta | null>(null);
  const [current, setCurrent] = useState(0);
  const [at, setAt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const plan = useMemo(() => {
    if (!eta || eta.events.length === 0) return null;
    const stops = eta.events.map((e, i) => { const start = parseTime(e.time) ?? 0; return { label: `Evento ${i + 1}`, start, end: start + EVENT_MINUTES }; });
    return planDay(stops, eta.legs);
  }, [eta]);

  const run = async () => {
    setBusy(true); setError(''); setEta(null);
    try {
      const result = await fetchDayEta(code, date);
      const now = nowMinutes();
      const upcoming = result.events.findIndex((e) => (parseTime(e.time) ?? 0) + EVENT_MINUTES > now);
      setCurrent(upcoming === -1 ? Math.max(result.events.length - 1, 0) : upcoming);
      setAt(now);
      setEta(result);
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível calcular agora.'); }
    setBusy(false);
  };

  if (!code) return <div className={card}><p className="text-sm text-white/70">Salve o código de acesso em <b>Deslocamento</b> primeiro. Ele também vale aqui.</p></div>;

  const venueLabel = eta?.events[current] ? `${eta.events[current].formType ? `${eta.events[current].formType}, ` : ''}${eta.events[current].time}` : '';
  const send = (who: 'self' | 'vitor', arrivalAt: number) => whatsApp(renderMessage(eta?.messages[who] ?? '', { evento: venueLabel, hora: formatTime(at), previsao: formatTime(arrivalAt) }));

  return (
    <div className="space-y-4">
      <label className={`${card} block`}>
        <span className={heading}>Data dos eventos</span>
        <input type="date" value={date} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setEta(null); setError(''); } }} className={`${field} min-w-0 appearance-none`} />
      </label>
      <button disabled={busy} onClick={run} className={`${btn} flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-lg font-black uppercase tracking-wide shadow-lg shadow-blue-600/30 disabled:opacity-40`}>
        {busy ? <><Loader2 className="h-5 w-5 animate-spin" />Calculando...</> : date === todayKey() ? 'Calcular previsão de hoje' : 'Calcular previsão do dia'}
      </button>
      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-400/50 bg-red-600/20 px-4 py-3 text-[15px] font-semibold text-red-100"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />{error}</div>}
      {eta && !plan && <div className={card}><p className="text-sm text-white/70">Nenhum evento cadastrado para este dia.</p></div>}

      {eta && plan && (
        <>
          <div className={`${card} space-y-2 text-sm text-white/80`}>
            {plan.rows.map((row, i) => (
              <p key={i}><b className="text-white">{formatTime(row.start)} · {row.label}</b> — {i === 0 ? 'sair de casa' : 'sair do evento anterior'} às <b>{formatTime(row.leaveAt)}</b> ({row.travel} min){row.slack !== null && (row.ok ? `, sobra ${row.slack} min` : `, faltam ${-row.slack} min`)}</p>
            ))}
            <p className="border-t border-white/10 pt-2">Fora de casa: <b className="text-white">{formatTime(plan.rows[0].leaveAt)} às {formatTime(plan.homeAt)}</b> ({Math.round((plan.homeAt - plan.rows[0].leaveAt) / 6) / 10} h)</p>
            <p>Chegada em casa: <b className="text-white">{formatTime(plan.homeAt)}</b></p>
            {plan.vitorAt !== null && <p>Chegada do Vitor: <b className="text-white">{formatTime(plan.vitorAt)}</b></p>}
            <p className="text-xs text-white/40">Sem trânsito em tempo real; cada evento conta 1 hora.</p>
          </div>

          <label className={`${card} block`}>
            <span className={heading}>Em qual evento chegamos?</span>
            <select value={current} onChange={(e) => setCurrent(Number(e.target.value))} className={field}>
              {eta.events.map((e, i) => <option key={i} value={i}>Evento {i + 1} · {e.time}{e.formType ? ` · ${e.formType}` : ''}</option>)}
            </select>
          </label>

          {plan.vitorAt !== null && (
            <a href={send('vitor', plan.vitorAt)} target="_blank" rel="noopener noreferrer" className={`${btn} flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-center text-base font-black leading-tight text-[#04210F]`}>
              <MessageCircle className="h-5 w-5 shrink-0" />Mensagem para a esposa do Vitor
            </a>
          )}
          <a href={send('self', plan.homeAt)} target="_blank" rel="noopener noreferrer" className={`${btn} flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-center text-base font-black leading-tight text-[#04210F]`}>
            <MessageCircle className="h-5 w-5 shrink-0" />Mensagem para minha esposa
          </a>
        </>
      )}
    </div>
  );
};
