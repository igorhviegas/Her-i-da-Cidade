import test from 'node:test';
import assert from 'node:assert/strict';
import { isTrackablePath, isWhatsAppHref } from './tracking.js';

test('rastreia só páginas de divulgação', () => {
  for (const p of ['/', '/videos', '/videos/abc', '/duvidas', '/duvidas/video-convite/', '/?utm_source=x']) assert.equal(isTrackablePath(p), true, p);
  for (const p of ['/admin', '/admin/financeiro', '/formulario-evento', '/agendar-chamada', '/clientes', '/kart', '/agente-hdc', '/privacidade', '/videosx']) assert.equal(isTrackablePath(p), false, p);
});

test('reconhece links de WhatsApp', () => {
  assert.equal(isWhatsAppHref('https://wa.me/5531999044206?text=Oi'), true);
  assert.equal(isWhatsAppHref('https://api.whatsapp.com/send?phone=1'), true);
  assert.equal(isWhatsAppHref('https://instagram.com/oheroidacidade'), false);
  assert.equal(isWhatsAppHref(null), false);
});
