import React, { useEffect, useState } from 'react';
import { AlertTriangle, ExternalLink, Loader2, MapPin, Pencil, Trash2, X } from 'lucide-react';
import { deleteCalendarEvent, saveCalendarEvent, type CalendarEvent } from '../../../services/calendarService';
import { ErrorNote, WarningNote, ghostButton, inputClass, labelClass, primaryButton } from '../missionsUi';
import { fmt } from './CalendarViews';

const initialEventSchedule = (event: CalendarEvent | null, defaultDate: string) => ({
  title: event?.title ?? '', date: event?.startKey ?? defaultDate, allDay: event?.allDay ?? false,
  startTime: event?.startTime ?? '09:00', endTime: event?.endTime ?? '10:00',
});

const initialEventForm = (event: CalendarEvent | null, defaultDate: string) => ({
  ...initialEventSchedule(event, defaultDate),
  location: event?.location ?? '', description: event?.description ?? '',
});

type EventFormValues = ReturnType<typeof initialEventForm>;
type Busy = 'save' | 'delete' | null;

interface EventDetailsProps {
  event: CalendarEvent;
  multiDay: boolean;
  busy: Busy;
  error: string | null;
  onMode: (mode: 'view' | 'form') => void;
  onRemove: () => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ event, multiDay, busy, error, onMode, onRemove }) => (
  <div className="space-y-3 text-sm">
    <p className="text-white/80"><span className="capitalize">{fmt(event.startKey, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>{event.endKey !== event.startKey && ` → ${fmt(event.endKey, { day: 'numeric', month: 'long' })}`}</p>
    <p className="font-semibold tabular-nums text-orange-300">{event.allDay ? 'Dia inteiro' : `${event.startTime} – ${event.endTime}`}</p>
    {event.location && <p className="flex items-start gap-2 text-white/70"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{event.location}</p>}
    {event.description && <p className="whitespace-pre-line break-words rounded-xl bg-black/20 p-3 text-xs text-white/70">{event.description}</p>}
    {event.crm && (
      <p className="flex items-start gap-2 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Evento de um pedido do Kanban. As alterações feitas aqui não voltam para o pedido, e reenviar o pedido ao Google Agenda sobrescreve este evento. Excluir mantém o pedido.
      </p>
    )}
    {multiDay && <p className="text-xs text-white/40">Evento de vários dias: para editar, use o Google Agenda.</p>}
    <ErrorNote message={error} />
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      {event.htmlLink ? <a href={event.htmlLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"><ExternalLink className="h-3.5 w-3.5" aria-hidden />Abrir no Google Agenda</a> : <span />}
      <div className="flex gap-2">
        <button type="button" onClick={onRemove} disabled={!!busy} className={`${ghostButton} hover:!bg-red-500/20 hover:!text-red-300`}>{busy === 'delete' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}Excluir</button>
        <button type="button" onClick={() => onMode('form')} disabled={!!busy || multiDay} className={primaryButton}><Pencil className="h-4 w-4" />Editar</button>
      </div>
    </div>
  </div>
);

interface EventFormProps {
  event: CalendarEvent | null;
  form: EventFormValues;
  set: <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => void;
  busy: Busy;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const EventForm: React.FC<EventFormProps> = ({ event, form, set, busy, error, onSubmit, onCancel }) => (
  <form onSubmit={onSubmit} className="space-y-3">
    <label className={labelClass}>Título<input value={form.title} onChange={(e) => set('title', e.target.value)} maxLength={250} required className={inputClass} /></label>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={labelClass}>Data<input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required className={inputClass} /></label>
      <label className="mt-6 flex items-center gap-2 text-xs font-semibold text-white/70"><input type="checkbox" checked={form.allDay} onChange={(e) => set('allDay', e.target.checked)} />Dia inteiro</label>
    </div>
    {!form.allDay && (
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>Início<input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required className={inputClass} /></label>
        <label className={labelClass}>Término<input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} required className={inputClass} /></label>
      </div>
    )}
    <label className={labelClass}>Local (opcional)<input value={form.location} onChange={(e) => set('location', e.target.value)} maxLength={1024} className={inputClass} /></label>
    <label className={labelClass}>Descrição (opcional)<textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} maxLength={8000} className={inputClass} /></label>
    {event?.crm && <WarningNote message="Evento de pedido do Kanban: a edição vale só na agenda e não atualiza o pedido." />}
    <ErrorNote message={error} />
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} disabled={!!busy} className={ghostButton}>Cancelar</button>
      <button type="submit" disabled={!!busy} className={primaryButton}>{busy === 'save' && <Loader2 className="h-4 w-4 animate-spin" />}{event ? 'Salvar' : 'Criar evento'}</button>
    </div>
  </form>
);

interface EventDialogProps {
  event: CalendarEvent | null; mode: 'view' | 'form'; defaultDate: string;
  onMode: (mode: 'view' | 'form') => void; onClose: () => void; onSaved: (event: CalendarEvent) => void; onDeleted: () => void;
}

export const EventDialog: React.FC<EventDialogProps> = ({ event, mode, defaultDate, onMode, onClose, onSaved, onDeleted }) => {
  const multiDay = !!event && event.startKey !== event.endKey;
  const [form, setForm] = useState(() => initialEventForm(event, defaultDate));
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('save'); setError(null);
    try { onSaved(await saveCalendarEvent(form, event?.id)); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); setBusy(null); }
  };
  const remove = async () => {
    if (!event || !confirm(`Excluir o evento "${event.title}" do Google Agenda?${event.crm ? '\n\nO pedido no Kanban será mantido.' : ''}`)) return;
    setBusy('delete'); setError(null);
    try { await deleteCalendarEvent(event.id); onDeleted(); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível excluir.'); setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={mode === 'form' ? (event ? 'Editar evento' : 'Novo evento') : 'Detalhes do evento'} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-[#0D1527] p-5 shadow-2xl sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-white">{mode === 'form' ? (event ? 'Editar evento' : 'Novo evento') : event?.title}</h3>
          <button type="button" onClick={onClose} disabled={!!busy} aria-label="Fechar" className="rounded-lg p-1 text-white/50 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>

        {mode === 'view' && event ? (
          <EventDetails event={event} multiDay={multiDay} busy={busy} error={error} onMode={onMode} onRemove={remove} />
        ) : (
          <EventForm event={event} form={form} set={set} busy={busy} error={error} onSubmit={save} onCancel={() => (event ? onMode('view') : onClose())} />
        )}
      </div>
    </div>
  );
};
