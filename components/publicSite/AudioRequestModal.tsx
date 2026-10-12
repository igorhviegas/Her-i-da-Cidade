import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlertTriangle, MessageCircle, X } from 'lucide-react';
import { wallTime } from '../../functions/video-call-time.js';
import {
  AUDIO_MESSAGE_MAX,
  AUDIO_NAME_MAX,
  AUDIO_NOTICE,
  buildWhatsAppUrl,
  formatDateBr,
  validateAudioRequest,
} from '../../services/audioRequest.js';

type Step = 'form' | 'review' | 'done';
type Field = 'eventDate' | 'childName' | 'message';

const inputClass = 'w-full rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-3 text-base text-white placeholder:text-white/35 outline-none transition focus:border-purple-400 focus:ring-2 focus:ring-purple-400/30 aria-[invalid=true]:border-rose-400';
const primaryButton = 'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45 disabled:active:scale-100';
const secondaryButton = 'inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/20';
const termClass = 'text-xs font-semibold uppercase tracking-wide text-white/50';

const FieldError: React.FC<{ id: string; message?: string }> = ({ id, message }) =>
  message ? <p id={id} role="alert" className="mt-1.5 text-xs font-medium text-rose-300">{message}</p> : null;

const Notice: React.FC = () => (
  <div className="flex gap-3 rounded-xl border border-amber-300/30 bg-amber-300/10 p-3.5 text-sm leading-relaxed text-amber-50">
    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" aria-hidden />
    <p>{AUDIO_NOTICE}</p>
  </div>
);

/**
 * Pedido de áudio personalizado: formulário → revisão → WhatsApp com a mensagem pronta. O site só prepara a mensagem:
 * ela só chega depois que o cliente a envia dentro do WhatsApp, e a tela nunca diz que foi enviada.
 */
export const AudioRequestModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const uid = useId();
  const todayKey = useMemo(() => wallTime(Date.now()).date, []);
  const [step, setStep] = useState<Step>('form');
  const [eventDate, setEventDate] = useState('');
  const [childName, setChildName] = useState('');
  const [message, setMessage] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const dialogRef = useRef<HTMLDivElement>(null);

  const checked = validateAudioRequest({ eventDate, childName, message, accepted }, todayKey);
  const errors = checked.errors ?? {};
  const visibleError = (field: Field) => (touched[field] ? errors[field] : undefined);
  const whatsappUrl = checked.value ? buildWhatsAppUrl(checked.value) : null;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const touch = (field: Field) => setTouched((current) => ({ ...current, [field]: true }));

  const goToReview = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ eventDate: true, childName: true, message: true });
    if (checked.ok) setStep('review');
  };

  // Abre o WhatsApp no próprio toque (sem espera de rede o navegador não bloqueia); a tela final repete o botão por segurança.
  const confirm = () => {
    if (!whatsappUrl) return;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    setStep('done');
  };

  const titleId = `${uid}-title`;
  const summary = checked.value ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-h-[94dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0B1424] p-5 text-white shadow-2xl outline-none sm:rounded-3xl sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-xl font-black leading-tight">
            {step === 'form' && 'Solicitar áudio do Herói da Cidade'}
            {step === 'review' && 'Confira antes de continuar'}
            {step === 'done' && 'Falta enviar a mensagem'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {step === 'form' && (
          <form onSubmit={goToReview} noValidate className="space-y-4">
            <div>
              <label htmlFor={`${uid}-date`} className="mb-1.5 block text-sm font-semibold text-white/85">Data do evento</label>
              <input
                id={`${uid}-date`}
                type="date"
                required
                min="2020-01-01"
                max={todayKey}
                value={eventDate}
                onChange={(event) => setEventDate(event.target.value)}
                onBlur={() => touch('eventDate')}
                aria-invalid={Boolean(visibleError('eventDate'))}
                aria-describedby={`${uid}-date-error`}
                className={`${inputClass} [color-scheme:dark]`}
              />
              <FieldError id={`${uid}-date-error`} message={visibleError('eventDate')} />
            </div>

            <div>
              <label htmlFor={`${uid}-name`} className="mb-1.5 block text-sm font-semibold text-white/85">Nome da criança</label>
              <input
                id={`${uid}-name`}
                type="text"
                required
                autoComplete="off"
                maxLength={AUDIO_NAME_MAX}
                value={childName}
                onChange={(event) => setChildName(event.target.value)}
                onBlur={() => touch('childName')}
                aria-invalid={Boolean(visibleError('childName'))}
                aria-describedby={`${uid}-name-error`}
                placeholder="Ex.: Maria Eduarda"
                className={inputClass}
              />
              <FieldError id={`${uid}-name-error`} message={visibleError('childName')} />
            </div>

            <div>
              <label htmlFor={`${uid}-message`} className="mb-1.5 block text-sm font-semibold text-white/85">O que você gostaria que o Herói da Cidade falasse no áudio?</label>
              <textarea
                id={`${uid}-message`}
                required
                rows={5}
                maxLength={AUDIO_MESSAGE_MAX}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onBlur={() => touch('message')}
                aria-invalid={Boolean(visibleError('message'))}
                aria-describedby={`${uid}-message-hint ${uid}-message-error`}
                placeholder="Conte o que você gostaria que o Homem-Aranha falasse para a criança. Pode ser uma mensagem de incentivo, uma lembrança da festa, uma conquista ou algum recado especial."
                className={`${inputClass} resize-y`}
              />
              <div className="mt-1.5 flex justify-between gap-3 text-xs text-white/50">
                <span id={`${uid}-message-hint`}>Inclua o que quiser que seja mencionado.</span>
                <span aria-live="polite">{message.length}/{AUDIO_MESSAGE_MAX}</span>
              </div>
              <FieldError id={`${uid}-message-error`} message={visibleError('message')} />
            </div>

            <Notice />

            <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-white/90">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 accent-purple-500"
              />
              <span>Li e concordo com as condições da solicitação de áudio.</span>
            </label>

            <button type="submit" disabled={!checked.ok} className={primaryButton}>Revisar solicitação</button>
          </form>
        )}

        {step === 'review' && summary && (
          <div className="space-y-4">
            <dl className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm">
              <div><dt className={termClass}>Data do evento</dt><dd className="mt-0.5 text-base font-semibold">{formatDateBr(summary.eventDate)}</dd></div>
              <div><dt className={termClass}>Nome da criança</dt><dd className="mt-0.5 text-base font-semibold">{summary.childName}</dd></div>
              <div><dt className={termClass}>Mensagem para o áudio</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-base">{summary.message}</dd></div>
            </dl>
            <Notice />
            <p className="text-sm leading-relaxed text-white/70">Ao continuar, vamos abrir o WhatsApp com a mensagem pronta. Você ainda precisa tocar em enviar por lá.</p>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={confirm} className={primaryButton}>
                <MessageCircle className="h-5 w-5" aria-hidden />
                Confirmar e continuar pelo WhatsApp
              </button>
              <button type="button" onClick={() => setStep('form')} className={secondaryButton}>Voltar e corrigir</button>
            </div>
          </div>
        )}

        {step === 'done' && whatsappUrl && (
          <div className="space-y-4">
            <p className="text-base leading-relaxed text-white/90">
              Abrimos o WhatsApp com a mensagem pronta. <strong>Falta um passo:</strong> toque em enviar por lá. O pedido só chega ao Herói da Cidade depois que você enviar.
            </p>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={primaryButton}>
              <MessageCircle className="h-5 w-5" aria-hidden />
              Abrir WhatsApp novamente
            </a>
            <button type="button" onClick={onClose} className={secondaryButton}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
};
