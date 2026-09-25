import React from 'react';
import { Link } from '../lib/router';
import type { HomeSection } from '../types/homeContent';
import { isSafeContentUrl } from '../services/homeContentService';

interface Props { section: HomeSection }

export const HomeEditorialSection: React.FC<Props> = ({ section }) => {
  const buttonText = section.buttonText?.trim();
  const imageUrl = section.imageUrl && /^https:\/\//i.test(section.imageUrl) ? section.imageUrl : '';
  const buttonUrl = section.buttonUrl && isSafeContentUrl(section.buttonUrl) ? section.buttonUrl : '';
  const button = buttonText && buttonUrl ? (
    buttonUrl.startsWith('/') ? (
      <Link href={buttonUrl} className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500">
        {buttonText}
      </Link>
    ) : (
      <a href={buttonUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500">
        {buttonText}
      </a>
    )
  ) : null;
  const paragraphs = section.description.split(/\n\s*\n/).filter(Boolean);

  if (section.sectionType === 'image-text') {
    return (
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="mx-auto grid max-w-7xl items-center gap-10 md:grid-cols-2">
          {imageUrl && <img src={imageUrl} alt={section.title} loading="lazy" className="aspect-video w-full rounded-2xl border border-white/10 object-cover" />}
          <div className="space-y-5">
            {section.subtitle && <p className="text-xs font-black uppercase tracking-[0.3em] text-blue-400">{section.subtitle}</p>}
            <h2 className="whitespace-pre-line text-3xl font-extrabold text-white sm:text-4xl">{section.title}</h2>
            <div className="space-y-4 whitespace-pre-line leading-relaxed text-white/70">{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
            {button}
          </div>
        </div>
      </section>
    );
  }

  const isPromotional = section.sectionType === 'promotional';
  const isCta = section.sectionType === 'cta';
  const sectionClass = isPromotional
    ? 'border-y border-purple-400/20 bg-gradient-to-r from-purple-950/70 to-[#0B1929]'
    : isCta
      ? 'border-y border-blue-400/20 bg-gradient-to-r from-blue-950/60 to-[#0B1929]'
      : 'bg-[#0B1929]';

  return (
    <section className={`px-4 py-16 sm:py-24 ${sectionClass}`}>
      <div className="mx-auto max-w-4xl text-center">
        {imageUrl && <img src={imageUrl} alt={section.title} loading="lazy" className="mx-auto mb-8 max-h-80 w-full max-w-2xl rounded-2xl border border-white/10 object-cover" />}
        {section.subtitle && <p className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-blue-400">{section.subtitle}</p>}
        <h2 className="whitespace-pre-line text-3xl font-extrabold text-white sm:text-4xl md:text-5xl">{section.title}</h2>
        {paragraphs.map((paragraph, index) => <p key={index} className="mx-auto mt-5 max-w-3xl whitespace-pre-line leading-relaxed text-white/70">{paragraph}</p>)}
        {button && <div className="mt-8">{button}</div>}
      </div>
    </section>
  );
};
