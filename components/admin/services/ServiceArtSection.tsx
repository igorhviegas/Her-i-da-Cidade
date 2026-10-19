import React, { useEffect, useState } from 'react';
import { Download, ImageUp, Loader2, Upload } from 'lucide-react';
import { ART_BACKGROUND_SETS, ART_FORMATS, backgroundKey, backgroundSetUrls, priceNumber, type ArtFormat, type BackgroundFormat } from '../../../services/serviceArt.js';
import { uploadServiceImageToVercelBlob } from '../../../services/blobUploadService';
import type { ServiceArt } from '../../../types';
import type { ServiceFormData } from './serviceForm';
import { ART_SIZES, renderServiceArt } from './serviceArtCanvas';

const LABELS: Record<ArtFormat, string> = { square: 'Quadrado', story: 'Story', site: 'Site', wide: 'Horizontal' };
const BACKGROUNDS: { key: BackgroundFormat; label: string }[] = [
  { key: 'square', label: 'Quadrado' },
  { key: 'story', label: 'Story e site' },
  { key: 'wide', label: 'Horizontal' },
];
const field = 'w-full px-3.5 py-2.5 bg-[#070B14] border border-white/10 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:border-blue-500';
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'arte';

type Preview = { status: 'loading' } | { status: 'none' } | { status: 'error'; message: string } | { status: 'ready'; blob: Blob; url: string };

interface Props {
  formData: ServiceFormData;
  setFormData: React.Dispatch<React.SetStateAction<ServiceFormData>>;
}

/** Artes do serviço: título, selo, descrição e fundos; o valor vem do preço do serviço. Gera os 4 formatos juntos. */
export const ServiceArtSection: React.FC<Props> = ({ formData, setFormData }) => {
  const art = formData.art;
  const title = art.title ?? formData.title;
  const [previews, setPreviews] = useState<Partial<Record<ArtFormat, Preview>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  const setArt = (patch: Partial<ServiceArt>) => setFormData((prev) => ({ ...prev, art: { ...prev.art, ...patch } }));
  const setBackground = (key: BackgroundFormat, url: string | undefined) =>
    setFormData((prev) => ({ ...prev, art: { ...prev.art, backgrounds: { ...prev.art.backgrounds, [key]: url } } }));

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const input = { title, badge: art.badge ?? '', description: art.description ?? '', price: formData.price, backgrounds: art.backgrounds ?? {} };
    setPreviews(Object.fromEntries(ART_FORMATS.map((f) => [f, { status: 'loading' }])));
    const timer = setTimeout(() => {
      for (const format of ART_FORMATS) {
        renderServiceArt(format, input).then(
          (blob) => {
            if (cancelled) return;
            const url = blob ? URL.createObjectURL(blob) : '';
            if (url) urls.push(url);
            setPreviews((p) => ({ ...p, [format]: blob ? { status: 'ready', blob, url } : { status: 'none' } }));
          },
          (err: unknown) => { if (!cancelled) setPreviews((p) => ({ ...p, [format]: { status: 'error', message: err instanceof Error ? err.message : 'Não foi possível gerar a arte.' } })); },
        );
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, [title, art.badge, art.description, art.backgrounds, formData.price]);

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    setError('');
    try { await task(); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível enviar a imagem.'); } finally { setBusy(null); }
  };
  const uploadBackground = (key: BackgroundFormat, file: File | undefined) => {
    if (file) void run(key, async () => setBackground(key, await uploadServiceImageToVercelBlob(file)));
  };
  const site = previews.site;
  const useSiteAsImage = () => {
    if (site?.status !== 'ready') return;
    void run('site', async () => {
      const imageUrl = await uploadServiceImageToVercelBlob(new File([site.blob], `${slug(title)}-site.jpg`, { type: 'image/jpeg' }));
      setFormData((prev) => ({ ...prev, imageUrl }));
    });
  };
  const downloadAll = () => document.querySelectorAll<HTMLAnchorElement>('[data-art-download]').forEach((a) => a.click());
  const price = priceNumber(formData.price);

  return (
    <section aria-labelledby="service-art-title" className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div>
        <h4 id="service-art-title" className="text-xs font-semibold text-white/80 uppercase tracking-wider">Artes do serviço</h4>
        <p className="mt-1 text-xs text-white/50">
          Quadrado, story, site e horizontal saem juntos. O valor vem do campo Preço {price ? <>(R$ {price})</> : <>(sem &quot;R$&quot; no preço, as artes saem sem valor)</>}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[11px] font-semibold text-white/55">
          Título da arte
          <input value={title} onChange={(e) => setArt({ title: e.target.value })} className={`mt-1 ${field}`} />
        </label>
        <label className="block text-[11px] font-semibold text-white/55">
          Selo (opcional)
          <input value={art.badge ?? ''} onChange={(e) => setArt({ badge: e.target.value })} placeholder="Pronta entrega!" className={`mt-1 ${field}`} />
        </label>
      </div>
      <label className="block text-[11px] font-semibold text-white/55">
        Descrição da arte (quadrado e story)
        <textarea value={art.description ?? ''} onChange={(e) => setArt({ description: e.target.value })} rows={3} placeholder="Um bate-papo **ao vivo** com o Herói da Cidade" className={`mt-1 ${field}`} />
        <span className="mt-1 block font-normal text-white/40">Use **palavra** para negrito. O Enter força a quebra de linha.</span>
      </label>

      <div className="space-y-2">
        <label className="block text-[11px] font-semibold text-white/55">
          Fundos prontos
          <select value="" onChange={(e) => e.target.value && setArt({ backgrounds: backgroundSetUrls(e.target.value) })} className={`mt-1 ${field}`}>
            <option value="">Escolher um conjunto…</option>
            {ART_BACKGROUND_SETS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <div className="grid gap-2 sm:grid-cols-3">
          {BACKGROUNDS.map(({ key, label }) => {
            const url = art.backgrounds?.[key];
            return (
              <div key={key} className="flex items-center gap-2 rounded-lg border border-white/10 p-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded bg-black/40">
                  {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <ImageUp className="h-4 w-4 text-white/30" />}
                </div>
                <div className="min-w-0 text-[11px]">
                  <p className="font-semibold text-white/70">{label}</p>
                  <label className="inline-flex cursor-pointer items-center gap-1 text-blue-300 hover:text-blue-200">
                    {busy === key ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}{url ? 'Trocar' : 'Enviar'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy !== null} onChange={(e) => { uploadBackground(key, e.target.files?.[0]); e.target.value = ''; }} />
                  </label>
                  {url && <button type="button" onClick={() => setBackground(key, undefined)} className="ml-2 text-white/40 hover:text-white/70">Remover</button>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ART_FORMATS.map((format) => {
          const p = previews[format];
          const { w, h } = ART_SIZES[format];
          return (
            <div key={format} className="space-y-1.5">
              <p className="text-[11px] font-semibold text-white/55">{LABELS[format]}</p>
              <div className="flex items-center justify-center overflow-hidden rounded-lg bg-black/40" style={{ aspectRatio: `${w} / ${h}` }}>
                {(!p || p.status === 'loading') && <Loader2 className="h-4 w-4 animate-spin text-white/50" />}
                {p?.status === 'none' && <p className="px-2 text-center text-[11px] text-white/40">Sem fundo para {backgroundKey(format) === 'story' ? 'story/site' : LABELS[format].toLowerCase()}</p>}
                {p?.status === 'error' && <p className="px-2 text-center text-[11px] text-red-300">{p.message}</p>}
                {p?.status === 'ready' && <img src={p.url} alt={`Prévia da arte ${LABELS[format]}`} className="h-full w-full object-contain" />}
              </div>
              {p?.status === 'ready' && (
                <a data-art-download href={p.url} download={`${slug(title)}-${format}.jpg`} className="flex items-center justify-center gap-1 rounded-lg bg-white/10 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-white/20">
                  <Download className="h-3 w-3" />Baixar
                </a>
              )}
            </div>
          );
        })}
      </div>

      {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={downloadAll} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-xs font-semibold text-white hover:bg-white/20">
          <Download className="h-4 w-4" />Baixar todas
        </button>
        <button type="button" onClick={useSiteAsImage} disabled={site?.status !== 'ready' || busy !== null} className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/20 disabled:opacity-50">
          {busy === 'site' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}Usar a arte "Site" como imagem do serviço
        </button>
      </div>
    </section>
  );
};
