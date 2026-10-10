import React, { useEffect, useState } from 'react';
import { Download, Loader2, Share2, X } from 'lucide-react';
import type { StorySpec } from '../../services/kartShare.js';
import { renderStory } from './kartStoryCanvas';

interface Props {
  /** Monta o conteúdo no momento do clique (assim usa sempre os dados atuais da tela). */
  build: () => StorySpec;
  /** Nome do arquivo, sem extensão. */
  fileName: string;
  /** Texto para leitores de tela e título da janela. */
  label: string;
  className?: string;
  /** Texto ao lado do ícone (padrão: só o ícone). */
  text?: string;
}

/** Ícone de compartilhar: gera a imagem no formato Story (1080x1920), mostra a prévia e oferece compartilhar ou baixar. */
export const ShareImageButton: React.FC<Props> = ({ build, fileName, label, text, className = 'flex h-9 w-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white' }) => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; blob: Blob; url: string }>({ status: 'loading' });

  const start = () => {
    setOpen(true);
    setState({ status: 'loading' });
    renderStory(build()).then(
      (blob) => setState({ status: 'ready', blob, url: URL.createObjectURL(blob) }),
      (err: unknown) => setState({ status: 'error', message: err instanceof Error ? err.message : 'Não foi possível gerar a imagem.' }),
    );
  };
  const close = () => setOpen(false);

  useEffect(() => {
    if (state.status !== 'ready') return;
    return () => URL.revokeObjectURL(state.url);
  }, [state]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const file = state.status === 'ready' ? new File([state.blob], `${fileName}.png`, { type: 'image/png' }) : null;
  const canShare = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const share = async () => {
    if (!file) return;
    try { await navigator.share({ files: [file], title: label }); } catch { /* o usuário fechou a janela de compartilhar */ }
  };

  return (
    <>
      <button type="button" onClick={start} aria-label={label} title={label} className={className}><Share2 className="h-5 w-5" />{text}</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 sm:items-center" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()} className="flex max-h-[94vh] w-full max-w-sm flex-col rounded-t-3xl border border-white/10 bg-[#0D1527] p-4 shadow-2xl sm:rounded-3xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-base font-black italic">Imagem para o Story</h2>
              <button type="button" autoFocus onClick={close} aria-label="Fechar" className="rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-black/40">
              {state.status === 'loading' && <p className="flex items-center gap-2 py-24 text-sm text-white/60"><Loader2 className="h-5 w-5 animate-spin" />Gerando a imagem…</p>}
              {state.status === 'error' && <p className="px-4 py-16 text-center text-sm text-red-300">{state.message}</p>}
              {state.status === 'ready' && <img src={state.url} alt="Prévia da imagem para o Story" className="max-h-[62vh] w-auto rounded-lg object-contain" />}
            </div>
            {state.status === 'ready' && (
              <div className="mt-3 grid gap-2">
                {canShare && <button type="button" onClick={share} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-black uppercase tracking-wide text-white hover:bg-red-500"><Share2 className="h-4 w-4" />Compartilhar</button>}
                <a href={state.url} download={`${fileName}.png`} className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/20"><Download className="h-4 w-4" />Baixar imagem</a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
