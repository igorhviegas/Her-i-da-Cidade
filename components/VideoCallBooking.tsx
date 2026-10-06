import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface Day { date: string; times: string[] }
interface Booked { date: string; time: string; whatsappUrl: string | null }

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brDate = (key: string) => key.split('-').reverse().join('/');
const longDate = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));

const field = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none';
const label = 'block text-xs font-semibold text-white/70';

/** Escolher data → horário → dados → reservar. Só dá sucesso depois que o servidor confirma pedido e evento no Google Agenda. */
export const VideoCallBooking: React.FC = () => {
  const [days, setDays] = useState<Day[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [month, setMonth] = useState<string>(''); // 'YYYY-MM'
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [values, setValues] = useState({ name: '', whatsapp: '', childName: '', childAge: '', theme: '', details: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const response = await fetch('/api/video-call');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'Não foi possível carregar os horários.');
      setDays(data.days);
      setMonth((current) => current || data.days[0]?.date.slice(0, 7) || '');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os horários.');
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  // Depois de reservar, leva o cliente ao WhatsApp (o botão continua na tela caso o navegador bloqueie).
  useEffect(() => {
    if (!booked?.whatsappUrl) return;
    const timer = window.setTimeout(() => { window.location.href = booked.whatsappUrl!; }, 4000);
    return () => window.clearTimeout(timer);
  }, [booked]);

  const available = useMemo(() => new Map((days ?? []).map((d) => [d.date, d.times])), [days]);
  const months = useMemo(() => [...new Set((days ?? []).map((d) => d.date.slice(0, 7)))], [days]);

  const grid = useMemo(() => {
    if (!month) return [];
    const [year, monthNumber] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)] as (string | null)[];
  }, [month]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/video-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...values, slot: { date, time } }) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.error?.message || 'Não foi possível concluir o agendamento. Tente novamente.');
        if (data?.error?.code === 'slot_unavailable') { setTime(''); await load(); }
        return;
      }
      setBooked({ date: data.booking.date, time: data.booking.time, whatsappUrl: data.booking.whatsappUrl });
    } catch {
      setError('Sem conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const box = 'rounded-[2rem] border border-white/10 bg-[#0B1929]/60 p-5 text-left shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-8';

  if (booked) {
    return (
      <div className={`${box} text-center`} role="status">
        <p className="text-4xl">✅</p>
        <h3 className="mt-3 text-2xl font-extrabold text-white">Horário reservado!</h3>
        <p className="mt-2 text-white/80">{longDate(booked.date)} às {booked.time}</p>
        <p className="mx-auto mt-4 max-w-md text-sm text-white/60">Falta só o pagamento para confirmar. Siga para o WhatsApp para receber os dados de pagamento. Reservas sem pagamento podem ser canceladas.</p>
        {booked.whatsappUrl
          ? <a href={booked.whatsappUrl} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-emerald-400">Continuar no WhatsApp</a>
          : <p className="mt-6 text-sm text-amber-300">Entraremos em contato pelo WhatsApp informado para combinar o pagamento.</p>}
      </div>
    );
  }

  if (loadError) {
    return <div className={box}><p className="text-sm text-red-300">{loadError}</p><button type="button" onClick={load} className="mt-4 min-h-11 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20">Tentar de novo</button></div>;
  }
  if (!days) return <div className={box}><p className="text-sm text-white/60">Carregando horários...</p></div>;
  if (!days.length) return <div className={box}><p className="text-sm text-white/70">Não há horários disponíveis nos próximos dias. Fale conosco pelo WhatsApp.</p></div>;

  const times = date ? available.get(date) ?? [] : [];
  const monthIndex = months.indexOf(month);

  return (
    <div className={box}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">1. Escolha o dia</p>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" disabled={monthIndex <= 0} onClick={() => setMonth(months[monthIndex - 1])} className="h-11 w-11 rounded-xl bg-white/5 text-white disabled:opacity-25">‹</button>
        <span className="font-bold text-white">{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span>
        <button type="button" aria-label="Próximo mês" disabled={monthIndex < 0 || monthIndex >= months.length - 1} onClick={() => setMonth(months[monthIndex + 1])} className="h-11 w-11 rounded-xl bg-white/5 text-white disabled:opacity-25">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} className="text-[10px] font-bold text-white/40">{w}</span>)}
        {grid.map((key, i) => key === null ? <span key={`e${i}`} /> : (
          <button
            key={key}
            type="button"
            disabled={!available.has(key)}
            aria-pressed={key === date}
            onClick={() => { setDate(key); setTime(''); setError(''); }}
            className={`aspect-square min-h-10 rounded-xl text-sm font-bold ${key === date ? 'bg-blue-600 text-white' : available.has(key) ? 'bg-white/10 text-white hover:bg-white/20' : 'text-white/20'}`}
          >{Number(key.slice(8))}</button>
        ))}
      </div>

      {date && (
        <>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-blue-400">2. Escolha o horário · {brDate(date)}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {times.map((t) => (
              <button key={t} type="button" aria-pressed={t === time} onClick={() => { setTime(t); setError(''); }} className={`min-h-12 rounded-xl text-sm font-extrabold ${t === time ? 'bg-blue-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{t}</button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-white/40">Vídeo chamada de 15 minutos · horário de Brasília</p>
        </>
      )}

      {date && time && (
        <form onSubmit={submit} className="mt-6 space-y-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-400">3. Seus dados</p>
          <label className={label}>Nome do responsável<input required maxLength={120} autoComplete="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className={field} /></label>
          <label className={label}>WhatsApp (com DDD)<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="(31) 99999-0000" value={values.whatsapp} onChange={(e) => setValues({ ...values, whatsapp: e.target.value })} className={field} /></label>
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <label className={label}>Nome da criança<input required maxLength={100} value={values.childName} onChange={(e) => setValues({ ...values, childName: e.target.value })} className={field} /></label>
            <label className={label}>Idade<input required maxLength={20} placeholder="Ex.: 5 anos" value={values.childAge} onChange={(e) => setValues({ ...values, childAge: e.target.value })} className={field} /></label>
          </div>
          <label className={label}>Tema principal da ligação<input required maxLength={200} value={values.theme} onChange={(e) => setValues({ ...values, theme: e.target.value })} className={field} /></label>
          <label className={label}>Detalhes que ajudam na chamada (opcional)<textarea rows={3} maxLength={1000} value={values.details} onChange={(e) => setValues({ ...values, details: e.target.value })} className={field} /></label>
          {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
          <button type="submit" disabled={submitting} className="min-h-12 w-full rounded-xl bg-blue-600 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-blue-500 disabled:opacity-60">
            {submitting ? 'Reservando...' : `Reservar ${brDate(date)} às ${time}`}
          </button>
        </form>
      )}
    </div>
  );
};
