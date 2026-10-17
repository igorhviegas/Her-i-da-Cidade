import React, { useState } from 'react';
import { BadgeCheck, Lock, MessageCircle } from 'lucide-react';
import { Link } from '../lib/router';
import { useSiteConfig } from '../services/siteConfigService';
import { PRIVACY_PATH } from '../services/privacy.js';
import { VideoCallBooking, renderBold, type PublicConfig } from './VideoCallBooking';
import { FormHeader, pageBg, ui, useFormTheme } from './publicSite/eventFormParts';

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
 * Mesmo visual do formulário do evento: tema claro por padrão, escuro lembrado no aparelho.
 */
export const VideoCallPage: React.FC = () => {
  const { whatsappUrl } = useSiteConfig();
  const phone = phoneLabel(whatsappUrl);
  const { theme, toggle, rootClass } = useFormTheme();
  // O aviso de segurança é editável no admin e chega junto com os horários; enquanto não chega (ou se falhar), não aparece.
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const channel = 'flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white';

  return (
    <div className={rootClass}>
      <main className={pageBg}>
        <div className="mx-auto max-w-xl">
          <FormHeader theme={theme} onToggle={toggle} />

          <h1 className="mb-1 text-center text-3xl font-extrabold uppercase italic leading-tight tracking-tighter sm:text-4xl">Agende sua Vídeo Chamada</h1>
          <p className={`mb-5 text-center text-sm ${ui.muted}`}>Uma ligação ao vivo do herói, só para a criança.</p>
          <VideoCallBooking onConfig={setConfig} />

          {config?.texts.security && (
            <p className={`mt-4 whitespace-pre-line px-2 text-center text-[11px] leading-relaxed ${ui.muted}`}>
              <Lock className="mr-1 inline h-3 w-3 align-[-1px]" aria-hidden />
              {renderBold(config.texts.security, 'font-bold text-slate-700 dark:text-white')}
            </p>
          )}

          <footer className="mt-8 border-t border-slate-200 pt-5 dark:border-white/10">
            <p className={`mb-3 text-center text-[11px] font-bold uppercase tracking-[0.2em] ${ui.muted}`}>Nossos canais oficiais</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className={channel}>
                <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
                </svg>
                @oheroidacidade
                <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400" aria-label="Perfil verificado" />
              </a>
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={channel}>
                <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {phone ?? 'WhatsApp oficial'}
              </a>
            </div>
            <p className={`mt-4 text-center text-[11px] ${ui.muted}`}>© Herói da Cidade · <Link href="/" className="underline">heroidacidade.com</Link> · <Link href={PRIVACY_PATH} className="underline">Privacidade</Link></p>
          </footer>
        </div>
      </main>
    </div>
  );
};
