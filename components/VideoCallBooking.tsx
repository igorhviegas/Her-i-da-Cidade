import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookingView } from './publicSite/VideoCallBookingViews';
import { useBookingFormState, useCalendarData, useVideoCallAvailability } from './publicSite/useVideoCallBooking';
import { buildBookingBody, detectTimeZone } from './publicSite/videoCallShared';
import type { Booked, PublicConfig, Step } from './publicSite/videoCallShared';

export { renderBold } from './publicSite/videoCallShared';
export type { PublicConfig } from './publicSite/videoCallShared';

/** Dia e horário → informações → dados → pré-reserva. Só dá sucesso depois que o servidor confirma pedido e evento no Google Agenda. */
export const VideoCallBooking: React.FC<{ /** Avisa quem hospeda o componente quando os textos/valor chegam (ex.: a página mostra o aviso de segurança). */ onConfig?: (config: PublicConfig) => void }> = ({ onConfig }) => {
  const { days, config, loadError, month, setMonth, load } = useVideoCallAvailability(onConfig);
  const form = useBookingFormState();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [step, setStep] = useState<Step>('slot');
  const [error, setError] = useState('');
  const [booked, setBooked] = useState<Booked | null>(null);
  const timeZone = useMemo(detectTimeZone, []);
  const calendar = useCalendarData(days, month, timeZone);

  const backToSlots = () => { setStep('slot'); setTime(''); setError(''); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    form.setSubmitting(true);
    setError('');
    try {
      const body = { ...buildBookingBody({ values: form.values, country: form.country, callCountry: form.callCountry, sameNumber: form.sameNumber, timeZone, date, time }), turnstileToken: form.captchaToken };
      const response = await fetch('/api/video-call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        form.resetCaptcha(); // o token vale uma única vez
        setError(data?.error?.message || 'Não foi possível concluir o agendamento. Tente novamente.');
        if (data?.error?.code === 'slot_unavailable') { await load(); setStep('slot'); setTime(''); }
        return;
      }
      setBooked({ date: data.booking.date, time: data.booking.time, whatsappUrl: data.booking.whatsappUrl });
      // Segue direto para o WhatsApp com a mensagem pronta; a tela de confirmação fica para quando o cliente voltar.
      if (data.booking.whatsappUrl) window.location.href = data.booking.whatsappUrl;
    } catch {
      form.resetCaptcha();
      setError('Sem conexão. Verifique sua internet e tente novamente.');
    } finally {
      form.setSubmitting(false);
    }
  };

  const choose = (t: string) => { setTime(t); setError(''); setStep('info'); };

  // Trocou de passo com o topo do cartão fora da tela (ex.: escolheu o horário lá embaixo): volta para o começo do passo.
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (top.current && top.current.getBoundingClientRect().top < 0) top.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step, booked]);

  return (
    <div ref={top} className="scroll-mt-4">
      <BookingView
        days={days} config={config} loadError={loadError} onRetry={load} booked={booked} step={step}
        month={month} date={date} time={time} error={error} calendar={calendar} form={form} timeZone={timeZone}
        onMonth={setMonth} onDate={(key) => { setDate(key); setTime(''); setError(''); }} onChoose={choose}
        onBack={backToSlots} onInfo={() => { setStep('info'); setError(''); }} onContinue={() => setStep('form')} onSubmit={submit}
      />
    </div>
  );
};
