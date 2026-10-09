import React, { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { PdfImportError, readPdfText } from '../../services/pdfImportBrowser';
import { ageOn, parseGoogleEventForm } from '../../services/eventFormImport.js';
import type { ParsedEventForm } from '../../services/eventFormImport.js';
import { VIDEO_KINDS, type VideoAddons } from '../../services/eventVideos.js';
import type { EventFormState } from './EventOrderFields';

export type { VideoAddons };
export const emptyVideoAddons = (): VideoAddons => ({ birthday: false, birthdayName: '', invite: false, inviteName: '', inviteAge: '', inviteTime: '', inviteDetails: '' });

const inputClass = 'mt-1.5 w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/60 disabled:opacity-50';
const labelClass = 'block text-xs font-semibold text-white/70';

/** Aplica o que o parser reconheceu sem apagar o que já foi digitado (campo não reconhecido mantém o valor atual). */
function applyParsed(parsed: ParsedEventForm, event: EventFormState, addons: VideoAddons): { event: EventFormState; addons: VideoAddons } {
  const { birthdayVideo, inviteVideo } = parsed;
  return {
    event: {
      ...event,
      childName: parsed.childName || event.childName,
      birthDate: parsed.birthDate || event.birthDate || '',
      eventDate: parsed.eventDate || event.eventDate,
      eventTime: parsed.eventTime || event.eventTime,
      location: parsed.location || event.location,
    },
    addons: {
      ...addons,
      ...(birthdayVideo ? { birthday: true, birthdayName: birthdayVideo.firstName } : {}),
      ...(inviteVideo ? { invite: true, inviteName: inviteVideo.name, inviteAge: inviteVideo.age || ageOn(parsed.birthDate, parsed.eventDate), inviteTime: inviteVideo.time, inviteDetails: inviteVideo.details } : {}),
    },
  };
}

interface ImportProps {
  event: EventFormState;
  addons: VideoAddons;
  /** Só no Novo pedido: preenche o nome do cliente (se vazio). Ao editar (ex.: pedido do ManyChat) cliente e WhatsApp nunca mudam. */
  clientName?: string;
  disabled?: boolean;
  onEvent: (next: EventFormState) => void;
  onAddons: (next: VideoAddons) => void;
  onClientName?: (name: string) => void;
}

/**
 * Importa o PDF do "Formulário da Missão" e preenche o que reconhece (nada é criado aqui; o usuário revisa e clica em Criar).
 * Tipo do evento, PCD, autorização de imagem e teias extras são opções marcadas no PDF (não viram texto): seguem manuais.
 */
export const ImportFormButton: React.FC<ImportProps> = ({ event, addons, clientName, disabled, onEvent, onAddons, onClientName }) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setMessage(null);
    try {
      const parsed = parseGoogleEventForm(await readPdfText(file));
      if (!parsed) throw new PdfImportError('invalid_pdf', 'Este PDF não parece ser o "Formulário da Missão".');
      const next = applyParsed(parsed, event, addons);
      onEvent(next.event);
      onAddons(next.addons);
      if (onClientName && !clientName?.trim() && parsed.responsible) onClientName(parsed.responsible);
      setMessage({ ok: true, text: 'Dados importados. Confira e complete: WhatsApp, #formulário, autorização de imagem, PCD, teia extra e valores.' });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof PdfImportError ? error.message : 'Não foi possível ler o PDF. Preencha manualmente.' });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-1.5">
      <input ref={input} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file); }} />
      <button type="button" onClick={() => input.current?.click()} disabled={disabled || busy} className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-600/10 px-3 py-2 text-xs font-bold text-blue-200 hover:bg-blue-600/20 disabled:opacity-50">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />}{busy ? 'Lendo PDF…' : 'Importar formulário (PDF)'}
      </button>
      {message && <p role={message.ok ? 'status' : 'alert'} className={`text-[11px] ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>}
    </div>
  );
};

/** Vídeos contratados com desconto junto do evento: cada um abre um pedido próprio (R$ 0,00; o valor já está no orçamento do evento). */
export const VideoAddonsSection: React.FC<{ value: VideoAddons; onChange: (next: VideoAddons) => void; disabled?: boolean }> = ({ value, onChange, disabled }) => {
  const set = (patch: Partial<VideoAddons>) => onChange({ ...value, ...patch });
  return (
    <section className="space-y-3 border-t border-white/10 pt-4">
      <h3 className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-blue-300">Vídeos com desconto</h3>
      <p className="text-[11px] text-white/45">Cada vídeo marcado abre um pedido próprio no Kanban, sem valor: o preço já está no total do evento.</p>
      <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={value.birthday} onChange={(e) => set({ birthday: e.target.checked })} disabled={disabled} />{VIDEO_KINDS.birthday.label}</label>
      {value.birthday && (
        <label className={labelClass}>Primeiro nome da criança *<input value={value.birthdayName} onChange={(e) => set({ birthdayName: e.target.value })} disabled={disabled} className={inputClass} /></label>
      )}
      <label className="flex items-center gap-2 text-sm text-white"><input type="checkbox" checked={value.invite} onChange={(e) => set({ invite: e.target.checked })} disabled={disabled} />{VIDEO_KINDS.invite.label}</label>
      {value.invite && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className={`${labelClass} sm:col-span-2`}>Nome do aniversariante *<input value={value.inviteName} onChange={(e) => set({ inviteName: e.target.value })} disabled={disabled} className={inputClass} /></label>
          <label className={labelClass}>Idade<input inputMode="numeric" value={value.inviteAge} onChange={(e) => set({ inviteAge: e.target.value.replace(/\D/g, '') })} disabled={disabled} className={inputClass} placeholder="Ex.: 7" /></label>
          <label className={labelClass}>Horário no convite<input type="time" value={value.inviteTime} onChange={(e) => set({ inviteTime: e.target.value })} disabled={disabled} className={inputClass} /></label>
          <label className={`${labelClass} sm:col-span-2`}>Detalhes para o vídeo<input value={value.inviteDetails} onChange={(e) => set({ inviteDetails: e.target.value })} disabled={disabled} className={inputClass} placeholder="Ex.: vir fantasiado" /></label>
          <p className="text-[11px] text-white/45 sm:col-span-3">Data e local vêm do evento. Deixe o horário em branco para usar o início do evento.</p>
        </div>
      )}
    </section>
  );
};
