import React from 'react';
import { Loader2, Save } from 'lucide-react';

interface SeoSectionProps {
  seoTitle: string;
  seoDescription: string;
  savingSeo: boolean;
  initializing: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export const SeoSection: React.FC<SeoSectionProps> = ({ seoTitle, seoDescription, savingSeo, initializing, onTitleChange, onDescriptionChange, onSubmit }) => (
  <section className="rounded-2xl border border-white/10 bg-[#0D1527] p-4 shadow-xl sm:p-6">
      <div className="mb-5"><h2 className="text-lg font-bold text-white">SEO da página inicial</h2><p className="mt-1 text-xs text-white/50">Canonical, robots, sitemap e dados estruturados continuam controlados pelo código.</p></div>
      <form onSubmit={onSubmit} className="space-y-4">
        <div><label htmlFor="home-seo-title" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">SEO Title</label><input id="home-seo-title" value={seoTitle} maxLength={70} onChange={(event) => onTitleChange(event.target.value)} className="w-full rounded-xl border border-white/10 bg-[#070B14] px-4 py-3 text-sm text-white outline-none focus:border-blue-500" /><p className="mt-1 text-right text-xs text-white/40">{seoTitle.length}/70</p></div>
        <div><label htmlFor="home-seo-description" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/70">Meta Description</label><textarea id="home-seo-description" value={seoDescription} maxLength={200} rows={3} onChange={(event) => onDescriptionChange(event.target.value)} className="w-full resize-y rounded-xl border border-white/10 bg-[#070B14] px-4 py-3 text-sm leading-relaxed text-white outline-none focus:border-blue-500" /><p className="mt-1 text-right text-xs text-white/40">{seoDescription.length}/200</p></div>
        <button type="submit" disabled={savingSeo || initializing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">{savingSeo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Salvar SEO</button>
      </form>
  </section>
);
