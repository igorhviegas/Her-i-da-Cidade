import React from 'react';
import { useSiteConfig, buildWhatsAppLink } from '../services/siteConfigService';
import type { HomeSection } from '../types/homeContent';

export const About: React.FC<{ section: HomeSection }> = ({ section }) => {
  const titleLines = section.title.split(/\r?\n/);
  const { whatsappUrl } = useSiteConfig();
  const whatsappUrlFormatted = buildWhatsAppLink(
    whatsappUrl,
    "Olá, Gostaria de saber mais sobre os serviços do Heroi da Cidade"
  );
  const youtubeShortsUrl = "https://youtube.com/shorts/0uohQKcVu6M?si=EFfoOHr_Dz6BS7u-";

  return (
    <section id="about" className="py-24 bg-gradient-to-b from-[#0B1929] to-black border-y border-white/5">
      <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-16 items-center">
        <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-blue-900/10 group">
          <img 
            src={section.imageUrl || "https://disciplinary-peach-obfj8i7gqu.edgeone.app/profissional%201.jpeg"}
            alt={section.title || "Homem-Aranha em apresentação ao vivo"}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/20">
            <a 
              href={youtubeShortsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-20 h-20 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              <svg fill="currentColor" className="w-8 h-8 ml-1" viewBox="0 0 16 16">
                <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h2 className="text-sm font-black text-blue-400 uppercase tracking-[0.3em] mb-4">{section.subtitle}</h2>
          <h3 className="text-4xl font-extrabold uppercase italic tracking-tighter mb-8 leading-none">{titleLines.map((line, index) => <React.Fragment key={index}>{index > 0 && <br />}<span className={index > 0 ? "text-white/40" : undefined}>{line}</span></React.Fragment>)}</h3>
          <div className="space-y-6 text-white/70 leading-relaxed font-light">
            {section.description.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => (
              <p key={index}>
                {index === 0 && paragraph.startsWith('O Herói da Cidade') ? <>O <strong>Herói da Cidade</strong>{paragraph.slice('O Herói da Cidade'.length)}</> : paragraph}
              </p>
            ))}
            <ul className="grid grid-cols-2 gap-4 pt-4 text-white font-bold uppercase text-xs tracking-widest">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" /> Atuação Profissional
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-400" /> Vídeos exclusivos
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500" /> Entrega Rápida
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" /> Máxima qualidade
              </li>
            </ul>
          </div>
          <div className="mt-10">
            <a 
              href={whatsappUrlFormatted} 
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-lg font-bold hover:shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all active:scale-95 text-white"
            >
              {section.buttonText || "Fale com nossa equipe"}
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
