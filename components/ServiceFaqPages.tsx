import React, { useEffect, useMemo } from 'react';
import { ChevronDown, ArrowLeft, MessageCircle } from 'lucide-react';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { Link } from '../lib/router';
import { renderBold } from './VideoCallBooking';
import { useServices } from '../services/servicesService';
import { useSiteConfig, buildWhatsAppLink } from '../services/siteConfigService';
import { slugify, findServiceBySlug } from '../services/serviceFaq.js';
import type { Service } from '../types';

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen disney-gradient selection:bg-blue-500 selection:text-white">
    <Navbar />
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 sm:pt-32">{children}</main>
    <Footer />
  </div>
);

const BackLink: React.FC = () => (
  <Link href="/duvidas" className="mb-6 inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white">
    <ArrowLeft className="h-4 w-4" aria-hidden /> Todas as dúvidas
  </Link>
);

/** Parágrafos separados por linha em branco; **negrito** como nos textos configuráveis do admin. */
const FaqText: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-3 text-sm leading-relaxed text-white/75 sm:text-base">
    {text.split(/\n\s*\n/).map((paragraph, i) => (
      <p key={i} className="whitespace-pre-line">{renderBold(paragraph)}</p>
    ))}
  </div>
);

const Notice: React.FC<{ title: string; text: string }> = ({ title, text }) => (
  <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center sm:p-10">
    <h1 className="text-xl font-extrabold uppercase italic tracking-tighter sm:text-3xl">{title}</h1>
    <p className="mx-auto mt-3 max-w-md text-sm text-white/60">{text}</p>
    <Link href="/duvidas" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 text-xs font-bold uppercase tracking-widest text-white hover:bg-blue-500">
      Ver todas as dúvidas
    </Link>
  </div>
);

const Loading: React.FC = () => <p className="py-20 text-center text-sm text-white/50">Carregando dúvidas...</p>;

/**
 * /duvidas (lista de serviços com dúvidas cadastradas) e /duvidas/{slug} (categorias do serviço).
 * `onResolved` informa ao App o serviço aberto (undefined = carregando, null = inexistente/sem dúvidas) para título e robots.
 */
export const ServiceFaqPages: React.FC<{ slug?: string; onResolved?: (service: Service | null | undefined) => void }> = ({ slug, onResolved }) => {
  const { services, loading } = useServices({ onlyActive: true, realTime: false });
  const { whatsappUrl } = useSiteConfig();
  const withFaq = useMemo(() => services.filter((s) => s.faq?.length), [services]);
  const service = slug ? findServiceBySlug<Service>(services, slug) : null;
  const resolved = loading ? undefined : service?.faq?.length ? service : null;

  useEffect(() => {
    if (slug) onResolved?.(resolved);
  }, [slug, resolved, onResolved]);

  if (loading) return <Shell><Loading /></Shell>;

  if (!slug) {
    return (
      <Shell>
        <h1 className="text-3xl font-extrabold uppercase italic tracking-tighter sm:text-5xl">Dúvidas</h1>
        <p className="mt-3 max-w-xl text-sm text-white/60 sm:text-base">Escolha um serviço para ver as principais dúvidas: pagamento, prazos e como funciona.</p>
        {withFaq.length === 0 ? (
          <p className="mt-10 text-sm text-white/50">Ainda não há dúvidas cadastradas.</p>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {withFaq.map((s) => (
              <li key={s.id}>
                <Link href={`/duvidas/${slugify(s.title)}`} className="group flex min-h-24 items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:border-white/30 hover:bg-white/10">
                  <img src={s.imageUrl} alt="" loading="lazy" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] font-black uppercase tracking-widest text-blue-400">{s.category}</span>
                    <span className="block text-base font-bold leading-tight text-white">{s.title}</span>
                    <span className="mt-1 block text-xs text-white/50">{s.faq.length} {s.faq.length === 1 ? 'categoria' : 'categorias'}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 -rotate-90 text-white/40 group-hover:text-white" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Shell>
    );
  }

  if (!service) {
    return <Shell><Notice title="Serviço não encontrado" text="Não encontramos este serviço. Confira o endereço ou escolha um serviço na lista." /></Shell>;
  }

  if (!service.faq?.length) {
    return <Shell><Notice title={service.title} text="Este serviço ainda não possui dúvidas cadastradas. Fale com a gente pelo WhatsApp." /></Shell>;
  }

  return (
    <Shell>
      <BackLink />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-400">Dúvidas</p>
      <h1 className="mt-1 text-3xl font-extrabold uppercase italic leading-none tracking-tighter sm:text-5xl">{service.title}</h1>
      <div className="mt-8 space-y-3">
        {service.faq.map((item, index) => (
          <details key={item.id} open={index === 0} className="group rounded-2xl border border-white/10 bg-white/5 open:border-white/25">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-base font-bold text-white [&::-webkit-details-marker]:hidden">
              {item.title}
              <ChevronDown className="h-5 w-5 shrink-0 text-white/50 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="px-4 pb-5"><FaqText text={item.content} /></div>
          </details>
        ))}
      </div>
      <a
        href={buildWhatsAppLink(whatsappUrl, 'Preciso de suporte!')}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#25D366] px-5 text-sm font-bold text-black hover:brightness-110"
      >
        <MessageCircle className="h-4 w-4" aria-hidden /> Ainda com dúvida? Fale no WhatsApp
      </a>
    </Shell>
  );
};
