import React, { useEffect, useRef, useState } from 'react';

// Cloudflare Turnstile no agendamento público. Desligado enquanto VITE_TURNSTILE_SITE_KEY não existir (nada é carregado nem exibido).
declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

/** Chave pública do site (pode ficar no navegador). Vazia = recurso desligado. */
export const TURNSTILE_SITE_KEY: string = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? '';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptPromise = null; reject(new Error('turnstile')); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface Props {
  /** Recebe o token (ou '' quando expira ou dá erro). */
  onToken: (token: string) => void;
  /** Mude este número para pedir um desafio novo (o token vale uma única vez). */
  resetKey?: number;
}

export const TurnstileWidget: React.FC<Props> = ({ onToken, resetKey = 0 }) => {
  const box = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const onTokenRef = useRef(onToken);
  onTokenRef.current = onToken;
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !box.current) return undefined;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current || !window.turnstile) return;
      widgetId.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        language: 'pt-br',
        theme: 'dark',
        callback: (token: string) => onTokenRef.current(token),
        'expired-callback': () => onTokenRef.current(''),
        'error-callback': () => onTokenRef.current(''),
      });
    }).catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current && window.turnstile) {
      onTokenRef.current('');
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  if (loadFailed) {
    return <p role="alert" className="text-xs font-semibold text-amber-200">Não foi possível carregar a verificação de segurança. Desative bloqueadores de anúncio ou fale com a gente pelo WhatsApp.</p>;
  }
  return <div ref={box} className="min-h-[65px]" aria-label="Verificação de segurança" />;
};
