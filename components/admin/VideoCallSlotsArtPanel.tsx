import React, { useEffect, useState } from 'react';
import { Download, Image as ImageIcon, Loader2, Share2 } from 'lucide-react';
import { ErrorNote, cardClass, ghostButton } from './missionsUi';
import { SLOTS_COUNT, renderSlotsArt } from './videoCallSlotsArt';

type Preview = { file: File; url: string };

/** Atalho semanal: gera o Story com os próximos 6 horários livres, mostra a prévia e deixa baixar/salvar na galeria. */
export const VideoCallSlotsArtPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const generate = async () => {
    setOpen(true);
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const response = await fetch('/api/video-call');
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) throw new Error(data?.error?.message || 'Não foi possível carregar os horários.');
      const slots = (data.days as { date: string; times: string[] }[]).flatMap((d) => d.times.map((time) => ({ date: d.date, time }))).slice(0, SLOTS_COUNT);
      if (!slots.length) throw new Error('Não há horários livres agora.');
      const blob = await renderSlotsArt({ slots, priceLabel: data.config.priceLabel, durationMinutes: data.config.durationMinutes });
      setPreview({ file: new File([blob], 'horarios-videochamada.png', { type: 'image/png' }), url: URL.createObjectURL(blob) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível gerar a arte.');
    } finally {
      setLoading(false);
    }
  };

  const canShare = !!preview && typeof navigator.canShare === 'function' && navigator.canShare({ files: [preview.file] });
  const share = async () => {
    if (!preview) return;
    try { await navigator.share({ files: [preview.file], title: 'Horários da Vídeo Chamada' }); } catch { /* o usuário fechou a janela de compartilhar */ }
  };

  return (
    <div className={`${cardClass} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-white/40">Story da semana</p>
          <p className="text-sm text-white/80">Imagem com os próximos {SLOTS_COUNT} horários livres.</p>
        </div>
        <button type="button" onClick={() => void generate()} disabled={loading} className={ghostButton}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}{open ? 'Gerar de novo' : 'Gerar imagem dos horários'}
        </button>
      </div>
      {open && (
        <div className="mx-auto w-full max-w-[220px] space-y-2">
          <div className="flex aspect-[9/16] items-center justify-center overflow-hidden rounded-lg bg-black/40">
            {loading && <Loader2 className="h-5 w-5 animate-spin text-white/50" />}
            {preview && <img src={preview.url} alt="Prévia do Story com os horários" className="h-full w-full object-contain" />}
          </div>
          <ErrorNote message={error} />
          {preview && (
            <div className="grid gap-2">
              {canShare && <button type="button" onClick={() => void share()} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-500"><Share2 className="h-4 w-4" />Salvar na galeria</button>}
              <a href={preview.url} download={preview.file.name} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-3 py-2.5 text-sm font-bold text-white hover:bg-white/20"><Download className="h-4 w-4" />Baixar PNG</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
