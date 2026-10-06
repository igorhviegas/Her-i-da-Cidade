import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { isValidTimeZone, localSlot } from '../functions/video-call-time.js';
import { DEFAULT_PHONE_COUNTRY, ddiOf, phoneCountryOptions } from '../services/phoneCountries.js';

interface Day { date: string; times: string[] }
interface Booked { date: string; time: string; whatsappUrl: string | null }
export interface PublicConfig { priceLabel: string; durationMinutes: number; paymentDeadlineHours: number; texts: { info: string; confirm: string; security: string } }
type Step = 'slot' | 'info' | 'form';

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const brDate = (key: string) => key.split('-').reverse().join('/');
// As chaves 'YYYY-MM-DD' já são datas de parede (de Brasília ou do cliente): formatar em UTC só evita que o fuso do aparelho as desloque.
const longDate = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));
const shortDay = (key: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${key}T12:00:00Z`));

/**
 * Fuso do aparelho do cliente (identificador IANA do navegador). Vazio se o navegador não informar: aí a página mostra só Brasília.
 * `?fuso=Europe/Lisbon` na URL simula outro fuso, para conferir o que um cliente de fora vê sem mudar o relógio do aparelho.
 */
function detectTimeZone(): string {
  try {
    const simulated = new URLSearchParams(window.location.search).get('fuso');
    if (simulated && isValidTimeZone(simulated)) return simulated;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(detected) ? detected : '';
  } catch {
    return '';
  }
}

const inputBase = 'rounded-xl border border-white/10 bg-[#070B14] px-3 py-3 text-base text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none';
const field = `mt-1.5 w-full ${inputBase}`;
const label = 'block text-xs font-semibold text-white/70';
const hint = 'mt-1 block text-xs font-normal text-white/40';
const heading = 'text-xs font-black uppercase tracking-[0.2em] text-blue-400';
const primary = 'min-h-12 w-full rounded-xl bg-blue-600 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-blue-500 disabled:opacity-60';

/** Trechos entre ** viram negrito (textos configuráveis no admin). */
export const renderBold = (text: string) => text.split('**').map((part, i) => (i % 2 ? <strong key={i} className="font-bold text-white">{part}</strong> : part));

/** Texto configurável no admin: parágrafos separados por linha em branco e **negrito**. */
const Rich: React.FC<{ text: string; className?: string }> = ({ text, className }) => (
  <div className={`space-y-3 text-sm leading-relaxed text-white/75 ${className ?? ''}`}>
    {text.split(/\n\s*\n/).map((paragraph, i) => (
      <p key={i} className="whitespace-pre-line">
        {renderBold(paragraph)}
      </p>
    ))}
  </div>
);

/** Telefone em duas partes: país (DDI, Brasil por padrão) e número. O servidor junta os dois no formato internacional. */
const PhoneField: React.FC<{ title: string; note?: string; country: string; number: string; onCountry: (iso: string) => void; onNumber: (value: string) => void; autoComplete?: string }> = ({ title, note, country, number, onCountry, onNumber, autoComplete }) => {
  const options = useMemo(() => phoneCountryOptions(), []);
  return (
    <div>
      <span className={label}>{title}</span>
      <div className="mt-1.5 flex gap-2">
        <select aria-label={`${title}: país (DDI)`} value={country} onChange={(e) => onCountry(e.target.value)} className={`w-[7.25rem] shrink-0 ${inputBase} px-2`}>
          {options.map((option) => <option key={option.iso} value={option.iso}>{option.label}</option>)}
        </select>
        <input required type="tel" inputMode="tel" autoComplete={autoComplete} aria-label={`${title}: número`} placeholder={country === 'BR' ? '(31) 99999-0000' : 'Número com código de área'} value={number} onChange={(e) => onNumber(e.target.value)} className={`min-w-0 flex-1 ${inputBase}`} />
      </div>
      {note && <span className={hint}>{note}</span>}
    </div>
  );
};

/** Dia e horário → informações → dados → pré-reserva. Só dá sucesso depois que o servidor confirma pedido e evento no Google Agenda. */
export const VideoCallBooking: React.FC<{ /** Avisa quem hospeda o componente quando os textos/valor chegam (ex.: a página mostra o aviso de segurança). */ onConfig?: (config: PublicConfig) => void }> = ({ onConfig }) => {
  const [days, setDays] = useState<Day[] | null>(null);
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [month, setMonth] = useState<string>(''); // 'YYYY-MM'
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [step, setStep] = useState<Step>('slot');
  const [values, setValues] = useState({ name: '', email: '', whatsapp: '', callWhatsapp: '', childName: '', childAge: '', theme: '', details: '' });
  const [country, setCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [callCountry, setCallCountry] = useState(DEFAULT_PHONE_COUNTRY);
  const [sameNumber, setSameNumber] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);
  const timeZone = useMemo(detectTimeZone, []);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const response = await fetch('/api/video-call');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'Não foi possível carregar os horários.');
      setDays(data.days);
      setConfig(data.config);
      onConfig?.(data.config);
      setMonth((current) => current || data.days[0]?.date.slice(0, 7) || '');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os horários.');
    }
  }, [onConfig]);
  useEffect(() => { load(); }, [load]);

  const available = useMemo(() => new Map((days ?? []).map((d) => [d.date, d.times])), [days]);
  const months = useMemo(() => [...new Set((days ?? []).map((d) => d.date.slice(0, 7)))], [days]);
  // A agenda é sempre a de Brasília. O horário local só aparece para quem está em um fuso em que ele difere (cliente no Brasil vê a tela limpa).
  const showLocal = useMemo(() => !!timeZone && (days ?? []).some((d) => d.times.some((t) => !localSlot(d.date, t, timeZone).same)), [days, timeZone]);

  const grid = useMemo(() => {
    if (!month) return [];
    const [year, monthNumber] = month.split('-').map(Number);
    const first = new Date(Date.UTC(year, monthNumber - 1, 1));
    const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    return [...Array(first.getUTCDay()).fill(null), ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)] as (string | null)[];
  }, [month]);

  const backToSlots = () => { setStep('slot'); setTime(''); setError(''); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const body = {
        ...values, ddi: ddiOf(country), callDdi: ddiOf(callCountry), callWhatsapp: sameNumber ? '' : values.callWhatsapp,
        timezone: timeZone, slot: { date, time }, // o horário enviado é sempre o de Brasília; o fuso vai só como informação
      };
      const response = await fetch('/api/video-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        setError(data?.error?.message || 'Não foi possível concluir o agendamento. Tente novamente.');
        if (data?.error?.code === 'slot_unavailable') { await load(); setStep('slot'); setTime(''); }
        return;
      }
      setBooked({ date: data.booking.date, time: data.booking.time, whatsappUrl: data.booking.whatsappUrl });
      // Segue direto para o WhatsApp com a mensagem pronta; a tela de confirmação fica para quando o cliente voltar.
      if (data.booking.whatsappUrl) window.location.href = data.booking.whatsappUrl;
    } catch {
      setError('Sem conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  /** Horário escolhido. Fora do fuso de Brasília mostra os dois, cada um com o seu rótulo, para não haver dúvida sobre qual foi reservado. */
  const slotSummary = (slotDate: string, slotTime: string) => {
    if (!showLocal) return <p className="text-sm font-bold text-white">📅 {longDate(slotDate)} às {slotTime}</p>;
    const local = localSlot(slotDate, slotTime, timeZone);
    return (
      <div className="text-sm">
        <p className="font-bold text-white">📅 {longDate(slotDate)} às {slotTime} <span className="font-semibold text-white/60">· horário de Brasília</span></p>
        <p className="mt-1 font-bold text-emerald-300">🕒 {longDate(local.date)} às {local.time} <span className="font-semibold text-emerald-300/70">· seu horário local</span></p>
      </div>
    );
  };

  const box = 'rounded-[2rem] border border-white/10 bg-[#0B1929]/60 p-5 text-left shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:p-8';

  if (booked) {
    return (
      <div className={`${box} text-center`} role="status">
        <p className="text-4xl">✅</p>
        <h3 className="mt-3 text-2xl font-extrabold text-white">Pré-reserva feita!</h3>
        <div className="mt-2 flex justify-center text-left">{slotSummary(booked.date, booked.time)}</div>
        <p className="mx-auto mt-4 max-w-md text-sm text-white/60">
          Falta só o pagamento{config ? <> de <strong className="text-white">{config.priceLabel}</strong> em até <strong className="text-white">{config.paymentDeadlineHours}h</strong></> : null} para garantir o horário. Envie a mensagem no WhatsApp para receber os dados de pagamento.
        </p>
        {booked.whatsappUrl
          ? <a href={booked.whatsappUrl} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-emerald-400">Abrir o WhatsApp</a>
          : <p className="mt-6 text-sm text-amber-300">Entraremos em contato pelo WhatsApp informado para combinar o pagamento.</p>}
      </div>
    );
  }

  if (loadError) {
    return <div className={box}><p className="text-sm text-red-300">{loadError}</p><button type="button" onClick={load} className="mt-4 min-h-11 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20">Tentar de novo</button></div>;
  }
  if (!days || !config) return <div className={box}><p className="text-sm text-white/60">Carregando horários...</p></div>;
  if (!days.length) return <div className={box}><p className="text-sm text-white/70">Não há horários disponíveis nos próximos dias. Fale conosco pelo WhatsApp.</p></div>;

  if (step !== 'slot') {
    return (
      <div className={box}>
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
          {slotSummary(date, time)}
          <button type="button" onClick={backToSlots} className="text-xs font-bold text-blue-300 underline hover:text-blue-200">Alterar horário</button>
        </div>

        {step === 'info' ? (
          <>
            <p className={`mt-6 ${heading}`}>Antes de continuar</p>
            <Rich text={config.texts.info} className="mt-3" />
            <button type="button" onClick={() => setStep('form')} className={`mt-6 ${primary}`}>Continuar</button>
          </>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <p className={heading}>Seus dados</p>
            <label className={label}>Nome do responsável<input required maxLength={120} autoComplete="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className={field} /></label>
            <label className={label}>E-mail<input required type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="voce@exemplo.com" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} className={field} />
              <span className={hint}>Depois do pagamento, você recebe por e-mail o convite para adicionar a chamada à sua agenda.</span>
            </label>
            <PhoneField title="Seu WhatsApp" note="Use o mesmo número que vai falar com a gente no WhatsApp para fazer o pagamento." country={country} number={values.whatsapp} autoComplete="tel-national"
              onCountry={(iso) => { setCountry(iso); if (sameNumber) setCallCountry(iso); }} onNumber={(whatsapp) => setValues({ ...values, whatsapp })} />
            <fieldset>
              <legend className={label}>A vídeo chamada será neste mesmo número?</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {[true, false].map((option) => (
                  <button key={String(option)} type="button" aria-pressed={sameNumber === option} onClick={() => setSameNumber(option)} className={`min-h-11 rounded-xl text-sm font-bold ${sameNumber === option ? 'bg-blue-600 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}>{option ? 'Sim' : 'Não, em outro'}</button>
                ))}
              </div>
            </fieldset>
            {!sameNumber && <PhoneField title="WhatsApp que vai receber a chamada" country={callCountry} number={values.callWhatsapp} onCountry={setCallCountry} onNumber={(callWhatsapp) => setValues({ ...values, callWhatsapp })} />}
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <label className={label}>Nome da criança<input required maxLength={100} value={values.childName} onChange={(e) => setValues({ ...values, childName: e.target.value })} className={field} /></label>
              <label className={label}>Idade<input required maxLength={20} placeholder="Ex.: 5 anos" value={values.childAge} onChange={(e) => setValues({ ...values, childAge: e.target.value })} className={field} /></label>
            </div>
            <label className={label}>Tema principal da ligação<input required maxLength={200} value={values.theme} onChange={(e) => setValues({ ...values, theme: e.target.value })} className={field} /></label>
            <label className={label}>Detalhes que ajudam na chamada (opcional)<textarea rows={3} maxLength={1000} value={values.details} onChange={(e) => setValues({ ...values, details: e.target.value })} className={field} /></label>
            <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3"><Rich text={config.texts.confirm} /></div>
            {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
            <button type="submit" disabled={submitting} className="min-h-12 w-full rounded-xl bg-emerald-500 px-4 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-emerald-400 disabled:opacity-60">
              {submitting ? 'Reservando...' : 'Prosseguir para pagamento no WhatsApp'}
            </button>
          </form>
        )}
      </div>
    );
  }

  const times = date ? available.get(date) ?? [] : [];
  const monthIndex = months.indexOf(month);
  const choose = (t: string) => { setTime(t); setError(''); setStep('info'); };

  return (
    <div className={box}>
      <p className={heading}>1. Escolha o dia</p>
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
      {showLocal && <p className="mt-3 text-[11px] leading-relaxed text-white/50">O calendário segue as datas e os horários de <strong className="text-white/80">Brasília</strong>. Ao escolher o dia, mostramos também o horário no seu fuso ({timeZone}).</p>}

      {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-300">{error}</p>}

      {date && (
        <>
          <p className={`mt-6 ${heading}`}>2. Escolha o horário · {brDate(date)}</p>
          {showLocal ? (
            <div className="mt-3 space-y-2">
              {times.map((t) => {
                const local = localSlot(date, t, timeZone);
                return (
                  <button key={t} type="button" onClick={() => choose(t)} aria-label={`${t} no horário de Brasília, ${local.time} no seu horário local${local.date !== date ? `, ${shortDay(local.date)}` : ''}`} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2 text-left hover:bg-white/20">
                    <span><span className="block text-base font-extrabold text-white">{t}</span><span className="block text-[10px] font-bold uppercase tracking-wider text-white/50">Brasília</span></span>
                    <span className="text-right"><span className="block text-base font-extrabold text-emerald-300">{local.time}</span><span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">Seu horário{local.date !== date ? ` · ${shortDay(local.date)}` : ''}</span></span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {times.map((t) => <button key={t} type="button" onClick={() => choose(t)} className="min-h-12 rounded-xl bg-white/10 text-sm font-extrabold text-white hover:bg-white/20">{t}</button>)}
            </div>
          )}
          <p className="mt-2 text-[11px] text-white/40">Vídeo chamada de {config.durationMinutes} minutos · {config.priceLabel}{showLocal ? ' · a reserva vale pelo horário de Brasília' : ' · horário de Brasília'}</p>
        </>
      )}
    </div>
  );
};
