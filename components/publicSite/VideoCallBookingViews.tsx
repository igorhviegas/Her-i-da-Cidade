import React from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import { TURNSTILE_SITE_KEY, TurnstileWidget } from './TurnstileWidget';
import { localSlot } from '../../functions/video-call-time.js';
import type { BookingFormState, CalendarData } from './useVideoCallBooking';
import type { Booked, Day, PublicConfig, Step } from './videoCallShared';
import { BOOKING_DETAILS_HINT, BOOKING_PRIVACY_NOTE, PRIVACY_PATH } from '../../services/privacy.js';
import { MONTHS, Rich, WEEKDAYS, brDate, longDate, shortDay } from './videoCallShared';
import { PhoneInput, StepHeader, alertBox, choice, field, ui } from './eventFormParts';

// Mesmo visual do formulário do evento (cartão, passos, botões e tema claro/escuro de eventFormParts).
const STEPS: Record<Step, { index: number; title: string; subtitle: string }> = {
  slot: { index: 0, title: 'Dia e horário', subtitle: 'Escolha quando o herói vai ligar.' },
  info: { index: 1, title: 'Como funciona', subtitle: 'Leia antes de continuar.' },
  form: { index: 2, title: 'Seus dados', subtitle: 'Para quem o herói vai ligar?' },
};
const heading = 'text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400';
const local = 'text-emerald-700 dark:text-emerald-300';
const timeButton = 'flex min-h-12 items-center rounded-xl border border-slate-300 bg-white text-sm font-extrabold text-slate-900 transition-colors hover:border-blue-500 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10';

interface SlotSummaryProps { showLocal: boolean; timeZone: string; date: string; time: string }

/** Horário escolhido. Fora do fuso de Brasília mostra os dois, cada um com o seu rótulo, para não haver dúvida sobre qual foi reservado. */
export const SlotSummary: React.FC<SlotSummaryProps> = ({ showLocal, timeZone, date: slotDate, time: slotTime }) => {
  const brasilia = (
    <p className="flex items-start gap-2 font-bold">
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden />
      <span>{longDate(slotDate)} às {slotTime}{showLocal && <span className={`font-semibold ${ui.muted}`}> · horário de Brasília</span>}</span>
    </p>
  );
  if (!showLocal) return <div className="text-sm">{brasilia}</div>;
  const slot = localSlot(slotDate, slotTime, timeZone);
  return (
    <div className="space-y-1 text-sm">
      {brasilia}
      <p className={`flex items-start gap-2 font-bold ${local}`}>
        <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>{longDate(slot.date)} às {slot.time} <span className="font-semibold opacity-80">· seu horário local</span></span>
      </p>
    </div>
  );
};

interface BookedViewProps { booked: Booked; config: PublicConfig | null; showLocal: boolean; timeZone: string }

export const BookedView: React.FC<BookedViewProps> = ({ booked, config, showLocal, timeZone }) => (
  <div className={`${ui.card} text-center`} role="status">
    <ShieldCheck className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
    <p className="mt-3 text-xs font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">Pré-reserva feita</p>
    <div className="mt-3 flex justify-center text-left"><SlotSummary showLocal={showLocal} timeZone={timeZone} date={booked.date} time={booked.time} /></div>
    <p className={`mx-auto mt-4 max-w-sm text-sm leading-relaxed ${ui.body}`}>
      Falta só o pagamento{config ? <> de <strong>{config.priceLabel}</strong> em até <strong>{config.paymentDeadlineHours}h</strong></> : null} para garantir o horário. Envie a mensagem no WhatsApp para receber os dados de pagamento.
    </p>
    {booked.whatsappUrl
      ? <a href={booked.whatsappUrl} className="mt-6 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-emerald-500"><MessageCircle className="h-4 w-4" />Abrir o WhatsApp</a>
      : <p className="mt-6 text-sm font-semibold text-amber-700 dark:text-amber-300">Entraremos em contato pelo WhatsApp informado para combinar o pagamento.</p>}
  </div>
);

interface FormStepProps { form: BookingFormState; confirmText: string; error: string; onPrevious: () => void; onSubmit: (event: React.FormEvent) => void }

const FormStep: React.FC<FormStepProps> = ({ form, confirmText, error, onPrevious, onSubmit }) => {
  const { values, setValues, country, setCountry, callCountry, setCallCountry, sameNumber, setSameNumber, submitting, captchaToken, setCaptchaToken, captchaReset } = form;
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className={ui.label}>Nome do responsável *<input required maxLength={120} autoComplete="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className={field} /></label>
      <label className={ui.label}>E-mail *<input required type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="voce@exemplo.com" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} className={field} />
        <span className={ui.hint}>Usamos para enviar o convite da chamada para a sua agenda, depois do pagamento.</span>
      </label>
      <PhoneInput required title="Seu WhatsApp *" note="Use o mesmo número que vai falar com a gente no WhatsApp para fazer o pagamento." country={country} number={values.whatsapp} autoComplete="tel-national"
        onCountry={(iso) => { setCountry(iso); if (sameNumber) setCallCountry(iso); }} onNumber={(whatsapp) => setValues({ ...values, whatsapp })} />
      <fieldset>
        <legend className={ui.label}>A vídeo chamada será neste mesmo número?</legend>
        <div className="mt-2 flex gap-2">
          {[true, false].map((option) => (
            <button key={String(option)} type="button" aria-pressed={sameNumber === option} onClick={() => setSameNumber(option)} className={choice(sameNumber === option)}>{option ? 'Sim' : 'Não, em outro'}</button>
          ))}
        </div>
      </fieldset>
      {!sameNumber && <PhoneInput required title="WhatsApp que vai receber a chamada *" country={callCountry} number={values.callWhatsapp} onCountry={setCallCountry} onNumber={(callWhatsapp) => setValues({ ...values, callWhatsapp })} />}
      <div className="flex items-end gap-3">
        <label className={`${ui.label} min-w-0 flex-1`}>Primeiro nome da criança *<input required maxLength={100} value={values.childName} onChange={(e) => setValues({ ...values, childName: e.target.value })} className={field} /></label>
        <label className={`${ui.label} w-32`}>Idade *<input required maxLength={20} placeholder="Ex.: 5 anos" value={values.childAge} onChange={(e) => setValues({ ...values, childAge: e.target.value })} className={field} /></label>
      </div>
      <label className={ui.label}>Tema principal da ligação *<input required maxLength={200} value={values.theme} onChange={(e) => setValues({ ...values, theme: e.target.value })} className={field} /></label>
      <label className={ui.label}>Detalhes que ajudam na chamada<textarea rows={3} maxLength={1000} value={values.details} onChange={(e) => setValues({ ...values, details: e.target.value })} className={field} />
        <span className={ui.hint}>Opcional. {BOOKING_DETAILS_HINT}</span>
      </label>
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10"><Rich text={confirmText} /></div>
      <p className={`text-xs leading-relaxed ${ui.muted}`}>{BOOKING_PRIVACY_NOTE} <a href={PRIVACY_PATH} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-600 underline dark:text-blue-300">Política de Privacidade</a>.</p>
      <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaReset} />
      {error && <p role="alert" className={alertBox}>{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onPrevious} disabled={submitting} className={ui.secondary}><ArrowLeft className="h-4 w-4" />Voltar</button>
        <button type="submit" disabled={submitting || (TURNSTILE_SITE_KEY !== '' && !captchaToken)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold uppercase leading-tight tracking-wide text-white hover:bg-emerald-500 disabled:opacity-60">
          {submitting ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <MessageCircle className="h-4 w-4 shrink-0" />}{submitting ? 'Reservando...' : 'Pagar no WhatsApp'}
        </button>
      </div>
    </form>
  );
};

interface DetailsStepProps {
  step: Step;
  config: PublicConfig;
  form: BookingFormState;
  error: string;
  summary: React.ReactNode;
  onBack: () => void;
  onInfo: () => void;
  onContinue: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

/** Passos "como funciona" e "dados": resumo do horário escolhido + texto informativo ou formulário. */
export const DetailsStep: React.FC<DetailsStepProps> = ({ step, config, form, error, summary, onBack, onInfo, onContinue, onSubmit }) => (
  <>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-500/25 dark:bg-blue-500/10">
      {summary}
      <button type="button" onClick={onBack} className="text-xs font-bold text-blue-600 underline hover:text-blue-500 dark:text-blue-300">Alterar horário</button>
    </div>

    {step === 'info' ? (
      <>
        <Rich text={config.texts.info} />
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onBack} className={ui.secondary}><ArrowLeft className="h-4 w-4" />Voltar</button>
          <button type="button" onClick={onContinue} className={ui.primary}>Avançar<ArrowRight className="h-4 w-4" /></button>
        </div>
      </>
    ) : (
      <FormStep form={form} confirmText={config.texts.confirm} error={error} onPrevious={onInfo} onSubmit={onSubmit} />
    )}
  </>
);

interface CalendarPickerProps {
  month: string;
  date: string;
  calendar: CalendarData;
  timeZone: string;
  onMonth: (month: string) => void;
  onDate: (date: string) => void;
}

const navButton = 'flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-30 dark:border-white/10 dark:bg-white/5 dark:text-white';

/** Mês, grade de dias e aviso de fuso. */
const CalendarPicker: React.FC<CalendarPickerProps> = ({ month, date, calendar, timeZone, onMonth, onDate }) => {
  const { available, months, showLocal, grid } = calendar;
  const monthIndex = months.indexOf(month);
  return (
    <>
      <p className={heading}>Dia</p>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" disabled={monthIndex <= 0} onClick={() => onMonth(months[monthIndex - 1])} className={navButton}><ChevronLeft className="h-5 w-5" /></button>
        <span className="font-bold">{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span>
        <button type="button" aria-label="Próximo mês" disabled={monthIndex < 0 || monthIndex >= months.length - 1} onClick={() => onMonth(months[monthIndex + 1])} className={navButton}><ChevronRight className="h-5 w-5" /></button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} className={`text-[10px] font-bold ${ui.muted}`}>{w}</span>)}
        {grid.map((key, i) => key === null ? <span key={`e${i}`} /> : (
          <button
            key={key}
            type="button"
            disabled={!available.has(key)}
            aria-pressed={key === date}
            onClick={() => onDate(key)}
            className={`aspect-square min-h-10 rounded-xl text-sm font-bold transition-colors ${key === date
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : available.has(key)
                ? 'border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/20'
                : 'text-slate-300 dark:text-white/20'}`}
          >{Number(key.slice(8))}</button>
        ))}
      </div>
      {showLocal && <p className={`mt-3 text-[11px] leading-relaxed ${ui.muted}`}>O calendário segue as datas e os horários de <strong className="text-slate-900 dark:text-white/80">Brasília</strong>. Ao escolher o dia, mostramos também o horário no seu fuso ({timeZone}).</p>}
    </>
  );
};

interface TimePickerProps {
  date: string;
  times: string[];
  showLocal: boolean;
  timeZone: string;
  config: PublicConfig;
  onChoose: (time: string) => void;
}

/** Horários do dia escolhido. */
const TimePicker: React.FC<TimePickerProps> = ({ date, times, showLocal, timeZone, config, onChoose }) => (
  <>
    <p className={`mt-6 ${heading}`}>Horário · {brDate(date)}</p>
    {showLocal ? (
      <div className="mt-3 space-y-2">
        {times.map((t) => {
          const slot = localSlot(date, t, timeZone);
          return (
            <button key={t} type="button" onClick={() => onChoose(t)} aria-label={`${t} no horário de Brasília, ${slot.time} no seu horário local${slot.date !== date ? `, ${shortDay(slot.date)}` : ''}`} className={`${timeButton} w-full justify-between gap-3 px-4 py-2 text-left`}>
              <span><span className="block text-base font-extrabold text-slate-900 dark:text-white">{t}</span><span className={`block text-[10px] font-bold uppercase tracking-wider ${ui.muted}`}>Brasília</span></span>
              <span className={`text-right ${local}`}><span className="block text-base font-extrabold">{slot.time}</span><span className="block text-[10px] font-bold uppercase tracking-wider opacity-80">Seu horário{slot.date !== date ? ` · ${shortDay(slot.date)}` : ''}</span></span>
            </button>
          );
        })}
      </div>
    ) : (
      <div className="mt-3 grid grid-cols-3 gap-2">
        {times.map((t) => <button key={t} type="button" onClick={() => onChoose(t)} className={`${timeButton} justify-center`}>{t}</button>)}
      </div>
    )}
    <p className={`mt-3 text-xs ${ui.muted}`}>Vídeo chamada de {config.durationMinutes} minutos · {config.priceLabel}{showLocal ? ' · a reserva vale pelo horário de Brasília' : ' · horário de Brasília'}</p>
  </>
);

interface SlotStepProps {
  month: string;
  date: string;
  error: string;
  calendar: CalendarData;
  timeZone: string;
  config: PublicConfig;
  onMonth: (month: string) => void;
  onDate: (date: string) => void;
  onChoose: (time: string) => void;
}

/** Passo "dia e horário". */
export const SlotStep: React.FC<SlotStepProps> = ({ month, date, error, calendar, timeZone, config, onMonth, onDate, onChoose }) => {
  const times = date ? calendar.available.get(date) ?? [] : [];
  return (
    <>
      <CalendarPicker month={month} date={date} calendar={calendar} timeZone={timeZone} onMonth={onMonth} onDate={onDate} />

      {error && <p role="alert" className={`mt-4 ${alertBox}`}>{error}</p>}

      {date && <TimePicker date={date} times={times} showLocal={calendar.showLocal} timeZone={timeZone} config={config} onChoose={onChoose} />}
    </>
  );
};

interface BookingViewProps {
  days: Day[] | null;
  config: PublicConfig | null;
  loadError: string;
  onRetry: () => Promise<void>;
  booked: Booked | null;
  step: Step;
  month: string;
  date: string;
  time: string;
  error: string;
  calendar: CalendarData;
  form: BookingFormState;
  timeZone: string;
  onMonth: (month: string) => void;
  onDate: (date: string) => void;
  onChoose: (time: string) => void;
  onBack: () => void;
  onInfo: () => void;
  onContinue: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

/** Escolhe a tela: pré-reserva feita, erro/carregando/sem horários ou o passo atual (dia e horário, como funciona, dados). */
export const BookingView: React.FC<BookingViewProps> = ({ days, config, loadError, onRetry, booked, step, month, date, time, error, calendar, form, timeZone, onMonth, onDate, onChoose, onBack, onInfo, onContinue, onSubmit }) => {
  if (booked) return <BookedView booked={booked} config={config} showLocal={calendar.showLocal} timeZone={timeZone} />;
  if (loadError) {
    return <div className={ui.card}><p role="alert" className={alertBox}>{loadError}</p><button type="button" onClick={onRetry} className={`mt-4 ${ui.secondary}`}>Tentar de novo</button></div>;
  }
  if (!days || !config) return <div className={ui.card}><p className={`flex items-center gap-2 text-sm ${ui.muted}`}><Loader2 className="h-4 w-4 animate-spin" />Carregando horários...</p></div>;
  if (!days.length) return <div className={ui.card}><p className={`text-sm ${ui.body}`}>Não há horários disponíveis nos próximos dias. Fale conosco pelo WhatsApp.</p></div>;

  const meta = STEPS[step];
  return (
    <div className={ui.card}>
      <StepHeader index={meta.index} total={3} title={meta.title} subtitle={meta.subtitle} />
      {step === 'slot'
        ? <SlotStep month={month} date={date} error={error} calendar={calendar} timeZone={timeZone} config={config} onMonth={onMonth} onDate={onDate} onChoose={onChoose} />
        : <DetailsStep step={step} config={config} form={form} error={error} summary={<SlotSummary showLocal={calendar.showLocal} timeZone={timeZone} date={date} time={time} />} onBack={onBack} onInfo={onInfo} onContinue={onContinue} onSubmit={onSubmit} />}
    </div>
  );
};
