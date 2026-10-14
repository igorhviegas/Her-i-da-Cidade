import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Loader2, RotateCcw, Share2 } from 'lucide-react';
import { parseInviteFields, type InviteArtFields } from '../../../services/inviteArt.js';
import { updateOrder } from '../../../services/ordersService';
import type { Order } from '../../../types';
import { toDate } from './orderView';
import { renderInviteArt } from './inviteArtCanvas';

const FIELDS: { key: keyof InviteArtFields; label: string; placeholder: string }[] = [
  { key: 'name', label: 'Nome', placeholder: 'Yuri' },
  { key: 'age', label: 'Idade', placeholder: '5' },
  { key: 'date', label: 'Data', placeholder: '14 de novembro' },
  { key: 'time', label: 'Horário', placeholder: '15:30' },
  { key: 'place', label: 'Local', placeholder: 'Na casa do Yuri' },
];

const sameFields = (a: InviteArtFields, b: InviteArtFields) => FIELDS.every(({ key }) => a[key] === b[key]);
const fileName = (name: string) => `convite-${name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'arte'}`;

type Preview = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; file: File; url: string };

/** Arte do Vídeo Convite: campos lidos do pedido para conferir/ajustar, prévia no formato Story e botões de baixar. */
export const InviteArtPanel: React.FC<{ order: Order }> = ({ order }) => {
  const [fields, setFields] = useState<InviteArtFields>(() => order.inviteArt ?? parseInviteFields(order, toDate(order.eventDate)));
  const [saved, setSaved] = useState<InviteArtFields | null>(order.inviteArt ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [preview, setPreview] = useState<Preview>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      renderInviteArt(fields).then(
        (blob) => { if (!cancelled) setPreview({ status: 'ready', file: new File([blob], `${fileName(fields.name)}.png`, { type: 'image/png' }), url: URL.createObjectURL(blob) }); },
        (err: unknown) => { if (!cancelled) setPreview({ status: 'error', message: err instanceof Error ? err.message : 'Não foi possível gerar a arte.' }); },
      );
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [fields]);
  useEffect(() => {
    if (preview.status !== 'ready') return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const approve = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await updateOrder(order.id, { inviteArt: fields });
      setSaved(fields);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar os campos.');
    } finally {
      setSaving(false);
    }
  };

  const file = preview.status === 'ready' ? preview.file : null;
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const share = async () => {
    if (!file) return;
    try { await navigator.share({ files: [file], title: 'Arte do convite' }); } catch { /* o usuário fechou a janela de compartilhar */ }
  };
  const approved = saved !== null && sameFields(saved, fields);

  return (
    <section aria-labelledby="invite-art-title" className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="invite-art-title" className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/40">Arte do convite (Story)</h3>
        {approved
          ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" />Aprovada</span>
          : <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">{saved ? 'Ajustes não salvos' : 'Leitura automática: confira'}</span>}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
        <div className="space-y-2.5">
          {FIELDS.map(({ key, label, placeholder }) => (
            <label key={key} className="block text-[11px] font-semibold text-white/55">
              {label}{!fields[key].trim() && <span className="ml-1 text-amber-300">(não encontrado no pedido)</span>}
              <input
                value={fields[key]}
                onChange={(e) => setFields((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={placeholder}
                className={`mt-1 w-full rounded-lg border bg-[#070B14] px-3 py-2 text-sm text-white outline-none focus:border-blue-400/60 ${fields[key].trim() ? 'border-white/10' : 'border-amber-400/50'}`}
              />
            </label>
          ))}
          {saveError && <p role="alert" className="text-xs text-red-300">{saveError}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => void approve()} disabled={saving || approved} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/20 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{saved ? 'Salvar ajustes' : 'Aprovar campos'}
            </button>
            <button type="button" onClick={() => setFields(parseInviteFields(order, toDate(order.eventDate)))} title="Ler os campos de novo a partir do texto do pedido" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold text-white/60 hover:bg-white/5">
              <RotateCcw className="h-4 w-4" />Ler do pedido
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex aspect-[9/16] items-center justify-center overflow-hidden rounded-lg bg-black/40">
            {preview.status === 'loading' && <Loader2 className="h-5 w-5 animate-spin text-white/50" />}
            {preview.status === 'error' && <p className="px-3 text-center text-xs text-red-300">{preview.message}</p>}
            {preview.status === 'ready' && <img src={preview.url} alt="Prévia da arte do convite" className="h-full w-full object-contain" />}
          </div>
          {preview.status === 'ready' && (
            <div className="grid gap-2">
              {canShare && <button type="button" onClick={() => void share()} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-500"><Share2 className="h-4 w-4" />Salvar na galeria</button>}
              <a href={preview.url} download={preview.file.name} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold text-white hover:bg-white/20"><Download className="h-4 w-4" />Baixar PNG</a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
