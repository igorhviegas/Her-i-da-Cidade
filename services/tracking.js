// Regras puras do rastreamento (pixel do Meta + Google Analytics). Os scripts só carregam depois do "Aceitar" e só nestas páginas.
export const META_PIXEL_ID = '634998480734565';
export const GA_MEASUREMENT_ID = 'G-07ZQJ764MK';
export const CONSENT_KEY = 'hdc_tracking_consent';

// Só páginas de divulgação. Fora: painel, formulários com dados pessoais/da criança, agendamento, clientes, kart, agente, collab.
export function isTrackablePath(path) {
  const p = String(path || '').split(/[?#]/)[0].replace(/\/+$/, '') || '/';
  return p === '/' || p === '/videos' || p.startsWith('/videos/') || p === '/duvidas' || p.startsWith('/duvidas/');
}

export function isWhatsAppHref(href) {
  return /^(https?:\/\/)?(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)\b|^whatsapp:/i.test(String(href || ''));
}
