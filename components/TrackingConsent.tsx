import React, { useEffect, useState } from 'react';
import { Link, useRouter } from '../lib/router';
import { CONSENT_KEY, GA_MEASUREMENT_ID, META_PIXEL_ID, isTrackablePath, isWhatsAppHref } from '../services/tracking.js';
import { PRIVACY_PATH } from '../services/privacy.js';

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue: unknown[][]; loaded: boolean; version: string; push: unknown };
type TrackingWindow = Window & { fbq?: Fbq; _fbq?: Fbq; gtag?: (...args: unknown[]) => void; dataLayer?: unknown[] };

const readConsent = (): string | null => {
  try { return localStorage.getItem(CONSENT_KEY); } catch { return null; }
};
const writeConsent = (value: 'granted' | 'denied') => {
  try { localStorage.setItem(CONSENT_KEY, value); } catch { /* sem armazenamento: a escolha vale só nesta visita */ }
};

const addScript = (src: string) => {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
};

function loadGoogle(w: TrackingWindow) {
  addScript(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
  w.dataLayer = w.dataLayer || [];
  w.gtag = function gtag(...args: unknown[]) { (w.dataLayer as unknown[]).push(args); };
  w.gtag('js', new Date());
  w.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false, anonymize_ip: true });
}

function loadMeta(w: TrackingWindow) {
  const fbq = function (...args: unknown[]) { if (fbq.callMethod) fbq.callMethod(...args); else fbq.queue.push(args); } as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.push = fbq;
  w.fbq = fbq;
  w._fbq = fbq;
  addScript('https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', META_PIXEL_ID);
}

let loaded = false;
// Carrega GA4 e pixel do Meta uma única vez, só depois do "Aceitar". Sem dados do formulário: só visita e clique no WhatsApp.
function loadTrackers() {
  if (loaded) return;
  loaded = true;
  loadGoogle(window as TrackingWindow);
  loadMeta(window as TrackingWindow);
}

function pageView(path: string) {
  const w = window as TrackingWindow;
  w.fbq?.('track', 'PageView');
  w.gtag?.('event', 'page_view', { page_path: path, page_location: window.location.href, page_title: document.title });
}

/** Aviso de cookies + carregamento do pixel do Meta e do Google Analytics (LGPD: só depois do "Aceitar", só em páginas de divulgação). */
export const TrackingConsent: React.FC = () => {
  const { path } = useRouter();
  const [consent, setConsent] = useState<string | null>(readConsent);
  const trackable = isTrackablePath(path);

  useEffect(() => {
    if (consent !== 'granted' || !trackable) return;
    loadTrackers();
    pageView(path);
  }, [consent, trackable, path]);

  useEffect(() => {
    if (consent !== 'granted' || !trackable) return;
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('a');
      if (!link || !isWhatsAppHref(link.getAttribute('href'))) return;
      const w = window as TrackingWindow;
      w.fbq?.('track', 'Contact');
      w.gtag?.('event', 'generate_lead', { method: 'whatsapp', page_path: path });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [consent, trackable, path]);

  if (!trackable || consent) return null;

  const choose = (value: 'granted' | 'denied') => {
    writeConsent(value);
    setConsent(value);
  };

  return (
    <div role="dialog" aria-label="Aviso de cookies" className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-xl rounded-2xl border border-white/15 bg-[#0B1929]/95 p-4 text-sm text-white shadow-2xl backdrop-blur">
      <p className="leading-relaxed text-white/80">
        Usamos cookies para medir as visitas e os cliques no WhatsApp e mostrar nossos anúncios a quem já nos conhece. Não usamos os dados dos formulários.{' '}
        <Link href={PRIVACY_PATH} className="font-semibold text-blue-300 underline">Saiba mais</Link>.
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => choose('granted')} className="flex-1 rounded-xl bg-[#0072d2] px-4 py-2.5 font-bold text-white hover:bg-blue-500">Aceitar</button>
        <button type="button" onClick={() => choose('denied')} className="flex-1 rounded-xl border border-white/20 px-4 py-2.5 font-semibold text-white/85 hover:bg-white/10">Recusar</button>
      </div>
    </div>
  );
};
