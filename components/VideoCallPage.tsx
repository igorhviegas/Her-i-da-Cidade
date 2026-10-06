import React, { useState } from 'react';
import { BadgeCheck, Lock, MessageCircle } from 'lucide-react';
import { Link } from '../lib/router';
import { useSiteConfig } from '../services/siteConfigService';
import { VideoCallBooking, renderBold, type PublicConfig } from './VideoCallBooking';

const INSTAGRAM_URL = 'https://www.instagram.com/oheroidacidade/';

/** "+55 (31) 99904-4206" a partir do link wa.me configurado; null se o link não trouxer um número brasileiro. */
function phoneLabel(whatsappUrl: string): string | null {
  const match = /(?:wa\.me\/|phone=)(55\d{10,11})\b/.exec(whatsappUrl);
  if (!match) return null;
  const digits = match[1];
  const local = digits.slice(4);
  return `+55 (${digits.slice(2, 4)}) ${local.slice(0, local.length - 4)}-${local.slice(-4)}`;
}

/**
 * Página pública /agendar-chamada (link divulgado no WhatsApp e no Instagram). Quem chega aqui não passou pela home, então a
 * página se identifica: marca no topo e, no rodapé, os canais oficiais para o cliente conferir que é o Herói da Cidade.
 * Tudo discreto, para o foco continuar no agendamento.
 */
export const VideoCallPage: React.FC = () => {
  const { whatsappUrl } = useSiteConfig();
  const phone = phoneLabel(whatsappUrl);
  // O aviso de segurança é editável no admin e chega junto com os horários; enquanto não chega (ou se falhar), não aparece.
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const channel = 'flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white';

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-[#0B1929] px-4 pb-10 pt-5 text-white">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 flex justify-center">
          <Link href="/" aria-label="Herói da Cidade: ir para o site" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#0072d2] shadow-lg shadow-blue-600/30">
              <img src="/images/spider.PNG" alt="" className="h-7 w-7 object-contain" />
            </span>
            <span className="text-base font-bold tracking-tight text-white">Herói da Cidade</span>
          </Link>
        </header>

        <h1 className="mb-5 text-center text-2xl font-extrabold uppercase italic leading-tight tracking-tighter sm:text-3xl">Agende sua Vídeo Chamada</h1>
        <VideoCallBooking onConfig={setConfig} />

        {config?.texts.security && (
          <p className="mt-4 whitespace-pre-line px-2 text-center text-[11px] leading-relaxed text-white/40">
            <Lock className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
            {renderBold(config.texts.security)}
          </p>
        )}

        <footer className="mt-8 border-t border-white/10 pt-5">
          <p className="mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] text-white/40">Nossos canais oficiais</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={channel}>
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              @oheroidacidade
              <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Perfil verificado" />
            </a>
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={channel}>
              <MessageCircle className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden />
              {phone ?? 'WhatsApp oficial'}
            </a>
          </div>
          <p className="mt-4 text-center text-[11px] text-white/30">© Herói da Cidade · <Link href="/" className="underline hover:text-white/60">heroidacidade.com</Link></p>
        </footer>
      </div>
    </main>
  );
};
