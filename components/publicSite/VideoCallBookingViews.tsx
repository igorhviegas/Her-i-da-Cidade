import React from 'react';
import { localSlot } from '../../functions/video-call-time.js';
import type { BookingFormState, CalendarData } from './useVideoCallBooking';
import type { Booked, Day, PublicConfig, Step } from './videoCallShared';
import { MONTHS, PhoneField, Rich, WEEKDAYS, box, brDate, field, heading, hint, label, longDate, primary, shortDay } from './videoCallShared';

interface SlotSummaryProps { showLocal: boolean; timeZone: string; date: string; time: string }

/** Horário escolhido. Fora do fuso de Brasília mostra os dois, cada um com o seu rótulo, para não haver dúvida sobre qual foi reservado. */
export const SlotSummary: React.FC<SlotSummaryProps> = ({ showLocal, timeZone, date: slotDate, time: slotTime }) => {
  if (!showLocal) return <p className="text-sm font-bold text-white">📅 {longDate(slotDate)} às {slotTime}</p>;
  const local = localSlot(slotDate, slotTime, timeZone);
  return (
    <div className="text-sm">
      <p className="font-bold text-white">📅 {longDate(slotDate)} às {slotTime} <span className="font-semibold text-white/60">· horário de Brasília</span></p>
      <p className="mt-1 font-bold text-emerald-300">🕒 {longDate(local.date)} às {local.time} <span className="font-semibold text-emerald-300/70">· seu horário local</span></p>
    </div>
  );
};

interface BookedViewProps { booked: Booked; config: PublicConfig | null; showLocal: boolean; timeZone: string }

export const BookedView: React.FC<BookedViewProps> = ({ booked, config, showLocal, timeZone }) => (
  <div className={`${box} text-center`} role="status">
    <p className="text-4xl">✅</p>
    <h3 className="mt-3 text-2xl font-extrabold text-white">Pré-reserva feita!</h3>
    <div className="mt-2 flex justify-center text-left"><SlotSummary showLocal={showLocal} timeZone={timeZone} date={booked.date} time={booked.time} /></div>
    <p className="mx-auto mt-4 max-w-md text-sm text-white/60">
      Falta só o pagamento{config ? <> de <strong className="text-white">{config.priceLabel}</strong> em até <strong className="text-white">{config.paymentDeadlineHours}h</strong></> : null} para garantir o horário. Envie a mensagem no WhatsApp para receber os dados de pagamento.
    </p>
    {booked.whatsappUrl
      ? <a href={booked.whatsappUrl} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-emerald-500 px-6 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-emerald-400">Abrir o WhatsApp</a>
      : <p className="mt-6 text-sm text-amber-300">Entraremos em contato pelo WhatsApp informado para combinar o pagamento.</p>}
  </div>
);

interface FormStepProps { form: BookingFormState; confirmText: string; error: string; onSubmit: (event: React.FormEvent) => void }

const FormStep: React.FC<FormStepProps> = ({ form, confirmText, error, onSubmit }) => {
  const { values, setValues, country, setCountry, callCountry, setCallCountry, sameNumber, setSameNumber, submitting } = form;
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <p className={heading}>Seus dados</p>
      <label className={label}>Nome do responsável<input required maxLength={120} autoComplete="name" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className={field} /></label>
      <label className={label}>E-mail<input required type="email" inputMode="email" autoComplete="email" maxLength={254} placeholder="voce@exemplo.com" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} className={field} />
        <span className={hint}>Usamos para enviar o convite da chamada para a sua agenda, depois do pagamento.</span>
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
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3"><Rich text={confirmText} /></div>
      {error && <p role="alert" className="text-sm font-semibold text-red-300">{error}</p>}
      <button type="submit" disabled={submitting} className="min-h-12 w-full rounded-xl bg-emerald-500 px-4 text-sm font-extrabold uppercase tracking-wide text-white hover:bg-emerald-400 disabled:opacity-60">
        {submitting ? 'Reservando...' : 'Prosseguir para pagamento no WhatsApp'}
      </button>
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
  onContinue: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

/** Passos "informações" e "dados": resumo do horário escolhido + texto informativo ou formulário. */
export const DetailsStep: React.FC<DetailsStepProps> = ({ step, config, form, error, summary, onBack, onContinue, onSubmit }) => (
  <div className={box}>
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3">
      {summary}
      <button type="button" onClick={onBack} className="text-xs font-bold text-blue-300 underline hover:text-blue-200">Alterar horário</button>
    </div>

    {step === 'info' ? (
      <>
        <p className={`mt-6 ${heading}`}>Antes de continuar</p>
        <Rich text={config.texts.info} className="mt-3" />
        <button type="button" onClick={onContinue} className={`mt-6 ${primary}`}>Continuar</button>
      </>
    ) : (
      <FormStep form={form} confirmText={config.texts.confirm} error={error} onSubmit={onSubmit} />
    )}
  </div>
);

interface CalendarPickerProps {
  month: string;
  date: string;
  calendar: CalendarData;
  timeZone: string;
  onMonth: (month: string) => void;
  onDate: (date: string) => void;
}

/** Passo 1: mês, grade de dias e aviso de fuso. */
const CalendarPicker: React.FC<CalendarPickerProps> = ({ month, date, calendar, timeZone, onMonth, onDate }) => {
  const { available, months, showLocal, grid } = calendar;
  const monthIndex = months.indexOf(month);
  return (
    <>
      <p className={heading}>1. Escolha o dia</p>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" disabled={monthIndex <= 0} onClick={() => onMonth(months[monthIndex - 1])} className="h-11 w-11 rounded-xl bg-white/5 text-white disabled:opacity-25">‹</button>
        <span className="font-bold text-white">{MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}</span>
        <button type="button" aria-label="Próximo mês" disabled={monthIndex < 0 || monthIndex >= months.length - 1} onClick={() => onMonth(months[monthIndex + 1])} className="h-11 w-11 rounded-xl bg-white/5 text-white disabled:opacity-25">›</button>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} className="text-[10px] font-bold text-white/40">{w}</span>)}
        {grid.map((key, i) => key === null ? <span key={`e${i}`} /> : (
          <button
            key={key}
            type="button"
            disabled={!available.has(key)}
            aria-pressed={key === date}
            onClick={() => onDate(key)}
            className={`aspect-square min-h-10 rounded-xl text-sm font-bold ${key === date ? 'bg-blue-600 text-white' : available.has(key) ? 'bg-white/10 text-white hover:bg-white/20' : 'text-white/20'}`}
          >{Number(key.slice(8))}</button>
        ))}
      </div>
      {showLocal && <p className="mt-3 text-[11px] leading-relaxed text-white/50">O calendário segue as datas e os horários de <strong className="text-white/80">Brasília</strong>. Ao escolher o dia, mostramos também o horário no seu fuso ({timeZone}).</p>}
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

/** Passo 2: horários do dia escolhido. */
const TimePicker: React.FC<TimePickerProps> = ({ date, times, showLocal, timeZone, config, onChoose }) => (
  <>
    <p className={`mt-6 ${heading}`}>2. Escolha o horário · {brDate(date)}</p>
    {showLocal ? (
      <div className="mt-3 space-y-2">
        {times.map((t) => {
          const local = localSlot(date, t, timeZone);
          return (
            <button key={t} type="button" onClick={() => onChoose(t)} aria-label={`${t} no horário de Brasília, ${local.time} no seu horário local${local.date !== date ? `, ${shortDay(local.date)}` : ''}`} className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2 text-left hover:bg-white/20">
              <span><span className="block text-base font-extrabold text-white">{t}</span><span className="block text-[10px] font-bold uppercase tracking-wider text-white/50">Brasília</span></span>
              <span className="text-right"><span className="block text-base font-extrabold text-emerald-300">{local.time}</span><span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">Seu horário{local.date !== date ? ` · ${shortDay(local.date)}` : ''}</span></span>
            </button>
          );
        })}
      </div>
    ) : (
      <div className="mt-3 grid grid-cols-3 gap-2">
        {times.map((t) => <button key={t} type="button" onClick={() => onChoose(t)} className="min-h-12 rounded-xl bg-white/10 text-sm font-extrabold text-white hover:bg-white/20">{t}</button>)}
      </div>
    )}
    <p className="mt-2 text-[11px] text-white/40">Vídeo chamada de {config.durationMinutes} minutos · {config.priceLabel}{showLocal ? ' · a reserva vale pelo horário de Brasília' : ' · horário de Brasília'}</p>
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
    <div className={box}>
      <CalendarPicker month={month} date={date} calendar={calendar} timeZone={timeZone} onMonth={onMonth} onDate={onDate} />

      {error && <p role="alert" className="mt-4 text-sm font-semibold text-red-300">{error}</p>}

      {date && <TimePicker date={date} times={times} showLocal={calendar.showLocal} timeZone={timeZone} config={config} onChoose={onChoose} />}
    </div>
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
  onContinue: () => void;
  onSubmit: (event: React.FormEvent) => void;
}

/** Escolhe a tela: pré-reserva feita, erro/carregando/sem horários, dados do cliente ou escolha de dia e horário. */
export const BookingView: React.FC<BookingViewProps> = ({ days, config, loadError, onRetry, booked, step, month, date, time, error, calendar, form, timeZone, onMonth, onDate, onChoose, onBack, onContinue, onSubmit }) => {
  if (booked) return <BookedView booked={booked} config={config} showLocal={calendar.showLocal} timeZone={timeZone} />;
  if (loadError) {
    return <div className={box}><p className="text-sm text-red-300">{loadError}</p><button type="button" onClick={onRetry} className="mt-4 min-h-11 rounded-xl bg-white/10 px-4 text-sm font-bold text-white hover:bg-white/20">Tentar de novo</button></div>;
  }
  if (!days || !config) return <div className={box}><p className="text-sm text-white/60">Carregando horários...</p></div>;
  if (!days.length) return <div className={box}><p className="text-sm text-white/70">Não há horários disponíveis nos próximos dias. Fale conosco pelo WhatsApp.</p></div>;

  if (step !== 'slot') {
    const summary = <SlotSummary showLocal={calendar.showLocal} timeZone={timeZone} date={date} time={time} />;
    return <DetailsStep step={step} config={config} form={form} error={error} summary={summary} onBack={onBack} onContinue={onContinue} onSubmit={onSubmit} />;
  }

  return <SlotStep month={month} date={date} error={error} calendar={calendar} timeZone={timeZone} config={config} onMonth={onMonth} onDate={onDate} onChoose={onChoose} />;
};
